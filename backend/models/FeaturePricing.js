const { query } = require('../config/database');

class FeaturePricing {
    constructor(data) {
        Object.assign(this, data);
    }

    // Create or update feature pricing
    static async upsert(featureKey, priceData) {
        const { price_per_month, is_active } = priceData;
        
        const result = await query(
            `INSERT INTO feature_pricing (feature_key, price_per_month, is_active)
             VALUES ($1, $2, $3)
             ON CONFLICT (feature_key) DO UPDATE SET
                 price_per_month = EXCLUDED.price_per_month,
                 is_active = EXCLUDED.is_active,
                 updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [featureKey, price_per_month, is_active !== undefined ? is_active : true]
        );
        
        return result.rows[0];
    }

    // Find pricing by feature key
    static async findByFeatureKey(featureKey) {
        const result = await query(
            `SELECT fp.*, sf.feature_name, sf.description as feature_description
             FROM feature_pricing fp
             JOIN store_features sf ON sf.feature_key = fp.feature_key
             WHERE fp.feature_key = $1 AND fp.is_active = true`,
            [featureKey]
        );
        return result.rows[0] || null;
    }

    // Get all feature pricing
    static async findAll() {
        const result = await query(
            `SELECT fp.*, sf.feature_name, sf.description as feature_description, sf.category
             FROM feature_pricing fp
             JOIN store_features sf ON sf.feature_key = fp.feature_key
             WHERE fp.is_active = true
             ORDER BY sf.category, sf.feature_name`
        );
        return result.rows;
    }

    // Update feature pricing
    static async update(featureKey, updateData) {
        const { price_per_month, is_active } = updateData;
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (price_per_month !== undefined) {
            updates.push(`price_per_month = $${paramCount}`);
            values.push(price_per_month);
            paramCount++;
        }

        if (is_active !== undefined) {
            updates.push(`is_active = $${paramCount}`);
            values.push(is_active);
            paramCount++;
        }

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        values.push(featureKey);
        const result = await query(
            `UPDATE feature_pricing SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE feature_key = $${paramCount}
             RETURNING *`,
            values
        );

        return result.rows[0] || null;
    }

    // Get pricing for multiple features
    static async getPricingForFeatures(featureKeys) {
        if (!featureKeys || featureKeys.length === 0) {
            return [];
        }

        try {
            const result = await query(
                `SELECT fp.*, sf.feature_name
                 FROM feature_pricing fp
                 JOIN store_features sf ON sf.feature_key = fp.feature_key
                 WHERE fp.feature_key = ANY($1) AND fp.is_active = true`,
                [featureKeys]
            );
            return result.rows;
        } catch (error) {
            console.error('Error fetching pricing for features:', featureKeys, error);
            // Return empty array if pricing query fails - features might not have pricing set
            return [];
        }
    }

    // Calculate total price for features
    static async calculateFeatureAddonsTotal(featureKeys) {
        if (!featureKeys || featureKeys.length === 0) {
            return 0;
        }

        const pricing = await this.getPricingForFeatures(featureKeys);
        return pricing.reduce((total, p) => total + parseFloat(p.price_per_month || 0), 0);
    }
}

module.exports = FeaturePricing;

