const express = require('express');
const DailyLottery = require('../models/DailyLottery');
const WeeklyLottery = require('../models/WeeklyLottery');
const Lottery13WeekAverage = require('../models/Lottery13WeekAverage');
const LotteryWeeklySettlement = require('../models/LotteryWeeklySettlement');
const { authenticate, authorize, canAccessStore } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// DAILY SALES
// ============================================

// Get daily sales for a store
router.get('/stores/:storeId/daily', canAccessStore, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let sales;
        if (startDate && endDate) {
            sales = await DailyLottery.findByDateRange(req.params.storeId, startDate, endDate);
        } else {
            sales = await DailyLottery.findAll(req.params.storeId);
        }
        
        res.json({ sales });
    } catch (error) {
        console.error('Get daily sales error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to fetch daily sales', 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get single daily sale entry
router.get('/stores/:storeId/daily/:date', canAccessStore, async (req, res) => {
    try {
        const sale = await DailyLottery.findByDate(req.params.storeId, req.params.date);
        if (!sale) {
            return res.status(404).json({ error: 'Daily sale not found' });
        }
        res.json({ sale });
    } catch (error) {
        console.error('Get daily sale error:', error);
        res.status(500).json({ error: 'Failed to fetch daily sale' });
    }
});

// Create or update daily sale
router.post('/stores/:storeId/daily', canAccessStore, authorize('super_admin', 'admin', 'manager'), async (req, res) => {
    try {
        const { entry_date, ...lotteryData } = req.body;
        lotteryData.entered_by = req.user.id;
        
        const sale = await DailyLottery.upsert(req.params.storeId, entry_date, lotteryData);
        res.json({ message: 'Daily sale saved successfully', sale });
    } catch (error) {
        console.error('Save daily sale error:', error);
        res.status(500).json({ error: 'Failed to save daily sale', details: error.message });
    }
});

// Delete daily sale
router.delete('/stores/:storeId/daily/:date', canAccessStore, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const sale = await DailyLottery.findByDate(req.params.storeId, req.params.date);
        if (!sale) {
            return res.status(404).json({ error: 'Daily sale not found' });
        }
        await DailyLottery.delete(sale.id);
        res.json({ message: 'Daily sale deleted successfully' });
    } catch (error) {
        console.error('Delete daily sale error:', error);
        res.status(500).json({ error: 'Failed to delete daily sale' });
    }
});

// ============================================
// WEEKLY SALES
// ============================================

// Get weekly sales for a store
router.get('/stores/:storeId/weekly', canAccessStore, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let sales;
        if (startDate && endDate) {
            sales = await WeeklyLottery.findByDateRange(req.params.storeId, startDate, endDate);
        } else {
            sales = await WeeklyLottery.findAll(req.params.storeId);
        }
        
        res.json({ sales });
    } catch (error) {
        console.error('Get weekly sales error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to fetch weekly sales', 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get single weekly sale entry
router.get('/stores/:storeId/weekly/:date', canAccessStore, async (req, res) => {
    try {
        const sale = await WeeklyLottery.findByDate(req.params.storeId, req.params.date);
        if (!sale) {
            return res.status(404).json({ error: 'Weekly sale not found' });
        }
        res.json({ sale });
    } catch (error) {
        console.error('Get weekly sale error:', error);
        res.status(500).json({ error: 'Failed to fetch weekly sale' });
    }
});

// Create or update weekly sale
router.post('/stores/:storeId/weekly', canAccessStore, authorize('super_admin', 'admin', 'manager'), async (req, res) => {
    try {
        const { entry_date, ...lotteryData } = req.body;
        lotteryData.entered_by = req.user.id;
        
        const sale = await WeeklyLottery.upsert(req.params.storeId, entry_date, lotteryData);
        res.json({ message: 'Weekly sale saved successfully', sale });
    } catch (error) {
        console.error('Save weekly sale error:', error);
        res.status(500).json({ error: 'Failed to save weekly sale', details: error.message });
    }
});

// Delete weekly sale
router.delete('/stores/:storeId/weekly/:date', canAccessStore, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const sale = await WeeklyLottery.findByDate(req.params.storeId, req.params.date);
        if (!sale) {
            return res.status(404).json({ error: 'Weekly sale not found' });
        }
        await WeeklyLottery.delete(sale.id);
        res.json({ message: 'Weekly sale deleted successfully' });
    } catch (error) {
        console.error('Delete weekly sale error:', error);
        res.status(500).json({ error: 'Failed to delete weekly sale' });
    }
});

// ============================================
// 13 WEEK AVERAGE
// ============================================

// Get 13-week average reports for a store
router.get('/stores/:storeId/13week', canAccessStore, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let reports;
        if (startDate && endDate) {
            reports = await Lottery13WeekAverage.findByDateRange(req.params.storeId, startDate, endDate);
        } else {
            reports = await Lottery13WeekAverage.findAll(req.params.storeId);
        }
        
        res.json({ reports });
    } catch (error) {
        console.error('Get 13-week average error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to fetch 13-week average reports', 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get single 13-week average report
router.get('/stores/:storeId/13week/:date', canAccessStore, async (req, res) => {
    try {
        const report = await Lottery13WeekAverage.findByDate(req.params.storeId, req.params.date);
        if (!report) {
            return res.status(404).json({ error: '13-week average report not found' });
        }
        res.json({ report });
    } catch (error) {
        console.error('Get 13-week average error:', error);
        res.status(500).json({ error: 'Failed to fetch 13-week average report' });
    }
});

// Create or update 13-week average report
router.post('/stores/:storeId/13week', canAccessStore, authorize('super_admin', 'admin', 'manager'), async (req, res) => {
    try {
        const { report_date, ...reportData } = req.body;
        reportData.entered_by = req.user.id;
        
        const report = await Lottery13WeekAverage.create(req.params.storeId, report_date, reportData);
        res.json({ message: '13-week average report saved successfully', report });
    } catch (error) {
        console.error('Save 13-week average error:', error);
        res.status(500).json({ error: 'Failed to save 13-week average report', details: error.message });
    }
});

// Delete 13-week average report
router.delete('/stores/:storeId/13week/:date', canAccessStore, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const report = await Lottery13WeekAverage.findByDate(req.params.storeId, req.params.date);
        if (!report) {
            return res.status(404).json({ error: '13-week average report not found' });
        }
        await Lottery13WeekAverage.delete(report.id);
        res.json({ message: '13-week average report deleted successfully' });
    } catch (error) {
        console.error('Delete 13-week average error:', error);
        res.status(500).json({ error: 'Failed to delete 13-week average report' });
    }
});

// ============================================
// WEEKLY SETTLEMENT
// ============================================

// Get weekly settlement reports for a store
router.get('/stores/:storeId/settlement', canAccessStore, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let reports;
        if (startDate && endDate) {
            reports = await LotteryWeeklySettlement.findByDateRange(req.params.storeId, startDate, endDate);
        } else {
            reports = await LotteryWeeklySettlement.findAll(req.params.storeId);
        }
        
        res.json({ reports });
    } catch (error) {
        console.error('Get weekly settlement error:', error);
        res.status(500).json({ error: 'Failed to fetch weekly settlement reports' });
    }
});

// Get single weekly settlement report
router.get('/stores/:storeId/settlement/:date', canAccessStore, async (req, res) => {
    try {
        const report = await LotteryWeeklySettlement.findByDate(req.params.storeId, req.params.date);
        if (!report) {
            return res.status(404).json({ error: 'Weekly settlement report not found' });
        }
        res.json({ report });
    } catch (error) {
        console.error('Get weekly settlement error:', error);
        res.status(500).json({ error: 'Failed to fetch weekly settlement report' });
    }
});

// Create or update weekly settlement report
router.post('/stores/:storeId/settlement', canAccessStore, authorize('super_admin', 'admin', 'manager'), async (req, res) => {
    try {
        const { settlement_date, ...settlementData } = req.body;
        settlementData.entered_by = req.user.id;
        
        const report = await LotteryWeeklySettlement.create(req.params.storeId, settlement_date, settlementData);
        res.json({ message: 'Weekly settlement report saved successfully', report });
    } catch (error) {
        console.error('Save weekly settlement error:', error);
        res.status(500).json({ error: 'Failed to save weekly settlement report', details: error.message });
    }
});

// Mark settlement as reconciled
router.post('/stores/:storeId/settlement/:date/reconcile', canAccessStore, authorize('super_admin', 'admin', 'manager'), async (req, res) => {
    try {
        const { reconciliation_notes } = req.body;
        const report = await LotteryWeeklySettlement.findByDate(req.params.storeId, req.params.date);
        if (!report) {
            return res.status(404).json({ error: 'Weekly settlement report not found' });
        }
        
        const updated = await LotteryWeeklySettlement.markReconciled(report.id, req.user.id, reconciliation_notes);
        res.json({ message: 'Settlement marked as reconciled', report: updated });
    } catch (error) {
        console.error('Reconcile settlement error:', error);
        res.status(500).json({ error: 'Failed to reconcile settlement' });
    }
});

// Delete weekly settlement report
router.delete('/stores/:storeId/settlement/:date', canAccessStore, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const report = await LotteryWeeklySettlement.findByDate(req.params.storeId, req.params.date);
        if (!report) {
            return res.status(404).json({ error: 'Weekly settlement report not found' });
        }
        await LotteryWeeklySettlement.delete(report.id);
        res.json({ message: 'Weekly settlement report deleted successfully' });
    } catch (error) {
        console.error('Delete weekly settlement error:', error);
        res.status(500).json({ error: 'Failed to delete weekly settlement report' });
    }
});

module.exports = router;

