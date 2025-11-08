const { query } = require('../config/database');

class LotteryDrawDay {
    constructor(data) {
        Object.assign(this, data);
    }

    static async createOrUpdate(drawData) {
        const { date, store_id, total_sales, total_cashed = 0, adjustments = 0, 
                commission_source = null, commission_amount = null, notes = null, attachment_url = null } = drawData;
        
        // Calculate net_sale
        const net_sale = total_sales - total_cashed - adjustments;
        
        const result = await query(
            `INSERT INTO lottery_draw_days (date, store_id, total_sales, total_cashed, adjustments, net_sale, 
                                           commission_source, commission_amount, notes, attachment_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (store_id, date) DO UPDATE SET
                 total_sales = EXCLUDED.total_sales,
                 total_cashed = EXCLUDED.total_cashed,
                 adjustments = EXCLUDED.adjustments,
                 net_sale = EXCLUDED.net_sale,
                 commission_source = EXCLUDED.commission_source,
                 commission_amount = EXCLUDED.commission_amount,
                 notes = EXCLUDED.notes,
                 attachment_url = EXCLUDED.attachment_url,
                 updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [date, store_id, total_sales, total_cashed, adjustments, net_sale, 
             commission_source, commission_amount, notes, attachment_url]
        );
        return result.rows[0];
    }

    static async findByStoreAndDate(storeId, date) {
        const result = await query(
            'SELECT * FROM lottery_draw_days WHERE store_id = $1 AND date = $2',
            [storeId, date]
        );
        return result.rows[0] || null;
    }

    static async findByStore(storeId, dateFrom = null, dateTo = null) {
        let sql = 'SELECT * FROM lottery_draw_days WHERE store_id = $1';
        const params = [storeId];
        let paramCount = 2;

        if (dateFrom) {
            sql += ` AND date >= $${paramCount}`;
            params.push(dateFrom);
            paramCount++;
        }

        if (dateTo) {
            sql += ` AND date <= $${paramCount}`;
            params.push(dateTo);
            paramCount++;
        }

        sql += ' ORDER BY date DESC';

        const result = await query(sql, params);
        return result.rows;
    }
}

module.exports = LotteryDrawDay;

