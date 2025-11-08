const { query } = require('../config/database');

class OtherIncomeCategory {
    constructor(data) {
        Object.assign(this, data);
    }

    static async create(categoryData) {
        const { store_id, category_name, description, created_by } = categoryData;
        const result = await query(
            `INSERT INTO other_income_categories (store_id, category_name, description, created_by)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [store_id, category_name, description || null, created_by || null]
        );
        return result.rows[0];
    }

    static async findByStore(storeId) {
        const result = await query(
            'SELECT * FROM other_income_categories WHERE store_id = $1 AND is_active = true ORDER BY category_name',
            [storeId]
        );
        return result.rows;
    }

    static async findById(id) {
        const result = await query('SELECT * FROM other_income_categories WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    static async update(id, updateData) {
        const { category_name, description, is_active } = updateData;
        const result = await query(
            `UPDATE other_income_categories 
             SET category_name = COALESCE($1, category_name), 
                 description = COALESCE($2, description),
                 is_active = COALESCE($3, is_active),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [category_name, description, is_active, id]
        );
        return result.rows[0];
    }

    static async delete(id) {
        const result = await query('UPDATE other_income_categories SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
        return result.rows[0];
    }
}

module.exports = OtherIncomeCategory;

