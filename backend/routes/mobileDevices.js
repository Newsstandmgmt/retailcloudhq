const express = require('express');
const DeviceRegistrationCode = require('../models/DeviceRegistrationCode');
const MobileDevice = require('../models/MobileDevice');
const User = require('../models/User');
const { authenticate, canAccessStore, authorize } = require('../middleware/auth');

const router = express.Router();

// Public endpoint for code validation (no auth required, code is the auth)
router.post('/register', async (req, res) => {
    try {
        const { code, device_id, device_name, metadata } = req.body;
        
        if (!code || !device_id) {
            return res.status(400).json({ 
                error: 'Registration code and device ID are required' 
            });
        }
        
        const result = await DeviceRegistrationCode.validateAndUse(
            code,
            device_id,
            device_name || 'Unknown Device',
            metadata || {}
        );
        
        // Device registered, but no user assigned yet (admin will assign later)
        res.json({
            success: true,
            device: result.device,
            store: result.store,
            user_assigned: false,
            message: 'Device registered successfully. Please wait for admin to assign a user.'
        });
    } catch (error) {
        console.error('Device registration error:', error);
        res.status(400).json({ 
            error: error.message || 'Failed to register device' 
        });
    }
});

// Generate registration code (admin only) - generic code, no role
router.post('/store/:storeId/codes', authenticate, canAccessStore, authorize('super_admin'), async (req, res) => {
    try {
        const { expires_at, max_uses, notes } = req.body;
        
        const code = await DeviceRegistrationCode.generate(
            req.params.storeId,
            req.user.id,
            {
                expiresAt: expires_at || null,
                maxUses: max_uses || 1,
                notes: notes || null
            }
        );
        
        res.json({ code });
    } catch (error) {
        console.error('Generate code error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate registration code' });
    }
});

// Get all registration codes for a store
router.get('/store/:storeId/codes', authenticate, canAccessStore, authorize('super_admin'), async (req, res) => {
    try {
        const includeUsed = req.query.include_used === 'true';
        const codes = await DeviceRegistrationCode.findByStore(
            req.params.storeId,
            includeUsed
        );
        res.json({ codes });
    } catch (error) {
        console.error('Get codes error:', error);
        res.status(500).json({ error: 'Failed to fetch registration codes' });
    }
});

// Deactivate a code
router.put('/codes/:codeId/deactivate', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        const code = await DeviceRegistrationCode.deactivate(
            req.params.codeId,
            req.user.id
        );
        if (!code) {
            return res.status(404).json({ error: 'Code not found' });
        }
        res.json({ code });
    } catch (error) {
        console.error('Deactivate code error:', error);
        res.status(500).json({ error: 'Failed to deactivate code' });
    }
});

// Reactivate a code
router.put('/codes/:codeId/reactivate', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        const code = await DeviceRegistrationCode.reactivate(
            req.params.codeId,
            req.user.id
        );
        if (!code) {
            return res.status(404).json({ error: 'Code not found' });
        }
        res.json({ code });
    } catch (error) {
        console.error('Reactivate code error:', error);
        res.status(500).json({ error: 'Failed to reactivate code' });
    }
});

// Delete a code (only if unused)
router.delete('/codes/:codeId', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        await DeviceRegistrationCode.delete(req.params.codeId);
        res.json({ message: 'Code deleted successfully' });
    } catch (error) {
        console.error('Delete code error:', error);
        res.status(400).json({ error: error.message || 'Failed to delete code' });
    }
});

// Get all devices for a store
router.get('/store/:storeId/devices', authenticate, canAccessStore, authorize('super_admin'), async (req, res) => {
    try {
        const includeInactive = req.query.include_inactive === 'true';
        const devices = await MobileDevice.findByStore(
            req.params.storeId,
            includeInactive
        );
        res.json({ devices });
    } catch (error) {
        console.error('Get devices error:', error);
        res.status(500).json({ error: 'Failed to fetch devices' });
    }
});

// Lock a device
router.put('/devices/:deviceId/lock', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        const device = await MobileDevice.lock(req.params.deviceId, req.user.id);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }
        res.json({ device });
    } catch (error) {
        console.error('Lock device error:', error);
        res.status(500).json({ error: 'Failed to lock device' });
    }
});

// Unlock a device
router.put('/devices/:deviceId/unlock', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        const device = await MobileDevice.unlock(req.params.deviceId);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }
        res.json({ device });
    } catch (error) {
        console.error('Unlock device error:', error);
        res.status(500).json({ error: 'Failed to unlock device' });
    }
});

// Deactivate a device
router.put('/devices/:deviceId/deactivate', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        const device = await MobileDevice.deactivate(req.params.deviceId);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }
        res.json({ device });
    } catch (error) {
        console.error('Deactivate device error:', error);
        res.status(500).json({ error: 'Failed to deactivate device' });
    }
});

// Get device info (for authenticated device or unauthenticated check)
// This endpoint doesn't require auth, but uses it if provided
router.get('/device/:deviceId', async (req, res) => {
    try {
        const device = await MobileDevice.findByDeviceId(req.params.deviceId);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }
        
        // Try to authenticate if token is provided (optional)
        const authHeader = req.headers.authorization;
        let authenticatedUser = null;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const jwt = require('jsonwebtoken');
                const token = authHeader.substring(7);
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
                const User = require('../models/User');
                authenticatedUser = await User.findById(decoded.userId);
                req.user = authenticatedUser;
                
                // If user is authenticated, verify access
                if (authenticatedUser) {
                    const { query } = require('../config/database');
                    const accessResult = await query(
                        'SELECT can_user_access_store($1, $2) as can_access',
                        [authenticatedUser.id, device.store_id]
                    );
                    
                    if (!accessResult.rows[0]?.can_access) {
                        return res.status(403).json({ error: 'Access denied' });
                    }
                }
            } catch (e) {
                // Auth failed, but continue without user - device info can be checked without auth
                console.log('Optional auth failed (not required):', e.message);
            }
        }
        
        // Get permissions if user is assigned
        let permissions = null;
        if (device.user_id) {
            permissions = await MobileDevice.getPermissions(device.device_id);
        }
        
        res.json({ 
            device,
            permissions: permissions || null,
            user_assigned: !!device.user_id
        });
    } catch (error) {
        console.error('Get device error:', error);
        res.status(500).json({ error: 'Failed to fetch device' });
    }
});

// Update device info (for the device itself) - requires authentication
router.put('/device/:deviceId', authenticate, async (req, res) => {
    try {
        const { fcm_token, last_sync_at, last_seen_at, metadata, device_name } = req.body;
        
        const device = await MobileDevice.update(req.params.deviceId, {
            fcm_token,
            last_sync_at: last_sync_at ? new Date(last_sync_at) : undefined,
            last_seen_at: last_seen_at ? new Date(last_seen_at) : undefined,
            metadata,
            device_name
        });
        
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }
        
        res.json({ device });
    } catch (error) {
        console.error('Update device error:', error);
        res.status(500).json({ error: 'Failed to update device' });
    }
});

// Get available users for assignment (admin only)
router.get('/store/:storeId/users', authenticate, canAccessStore, authorize('super_admin'), async (req, res) => {
    try {
        // Get all users that can be assigned to devices (admins, managers, employees)
        const users = await User.findByStore(req.params.storeId);
        // Filter to only active users
        const activeUsers = users.filter(u => u.is_active !== false);
        res.json({ users: activeUsers });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get device permissions (admin only)
router.get('/devices/:deviceId/permissions', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        const permissions = await MobileDevice.getPermissions(req.params.deviceId);
        res.json({ permissions: permissions || null });
    } catch (error) {
        console.error('Get permissions error:', error);
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
});

// Assign user to device (admin only)
router.post('/devices/:deviceId/assign-user', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        const { user_id, permissions, device_pin } = req.body;
        
        if (!user_id) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        
        const User = require('../models/User');
        const user = await User.findById(user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // For employees, PIN is required unless they already have a stored handheld PIN
        if (user.role === 'employee' && !device_pin && !user.has_employee_pin) {
            return res.status(400).json({ error: 'Device PIN is required for employee users. Set a handheld PIN under Payroll first.' });
        }
        if (device_pin && !/^\d{4,6}$/.test(device_pin)) {
            return res.status(400).json({ error: 'Device PIN must be a 4-6 digit number' });
        }
        
        const device = await MobileDevice.assignUser(
            req.params.deviceId,
            user_id,
            req.user.id,
            permissions || {},
            device_pin || null
        );
        
        res.json({ device, message: 'User assigned successfully' });
    } catch (error) {
        console.error('Assign user error:', error);
        res.status(500).json({ error: error.message || 'Failed to assign user to device' });
    }
});

// Unassign user from device (admin only)
router.post('/devices/:deviceId/unassign-user', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        await MobileDevice.unassignUser(req.params.deviceId);
        res.json({ message: 'User unassigned successfully' });
    } catch (error) {
        console.error('Unassign user error:', error);
        res.status(500).json({ error: error.message || 'Failed to unassign user from device' });
    }
});

// Update user device permissions (admin only)
router.put('/devices/:deviceId/permissions', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        const device = await MobileDevice.findByDeviceId(req.params.deviceId);
        if (!device || !device.user_id) {
            return res.status(400).json({ error: 'Device must have a user assigned first' });
        }
        
        const permissions = req.body;
        await MobileDevice.assignUser(
            req.params.deviceId,
            device.user_id,
            req.user.id,
            permissions
        );
        
        const updatedPermissions = await MobileDevice.getPermissions(req.params.deviceId);
        res.json({ permissions: updatedPermissions });
    } catch (error) {
        console.error('Update permissions error:', error);
        res.status(500).json({ error: error.message || 'Failed to update permissions' });
    }
});

// Delete/unregister device (admin only) - allows device to be re-registered
router.delete('/devices/:deviceId', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        const device = await MobileDevice.findByDeviceId(req.params.deviceId);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }
        
        // Check store access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, device.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store' });
        }
        
        // Delete device and its permissions
        await MobileDevice.delete(req.params.deviceId);
        res.json({ message: 'Device unregistered successfully. Device can now be registered again with a new code.' });
    } catch (error) {
        console.error('Delete device error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete device' });
    }
});

// Store admin access: view devices for assignment
router.get('/store/:storeId/devices/assignments', authenticate, canAccessStore, authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const includeInactive = req.query.include_inactive === 'true';
        const devices = await MobileDevice.findByStore(req.params.storeId, includeInactive);
        res.json({ devices });
    } catch (error) {
        console.error('Get assignable devices error:', error);
        res.status(500).json({ error: 'Failed to fetch devices' });
    }
});

// Store admin access: list assignable users (employees/managers)
router.get('/store/:storeId/assignable-users', authenticate, canAccessStore, authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const users = await User.findByStore(req.params.storeId);
        const filtered = (users || []).filter((user) => user.is_active !== false && user.role !== 'super_admin');
        res.json({ users: filtered });
    } catch (error) {
        console.error('Get assignable users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Store admin access: assign employee with PIN
router.post('/store/:storeId/devices/:deviceId/assign-employee', authenticate, canAccessStore, authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const { user_id, permissions = {}, device_pin } = req.body;
        if (!user_id) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const device = await MobileDevice.findByDeviceId(req.params.deviceId);
        if (!device || device.store_id !== req.params.storeId) {
            return res.status(404).json({ error: 'Device not found for this store' });
        }

        const targetUser = await User.findById(user_id);
        if (!targetUser || targetUser.is_active === false) {
            return res.status(404).json({ error: 'User not found or inactive' });
        }

        // Ensure user belongs to store
        const storeUsers = await User.findByStore(req.params.storeId);
        if (!storeUsers.some((u) => u.id === user_id)) {
            return res.status(400).json({ error: 'User does not belong to this store' });
        }

        // Admins can only assign employees
        if (req.user.role === 'admin' && targetUser.role !== 'employee') {
            return res.status(403).json({ error: 'Store admins can only assign employee users' });
        }

        if (targetUser.role === 'employee') {
            if (!device_pin && !targetUser.has_employee_pin) {
                return res.status(400).json({ error: 'Device PIN is required for employees. Set a handheld PIN under Payroll first.' });
            }
            if (device_pin && !/^\d{4,6}$/.test(device_pin)) {
                return res.status(400).json({ error: 'PIN must be 4-6 digits' });
            }
        }

        await MobileDevice.assignUser(
            req.params.deviceId,
            user_id,
            req.user.id,
            permissions,
            device_pin || null
        );

        res.json({ message: 'User assigned to device' });
    } catch (error) {
        console.error('Assign employee error:', error);
        res.status(500).json({ error: error.message || 'Failed to assign employee' });
    }
});

router.post('/store/:storeId/devices/:deviceId/unassign-employee', authenticate, canAccessStore, authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const device = await MobileDevice.findByDeviceId(req.params.deviceId);
        if (!device || device.store_id !== req.params.storeId) {
            return res.status(404).json({ error: 'Device not found for this store' });
        }

        await MobileDevice.unassignUser(req.params.deviceId);
        res.json({ message: 'User unassigned successfully' });
    } catch (error) {
        console.error('Unassign employee error:', error);
        res.status(500).json({ error: error.message || 'Failed to unassign employee' });
    }
});

module.exports = router;

