const express = require('express');
const router = express.Router();
const StoreGoogleSheet = require('../models/StoreGoogleSheet');
const GoogleSheetsService = require('../services/googleSheets');
const SyncService = require('../services/syncService');
const { authenticate, authorize, canAccessStore } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get Google Sheets configurations for a store
router.get('/store/:storeId', canAccessStore, async (req, res) => {
    try {
        const configs = await StoreGoogleSheet.findByStore(req.params.storeId);
        res.json({ configurations: configs });
    } catch (error) {
        console.error('Error fetching Google Sheets configs:', error);
        res.status(500).json({ error: 'Failed to fetch Google Sheets configurations' });
    }
});

// Get single configuration
router.get('/store/:storeId/config/:configId', canAccessStore, async (req, res) => {
    try {
        const config = await StoreGoogleSheet.findById(req.params.configId);
        if (!config || config.store_id !== req.params.storeId) {
            return res.status(404).json({ error: 'Configuration not found' });
        }
        res.json({ configuration: config });
    } catch (error) {
        console.error('Error fetching Google Sheets config:', error);
        res.status(500).json({ error: 'Failed to fetch Google Sheets configuration' });
    }
});

// Create or update Google Sheets configuration
router.post('/store/:storeId', canAccessStore, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const { spreadsheet_id, sheet_name, service_account_key, auto_sync_enabled, sync_frequency, data_type, column_mapping } = req.body;
        
        if (!spreadsheet_id || !sheet_name) {
            return res.status(400).json({ error: 'spreadsheet_id and sheet_name are required' });
        }
        
        // Ensure data_type is set, default to 'lottery' only if not provided
        const finalDataType = data_type || 'lottery';
        
        console.log('Received data_type:', data_type, 'Using:', finalDataType); // Debug log
        
        // Build default column mapping if not provided
        let finalColumnMapping = column_mapping;
        if (!finalColumnMapping || (typeof finalColumnMapping === 'object' && Object.keys(finalColumnMapping).length === 0)) {
            // Create default column mapping based on data_type
            const defaultMapping = {};
            if (finalDataType === 'lottery' || finalDataType === 'lottery_weekly') {
                defaultMapping.lottery = {
                    entry_date: 'Date',
                    retailer_number: 'Retailer Number',
                    location_name: 'Location Name',
                    balance_forward: 'Balance Forward',
                    draw_sales: 'Draw Sales',
                    draw_cancels: 'Draw Cancels',
                    draw_promos: 'Draw Promos',
                    draw_comm: 'Draw Comm',
                    draw_pays: 'Draw Pays',
                    vch_iss: 'VCH ISS',
                    vch_rd: 'VCH RD',
                    webcash_iss: 'WebCash ISS',
                    draw_adj: 'Draw Adj',
                    draw_due: 'Draw Due',
                    scratch_offs_sales: 'Scratch-Offs Sales',
                    scratch_offs_rtrns: 'Scratch-Offs Rtrns',
                    scratch_offs_comm: 'Scratch-Offs Comm',
                    scratch_offs_prms: 'Scratch-Offs Prms',
                    scratch_offs_pays: 'Scratch-Offs Pays',
                    scratch_offs_adj: 'Scratch-Offs Adj',
                    scratch_offs_due: 'Scratch-Offs Due',
                    card_trans: 'Card Trans',
                    gift_cards: 'Gift Cards',
                    prepaid: 'Prepaid',
                    total_due: 'Total Due',
                };
            } else if (finalDataType === 'revenue') {
                defaultMapping.revenue = {
                    entry_date: 'Date',
                    business_credit_card: 'Total Gross Amount ($)',
                    credit_card_transaction_fees: 'Total Processing Fee ($)',
                };
            } else if (finalDataType === 'cashflow') {
                defaultMapping.cashflow = {
                    entry_date: 'Date',
                    ending_cash_on_hand: 'Ending Cash',
                    beginning_cash: 'Beginning Cash',
                    business_daily_cash: 'Business Cash',
                    payroll_paid: 'Payroll',
                };
            }
            finalColumnMapping = defaultMapping;
        }
        
        const config = await StoreGoogleSheet.upsert(req.params.storeId, {
            spreadsheet_id,
            sheet_name,
            service_account_key,
            auto_sync_enabled: auto_sync_enabled || false,
            sync_frequency: sync_frequency || 'daily',
            data_type: finalDataType, // Use the explicitly set data_type
            column_mapping: finalColumnMapping,
            created_by: req.user.id,
        });
        
        console.log('Saved config with data_type:', config.data_type); // Debug log
        
        res.status(201).json({
            message: 'Google Sheets configuration saved successfully',
            configuration: config,
        });
    } catch (error) {
        console.error('Error saving Google Sheets config:', error);
        res.status(500).json({ error: 'Failed to save Google Sheets configuration', details: error.message });
    }
});

// Test Google Sheets connection
router.post('/store/:storeId/test', canAccessStore, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const { spreadsheet_id, sheet_name, service_account_key } = req.body;
        
        if (!spreadsheet_id || !sheet_name || !service_account_key) {
            return res.status(400).json({ error: 'spreadsheet_id, sheet_name, and service_account_key are required' });
        }
        
        const sheetsService = new GoogleSheetsService(service_account_key);
        const sheetData = await sheetsService.getAllSheetData(spreadsheet_id, sheet_name);
        
        if (!sheetData || sheetData.length < 2) {
            return res.status(400).json({ error: 'No data found in sheet or sheet is empty' });
        }
        
        res.json({
            success: true,
            headers: sheetData[0] || [],
            rowCount: sheetData.length - 1,
            sampleRow: sheetData[1] || []
        });
    } catch (error) {
        console.error('Error testing Google Sheets connection:', error);
        res.status(500).json({ error: 'Failed to test connection', details: error.message });
    }
});

// Sync data from Google Sheets
router.post('/store/:storeId/sync', canAccessStore, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const { sync_type = 'lottery' } = req.body;
        
        if (!sync_type) {
            return res.status(400).json({ error: 'sync_type is required' });
        }
        
        const result = await SyncService.syncStoreData(req.params.storeId, sync_type);
        
        res.json({
            message: 'Sync completed',
            result,
        });
    } catch (error) {
        console.error('Error syncing data:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: error.message || 'Failed to sync data',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Delete Google Sheets integration
router.delete('/store/:storeId/config/:configId', canAccessStore, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const config = await StoreGoogleSheet.delete(req.params.configId);
        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }
        res.json({ message: 'Integration deleted successfully', config });
    } catch (error) {
        console.error('Error deleting integration:', error);
        res.status(500).json({ error: 'Failed to delete integration' });
    }
});

// Toggle auto sync (pause/resume)
router.patch('/store/:storeId/config/:configId/toggle-sync', canAccessStore, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const { enabled } = req.body;
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: 'enabled must be a boolean' });
        }
        const config = await StoreGoogleSheet.toggleAutoSync(req.params.configId, enabled);
        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }
        res.json({ 
            message: enabled ? 'Auto sync enabled' : 'Auto sync paused',
            config 
        });
    } catch (error) {
        console.error('Error toggling auto sync:', error);
        res.status(500).json({ error: 'Failed to toggle auto sync' });
    }
});

// Get sync logs for a store
router.get('/store/:storeId/logs', canAccessStore, async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const logs = await SyncService.getSyncLogs(req.params.storeId, parseInt(limit));
        res.json({ logs });
    } catch (error) {
        console.error('Error fetching sync logs:', error);
        res.status(500).json({ error: 'Failed to fetch sync logs' });
    }
});

// Fix missing column mappings for existing configurations
router.post('/store/:storeId/fix-column-mappings', canAccessStore, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const { query } = require('../config/database');
        const configs = await StoreGoogleSheet.findByStore(req.params.storeId);
        
        let fixed = 0;
        for (const config of configs) {
            // Check if column_mapping is missing or empty
            if (!config.column_mapping || 
                (typeof config.column_mapping === 'object' && Object.keys(config.column_mapping).length === 0) ||
                config.column_mapping === null) {
                
                // Create default column mapping based on data_type
                const defaultMapping = {};
                if (config.data_type === 'lottery' || config.data_type === 'lottery_weekly') {
                    defaultMapping.lottery = {
                        entry_date: 'Date',
                        retailer_number: 'Retailer Number',
                        location_name: 'Location Name',
                        balance_forward: 'Balance Forward',
                        draw_sales: 'Draw Sales',
                        draw_cancels: 'Draw Cancels',
                        draw_promos: 'Draw Promos',
                        draw_comm: 'Draw Comm',
                        draw_pays: 'Draw Pays',
                        vch_iss: 'VCH ISS',
                        vch_rd: 'VCH RD',
                        webcash_iss: 'WebCash ISS',
                        draw_adj: 'Draw Adj',
                        draw_due: 'Draw Due',
                        scratch_offs_sales: 'Scratch-Offs Sales',
                        scratch_offs_rtrns: 'Scratch-Offs Rtrns',
                        scratch_offs_comm: 'Scratch-Offs Comm',
                        scratch_offs_prms: 'Scratch-Offs Prms',
                        scratch_offs_pays: 'Scratch-Offs Pays',
                        scratch_offs_adj: 'Scratch-Offs Adj',
                        scratch_offs_due: 'Scratch-Offs Due',
                        card_trans: 'Card Trans',
                        gift_cards: 'Gift Cards',
                        prepaid: 'Prepaid',
                        total_due: 'Total Due',
                    };
                } else if (config.data_type === 'revenue') {
                    defaultMapping.revenue = {
                        entry_date: 'Date',
                        business_credit_card: 'Total Gross Amount ($)',
                        credit_card_transaction_fees: 'Total Processing Fee ($)',
                    };
                } else if (config.data_type === 'cashflow') {
                    defaultMapping.cashflow = {
                        entry_date: 'Date',
                        ending_cash_on_hand: 'Ending Cash',
                        beginning_cash: 'Beginning Cash',
                        business_daily_cash: 'Business Cash',
                        payroll_paid: 'Payroll',
                    };
                }
                
                // Update the config with default mapping
                await StoreGoogleSheet.upsert(req.params.storeId, {
                    spreadsheet_id: config.spreadsheet_id,
                    sheet_name: config.sheet_name,
                    service_account_key: config.service_account_key,
                    auto_sync_enabled: config.auto_sync_enabled,
                    sync_frequency: config.sync_frequency,
                    data_type: config.data_type,
                    column_mapping: defaultMapping,
                    created_by: config.created_by,
                });
                
                fixed++;
            }
        }
        
        res.json({
            message: `Fixed ${fixed} configuration(s) with missing column mappings`,
            fixed
        });
    } catch (error) {
        console.error('Error fixing column mappings:', error);
        res.status(500).json({ error: 'Failed to fix column mappings', details: error.message });
    }
});

module.exports = router;
