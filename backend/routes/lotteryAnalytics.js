const express = require('express');
const router = express.Router();
const LotterySalesPaidoutReport = require('../models/LotterySalesPaidoutReport');
const LotteryDailyReport = require('../models/LotteryDailyReport');
const DailyLottery = require('../models/DailyLottery');
const { authorize, canAccessStore } = require('../middleware/auth');

// Sales / PaidOut Report Routes
router.get('/sales-paidout/:storeId', canAccessStore, authorize('super_admin', 'admin', 'manager'), async (req, res) => {
    try {
        const { storeId } = req.params;
        const { start_date, end_date, employee_id } = req.query;
        
        const reports = await LotterySalesPaidoutReport.findByStore(storeId, {
            startDate: start_date || null,
            endDate: end_date || null,
            employeeId: employee_id || null
        });
        
        // Get totals
        const totals = await LotterySalesPaidoutReport.getTotals(
            storeId,
            start_date || '1900-01-01',
            end_date || new Date().toISOString().split('T')[0],
            employee_id || null
        );
        
        res.json({
            success: true,
            reports,
            totals
        });
    } catch (error) {
        console.error('Error fetching sales/paidout report:', error);
        res.status(500).json({ error: 'Failed to fetch sales/paidout report' });
    }
});

router.post('/sales-paidout/:storeId', canAccessStore, authorize('super_admin', 'admin', 'manager'), async (req, res) => {
    try {
        const { storeId } = req.params;
        const { report_date, ...reportData } = req.body;
        
        if (!report_date) {
            return res.status(400).json({ error: 'report_date is required' });
        }
        
        const report = await LotterySalesPaidoutReport.upsert(
            storeId,
            report_date,
            { ...reportData, created_by: req.user.id },
            req.body.employee_id || null
        );
        
        res.json({
            success: true,
            report
        });
    } catch (error) {
        console.error('Error saving sales/paidout report:', error);
        res.status(500).json({ error: 'Failed to save sales/paidout report' });
    }
});

// Daily Report Routes
router.get('/daily/:storeId', canAccessStore, authorize('super_admin', 'admin', 'manager'), async (req, res) => {
    try {
        const { storeId } = req.params;
        const { start_date, end_date, employee_id } = req.query;
        
        const reports = await LotteryDailyReport.findByStore(storeId, {
            startDate: start_date || null,
            endDate: end_date || null,
            employeeId: employee_id || null
        });
        
        // Get totals
        const totals = await LotteryDailyReport.getTotals(
            storeId,
            start_date || '1900-01-01',
            end_date || new Date().toISOString().split('T')[0],
            employee_id || null
        );
        
        res.json({
            success: true,
            reports,
            totals
        });
    } catch (error) {
        console.error('Error fetching daily report:', error);
        res.status(500).json({ error: 'Failed to fetch daily report' });
    }
});

router.post('/daily/:storeId', canAccessStore, authorize('super_admin', 'admin', 'manager'), async (req, res) => {
    try {
        const { storeId } = req.params;
        const { report_date, ...reportData } = req.body;
        
        if (!report_date) {
            return res.status(400).json({ error: 'report_date is required' });
        }
        
        const report = await LotteryDailyReport.upsert(
            storeId,
            report_date,
            { ...reportData, created_by: req.user.id },
            req.body.employee_id || null
        );
        
        res.json({
            success: true,
            report
        });
    } catch (error) {
        console.error('Error saving daily report:', error);
        res.status(500).json({ error: 'Failed to save daily report' });
    }
});

// Auto-populate from daily_lottery data
router.post('/auto-populate/:storeId', canAccessStore, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const { storeId } = req.params;
        const { start_date, end_date } = req.body;
        
        // Get daily lottery data for the date range
        const dailyLotteryData = await DailyLottery.findByDateRange(storeId, start_date, end_date);
        
        let salesPaidoutCreated = 0;
        let dailyReportCreated = 0;
        
        for (const daily of dailyLotteryData) {
            // Populate Sales/PaidOut Report
            await LotterySalesPaidoutReport.upsert(storeId, daily.entry_date, {
                sales_online: daily.draw_sales || 0,
                sales_instant: daily.scratch_offs_sales || 0,
                total_sales: (daily.draw_sales || 0) + (daily.scratch_offs_sales || 0),
                paidouts_online: daily.draw_pays || 0,
                paidouts_instant: daily.scratch_offs_pays || 0,
                total_paidout: (daily.draw_pays || 0) + (daily.scratch_offs_pays || 0),
                commission: (daily.draw_comm || 0) + (daily.scratch_offs_comm || 0),
                source: daily.entered_by ? 'manual' : 'google_sheets',
                notes: `Auto-populated from daily lottery data`
            });
            salesPaidoutCreated++;
            
            // Populate Daily Report
            await LotteryDailyReport.upsert(storeId, daily.entry_date, {
                debit_credit_card: daily.card_trans || 0,
                online_balance: daily.draw_due || 0,
                instant_balance: daily.scratch_offs_due || 0,
                total_balance: (daily.draw_due || 0) + (daily.scratch_offs_due || 0),
                source: daily.entered_by ? 'manual' : 'google_sheets',
                notes: `Auto-populated from daily lottery data`
            });
            dailyReportCreated++;
        }
        
        res.json({
            success: true,
            message: `Auto-populated ${salesPaidoutCreated} sales/paidout reports and ${dailyReportCreated} daily reports`,
            sales_paidout_created: salesPaidoutCreated,
            daily_report_created: dailyReportCreated
        });
    } catch (error) {
        console.error('Error auto-populating reports:', error);
        res.status(500).json({ error: 'Failed to auto-populate reports' });
    }
});

module.exports = router;

