const { query } = require('../config/database');

class LotteryWeeklySettlement {
    constructor(data) {
        Object.assign(this, data);
    }

    static async create(storeId, settlementDate, data) {
        const {
            period_start_date,
            period_end_date,
            retailer_number,
            location_name,
            balance_forward,
            total_sales,
            total_commissions,
            total_adjustments,
            total_payments,
            balance_due,
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
            reconciled = false,
            reconciled_at,
            reconciled_by,
            reconciliation_notes,
            entered_by,
            source = 'manual',
            notes
        } = data;

        const result = await query(
            `INSERT INTO lottery_weekly_settlement (
                store_id, settlement_date, period_start_date, period_end_date,
                retailer_number, location_name,
                balance_forward, total_sales, total_commissions, total_adjustments,
                total_payments, balance_due,
                draw_sales, draw_cancels, draw_promos, draw_comm, draw_pays,
                vch_iss, vch_rd, webcash_iss, draw_adj, draw_due,
                scratch_offs_sales, scratch_offs_rtrns, scratch_offs_comm,
                scratch_offs_prms, scratch_offs_pays, scratch_offs_adj, scratch_offs_due,
                card_trans, gift_cards, prepaid, total_due,
                reconciled, reconciled_at, reconciled_by, reconciliation_notes,
                entered_by, source, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40)
            ON CONFLICT (store_id, settlement_date)
            DO UPDATE SET
                period_start_date = EXCLUDED.period_start_date,
                period_end_date = EXCLUDED.period_end_date,
                retailer_number = EXCLUDED.retailer_number,
                location_name = EXCLUDED.location_name,
                balance_forward = EXCLUDED.balance_forward,
                total_sales = EXCLUDED.total_sales,
                total_commissions = EXCLUDED.total_commissions,
                total_adjustments = EXCLUDED.total_adjustments,
                total_payments = EXCLUDED.total_payments,
                balance_due = EXCLUDED.balance_due,
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
                reconciled = EXCLUDED.reconciled,
                reconciled_at = EXCLUDED.reconciled_at,
                reconciled_by = EXCLUDED.reconciled_by,
                reconciliation_notes = EXCLUDED.reconciliation_notes,
                entered_by = EXCLUDED.entered_by,
                source = EXCLUDED.source,
                notes = EXCLUDED.notes,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
                storeId, settlementDate, period_start_date, period_end_date,
                retailer_number, location_name,
                balance_forward || 0, total_sales || 0, total_commissions || 0, total_adjustments || 0,
                total_payments || 0, balance_due || 0,
                draw_sales || 0, draw_cancels || 0, draw_promos || 0, draw_comm || 0, draw_pays || 0,
                vch_iss || 0, vch_rd || 0, webcash_iss || 0, draw_adj || 0, draw_due || 0,
                scratch_offs_sales || 0, scratch_offs_rtrns || 0, scratch_offs_comm || 0,
                scratch_offs_prms || 0, scratch_offs_pays || 0, scratch_offs_adj || 0, scratch_offs_due || 0,
                card_trans || 0, gift_cards || 0, prepaid || 0, total_due || 0,
                reconciled, reconciled_at, reconciled_by, reconciliation_notes,
                entered_by, source, notes
            ]
        );
        return result.rows[0];
    }

    static async findByDate(storeId, settlementDate) {
        const result = await query(
            'SELECT * FROM lottery_weekly_settlement WHERE store_id = $1 AND settlement_date = $2',
            [storeId, settlementDate]
        );
        return result.rows[0] || null;
    }

    static async findByDateRange(storeId, startDate, endDate) {
        const result = await query(
            'SELECT * FROM lottery_weekly_settlement WHERE store_id = $1 AND settlement_date BETWEEN $2 AND $3 ORDER BY settlement_date DESC',
            [storeId, startDate, endDate]
        );
        return result.rows;
    }

    static async findAll(storeId) {
        const result = await query(
            'SELECT * FROM lottery_weekly_settlement WHERE store_id = $1 ORDER BY settlement_date DESC',
            [storeId]
        );
        return result.rows;
    }

    static async markReconciled(id, userId, notes) {
        const result = await query(
            `UPDATE lottery_weekly_settlement 
             SET reconciled = true, reconciled_at = CURRENT_TIMESTAMP, reconciled_by = $1, reconciliation_notes = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [userId, notes, id]
        );
        return result.rows[0] || null;
    }

    static async delete(id) {
        const result = await query('DELETE FROM lottery_weekly_settlement WHERE id = $1 RETURNING *', [id]);
        return result.rows[0] || null;
    }
}

module.exports = LotteryWeeklySettlement;

