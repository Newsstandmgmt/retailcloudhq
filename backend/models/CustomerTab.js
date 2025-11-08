const { query } = require('../config/database');

class CustomerTab {
    constructor(data) {
        Object.assign(this, data);
    }
    
    // Create or get customer tab
    static async findOrCreate(storeId, customerName, customerId = null) {
        // Try to find existing tab
        let result = await query(
            `SELECT * FROM customer_tabs 
             WHERE store_id = $1 AND (
                 (customer_id IS NOT NULL AND customer_id = $2) OR
                 (customer_name = $3 AND customer_id IS NULL)
             )
             LIMIT 1`,
            [storeId, customerId, customerName]
        );
        
        if (result.rows.length > 0) {
            return result.rows[0];
        }
        
        // Create new tab
        result = await query(
            `INSERT INTO customer_tabs (store_id, customer_id, customer_name, current_balance)
             VALUES ($1, $2, $3, 0)
             RETURNING *`,
            [storeId, customerId, customerName]
        );
        
        return result.rows[0];
    }
    
    // Get all tabs for a store
    static async findByStore(storeId) {
        const result = await query(
            `SELECT * FROM customer_tabs 
             WHERE store_id = $1 
             ORDER BY customer_name`,
            [storeId]
        );
        return result.rows;
    }
    
    // Get tab by ID
    static async findById(id) {
        const result = await query(
            'SELECT * FROM customer_tabs WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }
    
    // Add charge (new tab purchase)
    static async addCharge(tabId, transactionDate, amount, description, enteredBy) {
        const tab = await this.findById(tabId);
        if (!tab) {
            throw new Error('Customer tab not found');
        }
        
        const result = await query(
            `INSERT INTO customer_tab_transactions 
             (customer_tab_id, store_id, transaction_date, transaction_type, amount, description, entered_by)
             VALUES ($1, $2, $3, 'charge', $4, $5, $6)
             RETURNING *`,
            [tabId, tab.store_id, transactionDate, amount, description || null, enteredBy]
        );
        
        // Update customer tab balance
        await query(
            `UPDATE customer_tabs 
             SET current_balance = current_balance + $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [amount, tabId]
        );
        
        return result.rows[0];
    }
    
    // Add payment
    static async addPayment(tabId, transactionDate, amount, paymentMethod, enteredBy, dailyRevenueId = null) {
        const tab = await this.findById(tabId);
        if (!tab) {
            throw new Error('Customer tab not found');
        }
        
        const result = await query(
            `INSERT INTO customer_tab_transactions 
             (customer_tab_id, store_id, transaction_date, transaction_type, amount, payment_method, entered_by, daily_revenue_id)
             VALUES ($1, $2, $3, 'payment', $4, $5, $6, $7)
             RETURNING *`,
            [tabId, tab.store_id, transactionDate, amount, paymentMethod, enteredBy, dailyRevenueId]
        );
        
        // Update customer tab balance
        await query(
            `UPDATE customer_tabs 
             SET current_balance = current_balance - $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [amount, tabId]
        );
        
        return result.rows[0];
    }
    
    // Get transactions for a tab
    static async getTransactions(tabId, startDate = null, endDate = null) {
        let sql = `SELECT * FROM customer_tab_transactions 
                   WHERE customer_tab_id = $1`;
        const params = [tabId];
        let paramCount = 2;
        
        if (startDate) {
            sql += ` AND transaction_date >= $${paramCount}`;
            params.push(startDate);
            paramCount++;
        }
        
        if (endDate) {
            sql += ` AND transaction_date <= $${paramCount}`;
            params.push(endDate);
            paramCount++;
        }
        
        sql += ` ORDER BY transaction_date DESC, created_at DESC`;
        
        const result = await query(sql, params);
        return result.rows;
    }
    
    // Get daily tab totals (for revenue calculation)
    // IMPORTANT: Exclude voided charges from totals
    static async getDailyTotals(storeId, entryDate) {
        const result = await query(
            `SELECT 
                COALESCE(SUM(CASE WHEN transaction_type = 'charge' AND (is_voided IS NULL OR is_voided = false) THEN amount ELSE 0 END), 0) as total_charges,
                COALESCE(SUM(CASE WHEN transaction_type = 'payment' THEN amount ELSE 0 END), 0) as total_payments,
                COALESCE(SUM(CASE WHEN transaction_type = 'charge' AND (is_voided IS NULL OR is_voided = false) THEN amount ELSE 0 END) - 
                         SUM(CASE WHEN transaction_type = 'payment' THEN amount ELSE 0 END), 0) as net_tab_amount
             FROM customer_tab_transactions
             WHERE store_id = $1 AND transaction_date = $2`,
            [storeId, entryDate]
        );
        
        return result.rows[0];
    }
    
    // Get all tabs with unpaid balances
    static async getUnpaidTabs(storeId) {
        const result = await query(
            `SELECT * FROM customer_tabs 
             WHERE store_id = $1 AND current_balance > 0
             ORDER BY current_balance DESC, customer_name`,
            [storeId]
        );
        return result.rows;
    }
    
    // Void a charge transaction
    static async voidCharge(transactionId) {
        const { query } = require('../config/database');
        
        // Get the transaction
        const transactionResult = await query(
            'SELECT * FROM customer_tab_transactions WHERE id = $1',
            [transactionId]
        );
        
        if (transactionResult.rows.length === 0) {
            throw new Error('Transaction not found');
        }
        
        const transaction = transactionResult.rows[0];
        
        if (transaction.transaction_type !== 'charge') {
            throw new Error('Can only void charge transactions');
        }
        
        if (transaction.is_voided) {
            throw new Error('Transaction is already voided');
        }
        
        // Mark transaction as voided
        await query(
            `UPDATE customer_tab_transactions 
             SET is_voided = true, 
                 voided_at = CURRENT_TIMESTAMP,
                 notes = COALESCE(notes || '', '') || ' [VOIDED]'
             WHERE id = $1`,
            [transactionId]
        );
        
        // Update customer tab balance (subtract the voided charge amount)
        await query(
            `UPDATE customer_tabs 
             SET current_balance = current_balance - $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [transaction.amount, transaction.customer_tab_id]
        );
        
        return transaction;
    }
    
    // Recalculate balance from all transactions (excluding voided)
    static async recalculateBalance(tabId) {
        const { query } = require('../config/database');
        
        const result = await query(
            `SELECT 
                COALESCE(SUM(CASE WHEN transaction_type = 'charge' AND (is_voided IS NULL OR is_voided = false) THEN amount ELSE 0 END), 0) -
                COALESCE(SUM(CASE WHEN transaction_type = 'payment' THEN amount ELSE 0 END), 0) as calculated_balance
             FROM customer_tab_transactions
             WHERE customer_tab_id = $1`,
            [tabId]
        );
        
        const calculatedBalance = parseFloat(result.rows[0]?.calculated_balance || 0);
        
        // Update the stored balance
        await query(
            `UPDATE customer_tabs 
             SET current_balance = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [calculatedBalance, tabId]
        );
        
        return calculatedBalance;
    }
}

module.exports = CustomerTab;

