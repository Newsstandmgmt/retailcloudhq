const express = require('express');
const DailyCashFlow = require('../models/DailyCashFlow');
const { authenticate, canAccessStore } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Create or update daily cash flow entry
router.post('/:storeId/daily', canAccessStore, async (req, res) => {
    try {
        const { entry_date, ...cashFlowData } = req.body;
        
        if (!entry_date) {
            return res.status(400).json({ error: 'Entry date is required' });
        }
        
        const cashFlow = await DailyCashFlow.upsert(
            req.params.storeId,
            entry_date,
            { ...cashFlowData, entered_by: req.user.id }
        );
        
        res.status(201).json({
            message: 'Cash flow entry saved successfully',
            cashFlow
        });
    } catch (error) {
        console.error('Create cash flow error:', error);
        res.status(500).json({ error: 'Failed to save cash flow entry' });
    }
});

// Get cash flow entry for specific date
router.get('/:storeId/daily/:date', canAccessStore, async (req, res) => {
    try {
        const cashFlow = await DailyCashFlow.findByDate(req.params.storeId, req.params.date);
        if (!cashFlow) {
            return res.status(404).json({ error: 'Cash flow entry not found' });
        }
        
        res.json({ cashFlow });
    } catch (error) {
        console.error('Get cash flow error:', error);
        res.status(500).json({ error: 'Failed to fetch cash flow entry' });
    }
});

// Get cash flow entries for date range
router.get('/:storeId/range', canAccessStore, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }
        
        const cashFlows = await DailyCashFlow.findByDateRange(
            req.params.storeId,
            start_date,
            end_date
        );
        
        res.json({ cashFlows });
    } catch (error) {
        console.error('Get cash flow range error:', error);
        res.status(500).json({ error: 'Failed to fetch cash flow entries' });
    }
});

module.exports = router;

