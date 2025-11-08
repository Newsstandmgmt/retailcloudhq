const express = require('express');
const CustomerTab = require('../models/CustomerTab');
const { authenticate, canAccessStore, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Get all customer tabs for a store
router.get('/store/:storeId', canAccessStore, async (req, res) => {
    try {
        const tabs = await CustomerTab.findByStore(req.params.storeId);
        res.json({ tabs });
    } catch (error) {
        console.error('Get customer tabs error:', error);
        res.status(500).json({ error: 'Failed to fetch customer tabs' });
    }
});

// Get unpaid tabs
router.get('/store/:storeId/unpaid', canAccessStore, async (req, res) => {
    try {
        const tabs = await CustomerTab.getUnpaidTabs(req.params.storeId);
        res.json({ tabs });
    } catch (error) {
        console.error('Get unpaid tabs error:', error);
        res.status(500).json({ error: 'Failed to fetch unpaid tabs' });
    }
});

// Get daily tab totals (for revenue calculation)
router.get('/store/:storeId/daily/:date', canAccessStore, async (req, res) => {
    try {
        const totals = await CustomerTab.getDailyTotals(req.params.storeId, req.params.date);
        res.json({ totals });
    } catch (error) {
        console.error('Get daily tab totals error:', error);
        res.status(500).json({ error: 'Failed to fetch daily tab totals' });
    }
});

// Create or get customer tab
router.post('/store/:storeId/find-or-create', canAccessStore, async (req, res) => {
    try {
        const { customer_name, customer_id } = req.body;
        
        if (!customer_name) {
            return res.status(400).json({ error: 'Customer name is required' });
        }
        
        const tab = await CustomerTab.findOrCreate(req.params.storeId, customer_name, customer_id);
        res.json({ tab });
    } catch (error) {
        console.error('Create customer tab error:', error);
        res.status(500).json({ error: 'Failed to create customer tab' });
    }
});

// Add charge (new tab purchase)
router.post('/:tabId/charge', authenticate, async (req, res) => {
    try {
        // First get the tab to check store access
        const tab = await CustomerTab.findById(req.params.tabId);
        if (!tab) {
            return res.status(404).json({ error: 'Customer tab not found' });
        }
        
        // Check store access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, tab.store_id]
        );
        
        if (accessResult.rows[0]?.can_access !== true) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }
        
        const { transaction_date, amount, description } = req.body;
        
        if (!transaction_date || !amount) {
            return res.status(400).json({ error: 'Transaction date and amount are required' });
        }
        
        const transaction = await CustomerTab.addCharge(
            req.params.tabId,
            transaction_date,
            parseFloat(amount),
            description,
            req.user.id
        );
        
        // Update daily cash for charge date - ADD to cash (revenue occurred without cash received)
        try {
            const CashOnHandService = require('../services/cashOnHandService');
            const DailyRevenue = require('../models/DailyRevenue');
            
            // Add to cash adjustment for that day
            const revenue = await DailyRevenue.findByDate(tab.store_id, transaction_date);
            if (revenue) {
                const currentAdjustment = parseFloat(revenue.cash_adjustment || 0);
                await DailyRevenue.upsert(
                    tab.store_id,
                    transaction_date,
                    { cash_adjustment: currentAdjustment + parseFloat(amount) }
                );
            } else {
                // Create new revenue entry with adjustment
                await DailyRevenue.upsert(
                    tab.store_id,
                    transaction_date,
                    { cash_adjustment: parseFloat(amount), total_cash: 0 }
                );
            }
            
            // Update cash on hand
            await CashOnHandService.updateBalance(
                tab.store_id,
                parseFloat(amount),
                'customer_tab_charge',
                transaction.id,
                transaction_date,
                `Customer tab charge: ${description || 'Tab purchase'}`,
                req.user.id
            );
        } catch (cashError) {
            console.error('Error updating cash for charge (non-blocking):', cashError);
            // Continue even if cash update fails
        }
        
        res.json({ transaction });
    } catch (error) {
        console.error('Add charge error:', error);
        res.status(500).json({ error: 'Failed to add charge' });
    }
});

// Add payment
router.post('/:tabId/payment', authenticate, async (req, res) => {
    try {
        // First get the tab to check store access
        const tab = await CustomerTab.findById(req.params.tabId);
        if (!tab) {
            return res.status(404).json({ error: 'Customer tab not found' });
        }
        
        // Check store access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, tab.store_id]
        );
        
        if (accessResult.rows[0]?.can_access !== true) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }
        
        const { transaction_date, amount, payment_method, daily_revenue_id } = req.body;
        
        if (!transaction_date || !amount || !payment_method) {
            return res.status(400).json({ error: 'Transaction date, amount, and payment method are required' });
        }
        
        if (!['cash', 'card', 'check'].includes(payment_method)) {
            return res.status(400).json({ error: 'Payment method must be cash, card, or check' });
        }
        
        const transaction = await CustomerTab.addPayment(
            req.params.tabId,
            transaction_date,
            parseFloat(amount),
            payment_method,
            req.user.id,
            daily_revenue_id
        );
        
        // Update daily cash for payment date - SUBTRACT if cash payment
        // (because cash payment is already counted in total_cash, but we need to account for the adjustment)
        if (payment_method === 'cash') {
            try {
                const CashOnHandService = require('../services/cashOnHandService');
                const DailyRevenue = require('../models/DailyRevenue');
                
                // Subtract from cash adjustment for that day (reversing the charge adjustment)
                const revenue = await DailyRevenue.findByDate(tab.store_id, transaction_date);
                if (revenue) {
                    const currentAdjustment = parseFloat(revenue.cash_adjustment || 0);
                    await DailyRevenue.upsert(
                        tab.store_id,
                        transaction_date,
                        { cash_adjustment: currentAdjustment - parseFloat(amount) }
                    );
                } else {
                    // Create new revenue entry with negative adjustment
                    await DailyRevenue.upsert(
                        tab.store_id,
                        transaction_date,
                        { cash_adjustment: -parseFloat(amount), total_cash: 0 }
                    );
                }
                
                // Update cash on hand - subtract because we're reversing the charge adjustment
                // The actual cash received is already counted in total_cash
                await CashOnHandService.updateBalance(
                    tab.store_id,
                    -parseFloat(amount),
                    'customer_tab_payment',
                    transaction.id,
                    transaction_date,
                    `Customer tab payment (cash): Reversing charge adjustment`,
                    req.user.id
                );
            } catch (cashError) {
                console.error('Error updating cash for payment (non-blocking):', cashError);
                // Continue even if cash update fails
            }
        }
        
        res.json({ transaction });
    } catch (error) {
        console.error('Add payment error:', error);
        res.status(500).json({ error: 'Failed to add payment' });
    }
});

// Get transactions for a tab
router.get('/:tabId/transactions', authenticate, async (req, res) => {
    try {
        // First get the tab to check store access
        const tab = await CustomerTab.findById(req.params.tabId);
        if (!tab) {
            return res.status(404).json({ error: 'Customer tab not found' });
        }
        
        // Check store access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, tab.store_id]
        );
        
        if (accessResult.rows[0]?.can_access !== true) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }
        
        const { start_date, end_date } = req.query;
        const transactions = await CustomerTab.getTransactions(
            req.params.tabId,
            start_date || null,
            end_date || null
        );
        res.json({ transactions });
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// Void a charge transaction
router.post('/transaction/:transactionId/void', authenticate, async (req, res) => {
    try {
        // First get the transaction to check store access
        const { query } = require('../config/database');
        const transactionResult = await query(
            `SELECT ct.*, ctt.transaction_type, ctt.amount, ctt.is_voided
             FROM customer_tab_transactions ctt
             JOIN customer_tabs ct ON ctt.customer_tab_id = ct.id
             WHERE ctt.id = $1`,
            [req.params.transactionId]
        );
        
        if (transactionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        
        const transaction = transactionResult.rows[0];
        
        // Check store access
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, transaction.store_id]
        );
        
        if (accessResult.rows[0]?.can_access !== true) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }
        
        const voidedTransaction = await CustomerTab.voidCharge(req.params.transactionId);
        
        // Recalculate balance to ensure accuracy
        await CustomerTab.recalculateBalance(transaction.customer_tab_id);
        
        res.json({ transaction: voidedTransaction });
    } catch (error) {
        console.error('Void charge error:', error);
        res.status(500).json({ error: error.message || 'Failed to void charge' });
    }
});

// Recalculate balance for a tab
router.post('/:tabId/recalculate-balance', authenticate, async (req, res) => {
    try {
        // First get the tab to check store access
        const tab = await CustomerTab.findById(req.params.tabId);
        if (!tab) {
            return res.status(404).json({ error: 'Customer tab not found' });
        }
        
        // Check store access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, tab.store_id]
        );
        
        if (accessResult.rows[0]?.can_access !== true) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }
        
        const newBalance = await CustomerTab.recalculateBalance(req.params.tabId);
        
        // Get updated tab
        const updatedTab = await CustomerTab.findById(req.params.tabId);
        
        res.json({ tab: updatedTab, balance: newBalance });
    } catch (error) {
        console.error('Recalculate balance error:', error);
        res.status(500).json({ error: error.message || 'Failed to recalculate balance' });
    }
});

module.exports = router;

