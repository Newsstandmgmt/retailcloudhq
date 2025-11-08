const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const { logLoginAttempt } = require('../middleware/auditLogger');

const router = express.Router();

// Register a new user (only super_admin and admin can create users)
router.post('/register', authenticate, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const { email, password, first_name, last_name, role, phone } = req.body;
        
        // Validation
        if (!email || !password || !first_name || !last_name || !role) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Check if user already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }
        
        // Role validation - admins can only create managers and employees
        if (req.user.role === 'admin' && (role === 'super_admin' || role === 'admin')) {
            return res.status(403).json({ error: 'Insufficient permissions to create this role' });
        }
        
        // Create user
        const newUser = await User.create({
            email,
            password,
            first_name,
            last_name,
            role,
            phone,
            created_by: req.user.id
        });
        
        res.status(201).json({
            message: 'User created successfully',
            user: newUser
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // Get IP address and user agent for logging
        const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        
        // Find user
        const user = await User.findByEmail(email);
        if (!user) {
            await logLoginAttempt(email, false, ipAddress, userAgent, 'User not found');
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Check if user is active
        if (!user.is_active) {
            await logLoginAttempt(email, false, ipAddress, userAgent, 'Account is inactive', user.id);
            return res.status(403).json({ error: 'Account is inactive' });
        }
        
        // Verify password
        const isValidPassword = await User.verifyPassword(password, user.password_hash);
        if (!isValidPassword) {
            await logLoginAttempt(email, false, ipAddress, userAgent, 'Invalid password', user.id);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );
        
        // Log successful login
        await logLoginAttempt(email, true, ipAddress, userAgent, null, user.id);
        
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.role,
                must_change_password: user.must_change_password || false
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Change password (for first login or regular password change)
router.post('/change-password', authenticate, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        
        if (!new_password || new_password.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }
        
        // If must_change_password is true, current_password is optional (first login)
        // Otherwise, current_password is required
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (user.must_change_password) {
            // First login - don't require current password
            await User.changePassword(req.user.id, new_password, true);
        } else {
            // Regular password change - require current password
            if (!current_password) {
                return res.status(400).json({ error: 'Current password is required' });
            }
            await User.changeOwnPassword(req.user.id, current_password, new_password);
        }
        
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        if (error.message === 'Current password is incorrect') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// Get current user profile
router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Include must_change_password in response
        const userWithPasswordFlag = {
            ...user,
            must_change_password: user.must_change_password || false
        };
        
        res.json({
            user: {
                id: userWithPasswordFlag.id,
                email: userWithPasswordFlag.email,
                first_name: userWithPasswordFlag.first_name,
                last_name: userWithPasswordFlag.last_name,
                role: userWithPasswordFlag.role,
                must_change_password: userWithPasswordFlag.must_change_password,
                phone: user.phone,
                is_active: user.is_active
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get user profile' });
    }
});

// Change password
router.post('/change-password', authenticate, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        
        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }
        
        if (new_password.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }
        
        // Get user with password
        const user = await User.findByEmail(req.user.email);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Verify current password
        const isValidPassword = await User.verifyPassword(current_password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        // Update password
        await User.changePassword(user.id, new_password);
        
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

module.exports = router;

