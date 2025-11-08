const { query } = require('../config/database');

class Lottery13WeekAverage {
    constructor(data) {
        Object.assign(this, data);
    }

    static async create(storeId, reportDate, data) {
        const {
            retailer_number,
            location_name,
            thirteen_week_average,
            total_sales,
            total_commissions,
            balance_forward,
            draw_sales,
            draw_cancels,
            draw_promos,
            draw_comm,
            draw_pays,
            vch_iss,
            vch_rd,
            webcash_iss,
            draw_adj,
            draw_due,
            scratch_offs_sales,
            scratch_offs_rtrns,
            scratch_offs_comm,
            scratch_offs_prms,
            scratch_offs_pays,
            scratch_offs_adj,
            scratch_offs_due,
            card_trans,
            gift_cards,
            prepaid,
            total_due,
            entered_by,
            source = 'manual',
            notes
        } = data;

        const result = await query(
            `INSERT INTO lottery_13week_average (
                store_id, report_date, retailer_number, location_name,
                thirteen_week_average, total_sales, total_commissions,
                balance_forward, draw_sales, draw_cancels, draw_promos, draw_comm, draw_pays,
                vch_iss, vch_rd, webcash_iss, draw_adj, draw_due,
                scratch_offs_sales, scratch_offs_rtrns, scratch_offs_comm,
                scratch_offs_prms, scratch_offs_pays, scratch_offs_adj, scratch_offs_due,
                card_trans, gift_cards, prepaid, total_due,
                entered_by, source, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32)
            ON CONFLICT (store_id, report_date)
            DO UPDATE SET
                retailer_number = EXCLUDED.retailer_number,
                location_name = EXCLUDED.location_name,
                thirteen_week_average = EXCLUDED.thirteen_week_average,
                total_sales = EXCLUDED.total_sales,
                total_commissions = EXCLUDED.total_commissions,
                balance_forward = EXCLUDED.balance_forward,
                draw_sales = EXCLUDED.draw_sales,
                draw_cancels = EXCLUDED.draw_cancels,
                draw_promos = EXCLUDED.draw_promos,
                draw_comm = EXCLUDED.draw_comm,
                draw_pays = EXCLUDED.draw_pays,
                vch_iss = EXCLUDED.vch_iss,
                vch_rd = EXCLUDED.vch_rd,
                webcash_iss = EXCLUDED.webcash_iss,
                draw_adj = EXCLUDED.draw_adj,
                draw_due = EXCLUDED.draw_due,
                scratch_offs_sales = EXCLUDED.scratch_offs_sales,
                scratch_offs_rtrns = EXCLUDED.scratch_offs_rtrns,
                scratch_offs_comm = EXCLUDED.scratch_offs_comm,
                scratch_offs_prms = EXCLUDED.scratch_offs_prms,
                scratch_offs_pays = EXCLUDED.scratch_offs_pays,
                scratch_offs_adj = EXCLUDED.scratch_offs_adj,
                scratch_offs_due = EXCLUDED.scratch_offs_due,
                card_trans = EXCLUDED.card_trans,
                gift_cards = EXCLUDED.gift_cards,
                prepaid = EXCLUDED.prepaid,
                total_due = EXCLUDED.total_due,
                entered_by = EXCLUDED.entered_by,
                source = EXCLUDED.source,
                notes = EXCLUDED.notes,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
                storeId, reportDate, retailer_number, location_name,
                thirteen_week_average || 0, total_sales || 0, total_commissions || 0,
                balance_forward || 0, draw_sales || 0, draw_cancels || 0, draw_promos || 0, draw_comm || 0, draw_pays || 0,
                vch_iss || 0, vch_rd || 0, webcash_iss || 0, draw_adj || 0, draw_due || 0,
                scratch_offs_sales || 0, scratch_offs_rtrns || 0, scratch_offs_comm || 0,
                scratch_offs_prms || 0, scratch_offs_pays || 0, scratch_offs_adj || 0, scratch_offs_due || 0,
                card_trans || 0, gift_cards || 0, prepaid || 0, total_due || 0,
                entered_by, source, notes
            ]
        );
        return result.rows[0];
    }

    static async findByDate(storeId, reportDate) {
        const result = await query(
            'SELECT * FROM lottery_13week_average WHERE store_id = $1 AND report_date = $2',
            [storeId, reportDate]
        );
        return result.rows[0] || null;
    }

    static async findByDateRange(storeId, startDate, endDate) {
        const result = await query(
            'SELECT * FROM lottery_13week_average WHERE store_id = $1 AND report_date BETWEEN $2 AND $3 ORDER BY report_date DESC',
            [storeId, startDate, endDate]
        );
        return result.rows;
    }

    static async findAll(storeId) {
        const result = await query(
            'SELECT * FROM lottery_13week_average WHERE store_id = $1 ORDER BY report_date DESC',
            [storeId]
        );
        return result.rows;
    }

    static async delete(id) {
        const result = await query('DELETE FROM lottery_13week_average WHERE id = $1 RETURNING *', [id]);
        return result.rows[0] || null;
    }
}

module.exports = Lottery13WeekAverage;

