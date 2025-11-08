const express = require('express');
const LicenseFees = require('../models/LicenseFees');
const { authenticate, canAccessStore } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Create or update license fees entry
router.post('/:storeId/yearly', canAccessStore, async (req, res) => {
    try {
        const { entry_year, ...feesData } = req.body;
        
        if (!entry_year) {
            return res.status(400).json({ error: 'Entry year is required' });
        }
        
        const licenseFees = await LicenseFees.upsert(
            req.params.storeId,
            entry_year,
            { ...feesData, entered_by: req.user.id }
        );
        
        res.status(201).json({
            message: 'License fees entry saved successfully',
            licenseFees
        });
    } catch (error) {
        console.error('Create license fees error:', error);
        res.status(500).json({ error: 'Failed to save license fees entry' });
    }
});

// Get license fees entry for specific year
router.get('/:storeId/yearly/:year', canAccessStore, async (req, res) => {
    try {
        const licenseFees = await LicenseFees.findByYear(req.params.storeId, parseInt(req.params.year));
        if (!licenseFees) {
            return res.status(404).json({ error: 'License fees entry not found' });
        }
        
        res.json({ licenseFees });
    } catch (error) {
        console.error('Get license fees error:', error);
        res.status(500).json({ error: 'Failed to fetch license fees entry' });
    }
});

// Get license fees entries for year range
router.get('/:storeId/range', canAccessStore, async (req, res) => {
    try {
        const { start_year, end_year } = req.query;
        
        if (!start_year || !end_year) {
            return res.status(400).json({ error: 'Start year and end year are required' });
        }
        
        const licenseFees = await LicenseFees.findByYearRange(
            req.params.storeId,
            parseInt(start_year),
            parseInt(end_year)
        );
        
        res.json({ licenseFees });
    } catch (error) {
        console.error('Get license fees range error:', error);
        res.status(500).json({ error: 'Failed to fetch license fees entries' });
    }
});

module.exports = router;

