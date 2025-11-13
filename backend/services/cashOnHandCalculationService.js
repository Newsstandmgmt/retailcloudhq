/**
 * Cash On Hand Calculation Service
 * 
 * Calculates Business and Lottery Cash On Hand for a given date
 * based on previous balances, revenue, expenses, bank deposits, and owner distributions
 */
const CashOnHandService = require('./cashOnHandService');
const { query } = require('../config/database');

class CashOnHandCalculationService {
    /**
     * Get cash on hand balances for a specific date
     * @param {string} storeId - Store ID
     * @param {string} entryDate - Date to calculate balances for
     * @returns {Promise<Object>} { businessCashOnHand, lotteryCashOnHand }
     */
    static async getCashOnHandForDate(storeId, entryDate) {
        // Get store to check drawer type
        const Store = require('../models/Store');
        const store = await Store.findById(storeId);
        
        if (!store) {
            throw new Error('Store not found');
        }

        // Get the most recent cash on hand balance before this date
        const previousBalance = await this.getPreviousBalance(storeId, entryDate);
        
        // Calculate changes from previous date to this date
        const changes = await this.calculateChangesForDate(storeId, entryDate, store.cash_drawer_type);
 
         // Calculate final balances by adding changes to previous balance
        const businessCashOnHand = previousBalance.businessCashOnHand + changes.businessChange;
        const lotteryCashOnHand = previousBalance.lotteryCashOnHand + changes.lotteryChange;
        
        return {
            businessCashOnHand: Math.max(0, businessCashOnHand), // Don't go negative
            lotteryCashOnHand: Math.max(0, lotteryCashOnHand),
            previousBalance,
            changes
        };
    }

    /**
     * Get the most recent cash on hand balance before the given date
     */
    static async getPreviousBalance(storeId, entryDate) {
        // Get the most recent revenue entry before this date
        const previousRevenue = await query(
            `SELECT * FROM daily_revenue 
             WHERE store_id = $1 AND entry_date < $2 
             ORDER BY entry_date DESC LIMIT 1`,
            [storeId, entryDate]
        );

        // Get the most recent cash on hand record
        const cashOnHand = await CashOnHandService.getBalance(storeId);
        
        // If we have a previous revenue entry, calculate balances at that point
        if (previousRevenue.rows.length > 0) {
            const prev = previousRevenue.rows[0];
            const Store = require('../models/Store');
            const store = await Store.findById(storeId);
            
            // For combined drawer, we need to calculate from daily revenue
            if (store && store.cash_drawer_type === 'same') {
                // Get previous day's calculated business cash - this is the running balance
                let businessCash = parseFloat(prev.total_cash || prev.calculated_business_cash || 0);
                const ledgerFallback = parseFloat(cashOnHand.current_balance || 0);
                if ((!businessCash || Math.abs(businessCash) < 0.0001) && ledgerFallback) {
                    businessCash = ledgerFallback;
                }
                const lotteryOwed = parseFloat(prev.calculated_lottery_owed || 0);
                
                // For combined drawer: business cash is tracked separately
                // Lottery cash on hand = total lottery cash minus what's owed
                // We need to calculate from previous entries to get running lottery cash
                const prevLotteryCash = await this.calculatePreviousLotteryCash(storeId, prev.entry_date);
                
                return {
                    businessCashOnHand: businessCash,
                    lotteryCashOnHand: prevLotteryCash,
                    lastCalculatedDate: prev.entry_date
                };
            } else {
                // Separate drawers: use the cash_on_hand table values
                return {
                    businessCashOnHand: parseFloat(cashOnHand.business_cash_on_hand || cashOnHand.current_balance || 0),
                    lotteryCashOnHand: parseFloat(cashOnHand.lottery_cash_on_hand || 0),
                    lastCalculatedDate: cashOnHand.last_updated
                };
            }
        }
        
        // No previous data, use current cash on hand or default to 0
        return {
            businessCashOnHand: parseFloat(cashOnHand.business_cash_on_hand || cashOnHand.current_balance || 0),
            lotteryCashOnHand: parseFloat(cashOnHand.lottery_cash_on_hand || 0),
            lastCalculatedDate: null
        };
    }

    /**
     * Calculate previous lottery cash on hand for combined drawer stores
     */
    static async calculatePreviousLotteryCash(storeId, date) {
        // Get all revenue entries up to this date
        const revenues = await query(
            `SELECT * FROM daily_revenue 
             WHERE store_id = $1 AND entry_date <= $2 
             ORDER BY entry_date ASC`,
            [storeId, date]
        );
        
        let lotteryCash = 0;
        revenues.rows.forEach(rev => {
            const onlineNet = parseFloat(rev.online_net || 0);
            const totalInstant = parseFloat(rev.total_instant || 0);
            const instantPay = parseFloat(rev.instant_pay || 0);
            const instantAdjustment = parseFloat(rev.total_instant_adjustment || 0);
            const lotteryCreditCard = parseFloat(rev.lottery_credit_card || 0);
            
            // Lottery cash = online net + instant sales - instant pay + instant adjustment - lottery credit card
            const dailyLotteryCash = onlineNet + totalInstant - instantPay + instantAdjustment - lotteryCreditCard;
            lotteryCash += dailyLotteryCash;
            
            // Subtract bank deposits
            if (rev.is_lottery_bank_deposit && rev.bank_deposit_amount) {
                lotteryCash -= parseFloat(rev.bank_deposit_amount);
            }
        });
        
        return Math.max(0, lotteryCash);
    }

    /**
     * Calculate changes (revenue, expenses, deposits, distributions) for a specific date
     */
    static async calculateChangesForDate(storeId, entryDate, drawerType) {
        const changes = {
            businessChange: 0,
            lotteryChange: 0
        };

        // Get revenue entry for this date
        const revenue = await query(
            `SELECT * FROM daily_revenue WHERE store_id = $1 AND entry_date = $2`,
            [storeId, entryDate]
        );

        if (revenue.rows.length > 0) {
            const rev = revenue.rows[0];
            
            if (drawerType === 'same') {
                // Combined drawer: calculate change from previous day
                const prevRevenue = await query(
                    `SELECT * FROM daily_revenue 
                     WHERE store_id = $1 AND entry_date < $2 
                     ORDER BY entry_date DESC LIMIT 1`,
                    [storeId, entryDate]
                );
                
                if (prevRevenue.rows.length > 0) {
                    const prev = prevRevenue.rows[0];
                    const prevBusinessCash = parseFloat(prev.total_cash || prev.calculated_business_cash || 0);
                    const businessCash = parseFloat(rev.total_cash || rev.calculated_business_cash || 0);
                    
                    // Business cash change = difference in calculated business cash
                    changes.businessChange = businessCash - prevBusinessCash;
                    
                    // Lottery cash change = daily lottery revenue - deposits
                    const onlineNet = parseFloat(rev.online_net || 0);
                    const totalInstant = parseFloat(rev.total_instant || 0);
                    const instantPay = parseFloat(rev.instant_pay || 0);
                    const instantAdjustment = parseFloat(rev.total_instant_adjustment || 0);
                    const lotteryCreditCard = parseFloat(rev.lottery_credit_card || 0);
                    
                    // Lottery cash = online net + instant sales - instant pay + instant adjustment - lottery credit card
                    changes.lotteryChange = onlineNet + totalInstant - instantPay + instantAdjustment - lotteryCreditCard;
                } else {
                    // First entry: use current values
                    const businessCash = parseFloat(rev.total_cash || rev.calculated_business_cash || 0);
                    changes.businessChange = businessCash;
                    
                    const onlineNet = parseFloat(rev.online_net || 0);
                    const totalInstant = parseFloat(rev.total_instant || 0);
                    const instantPay = parseFloat(rev.instant_pay || 0);
                    const instantAdjustment = parseFloat(rev.total_instant_adjustment || 0);
                    const lotteryCreditCard = parseFloat(rev.lottery_credit_card || 0);
                    changes.lotteryChange = onlineNet + totalInstant - instantPay + instantAdjustment - lotteryCreditCard;
                }
            } else {
                // Separate drawers: calculate based on revenue components
                const totalCash = parseFloat(rev.total_cash || 0);
                const onlineNet = parseFloat(rev.online_net || 0);
                const totalInstant = parseFloat(rev.total_instant || 0);
                const instantPay = parseFloat(rev.instant_pay || 0);
                
                // Business cash = total cash (business sales)
                changes.businessChange = totalCash;
                
                // Lottery cash = online net + instant sales - instant pay
                changes.lotteryChange = onlineNet + totalInstant - instantPay;
            }
        }

        // Subtract bank deposits
        const bankDeposits = await query(
            `SELECT bank_deposit_amount, is_lottery_bank_deposit 
             FROM daily_revenue 
             WHERE store_id = $1 AND entry_date = $2 AND bank_deposit_amount > 0`,
            [storeId, entryDate]
        );

        if (bankDeposits.rows.length > 0) {
            const deposit = bankDeposits.rows[0];
            const depositAmount = parseFloat(deposit.bank_deposit_amount || 0);
            
            if (deposit.is_lottery_bank_deposit) {
                changes.lotteryChange -= depositAmount;
            } else {
                changes.businessChange -= depositAmount;
            }
        }

        // Subtract owner distributions
        const distributions = await query(
            `SELECT business_amount, lottery_amount 
             FROM owner_distributions 
             WHERE store_id = $1 AND distribution_date = $2`,
            [storeId, entryDate]
        );

        if (distributions.rows.length > 0) {
            distributions.rows.forEach(dist => {
                changes.businessChange -= parseFloat(dist.business_amount || 0);
                changes.lotteryChange -= parseFloat(dist.lottery_amount || 0);
            });
        }

        return changes;
    }
}

module.exports = CashOnHandCalculationService;

