const { query } = require('../config/database');

class DailyOperatingExpenses {
    constructor(data) {
        Object.assign(this, data);
    }
    
    // Create daily expense entry
    static async create(expenseData) {
        const {
            store_id,
            entry_date,
            expense_type_id,
            amount,
            is_recurring = false,
            recurring_frequency = null,
            is_autopay = false,
            payment_method,
            bank_id = null,
            bank_account_name = null,
            credit_card_id = null,
            is_reimbursable = false,
            reimbursement_to = null,
            reimbursement_status = 'none',
            notes = null,
            entered_by
        } = expenseData;
        
        const result = await query(
            `INSERT INTO daily_operating_expenses (
                store_id, entry_date, expense_type_id, amount,
                is_recurring, recurring_frequency, is_autopay,
                payment_method, bank_id, bank_account_name, credit_card_id,
                is_reimbursable, reimbursement_to, reimbursement_status,
                notes, entered_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *`,
            [
                store_id, entry_date, expense_type_id, parseFloat(amount),
                is_recurring, recurring_frequency, is_autopay,
                payment_method, bank_id, bank_account_name, credit_card_id,
                is_reimbursable, reimbursement_to, reimbursement_status,
                notes, entered_by
            ]
        );
        
        return result.rows[0];
    }
    
    // Get expense entry by ID with related data
    static async findById(id) {
        const result = await query(
            `SELECT e.*, 
             et.expense_type_name,
             b.bank_name,
             b.bank_short_name,
             cc.card_name as credit_card_name,
             cc.last_four_digits as credit_card_last_four
             FROM daily_operating_expenses e
             LEFT JOIN expense_types et ON e.expense_type_id = et.id
             LEFT JOIN banks b ON e.bank_id = b.id
             LEFT JOIN credit_cards cc ON cc.id = e.credit_card_id
             WHERE e.id = $1`,
            [id]
        );
        
        return result.rows[0] || null;
    }
    
    // Get expenses for date range with filters
    static async findByDateRange(storeId, filters = {}) {
        const {
            start_date,
            end_date,
            expense_type_id = null,
            payment_method = null,
            reimbursement_status = null,
            is_recurring = null,
            search = null
        } = filters;
        
        let sql = `
            SELECT e.*, 
             et.expense_type_name,
             b.bank_name,
             b.bank_short_name,
             cc.card_name as credit_card_name,
             cc.last_four_digits as credit_card_last_four
             FROM daily_operating_expenses e
             LEFT JOIN expense_types et ON e.expense_type_id = et.id
             LEFT JOIN banks b ON e.bank_id = b.id
             LEFT JOIN credit_cards cc ON cc.id = e.credit_card_id
             WHERE e.store_id = $1
        `;
        
        const params = [storeId];
        let paramCount = 1;
        
        if (start_date) {
            paramCount++;
            sql += ` AND e.entry_date >= $${paramCount}`;
            params.push(start_date);
        }
        
        if (end_date) {
            paramCount++;
            sql += ` AND e.entry_date <= $${paramCount}`;
            params.push(end_date);
        }
        
        if (expense_type_id) {
            paramCount++;
            sql += ` AND e.expense_type_id = $${paramCount}`;
            params.push(expense_type_id);
        }
        
        if (payment_method) {
            paramCount++;
            sql += ` AND e.payment_method = $${paramCount}`;
            params.push(payment_method);
        }
        
        if (reimbursement_status) {
            paramCount++;
            sql += ` AND e.reimbursement_status = $${paramCount}`;
            params.push(reimbursement_status);
        }
        
        if (is_recurring !== null) {
            paramCount++;
            sql += ` AND e.is_recurring = $${paramCount}`;
            params.push(is_recurring);
        }
        
        if (search) {
            paramCount++;
            sql += ` AND (
                e.notes ILIKE $${paramCount} OR
                et.expense_type_name ILIKE $${paramCount} OR
                e.reimbursement_to ILIKE $${paramCount}
            )`;
            params.push(`%${search}%`);
        }
        
        sql += ` ORDER BY e.entry_date DESC, e.created_at DESC`;
        
        const result = await query(sql, params);
        return result.rows;
    }
    
    // Update expense entry
    static async update(id, updateData) {
        const {
            entry_date,
            expense_type_id,
            amount,
            is_recurring,
            recurring_frequency,
            is_autopay,
            payment_method,
            bank_id,
            bank_account_name,
            credit_card_id,
            is_reimbursable,
            reimbursement_to,
            notes
        } = updateData;
        
        const result = await query(
            `UPDATE daily_operating_expenses 
             SET entry_date = COALESCE($1, entry_date),
                 expense_type_id = COALESCE($2, expense_type_id),
                 amount = COALESCE($3, amount),
                 is_recurring = COALESCE($4, is_recurring),
                 recurring_frequency = COALESCE($5, recurring_frequency),
                 is_autopay = COALESCE($6, is_autopay),
                 payment_method = COALESCE($7, payment_method),
                 bank_id = $8,
                 bank_account_name = COALESCE($9, bank_account_name),
                 credit_card_id = $10,
                 is_reimbursable = COALESCE($11, is_reimbursable),
                 reimbursement_to = COALESCE($12, reimbursement_to),
                 notes = COALESCE($13, notes),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $14
             RETURNING *`,
            [
                entry_date, expense_type_id, amount ? parseFloat(amount) : null,
                is_recurring, recurring_frequency, is_autopay,
                payment_method, bank_id, bank_account_name, credit_card_id,
                is_reimbursable, reimbursement_to, notes,
                id
            ]
        );
        
        return result.rows[0] || null;
    }
    
    // Mark expense as reimbursed
    static async markReimbursed(id, reimbursementData) {
        const { 
            reimbursement_date, 
            reimbursement_amount,
            reimbursement_payment_method,
            reimbursement_check_number,
            reimbursement_bank_id
        } = reimbursementData;
        
        const result = await query(
            `UPDATE daily_operating_expenses 
             SET reimbursement_status = 'reimbursed',
                 reimbursement_date = $1,
                 reimbursement_amount = $2,
                 reimbursement_payment_method = $3,
                 reimbursement_check_number = $4,
                 reimbursement_bank_id = $5,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6
             RETURNING *`,
            [
                reimbursement_date, 
                reimbursement_amount ? parseFloat(reimbursement_amount) : null,
                reimbursement_payment_method || null,
                reimbursement_check_number || null,
                reimbursement_bank_id || null,
                id
            ]
        );
        
        return result.rows[0] || null;
    }
    
    // Delete expense entry
    static async delete(id) {
        const result = await query(
            'DELETE FROM daily_operating_expenses WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0] || null;
    }
    
    // Get pending reimbursements
    static async getPendingReimbursements(storeId) {
        const result = await query(
            `SELECT e.*, 
             et.expense_type_name
             FROM daily_operating_expenses e
             LEFT JOIN expense_types et ON e.expense_type_id = et.id
             WHERE e.store_id = $1 AND e.reimbursement_status = 'pending'
             ORDER BY e.entry_date DESC`,
            [storeId]
        );
        
        return result.rows;
    }
}

module.exports = DailyOperatingExpenses;

