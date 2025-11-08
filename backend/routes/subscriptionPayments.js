const express = require('express');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const StoreSubscription = require('../models/StoreSubscription');
const { authenticate, authorize, canAccessStore } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Get payments for a store subscription
router.get('/subscription/:subscriptionId', async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        
        // Get store_id from subscription
        const { query } = require('../config/database');
        const sub = await query('SELECT store_id FROM store_subscriptions WHERE id = $1', [subscriptionId]);
        if (!sub.rows[0]) {
            return res.status(404).json({ error: 'Subscription not found' });
        }
        
        const AdminConfig = require('../models/AdminConfig');
        const hasAccess = await AdminConfig.canAccessStore(req.user.id, req.user.role, sub.rows[0].store_id);
        if (!hasAccess && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const payments = await SubscriptionPayment.findBySubscription(subscriptionId);
        res.json({ payments });
    } catch (error) {
        console.error('Get subscription payments error:', error);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

// Get payments for a store
router.get('/store/:storeId', canAccessStore, async (req, res) => {
    try {
        const { storeId } = req.params;
        const payments = await SubscriptionPayment.findByStore(storeId);
        res.json({ payments });
    } catch (error) {
        console.error('Get store payments error:', error);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

// Get payments for current admin (all their stores)
router.get('/admin/my-payments', async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const payments = await SubscriptionPayment.findByAdmin(req.user.id);
        res.json({ payments });
    } catch (error) {
        console.error('Get admin payments error:', error);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

// Create a payment record
router.post('/store/:storeId', canAccessStore, authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const { storeId } = req.params;
        const {
            payment_date,
            amount,
            billing_period_start,
            billing_period_end,
            payment_method,
            check_number,
            transaction_id,
            notes
        } = req.body;

        // Get subscription for this store
        const subscription = await StoreSubscription.findByStoreId(storeId);
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found for this store' });
        }

        const payment = await SubscriptionPayment.create({
            store_subscription_id: subscription.id,
            store_id: storeId,
            payment_date: payment_date || new Date().toISOString().split('T')[0],
            amount,
            billing_period_start,
            billing_period_end,
            payment_method,
            check_number,
            transaction_id,
            notes,
            created_by: req.user.id
        });

        res.json({ message: 'Payment recorded successfully', payment });
    } catch (error) {
        console.error('Create payment error:', error);
        res.status(500).json({ error: 'Failed to record payment', details: error.message });
    }
});

// Update a payment
router.put('/:paymentId', authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const { paymentId } = req.params;
        const payment = await SubscriptionPayment.findById(paymentId);
        
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        // Check access
        const AdminConfig = require('../models/AdminConfig');
        const hasAccess = await AdminConfig.canAccessStore(req.user.id, req.user.role, payment.store_id);
        if (!hasAccess && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const updated = await SubscriptionPayment.update(paymentId, req.body);
        res.json({ message: 'Payment updated successfully', payment: updated });
    } catch (error) {
        console.error('Update payment error:', error);
        res.status(500).json({ error: 'Failed to update payment', details: error.message });
    }
});

// Delete a payment
router.delete('/:paymentId', authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const { paymentId } = req.params;
        const payment = await SubscriptionPayment.findById(paymentId);
        
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        // Check access
        const AdminConfig = require('../models/AdminConfig');
        const hasAccess = await AdminConfig.canAccessStore(req.user.id, req.user.role, payment.store_id);
        if (!hasAccess && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        await SubscriptionPayment.delete(paymentId);
        res.json({ message: 'Payment deleted successfully' });
    } catch (error) {
        console.error('Delete payment error:', error);
        res.status(500).json({ error: 'Failed to delete payment', details: error.message });
    }
});

module.exports = router;

