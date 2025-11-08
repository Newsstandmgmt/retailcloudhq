const { query } = require('../config/database');

class MobileDevice {
    constructor(data) {
        Object.assign(this, data);
    }

    // Get device by device_id
    static async findByDeviceId(deviceId) {
        const result = await query(
            `SELECT md.*, 
                   s.name as store_name,
                   u.first_name || ' ' || u.last_name as user_name
            FROM mobile_devices md
            LEFT JOIN stores s ON md.store_id = s.id
            LEFT JOIN users u ON md.user_id = u.id
            WHERE md.device_id = $1`,
            [deviceId]
        );
        return result.rows[0] || null;
    }

    // Get all devices for a store
    static async findByStore(storeId, includeInactive = false) {
        let queryStr = `
            SELECT md.*, 
                   u.first_name || ' ' || u.last_name as user_name,
                   u.email as user_email,
                   u.role as user_role,
                   drc.code as registration_code
            FROM mobile_devices md
            LEFT JOIN users u ON md.user_id = u.id
            LEFT JOIN device_registration_codes drc ON md.registration_code_id = drc.id
            WHERE md.store_id = $1
        `;
        
        const params = [storeId];
        
        if (!includeInactive) {
            queryStr += ' AND md.is_active = true';
        }
        
        queryStr += ' ORDER BY md.created_at DESC';
        
        const result = await query(queryStr, params);
        return result.rows;
    }

    // Update device info
    static async update(deviceId, updateData) {
        const { fcm_token, last_sync_at, last_seen_at, metadata, device_name } = updateData;
        
        const updates = [];
        const values = [];
        let paramIndex = 1;
        
        if (fcm_token !== undefined) {
            updates.push(`fcm_token = $${paramIndex++}`);
            values.push(fcm_token);
        }
        
        if (last_sync_at !== undefined) {
            updates.push(`last_sync_at = $${paramIndex++}`);
            values.push(last_sync_at);
        }
        
        if (last_seen_at !== undefined) {
            updates.push(`last_seen_at = $${paramIndex++}`);
            values.push(last_seen_at);
        }
        
        if (metadata !== undefined) {
            updates.push(`metadata = $${paramIndex++}::jsonb`);
            values.push(JSON.stringify(metadata));
        }
        
        if (device_name !== undefined) {
            updates.push(`device_name = $${paramIndex++}`);
            values.push(device_name);
        }
        
        if (updates.length === 0) {
            return await this.findByDeviceId(deviceId);
        }
        
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(deviceId);
        
        const result = await query(
            `UPDATE mobile_devices 
            SET ${updates.join(', ')}
            WHERE device_id = $${paramIndex}
            RETURNING *`,
            values
        );
        
        return result.rows[0] || null;
    }

    // Lock device
    static async lock(deviceId, lockedBy) {
        const result = await query(
            `UPDATE mobile_devices 
            SET is_locked = true, 
                locked_at = CURRENT_TIMESTAMP,
                locked_by = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE device_id = $2
            RETURNING *`,
            [lockedBy, deviceId]
        );
        return result.rows[0] || null;
    }

    // Unlock device
    static async unlock(deviceId) {
        const result = await query(
            `UPDATE mobile_devices 
            SET is_locked = false, 
                locked_at = NULL,
                locked_by = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE device_id = $1
            RETURNING *`,
            [deviceId]
        );
        return result.rows[0] || null;
    }

    // Deactivate device
    static async deactivate(deviceId) {
        const result = await query(
            `UPDATE mobile_devices 
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE device_id = $1
            RETURNING *`,
            [deviceId]
        );
        return result.rows[0] || null;
    }

    // Assign user to device
    static async assignUser(deviceId, userId, assignedBy, permissions = {}, devicePin = null) {
        const bcrypt = require('bcrypt');
        
        // Update device with user assignment
        const deviceResult = await query(
            `UPDATE mobile_devices 
            SET user_id = $1, 
                assigned_by = $2,
                assigned_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE device_id = $3
            RETURNING *`,
            [userId, assignedBy, deviceId]
        );
        
        if (deviceResult.rows.length === 0) {
            throw new Error('Device not found');
        }
        
        const device = deviceResult.rows[0];
        
        // Get user role to determine if PIN is needed
        const User = require('./User');
        const user = await User.findById(userId);
        const userRole = user?.role || 'employee';
        
        // Hash device PIN if provided (for employees) or if user is admin/manager but PIN is set
        let devicePinHash = null;
        if (devicePin) {
            devicePinHash = await bcrypt.hash(devicePin, 10);
        }
        
        // Create or update user device permissions
        const defaultPermissions = {
            can_scan_barcode: true,
            can_adjust_inventory: true,
            can_create_orders: false,
            can_approve_orders: false,
            can_view_reports: false,
            can_edit_products: false,
            can_manage_devices: false,
            can_transfer_inventory: false,
            can_mark_damaged: true,
            can_receive_inventory: true,
            ...permissions
        };
        
        await query(
            `INSERT INTO user_device_permissions 
            (user_id, device_id, can_scan_barcode, can_adjust_inventory, can_create_orders, 
             can_approve_orders, can_view_reports, can_edit_products, can_manage_devices,
             can_transfer_inventory, can_mark_damaged, can_receive_inventory, device_pin_hash)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (user_id, device_id) 
            DO UPDATE SET
                can_scan_barcode = EXCLUDED.can_scan_barcode,
                can_adjust_inventory = EXCLUDED.can_adjust_inventory,
                can_create_orders = EXCLUDED.can_create_orders,
                can_approve_orders = EXCLUDED.can_approve_orders,
                can_view_reports = EXCLUDED.can_view_reports,
                can_edit_products = EXCLUDED.can_edit_products,
                can_manage_devices = EXCLUDED.can_manage_devices,
                can_transfer_inventory = EXCLUDED.can_transfer_inventory,
                can_mark_damaged = EXCLUDED.can_mark_damaged,
                can_receive_inventory = EXCLUDED.can_receive_inventory,
                device_pin_hash = COALESCE(EXCLUDED.device_pin_hash, user_device_permissions.device_pin_hash),
                updated_at = CURRENT_TIMESTAMP`,
            [
                userId,
                device.id,
                defaultPermissions.can_scan_barcode,
                defaultPermissions.can_adjust_inventory,
                defaultPermissions.can_create_orders,
                defaultPermissions.can_approve_orders,
                defaultPermissions.can_view_reports,
                defaultPermissions.can_edit_products,
                defaultPermissions.can_manage_devices,
                defaultPermissions.can_transfer_inventory,
                defaultPermissions.can_mark_damaged,
                defaultPermissions.can_receive_inventory,
                devicePinHash
            ]
        );
        
        return device;
    }

    // Unassign user from device
    static async unassignUser(deviceId) {
        const device = await this.findByDeviceId(deviceId);
        if (!device) {
            throw new Error('Device not found');
        }
        
        // Remove user assignment
        await query(
            `UPDATE mobile_devices 
            SET user_id = NULL, 
                assigned_by = NULL,
                assigned_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE device_id = $1`,
            [deviceId]
        );
        
        // Remove permissions
        await query(
            `DELETE FROM user_device_permissions WHERE device_id = $1`,
            [device.id]
        );
        
        return true;
    }

    // Get device permissions for assigned user
    static async getPermissions(deviceId) {
        const device = await this.findByDeviceId(deviceId);
        if (!device || !device.user_id) {
            // No user assigned, return null permissions
            return null;
        }
        
        const result = await query(
            `SELECT * FROM user_device_permissions 
            WHERE user_id = $1 AND device_id = $2`,
            [device.user_id, device.id]
        );
        
        return result.rows[0] || null;
    }

    // Delete/unregister device (allows device to be re-registered)
    static async delete(deviceId) {
        const device = await this.findByDeviceId(deviceId);
        if (!device) {
            throw new Error('Device not found');
        }
        
        // Delete user device permissions first (if any)
        await query(
            `DELETE FROM user_device_permissions WHERE device_id = $1`,
            [device.id]
        );
        
        // Delete the device
        await query(
            `DELETE FROM mobile_devices WHERE device_id = $1`,
            [deviceId]
        );
        
        return true;
    }
}

module.exports = MobileDevice;

