const express = require('express');
const StoreSubscription = require('../models/StoreSubscription');
const { authenticate, authorize } = require('../middleware/auth');
const { PAID_ADDON_FEATURES } = require('../constants/addonFeatures');

const router = express.Router();

router.use(authenticate);

// Get all store subscriptions (Super Admin only)
router.get('/', authorize('super_admin'), async (req, res) => {
    try {
        const filters = {};
        if (req.query.status) {
            filters.status = req.query.status;
        }
        const subscriptions = await StoreSubscription.findAll(filters);
        res.json({ subscriptions });
    } catch (error) {
        console.error('Get store subscriptions error:', error);
        res.status(500).json({ error: 'Failed to fetch store subscriptions' });
    }
});

// Get subscription for a specific store
router.get('/store/:storeId', async (req, res) => {
    try {
        const { storeId } = req.params;
        
        // Check if user has access to this store
        const AdminConfig = require('../models/AdminConfig');
        const hasAccess = await AdminConfig.canAccessStore(req.user.id, req.user.role, storeId);
        if (!hasAccess && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Access denied to this store' });
        }

        // First try to find subscription without features (faster check)
        let subscription = await StoreSubscription.findByStoreId(storeId);
        if (!subscription) {
            // No subscription exists, return null
            return res.json({ subscription: null });
        }
        
        // If subscription exists, get full details with features
        // Use the subscription we already have, and try to add features
        try {
            const subscriptionWithFeatures = await StoreSubscription.findWithFeatures(storeId);
            res.json({ subscription: subscriptionWithFeatures || subscription || null });
        } catch (featuresError) {
            console.error('Error fetching subscription features for store:', storeId, featuresError);
            console.error('Error stack:', featuresError.stack);
            // If feature fetching fails, return subscription without features
            // Add empty features array so frontend doesn't break
            subscription.features = subscription.features || [];
            subscription.template_feature_keys = subscription.template_feature_keys || [];
            subscription.addon_feature_keys = subscription.addon_feature_keys || [];
            res.json({ subscription: subscription || null });
        }
    } catch (error) {
        console.error('Get store subscription error:', error);
        console.error('Error stack:', error.stack);
        // Return null instead of 500 for stores without subscriptions
        if (error.message && (error.message.includes('not found') || error.message.includes('does not exist'))) {
            return res.json({ subscription: null });
        }
        // For other errors, try to return null if it's a query error
        if (error.code === '42P01' || error.code === '42703') {
            // Table or column doesn't exist - this shouldn't happen but handle gracefully
            console.error('Database schema error:', error);
            return res.json({ subscription: null });
        }
        res.status(500).json({ error: 'Failed to fetch store subscription', details: error.message });
    }
});

// Create or update store subscription (Super Admin only)
router.post('/store/:storeId', authorize('super_admin'), async (req, res) => {
    try {
        const { storeId } = req.params;
        console.log('Creating/updating subscription for store:', storeId, 'with data:', req.body);
        const subscription = await StoreSubscription.upsert(storeId, req.body);
        console.log('Subscription created/updated successfully:', subscription.id);
        res.json({
            message: 'Store subscription created/updated successfully',
            subscription
        });
    } catch (error) {
        console.error('Create store subscription error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to create store subscription', details: error.message });
    }
});

// Recalculate store subscription (when template changes)
router.post('/store/:storeId/recalculate', authorize('super_admin'), async (req, res) => {
    try {
        const { storeId } = req.params;
        const subscription = await StoreSubscription.recalculate(storeId);
        if (!subscription) {
            return res.status(404).json({ error: 'Store subscription not found' });
        }
        res.json({
            message: 'Store subscription recalculated successfully',
            subscription
        });
    } catch (error) {
        console.error('Recalculate store subscription error:', error);
        res.status(500).json({ error: 'Failed to recalculate store subscription' });
    }
});

// Add feature addon to store
router.post('/store/:storeId/addons/:featureKey', async (req, res) => {
    try {
        const { storeId, featureKey } = req.params;
        
        // Check if user has access to this store
        const AdminConfig = require('../models/AdminConfig');
        const hasAccess = await AdminConfig.canAccessStore(req.user.id, req.user.role, storeId);
        if (!hasAccess && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Access denied to this store' });
        }

        // Check if feature is already in template
        const Store = require('../models/Store');
        const store = await Store.findById(storeId);
        if (store.template_id) {
            const StoreTemplate = require('../models/StoreTemplate');
            const templateFeatures = await StoreTemplate.getFeatureKeys(store.template_id);
            if (templateFeatures.includes(featureKey)) {
                return res.status(400).json({ error: 'This feature is already included in your plan' });
            }
        }

        // Check if already added as addon
        const existingAddons = await StoreSubscription.getAddonFeatures(storeId);
        if (existingAddons.includes(featureKey)) {
            return res.status(400).json({ error: 'This feature is already added' });
        }

        // Add the addon
        await StoreSubscription.addFeatureAddon(storeId, featureKey, req.user.id);
        
        // Recalculate subscription
        await StoreSubscription.recalculate(storeId);

        res.json({
            message: 'Feature addon added successfully',
            feature_key: featureKey
        });
    } catch (error) {
        console.error('Add feature addon error:', error);
        res.status(500).json({ error: 'Failed to add feature addon' });
    }
});

// Remove feature addon from store
router.delete('/store/:storeId/addons/:featureKey', async (req, res) => {
    try {
        const { storeId, featureKey } = req.params;
        
        // Check if user has access to this store
        const AdminConfig = require('../models/AdminConfig');
        const hasAccess = await AdminConfig.canAccessStore(req.user.id, req.user.role, storeId);
        if (!hasAccess && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Access denied to this store' });
        }

        await StoreSubscription.removeFeatureAddon(storeId, featureKey);
        
        // Recalculate subscription
        await StoreSubscription.recalculate(storeId);

        res.json({
            message: 'Feature addon removed successfully',
            feature_key: featureKey
        });
    } catch (error) {
        console.error('Remove feature addon error:', error);
        res.status(500).json({ error: 'Failed to remove feature addon' });
    }
});

// Get available addon features for a store (features not in template)
router.get('/store/:storeId/available-addons', async (req, res) => {
    try {
        const { storeId } = req.params;
        
        // Check if user has access to this store
        const AdminConfig = require('../models/AdminConfig');
        const hasAccess = await AdminConfig.canAccessStore(req.user.id, req.user.role, storeId);
        if (!hasAccess && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Access denied to this store' });
        }

        // Get store template features
        const Store = require('../models/Store');
        const store = await Store.findById(storeId);
        const StoreTemplate = require('../models/StoreTemplate');
        const templateFeatureKeys = store.template_id 
            ? await StoreTemplate.getFeatureKeys(store.template_id)
            : [];

        // Get existing addons
        const existingAddons = await StoreSubscription.getAddonFeatures(storeId);

        // Get all features with pricing
        const FeaturePricing = require('../models/FeaturePricing');
        const allFeatures = await FeaturePricing.findAll();

        // Filter to only features not in template and not already added
        const availableAddons = allFeatures.filter(f => 
            PAID_ADDON_FEATURES.includes(f.feature_key) &&
            !templateFeatureKeys.includes(f.feature_key) && 
            !existingAddons.includes(f.feature_key)
        );

        res.json({
            available_addons: availableAddons
        });
    } catch (error) {
        console.error('Get available addons error:', error);
        res.status(500).json({ error: 'Failed to fetch available addons' });
    }
});

// Update discount for store subscription
router.patch('/store/:storeId/discount', authorize('super_admin'), async (req, res) => {
    try {
        const { storeId } = req.params;
        const subscription = await StoreSubscription.updateDiscount(storeId, req.body);
        if (!subscription) {
            return res.status(404).json({ error: 'Store subscription not found' });
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

// Update status for store subscription
router.patch('/store/:storeId/status', authorize('super_admin'), async (req, res) => {
    try {
        const { storeId } = req.params;
        const { status } = req.body;
        
        if (!['active', 'suspended', 'cancelled'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const subscription = await StoreSubscription.updateStatus(storeId, status);
        if (!subscription) {
            return res.status(404).json({ error: 'Store subscription not found' });
        }
        res.json({
            message: 'Status updated successfully',
            subscription
        });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

module.exports = router;

