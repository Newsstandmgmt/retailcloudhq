const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const MobileDevice = require('../models/MobileDevice');

// Middleware to verify JWT token
const authenticate = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided. Access denied.' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Get user from database to ensure they still exist and are active
        const result = await query(
            'SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = $1',
            [decoded.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid token. User not found.' });
        }
        
        if (!result.rows[0].is_active) {
            return res.status(403).json({ error: 'User account is inactive.' });
        }
        
        // If this token belongs to a handheld device session, ensure the device is still valid
        if (decoded.deviceId) {
            const device = await MobileDevice.findByDeviceId(decoded.deviceId);
            if (!device) {
                return res.status(401).json({ error: 'Device registration not found. Please re-register the device.' });
            }
            if (!device.is_active || device.is_locked) {
                return res.status(403).json({ error: 'Device access revoked. Please contact an administrator.' });
            }
            if (!device.user_id || device.user_id !== result.rows[0].id) {
                return res.status(403).json({ error: 'Device assignment changed. Please re-register the device.' });
            }
        }

        req.user = result.rows[0];
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token.' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired.' });
        }
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Authentication error.' });
    }
};

// Middleware to check if user has required role
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required.' });
        }
        
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: 'Insufficient permissions.',
                required: allowedRoles,
                current: req.user.role
            });
        }
        
        next();
    };
};

// Middleware to check if user can access a specific store
const canAccessStore = async (req, res, next) => {
    try {
        const storeId =
            req.params.storeId ||
            req.params.id ||
            req.body.store_id ||
            req.query.store_id ||
            req.query.storeId;
        
        if (!storeId) {
            return res.status(400).json({ error: 'Store ID is required.' });
        }
        
        const user = req.user;
        
        // Use database function to check access
        const result = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [user.id, storeId]
        );
        
        if (result.rows[0]?.can_access === true) {
            return next();
        }
        
        // Also check if store exists
        const storeCheck = await query('SELECT id FROM stores WHERE id = $1', [storeId]);
        if (storeCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Store not found.' });
        }
        
        return res.status(403).json({ error: 'Access denied to this store.' });
    } catch (error) {
        console.error('Store access check error:', error);
        res.status(500).json({ error: 'Error checking store access.' });
    }
};

module.exports = {
    authenticate,
    authorize,
    canAccessStore
};

