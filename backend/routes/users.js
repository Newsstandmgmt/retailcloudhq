const express = require('express');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const { auditLogger } = require('../middleware/auditLogger');

const router = express.Router();

router.use(authenticate);

// Create user (super admin can create any role, admin can create manager/employee)
router.post('/', authorize('super_admin', 'admin'), auditLogger({
    actionType: 'create',
    entityType: 'user',
    getEntityId: (req) => null, // Will be captured from response
    getDescription: (req) => `Created user: ${req.body?.email || 'N/A'}`,
    logRequestBody: true
}), async (req, res) => {
    try {
        const { email, password, first_name, last_name, role, phone } = req.body;
        
        if (!email || !password || !first_name || !last_name || !role) {
            return res.status(400).json({ error: 'All required fields must be provided' });
        }
        
        // Role-based creation logic
        if (req.user.role === 'admin') {
            // Admin can only create managers and employees
            if (role !== 'manager' && role !== 'employee') {
                return res.status(403).json({ error: 'Admins can only create managers and employees' });
            }
        }
        
        // Set must_change_password to true for managers created by admin
        const mustChangePassword = (req.user.role === 'admin' && role === 'manager') || req.body.must_change_password === true;
        
        const newUser = await User.create({
            email,
            password,
            first_name,
            last_name,
            role,
            phone,
            created_by: req.user.id,
            must_change_password: mustChangePassword
        });
        
        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: newUser.id,
                email: newUser.email,
                first_name: newUser.first_name,
                last_name: newUser.last_name,
                role: newUser.role,
                must_change_password: newUser.must_change_password
            }
        });
    } catch (error) {
        console.error('Create user error:', error);
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'User with this email already exists' });
        }
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Get all users (filtered by role permissions)
router.get('/', async (req, res) => {
    try {
        let users;
        const user = req.user;
        const { role } = req.query; // Optional filter by role
        
        if (user.role === 'super_admin') {
            // Super admin sees all users
            users = await User.findAll();
        } else if (user.role === 'admin') {
            // Admin sees managers and employees (not other admins or super_admin)
            users = await User.findAll({ is_active: true });
            users = users.filter(u => u.role === 'manager' || u.role === 'employee');
        } else {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        // Filter by role if provided
        if (role) {
            users = users.filter(u => u.role === role);
        }
        
        res.json({ users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// ============================================
// DEVICE USER MANAGEMENT (Store-scoped)
// Must be defined BEFORE /store/:storeId and /:userId routes to avoid route conflicts
// ============================================

// Get device users for a store (Admin, Super Admin, Manager can see)
router.get('/device/store/:storeId', async (req, res) => {
    try {
        const { storeId } = req.params;
        const { query } = require('../config/database');
        
        // Verify store access
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, storeId]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store' });
        }
        
        // Get users assigned to this store
        const usersResult = await query(
            `SELECT DISTINCT u.id,
                    u.email,
                    u.first_name,
                    u.last_name,
                    u.role,
                    u.phone,
                    u.is_active,
                    u.created_at,
                    u.updated_at,
                    u.must_change_password,
                    (u.employee_pin_hash IS NOT NULL) AS has_employee_pin,
                    (u.password_hash IS NOT NULL) AS has_web_password,
                    (u.must_change_password OR u.email ILIKE '%@employee.com') AS needs_setup
             FROM users u
             LEFT JOIN store_employees se ON se.employee_id = u.id AND se.store_id = $1
             LEFT JOIN store_managers sm ON sm.manager_id = u.id AND sm.store_id = $1
             LEFT JOIN stores s ON (s.manager_id = u.id OR s.admin_id = u.id) AND s.id = $1
             WHERE (se.employee_id IS NOT NULL OR sm.manager_id IS NOT NULL OR (s.id IS NOT NULL AND s.deleted_at IS NULL))
             ORDER BY u.role, u.first_name, u.last_name`,
            [storeId]
        );
        
        res.json({ users: usersResult.rows });
    } catch (error) {
        console.error('Get device users error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            detail: error.detail
        });
        res.status(500).json({ 
            error: 'Failed to fetch device users',
            message: error.message || 'Unknown error'
        });
    }
});

// Create device user (Admin, Super Admin, Manager can create employees)
router.post('/device/store/:storeId', authorize('super_admin', 'admin', 'manager'), auditLogger({
    actionType: 'create',
    entityType: 'user',
    getEntityId: (req) => null,
    getDescription: (req) => `Created device user: ${req.body?.email || 'N/A'}`,
    logRequestBody: true
}), async (req, res) => {
    try {
        const { storeId } = req.params;
        const { email, password, first_name, last_name, role, phone, employee_pin } = req.body;
        const { query } = require('../config/database');
        
        if (!email || !password || !first_name || !last_name || !role) {
            return res.status(400).json({ error: 'All required fields must be provided' });
        }
        
        // Verify store access
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, storeId]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store' });
        }
        
        // Role-based creation logic
        if (req.user.role === 'admin') {
            // Admin can create managers and employees
            if (role !== 'manager' && role !== 'employee') {
                return res.status(403).json({ error: 'Admins can only create managers and employees' });
            }
        } else if (req.user.role === 'manager') {
            // Manager can only create employees
            if (role !== 'employee') {
                return res.status(403).json({ error: 'Managers can only create employees' });
            }
        }
        
        // Create user
        const newUser = await User.create({
            email,
            password,
            first_name,
            last_name,
            role,
            phone,
            created_by: req.user.id,
            employee_pin: role === 'employee' ? employee_pin : undefined
        });
        
        // Assign user to store
        if (role === 'employee') {
            await query(
                `INSERT INTO store_employees (store_id, employee_id, assigned_by, assigned_at)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                 ON CONFLICT (store_id, employee_id) DO NOTHING`,
                [storeId, newUser.id, req.user.id]
            );
        } else if (role === 'manager') {
            await query(
                `INSERT INTO store_managers (store_id, manager_id, assigned_by, assigned_at, can_manage_employees)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP, true)
                 ON CONFLICT (store_id, manager_id) DO NOTHING`,
                [storeId, newUser.id, req.user.id]
            );
        }
        
        res.status(201).json({
            message: 'Device user created successfully',
            user: newUser
        });
    } catch (error) {
        console.error('Create device user error:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'User with this email already exists' });
        }
        res.status(500).json({ error: error.message || 'Failed to create device user' });
    }
});

// Update device user PIN
router.put('/device/:userId/pin', authorize('super_admin', 'admin', 'manager'), auditLogger({
    actionType: 'update',
    entityType: 'user',
    getEntityId: (req) => req.params.userId,
    getDescription: (req) => `Updated device user PIN: ${req.params.userId}`,
    logRequestBody: false
}), async (req, res) => {
    try {
        const { userId } = req.params;
        const { employee_pin } = req.body;
        
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Only employees can have PINs
        if (targetUser.role !== 'employee') {
            return res.status(400).json({ error: 'PINs can only be set for employee users' });
        }
        
        // Verify store access (check if user is assigned to any store the requester can access)
        const { query } = require('../config/database');
        const storeAccessResult = await query(
            `SELECT se.store_id FROM store_employees se
             WHERE se.employee_id = $1
             AND can_user_access_store($2, se.store_id) = true
             LIMIT 1`,
            [userId, req.user.id]
        );
        
        if (storeAccessResult.rows.length === 0 && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (employee_pin === null || employee_pin === '') {
            await User.clearEmployeePin(userId);
            res.json({ message: 'Employee PIN cleared', has_employee_pin: false });
        } else {
            await User.setEmployeePin(userId, employee_pin);
            res.json({ message: 'Employee PIN updated', has_employee_pin: true });
        }
    } catch (error) {
        console.error('Update device user PIN error:', error);
        res.status(500).json({ error: error.message || 'Failed to update PIN' });
    }
});

// Delete device user (with role-based restrictions)
router.delete('/device/:userId', authorize('super_admin', 'admin', 'manager'), auditLogger({
    actionType: 'delete',
    entityType: 'user',
    getEntityId: (req) => req.params.userId,
    getDescription: (req) => `Deleted device user: ${req.params.userId}`,
    logRequestBody: false
}), async (req, res) => {
    try {
        const { userId } = req.params;
        const targetUser = await User.findById(userId);
        
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Users cannot delete themselves
        if (targetUser.id === req.user.id) {
            return res.status(403).json({ error: 'You cannot delete yourself' });
        }
        
        // Role-based deletion rules
        if (req.user.role === 'admin') {
            // Admin can remove managers and employees, but not other admins or super_admin
            if (targetUser.role === 'admin' || targetUser.role === 'super_admin') {
                return res.status(403).json({ error: 'Admins cannot delete other admins or super admins' });
            }
        } else if (req.user.role === 'manager') {
            // Manager can only remove employees
            if (targetUser.role !== 'employee') {
                return res.status(403).json({ error: 'Managers can only delete employees' });
            }
        }
        
        // Verify store access (check if user is assigned to any store the requester can access)
        const { query } = require('../config/database');
        const storeAccessResult = await query(
            `SELECT se.store_id FROM store_employees se
             WHERE se.employee_id = $1
             AND can_user_access_store($2, se.store_id) = true
             UNION
             SELECT sm.store_id FROM store_managers sm
             WHERE sm.manager_id = $1
             AND can_user_access_store($2, sm.store_id) = true
             LIMIT 1`,
            [userId, req.user.id]
        );
        
        if (storeAccessResult.rows.length === 0 && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Soft delete user
        await User.delete(userId);
        
        res.json({ message: 'Device user deleted successfully' });
    } catch (error) {
        console.error('Delete device user error:', error);
        res.status(500).json({ error: 'Failed to delete device user' });
    }
});

// Get users by store (must come after device routes)
router.get('/store/:storeId', async (req, res) => {
    try {
        const users = await User.findByStore(req.params.storeId);
        res.json({ users });
    } catch (error) {
        console.error('Get store users error:', error);
        res.status(500).json({ error: 'Failed to fetch store users' });
    }
});

// Get single user
router.get('/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Admins can only see managers and employees
        if (req.user.role === 'admin' && (user.role === 'super_admin' || user.role === 'admin')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        res.json({ user });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Update user (only super_admin and admin)
router.put('/:userId', authorize('super_admin', 'admin'), auditLogger({
    actionType: 'update',
    entityType: 'user',
    getEntityId: (req) => req.params.userId,
    getDescription: (req) => `Updated user: ${req.params.userId}`,
    logRequestBody: true
}), async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.userId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Admins can't update super_admin or other admins
        if (req.user.role === 'admin' && (targetUser.role === 'super_admin' || targetUser.role === 'admin')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        // Admins can't change role to super_admin or admin
        if (req.user.role === 'admin' && req.body.role && (req.body.role === 'super_admin' || req.body.role === 'admin')) {
            return res.status(403).json({ error: 'Insufficient permissions to set this role' });
        }
        
        const updatedUser = await User.update(req.params.userId, req.body);
        res.json({
            message: 'User updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user (soft delete - only super_admin)
router.delete('/:userId', authorize('super_admin'), auditLogger({
    actionType: 'delete',
    entityType: 'user',
    getEntityId: (req) => req.params.userId,
    getDescription: (req) => `Deleted user: ${req.params.userId}`,
    logRequestBody: false
}), async (req, res) => {
    try {
        const user = await User.delete(req.params.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Reset password (super admin only) - resets to Retail$2025
router.post('/:userId/reset-password', authorize('super_admin'), async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.userId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const defaultPassword = 'Retail$2025';
        await User.changePassword(req.params.userId, defaultPassword);
        
        res.json({ 
            message: 'Password reset successfully',
            new_password: defaultPassword
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// Change password (super admin only) - can set any password
router.post('/:userId/change-password', authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const { new_password } = req.body;
        
        if (!new_password || new_password.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }
        
        const targetUser = await User.findById(req.params.userId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (req.user.role === 'admin' && (targetUser.role === 'super_admin' || targetUser.role === 'admin')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        await User.changePassword(req.params.userId, new_password, true);
        
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

module.exports = router;

