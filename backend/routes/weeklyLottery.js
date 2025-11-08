const express = require('express');
const WeeklyLottery = require('../models/WeeklyLottery');
const { authenticate, canAccessStore } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Create or update weekly lottery entry
router.post('/:storeId/weekly', canAccessStore, async (req, res) => {
    try {
        const { entry_date, ...lotteryData } = req.body;
        
        if (!entry_date) {
            return res.status(400).json({ error: 'Entry date is required' });
        }
        
        const lottery = await WeeklyLottery.upsert(
            req.params.storeId,
            entry_date,
            { ...lotteryData, entered_by: req.user.id }
        );
        
        res.status(201).json({
            message: 'Weekly lottery entry saved successfully',
            lottery
        });
    } catch (error) {
        console.error('Create weekly lottery error:', error);
        res.status(500).json({ error: 'Failed to save weekly lottery entry' });
    }
});

// Get weekly lottery entry for specific date
router.get('/:storeId/weekly/:date', canAccessStore, async (req, res) => {
    try {
        const lottery = await WeeklyLottery.findByDate(req.params.storeId, req.params.date);
        if (!lottery) {
            return res.status(404).json({ error: 'Weekly lottery entry not found' });
        }
        
        res.json({ lottery });
    } catch (error) {
        console.error('Get weekly lottery error:', error);
        res.status(500).json({ error: 'Failed to fetch weekly lottery entry' });
    }
});

// Get weekly lottery entries for date range
router.get('/:storeId/weekly/range', canAccessStore, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }
        
        const lotteries = await WeeklyLottery.findByDateRange(
            req.params.storeId,
            start_date,
            end_date
        );
        
        res.json({ lotteries });
    } catch (error) {
        console.error('Get weekly lottery range error:', error);
        res.status(500).json({ error: 'Failed to fetch weekly lottery entries' });
    }
});

module.exports = router;

