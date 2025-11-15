const express = require('express');
const CashDrawerCalculationConfig = require('../models/CashDrawerCalculationConfig');
const FormTemplate = require('../models/FormTemplate');
const FormField = require('../models/FormField');
const CalculatedField = require('../models/CalculatedField');
const { authenticate, authorize } = require('../middleware/auth');

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

