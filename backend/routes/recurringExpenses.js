const express = require('express');
const RecurringExpensesService = require('../services/recurringExpensesService');
const { authenticate, canAccessStore } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Get all recurring expense templates for a store
router.get('/store/:storeId/templates', canAccessStore, async (req, res) => {
    try {
        const templates = await RecurringExpensesService.getRecurringTemplates(req.params.storeId);
        res.json({ templates });
    } catch (error) {
        console.error('Get recurring templates error:', error);
        res.status(500).json({ error: 'Failed to fetch recurring expense templates' });
    }
});

// Manually trigger processing of recurring expenses (for testing or manual runs)
router.post('/process', authenticate, async (req, res) => {
    try {
        // Only allow super_admin or admin to trigger manually
        if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { for_date } = req.body;
        const result = await RecurringExpensesService.processRecurringExpenses(for_date);
        
        res.json({
            message: 'Recurring expenses processed',
            ...result
        });
    } catch (error) {
        console.error('Process recurring expenses error:', error);
        res.status(500).json({ error: 'Failed to process recurring expenses' });
    }
});

module.exports = router;

