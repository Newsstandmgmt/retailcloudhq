const express = require('express');
const DailyLottery = require('../models/DailyLottery');
const { authenticate, canAccessStore } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Create or update daily lottery entry
router.post('/:storeId/daily', canAccessStore, async (req, res) => {
    try {
        const { entry_date, ...lotteryData } = req.body;
        
        if (!entry_date) {
            return res.status(400).json({ error: 'Entry date is required' });
        }
        
        const lottery = await DailyLottery.upsert(
            req.params.storeId,
            entry_date,
            { ...lotteryData, entered_by: req.user.id }
        );
        
        res.status(201).json({
            message: 'Lottery entry saved successfully',
            lottery
        });
    } catch (error) {
        console.error('Create lottery error:', error);
        res.status(500).json({ error: 'Failed to save lottery entry' });
    }
});

// Get lottery entry for specific date
router.get('/:storeId/daily/:date', canAccessStore, async (req, res) => {
    try {
        const lottery = await DailyLottery.findByDate(req.params.storeId, req.params.date);
        if (!lottery) {
            return res.status(404).json({ error: 'Lottery entry not found' });
        }
        
        res.json({ lottery });
    } catch (error) {
        console.error('Get lottery error:', error);
        res.status(500).json({ error: 'Failed to fetch lottery entry' });
    }
});

// Get lottery entries for date range
router.get('/:storeId/range', canAccessStore, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }
        
        const lotteries = await DailyLottery.findByDateRange(
            req.params.storeId,
            start_date,
            end_date
        );
        
        res.json({ lotteries });
    } catch (error) {
        console.error('Get lottery range error:', error);
        res.status(500).json({ error: 'Failed to fetch lottery entries' });
    }
});

module.exports = router;

