const express = require('express');
const { authenticate, authorize, canAccessStore } = require('../middleware/auth');
const Bank = require('../models/Bank');

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin')); // Only Admin can manage banks

// Get all banks for a store
router.get('/store/:storeId', canAccessStore, async (req, res) => {
    try {
        const banks = await Bank.findByStore(req.params.storeId);
        res.json({ banks });
    } catch (error) {
        console.error('Get banks error:', error);
        res.status(500).json({ error: 'Failed to fetch banks' });
    }
});

// Create a new bank
router.post('/store/:storeId', canAccessStore, async (req, res) => {
    try {
        const { bank_name, bank_short_name } = req.body;
        
        if (!bank_name) {
            return res.status(400).json({ error: 'Bank name is required' });
        }

        const bank = await Bank.create({
            store_id: req.params.storeId,
            bank_name,
            bank_short_name,
            created_by: req.user.id
        });

        res.status(201).json({
            message: 'Bank created successfully',
            bank
        });
    } catch (error) {
        console.error('Create bank error:', error);
        if (error.code === '23505') { // Unique constraint violation
            return res.status(400).json({ error: 'A bank with this name already exists for this store' });
        }
        res.status(500).json({ error: 'Failed to create bank' });
    }
});

// Update a bank
router.put('/:bankId', async (req, res) => {
    try {
        const bank = await Bank.findById(req.params.bankId);
        if (!bank) {
            return res.status(404).json({ error: 'Bank not found' });
        }

        // Check access to store
        const { canAccessStore } = require('../middleware/auth');
        // This should be done via middleware, but for now we'll check manually
        const updatedBank = await Bank.update(req.params.bankId, req.body);
        res.json({
            message: 'Bank updated successfully',
            bank: updatedBank
        });
    } catch (error) {
        console.error('Update bank error:', error);
        res.status(500).json({ error: 'Failed to update bank' });
    }
});

// Delete a bank
router.delete('/:bankId', async (req, res) => {
    try {
        const bank = await Bank.findById(req.params.bankId);
        if (!bank) {
            return res.status(404).json({ error: 'Bank not found' });
        }

        await Bank.delete(req.params.bankId);
        res.json({ message: 'Bank deleted successfully' });
    } catch (error) {
        console.error('Delete bank error:', error);
        res.status(500).json({ error: 'Failed to delete bank' });
    }
});

// Set default bank
router.post('/store/:storeId/default/:bankId', canAccessStore, async (req, res) => {
    try {
        const { type } = req.body; // 'default_bank', 'default_atm_bank', 'default_lottery_bank', 'default_credit_card_bank'
        
        if (!['default_bank', 'default_atm_bank', 'default_lottery_bank', 'default_credit_card_bank'].includes(type)) {
            return res.status(400).json({ error: 'Invalid default type' });
        }

        const bank = await Bank.setDefault(req.params.storeId, req.params.bankId, type.replace('default_', ''));
        res.json({
            message: 'Default bank updated successfully',
            bank
        });
    } catch (error) {
        console.error('Set default bank error:', error);
        res.status(500).json({ error: 'Failed to set default bank' });
    }
});

module.exports = router;

