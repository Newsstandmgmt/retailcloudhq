const { query } = require('../config/database');

class LotterySalesPaidoutReport {
    constructor(data) {
        Object.assign(this, data);
    }
    
    // Create or update sales/paidout report entry
    static async upsert(storeId, reportDate, reportData, employeeId = null) {
        const {
            sales_online = 0,
            sales_instant = 0,
            total_sales = 0,
            paidouts_online = 0,
            paidouts_instant = 0,
            total_paidout = 0,
            commission = 0,
            source = 'manual',
            notes = null,
            created_by = null
        } = reportData;
        
        // Calculate totals if not provided
        const calculatedTotalSales = total_sales || (sales_online + sales_instant);
        const calculatedTotalPaidout = total_paidout || (paidouts_online + paidouts_instant);
        
        const result = await query(
            `INSERT INTO lottery_sales_paidout_report (
                store_id, report_date, sales_online, sales_instant, total_sales,
                paidouts_online, paidouts_instant, total_paidout, commission,
                employee_id, source, notes, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (store_id, report_date, employee_id)
            DO UPDATE SET
                sales_online = EXCLUDED.sales_online,
                sales_instant = EXCLUDED.sales_instant,
                total_sales = EXCLUDED.total_sales,
                paidouts_online = EXCLUDED.paidouts_online,
                paidouts_instant = EXCLUDED.paidouts_instant,
                total_paidout = EXCLUDED.total_paidout,
                commission = EXCLUDED.commission,
                source = EXCLUDED.source,
                notes = EXCLUDED.notes,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
                storeId, reportDate, sales_online, sales_instant, calculatedTotalSales,
                paidouts_online, paidouts_instant, calculatedTotalPaidout, commission,
                employeeId, source, notes, created_by
            ]
        );
        
        return new LotterySalesPaidoutReport(result.rows[0]);
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
            FROM lottery_sales_paidout_report r
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
        return result.rows.map(row => new LotterySalesPaidoutReport(row));
    }
    
    // Get totals for a date range
    static async getTotals(storeId, startDate, endDate, employeeId = null) {
        const result = await query(
            `SELECT * FROM calculate_lottery_totals($1, $2, $3, $4)`,
            [storeId, startDate, endDate, employeeId]
        );
        return result.rows[0] || {};
    }
    
    // Delete report entry
    static async delete(id) {
        const result = await query(
            'DELETE FROM lottery_sales_paidout_report WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0] ? new LotterySalesPaidoutReport(result.rows[0]) : null;
    }
}

module.exports = LotterySalesPaidoutReport;

