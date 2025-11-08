const { query } = require('../config/database');

class LotteryEmailConfig {
    constructor(data) {
        Object.assign(this, data);
    }

    static async create(configData) {
        const { store_id, retailer_number, report_type, email_address, is_active = true } = configData;
        
        const result = await query(
            `INSERT INTO lottery_email_configs (store_id, retailer_number, report_type, email_address, is_active)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (store_id, report_type) DO UPDATE SET
                 retailer_number = EXCLUDED.retailer_number,
                 email_address = EXCLUDED.email_address,
                 is_active = EXCLUDED.is_active,
                 updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [store_id, retailer_number, report_type, email_address, is_active]
        );
        return result.rows[0];
    }

    static async findByStore(storeId) {
        const result = await query(
            'SELECT * FROM lottery_email_configs WHERE store_id = $1 ORDER BY report_type',
            [storeId]
        );
        return result.rows;
    }

    static async findByEmail(emailAddress) {
        const result = await query(
            'SELECT * FROM lottery_email_configs WHERE email_address = $1 AND is_active = true',
            [emailAddress]
        );
        return result.rows[0] || null;
    }

    static async findByRetailerNumber(retailerNumber) {
        const result = await query(
            'SELECT * FROM lottery_email_configs WHERE retailer_number = $1 AND is_active = true',
            [retailerNumber]
        );
        return result.rows;
    }

    static async update(id, updateData) {
        const { retailer_number, email_address, is_active } = updateData;
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (retailer_number !== undefined) { updates.push(`retailer_number = $${paramCount++}`); values.push(retailer_number); }
        if (email_address !== undefined) { updates.push(`email_address = $${paramCount++}`); values.push(email_address); }
        if (is_active !== undefined) { updates.push(`is_active = $${paramCount++}`); values.push(is_active); }

        if (updates.length === 0) {
            return await this.findById(id);
        }

        values.push(id);
        const result = await query(
            `UPDATE lottery_email_configs SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`,
            values
        );
        return result.rows[0] || null;
    }

    static async findById(id) {
        const result = await query('SELECT * FROM lottery_email_configs WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    static async markProcessed(id, emailId) {
        const result = await query(
            `UPDATE lottery_email_configs 
             SET last_processed_at = CURRENT_TIMESTAMP, last_processed_email_id = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [emailId, id]
        );
        return result.rows[0] || null;
    }
}

module.exports = LotteryEmailConfig;

