const { query } = require('../config/database');

class CashOnHandService {
    static getExecutor(client) {
        if (client && typeof client.query === 'function') {
            return (text, params) => client.query(text, params);
        }
        return query;
    }

    /**
     * Initialize cash on hand for a store (if not exists)
     */
    static async initialize(storeId, initialBalance = 0, client = null) {
        const exec = this.getExecutor(client);
        const result = await exec(
            `INSERT INTO cash_on_hand (store_id, current_balance)
             VALUES ($1, $2)
             ON CONFLICT (store_id) DO NOTHING
             RETURNING *`,
            [storeId, initialBalance]
        );
        
        if (result.rows.length === 0) {
            // Already exists, return existing
            const existing = await exec(
                'SELECT * FROM cash_on_hand WHERE store_id = $1',
                [storeId]
            );
            return existing.rows[0];
        }
        
        return result.rows[0];
    }

    /**
     * Get current cash on hand balance for a store
     */
    static async getBalance(storeId, client = null) {
        const exec = this.getExecutor(client);
        const result = await exec(
            'SELECT * FROM cash_on_hand WHERE store_id = $1',
            [storeId]
        );
        
        if (result.rows.length === 0) {
            // Initialize if doesn't exist
            return await this.initialize(storeId, 0, client);
        }
        
        return result.rows[0];
    }

    /**
     * Update cash on hand (add or subtract)
     * @param {string} storeId - Store ID
     * @param {number} amount - Amount to add (positive) or subtract (negative)
     * @param {string} transactionType - Type: 'revenue', 'expense', 'payment', 'reimbursement', 'adjustment'
     * @param {string} transactionId - ID of the source transaction
     * @param {string} transactionDate - Date of the transaction
     * @param {string} description - Description of the transaction
     * @param {string} enteredBy - User ID who entered the transaction
     */
    static async updateBalance(
        storeId,
        amount,
        transactionType,
        transactionId = null,
        transactionDate = new Date().toISOString().split('T')[0],
        description = null,
        enteredBy = null,
        client = null
    ) {
        const exec = this.getExecutor(client);
        // Initialize if doesn't exist
        await this.initialize(storeId, 0, client);
        
        // Get current balance
        const current = await this.getBalance(storeId, client);
        const balanceBefore = parseFloat(current.current_balance) || 0;
        const balanceAfter = balanceBefore + parseFloat(amount);
        
        // Update cash on hand
        await exec(
            `UPDATE cash_on_hand
             SET current_balance = $1,
                 last_updated = CURRENT_TIMESTAMP,
                 last_transaction_id = $2,
                 last_transaction_type = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE store_id = $4`,
            [balanceAfter, transactionId, transactionType, storeId]
        );
        
        // Record transaction history
        const transactionResult = await exec(
            `INSERT INTO cash_transactions (
                store_id, transaction_date, transaction_type, transaction_id,
                amount, balance_before, balance_after, description, entered_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [
                storeId,
                transactionDate,
                transactionType,
                transactionId,
                parseFloat(amount),
                balanceBefore,
                balanceAfter,
                description,
                enteredBy
            ]
        );
        
        const transaction = transactionResult.rows[0] || null;

        return {
            balanceBefore,
            balanceAfter,
            amount: parseFloat(amount),
            transaction
        };
    }

    /**
     * Add cash (revenue, reimbursement received)
     */
    static async addCash(storeId, amount, transactionType, transactionId, transactionDate, description, enteredBy, client = null) {
        return await this.updateBalance(
            storeId,
            Math.abs(amount),
            transactionType,
            transactionId,
            transactionDate,
            description,
            enteredBy,
            client
        );
    }

    /**
     * Subtract cash (expense, payment, reimbursement paid)
     */
    static async subtractCash(storeId, amount, transactionType, transactionId, transactionDate, description, enteredBy, client = null) {
        return await this.updateBalance(
            storeId,
            -Math.abs(amount),
            transactionType,
            transactionId,
            transactionDate,
            description,
            enteredBy,
            client
        );
    }

    /**
     * Get cash transaction history
     */
    static async getTransactionHistory(storeId, startDate = null, endDate = null, limit = 100) {
        let sql = `
            SELECT ct.*, u.email as entered_by_email
            FROM cash_transactions ct
            LEFT JOIN users u ON ct.entered_by = u.id
            WHERE ct.store_id = $1
        `;
        const params = [storeId];
        let paramCount = 1;

        if (startDate) {
            paramCount++;
            sql += ` AND ct.transaction_date >= $${paramCount}`;
            params.push(startDate);
        }

        if (endDate) {
            paramCount++;
            sql += ` AND ct.transaction_date <= $${paramCount}`;
            params.push(endDate);
        }

        sql += ` ORDER BY ct.transaction_date DESC, ct.created_at DESC LIMIT $${paramCount + 1}`;
        params.push(limit);

        const result = await query(sql, params);
        return result.rows;
    }

    static async resetBalance(storeId, reason = '', userId = null) {
        const exec = this.getExecutor(null);
        await this.initialize(storeId, 0);

        await exec(
            'DELETE FROM cash_transactions WHERE store_id = $1',
            [storeId]
        );

        await exec(
            `UPDATE cash_on_hand
             SET current_balance = 0,
                 last_transaction_id = NULL,
                 last_transaction_type = NULL,
                 last_updated = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE store_id = $1`,
            [storeId]
        );

        return this.getBalance(storeId);
    }
}

module.exports = CashOnHandService;

