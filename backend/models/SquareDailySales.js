const { query } = require('../config/database');

class SquareDailySales {
    constructor(data) {
        Object.assign(this, data);
    }

    static async upsert(storeId, salesDate, connectionId, salesData) {
        const {
            gross_card_sales = 0,
            card_fees = 0,
            net_card_sales = 0,
            currency = 'USD',
            raw_payload = null,
        } = salesData;

        const result = await query(
            `INSERT INTO square_daily_sales (
                store_id,
                sales_date,
                square_connection_id,
                gross_card_sales,
                card_fees,
                net_card_sales,
                currency,
                raw_payload,
                synced_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
            ON CONFLICT (store_id, sales_date)
            DO UPDATE SET
                square_connection_id = EXCLUDED.square_connection_id,
                gross_card_sales = EXCLUDED.gross_card_sales,
                card_fees = EXCLUDED.card_fees,
                net_card_sales = EXCLUDED.net_card_sales,
                currency = EXCLUDED.currency,
                raw_payload = EXCLUDED.raw_payload,
                synced_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
                storeId,
                salesDate,
                connectionId || null,
                gross_card_sales,
                card_fees,
                net_card_sales,
                currency,
                raw_payload ? JSON.stringify(raw_payload) : null,
            ]
        );

        return result.rows[0] || null;
    }

    static async findByStoreAndDate(storeId, salesDate) {
        const result = await query(
            `SELECT * FROM square_daily_sales WHERE store_id = $1 AND sales_date = $2`,
            [storeId, salesDate]
        );
        return result.rows[0] || null;
    }

    static async getLatestSyncDate(storeId) {
        const result = await query(
            `SELECT sales_date 
             FROM square_daily_sales 
             WHERE store_id = $1 
             ORDER BY sales_date DESC 
             LIMIT 1`,
            [storeId]
        );
        return result.rows[0]?.sales_date || null;
    }

    static async getNextSyncDate(storeId, fallbackStartDate) {
        const latest = await this.getLatestSyncDate(storeId);
        if (!latest) {
            return fallbackStartDate;
        }

        const next = new Date(`${latest}T00:00:00Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        return next.toISOString().slice(0, 10);
    }
}

module.exports = SquareDailySales;

