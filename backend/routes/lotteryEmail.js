const express = require('express');
const LotteryEmailConfig = require('../models/LotteryEmailConfig');
const LotteryEmailService = require('../services/lotteryEmailService');
const { authenticate, authorize, canAccessStore } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

router.use(authenticate);

// Get email configs for a store
router.get('/stores/:storeId/configs', canAccessStore, async (req, res) => {
    try {
        const configs = await LotteryEmailConfig.findByStore(req.params.storeId);
        res.json({ configs });
    } catch (error) {
        console.error('Get email configs error:', error);
        res.status(500).json({ error: 'Failed to fetch email configs', details: error.message });
    }
});

// Create or update email config
router.post('/stores/:storeId/configs', canAccessStore, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const { retailer_number, report_type, email_address, is_active } = req.body;
        
        if (!report_type || !email_address) {
            return res.status(400).json({ error: 'report_type and email_address are required' });
        }

        const config = await LotteryEmailConfig.create({
            store_id: req.params.storeId,
            retailer_number,
            report_type,
            email_address,
            is_active: is_active !== undefined ? is_active : true
        });

        res.json({ message: 'Email config saved successfully', config });
    } catch (error) {
        console.error('Create email config error:', error);
        res.status(500).json({ error: 'Failed to save email config', details: error.message });
    }
});

// Update email config
router.put('/configs/:id', canAccessStore, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const config = await LotteryEmailConfig.update(req.params.id, req.body);
        if (!config) {
            return res.status(404).json({ error: 'Email config not found' });
        }
        res.json({ message: 'Email config updated successfully', config });
    } catch (error) {
        console.error('Update email config error:', error);
        res.status(500).json({ error: 'Failed to update email config', details: error.message });
    }
});

// Webhook endpoint to receive emails (this would be called by email service like SendGrid)
// For now, we'll create a manual upload endpoint
router.post('/webhook/process-email', upload.single('attachment'), async (req, res) => {
    try {
        // In production, this would be secured with a webhook secret
        const { email_address, email_id, email_subject, report_type } = req.body;

        if (!email_address || !email_id) {
            return res.status(400).json({ error: 'email_address and email_id are required' });
        }

        // Find email config
        const emailConfig = await LotteryEmailConfig.findByEmail(email_address);
        if (!emailConfig) {
            return res.status(404).json({ error: 'Email config not found for this address' });
        }

        // Check if already processed
        const { query: dbQuery } = require('../config/database');
        const existingLog = await dbQuery(
            'SELECT * FROM lottery_email_logs WHERE email_id = $1 AND status = $2',
            [email_id, 'success']
        );

        if (existingLog.rows.length > 0) {
            return res.json({ message: 'Email already processed', skipped: true });
        }

        // Get CSV content from attachment or body
        let csvContent = '';
        if (req.file) {
            csvContent = req.file.buffer.toString('utf-8');
        } else if (req.body.csv_content) {
            csvContent = req.body.csv_content;
        } else {
            return res.status(400).json({ error: 'No CSV content provided' });
        }

        // Process based on report type
        let result;
        if (report_type === 'daily' || emailConfig.report_type === 'daily') {
            result = await LotteryEmailService.processDailySalesEmail(
                emailConfig.id,
                csvContent,
                email_id,
                email_subject || 'Daily Sales Report'
            );
        } else if (report_type === 'weekly' || emailConfig.report_type === 'weekly') {
            result = await LotteryEmailService.processWeeklySalesEmail(
                emailConfig.id,
                csvContent,
                email_id,
                email_subject || 'Weekly Sales Report'
            );
        } else {
            return res.status(400).json({ error: 'Unsupported report type' });
        }

        res.json({ message: 'Email processed successfully', result });
    } catch (error) {
        console.error('Process email error:', error);
        
        // Log the error
        if (req.body.email_config_id) {
            const { query: dbQuery } = require('../config/database');
            await dbQuery(
                `INSERT INTO lottery_email_logs (email_config_id, email_id, email_subject, received_at, status, error_message)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'error', $4)`,
                [req.body.email_config_id, req.body.email_id || 'unknown', req.body.email_subject || '', error.message]
            );
        }

        res.status(500).json({ error: 'Failed to process email', details: error.message });
    }
});

// Manual upload endpoint (for testing/admin use)
router.post('/stores/:storeId/upload-report', canAccessStore, authorize('super_admin', 'admin'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { report_type, email_address } = req.body;

        // Find or create email config
        let emailConfig;
        if (email_address) {
            emailConfig = await LotteryEmailConfig.findByEmail(email_address);
        }

        if (!emailConfig) {
            // Create a temporary config for this upload
            emailConfig = await LotteryEmailConfig.create({
                store_id: req.params.storeId,
                report_type: report_type || 'daily',
                email_address: email_address || `manual-upload-${Date.now()}@retailmanagement.com`,
                is_active: true
            });
        }

        const csvContent = req.file.buffer.toString('utf-8');
        const emailId = `manual-${Date.now()}`;

        let result;
        if (report_type === 'daily' || emailConfig.report_type === 'daily') {
            result = await LotteryEmailService.processDailySalesEmail(
                emailConfig.id,
                csvContent,
                emailId,
                req.file.originalname
            );
        } else {
            return res.status(400).json({ error: 'Unsupported report type for manual upload' });
        }

        res.json({ message: 'Report uploaded and processed successfully', result });
    } catch (error) {
        console.error('Upload report error:', error);
        res.status(500).json({ error: 'Failed to process report', details: error.message });
    }
});

module.exports = router;

