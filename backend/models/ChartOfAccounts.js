const { query } = require('../config/database');

class ChartOfAccounts {
    constructor(data) {
        Object.assign(this, data);
    }

    static async create(accountData) {
        const { store_id, account_code, account_name, account_type, parent_account_id, created_by } = accountData;
        const result = await query(
            `INSERT INTO chart_of_accounts (store_id, account_code, account_name, account_type, parent_account_id, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [store_id, account_code || null, account_name, account_type, parent_account_id || null, created_by || null]
        );
        return result.rows[0];
    }

    static async findByStore(storeId) {
        const result = await query(
            `SELECT coa.*, 
                    parent.account_name as parent_account_name
             FROM chart_of_accounts coa
             LEFT JOIN chart_of_accounts parent ON parent.id = coa.parent_account_id
             WHERE coa.store_id = $1 AND coa.is_active = true
             ORDER BY coa.account_type, COALESCE(coa.account_code, ''), coa.account_name`,
            [storeId]
        );
        return result.rows;
    }

    static async findById(id) {
        const result = await query('SELECT * FROM chart_of_accounts WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    static async findByStoreAndName(storeId, accountName) {
        const result = await query(
            'SELECT * FROM chart_of_accounts WHERE store_id = $1 AND account_name = $2 AND is_active = true',
            [storeId, accountName]
        );
        return result.rows[0] || null;
    }

    static async update(id, updateData) {
        const { account_code, account_name, account_type, parent_account_id, is_active } = updateData;
        const result = await query(
            `UPDATE chart_of_accounts 
             SET account_code = COALESCE($1, account_code), 
                 account_name = COALESCE($2, account_name), 
                 account_type = COALESCE($3, account_type),
                 parent_account_id = COALESCE($4, parent_account_id),
                 is_active = COALESCE($5, is_active),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6
             RETURNING *`,
            [account_code, account_name, account_type, parent_account_id, is_active, id]
        );
        return result.rows[0];
    }

    static async delete(id) {
        const result = await query('UPDATE chart_of_accounts SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
        return result.rows[0];
    }
}

module.exports = ChartOfAccounts;

