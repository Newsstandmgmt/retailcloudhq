const { query } = require('../config/database');

class FormTemplate {
    constructor(data) {
        Object.assign(this, data);
    }
    
    // Get all form templates
    static async findAll() {
        const result = await query(
            `SELECT * FROM form_templates 
             WHERE is_active = true 
             ORDER BY display_name`
        );
        return result.rows;
    }
    
    // Get form template by ID
    static async findById(id) {
        const result = await query(
            'SELECT * FROM form_templates WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }
    
    // Get form template by name
    static async findByName(name) {
        const result = await query(
            'SELECT * FROM form_templates WHERE name = $1',
            [name]
        );
        return result.rows[0] || null;
    }
    
    // Get full form configuration (template + fields + calculated fields)
    static async getFullConfiguration(formTemplateId, storeId = null) {
        const template = await this.findById(formTemplateId);
        if (!template) {
            return null;
        }
        
        // Get fields (store-specific or global)
        let fieldsQuery = `
            SELECT * FROM form_fields 
            WHERE form_template_id = $1
        `;
        const fieldsParams = [formTemplateId];
        
        if (storeId) {
            // Get store-specific fields first, fallback to global
            fieldsQuery += ` AND (store_id = $2 OR store_id IS NULL)`;
            fieldsParams.push(storeId);
        } else {
            fieldsQuery += ` AND store_id IS NULL`;
        }
        
        fieldsQuery += ` ORDER BY field_group, display_order, field_label`;
        
        const fieldsResult = await query(fieldsQuery, fieldsParams);
        
        // Get calculated fields
        let calcQuery = `
            SELECT * FROM calculated_fields 
            WHERE form_template_id = $1
        `;
        const calcParams = [formTemplateId];
        
        if (storeId) {
            calcQuery += ` AND (store_id = $2 OR store_id IS NULL)`;
            calcParams.push(storeId);
        } else {
            calcQuery += ` AND store_id IS NULL`;
        }
        
        calcQuery += ` ORDER BY display_order, field_label`;
        
        const calcResult = await query(calcQuery, calcParams);
        
        return {
            template,
            fields: fieldsResult.rows,
            calculatedFields: calcResult.rows
        };
    }
    
    // Create or update form template
    static async upsert(templateData) {
        const {
            id,
            name,
            display_name,
            description,
            form_type,
            store_specific,
            is_active = true
        } = templateData;
        
        if (id) {
            // Update
            const result = await query(
                `UPDATE form_templates 
                 SET display_name = $1, description = $2, form_type = $3, 
                     store_specific = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $6
                 RETURNING *`,
                [display_name, description, form_type, store_specific, is_active, id]
            );
            return result.rows[0];
        } else {
            // Insert
            const result = await query(
                `INSERT INTO form_templates (name, display_name, description, form_type, store_specific, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [name, display_name, description, form_type, store_specific, is_active]
            );
            return result.rows[0];
        }
    }
    
    // Delete form template (soft delete)
    static async delete(id) {
        const result = await query(
            `UPDATE form_templates 
             SET is_active = false, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        return result.rows[0];
    }
}

module.exports = FormTemplate;

