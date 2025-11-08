const { query } = require('../config/database');

class DailyLottery {
    constructor(data) {
        Object.assign(this, data);
    }
    
    // Create or update daily lottery entry
    static async upsert(storeId, entryDate, lotteryData) {
        const {
            // Legacy fields
            total_lottery_cash = 0,
            daily_lottery_cash = 0,
            lottery_commission = 0,
            thirteen_week_average = 0,
            pa_lottery_due = 0,
            fulton_bank_lottery_deposit = 0,
            fulton_bank_balance = 0,
            // New Google Sheets fields
            retailer_number,
            location_name,
            balance_forward = 0,
            draw_sales = 0,
            draw_cancels = 0,
            draw_promos = 0,
            draw_comm = 0,
            draw_pays = 0,
            vch_iss = 0,
            vch_rd = 0,
            webcash_iss = 0,
            draw_adj = 0,
            draw_due = 0,
            scratch_offs_sales = 0,
            scratch_offs_rtrns = 0,
            scratch_offs_comm = 0,
            scratch_offs_prms = 0,
            scratch_offs_pays = 0,
            scratch_offs_adj = 0,
            scratch_offs_due = 0,
            card_trans = 0,
            gift_cards = 0,
            prepaid = 0,
            total_due = 0,
            // Accounting-specific fields
            daily_draw_sales = 0,
            daily_draw_net = 0,
            daily_instant_sales = 0,
            daily_instant_adjustment = 0,
            daily_instant_pay = 0,
            daily_lottery_card_transaction = 0,
            entered_by,
            notes
        } = lotteryData;
        
        // Calculate legacy fields from new fields if not provided
        const calculatedTotalLotteryCash = total_lottery_cash || (draw_sales + scratch_offs_sales);
        const calculatedDailyLotteryCash = daily_lottery_cash || draw_sales;
        const calculatedLotteryCommission = lottery_commission || (draw_comm + scratch_offs_comm);
        const calculatedPaLotteryDue = pa_lottery_due || total_due;
        
        // Calculate accounting fields if not explicitly provided
        const calculatedDailyDrawSales = daily_draw_sales || draw_sales;
        const calculatedDailyDrawNet = daily_draw_net || (draw_sales - draw_cancels - draw_promos + draw_adj);
        const calculatedDailyInstantSales = daily_instant_sales || scratch_offs_sales;
        const calculatedDailyInstantAdjustment = daily_instant_adjustment || scratch_offs_adj;
        const calculatedDailyInstantPay = daily_instant_pay || scratch_offs_pays;
        const calculatedDailyLotteryCardTransaction = daily_lottery_card_transaction || card_trans;
        
        const result = await query(
            `INSERT INTO daily_lottery (
                store_id, entry_date, 
                total_lottery_cash, daily_lottery_cash, lottery_commission, 
                thirteen_week_average, pa_lottery_due,
                fulton_bank_lottery_deposit, fulton_bank_balance,
                retailer_number, location_name, balance_forward,
                draw_sales, draw_cancels, draw_promos, draw_comm, draw_pays,
                vch_iss, vch_rd, webcash_iss, draw_adj, draw_due,
                scratch_offs_sales, scratch_offs_rtrns, scratch_offs_comm,
                scratch_offs_prms, scratch_offs_pays, scratch_offs_adj, scratch_offs_due,
                card_trans, gift_cards, prepaid, total_due,
                daily_draw_sales, daily_draw_net, daily_instant_sales, 
                daily_instant_adjustment, daily_instant_pay, daily_lottery_card_transaction,
                entered_by, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41)
            ON CONFLICT (store_id, entry_date)
            DO UPDATE SET
                total_lottery_cash = EXCLUDED.total_lottery_cash,
                daily_lottery_cash = EXCLUDED.daily_lottery_cash,
                lottery_commission = EXCLUDED.lottery_commission,
                thirteen_week_average = EXCLUDED.thirteen_week_average,
                pa_lottery_due = EXCLUDED.pa_lottery_due,
                fulton_bank_lottery_deposit = EXCLUDED.fulton_bank_lottery_deposit,
                fulton_bank_balance = EXCLUDED.fulton_bank_balance,
                retailer_number = EXCLUDED.retailer_number,
                location_name = EXCLUDED.location_name,
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
                daily_draw_sales = EXCLUDED.daily_draw_sales,
                daily_draw_net = EXCLUDED.daily_draw_net,
                daily_instant_sales = EXCLUDED.daily_instant_sales,
                daily_instant_adjustment = EXCLUDED.daily_instant_adjustment,
                daily_instant_pay = EXCLUDED.daily_instant_pay,
                daily_lottery_card_transaction = EXCLUDED.daily_lottery_card_transaction,
                entered_by = EXCLUDED.entered_by,
                notes = EXCLUDED.notes,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
                storeId, entryDate,
                calculatedTotalLotteryCash, calculatedDailyLotteryCash, calculatedLotteryCommission,
                thirteen_week_average, calculatedPaLotteryDue,
                fulton_bank_lottery_deposit, fulton_bank_balance,
                retailer_number || null, location_name || null, balance_forward,
                draw_sales, draw_cancels, draw_promos, draw_comm, draw_pays,
                vch_iss, vch_rd, webcash_iss, draw_adj, draw_due,
                scratch_offs_sales, scratch_offs_rtrns, scratch_offs_comm,
                scratch_offs_prms, scratch_offs_pays, scratch_offs_adj, scratch_offs_due,
                card_trans, gift_cards, prepaid, total_due,
                calculatedDailyDrawSales, calculatedDailyDrawNet, calculatedDailyInstantSales,
                calculatedDailyInstantAdjustment, calculatedDailyInstantPay, calculatedDailyLotteryCardTransaction,
                entered_by || null, notes || null
            ]
        );
        
        return result.rows[0];
    }
    
    // Get lottery entry for specific date
    static async findByDate(storeId, entryDate) {
        const result = await query(
            'SELECT * FROM daily_lottery WHERE store_id = $1 AND entry_date = $2',
            [storeId, entryDate]
        );
        return result.rows[0] || null;
    }
    
    // Get lottery entries for date range
    static async findByDateRange(storeId, startDate, endDate) {
        const result = await query(
            'SELECT * FROM daily_lottery WHERE store_id = $1 AND entry_date BETWEEN $2 AND $3 ORDER BY entry_date DESC',
            [storeId, startDate, endDate]
        );
        return result.rows;
    }
    
    // Get all lottery entries for a store
    static async findAll(storeId) {
        const result = await query(
            'SELECT * FROM daily_lottery WHERE store_id = $1 ORDER BY entry_date DESC',
            [storeId]
        );
        return result.rows;
    }
    
    // Delete lottery entry
    static async delete(id) {
        const result = await query('DELETE FROM daily_lottery WHERE id = $1 RETURNING *', [id]);
        return result.rows[0] || null;
    }
}

module.exports = DailyLottery;

