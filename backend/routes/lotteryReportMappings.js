const express = require('express');
const LotteryReportMapping = require('../models/LotteryReportMapping');
const LotteryRawReport = require('../models/LotteryRawReport');
const { authenticate, authorize, canAccessStore } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

router.use(authenticate);

const ensureStoreAccessFromMapping = async (mappingId, userId) => {
    const mapping = await LotteryReportMapping.findById(mappingId);
    if (!mapping) {
        return { mapping: null, allowed: false, status: 404, message: 'Mapping not found' };
    }

    const accessResult = await query(
        'SELECT can_user_access_store($1, $2) as can_access',
        [userId, mapping.store_id]
    );

    if (accessResult.rows[0]?.can_access !== true) {
        return { mapping, allowed: false, status: 403, message: 'Access denied to this store.' };
    }

    return { mapping, allowed: true };
};

router.get('/store/:storeId', canAccessStore, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const { reportType } = req.query;
        const mappings = await LotteryReportMapping.listByStore(req.params.storeId, { reportType });
        res.json({ mappings });
    } catch (error) {
        console.error('List lottery mappings error:', error);
        res.status(500).json({ error: 'Failed to fetch lottery report mappings', details: error.message });
    }
});

router.get('/store/:storeId/available-columns', canAccessStore, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const { reportType = null, limit = 10 } = req.query;
        const reports = await LotteryRawReport.listByStore(req.params.storeId, { limit: Number(limit) || 10 });

        const columnsSet = new Set();
        reports.forEach((report) => {
            if (report.report_type && reportType && report.report_type !== reportType) {
                return;
            }

            const data = report.data || {};
            if (Array.isArray(data.__columns)) {
                data.__columns.forEach((col) => {
                    if (col && col !== '__columns') {
                        columnsSet.add(col);
                    }
                });
            } else {
                Object.keys(data).forEach((key) => {
                    if (key && key !== '__columns') {
                        columnsSet.add(key);
                    }
                });
            }
        });

        res.json({
            columns: Array.from(columnsSet).sort(),
            sampleCount: reports.length,
        });
    } catch (error) {
        console.error('Get available lottery columns error:', error);
        res.status(500).json({ error: 'Failed to fetch available columns', details: error.message });
    }
});

router.post('/store/:storeId', canAccessStore, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const {
            report_type,
            source_column,
            target_type,
            target_field,
            data_type = 'number',
            notes = null,
        } = req.body || {};

        if (!report_type) {
            return res.status(400).json({ error: 'report_type is required' });
        }
        if (!source_column) {
            return res.status(400).json({ error: 'source_column is required' });
        }
        if (!target_type || !['daily_revenue', 'lottery_field'].includes(target_type)) {
            return res.status(400).json({ error: 'target_type must be daily_revenue or lottery_field' });
        }
        if (!target_field) {
            return res.status(400).json({ error: 'target_field is required' });
        }

        const mapping = await LotteryReportMapping.create({
            storeId: req.params.storeId,
            reportType: report_type,
            sourceColumn: source_column,
            targetType: target_type,
            targetField: target_field,
            dataType: data_type || 'number',
            notes,
        });

        res.json({ message: 'Mapping created successfully', mapping });
    } catch (error) {
        console.error('Create lottery mapping error:', error);
        res.status(500).json({ error: 'Failed to create mapping', details: error.message });
    }
});

router.put('/:mappingId', authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const access = await ensureStoreAccessFromMapping(req.params.mappingId, req.user.id);
        if (!access.allowed) {
            return res.status(access.status).json({ error: access.message || 'Access denied.' });
        }

        const updates = {};
        ['report_type', 'source_column', 'target_type', 'target_field', 'data_type', 'notes'].forEach((key) => {
            if (req.body[key] !== undefined) {
                updates[key === 'report_type' ? 'report_type' : key] = req.body[key];
            }
        });

        if (updates.target_type && !['daily_revenue', 'lottery_field'].includes(updates.target_type)) {
            return res.status(400).json({ error: 'target_type must be daily_revenue or lottery_field' });
        }

        const mapping = await LotteryReportMapping.update(req.params.mappingId, updates);
        res.json({ message: 'Mapping updated successfully', mapping });
    } catch (error) {
        console.error('Update lottery mapping error:', error);
        res.status(500).json({ error: 'Failed to update mapping', details: error.message });
    }
});

router.delete('/:mappingId', authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const access = await ensureStoreAccessFromMapping(req.params.mappingId, req.user.id);
        if (!access.allowed) {
            return res.status(access.status).json({ error: access.message || 'Access denied.' });
        }

        const result = await LotteryReportMapping.delete(req.params.mappingId);
        if (!result) {
            return res.status(404).json({ error: 'Mapping not found' });
        }

        res.json({ message: 'Mapping deleted successfully' });
    } catch (error) {
        console.error('Delete lottery mapping error:', error);
        res.status(500).json({ error: 'Failed to delete mapping', details: error.message });
    }
});

module.exports = router;

