const { query } = require('../config/database');

class MonthlyOperatingExpenses {
    constructor(data) {
        Object.assign(this, data);
    }
    
    // Create or update monthly operating expenses entry with expense items
    static async upsert(storeId, entryMonth, expensesData) {
        const { expense_items = [], entered_by, notes } = expensesData;
        
        // Create or update the main expense entry
        const entryResult = await query(
            `INSERT INTO monthly_operating_expenses (
                store_id, entry_month, entered_by, notes
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT (store_id, entry_month)
            DO UPDATE SET
                entered_by = EXCLUDED.entered_by,
                notes = EXCLUDED.notes,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [storeId, entryMonth, entered_by || null, notes || null]
        );
        
        const expenseEntry = entryResult.rows[0];
        
        // Delete existing expense items
        await query(
            'DELETE FROM monthly_operating_expense_items WHERE expense_entry_id = $1',
            [expenseEntry.id]
        );
        
        // Insert new expense items
        if (expense_items && expense_items.length > 0) {
            for (const item of expense_items) {
                if (item.expense_type_id && (item.amount || parseFloat(item.amount) === 0)) {
                    await query(
                        `INSERT INTO monthly_operating_expense_items (
                            expense_entry_id, expense_type_id, amount
                        ) VALUES ($1, $2, $3)
                        ON CONFLICT (expense_entry_id, expense_type_id)
                        DO UPDATE SET amount = EXCLUDED.amount`,
                        [expenseEntry.id, item.expense_type_id, parseFloat(item.amount) || 0]
                    );
                }
            }
        }
        
        // Fetch the complete entry with items
        return await this.findById(expenseEntry.id);
    }
    
    // Get operating expenses entry for specific month with items
    static async findByMonth(storeId, entryMonth) {
        const result = await query(
            `SELECT e.*, 
             COALESCE(
                 json_agg(
                     json_build_object(
                         'id', ei.id,
                         'expense_type_id', ei.expense_type_id,
                         'expense_type_name', et.expense_type_name,
                         'amount', ei.amount
                     )
                 ) FILTER (WHERE ei.id IS NOT NULL),
                 '[]'::json
             ) as expense_items
             FROM monthly_operating_expenses e
             LEFT JOIN monthly_operating_expense_items ei ON e.id = ei.expense_entry_id
             LEFT JOIN expense_types et ON ei.expense_type_id = et.id
             WHERE e.store_id = $1 AND e.entry_month = $2
             GROUP BY e.id`,
            [storeId, entryMonth]
        );
        
        if (result.rows.length === 0) {
            return null;
        }
        
        const entry = result.rows[0];
        entry.expense_items = entry.expense_items || [];
        return entry;
    }
    
    // Get operating expenses entry by ID with items
    static async findById(id) {
        const result = await query(
            `SELECT e.*, 
             COALESCE(
                 json_agg(
                     json_build_object(
                         'id', ei.id,
                         'expense_type_id', ei.expense_type_id,
                         'expense_type_name', et.expense_type_name,
                         'amount', ei.amount
                     )
                 ) FILTER (WHERE ei.id IS NOT NULL),
                 '[]'::json
             ) as expense_items
             FROM monthly_operating_expenses e
             LEFT JOIN monthly_operating_expense_items ei ON e.id = ei.expense_entry_id
             LEFT JOIN expense_types et ON ei.expense_type_id = et.id
             WHERE e.id = $1
             GROUP BY e.id`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return null;
        }
        
        const entry = result.rows[0];
        entry.expense_items = entry.expense_items || [];
        return entry;
    }
    
    // Get operating expenses entries for date range with items
    static async findByDateRange(storeId, startMonth, endMonth) {
        const result = await query(
            `SELECT e.*, 
             COALESCE(
                 json_agg(
                     json_build_object(
                         'id', ei.id,
                         'expense_type_id', ei.expense_type_id,
                         'expense_type_name', et.expense_type_name,
                         'amount', ei.amount
                     )
                 ) FILTER (WHERE ei.id IS NOT NULL),
                 '[]'::json
             ) as expense_items,
             COALESCE(SUM(ei.amount), 0) as total_amount
             FROM monthly_operating_expenses e
             LEFT JOIN monthly_operating_expense_items ei ON e.id = ei.expense_entry_id
             LEFT JOIN expense_types et ON ei.expense_type_id = et.id
             WHERE e.store_id = $1 AND e.entry_month BETWEEN $2 AND $3
             GROUP BY e.id
             ORDER BY e.entry_month DESC`,
            [storeId, startMonth, endMonth]
        );
        
        return result.rows.map(row => {
            row.expense_items = row.expense_items || [];
            return row;
        });
    }
    
    // Delete expense entry
    static async delete(id) {
        const result = await query(
            'DELETE FROM monthly_operating_expenses WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0] || null;
    }
}

module.exports = MonthlyOperatingExpenses;
