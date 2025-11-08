const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const License = require('../models/License');
const DailyOperatingExpenses = require('../models/DailyOperatingExpenses');
const ExpenseType = require('../models/ExpenseType');
const { authenticate, canAccessStore, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin', 'super_admin')); // Only admins can manage licenses

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../uploads/licenses');
// Ensure upload directory exists
fs.mkdir(uploadDir, { recursive: true }).catch(console.error);

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `license-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow PDF, images, and common document formats
        const allowedTypes = /pdf|jpeg|jpg|png|gif|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, images, and documents are allowed.'));
        }
    }
});

// Get all licenses for a store
router.get('/store/:storeId', canAccessStore, async (req, res) => {
    try {
        const filters = {
            active_only: req.query.active_only === 'true',
            expired_only: req.query.expired_only === 'true',
            expiring_soon: req.query.expiring_soon
        };
        
        const licenses = await License.findByStore(req.params.storeId, filters);
        res.json({ licenses });
    } catch (error) {
        console.error('Get licenses error:', error);
        res.status(500).json({ error: 'Failed to fetch licenses' });
    }
});

// Get license by ID
router.get('/:licenseId', async (req, res) => {
    try {
        const license = await License.findById(req.params.licenseId);
        
        if (!license) {
            return res.status(404).json({ error: 'License not found' });
        }
        
        // Check access to store
        const { canAccessStore } = require('../middleware/auth');
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, license.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        res.json({ license });
    } catch (error) {
        console.error('Get license error:', error);
        res.status(500).json({ error: 'Failed to fetch license' });
    }
});

// Create new license
router.post('/store/:storeId', canAccessStore, upload.single('file'), async (req, res) => {
    try {
        const {
            license_type,
            license_number,
            expiration_date,
            renewal_cost,
            renewal_date,
            reminder_days_before,
            notes
        } = req.body;

        if (!license_type || !license_number || !expiration_date) {
            return res.status(400).json({ 
                error: 'License type, license number, and expiration date are required' 
            });
        }

        let file_path = null;
        let file_name = null;

        if (req.file) {
            file_path = req.file.path;
            file_name = req.file.originalname;
        }

        const license = await License.create({
            store_id: req.params.storeId,
            license_type,
            license_number,
            expiration_date,
            file_path,
            file_name,
            renewal_cost,
            renewal_date,
            reminder_days_before: reminder_days_before || 30,
            entered_by: req.user.id,
            notes
        });

        // If renewal_cost is provided, create expense entry
        if (renewal_cost && parseFloat(renewal_cost) > 0) {
            try {
                await createLicenseExpense(req.params.storeId, license, req.user.id);
            } catch (expenseError) {
                console.error('Error creating license expense (non-blocking):', expenseError);
                // Don't fail license creation if expense creation fails
            }
        }

        res.status(201).json({
            message: 'License created successfully',
            license
        });
    } catch (error) {
        console.error('Create license error:', error);
        res.status(500).json({ error: error.message || 'Failed to create license' });
    }
});

// Update license
router.put('/:licenseId', upload.single('file'), async (req, res) => {
    try {
        const license = await License.findById(req.params.licenseId);
        
        if (!license) {
            return res.status(404).json({ error: 'License not found' });
        }

        // Check access to store
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, license.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const {
            license_type,
            license_number,
            expiration_date,
            renewal_cost,
            renewal_date,
            reminder_days_before,
            is_active,
            notes
        } = req.body;

        let file_path = license.file_path;
        let file_name = license.file_name;

        if (req.file) {
            file_path = req.file.path;
            file_name = req.file.originalname;
        }

        const updatedLicense = await License.update(req.params.licenseId, {
            license_type,
            license_number,
            expiration_date,
            file_path,
            file_name,
            renewal_cost,
            renewal_date,
            reminder_days_before,
            is_active,
            notes
        });

        // If renewal_cost was added/updated, create expense entry
        if (renewal_cost && parseFloat(renewal_cost) > 0 && parseFloat(renewal_cost) !== parseFloat(license.renewal_cost || 0)) {
            try {
                await createLicenseExpense(license.store_id, updatedLicense, req.user.id);
            } catch (expenseError) {
                console.error('Error creating license expense (non-blocking):', expenseError);
            }
        }

        res.json({
            message: 'License updated successfully',
            license: updatedLicense
        });
    } catch (error) {
        console.error('Update license error:', error);
        res.status(500).json({ error: error.message || 'Failed to update license' });
    }
});

// Delete license
router.delete('/:licenseId', async (req, res) => {
    try {
        const license = await License.findById(req.params.licenseId);
        
        if (!license) {
            return res.status(404).json({ error: 'License not found' });
        }

        // Check access to store
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, license.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await License.delete(req.params.licenseId);
        
        res.json({ message: 'License deleted successfully' });
    } catch (error) {
        console.error('Delete license error:', error);
        res.status(500).json({ error: 'Failed to delete license' });
    }
});

// Download license file
router.get('/:licenseId/file', async (req, res) => {
    try {
        const license = await License.findById(req.params.licenseId);
        
        if (!license) {
            return res.status(404).json({ error: 'License not found' });
        }

        if (!license.file_path) {
            return res.status(404).json({ error: 'No file attached to this license' });
        }

        // Check access to store
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, license.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check if file exists
        try {
            await fs.access(license.file_path);
        } catch {
            return res.status(404).json({ error: 'File not found' });
        }

        res.download(license.file_path, license.file_name || 'license-document');
    } catch (error) {
        console.error('Download file error:', error);
        res.status(500).json({ error: 'Failed to download file' });
    }
});

// Get licenses expiring soon (for reminders)
router.get('/expiring-soon/:days?', async (req, res) => {
    try {
        const days = parseInt(req.params.days) || 30;
        const licenses = await License.getExpiringSoon(days);
        res.json({ licenses });
    } catch (error) {
        console.error('Get expiring licenses error:', error);
        res.status(500).json({ error: 'Failed to fetch expiring licenses' });
    }
});

// Helper function to create expense entry for license
async function createLicenseExpense(storeId, license, userId) {
    // Find or create "License Fees" expense type
    let expenseType = await ExpenseType.findByStore(storeId);
    let licenseExpenseType = expenseType.find(et => 
        et.expense_type_name.toLowerCase().includes('license')
    );

    if (!licenseExpenseType) {
        // Create "License Fees" expense type
        licenseExpenseType = await ExpenseType.create({
            store_id: storeId,
            expense_type_name: 'License Fees',
            description: 'License renewal and application fees',
            created_by: userId
        });
    }

    // Create expense entry
    const expenseDate = license.renewal_date || new Date().toISOString().split('T')[0];
    
    await DailyOperatingExpenses.create({
        store_id: storeId,
        expense_type_id: licenseExpenseType.id,
        amount: parseFloat(license.renewal_cost),
        entry_date: expenseDate,
        payment_method: 'other', // Default, can be updated
        description: `${license.license_type} - ${license.license_number} (${license.license_type})`,
        is_recurring: false,
        entered_by: userId
    });
}

module.exports = router;

