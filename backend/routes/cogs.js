const express = require('express');
const DailyCOGS = require('../models/DailyCOGS');
const { authenticate, canAccessStore } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Create or update daily COGS entry
router.post('/:storeId/daily', canAccessStore, async (req, res) => {
    try {
        const { entry_date, ...cogsData } = req.body;
        
        if (!entry_date) {
            return res.status(400).json({ error: 'Entry date is required' });
        }
        
        const cogs = await DailyCOGS.upsert(
            req.params.storeId,
            entry_date,
            { ...cogsData, entered_by: req.user.id }
        );
        
        res.status(201).json({
            message: 'COGS entry saved successfully',
            cogs
        });
    } catch (error) {
        console.error('Create COGS error:', error);
        res.status(500).json({ error: 'Failed to save COGS entry' });
    }
});

// Get COGS entry for specific date
router.get('/:storeId/daily/:date', canAccessStore, async (req, res) => {
    try {
        const cogs = await DailyCOGS.findByDate(req.params.storeId, req.params.date);
        if (!cogs) {
            return res.status(404).json({ error: 'COGS entry not found' });
        }
        
        res.json({ cogs });
    } catch (error) {
        console.error('Get COGS error:', error);
        res.status(500).json({ error: 'Failed to fetch COGS entry' });
    }
});

// Get COGS entries for date range
router.get('/:storeId/range', canAccessStore, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }
        
        const cogsEntries = await DailyCOGS.findByDateRange(
            req.params.storeId,
            start_date,
            end_date
        );
        
        res.json({ cogsEntries });
    } catch (error) {
        console.error('Get COGS range error:', error);
        res.status(500).json({ error: 'Failed to fetch COGS entries' });
    }
});

module.exports = router;

