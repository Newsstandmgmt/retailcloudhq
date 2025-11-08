const express = require('express');
const CashOnHandService = require('../services/cashOnHandService');
const { authenticate, canAccessStore } = require('../middleware/auth');

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

module.exports = router;

