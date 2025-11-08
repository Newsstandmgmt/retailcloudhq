const express = require('express');
const AdminConfig = require('../models/AdminConfig');
const User = require('../models/User');
const Store = require('../models/Store');
const StoreManager = require('../models/StoreManager');
const { authenticate, authorize } = require('../middleware/auth');
const { auditLogger } = require('../middleware/auditLogger');

const router = express.Router();

router.use(authenticate);

// Get all stores a manager is assigned to (admin can see their own managers, super_admin can see all)
// This route is placed before the router.use(authorize) to allow admin access
router.get('/manager/:managerId/stores', authorize('super_admin', 'admin'), async (req, res) => {
    try {
        // Check if user has permission to view this manager's stores
        const User = require('../models/User');
        const manager = await User.findById(req.params.managerId);
        
        if (!manager) {
            return res.status(404).json({ error: 'Manager not found' });
        }
        
        // Admin can only see stores for managers they created
        if (req.user.role === 'admin' && manager.created_by !== req.user.id) {
            return res.status(403).json({ error: 'Access denied. You can only view stores for managers you created.' });
        }
        
        const stores = await StoreManager.findByManager(req.params.managerId);
        res.json({ stores });
    } catch (error) {
        console.error('Error fetching manager stores:', error);
        res.status(500).json({ error: 'Failed to fetch manager stores' });
    }
});

router.use(authorize('super_admin')); // Only super admin can access these routes

// Get all admins with their configurations
router.get('/admins', async (req, res) => {
    try {
        // Get all admins (including those without admin_config entries)
        // Note: For store assignment, we only want regular 'admin' users, not 'super_admin'
        // Support includeInactive query parameter to show inactive users
        const includeInactive = req.query.includeInactive === 'true';
        const { query } = require('../config/database');
        
        let whereClause = `u.role = 'admin'`;  // Only regular admins for store assignment
        if (!includeInactive) {
            whereClause += ` AND u.is_active = true`;
        }
        
        const adminsResult = await query(
            `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.is_active, u.created_at,
                    ac.max_stores, ac.features, ac.assigned_stores
             FROM users u
             LEFT JOIN admin_config ac ON ac.user_id = u.id
             WHERE ${whereClause}
             ORDER BY u.is_active DESC, u.created_at DESC`
        );
        
        // Format the response to match expected structure
        const admins = adminsResult.rows.map(row => ({
            id: row.id,
            user_id: row.id, // Alias for backward compatibility
            email: row.email,
            first_name: row.first_name,
            last_name: row.last_name,
            role: row.role,
            is_active: row.is_active,
            created_at: row.created_at,
            max_stores: row.max_stores,
            features: typeof row.features === 'string' ? JSON.parse(row.features) : (row.features || {}),
            assigned_stores: row.assigned_stores || []
        }));
        
        res.json({ admins });
    } catch (error) {
        console.error('Error fetching admins:', error);
        res.status(500).json({ error: 'Failed to fetch admins' });
    }
});

// Get admin configuration
router.get('/admin/:userId', async (req, res) => {
    try {
        const config = await AdminConfig.findByUserId(req.params.userId);
        const user = await User.findById(req.params.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ config, user });
    } catch (error) {
        console.error('Error fetching admin config:', error);
        res.status(500).json({ error: 'Failed to fetch admin configuration' });
    }
});

// Create or update admin configuration
router.post('/admin/:userId/config', auditLogger({
    actionType: 'update',
    entityType: 'admin_config',
    getEntityId: (req) => req.params.userId,
    getDescription: (req) => `Updated admin config for user: ${req.params.userId}`,
    logRequestBody: true
}), async (req, res) => {
    try {
        const { max_stores, features, assigned_stores, master_pin } = req.body;
        
        // Verify user is an admin or manager
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (!['admin', 'super_admin', 'manager'].includes(user.role)) {
            return res.status(400).json({ error: 'User must be an admin or manager' });
        }
        
        // Validate master PIN if provided
        if (master_pin && (!/^\d{4,6}$/.test(master_pin))) {
            return res.status(400).json({ error: 'Master PIN must be 4-6 digits' });
        }
        
        const config = await AdminConfig.upsert(req.params.userId, {
            max_stores: max_stores || null,
            features: features || {},
            assigned_stores: assigned_stores || [],
            master_pin: master_pin || null
        });
        
        res.json({
            message: 'Admin configuration updated successfully',
            config
        });
    } catch (error) {
        console.error('Error updating admin config:', error);
        res.status(500).json({ error: 'Failed to update admin configuration' });
    }
});

// Assign manager to store
router.post('/store/:storeId/manager/:managerId', async (req, res) => {
    try {
        const { can_edit, can_view_reports, can_manage_employees } = req.body;
        
        // Check if store has manager_access feature addon
        const StoreSubscription = require('../models/StoreSubscription');
        const addonFeatures = await StoreSubscription.getAddonFeatures(req.params.storeId);
        
        if (!addonFeatures.includes('manager_access')) {
            return res.status(403).json({ 
                error: 'Manager access feature addon is required. Please add "Manager Access" feature addon to this store\'s subscription first.' 
            });
        }
        
        const assignment = await StoreManager.assign(
            req.params.storeId,
            req.params.managerId,
            {
                can_edit: can_edit !== false,
                can_view_reports: can_view_reports !== false,
                can_manage_employees: can_manage_employees === true
            },
            req.user.id
        );
        
        res.json({
            message: 'Manager assigned to store successfully',
            assignment
        });
    } catch (error) {
        console.error('Error assigning manager:', error);
        res.status(500).json({ error: 'Failed to assign manager', details: error.message });
    }
});

// Remove manager from store
router.delete('/store/:storeId/manager/:managerId', async (req, res) => {
    try {
        const assignment = await StoreManager.unassign(req.params.storeId, req.params.managerId);
        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found' });
        }
        
        res.json({ message: 'Manager removed from store successfully' });
    } catch (error) {
        console.error('Error removing manager:', error);
        res.status(500).json({ error: 'Failed to remove manager' });
    }
});

// Get all managers for a store
router.get('/store/:storeId/managers', async (req, res) => {
    try {
        const managers = await StoreManager.findByStore(req.params.storeId);
        res.json({ managers });
    } catch (error) {
        console.error('Error fetching store managers:', error);
        res.status(500).json({ error: 'Failed to fetch store managers' });
    }
});

// Get stores accessible by admin
router.get('/admin/:userId/stores', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Validate userId parameter
        if (!userId || userId === 'undefined' || userId === 'null') {
            return res.status(400).json({ error: 'Invalid user ID provided' });
        }
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Super admin viewing stores for an admin - always include inactive/deactivated stores
        // This is for super admin view, so we want to see everything (active, deactivated, deleted)
        const stores = await AdminConfig.getAccessibleStores(req.user.id, req.user.role, userId, true);
        res.json({ stores });
    } catch (error) {
        console.error('Error fetching admin stores:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to fetch stores',
            details: error.message 
        });
    }
});

// Get all users by role
router.get('/users/:role', async (req, res) => {
    try {
        const { role } = req.params;
        if (!['admin', 'manager', 'employee', 'super_admin', 'all'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        
        const { query } = require('../config/database');
        let result;
        
        if (role === 'all') {
            // Get all users regardless of role
            const includeInactive = req.query.includeInactive === 'true';
            let whereClause = '1=1';
            if (!includeInactive) {
                whereClause = 'is_active = true';
            }
            
            result = await query(
                `SELECT id, email, first_name, last_name, role, is_active, created_at 
                 FROM users 
                 WHERE ${whereClause}
                 ORDER BY is_active DESC, role, created_at DESC`
            );
        } else {
            result = await query(
                'SELECT id, email, first_name, last_name, role, is_active, created_at FROM users WHERE role = $1 ORDER BY created_at DESC',
                [role]
            );
        }
        
        res.json({ users: result.rows });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

module.exports = router;

