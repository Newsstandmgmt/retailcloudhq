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

// Get users by store
router.get('/store/:storeId', async (req, res) => {
    try {
        const users = await User.findByStore(req.params.storeId);
        res.json({ users });
    } catch (error) {
        console.error('Get store users error:', error);
        res.status(500).json({ error: 'Failed to fetch store users' });
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
router.post('/:userId/change-password', authorize('super_admin'), async (req, res) => {
    try {
        const { new_password } = req.body;
        
        if (!new_password || new_password.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }
        
        const targetUser = await User.findById(req.params.userId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        await User.changePassword(req.params.userId, new_password);
        
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

module.exports = router;

