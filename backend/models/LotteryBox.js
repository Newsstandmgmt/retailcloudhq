const { query } = require('../config/database');

class LotteryBox {
    constructor(data) {
        Object.assign(this, data);
    }

    static async create(boxData) {
        const { store_id, box_label, qr_code = null, description = null, is_active = true } = boxData;
        
        const result = await query(
            `INSERT INTO lottery_boxes (store_id, box_label, qr_code, description, is_active)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (store_id, box_label) DO UPDATE SET
                 qr_code = EXCLUDED.qr_code,
                 description = EXCLUDED.description,
                 is_active = EXCLUDED.is_active,
                 updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [store_id, box_label, qr_code, description, is_active]
        );
        return result.rows[0];
    }

    static async findByStore(storeId) {
        const result = await query(
            'SELECT * FROM lottery_boxes WHERE store_id = $1 ORDER BY box_label',
            [storeId]
        );
        return result.rows;
    }

    static async findById(id) {
        const result = await query('SELECT * FROM lottery_boxes WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    static async update(id, updateData) {
        const { box_label, qr_code, description, is_active } = updateData;
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (box_label !== undefined) { updates.push(`box_label = $${paramCount++}`); values.push(box_label); }
        if (qr_code !== undefined) { updates.push(`qr_code = $${paramCount++}`); values.push(qr_code); }
        if (description !== undefined) { updates.push(`description = $${paramCount++}`); values.push(description); }
        if (is_active !== undefined) { updates.push(`is_active = $${paramCount++}`); values.push(is_active); }

        if (updates.length === 0) {
            return await this.findById(id);
        }

        values.push(id);
        const result = await query(
            `UPDATE lottery_boxes SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`,
            values
        );
        return result.rows[0] || null;
    }

    static async delete(id) {
        const result = await query('DELETE FROM lottery_boxes WHERE id = $1 RETURNING *', [id]);
        return result.rows[0] || null;
    }
}

module.exports = LotteryBox;

