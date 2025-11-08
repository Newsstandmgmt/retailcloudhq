const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const MobileDevice = require('../models/MobileDevice');
const User = require('../models/User');
const AdminConfig = require('../models/AdminConfig');
const { query } = require('../config/database');

const router = express.Router();

// PIN-based login for mobile devices
router.post('/login', async (req, res) => {
    try {
        const { device_id, pin } = req.body;
        
        if (!device_id || !pin) {
            return res.status(400).json({ error: 'Device ID and PIN are required' });
        }
        
        // Get device info
        const device = await MobileDevice.findByDeviceId(device_id);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }
        
        // Check if device is locked
        if (device.is_locked) {
            return res.status(403).json({ error: 'Device is locked. Please contact administrator.' });
        }
        
        // Check if device is active
        if (!device.is_active) {
            return res.status(403).json({ error: 'Device is inactive. Please contact administrator.' });
        }
        
        // Check if user is assigned to device
        if (!device.user_id) {
            return res.status(403).json({ error: 'No user assigned to this device. Please contact administrator.' });
        }
        
        // Get user info
        const user = await User.findById(device.user_id);
        if (!user || !user.is_active) {
            return res.status(403).json({ error: 'User account is inactive.' });
        }
        
        // Check PIN based on user role
        let pinValid = false;
        
        if (user.role === 'admin' || user.role === 'super_admin' || user.role === 'manager') {
            // Admin/Manager: Check master PIN
            const adminConfig = await AdminConfig.findByUserId(user.id);
            if (adminConfig && adminConfig.master_pin_hash) {
                pinValid = await bcrypt.compare(pin, adminConfig.master_pin_hash);
            } else {
                // No master PIN set, check device-specific PIN
                const permissions = await MobileDevice.getPermissions(device_id);
                if (permissions && permissions.device_pin_hash) {
                    pinValid = await bcrypt.compare(pin, permissions.device_pin_hash);
                }
            }
        } else {
            // Employee: Check device-specific PIN
            const permissions = await MobileDevice.getPermissions(device_id);
            if (permissions && permissions.device_pin_hash) {
                pinValid = await bcrypt.compare(pin, permissions.device_pin_hash);
            }
        }
        
        if (!pinValid) {
            return res.status(401).json({ error: 'Invalid PIN' });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role, deviceId: device_id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );
        
        // Get permissions
        const permissions = await MobileDevice.getPermissions(device_id);
        
        // Update device last seen
        await MobileDevice.update(device_id, {
            last_seen_at: new Date()
        });
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.role
            },
            device: {
                id: device.id,
                device_id: device.device_id,
                device_name: device.device_name,
                store_id: device.store_id
            },
            permissions: permissions || {}
        });
    } catch (error) {
        console.error('Device login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

// Verify device is registered (for app startup)
router.get('/verify/:deviceId', async (req, res) => {
    try {
        const device = await MobileDevice.findByDeviceId(req.params.deviceId);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }
        
        res.json({
            registered: true,
            device: {
                id: device.id,
                device_id: device.device_id,
                device_name: device.device_name,
                store_id: device.store_id,
                is_active: device.is_active,
                is_locked: device.is_locked,
                user_assigned: !!device.user_id
            }
        });
    } catch (error) {
        console.error('Device verify error:', error);
        res.status(500).json({ error: 'Failed to verify device' });
    }
});

module.exports = router;

