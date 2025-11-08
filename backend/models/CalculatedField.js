const { query } = require('../config/database');

class CalculatedField {
    constructor(data) {
        Object.assign(this, data);
    }
    
    // Get calculated fields for a form template
    static async findByTemplate(formTemplateId, storeId = null) {
        let queryStr = `
            SELECT * FROM calculated_fields 
            WHERE form_template_id = $1
        `;
        const params = [formTemplateId];
        
        if (storeId) {
            queryStr += ` AND (store_id = $2 OR store_id IS NULL)`;
            params.push(storeId);
        } else {
            queryStr += ` AND store_id IS NULL`;
        }
        
        queryStr += ` ORDER BY display_order, field_label`;
        
        const result = await query(queryStr, params);
        return result.rows;
    }
    
    // Get calculated field by ID
    static async findById(id) {
        const result = await query(
            'SELECT * FROM calculated_fields WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }
    
    // Create or update calculated field
    static async upsert(calcFieldData) {
        const {
            id,
            form_template_id,
            store_id,
            field_key,
            field_label,
            field_group,
            calculation_formula,
            input_fields,
            operation_type,
            display_order,
            is_visible,
            format_type
        } = calcFieldData;
        
        if (id) {
            // Update
            const result = await query(
                `UPDATE calculated_fields 
                 SET field_label = $1, field_group = $2, calculation_formula = $3,
                     input_fields = $4, operation_type = $5, display_order = $6,
                     is_visible = $7, format_type = $8, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $9
                 RETURNING *`,
                [
                    field_label, field_group, calculation_formula,
                    input_fields, operation_type, display_order,
                    is_visible, format_type, id
                ]
            );
            return result.rows[0];
        } else {
            // Insert
            const result = await query(
                `INSERT INTO calculated_fields (
                    form_template_id, store_id, field_key, field_label, field_group,
                    calculation_formula, input_fields, operation_type,
                    display_order, is_visible, format_type
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *`,
                [
                    form_template_id, store_id || null, field_key, field_label, field_group,
                    calculation_formula, input_fields, operation_type,
                    display_order, is_visible, format_type
                ]
            );
            return result.rows[0];
        }
    }
    
    // Delete calculated field
    static async delete(id) {
        const result = await query(
            'DELETE FROM calculated_fields WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }
    
    // Evaluate calculation formula
    static evaluateFormula(formula, fieldValues) {
        try {
            // Replace field keys with their values
            let expression = formula;
            for (const [key, value] of Object.entries(fieldValues)) {
                const regex = new RegExp(`\\b${key}\\b`, 'g');
                expression = expression.replace(regex, value || 0);
            }
            
            // Evaluate the expression (safely)
            // Note: In production, use a safer expression evaluator
            const result = Function(`"use strict"; return (${expression})`)();
            return parseFloat(result) || 0;
        } catch (error) {
            console.error('Error evaluating formula:', error);
            return 0;
        }
    }
}

module.exports = CalculatedField;

