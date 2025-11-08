const { query } = require('../config/database');

class DeviceRegistrationCode {
    constructor(data) {
        Object.assign(this, data);
    }

    // Generate a new registration code (generic, no role)
    static async generate(storeId, userId, options = {}) {
        const { expiresAt, maxUses = 1, notes } = options;
        
        // Generate unique code
        const result = await query('SELECT generate_device_code() as code');
        const code = result.rows[0].code;
        
        // Insert code (no role field)
        const insertResult = await query(
            `INSERT INTO device_registration_codes 
            (store_id, code, created_by, expires_at, max_uses, notes)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [storeId, code, userId, expiresAt || null, maxUses, notes || null]
        );
        
        return insertResult.rows[0];
    }

    // Validate and use a registration code
    static async validateAndUse(code, deviceId, deviceName, metadata = {}) {
        // First check if device is already registered
        const existingDevice = await query(
            `SELECT * FROM mobile_devices WHERE device_id = $1`,
            [deviceId]
        );
        
        if (existingDevice.rows.length > 0) {
            throw new Error('Device is already registered. Please contact administrator to reset device registration.');
        }
        
        // Find the code (check both active and inactive to give better error)
        const codeResult = await query(
            `SELECT * FROM device_registration_codes 
            WHERE code = $1`,
            [code]
        );
        
        if (codeResult.rows.length === 0) {
            throw new Error('Invalid registration code. Please check the code and try again.');
        }
        
        const codeData = codeResult.rows[0];
        
        // Check if code is inactive
        if (!codeData.is_active) {
            throw new Error('Registration code has been deactivated. Please contact administrator for a new code.');
        }
        
        // Check if code is already used
        if (codeData.is_used && codeData.current_uses >= codeData.max_uses) {
            throw new Error('Registration code has already been used. Please request a new code.');
        }
        
        // Check expiration
        if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
            throw new Error('Registration code has expired. Please request a new code.');
        }
        
        // Register the device (no user assignment yet, no role)
        const deviceResult = await query(
            `INSERT INTO mobile_devices 
            (device_id, device_name, store_id, registration_code_id, metadata)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [
                deviceId,
                deviceName,
                codeData.store_id,
                codeData.id,
                JSON.stringify(metadata)
            ]
        );
        
        // Mark code as used (or increment uses)
        const newUses = codeData.current_uses + 1;
        const isFullyUsed = newUses >= codeData.max_uses;
        
        await query(
            `UPDATE device_registration_codes 
            SET current_uses = $1, 
                is_used = $2,
                used_at = CASE WHEN $2 THEN CURRENT_TIMESTAMP ELSE used_at END,
                used_by_device_id = CASE WHEN $2 THEN $3 ELSE used_by_device_id END
            WHERE id = $4`,
            [newUses, isFullyUsed, deviceId, codeData.id]
        );
        
        return {
            device: deviceResult.rows[0],
            store: { id: codeData.store_id }
        };
    }

    // Get all codes for a store
    static async findByStore(storeId, includeUsed = false) {
        let queryStr = `
            SELECT drc.*, 
                   u.first_name || ' ' || u.last_name as created_by_name,
                   md.device_name as used_by_device_name
            FROM device_registration_codes drc
            LEFT JOIN users u ON drc.created_by = u.id
            LEFT JOIN mobile_devices md ON drc.used_by_device_id = md.device_id
            WHERE drc.store_id = $1
        `;
        
        const params = [storeId];
        
        if (!includeUsed) {
            queryStr += ' AND (drc.is_used = false OR drc.current_uses < drc.max_uses)';
        }
        
        queryStr += ' ORDER BY drc.created_at DESC';
        
        const result = await query(queryStr, params);
        return result.rows;
    }

    // Get code by ID
    static async findById(codeId) {
        const result = await query(
            `SELECT * FROM device_registration_codes WHERE id = $1`,
            [codeId]
        );
        return result.rows[0] || null;
    }

    // Deactivate a code
    static async deactivate(codeId, userId) {
        const result = await query(
            `UPDATE device_registration_codes 
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *`,
            [codeId]
        );
        return result.rows[0] || null;
    }

    // Reactivate a code
    static async reactivate(codeId, userId) {
        const result = await query(
            `UPDATE device_registration_codes 
            SET is_active = true, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *`,
            [codeId]
        );
        return result.rows[0] || null;
    }

    // Delete a code (only if unused)
    static async delete(codeId) {
        const code = await this.findById(codeId);
        if (!code) {
            throw new Error('Code not found');
        }
        
        if (code.is_used || code.current_uses > 0) {
            throw new Error('Cannot delete a code that has been used');
        }
        
        await query(
            `DELETE FROM device_registration_codes WHERE id = $1`,
            [codeId]
        );
        
        return true;
    }
}

module.exports = DeviceRegistrationCode;

