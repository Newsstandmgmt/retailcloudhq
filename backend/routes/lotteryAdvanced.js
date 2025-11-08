const express = require('express');
const LotteryGame = require('../models/LotteryGame');
const LotteryPack = require('../models/LotteryPack');
const LotteryBox = require('../models/LotteryBox');
const LotteryReading = require('../models/LotteryReading');
const LotteryAnomaly = require('../models/LotteryAnomaly');
const LotteryDrawDay = require('../models/LotteryDrawDay');
const LotteryInstantDay = require('../models/LotteryInstantDay');
const LotteryService = require('../services/lotteryService');
const { authenticate, authorize, canAccessStore } = require('../middleware/auth');
const { auditLogger } = require('../middleware/auditLogger');

const router = express.Router();

router.use(authenticate);

// ============================================
// MASTER DATA ROUTES
// ============================================

// Games (global, no store required)
router.get('/games', async (req, res) => {
    try {
        const games = await LotteryGame.findAll({ is_active: true });
        res.json({ games });
    } catch (error) {
        console.error('Get games error:', error);
        res.status(500).json({ error: 'Failed to fetch games' });
    }
});

router.post('/games', authorize('super_admin', 'admin'), auditLogger({
    actionType: 'create',
    entityType: 'lottery_game',
    getEntityId: (req) => null,
    getDescription: (req) => `Created lottery game: ${req.body?.game_id || 'N/A'}`,
    logRequestBody: true
}), async (req, res) => {
    try {
        const game = await LotteryGame.create(req.body);
        res.status(201).json({ message: 'Game created successfully', game });
    } catch (error) {
        console.error('Create game error:', error);
        res.status(500).json({ error: 'Failed to create game', details: error.message });
    }
});

router.put('/games/:id', authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const game = await LotteryGame.update(req.params.id, req.body);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        res.json({ message: 'Game updated successfully', game });
    } catch (error) {
        console.error('Update game error:', error);
        res.status(500).json({ error: 'Failed to update game', details: error.message });
    }
});

// Boxes
router.get('/stores/:storeId/boxes', canAccessStore, async (req, res) => {
    try {
        const boxes = await LotteryBox.findByStore(req.params.storeId);
        res.json({ boxes });
    } catch (error) {
        console.error('Get boxes error:', error);
        res.status(500).json({ error: 'Failed to fetch boxes' });
    }
});

router.post('/stores/:storeId/boxes', canAccessStore, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const box = await LotteryBox.create({ ...req.body, store_id: req.params.storeId });
        res.status(201).json({ message: 'Box created successfully', box });
    } catch (error) {
        console.error('Create box error:', error);
        res.status(500).json({ error: 'Failed to create box', details: error.message });
    }
});

// Packs
router.get('/stores/:storeId/packs', canAccessStore, async (req, res) => {
    try {
        const packs = await LotteryPack.findByStore(req.params.storeId, req.query);
        res.json({ packs });
    } catch (error) {
        console.error('Get packs error:', error);
        res.status(500).json({ error: 'Failed to fetch packs' });
    }
});

router.post('/stores/:storeId/packs/activate', canAccessStore, async (req, res) => {
    try {
        const { pack_id, game_id, box_label, start_ticket } = req.body;
        const pack = await LotteryPack.activate(pack_id, req.params.storeId, {
            game_id,
            box_label,
            start_ticket,
            activated_by: req.user.id
        });
        if (!pack) {
            return res.status(404).json({ error: 'Pack not found' });
        }
        res.json({ message: 'Pack activated successfully', pack });
    } catch (error) {
        console.error('Activate pack error:', error);
        res.status(500).json({ error: 'Failed to activate pack', details: error.message });
    }
});

// ============================================
// READINGS ROUTES
// ============================================

router.post('/stores/:storeId/readings', canAccessStore, async (req, res) => {
    try {
        const result = await LotteryService.recordReading({
            ...req.body,
            store_id: req.params.storeId,
            user_id: req.user.id
        });
        res.status(201).json({
            message: 'Reading recorded successfully',
            ...result
        });
    } catch (error) {
        console.error('Record reading error:', error);
        res.status(500).json({ error: 'Failed to record reading', details: error.message });
    }
});

router.get('/stores/:storeId/readings', canAccessStore, async (req, res) => {
    try {
        const readings = await LotteryReading.findByStore(req.params.storeId, req.query.date);
        res.json({ readings });
    } catch (error) {
        console.error('Get readings error:', error);
        res.status(500).json({ error: 'Failed to fetch readings' });
    }
});

// ============================================
// INSTANT LOTTERY ROUTES
// ============================================

router.get('/stores/:storeId/instant/compute/:date', canAccessStore, async (req, res) => {
    try {
        const result = await LotteryService.computeInstantDay(req.params.storeId, req.params.date);
        res.json(result);
    } catch (error) {
        console.error('Compute instant day error:', error);
        res.status(500).json({ error: 'Failed to compute instant day', details: error.message });
    }
});

router.post('/stores/:storeId/instant/days', canAccessStore, async (req, res) => {
    try {
        const instantDay = await LotteryInstantDay.createOrUpdate({
            ...req.body,
            store_id: req.params.storeId
        });
        res.json({ message: 'Instant day saved successfully', instantDay });
    } catch (error) {
        console.error('Save instant day error:', error);
        res.status(500).json({ error: 'Failed to save instant day', details: error.message });
    }
});

router.get('/stores/:storeId/instant/days/:date', canAccessStore, async (req, res) => {
    try {
        const instantDay = await LotteryInstantDay.findByStoreAndDate(req.params.storeId, req.params.date);
        res.json({ instantDay });
    } catch (error) {
        console.error('Get instant day error:', error);
        res.status(500).json({ error: 'Failed to fetch instant day', details: error.message });
    }
});

// ============================================
// DRAW/ONLINE LOTTERY ROUTES
// ============================================

router.post('/stores/:storeId/draw/days', canAccessStore, async (req, res) => {
    try {
        const drawDay = await LotteryDrawDay.createOrUpdate({
            ...req.body,
            store_id: req.params.storeId
        });
        res.json({ message: 'Draw day saved successfully', drawDay });
    } catch (error) {
        console.error('Save draw day error:', error);
        res.status(500).json({ error: 'Failed to save draw day', details: error.message });
    }
});

router.get('/stores/:storeId/draw/days/:date', canAccessStore, async (req, res) => {
    try {
        const drawDay = await LotteryDrawDay.findByStoreAndDate(req.params.storeId, req.params.date);
        res.json({ drawDay });
    } catch (error) {
        console.error('Get draw day error:', error);
        res.status(500).json({ error: 'Failed to fetch draw day', details: error.message });
    }
});

// ============================================
// DAY CLOSE ROUTES
// ============================================

router.get('/stores/:storeId/dayclose/preview/:date', canAccessStore, async (req, res) => {
    try {
        const preview = await LotteryService.previewDayClose(req.params.storeId, req.params.date);
        res.json(preview);
    } catch (error) {
        console.error('Preview day close error:', error);
        res.status(500).json({ error: 'Failed to preview day close', details: error.message });
    }
});

router.post('/stores/:storeId/dayclose/post/:date', canAccessStore, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const result = await LotteryService.postGL(req.params.storeId, req.params.date, req.user.id);
        res.json({ message: 'GL posted successfully', ...result });
    } catch (error) {
        console.error('Post GL error:', error);
        res.status(500).json({ error: 'Failed to post GL', details: error.message });
    }
});

// ============================================
// ANOMALIES ROUTES
// ============================================

router.get('/stores/:storeId/anomalies', canAccessStore, async (req, res) => {
    try {
        const anomalies = await LotteryAnomaly.findByStore(req.params.storeId, req.query);
        res.json({ anomalies });
    } catch (error) {
        console.error('Get anomalies error:', error);
        res.status(500).json({ error: 'Failed to fetch anomalies', details: error.message });
    }
});

router.post('/anomalies/:id/resolve', canAccessStore, async (req, res) => {
    try {
        const { resolved_note } = req.body;
        const anomaly = await LotteryAnomaly.resolve(req.params.id, req.user.id, resolved_note);
        if (!anomaly) {
            return res.status(404).json({ error: 'Anomaly not found' });
        }
        res.json({ message: 'Anomaly resolved successfully', anomaly });
    } catch (error) {
        console.error('Resolve anomaly error:', error);
        res.status(500).json({ error: 'Failed to resolve anomaly', details: error.message });
    }
});

router.post('/anomalies/:id/acknowledge', canAccessStore, async (req, res) => {
    try {
        const anomaly = await LotteryAnomaly.acknowledge(req.params.id, req.user.id);
        if (!anomaly) {
            return res.status(404).json({ error: 'Anomaly not found' });
        }
        res.json({ message: 'Anomaly acknowledged successfully', anomaly });
    } catch (error) {
        console.error('Acknowledge anomaly error:', error);
        res.status(500).json({ error: 'Failed to acknowledge anomaly', details: error.message });
    }
});

module.exports = router;

