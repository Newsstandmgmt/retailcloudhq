const express = require('express');
const MonthlyUtilities = require('../models/MonthlyUtilities');
const { authenticate, canAccessStore } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Create or update monthly utilities entry
router.post('/:storeId/monthly', canAccessStore, async (req, res) => {
    try {
        const { entry_month, ...utilitiesData } = req.body;
        
        if (!entry_month) {
            return res.status(400).json({ error: 'Entry month is required (YYYY-MM-DD format)' });
        }
        
        const utilities = await MonthlyUtilities.upsert(
            req.params.storeId,
            entry_month,
            { ...utilitiesData, entered_by: req.user.id }
        );
        
        res.status(201).json({
            message: 'Utilities entry saved successfully',
            utilities
        });
    } catch (error) {
        console.error('Create utilities error:', error);
        res.status(500).json({ error: 'Failed to save utilities entry' });
    }
});

// Get utilities entry for specific month
router.get('/:storeId/monthly/:month', canAccessStore, async (req, res) => {
    try {
        const utilities = await MonthlyUtilities.findByMonth(req.params.storeId, req.params.month);
        if (!utilities) {
            return res.status(404).json({ error: 'Utilities entry not found' });
        }
        
        res.json({ utilities });
    } catch (error) {
        console.error('Get utilities error:', error);
        res.status(500).json({ error: 'Failed to fetch utilities entry' });
    }
});

// Get utilities entries for date range
router.get('/:storeId/range', canAccessStore, async (req, res) => {
    try {
        const { start_month, end_month } = req.query;
        
        if (!start_month || !end_month) {
            return res.status(400).json({ error: 'Start month and end month are required' });
        }
        
        const utilities = await MonthlyUtilities.findByDateRange(
            req.params.storeId,
            start_month,
            end_month
        );
        
        res.json({ utilities });
    } catch (error) {
        console.error('Get utilities range error:', error);
        res.status(500).json({ error: 'Failed to fetch utilities entries' });
    }
});

module.exports = router;

