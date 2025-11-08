const { query } = require('../config/database');

class CashOnHandService {
    /**
     * Initialize cash on hand for a store (if not exists)
     */
    static async initialize(storeId, initialBalance = 0) {
        const result = await query(
            `INSERT INTO cash_on_hand (store_id, current_balance)
             VALUES ($1, $2)
             ON CONFLICT (store_id) DO NOTHING
             RETURNING *`,
            [storeId, initialBalance]
        );
        
        if (result.rows.length === 0) {
            // Already exists, return existing
            const existing = await query(
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
    static async getBalance(storeId) {
        const result = await query(
            'SELECT * FROM cash_on_hand WHERE store_id = $1',
            [storeId]
        );
        
        if (result.rows.length === 0) {
            // Initialize if doesn't exist
            return await this.initialize(storeId);
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
        enteredBy = null
    ) {
        // Initialize if doesn't exist
        await this.initialize(storeId);
        
        // Get current balance
        const current = await this.getBalance(storeId);
        const balanceBefore = parseFloat(current.current_balance) || 0;
        const balanceAfter = balanceBefore + parseFloat(amount);
        
        // Update cash on hand
        await query(
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
        await query(
            `INSERT INTO cash_transactions (
                store_id, transaction_date, transaction_type, transaction_id,
                amount, balance_before, balance_after, description, entered_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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
        
        return {
            balanceBefore,
            balanceAfter,
            amount: parseFloat(amount)
        };
    }

    /**
     * Add cash (revenue, reimbursement received)
     */
    static async addCash(storeId, amount, transactionType, transactionId, transactionDate, description, enteredBy) {
        return await this.updateBalance(
            storeId,
            Math.abs(amount),
            transactionType,
            transactionId,
            transactionDate,
            description,
            enteredBy
        );
    }

    /**
     * Subtract cash (expense, payment, reimbursement paid)
     */
    static async subtractCash(storeId, amount, transactionType, transactionId, transactionDate, description, enteredBy) {
        return await this.updateBalance(
            storeId,
            -Math.abs(amount),
            transactionType,
            transactionId,
            transactionDate,
            description,
            enteredBy
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
}

module.exports = CashOnHandService;

