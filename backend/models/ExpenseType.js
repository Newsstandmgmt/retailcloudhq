const { query } = require('../config/database');

class ExpenseType {
    constructor(data) {
        Object.assign(this, data);
    }

    static async create(expenseTypeData) {
        const { store_id, expense_type_name, description, created_by } = expenseTypeData;
        const result = await query(
            `INSERT INTO expense_types (store_id, expense_type_name, description, created_by)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [store_id, expense_type_name, description || null, created_by || null]
        );
        return result.rows[0];
    }

    static async findByStore(storeId) {
        const result = await query(
            'SELECT * FROM expense_types WHERE store_id = $1 AND is_active = true ORDER BY expense_type_name',
            [storeId]
        );
        return result.rows;
    }

    static async findById(id) {
        const result = await query('SELECT * FROM expense_types WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    static async update(id, updateData) {
        const { expense_type_name, description, is_active } = updateData;
        const result = await query(
            `UPDATE expense_types 
             SET expense_type_name = COALESCE($1, expense_type_name), 
                 description = COALESCE($2, description),
                 is_active = COALESCE($3, is_active),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [expense_type_name, description, is_active, id]
        );
        return result.rows[0];
    }

    static async delete(id) {
        const result = await query('UPDATE expense_types SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
        return result.rows[0];
    }
}

module.exports = ExpenseType;

