const express = require('express');
const DailyRevenue = require('../models/DailyRevenue');
const CashOnHandService = require('../services/cashOnHandService');
const CashOnHandCalculationService = require('../services/cashOnHandCalculationService');
const DailyOperatingExpenses = require('../models/DailyOperatingExpenses');
const { query } = require('../config/database');
const { authenticate, canAccessStore } = require('../middleware/auth');

const router = express.Router();

const CREDIT_CARD_FEE_EXPENSE_NAME = 'Credit Card Fees';
const CREDIT_CARD_FEE_NOTES = 'Auto-generated credit card processing fees';

async function ensureCreditCardFeeExpenseType(storeId, userId = null) {
    const existing = await query(
        `SELECT id FROM expense_types
         WHERE store_id = $1 AND LOWER(expense_type_name) = LOWER($2)
         LIMIT 1`,
        [storeId, CREDIT_CARD_FEE_EXPENSE_NAME]
    );

    if (existing.rows.length > 0) {
        return existing.rows[0].id;
    }

    const insert = await query(
        `INSERT INTO expense_types (store_id, expense_type_name, description, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [storeId, CREDIT_CARD_FEE_EXPENSE_NAME, 'Automatically created for daily revenue credit card fees.', userId]
    );

    return insert.rows[0].id;
}

async function syncCreditCardFeeExpense(storeId, entryDate, feeAmount, userId = null) {
    const amount = parseFloat(feeAmount || 0);
    const expenseTypeId = await ensureCreditCardFeeExpenseType(storeId, userId);

    const existing = await query(
        `SELECT id FROM daily_operating_expenses
         WHERE store_id = $1 AND entry_date = $2 AND expense_type_id = $3 AND notes ILIKE $4
         LIMIT 1`,
        [storeId, entryDate, expenseTypeId, `${CREDIT_CARD_FEE_NOTES}%`]
    );

    if (amount <= 0) {
        if (existing.rows.length > 0) {
            await DailyOperatingExpenses.delete(existing.rows[0].id);
        }
        return;
    }

    if (existing.rows.length > 0) {
        await DailyOperatingExpenses.update(existing.rows[0].id, {
            amount,
            payment_method: 'bank',
            is_autopay: true,
            notes: CREDIT_CARD_FEE_NOTES,
            entered_by: userId
        });
    } else {
        await DailyOperatingExpenses.create({
            store_id: storeId,
            entry_date: entryDate,
            expense_type_id: expenseTypeId,
            amount,
            payment_method: 'bank',
            is_autopay: true,
            notes: CREDIT_CARD_FEE_NOTES,
            entered_by: userId
        });
    }
}

// All routes require authentication
router.use(authenticate);

// Create or update daily revenue entry
router.post('/:storeId/daily', canAccessStore, async (req, res) => {
    try {
        const { entry_date, ...revenueData } = req.body;
        
        if (!entry_date) {
            return res.status(400).json({ error: 'Entry date is required' });
        }
        
        // Get store to check drawer type
        const Store = require('../models/Store');
        const store = await Store.findById(req.params.storeId);
        
        // If combined drawer, calculate business cash and lottery owed
        if (store && store.cash_drawer_type === 'same') {
            try {
                const CashDrawerCalculationConfig = require('../models/CashDrawerCalculationConfig');
                const DailyLottery = require('../models/DailyLottery');
                
                // Get lottery data for the same date
                let lotteryData = null;
                try {
                    lotteryData = await DailyLottery.findByDate(req.params.storeId, entry_date);
                } catch (lotteryError) {
                    console.error('Error fetching lottery data (non-blocking):', lotteryError);
                    lotteryData = {};
                }
                
                // Calculate business cash using the updated formula
                try {
                    const businessCash = await CashDrawerCalculationConfig.calculateBusinessCash(
                        req.params.storeId,
                        entry_date,
                        revenueData,
                        lotteryData || {}
                    );
                    revenueData.calculated_business_cash = businessCash;
                } catch (calcError) {
                    console.error('Error calculating business cash (non-blocking):', calcError);
                    // Continue without calculated business cash
                }
                
                // Calculate daily lottery cash owed to lottery
                try {
                    const lotteryOwed = await CashDrawerCalculationConfig.calculateLotteryOwed(
                        req.params.storeId,
                        entry_date,
                        revenueData
                    );
                    revenueData.calculated_lottery_owed = lotteryOwed;
                } catch (calcError) {
                    console.error('Error calculating lottery owed (non-blocking):', calcError);
                    // Continue without calculated lottery owed
                }
            } catch (configError) {
                console.error('Error in cash drawer calculation (non-blocking):', configError);
                // Continue without calculated values - they're optional
            }
        }
        
        // Get previous revenue entry to calculate cash difference
        const previousRevenue = await DailyRevenue.findByDate(req.params.storeId, entry_date);
        const previousCash = previousRevenue ? (parseFloat(previousRevenue.total_cash) || 0) : 0;
        const newCash = parseFloat(revenueData.total_cash) || 0;
        const cashDifference = newCash - previousCash;
        
        const revenue = await DailyRevenue.upsert(
            req.params.storeId,
            entry_date,
            { ...revenueData, entered_by: req.user.id }
        );
        
        // Update cash on hand if cash revenue changed
        if (cashDifference !== 0) {
            try {
                if (cashDifference > 0) {
                    await CashOnHandService.addCash(
                        req.params.storeId,
                        cashDifference,
                        'revenue',
                        revenue.id,
                        entry_date,
                        `Daily revenue entry - Cash sales: $${newCash.toFixed(2)}`,
                        req.user.id
                    );
                } else {
                    await CashOnHandService.subtractCash(
                        req.params.storeId,
                        Math.abs(cashDifference),
                        'revenue',
                        revenue.id,
                        entry_date,
                        `Daily revenue entry - Cash sales: $${newCash.toFixed(2)}`,
                        req.user.id
                    );
                }
            } catch (cashError) {
                console.error('Error updating cash on hand (non-blocking):', cashError);
            }
        }

        try {
            const newCreditCardFees = revenue && revenue.credit_card_transaction_fees !== undefined
                ? parseFloat(revenue.credit_card_transaction_fees || 0)
                : parseFloat(revenueData.credit_card_transaction_fees || 0) || 0;
            await syncCreditCardFeeExpense(req.params.storeId, entry_date, newCreditCardFees, req.user.id);
        } catch (feeError) {
            console.error('Error syncing credit card fee expense (non-blocking):', feeError);
        }

        // Link customer tab payments to this revenue entry (non-blocking)
        if (revenue && revenue.id && revenueData.customer_tab !== undefined) {
            try {
                const CustomerTab = require('../models/CustomerTab');
                const { query } = require('../config/database');
                const tabTotals = await CustomerTab.getDailyTotals(req.params.storeId, entry_date);
                
                // Update any payments that don't have a daily_revenue_id yet
                if (tabTotals && tabTotals.total_payments > 0) {
                    await query(
                        `UPDATE customer_tab_transactions 
                         SET daily_revenue_id = $1
                         WHERE store_id = $2 
                         AND transaction_date = $3 
                         AND transaction_type = 'payment'
                         AND daily_revenue_id IS NULL`,
                        [revenue.id, req.params.storeId, entry_date]
                    );
                }
            } catch (tabError) {
                console.error('Error linking customer tab payments (non-blocking):', tabError);
                // Don't fail the request if this fails
            }
        }
        
        // Auto-post to General Ledger (non-blocking)
        try {
            const AutoPostingService = require('../services/autoPostingService');
            await AutoPostingService.postRevenue(revenue, store);
        } catch (glError) {
            console.error('Error auto-posting revenue to GL (non-blocking):', glError);
            // Don't fail the request if GL posting fails
        }
        
        // Get cash on hand for the date
        let cashOnHand = null;
        try {
            cashOnHand = await CashOnHandCalculationService.getCashOnHandForDate(
                req.params.storeId,
                entry_date
            );
        } catch (cashError) {
            console.error('Error getting cash on hand (non-blocking):', cashError);
        }
        
        res.status(201).json({
            message: 'Revenue entry saved successfully',
            revenue,
            cashOnHand
        });
    } catch (error) {
        console.error('Create revenue error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to save revenue entry',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get revenue entry for specific date
router.get('/:storeId/daily/:date', canAccessStore, async (req, res) => {
    try {
        const revenue = await DailyRevenue.findByDate(req.params.storeId, req.params.date);
        
        // Calculate cash on hand balances
        let cashOnHand = null;
        try {
            cashOnHand = await CashOnHandCalculationService.getCashOnHandForDate(
                req.params.storeId,
                req.params.date
            );
        } catch (cashError) {
            console.error('Error calculating cash on hand (non-blocking):', cashError);
            // Don't fail the request if cash calculation fails
        }
        
        // Return empty object if no revenue found (for new entries)
        // Frontend can distinguish between no data vs error
        res.json({ 
            revenue: revenue || null,
            cashOnHand: cashOnHand || { businessCashOnHand: 0, lotteryCashOnHand: 0 }
        });
    } catch (error) {
        console.error('Get revenue error:', error);
        res.status(500).json({ error: 'Failed to fetch revenue entry' });
    }
});

// Get revenue entries for date range
router.get('/:storeId/range', canAccessStore, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }
        
        const revenues = await DailyRevenue.findByDateRange(
            req.params.storeId,
            start_date,
            end_date
        );
        
        res.json({ revenues });
    } catch (error) {
        console.error('Get revenue range error:', error);
        res.status(500).json({ error: 'Failed to fetch revenue entries' });
    }
});

// Calculate totals for date range
router.get('/:storeId/totals', canAccessStore, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }
        
        const totals = await DailyRevenue.calculateTotals(
            req.params.storeId,
            start_date,
            end_date
        );
        
        res.json({ totals });
    } catch (error) {
        console.error('Calculate totals error:', error);
        res.status(500).json({ error: 'Failed to calculate totals' });
    }
});

// Get recent revenue entries
router.get('/:storeId', canAccessStore, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const revenues = await DailyRevenue.findAllByStore(req.params.storeId, limit);
        
        res.json({ revenues });
    } catch (error) {
        console.error('Get revenues error:', error);
        res.status(500).json({ error: 'Failed to fetch revenue entries' });
    }
});

module.exports = router;

