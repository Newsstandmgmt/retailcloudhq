const { query } = require('../config/database');

class StoreTemplate {
    constructor(data) {
        Object.assign(this, data);
    }

    // Get all templates
    static async findAll() {
        const result = await query(
            `SELECT * FROM store_templates 
             WHERE is_active = true 
             ORDER BY name`
        );
        return result.rows;
    }

    // Get template by ID
    static async findById(id) {
        const result = await query(
            `SELECT * FROM store_templates WHERE id = $1`,
            [id]
        );
        return result.rows[0] || null;
    }

    // Get template by name
    static async findByName(name) {
        const result = await query(
            `SELECT * FROM store_templates WHERE name = $1 AND is_active = true`,
            [name]
        );
        return result.rows[0] || null;
    }

    // Create template (now with pricing like subscription plans)
    static async create(templateData) {
        const { name, description, price_per_month, billing_cycle } = templateData;
        const result = await query(
            `INSERT INTO store_templates (name, description, price_per_month, billing_cycle)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name, description || null, price_per_month || 0, billing_cycle || 'monthly']
        );
        return result.rows[0];
    }

    // Update template
    static async update(id, templateData) {
        const { name, description, is_active, price_per_month, billing_cycle } = templateData;
        const updates = [];
        const values = [];
        let paramCount = 0;

        if (name !== undefined) {
            paramCount++;
            updates.push(`name = $${paramCount}`);
            values.push(name);
        }
        if (description !== undefined) {
            paramCount++;
            updates.push(`description = $${paramCount}`);
            values.push(description);
        }
        if (is_active !== undefined) {
            paramCount++;
            updates.push(`is_active = $${paramCount}`);
            values.push(is_active);
        }
        if (price_per_month !== undefined) {
            paramCount++;
            updates.push(`price_per_month = $${paramCount}`);
            values.push(price_per_month);
        }
        if (billing_cycle !== undefined) {
            paramCount++;
            updates.push(`billing_cycle = $${paramCount}`);
            values.push(billing_cycle);
        }

        if (updates.length === 0) {
            return await this.findById(id);
        }

        paramCount++;
        values.push(id);
        // Don't add updated_at to updates array - it's already handled in the SQL

        const result = await query(
            `UPDATE store_templates 
             SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${paramCount}
             RETURNING *`,
            values
        );
        return result.rows[0] || null;
    }

    // Get features for a template
    static async getFeatures(templateId) {
        const result = await query(
            `SELECT sf.*
             FROM store_features sf
             JOIN store_template_features stf ON sf.id = stf.feature_id
             WHERE stf.template_id = $1
             AND sf.is_active = true
             ORDER BY sf.category, sf.feature_name`,
            [templateId]
        );
        return result.rows;
    }

    // Get feature keys for a template (for easy checking)
    static async getFeatureKeys(templateId) {
        const result = await query(
            `SELECT sf.feature_key
             FROM store_features sf
             JOIN store_template_features stf ON sf.id = stf.feature_id
             WHERE stf.template_id = $1
             AND sf.is_active = true`,
            [templateId]
        );
        return result.rows.map(row => row.feature_key);
    }

    // Add feature to template
    static async addFeature(templateId, featureId) {
        const result = await query(
            `INSERT INTO store_template_features (template_id, feature_id)
             VALUES ($1, $2)
             ON CONFLICT (template_id, feature_id) DO NOTHING
             RETURNING *`,
            [templateId, featureId]
        );
        return result.rows[0] || null;
    }

    // Remove feature from template
    static async removeFeature(templateId, featureId) {
        const result = await query(
            `DELETE FROM store_template_features
             WHERE template_id = $1 AND feature_id = $2
             RETURNING *`,
            [templateId, featureId]
        );
        return result.rows[0] || null;
    }

    // Get all available features
    static async getAllFeatures() {
        const result = await query(
            `SELECT * FROM store_features 
             WHERE is_active = true 
             ORDER BY category, feature_name`
        );
        return result.rows;
    }

    // Create a new feature
    static async createFeature(featureData) {
        const { feature_key, feature_name, description, category } = featureData;
        
        const result = await query(
            `INSERT INTO store_features (feature_key, feature_name, description, category)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (feature_key) DO NOTHING
             RETURNING *`,
            [feature_key, feature_name, description || null, category || null]
        );
        
        return result.rows[0] || null;
    }

    // Get template with features
    static async findWithFeatures(templateId) {
        try {
            const template = await this.findById(templateId);
            if (!template) return null;

            try {
                template.features = await this.getFeatures(templateId);
                template.feature_keys = await this.getFeatureKeys(templateId);
            } catch (error) {
                console.error('Error fetching template features:', error);
                // Return template without features if feature fetching fails
                template.features = [];
                template.feature_keys = [];
            }

            return template;
        } catch (error) {
            console.error('Error in findWithFeatures:', error);
            throw error;
        }
    }
}

module.exports = StoreTemplate;

