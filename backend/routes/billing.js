const express = require('express');
const Billing = require('../models/Billing');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(authorize('super_admin')); // Only super admin can access billing

// Get all invoices
router.get('/', async (req, res) => {
    try {
        const { status, admin_id } = req.query;
        const invoices = await Billing.findAll({ status, admin_id });
        res.json({ invoices });
    } catch (error) {
        console.error('Get invoices error:', error);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});

// Get invoice by ID
router.get('/:invoiceId', async (req, res) => {
    try {
        const invoice = await Billing.findById(req.params.invoiceId);
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        res.json({ invoice });
    } catch (error) {
        console.error('Get invoice error:', error);
        res.status(500).json({ error: 'Failed to fetch invoice' });
    }
});

// Create invoice
router.post('/', async (req, res) => {
    try {
        const { admin_id, amount, billing_period_start, billing_period_end, due_date } = req.body;
        
        if (!admin_id || !amount || !billing_period_start || !billing_period_end || !due_date) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const invoice = await Billing.createInvoice({
            admin_id,
            amount,
            billing_period_start,
            billing_period_end,
            due_date
        });

        res.status(201).json({
            message: 'Invoice created successfully',
            invoice
        });
    } catch (error) {
        console.error('Create invoice error:', error);
        res.status(500).json({ error: 'Failed to create invoice' });
    }
});

// Update invoice status
router.patch('/:invoiceId/status', async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!['pending', 'paid', 'overdue', 'cancelled'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const paidAt = status === 'paid' ? new Date() : null;
        const invoice = await Billing.updateStatus(req.params.invoiceId, status, paidAt);

        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        res.json({
            message: 'Invoice status updated successfully',
            invoice
        });
    } catch (error) {
        console.error('Update invoice status error:', error);
        res.status(500).json({ error: 'Failed to update invoice status' });
    }
});

// Get billing statistics
router.get('/statistics/summary', async (req, res) => {
    try {
        const stats = await Billing.getStatistics();
        res.json({ statistics: stats });
    } catch (error) {
        console.error('Get billing statistics error:', error);
        res.status(500).json({ error: 'Failed to fetch billing statistics' });
    }
});

module.exports = router;

