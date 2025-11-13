const { query } = require('../config/database');

class LotteryDailyReport {
    static async create(storeId, reportDate, data, sourceEmailId = null, filename = null, receivedAt = null) {
        const result = await query(
            `INSERT INTO lottery_daily_reports (store_id, report_date, data, source_email_id, filename, received_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (store_id, report_date) DO UPDATE SET
                 data = EXCLUDED.data,
                 source_email_id = EXCLUDED.source_email_id,
                 filename = EXCLUDED.filename,
                 received_at = EXCLUDED.received_at,
                 updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [storeId, reportDate, data, sourceEmailId, filename, receivedAt]
        );

        return result.rows[0];
    }

    static async findByStoreAndDate(storeId, reportDate) {
        const result = await query(
            'SELECT * FROM lottery_daily_reports WHERE store_id = $1 AND report_date = $2',
            [storeId, reportDate]
        );
        return result.rows[0] || null;
    }

    static async findRecentByStore(storeId, limit = 10) {
        const result = await query(
            'SELECT * FROM lottery_daily_reports WHERE store_id = $1 ORDER BY report_date DESC, created_at DESC LIMIT $2',
            [storeId, limit]
        );
        return result.rows;
    }
}

module.exports = LotteryDailyReport;

