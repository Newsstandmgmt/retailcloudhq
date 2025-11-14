const { query } = require('../config/database');

class LotteryEmailRule {
    constructor(data) {
        Object.assign(this, data);
    }

    static async create(ruleData) {
        const {
            email_account_id,
            report_type,
            to_address,
            subject_contains,
            sender_contains = 'palottery.com',
            retailer_number,
            is_active = true,
            label_id = null,
            label_name = null
        } = ruleData;
        
        const result = await query(
            `INSERT INTO lottery_email_rules (
                email_account_id,
                report_type,
                to_address,
                subject_contains,
                sender_contains,
                retailer_number,
                is_active,
                label_id,
                label_name
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                email_account_id,
                report_type,
                to_address,
                subject_contains,
                sender_contains,
                retailer_number,
                is_active,
                label_id,
                label_name
            ]
        );
        return result.rows[0];
    }

    static async findByAccount(emailAccountId) {
        const result = await query(
            'SELECT * FROM lottery_email_rules WHERE email_account_id = $1 ORDER BY report_type',
            [emailAccountId]
        );
        return result.rows;
    }

    static async findById(id) {
        const result = await query('SELECT * FROM lottery_email_rules WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    static async update(id, updateData) {
        const { to_address, subject_contains, sender_contains, retailer_number, is_active, label_id, label_name } = updateData;
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (to_address !== undefined) { updates.push(`to_address = $${paramCount++}`); values.push(to_address); }
        if (subject_contains !== undefined) { updates.push(`subject_contains = $${paramCount++}`); values.push(subject_contains); }
        if (sender_contains !== undefined) { updates.push(`sender_contains = $${paramCount++}`); values.push(sender_contains); }
        if (retailer_number !== undefined) { updates.push(`retailer_number = $${paramCount++}`); values.push(retailer_number); }
        if (is_active !== undefined) { updates.push(`is_active = $${paramCount++}`); values.push(is_active); }
        if (label_id !== undefined) { updates.push(`label_id = $${paramCount++}`); values.push(label_id); }
        if (label_name !== undefined) { updates.push(`label_name = $${paramCount++}`); values.push(label_name); }

        if (updates.length === 0) {
            return await this.findById(id);
        }

        values.push(id);
        const result = await query(
            `UPDATE lottery_email_rules SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`,
            values
        );
        return result.rows[0] || null;
    }

    static async delete(id) {
        const result = await query('DELETE FROM lottery_email_rules WHERE id = $1 RETURNING *', [id]);
        return result.rows[0] || null;
    }
}

module.exports = LotteryEmailRule;

