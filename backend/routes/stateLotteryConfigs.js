const express = require('express');
const StateLotteryConfig = require('../models/StateLotteryConfig');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all state lottery configs (for dropdowns)
router.get('/', async (req, res) => {
    try {
        const configs = await StateLotteryConfig.findAll();
        res.json({ configs });
    } catch (error) {
        console.error('Get state lottery configs error:', error);
        res.status(500).json({ error: 'Failed to fetch state lottery configurations' });
    }
});

// Get config by state code
router.get('/state/:stateCode', async (req, res) => {
    try {
        const config = await StateLotteryConfig.findByStateCode(req.params.stateCode);
        if (!config) {
            return res.status(404).json({ error: 'State lottery configuration not found' });
        }
        res.json({ config });
    } catch (error) {
        console.error('Get state lottery config error:', error);
        res.status(500).json({ error: 'Failed to fetch state lottery configuration' });
    }
});

// Get config by store ID (uses store's state)
router.get('/store/:storeId', async (req, res) => {
    try {
        const config = await StateLotteryConfig.findByStoreId(req.params.storeId);
        if (!config) {
            return res.status(404).json({ error: 'State lottery configuration not found for this store' });
        }
        res.json({ config });
    } catch (error) {
        console.error('Get store lottery config error:', error);
        res.status(500).json({ error: 'Failed to fetch lottery configuration' });
    }
});

// Create state lottery config (super_admin only)
router.post('/', authorize('super_admin'), async (req, res) => {
    try {
        const config = await StateLotteryConfig.create(req.body);
        res.status(201).json({
            message: 'State lottery configuration created successfully',
            config
        });
    } catch (error) {
        console.error('Create state lottery config error:', error);
        res.status(500).json({ error: 'Failed to create state lottery configuration', details: error.message });
    }
});

// Update state lottery config (super_admin only)
router.put('/:id', authorize('super_admin'), async (req, res) => {
    try {
        const config = await StateLotteryConfig.update(req.params.id, req.body);
        if (!config) {
            return res.status(404).json({ error: 'State lottery configuration not found' });
        }
        res.json({
            message: 'State lottery configuration updated successfully',
            config
        });
    } catch (error) {
        console.error('Update state lottery config error:', error);
        res.status(500).json({ error: 'Failed to update state lottery configuration', details: error.message });
    }
});

// Delete state lottery config (super_admin only - soft delete)
router.delete('/:id', authorize('super_admin'), async (req, res) => {
    try {
        const config = await StateLotteryConfig.delete(req.params.id);
        if (!config) {
            return res.status(404).json({ error: 'State lottery configuration not found' });
        }
        res.json({ message: 'State lottery configuration deleted successfully' });
    } catch (error) {
        console.error('Delete state lottery config error:', error);
        res.status(500).json({ error: 'Failed to delete state lottery configuration' });
    }
});

module.exports = router;

