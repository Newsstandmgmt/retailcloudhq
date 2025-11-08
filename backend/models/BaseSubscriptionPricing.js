const { query } = require('../config/database');

class BaseSubscriptionPricing {
    constructor(data) {
        Object.assign(this, data);
    }

    // Create base pricing
    static async create(pricingData) {
        const { name, description, base_price_per_month, is_active } = pricingData;
        
        const result = await query(
            `INSERT INTO base_subscription_pricing (name, description, base_price_per_month, is_active)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name, description || null, base_price_per_month, is_active !== undefined ? is_active : true]
        );
        
        return result.rows[0];
    }

    // Find by ID
    static async findById(id) {
        const result = await query(
            'SELECT * FROM base_subscription_pricing WHERE id = $1 AND is_active = true',
            [id]
        );
        return result.rows[0] || null;
    }

    // Get default base pricing
    static async getDefault() {
        const result = await query(
            `SELECT * FROM base_subscription_pricing 
             WHERE is_active = true 
             ORDER BY base_price_per_month ASC 
             LIMIT 1`
        );
        return result.rows[0] || null;
    }

    // Get all base pricing
    static async findAll() {
        const result = await query(
            `SELECT * FROM base_subscription_pricing 
             WHERE is_active = true 
             ORDER BY base_price_per_month ASC`
        );
        return result.rows;
    }

    // Update base pricing
    static async update(id, updateData) {
        const allowedFields = ['name', 'description', 'base_price_per_month', 'is_active'];
        const updates = [];
        const values = [];
        let paramCount = 1;

        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                updates.push(`${field} = $${paramCount}`);
                values.push(updateData[field]);
                paramCount++;
            }
        }

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        values.push(id);
        const result = await query(
            `UPDATE base_subscription_pricing SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${paramCount}
             RETURNING *`,
            values
        );

        return result.rows[0] || null;
    }

    // Delete (soft delete)
    static async delete(id) {
        const result = await query(
            'UPDATE base_subscription_pricing SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0] || null;
    }
}

module.exports = BaseSubscriptionPricing;

