const express = require('express');
const JournalEntry = require('../models/JournalEntry');
const { authenticate, authorize, canAccessStore } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Get all journal entries for a store
router.get('/store/:storeId', canAccessStore, async (req, res) => {
    try {
        const filters = {
            start_date: req.query.start_date || null,
            end_date: req.query.end_date || null,
            status: req.query.status || null,
            entry_type: req.query.entry_type || null
        };

        const entries = await JournalEntry.findByStore(req.params.storeId, filters);
        res.json({ entries });
    } catch (error) {
        console.error('Get journal entries error:', error);
        res.status(500).json({ error: 'Failed to fetch journal entries' });
    }
});

// Get journal entry by ID
router.get('/:entryId', async (req, res) => {
    try {
        const entry = await JournalEntry.findById(req.params.entryId);
        if (!entry) {
            return res.status(404).json({ error: 'Journal entry not found' });
        }

        // Check access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, entry.store_id]
        );

        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        res.json({ entry });
    } catch (error) {
        console.error('Get journal entry error:', error);
        res.status(500).json({ error: 'Failed to fetch journal entry' });
    }
});

// Create journal entry
router.post('/store/:storeId', canAccessStore, async (req, res) => {
    try {
        const {
            entry_date,
            entry_type,
            description,
            reference_type,
            reference_id,
            status,
            lines,
            notes
        } = req.body;

        if (!entry_date || !description || !lines || !Array.isArray(lines) || lines.length < 2) {
            return res.status(400).json({ error: 'Entry date, description, and at least 2 lines are required' });
        }

        const entry = await JournalEntry.create(req.params.storeId, {
            entry_date,
            entry_type: entry_type || 'manual',
            description,
            reference_type: reference_type || null,
            reference_id: reference_id || null,
            status: status || 'draft',
            lines,
            entered_by: req.user.id,
            notes: notes || null
        });

        res.status(201).json({
            message: 'Journal entry created successfully',
            entry
        });
    } catch (error) {
        console.error('Create journal entry error:', error);
        res.status(500).json({ error: error.message || 'Failed to create journal entry' });
    }
});

// Update journal entry
router.put('/:entryId', async (req, res) => {
    try {
        const entry = await JournalEntry.findById(req.params.entryId);
        if (!entry) {
            return res.status(404).json({ error: 'Journal entry not found' });
        }

        // Check access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, entry.store_id]
        );

        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        const updated = await JournalEntry.update(req.params.entryId, req.body);
        res.json({
            message: 'Journal entry updated successfully',
            entry: updated
        });
    } catch (error) {
        console.error('Update journal entry error:', error);
        res.status(500).json({ error: error.message || 'Failed to update journal entry' });
    }
});

// Post journal entry
router.post('/:entryId/post', async (req, res) => {
    try {
        const entry = await JournalEntry.findById(req.params.entryId);
        if (!entry) {
            return res.status(404).json({ error: 'Journal entry not found' });
        }

        // Check access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, entry.store_id]
        );

        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        // Check authorization (only admins and managers can post)
        if (!['admin', 'super_admin', 'manager'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Only admins and managers can post journal entries' });
        }

        const posted = await JournalEntry.post(req.params.entryId, req.user.id);
        res.json({
            message: 'Journal entry posted successfully',
            entry: posted
        });
    } catch (error) {
        console.error('Post journal entry error:', error);
        res.status(500).json({ error: error.message || 'Failed to post journal entry' });
    }
});

// Delete journal entry
router.delete('/:entryId', async (req, res) => {
    try {
        const entry = await JournalEntry.findById(req.params.entryId);
        if (!entry) {
            return res.status(404).json({ error: 'Journal entry not found' });
        }

        // Check access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, entry.store_id]
        );

        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        await JournalEntry.delete(req.params.entryId);
        res.json({ message: 'Journal entry deleted successfully' });
    } catch (error) {
        console.error('Delete journal entry error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete journal entry' });
    }
});

// Get account ledger
router.get('/store/:storeId/account/:accountId/ledger', canAccessStore, async (req, res) => {
    try {
        const filters = {
            start_date: req.query.start_date || null,
            end_date: req.query.end_date || null
        };

        const ledger = await JournalEntry.getAccountLedger(req.params.storeId, req.params.accountId, filters);
        res.json({ ledger });
    } catch (error) {
        console.error('Get account ledger error:', error);
        res.status(500).json({ error: 'Failed to fetch account ledger' });
    }
});

// Get account balance
router.get('/store/:storeId/account/:accountId/balance', canAccessStore, async (req, res) => {
    try {
        const asOfDate = req.query.as_of_date || null;
        const balance = await JournalEntry.getAccountBalance(req.params.storeId, req.params.accountId, asOfDate);
        res.json({ balance });
    } catch (error) {
        console.error('Get account balance error:', error);
        res.status(500).json({ error: 'Failed to fetch account balance' });
    }
});

// Get trial balance
router.get('/store/:storeId/trial-balance', canAccessStore, async (req, res) => {
    try {
        const asOfDate = req.query.as_of_date || null;
        const trialBalance = await JournalEntry.getTrialBalance(req.params.storeId, asOfDate);
        res.json({ trial_balance: trialBalance });
    } catch (error) {
        console.error('Get trial balance error:', error);
        res.status(500).json({ error: 'Failed to fetch trial balance' });
    }
});

// Reverse journal entry
router.post('/:entryId/reverse', async (req, res) => {
    try {
        const entry = await JournalEntry.findById(req.params.entryId);
        if (!entry) {
            return res.status(404).json({ error: 'Journal entry not found' });
        }

        // Check access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, entry.store_id]
        );

        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        // Check authorization (only admins and managers can reverse)
        if (!['admin', 'super_admin', 'manager'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Only admins and managers can reverse journal entries' });
        }

        const { reversal_date } = req.body;
        const reversal = await JournalEntry.reverse(req.params.entryId, req.user.id, reversal_date);
        res.json({
            message: 'Journal entry reversed successfully',
            reversal_entry: reversal
        });
    } catch (error) {
        console.error('Reverse journal entry error:', error);
        res.status(500).json({ error: error.message || 'Failed to reverse journal entry' });
    }
});

module.exports = router;

