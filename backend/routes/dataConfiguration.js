const express = require('express');
const CashDrawerCalculationConfig = require('../models/CashDrawerCalculationConfig');
const StoreGoogleSheet = require('../models/StoreGoogleSheet');
const FormTemplate = require('../models/FormTemplate');
const FormField = require('../models/FormField');
const CalculatedField = require('../models/CalculatedField');
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// All routes require super admin
router.use(authenticate);
router.use(authorize('super_admin'));

// ============================================
// FORMULA MANAGEMENT
// ============================================

// Get all calculation formulas
router.get('/formulas', async (req, res) => {
    try {
        const formulas = await CashDrawerCalculationConfig.findAll();
        res.json({ formulas });
    } catch (error) {
        console.error('Get formulas error:', error);
        res.status(500).json({ error: 'Failed to fetch formulas' });
    }
});

// Get formula for specific store or default
router.get('/formulas/:storeId?', async (req, res) => {
    try {
        let storeId = req.params.storeId || null;
        // Treat 'default' as null for default formula
        if (storeId === 'default') {
            storeId = null;
        }
        const formula = await CashDrawerCalculationConfig.findByStore(storeId);
        res.json({ formula });
    } catch (error) {
        console.error('Get formula error:', error);
        res.status(500).json({ error: 'Failed to fetch formula' });
    }
});

// Update calculation formula
router.put('/formulas/:storeId?', async (req, res) => {
    try {
        let storeId = req.params.storeId || null;
        // Treat 'default' as null for default formula
        if (storeId === 'default') {
            storeId = null;
        }
        const { combined_drawer_formula, lottery_owed_formula, field_visibility } = req.body;
        
        const formula = await CashDrawerCalculationConfig.upsert(storeId, {
            combined_drawer_formula,
            lottery_owed_formula,
            field_visibility
        });
        
        res.json({ 
            message: 'Formula updated successfully',
            formula 
        });
    } catch (error) {
        console.error('Update formula error:', error);
        res.status(500).json({ error: 'Failed to update formula' });
    }
});

// ============================================
// FIELD MAPPING MANAGEMENT
// ============================================

// Get all field mappings for all stores
router.get('/field-mappings', async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                sgs.*,
                s.name as store_name,
                s.id as store_id
            FROM store_google_sheets sgs
            JOIN stores s ON s.id = sgs.store_id
            ORDER BY s.name, sgs.data_type
        `);
        
        res.json({ mappings: result.rows });
    } catch (error) {
        console.error('Get field mappings error:', error);
        res.status(500).json({ error: 'Failed to fetch field mappings' });
    }
});

// Get field mapping for specific store
router.get('/field-mappings/store/:storeId', async (req, res) => {
    try {
        const mappings = await StoreGoogleSheet.findByStore(req.params.storeId);
        res.json({ mappings });
    } catch (error) {
        console.error('Get store field mappings error:', error);
        res.status(500).json({ error: 'Failed to fetch field mappings' });
    }
});

// Update field mapping
router.put('/field-mappings/:mappingId', async (req, res) => {
    try {
        const { column_mapping, auto_sync_enabled, sync_frequency } = req.body;
        
        const mapping = await StoreGoogleSheet.findById(req.params.mappingId);
        if (!mapping) {
            return res.status(404).json({ error: 'Field mapping not found' });
        }
        
        // Update the mapping
        const result = await query(`
            UPDATE store_google_sheets
            SET column_mapping = $1::jsonb,
                auto_sync_enabled = COALESCE($2, auto_sync_enabled),
                sync_frequency = COALESCE($3, sync_frequency),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *
        `, [JSON.stringify(column_mapping), auto_sync_enabled, sync_frequency, req.params.mappingId]);
        
        res.json({
            message: 'Field mapping updated successfully',
            mapping: result.rows[0]
        });
    } catch (error) {
        console.error('Update field mapping error:', error);
        res.status(500).json({ error: 'Failed to update field mapping' });
    }
});

// Get available database fields for a data type
router.get('/available-fields/:dataType', async (req, res) => {
    try {
        const { dataType } = req.params;
        
        // Define available fields for each data type
        const fieldsByType = {
            lottery: [
                'entry_date', 'retailer_number', 'location_name', 'balance_forward',
                'draw_sales', 'draw_cancels', 'draw_promos', 'draw_comm', 'draw_pays',
                'vch_iss', 'vch_rd', 'webcash_iss', 'draw_adj', 'draw_due',
                'scratch_offs_sales', 'scratch_offs_rtrns', 'scratch_offs_comm',
                'scratch_offs_prms', 'scratch_offs_pays', 'scratch_offs_adj', 'scratch_offs_due',
                'card_trans', 'gift_cards', 'prepaid', 'total_due',
                'daily_draw_sales', 'daily_draw_net', 'daily_instant_sales',
                'daily_instant_adjustment', 'daily_instant_pay', 'daily_lottery_card_transaction'
            ],
            revenue: [
                'entry_date', 'total_cash', 'cash_adjustment', 'business_credit_card',
                'credit_card_transaction_fees', 'online_sales', 'online_net', 'sales_tax_amount',
                'customer_tab', 'other_cash_expense'
            ],
            cashflow: [
                'entry_date', 'ending_cash_on_hand', 'beginning_cash',
                'business_daily_cash', 'payroll_paid'
            ]
        };
        
        const fields = fieldsByType[dataType] || [];
        
        res.json({ fields: fields.map(field => ({
            name: field,
            label: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            type: field.includes('date') ? 'date' : 'number',
            required: field === 'entry_date'
        })) });
    } catch (error) {
        console.error('Get available fields error:', error);
        res.status(500).json({ error: 'Failed to fetch available fields' });
    }
});

// ============================================
// DATA FLOW CONFIGURATION
// ============================================

// Get data flow configuration (where data goes)
router.get('/data-flow', async (req, res) => {
    try {
        // Get all integrations and their target tables
        const result = await query(`
            SELECT 
                sgs.id,
                sgs.store_id,
                s.name as store_name,
                sgs.data_type,
                sgs.column_mapping,
                CASE 
                    WHEN sgs.data_type = 'lottery' THEN 'daily_lottery'
                    WHEN sgs.data_type = 'lottery_weekly' THEN 'weekly_lottery'
                    WHEN sgs.data_type = 'revenue' THEN 'daily_revenue'
                    WHEN sgs.data_type = 'cashflow' THEN 'daily_cash_flow'
                    ELSE 'unknown'
                END as target_table
            FROM store_google_sheets sgs
            JOIN stores s ON s.id = sgs.store_id
            ORDER BY s.name, sgs.data_type
        `);
        
        res.json({ dataFlows: result.rows });
    } catch (error) {
        console.error('Get data flow error:', error);
        res.status(500).json({ error: 'Failed to fetch data flow configuration' });
    }
});

// Update data flow target
router.put('/data-flow/:mappingId', async (req, res) => {
    try {
        const { target_table, data_transformation } = req.body;
        
        // Store transformation rules in a separate table or in column_mapping metadata
        // For now, we'll update the mapping with transformation rules
        const mapping = await StoreGoogleSheet.findById(req.params.mappingId);
        if (!mapping) {
            return res.status(404).json({ error: 'Mapping not found' });
        }
        
        const updatedMapping = {
            ...mapping.column_mapping,
            _metadata: {
                target_table,
                transformation: data_transformation || {}
            }
        };
        
        await query(`
            UPDATE store_google_sheets
            SET column_mapping = $1::jsonb,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [JSON.stringify(updatedMapping), req.params.mappingId]);
        
        res.json({ message: 'Data flow updated successfully' });
    } catch (error) {
        console.error('Update data flow error:', error);
        res.status(500).json({ error: 'Failed to update data flow' });
    }
});

// ============================================
// INTEGRATION SOURCE MANAGEMENT
// ============================================

// Get all integration sources
router.get('/integration-sources', async (req, res) => {
    try {
        // Get Google Sheets integrations
        const sheetsResult = await query(`
            SELECT 
                'google_sheets' as source_type,
                sgs.id,
                sgs.store_id,
                s.name as store_name,
                sgs.data_type,
                sgs.spreadsheet_id,
                sgs.sheet_name,
                sgs.auto_sync_enabled,
                sgs.last_sync_at,
                sgs.last_sync_status
            FROM store_google_sheets sgs
            JOIN stores s ON s.id = sgs.store_id
        `);
        
        // Get Gmail integrations (if exists)
        const gmailResult = await query(`
            SELECT 
                'gmail' as source_type,
                gel.id,
                gel.store_id,
                s.name as store_name,
                gel.data_type,
                gel.email_address as source_identifier,
                gel.auto_sync_enabled,
                gel.last_sync_at,
                gel.last_sync_status
            FROM store_gmail_integrations gel
            JOIN stores s ON s.id = gel.store_id
        `).catch(() => ({ rows: [] })); // Handle if table doesn't exist yet
        
        res.json({
            sources: [
                ...sheetsResult.rows,
                ...gmailResult.rows
            ]
        });
    } catch (error) {
        console.error('Get integration sources error:', error);
        res.status(500).json({ error: 'Failed to fetch integration sources' });
    }
});

// Test data source connection
router.post('/integration-sources/:sourceId/test', async (req, res) => {
    try {
        const sourceId = req.params.sourceId;
        const { sourceType } = req.body;
        
        if (sourceType === 'google_sheets') {
            const mapping = await StoreGoogleSheet.findById(sourceId);
            if (!mapping) {
                return res.status(404).json({ error: 'Source not found' });
            }
            
            // Test connection
            const GoogleSheetsService = require('../services/googleSheets');
            const sheetsService = new GoogleSheetsService(mapping.service_account_key);
            
            try {
                const headers = await sheetsService.getHeaders(mapping.spreadsheet_id, mapping.sheet_name);
                res.json({
                    success: true,
                    message: 'Connection successful',
                    headers: headers.slice(0, 10) // First 10 columns
                });
            } catch (testError) {
                res.json({
                    success: false,
                    message: testError.message || 'Connection failed'
                });
            }
        } else {
            res.status(400).json({ error: 'Source type not supported for testing' });
        }
    } catch (error) {
        console.error('Test connection error:', error);
        res.status(500).json({ error: 'Failed to test connection' });
    }
});

// ============================================
// FORM TEMPLATE MANAGEMENT
// ============================================

// Get all form templates
router.get('/form-templates', async (req, res) => {
    try {
        const templates = await FormTemplate.findAll();
        res.json({ templates });
    } catch (error) {
        console.error('Get form templates error:', error);
        res.status(500).json({ error: 'Failed to fetch form templates' });
    }
});

// Get form template with full configuration
router.get('/form-templates/:templateId', async (req, res) => {
    try {
        const { templateId } = req.params;
        const storeId = req.query.store_id || null;
        
        const config = await FormTemplate.getFullConfiguration(templateId, storeId);
        if (!config) {
            return res.status(404).json({ error: 'Form template not found' });
        }
        
        res.json({ configuration: config });
    } catch (error) {
        console.error('Get form template error:', error);
        res.status(500).json({ error: 'Failed to fetch form template' });
    }
});

// Create or update form template
router.post('/form-templates', async (req, res) => {
    try {
        const template = await FormTemplate.upsert(req.body);
        res.json({ 
            message: 'Form template saved successfully',
            template 
        });
    } catch (error) {
        console.error('Save form template error:', error);
        res.status(500).json({ error: 'Failed to save form template' });
    }
});

// Delete form template
router.delete('/form-templates/:templateId', async (req, res) => {
    try {
        await FormTemplate.delete(req.params.templateId);
        res.json({ message: 'Form template deleted successfully' });
    } catch (error) {
        console.error('Delete form template error:', error);
        res.status(500).json({ error: 'Failed to delete form template' });
    }
});

// ============================================
// FORM FIELDS MANAGEMENT
// ============================================

// Get fields for a form template
router.get('/form-templates/:templateId/fields', async (req, res) => {
    try {
        const { templateId } = req.params;
        const storeId = req.query.store_id || null;
        
        const fields = await FormField.findByTemplate(templateId, storeId);
        res.json({ fields });
    } catch (error) {
        console.error('Get form fields error:', error);
        res.status(500).json({ error: 'Failed to fetch form fields' });
    }
});

// Create or update form field
router.post('/form-fields', async (req, res) => {
    try {
        const field = await FormField.upsert(req.body);
        res.json({ 
            message: 'Form field saved successfully',
            field 
        });
    } catch (error) {
        console.error('Save form field error:', error);
        res.status(500).json({ error: 'Failed to save form field' });
    }
});

// Bulk update form fields
router.post('/form-templates/:templateId/fields/bulk', async (req, res) => {
    try {
        const { templateId } = req.params;
        const { fields } = req.body;
        
        // Ensure all fields have the template ID
        const fieldsWithTemplate = fields.map(f => ({
            ...f,
            form_template_id: templateId
        }));
        
        const results = await FormField.bulkUpsert(fieldsWithTemplate);
        res.json({ 
            message: 'Form fields saved successfully',
            fields: results 
        });
    } catch (error) {
        console.error('Bulk save form fields error:', error);
        res.status(500).json({ error: 'Failed to save form fields' });
    }
});

// Delete form field
router.delete('/form-fields/:fieldId', async (req, res) => {
    try {
        await FormField.delete(req.params.fieldId);
        res.json({ message: 'Form field deleted successfully' });
    } catch (error) {
        console.error('Delete form field error:', error);
        res.status(500).json({ error: 'Failed to delete form field' });
    }
});

// ============================================
// CALCULATED FIELDS MANAGEMENT
// ============================================

// Get calculated fields for a form template
router.get('/form-templates/:templateId/calculated-fields', async (req, res) => {
    try {
        const { templateId } = req.params;
        const storeId = req.query.store_id || null;
        
        const calculatedFields = await CalculatedField.findByTemplate(templateId, storeId);
        res.json({ calculatedFields });
    } catch (error) {
        console.error('Get calculated fields error:', error);
        res.status(500).json({ error: 'Failed to fetch calculated fields' });
    }
});

// Create or update calculated field
router.post('/calculated-fields', async (req, res) => {
    try {
        const calculatedField = await CalculatedField.upsert(req.body);
        res.json({ 
            message: 'Calculated field saved successfully',
            calculatedField 
        });
    } catch (error) {
        console.error('Save calculated field error:', error);
        res.status(500).json({ error: 'Failed to save calculated field' });
    }
});

// Delete calculated field
router.delete('/calculated-fields/:fieldId', async (req, res) => {
    try {
        await CalculatedField.delete(req.params.fieldId);
        res.json({ message: 'Calculated field deleted successfully' });
    } catch (error) {
        console.error('Delete calculated field error:', error);
        res.status(500).json({ error: 'Failed to delete calculated field' });
    }
});

// Test calculation formula
router.post('/calculated-fields/test-formula', async (req, res) => {
    try {
        const { formula, fieldValues } = req.body;
        
        const result = CalculatedField.evaluateFormula(formula, fieldValues);
        res.json({ 
            result,
            message: 'Formula evaluated successfully'
        });
    } catch (error) {
        console.error('Test formula error:', error);
        res.status(500).json({ error: 'Failed to evaluate formula' });
    }
});

module.exports = router;

