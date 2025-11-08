const express = require('express');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const AdminSubscription = require('../models/AdminSubscription');
const Billing = require('../models/Billing');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(authorize('super_admin')); // Only super admin can manage subscriptions

// ========== Subscription Plans Routes ==========

// Get all plans
router.get('/plans', async (req, res) => {
    try {
        const activeOnly = req.query.active_only === 'true';
        const plans = await SubscriptionPlan.findAll(activeOnly);
        
        // Get features for each plan
        const plansWithFeatures = await Promise.all(
            plans.map(async (plan) => {
                const features = await SubscriptionPlan.getFeatures(plan.id);
                const featureKeys = await SubscriptionPlan.getFeatureKeys(plan.id);
                return {
                    ...plan,
                    features,
                    feature_keys: featureKeys
                };
            })
        );
        
        res.json({ plans: plansWithFeatures });
    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({ error: 'Failed to fetch subscription plans' });
    }
});

// Get plan by ID
router.get('/plans/:planId', async (req, res) => {
    try {
        const plan = await SubscriptionPlan.findById(req.params.planId);
        if (!plan) {
            return res.status(404).json({ error: 'Plan not found' });
        }
        res.json({ plan });
    } catch (error) {
        console.error('Get plan error:', error);
        res.status(500).json({ error: 'Failed to fetch plan' });
    }
});

// Create plan
router.post('/plans', async (req, res) => {
    try {
        const { name, description, price_per_month, billing_cycle, feature_keys } = req.body;
        
        if (!name || !price_per_month) {
            return res.status(400).json({ error: 'Name and price are required' });
        }

        const plan = await SubscriptionPlan.create({
            name,
            description,
            price_per_month,
            billing_cycle: billing_cycle || 'monthly'
        });

        // Add features to plan if provided
        if (feature_keys && Array.isArray(feature_keys) && feature_keys.length > 0) {
            for (const featureKey of feature_keys) {
                await SubscriptionPlan.addFeature(plan.id, featureKey);
            }
        }

        // Get plan with features
        const planWithFeatures = await SubscriptionPlan.findWithFeatures(plan.id);

        res.status(201).json({
            message: 'Subscription plan created successfully',
            plan: planWithFeatures
        });
    } catch (error) {
        console.error('Create plan error:', error);
        res.status(500).json({ error: 'Failed to create plan' });
    }
});

// Get plan by ID with features
router.get('/plans/:planId', async (req, res) => {
    try {
        const plan = await SubscriptionPlan.findWithFeatures(req.params.planId);
        if (!plan) {
            return res.status(404).json({ error: 'Plan not found' });
        }
        res.json({ plan });
    } catch (error) {
        console.error('Get plan error:', error);
        res.status(500).json({ error: 'Failed to fetch plan' });
    }
});

// Update plan
router.put('/plans/:planId', async (req, res) => {
    try {
        const { feature_keys, ...updateData } = req.body;
        
        const plan = await SubscriptionPlan.update(req.params.planId, updateData);
        if (!plan) {
            return res.status(404).json({ error: 'Plan not found' });
        }

        // Update features if provided
        if (feature_keys !== undefined && Array.isArray(feature_keys)) {
            // Remove all existing features
            await SubscriptionPlan.removeAllFeatures(req.params.planId);
            
            // Add new features
            for (const featureKey of feature_keys) {
                await SubscriptionPlan.addFeature(req.params.planId, featureKey);
            }
        }

        // Get plan with features
        const planWithFeatures = await SubscriptionPlan.findWithFeatures(req.params.planId);

        res.json({
            message: 'Plan updated successfully',
            plan: planWithFeatures
        });
    } catch (error) {
        console.error('Update plan error:', error);
        res.status(500).json({ error: 'Failed to update plan' });
    }
});

// Delete plan (soft delete)
router.delete('/plans/:planId', async (req, res) => {
    try {
        const plan = await SubscriptionPlan.delete(req.params.planId);
        if (!plan) {
            return res.status(404).json({ error: 'Plan not found' });
        }
        res.json({ message: 'Plan deleted successfully' });
    } catch (error) {
        console.error('Delete plan error:', error);
        res.status(500).json({ error: 'Failed to delete plan' });
    }
});

// ========== Admin Subscriptions Routes ==========

// Get all subscriptions
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        const subscriptions = await AdminSubscription.findAll({ status });
        res.json({ subscriptions });
    } catch (error) {
        console.error('Get subscriptions error:', error);
        res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
});

// Get subscription by admin ID
router.get('/admin/:adminId', async (req, res) => {
    try {
        const subscription = await AdminSubscription.findByAdminId(req.params.adminId);
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }
        res.json({ subscription });
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
});

// Create or update subscription
router.post('/admin/:adminId', async (req, res) => {
    try {
        const { plan_id, start_date, discount_percentage, discount_amount, discount_applied_to_next_billing, auto_renew } = req.body;
        
        if (!plan_id || !start_date) {
            return res.status(400).json({ error: 'Plan ID and start date are required' });
        }

        const subscription = await AdminSubscription.upsert(req.params.adminId, {
            plan_id,
            start_date,
            discount_percentage: discount_percentage || 0,
            discount_amount: discount_amount || 0,
            discount_applied_to_next_billing: discount_applied_to_next_billing || false,
            auto_renew: auto_renew !== false
        });

        res.status(201).json({
            message: 'Subscription assigned successfully',
            subscription
        });
    } catch (error) {
        console.error('Create subscription error:', error);
        res.status(500).json({ error: error.message || 'Failed to create subscription' });
    }
});

// Update discount for next billing
router.patch('/admin/:adminId/discount', async (req, res) => {
    try {
        const { discount_percentage, discount_amount, discount_applied_to_next_billing } = req.body;

        const subscription = await AdminSubscription.updateDiscount(req.params.adminId, {
            discount_percentage: discount_percentage || 0,
            discount_amount: discount_amount || 0,
            discount_applied_to_next_billing: discount_applied_to_next_billing !== false
        });

        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        res.json({
            message: 'Discount updated successfully',
            subscription
        });
    } catch (error) {
        console.error('Update discount error:', error);
        res.status(500).json({ error: 'Failed to update discount' });
    }
});

// Update subscription status
router.patch('/admin/:adminId/status', async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!['active', 'suspended', 'cancelled', 'expired'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const subscription = await AdminSubscription.updateStatus(req.params.adminId, status);

        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        res.json({
            message: 'Subscription status updated successfully',
            subscription
        });
    } catch (error) {
        console.error('Update subscription status error:', error);
        res.status(500).json({ error: 'Failed to update subscription status' });
    }
});

// Generate invoice for subscription (auto-generate based on billing cycle)
router.post('/admin/:adminId/generate-invoice', async (req, res) => {
    try {
        const subscription = await AdminSubscription.findByAdminId(req.params.adminId);
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        // Get plan details
        const plan = await SubscriptionPlan.findById(subscription.plan_id);
        if (!plan) {
            return res.status(404).json({ error: 'Subscription plan not found' });
        }

        // Calculate invoice amount with discount
        const amount = AdminSubscription.calculateInvoiceAmount(subscription, plan);

        // Calculate billing period dates
        const billingPeriodStart = subscription.next_billing_date;
        const billingPeriodEnd = AdminSubscription.calculateNextBillingDate(
            billingPeriodStart, 
            subscription.billing_cycle
        );
        const dueDate = new Date(billingPeriodEnd);
        dueDate.setDate(dueDate.getDate() + 7); // 7 days after billing period ends

        // Create invoice
        const invoice = await Billing.createInvoice({
            admin_id: req.params.adminId,
            amount: amount,
            billing_period_start: billingPeriodStart,
            billing_period_end: billingPeriodEnd,
            due_date: dueDate.toISOString().split('T')[0]
        });

        // Update next billing date
        await AdminSubscription.updateNextBillingDate(req.params.adminId);

        res.status(201).json({
            message: 'Invoice generated successfully',
            invoice
        });
    } catch (error) {
        console.error('Generate invoice error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate invoice' });
    }
});

module.exports = router;

