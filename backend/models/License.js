const { query } = require('../config/database');
const path = require('path');
const fs = require('fs').promises;

class License {
    constructor(data) {
        Object.assign(this, data);
    }

    // Create a new license
    static async create(licenseData) {
        const {
            store_id,
            license_type,
            license_number,
            expiration_date,
            file_path,
            file_name,
            renewal_cost,
            renewal_date,
            reminder_days_before,
            entered_by,
            notes
        } = licenseData;

        // Check if expired
        const expirationDate = new Date(expiration_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isExpired = expirationDate < today;

        const result = await query(
            `INSERT INTO store_licenses (
                store_id, license_type, license_number, expiration_date,
                file_path, file_name, renewal_cost, renewal_date,
                reminder_days_before, entered_by, notes, is_expired
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *`,
            [
                store_id,
                license_type,
                license_number,
                expiration_date,
                file_path || null,
                file_name || null,
                parseFloat(renewal_cost || 0),
                renewal_date || null,
                parseInt(reminder_days_before || 30),
                entered_by || null,
                notes || null,
                isExpired
            ]
        );

        return result.rows[0];
    }

    // Find all licenses for a store
    static async findByStore(storeId, filters = {}) {
        let queryStr = 'SELECT * FROM store_licenses WHERE store_id = $1';
        const params = [storeId];

        if (filters.active_only) {
            queryStr += ' AND is_active = true';
        }

        if (filters.expired_only) {
            queryStr += ' AND is_expired = true';
        }

        if (filters.expiring_soon) {
            const days = parseInt(filters.expiring_soon) || 30;
            queryStr += ` AND expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${days} days'`;
        }

        queryStr += ' ORDER BY expiration_date ASC';

        const result = await query(queryStr, params);
        return result.rows;
    }

    // Find license by ID
    static async findById(id) {
        const result = await query('SELECT * FROM store_licenses WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    // Update license
    static async update(id, updateData) {
        const {
            license_type,
            license_number,
            expiration_date,
            file_path,
            file_name,
            renewal_cost,
            renewal_date,
            reminder_days_before,
            is_active,
            notes
        } = updateData;

        // Get current license to check if file needs to be deleted
        const current = await this.findById(id);
        if (!current) {
            throw new Error('License not found');
        }

        // Check if expired
        let isExpired = current.is_expired;
        if (expiration_date) {
            const expirationDate = new Date(expiration_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            isExpired = expirationDate < today;
        }

        // Delete old file if new file is being uploaded
        if (file_path && current.file_path && file_path !== current.file_path) {
            try {
                await fs.unlink(current.file_path);
            } catch (error) {
                console.error('Error deleting old license file:', error);
            }
        }

        const result = await query(
            `UPDATE store_licenses 
             SET license_type = COALESCE($1, license_type),
                 license_number = COALESCE($2, license_number),
                 expiration_date = COALESCE($3, expiration_date),
                 file_path = COALESCE($4, file_path),
                 file_name = COALESCE($5, file_name),
                 renewal_cost = COALESCE($6, renewal_cost),
                 renewal_date = COALESCE($7, renewal_date),
                 reminder_days_before = COALESCE($8, reminder_days_before),
                 is_active = COALESCE($9, is_active),
                 is_expired = $10,
                 notes = COALESCE($11, notes),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $12
             RETURNING *`,
            [
                license_type,
                license_number,
                expiration_date,
                file_path,
                file_name,
                renewal_cost !== undefined ? parseFloat(renewal_cost || 0) : null,
                renewal_date,
                reminder_days_before !== undefined ? parseInt(reminder_days_before || 30) : null,
                is_active,
                isExpired,
                notes,
                id
            ]
        );

        return result.rows[0];
    }

    // Delete license (soft delete)
    static async delete(id) {
        const license = await this.findById(id);
        if (!license) {
            throw new Error('License not found');
        }

        // Delete file if exists
        if (license.file_path) {
            try {
                await fs.unlink(license.file_path);
            } catch (error) {
                console.error('Error deleting license file:', error);
            }
        }

        const result = await query(
            'UPDATE store_licenses SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
            [id]
        );

        return result.rows[0];
    }

    // Get licenses expiring soon (for reminders)
    static async getExpiringSoon(daysBefore = 30) {
        const result = await query(
            `SELECT * FROM store_licenses 
             WHERE is_active = true 
             AND is_expired = false
             AND expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${daysBefore} days'
             AND (reminder_sent = false OR last_reminder_sent IS NULL OR last_reminder_sent < CURRENT_DATE - INTERVAL '7 days')
             ORDER BY expiration_date ASC`
        );
        return result.rows;
    }

    // Mark reminder as sent
    static async markReminderSent(id) {
        const result = await query(
            `UPDATE store_licenses 
             SET reminder_sent = true, 
                 last_reminder_sent = CURRENT_DATE,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        return result.rows[0];
    }

    // Update expired status (run daily)
    static async updateExpiredStatus() {
        const result = await query(
            `UPDATE store_licenses 
             SET is_expired = true, 
                 updated_at = CURRENT_TIMESTAMP
             WHERE expiration_date < CURRENT_DATE 
             AND is_expired = false`
        );
        return result.rowCount;
    }
}

module.exports = License;

