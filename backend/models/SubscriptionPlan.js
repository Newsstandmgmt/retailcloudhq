const { query } = require('../config/database');

class SubscriptionPlan {
    constructor(data) {
        Object.assign(this, data);
    }

    // Create subscription plan
    static async create(planData) {
        const { name, description, price_per_month, billing_cycle } = planData;
        
        const result = await query(
            `INSERT INTO subscription_plans (name, description, price_per_month, billing_cycle)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name, description || null, price_per_month, billing_cycle || 'monthly']
        );
        
        return result.rows[0];
    }

    // Find plan by ID
    static async findById(id) {
        const result = await query(
            'SELECT * FROM subscription_plans WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }

    // Get all plans
    static async findAll(activeOnly = false) {
        let sql = 'SELECT * FROM subscription_plans';
        if (activeOnly) {
            sql += ' WHERE is_active = true';
        }
        sql += ' ORDER BY price_per_month ASC';
        
        const result = await query(sql);
        return result.rows;
    }

    // Update plan
    static async update(id, updateData) {
        const allowedFields = ['name', 'description', 'price_per_month', 'billing_cycle', 'is_active'];
        const updates = [];
        const values = [];
        let paramCount = 1;

        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                updates.push(`${field} = $${paramCount}`);
                values.push(updateData[field]);
                paramCount++;
            }
        }

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        values.push(id);
        const result = await query(
            `UPDATE subscription_plans SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${paramCount}
             RETURNING *`,
            values
        );

        return result.rows[0] || null;
    }

    // Delete plan (soft delete)
    static async delete(id) {
        const result = await query(
            'UPDATE subscription_plans SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0] || null;
    }

    // Get features for a plan
    static async getFeatures(planId) {
        const result = await query(
            `SELECT sf.*, spf.created_at as added_at
             FROM store_features sf
             JOIN subscription_plan_features spf ON sf.feature_key = spf.feature_key
             WHERE spf.plan_id = $1
             AND sf.is_active = true
             ORDER BY sf.category, sf.feature_name`,
            [planId]
        );
        return result.rows;
    }

    // Get feature keys for a plan
    static async getFeatureKeys(planId) {
        const result = await query(
            `SELECT sf.feature_key
             FROM store_features sf
             JOIN subscription_plan_features spf ON sf.feature_key = spf.feature_key
             WHERE spf.plan_id = $1
             AND sf.is_active = true`,
            [planId]
        );
        return result.rows.map(row => row.feature_key);
    }

    // Add feature to plan
    static async addFeature(planId, featureKey) {
        const result = await query(
            `INSERT INTO subscription_plan_features (plan_id, feature_key)
             VALUES ($1, $2)
             ON CONFLICT (plan_id, feature_key) DO NOTHING
             RETURNING *`,
            [planId, featureKey]
        );
        return result.rows[0] || null;
    }

    // Remove feature from plan
    static async removeFeature(planId, featureKey) {
        const result = await query(
            `DELETE FROM subscription_plan_features
             WHERE plan_id = $1 AND feature_key = $2
             RETURNING *`,
            [planId, featureKey]
        );
        return result.rows[0] || null;
    }

    // Remove all features from plan
    static async removeAllFeatures(planId) {
        await query(
            'DELETE FROM subscription_plan_features WHERE plan_id = $1',
            [planId]
        );
    }

    // Get plan with features
    static async findWithFeatures(planId) {
        const plan = await this.findById(planId);
        if (!plan) return null;

        plan.features = await this.getFeatures(planId);
        plan.feature_keys = await this.getFeatureKeys(planId);

        return plan;
    }
}

module.exports = SubscriptionPlan;

