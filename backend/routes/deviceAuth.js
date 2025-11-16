const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const MobileDevice = require('../models/MobileDevice');
const User = require('../models/User');
const AdminConfig = require('../models/AdminConfig');
const { query } = require('../config/database');

const router = express.Router();

// PIN-based login for mobile devices (supports multi-user per device)
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
        // Try to match by device-specific PIN first; if none set, allow employee's global handheld PIN
        const permResult = await query(
            `SELECT udp.user_id, udp.device_pin_hash, u.employee_pin_hash, u.is_active
             FROM user_device_permissions udp
             JOIN users u ON u.id = udp.user_id
             WHERE udp.device_id = $1`,
            [device.id]
        );
        let authedUser = null;
        for (const row of permResult.rows) {
            let ok = false;
            if (row.device_pin_hash) {
                ok = await bcrypt.compare(pin, row.device_pin_hash);
            } else if (row.employee_pin_hash) {
                ok = await bcrypt.compare(pin, row.employee_pin_hash);
            }
            if (ok) {
                const u = await User.findById(row.user_id);
                if (u && u.is_active) authedUser = u;
                break;
            }
        }

        // If no device-specific PIN matched, allow master PIN for store admin/super admin
        if (!authedUser) {
            // Candidate admins: store.created_by and (if present) store.admin_id
            const storeMeta = await query(`SELECT created_by, admin_id FROM stores WHERE id = $1`, [device.store_id]);
            const adminIds = [];
            if (storeMeta.rows.length > 0) {
                if (storeMeta.rows[0].created_by) adminIds.push(storeMeta.rows[0].created_by);
                if (storeMeta.rows[0].admin_id) adminIds.push(storeMeta.rows[0].admin_id);
            }
            // Deduplicate
            const uniqueAdminIds = [...new Set(adminIds)];
            for (const adminId of uniqueAdminIds) {
                const ac = await AdminConfig.findByUserId(adminId);
                if (ac && ac.master_pin_hash && await bcrypt.compare(pin, ac.master_pin_hash)) {
                    const u = await User.findById(adminId);
                    if (u && u.is_active) {
                        authedUser = u;
                        break;
                    }
                }
            }
        }

        // Global Super Admin master PIN (super admin can unlock any device if they set a master PIN)
        if (!authedUser) {
            const { query } = require('../config/database');
            const supers = await query(
                `SELECT u.id, u.is_active, ac.master_pin_hash
                 FROM users u
                 JOIN admin_config ac ON ac.user_id = u.id
                 WHERE u.role = 'super_admin'`
            );
            for (const row of supers.rows) {
                if (row.master_pin_hash && row.is_active) {
                    const ok = await bcrypt.compare(pin, row.master_pin_hash);
                    if (ok) {
                        const su = await User.findById(row.id);
                        if (su && su.is_active) {
                            authedUser = su;
                            break;
                        }
                    }
                }
            }
        }

        if (!authedUser) {
            return res.status(401).json({ error: 'Invalid PIN' });
        }

        // Generate JWT token for the authenticated user
        const token = jwt.sign(
            { userId: authedUser.id, email: authedUser.email, role: authedUser.role, deviceId: device_id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        // Update device last seen
        await MobileDevice.update(device_id, { last_seen_at: new Date() });

        res.json({
            success: true,
            token,
            user: {
                id: authedUser.id,
                email: authedUser.email,
                first_name: authedUser.first_name,
                last_name: authedUser.last_name,
                role: authedUser.role
            },
            device: {
                id: device.id,
                device_id: device.device_id,
                device_name: device.device_name,
                store_id: device.store_id
            }
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
                user_assigned: !!device.user_id,
                require_wipe: !!device.require_wipe
            }
        });
    } catch (error) {
        console.error('Device verify error:', error);
        res.status(500).json({ error: 'Failed to verify device' });
    }
});

module.exports = router;

