const express = require('express');
const CashDrawerCalculationConfig = require('../models/CashDrawerCalculationConfig');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Get configuration for a store (or default)
router.get('/store/:storeId', authorize('super_admin', 'admin', 'manager'), async (req, res) => {
    try {
        const config = await CashDrawerCalculationConfig.getForStore(req.params.storeId);
        res.json({ config });
    } catch (error) {
        console.error('Get cash drawer config error:', error);
        res.status(500).json({ error: 'Failed to fetch configuration' });
    }
});

// Get default configuration
router.get('/default', authorize('super_admin'), async (req, res) => {
    try {
        const config = await CashDrawerCalculationConfig.getDefault();
        res.json({ config });
    } catch (error) {
        console.error('Get default config error:', error);
        res.status(500).json({ error: 'Failed to fetch default configuration' });
    }
});

// Update configuration (super admin only)
router.post('/store/:storeId', authorize('super_admin'), async (req, res) => {
    try {
        const config = await CashDrawerCalculationConfig.upsert(req.params.storeId, {
            ...req.body,
            config_type: 'store'
        });
        res.json({ config });
    } catch (error) {
        console.error('Update cash drawer config error:', error);
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

// Update default configuration (super admin only)
router.post('/default', authorize('super_admin'), async (req, res) => {
    try {
        const config = await CashDrawerCalculationConfig.upsert(null, {
            ...req.body,
            config_type: 'default'
        });
        res.json({ config });
    } catch (error) {
        console.error('Update default config error:', error);
        res.status(500).json({ error: 'Failed to update default configuration' });
    }
});

// Calculate business cash (for testing/validation)
router.post('/calculate/:storeId', authorize('super_admin', 'admin', 'manager'), async (req, res) => {
    try {
        const { entry_date, revenue_data, lottery_data } = req.body;
        
        const businessCash = await CashDrawerCalculationConfig.calculateBusinessCash(
            req.params.storeId,
            entry_date,
            revenue_data || {},
            lottery_data || {}
        );
        
        res.json({ business_cash: businessCash });
    } catch (error) {
        console.error('Calculate business cash error:', error);
        res.status(500).json({ error: 'Failed to calculate business cash' });
    }
});

module.exports = router;

