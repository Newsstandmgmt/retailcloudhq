const express = require('express');
const { authenticate, authorize, canAccessStore } = require('../middleware/auth');
const CreditCard = require('../models/CreditCard');

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin')); // Only Admin can manage credit cards

// Get all credit cards for a store
router.get('/store/:storeId', canAccessStore, async (req, res) => {
    try {
        const creditCards = await CreditCard.findByStore(req.params.storeId);
        res.json({ credit_cards: creditCards });
    } catch (error) {
        console.error('Get credit cards error:', error);
        res.status(500).json({ error: 'Failed to fetch credit cards' });
    }
});

// Create a new credit card
router.post('/store/:storeId', canAccessStore, async (req, res) => {
    try {
        const { card_name, card_short_name, last_four_digits } = req.body;
        
        if (!card_name) {
            return res.status(400).json({ error: 'Card name is required' });
        }

        const creditCard = await CreditCard.create({
            store_id: req.params.storeId,
            card_name,
            card_short_name,
            last_four_digits,
            created_by: req.user.id
        });

        res.status(201).json({
            message: 'Credit card created successfully',
            credit_card: creditCard
        });
    } catch (error) {
        console.error('Create credit card error:', error);
        if (error.code === '23505') { // Unique constraint violation
            return res.status(400).json({ error: 'A credit card with this name already exists for this store' });
        }
        res.status(500).json({ error: 'Failed to create credit card' });
    }
});

// Update a credit card
router.put('/:cardId', async (req, res) => {
    try {
        const creditCard = await CreditCard.findById(req.params.cardId);
        if (!creditCard) {
            return res.status(404).json({ error: 'Credit card not found' });
        }

        // Check access to store
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, creditCard.store_id]
        );

        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        const updatedCard = await CreditCard.update(req.params.cardId, req.body);
        res.json({
            message: 'Credit card updated successfully',
            credit_card: updatedCard
        });
    } catch (error) {
        console.error('Update credit card error:', error);
        res.status(500).json({ error: 'Failed to update credit card' });
    }
});

// Delete a credit card
router.delete('/:cardId', async (req, res) => {
    try {
        const creditCard = await CreditCard.findById(req.params.cardId);
        if (!creditCard) {
            return res.status(404).json({ error: 'Credit card not found' });
        }

        // Check access to store
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, creditCard.store_id]
        );

        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        await CreditCard.delete(req.params.cardId);
        res.json({ message: 'Credit card deleted successfully' });
    } catch (error) {
        console.error('Delete credit card error:', error);
        res.status(500).json({ error: 'Failed to delete credit card' });
    }
});

// Set default credit card
router.post('/store/:storeId/default/:cardId', canAccessStore, async (req, res) => {
    try {
        const creditCard = await CreditCard.setDefault(req.params.storeId, req.params.cardId);
        res.json({
            message: 'Default credit card updated successfully',
            credit_card: creditCard
        });
    } catch (error) {
        console.error('Set default credit card error:', error);
        res.status(500).json({ error: 'Failed to set default credit card' });
    }
});

module.exports = router;

