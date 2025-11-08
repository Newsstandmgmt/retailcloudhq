const { query } = require('../config/database');

class DailyCashFlow {
    constructor(data) {
        Object.assign(this, data);
    }
    
    // Create or update daily cash flow entry
    static async upsert(storeId, entryDate, cashFlowData) {
        const {
            ending_cash_on_hand = 0,
            beginning_cash = 0,
            business_daily_cash = 0,
            payroll_paid = 0,
            entered_by,
            notes
        } = cashFlowData;
        
        const result = await query(
            `INSERT INTO daily_cash_flow (
                store_id, entry_date, ending_cash_on_hand, beginning_cash,
                business_daily_cash, payroll_paid, entered_by, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (store_id, entry_date)
            DO UPDATE SET
                ending_cash_on_hand = EXCLUDED.ending_cash_on_hand,
                beginning_cash = EXCLUDED.beginning_cash,
                business_daily_cash = EXCLUDED.business_daily_cash,
                payroll_paid = EXCLUDED.payroll_paid,
                entered_by = EXCLUDED.entered_by,
                notes = EXCLUDED.notes,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
                storeId, entryDate, ending_cash_on_hand, beginning_cash,
                business_daily_cash, payroll_paid, entered_by || null, notes || null
            ]
        );
        
        return result.rows[0];
    }
    
    // Get cash flow entry for specific date
    static async findByDate(storeId, entryDate) {
        const result = await query(
            'SELECT * FROM daily_cash_flow WHERE store_id = $1 AND entry_date = $2',
            [storeId, entryDate]
        );
        return result.rows[0] || null;
    }
    
    // Get cash flow entries for date range
    static async findByDateRange(storeId, startDate, endDate) {
        const result = await query(
            'SELECT * FROM daily_cash_flow WHERE store_id = $1 AND entry_date BETWEEN $2 AND $3 ORDER BY entry_date DESC',
            [storeId, startDate, endDate]
        );
        return result.rows;
    }
}

module.exports = DailyCashFlow;

