const express = require('express');
const CashOnHandService = require('../services/cashOnHandService');
const { authenticate, canAccessStore, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Get cash on hand balance for a store
router.get('/store/:storeId', canAccessStore, async (req, res) => {
    try {
        const balance = await CashOnHandService.getBalance(req.params.storeId);
        res.json({ balance });
    } catch (error) {
        console.error('Get cash on hand error:', error);
        res.status(500).json({ error: 'Failed to fetch cash on hand balance' });
    }
});

// Get cash transaction history
router.get('/store/:storeId/history', canAccessStore, async (req, res) => {
    try {
        const { start_date, end_date, limit = 100 } = req.query;
        const history = await CashOnHandService.getTransactionHistory(
            req.params.storeId,
            start_date || null,
            end_date || null,
            parseInt(limit)
        );
        res.json({ history });
    } catch (error) {
        console.error('Get cash history error:', error);
        res.status(500).json({ error: 'Failed to fetch cash transaction history' });
    }
});

// Manual reconciliation endpoint for admins
router.post('/store/:storeId/reconcile', canAccessStore, authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const storeId = req.params.storeId;
        const { new_balance, adjustment_amount, reason } = req.body || {};

        if (!reason || !reason.toString().trim()) {
            return res.status(400).json({ error: 'Reason is required for reconciliation.' });
        }

        const balanceRecord = await CashOnHandService.getBalance(storeId);
        const currentBalance = parseFloat(balanceRecord?.current_balance || 0);

        let delta = null;

        if (new_balance !== undefined && new_balance !== null && new_balance !== '') {
            const target = parseFloat(new_balance);
            if (Number.isNaN(target)) {
                return res.status(400).json({ error: 'Invalid target balance provided.' });
            }
            delta = target - currentBalance;
        } else if (adjustment_amount !== undefined && adjustment_amount !== null && adjustment_amount !== '') {
            const adjustment = parseFloat(adjustment_amount);
            if (Number.isNaN(adjustment) || adjustment === 0) {
                return res.status(400).json({ error: 'Invalid adjustment amount provided.' });
            }
            delta = adjustment;
        } else {
            return res.status(400).json({ error: 'Provide either a new_balance or adjustment_amount.' });
        }

        if (!delta || Math.abs(delta) < 0.0001) {
            return res.status(400).json({ error: 'No reconciliation needed; balance difference is zero.' });
        }

        const transactionDate = new Date().toISOString().split('T')[0];
        const cleanedReason = reason.toString().trim();
        const description = `Manual cash reconciliation: ${cleanedReason} (Δ ${delta >= 0 ? '+' : '-'}$${Math.abs(delta).toFixed(2)})`;

        let adjustmentResult;
        if (delta > 0) {
            adjustmentResult = await CashOnHandService.addCash(
                storeId,
                delta,
                'manual_reconciliation',
                null,
                transactionDate,
                description,
                req.user.id
            );
        } else {
            adjustmentResult = await CashOnHandService.subtractCash(
                storeId,
                Math.abs(delta),
                'manual_reconciliation',
                null,
                transactionDate,
                description,
                req.user.id
            );
        }

        const updatedBalance = await CashOnHandService.getBalance(storeId);

        res.json({
            success: true,
            adjustment: {
                difference: delta,
                reason: cleanedReason,
                balance_before: adjustmentResult.balanceBefore,
                balance_after: adjustmentResult.balanceAfter,
                description
            },
            current_balance: parseFloat(updatedBalance?.current_balance || 0)
        });
    } catch (error) {
        console.error('Cash reconciliation error:', error);
        res.status(500).json({ error: 'Failed to reconcile cash on hand.' });
    }
});

module.exports = router;

