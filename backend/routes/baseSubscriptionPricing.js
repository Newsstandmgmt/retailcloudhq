const express = require('express');
const BaseSubscriptionPricing = require('../models/BaseSubscriptionPricing');
const { authenticate, authorize } = require('../middleware/auth');
const { auditLogger } = require('../middleware/auditLogger');

const router = express.Router();

router.use(authenticate);

// Get all base pricing (Super Admin only)
router.get('/', authorize('super_admin'), async (req, res) => {
    try {
        const pricing = await BaseSubscriptionPricing.findAll();
        res.json({ pricing });
    } catch (error) {
        console.error('Get base pricing error:', error);
        res.status(500).json({ error: 'Failed to fetch base pricing' });
    }
});

// Get default base pricing
router.get('/default', async (req, res) => {
    try {
        const pricing = await BaseSubscriptionPricing.getDefault();
        res.json({ pricing });
    } catch (error) {
        console.error('Get default base pricing error:', error);
        res.status(500).json({ error: 'Failed to fetch default base pricing' });
    }
});

// Get base pricing by ID
router.get('/:id', authorize('super_admin'), async (req, res) => {
    try {
        const pricing = await BaseSubscriptionPricing.findById(req.params.id);
        if (!pricing) {
            return res.status(404).json({ error: 'Base pricing not found' });
        }
        res.json({ pricing });
    } catch (error) {
        console.error('Get base pricing error:', error);
        res.status(500).json({ error: 'Failed to fetch base pricing' });
    }
});

// Create base pricing (Super Admin only)
router.post('/', authorize('super_admin'), auditLogger({
    actionType: 'create',
    entityType: 'base_subscription_pricing',
    getEntityId: () => null,
    getDescription: (req) => `Created base subscription pricing: ${req.body?.name || 'N/A'}`,
    logRequestBody: true
}), async (req, res) => {
    try {
        const { name, description, base_price_per_month, is_active } = req.body;
        
        if (!name || base_price_per_month === undefined || base_price_per_month < 0) {
            return res.status(400).json({ error: 'Name and valid base_price_per_month are required' });
        }

        const pricing = await BaseSubscriptionPricing.create({
            name,
            description,
            base_price_per_month,
            is_active
        });

        res.status(201).json({
            message: 'Base subscription pricing created successfully',
            pricing
        });
    } catch (error) {
        console.error('Create base pricing error:', error);
        res.status(500).json({ error: 'Failed to create base pricing' });
    }
});

// Update base pricing (Super Admin only)
router.put('/:id', authorize('super_admin'), auditLogger({
    actionType: 'update',
    entityType: 'base_subscription_pricing',
    getEntityId: (req) => req.params.id,
    getDescription: (req) => `Updated base subscription pricing: ${req.params.id}`,
    logRequestBody: true
}), async (req, res) => {
    try {
        const { name, description, base_price_per_month, is_active } = req.body;
        
        const pricing = await BaseSubscriptionPricing.update(req.params.id, {
            name,
            description,
            base_price_per_month,
            is_active
        });

        if (!pricing) {
            return res.status(404).json({ error: 'Base pricing not found' });
        }

        res.json({
            message: 'Base subscription pricing updated successfully',
            pricing
        });
    } catch (error) {
        console.error('Update base pricing error:', error);
        res.status(500).json({ error: 'Failed to update base pricing' });
    }
});

// Delete base pricing (Super Admin only)
router.delete('/:id', authorize('super_admin'), auditLogger({
    actionType: 'delete',
    entityType: 'base_subscription_pricing',
    getEntityId: (req) => req.params.id,
    getDescription: (req) => `Deleted base subscription pricing: ${req.params.id}`,
    logRequestBody: false
}), async (req, res) => {
    try {
        const pricing = await BaseSubscriptionPricing.delete(req.params.id);
        if (!pricing) {
            return res.status(404).json({ error: 'Base pricing not found' });
        }
        res.json({ message: 'Base subscription pricing deleted successfully' });
    } catch (error) {
        console.error('Delete base pricing error:', error);
        res.status(500).json({ error: 'Failed to delete base pricing' });
    }
});

module.exports = router;

