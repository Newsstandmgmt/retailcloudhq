const express = require('express');
const { canAccessStore } = require('../middleware/auth');
const LotteryRawReport = require('../models/LotteryRawReport');

const router = express.Router();

router.get('/store/:storeId', canAccessStore, async (req, res) => {
    try {
        const { start_date: startDate, end_date: endDate, limit } = req.query;
        const records = await LotteryRawReport.listByStore(req.params.storeId, {
            startDate,
            endDate,
            limit: limit ? parseInt(limit, 10) : 50,
        });
        res.json({ reports: records });
    } catch (error) {
        console.error('Error fetching lottery daily reports:', error);
        res.status(500).json({ error: 'Failed to fetch lottery daily reports' });
    }
});

module.exports = router;


