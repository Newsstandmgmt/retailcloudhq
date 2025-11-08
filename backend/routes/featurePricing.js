const express = require('express');
const FeaturePricing = require('../models/FeaturePricing');
const StoreFeature = require('../models/StoreTemplate');
const { authenticate, authorize } = require('../middleware/auth');
const { auditLogger } = require('../middleware/auditLogger');

const router = express.Router();

router.use(authenticate);

// Get all feature pricing (Super Admin only)
router.get('/', authorize('super_admin'), async (req, res) => {
    try {
        const pricing = await FeaturePricing.findAll();
        res.json({ pricing });
    } catch (error) {
        console.error('Get feature pricing error:', error);
        res.status(500).json({ error: 'Failed to fetch feature pricing' });
    }
});

// Get pricing for a specific feature
router.get('/:featureKey', authorize('super_admin'), async (req, res) => {
    try {
        const pricing = await FeaturePricing.findByFeatureKey(req.params.featureKey);
        if (!pricing) {
            return res.status(404).json({ error: 'Feature pricing not found' });
        }
        res.json({ pricing });
    } catch (error) {
        console.error('Get feature pricing error:', error);
        res.status(500).json({ error: 'Failed to fetch feature pricing' });
    }
});

// Create or update feature pricing (Super Admin only)
router.post('/:featureKey', authorize('super_admin'), auditLogger({
    actionType: 'upsert',
    entityType: 'feature_pricing',
    getEntityId: () => null,
    getDescription: (req) => `Updated pricing for feature: ${req.params.featureKey}`,
    logRequestBody: true
}), async (req, res) => {
    try {
        const { price_per_month, is_active } = req.body;
        
        if (price_per_month === undefined || price_per_month < 0) {
            return res.status(400).json({ error: 'Valid price_per_month is required' });
        }

        const pricing = await FeaturePricing.upsert(req.params.featureKey, {
            price_per_month,
            is_active
        });

        res.json({
            message: 'Feature pricing updated successfully',
            pricing
        });
    } catch (error) {
        console.error('Update feature pricing error:', error);
        res.status(500).json({ error: 'Failed to update feature pricing' });
    }
});

// Update feature pricing (Super Admin only)
router.put('/:featureKey', authorize('super_admin'), auditLogger({
    actionType: 'update',
    entityType: 'feature_pricing',
    getEntityId: () => null,
    getDescription: (req) => `Updated pricing for feature: ${req.params.featureKey}`,
    logRequestBody: true
}), async (req, res) => {
    try {
        const { price_per_month, is_active } = req.body;
        
        const pricing = await FeaturePricing.update(req.params.featureKey, {
            price_per_month,
            is_active
        });

        if (!pricing) {
            return res.status(404).json({ error: 'Feature pricing not found' });
        }

        res.json({
            message: 'Feature pricing updated successfully',
            pricing
        });
    } catch (error) {
        console.error('Update feature pricing error:', error);
        res.status(500).json({ error: 'Failed to update feature pricing' });
    }
});

module.exports = router;

