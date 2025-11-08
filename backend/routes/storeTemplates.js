const express = require('express');
const StoreTemplate = require('../models/StoreTemplate');
const StoreFeatureService = require('../services/storeFeatureService');
const { authenticate, authorize } = require('../middleware/auth');
const { auditLogger } = require('../middleware/auditLogger');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all templates (super admin only)
router.get('/', authorize('super_admin'), async (req, res) => {
    try {
        const templates = await StoreTemplate.findAll();
        // Get features for each template
        const templatesWithFeatures = await Promise.all(
            templates.map(async (template) => {
                const features = await StoreTemplate.getFeatures(template.id);
                const featureKeys = await StoreTemplate.getFeatureKeys(template.id);
                return {
                    ...template,
                    features,
                    feature_keys: featureKeys
                };
            })
        );
        res.json({ templates: templatesWithFeatures });
    } catch (error) {
        console.error('Get templates error:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

// Get all available features
router.get('/features', authorize('super_admin'), async (req, res) => {
    try {
        const features = await StoreTemplate.getAllFeatures();
        res.json({ features });
    } catch (error) {
        console.error('Get features error:', error);
        res.status(500).json({ error: 'Failed to fetch features' });
    }
});

// Create a new feature (Super Admin only)
router.post('/features', authorize('super_admin'), async (req, res) => {
    try {
        const { feature_key, feature_name, description, category } = req.body;
        
        if (!feature_key || !feature_name) {
            return res.status(400).json({ error: 'feature_key and feature_name are required' });
        }

        const feature = await StoreTemplate.createFeature({
            feature_key,
            feature_name,
            description,
            category
        });

        if (!feature) {
            return res.status(400).json({ error: 'Feature already exists' });
        }

        res.status(201).json({
            message: 'Feature created successfully',
            feature
        });
    } catch (error) {
        console.error('Create feature error:', error);
        res.status(500).json({ error: 'Failed to create feature' });
    }
});

// Get template by ID
router.get('/:templateId', authorize('super_admin'), async (req, res) => {
    try {
        const template = await StoreTemplate.findWithFeatures(req.params.templateId);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }
        res.json({ template });
    } catch (error) {
        console.error('Get template error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to fetch template', details: error.message });
    }
});

// Create new template
router.post('/', authorize('super_admin'), auditLogger({
    actionType: 'create',
    entityType: 'store_template',
    getEntityId: (req) => null,
    getDescription: (req) => `Created store template: ${req.body?.name || 'N/A'}`,
    logRequestBody: true
}), async (req, res) => {
    try {
        const { name, description, price_per_month, billing_cycle, feature_ids } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Template name is required' });
        }

        const template = await StoreTemplate.create({ 
            name, 
            description, 
            price_per_month: price_per_month || 0,
            billing_cycle: billing_cycle || 'monthly'
        });

        // Add features if provided
        if (feature_ids && Array.isArray(feature_ids)) {
            for (const featureId of feature_ids) {
                await StoreTemplate.addFeature(template.id, featureId);
            }
        }

        const templateWithFeatures = await StoreTemplate.findWithFeatures(template.id);
        res.status(201).json({
            message: 'Template created successfully',
            template: templateWithFeatures
        });
    } catch (error) {
        console.error('Create template error:', error);
        if (error.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Template name already exists' });
        }
        res.status(500).json({ error: 'Failed to create template' });
    }
});

// Update template
router.put('/:templateId', authorize('super_admin'), auditLogger({
    actionType: 'update',
    entityType: 'store_template',
    getEntityId: (req) => req.params.templateId,
    getDescription: (req) => `Updated store template: ${req.params.templateId}`,
    logRequestBody: true
}), async (req, res) => {
    try {
        const { name, description, is_active, price_per_month, billing_cycle, feature_ids } = req.body;
        
        const template = await StoreTemplate.update(req.params.templateId, {
            name,
            description,
            is_active,
            price_per_month,
            billing_cycle
        });

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Update features if provided
        if (feature_ids !== undefined && Array.isArray(feature_ids)) {
            // Get current features
            const currentFeatures = await StoreTemplate.getFeatures(req.params.templateId);
            const currentFeatureIds = currentFeatures.map(f => f.id);
            
            // Remove features not in the new list
            for (const featureId of currentFeatureIds) {
                if (!feature_ids.includes(featureId)) {
                    await StoreTemplate.removeFeature(req.params.templateId, featureId);
                }
            }
            
            // Add new features
            for (const featureId of feature_ids) {
                if (!currentFeatureIds.includes(featureId)) {
                    await StoreTemplate.addFeature(req.params.templateId, featureId);
                }
            }
        }

        try {
            const templateWithFeatures = await StoreTemplate.findWithFeatures(req.params.templateId);
            res.json({
                message: 'Template updated successfully',
                template: templateWithFeatures
            });
        } catch (featuresError) {
            console.error('Error fetching template with features after update:', featuresError);
            // Return template without features if feature fetching fails
            res.json({
                message: 'Template updated successfully',
                template: template
            });
        }
    } catch (error) {
        console.error('Update template error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to update template', details: error.message });
    }
});

// Delete a store template (Super Admin only)
router.delete('/:templateId', authorize('super_admin'), auditLogger({
    actionType: 'delete',
    entityType: 'store_template',
    getEntityId: (req) => req.params.templateId,
    getDescription: (req) => `Deleted store template: ${req.params.templateId}`,
    logRequestBody: false
}), async (req, res) => {
    try {
        const template = await StoreTemplate.findById(req.params.templateId);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Soft delete by setting is_active to false
        await StoreTemplate.update(req.params.templateId, { is_active: false });
        res.json({ message: 'Template deleted successfully' });
    } catch (error) {
        console.error('Delete template error:', error);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

// Get enabled features for a store (for admins/managers to check)
router.get('/store/:storeId/features', async (req, res) => {
    try {
        const { storeId } = req.params;
        
        // Check if user has access to this store
        const AdminConfig = require('../models/AdminConfig');
        const hasAccess = await AdminConfig.canAccessStore(req.user.id, req.user.role, storeId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied to this store' });
        }

        const features = await StoreFeatureService.getEnabledFeatures(storeId);
        const template = await StoreFeatureService.getStoreTemplate(storeId);
        
        res.json({
            store_id: storeId,
            enabled_features: features,
            template: template ? {
                id: template.id,
                name: template.name,
                description: template.description
            } : null
        });
    } catch (error) {
        console.error('Get store features error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to fetch store features', details: error.message });
    }
});

// Check if specific feature is enabled (for admins/managers)
router.get('/store/:storeId/features/:featureKey', async (req, res) => {
    try {
        const { storeId, featureKey } = req.params;
        
        // Check if user has access to this store
        const AdminConfig = require('../models/AdminConfig');
        const hasAccess = await AdminConfig.canAccessStore(req.user.id, req.user.role, storeId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied to this store' });
        }

        const isEnabled = await StoreFeatureService.isFeatureEnabled(storeId, featureKey);
        res.json({
            store_id: storeId,
            feature_key: featureKey,
            enabled: isEnabled
        });
    } catch (error) {
        console.error('Check feature error:', error);
        res.status(500).json({ error: 'Failed to check feature' });
    }
});

module.exports = router;

