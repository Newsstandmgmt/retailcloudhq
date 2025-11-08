const { query } = require('../config/database');

class LotteryDailyReport {
    constructor(data) {
        Object.assign(this, data);
    }
    
    // Create or update daily report entry
    static async upsert(storeId, reportDate, reportData, employeeId = null) {
        const {
            debit_credit_card = 0,
            credits_sale = 0,
            debits_sale = 0,
            online_balance = 0,
            instant_balance = 0,
            total_balance = 0,
            register_cash = 0,
            over_short = 0,
            source = 'manual',
            notes = null,
            created_by = null
        } = reportData;
        
        // Calculate total balance if not provided
        const calculatedTotalBalance = total_balance || (online_balance + instant_balance);
        
        const result = await query(
            `INSERT INTO lottery_daily_report (
                store_id, report_date, debit_credit_card, credits_sale, debits_sale,
                online_balance, instant_balance, total_balance,
                register_cash, over_short, employee_id, source, notes, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (store_id, report_date)
            DO UPDATE SET
                debit_credit_card = EXCLUDED.debit_credit_card,
                credits_sale = EXCLUDED.credits_sale,
                debits_sale = EXCLUDED.debits_sale,
                online_balance = EXCLUDED.online_balance,
                instant_balance = EXCLUDED.instant_balance,
                total_balance = EXCLUDED.total_balance,
                register_cash = EXCLUDED.register_cash,
                over_short = EXCLUDED.over_short,
                source = EXCLUDED.source,
                notes = EXCLUDED.notes,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
                storeId, reportDate, debit_credit_card, credits_sale, debits_sale,
                online_balance, instant_balance, calculatedTotalBalance,
                register_cash, over_short, employeeId, source, notes, created_by
            ]
        );
        
        return new LotteryDailyReport(result.rows[0]);
    }
    
    // Get all reports for a store with optional filters
    static async findByStore(storeId, options = {}) {
        const {
            startDate = null,
            endDate = null,
            employeeId = null
        } = options;
        
        let sql = `
            SELECT r.*, u.name as employee_name
            FROM lottery_daily_report r
            LEFT JOIN users u ON r.employee_id = u.id
            WHERE r.store_id = $1
        `;
        const params = [storeId];
        let paramIndex = 2;
        
        if (startDate) {
            sql += ` AND r.report_date >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        
        if (endDate) {
            sql += ` AND r.report_date <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }
        
        if (employeeId) {
            sql += ` AND r.employee_id = $${paramIndex}`;
            params.push(employeeId);
            paramIndex++;
        }
        
        sql += ` ORDER BY r.report_date DESC`;
        
        const result = await query(sql, params);
        return result.rows.map(row => new LotteryDailyReport(row));
    }
    
    // Get totals for a date range
    static async getTotals(storeId, startDate, endDate, employeeId = null) {
        const result = await query(
            `SELECT 
                COALESCE(SUM(debit_credit_card), 0) as total_debit_credit_card,
                COALESCE(SUM(credits_sale), 0) as total_credits_sale,
                COALESCE(SUM(debits_sale), 0) as total_debits_sale,
                COALESCE(SUM(online_balance), 0) as total_online_balance,
                COALESCE(SUM(instant_balance), 0) as total_instant_balance,
                COALESCE(SUM(total_balance), 0) as total_balance,
                COALESCE(SUM(register_cash), 0) as total_register_cash,
                COALESCE(SUM(over_short), 0) as total_over_short
            FROM lottery_daily_report
            WHERE store_id = $1
                AND report_date BETWEEN $2 AND $3
                AND ($4 IS NULL OR employee_id = $4)`,
            [storeId, startDate, endDate, employeeId]
        );
        return result.rows[0] || {};
    }
    
    // Delete report entry
    static async delete(id) {
        const result = await query(
            'DELETE FROM lottery_daily_report WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0] ? new LotteryDailyReport(result.rows[0]) : null;
    }
}

module.exports = LotteryDailyReport;

