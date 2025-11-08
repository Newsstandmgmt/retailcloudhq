const { query } = require('../config/database');

class Bank {
    constructor(data) {
        Object.assign(this, data);
    }

    static async create(bankData) {
        const { store_id, bank_name, bank_short_name, created_by } = bankData;
        const result = await query(
            `INSERT INTO banks (store_id, bank_name, bank_short_name, created_by)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [store_id, bank_name, bank_short_name || null, created_by || null]
        );
        return result.rows[0];
    }

    static async findByStore(storeId) {
        const result = await query(
            'SELECT * FROM banks WHERE store_id = $1 ORDER BY bank_name',
            [storeId]
        );
        return result.rows;
    }

    static async findById(id) {
        const result = await query('SELECT * FROM banks WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    static async update(id, updateData) {
        const { bank_name, bank_short_name } = updateData;
        const result = await query(
            `UPDATE banks 
             SET bank_name = COALESCE($1, bank_name), 
                 bank_short_name = COALESCE($2, bank_short_name),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [bank_name, bank_short_name, id]
        );
        return result.rows[0];
    }

    static async delete(id) {
        const result = await query('DELETE FROM banks WHERE id = $1 RETURNING *', [id]);
        return result.rows[0];
    }

    // Set default bank (only one can be default per type per store)
    static async setDefault(storeId, bankId, defaultType) {
        // First, unset all defaults of this type for the store
        const unsetField = `is_default_${defaultType}`;
        await query(
            `UPDATE banks SET ${unsetField} = false WHERE store_id = $1`,
            [storeId]
        );

        // Then set this bank as default
        const setField = `is_default_${defaultType}`;
        const result = await query(
            `UPDATE banks SET ${setField} = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
            [bankId]
        );
        return result.rows[0];
    }
}

module.exports = Bank;

