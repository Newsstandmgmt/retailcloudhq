const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication and super admin access
router.use(authenticate);
router.use(authorize('super_admin'));

// Get all audit logs with filters
router.get('/', async (req, res) => {
    try {
        const {
            user_id,
            user_email,
            action_type,
            entity_type,
            entity_id,
            status,
            store_id,
            start_date,
            end_date,
            search,
            limit = 100,
            offset = 0
        } = req.query;

        const filters = {
            user_id,
            user_email,
            action_type,
            entity_type,
            entity_id,
            status,
            store_id,
            start_date,
            end_date,
            search,
            limit: parseInt(limit),
            offset: parseInt(offset)
        };

        const result = await AuditLog.findAll(filters);
        
        res.json({
            success: true,
            data: {
                logs: result.logs.map(log => ({
                    id: log.id,
                    user_id: log.user_id,
                    user_email: log.user_email,
                    user_name: log.user_name,
                    user_full_name: log.user_full_name,
                    action_type: log.action_type,
                    entity_type: log.entity_type,
                    entity_id: log.entity_id,
                    action_description: log.action_description,
                    resource_path: log.resource_path,
                    http_method: log.http_method,
                    ip_address: log.ip_address,
                    user_agent: log.user_agent,
                    old_values: typeof log.old_values === 'string' ? JSON.parse(log.old_values) : log.old_values,
                    new_values: typeof log.new_values === 'string' ? JSON.parse(log.new_values) : log.new_values,
                    status: log.status,
                    error_message: log.error_message,
                    store_id: log.store_id,
                    store_name: log.store_name,
                    metadata: typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata,
                    created_at: log.created_at
                })),
                pagination: {
                    total: result.total,
                    limit: result.limit,
                    offset: result.offset,
                    has_more: result.offset + result.limit < result.total
                }
            }
        });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

// Get login history
router.get('/login-history', async (req, res) => {
    try {
        const {
            user_id,
            start_date,
            end_date,
            limit = 100,
            offset = 0
        } = req.query;

        const filters = {
            user_id,
            start_date,
            end_date,
            limit: parseInt(limit),
            offset: parseInt(offset)
        };

        const result = await AuditLog.getLoginHistory(filters);
        
        res.json({
            success: true,
            data: {
                logs: result.logs,
                pagination: {
                    total: result.total,
                    limit: result.limit,
                    offset: result.offset,
                    has_more: result.offset + result.limit < result.total
                }
            }
        });
    } catch (error) {
        console.error('Error fetching login history:', error);
        res.status(500).json({ error: 'Failed to fetch login history' });
    }
});

// Get critical actions
router.get('/critical-actions', async (req, res) => {
    try {
        const {
            entity_type,
            start_date,
            end_date,
            limit = 100,
            offset = 0
        } = req.query;

        const filters = {
            entity_type,
            start_date,
            end_date,
            limit: parseInt(limit),
            offset: parseInt(offset)
        };

        const result = await AuditLog.getCriticalActions(filters);
        
        res.json({
            success: true,
            data: {
                logs: result.logs.map(log => ({
                    ...log,
                    old_values: typeof log.old_values === 'string' ? JSON.parse(log.old_values || '{}') : log.old_values,
                    new_values: typeof log.new_values === 'string' ? JSON.parse(log.new_values || '{}') : log.new_values
                })),
                pagination: {
                    total: result.total,
                    limit: result.limit,
                    offset: result.offset,
                    has_more: result.offset + result.limit < result.total
                }
            }
        });
    } catch (error) {
        console.error('Error fetching critical actions:', error);
        res.status(500).json({ error: 'Failed to fetch critical actions' });
    }
});

// Get statistics
router.get('/statistics', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        // Default to last 30 days if not provided
        const endDate = end_date || new Date().toISOString();
        const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const stats = await AuditLog.getStatistics(startDate, endDate);
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching audit statistics:', error);
        res.status(500).json({ error: 'Failed to fetch audit statistics' });
    }
});

// Export audit logs to CSV
router.get('/export', async (req, res) => {
    try {
        const {
            user_id,
            user_email,
            action_type,
            entity_type,
            status,
            store_id,
            start_date,
            end_date,
            search
        } = req.query;

        const filters = {
            user_id,
            user_email,
            action_type,
            entity_type,
            status,
            store_id,
            start_date,
            end_date,
            search,
            limit: 10000, // Export limit
            offset: 0
        };

        const result = await AuditLog.findAll(filters);
        
        // Convert to CSV
        const csvHeaders = [
            'ID', 'Timestamp', 'User Email', 'User Name', 'Action Type', 'Entity Type', 
            'Entity ID', 'Description', 'Resource Path', 'HTTP Method', 'IP Address', 
            'Status', 'Error Message', 'Store Name'
        ];

        const csvRows = result.logs.map(log => [
            log.id,
            log.created_at,
            log.user_email || '',
            log.user_name || log.user_full_name || '',
            log.action_type,
            log.entity_type || '',
            log.entity_id || '',
            log.action_description || '',
            log.resource_path || '',
            log.http_method || '',
            log.ip_address || '',
            log.status,
            log.error_message || '',
            log.store_name || ''
        ]);

        const csvContent = [
            csvHeaders.join(','),
            ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
        res.send(csvContent);
    } catch (error) {
        console.error('Error exporting audit logs:', error);
        res.status(500).json({ error: 'Failed to export audit logs' });
    }
});

module.exports = router;

