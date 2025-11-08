const { query } = require('../config/database');

class FormField {
    constructor(data) {
        Object.assign(this, data);
    }
    
    // Get fields for a form template
    static async findByTemplate(formTemplateId, storeId = null) {
        let queryStr = `
            SELECT * FROM form_fields 
            WHERE form_template_id = $1
        `;
        const params = [formTemplateId];
        
        if (storeId) {
            queryStr += ` AND (store_id = $2 OR store_id IS NULL)`;
            params.push(storeId);
        } else {
            queryStr += ` AND store_id IS NULL`;
        }
        
        queryStr += ` ORDER BY field_group, display_order, field_label`;
        
        const result = await query(queryStr, params);
        return result.rows;
    }
    
    // Get field by ID
    static async findById(id) {
        const result = await query(
            'SELECT * FROM form_fields WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }
    
    // Create or update field
    static async upsert(fieldData) {
        const {
            id,
            form_template_id,
            store_id,
            field_key,
            field_label,
            field_type,
            field_group,
            is_required,
            is_visible,
            default_value,
            placeholder,
            help_text,
            options,
            calculation_formula,
            depends_on_fields,
            validation_rules,
            display_order
        } = fieldData;
        
        if (id) {
            // Update
            const result = await query(
                `UPDATE form_fields 
                 SET field_label = $1, field_type = $2, field_group = $3,
                     is_required = $4, is_visible = $5, default_value = $6,
                     placeholder = $7, help_text = $8, options = $9::jsonb,
                     calculation_formula = $10, depends_on_fields = $11,
                     validation_rules = $12::jsonb, display_order = $13,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $14
                 RETURNING *`,
                [
                    field_label, field_type, field_group,
                    is_required, is_visible, default_value,
                    placeholder, help_text, options ? JSON.stringify(options) : null,
                    calculation_formula, depends_on_fields,
                    validation_rules ? JSON.stringify(validation_rules) : null,
                    display_order, id
                ]
            );
            const field = result.rows[0];
            // Parse JSONB fields if they exist
            if (field.options && typeof field.options === 'string') {
                field.options = JSON.parse(field.options);
            }
            if (field.validation_rules && typeof field.validation_rules === 'string') {
                field.validation_rules = JSON.parse(field.validation_rules);
            }
            return field;
        } else {
            // Insert
            const result = await query(
                `INSERT INTO form_fields (
                    form_template_id, store_id, field_key, field_label, field_type,
                    field_group, is_required, is_visible, default_value, placeholder,
                    help_text, options, calculation_formula, depends_on_fields,
                    validation_rules, display_order
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15::jsonb, $16)
                RETURNING *`,
                [
                    form_template_id, store_id || null, field_key, field_label, field_type,
                    field_group, is_required, is_visible, default_value, placeholder,
                    help_text, options ? JSON.stringify(options) : null,
                    calculation_formula, depends_on_fields,
                    validation_rules ? JSON.stringify(validation_rules) : null,
                    display_order
                ]
            );
            const field = result.rows[0];
            // Parse JSONB fields if they exist
            if (field.options && typeof field.options === 'string') {
                field.options = JSON.parse(field.options);
            }
            if (field.validation_rules && typeof field.validation_rules === 'string') {
                field.validation_rules = JSON.parse(field.validation_rules);
            }
            return field;
        }
    }
    
    // Delete field
    static async delete(id) {
        const result = await query(
            'DELETE FROM form_fields WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }
    
    // Bulk update fields
    static async bulkUpsert(fields) {
        const results = [];
        for (const field of fields) {
            const result = await this.upsert(field);
            results.push(result);
        }
        return results;
    }
}

module.exports = FormField;

