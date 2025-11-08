const { query } = require('../config/database');

class DailyCOGS {
    constructor(data) {
        Object.assign(this, data);
    }
    
    // Create or update daily COGS entry
    static async upsert(storeId, entryDate, cogsData) {
        const {
            cost_of_goods_sold = 0,
            total_cigarette_rebate = 0,
            entered_by,
            notes
        } = cogsData;
        
        const result = await query(
            `INSERT INTO daily_cogs (
                store_id, entry_date, cost_of_goods_sold, total_cigarette_rebate,
                entered_by, notes
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (store_id, entry_date)
            DO UPDATE SET
                cost_of_goods_sold = EXCLUDED.cost_of_goods_sold,
                total_cigarette_rebate = EXCLUDED.total_cigarette_rebate,
                entered_by = EXCLUDED.entered_by,
                notes = EXCLUDED.notes,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
                storeId, entryDate, cost_of_goods_sold, total_cigarette_rebate,
                entered_by || null, notes || null
            ]
        );
        
        return result.rows[0];
    }
    
    // Get COGS entry for specific date
    static async findByDate(storeId, entryDate) {
        const result = await query(
            'SELECT * FROM daily_cogs WHERE store_id = $1 AND entry_date = $2',
            [storeId, entryDate]
        );
        return result.rows[0] || null;
    }
    
    // Get COGS entries for date range
    static async findByDateRange(storeId, startDate, endDate) {
        const result = await query(
            'SELECT * FROM daily_cogs WHERE store_id = $1 AND entry_date BETWEEN $2 AND $3 ORDER BY entry_date DESC',
            [storeId, startDate, endDate]
        );
        return result.rows;
    }
}

module.exports = DailyCOGS;

