const { query } = require('../config/database');
const StoreTemplate = require('../models/StoreTemplate');

/**
 * Service to check if features are enabled for a store
 */
class StoreFeatureService {
    /**
     * Get enabled features for a store
     * @param {string} storeId - Store UUID
     * @returns {Promise<Array<string>>} Array of enabled feature keys
     */
    static async getEnabledFeatures(storeId) {
        try {
            // First check if store has a template_id
            const storeResult = await query(
                `SELECT template_id, is_active FROM stores WHERE id = $1`,
                [storeId]
            );
            
            if (!storeResult.rows[0]) {
                return []; // Store doesn't exist
            }
            
            const store = storeResult.rows[0];
            if (!store.template_id) {
                return []; // Store has no template assigned
            }
            
            // Get features from template (regardless of store is_active status)
            const result = await query(
                `SELECT sf.feature_key
                 FROM store_features sf
                 JOIN store_template_features stf ON sf.id = stf.feature_id
                 WHERE stf.template_id = $1
                 AND sf.is_active = true`,
                [store.template_id]
            );
            
            // Also get addon features
            const addonResult = await query(
                `SELECT sf.feature_key
                 FROM store_features sf
                 JOIN store_feature_addons sfa ON sf.feature_key = sfa.feature_key
                 WHERE sfa.store_id = $1
                 AND sf.is_active = true`,
                [storeId]
            );
            
            const templateFeatures = result.rows.map(row => row.feature_key);
            const addonFeatures = addonResult.rows.map(row => row.feature_key);
            
            // Combine and deduplicate
            return [...new Set([...templateFeatures, ...addonFeatures])];
        } catch (error) {
            console.error('Error in getEnabledFeatures:', error);
            return [];
        }
    }

    /**
     * Check if a specific feature is enabled for a store
     * @param {string} storeId - Store UUID
     * @param {string} featureKey - Feature key to check (e.g., 'lottery', 'gas_station')
     * @returns {Promise<boolean>} True if feature is enabled
     */
    static async isFeatureEnabled(storeId, featureKey) {
        if (!storeId || !featureKey) return false;

        try {
            // Check template features
            const templateResult = await query(
                `SELECT COUNT(*) as count
                 FROM store_features sf
                 JOIN store_template_features stf ON sf.id = stf.feature_id
                 JOIN stores s ON s.template_id = stf.template_id
                 WHERE s.id = $1
                 AND sf.feature_key = $2
                 AND sf.is_active = true`,
                [storeId, featureKey]
            );
            
            if (parseInt(templateResult.rows[0]?.count || 0) > 0) {
                return true;
            }
            
            // Check addon features
            const addonResult = await query(
                `SELECT COUNT(*) as count
                 FROM store_feature_addons sfa
                 JOIN store_features sf ON sf.feature_key = sfa.feature_key
                 WHERE sfa.store_id = $1
                 AND sfa.feature_key = $2
                 AND sf.is_active = true`,
                [storeId, featureKey]
            );
            
            return parseInt(addonResult.rows[0]?.count || 0) > 0;
        } catch (error) {
            console.error('Error in isFeatureEnabled:', error);
            return false;
        }
    }

    /**
     * Check if multiple features are enabled
     * @param {string} storeId - Store UUID
     * @param {Array<string>} featureKeys - Array of feature keys to check
     * @returns {Promise<Object>} Object with feature keys as keys and boolean values
     */
    static async checkMultipleFeatures(storeId, featureKeys) {
        if (!storeId || !featureKeys || featureKeys.length === 0) {
            return {};
        }

        const result = await query(
            `SELECT sf.feature_key
             FROM store_features sf
             JOIN store_template_features stf ON sf.id = stf.feature_id
             JOIN stores s ON s.template_id = stf.template_id
             WHERE s.id = $1
             AND sf.feature_key = ANY($2)
             AND sf.is_active = true
             AND s.is_active = true`,
            [storeId, featureKeys]
        );

        const enabledFeatures = new Set(result.rows.map(row => row.feature_key));
        const features = {};
        featureKeys.forEach(key => {
            features[key] = enabledFeatures.has(key);
        });

        return features;
    }

    /**
     * Get store template info
     * @param {string} storeId - Store UUID
     * @returns {Promise<Object|null>} Template object with features
     */
    static async getStoreTemplate(storeId) {
        try {
            const result = await query(
                `SELECT s.template_id, st.name, st.description
                 FROM stores s
                 LEFT JOIN store_templates st ON s.template_id = st.id
                 WHERE s.id = $1`,
                [storeId]
            );

            if (!result.rows[0] || !result.rows[0].template_id) {
                return null;
            }

            try {
                return await StoreTemplate.findWithFeatures(result.rows[0].template_id);
            } catch (featuresError) {
                console.error('Error fetching template features in getStoreTemplate:', featuresError);
                // Return basic template info even if features fail to load
                return {
                    id: result.rows[0].template_id,
                    name: result.rows[0].name,
                    description: result.rows[0].description,
                    features: [],
                    feature_keys: []
                };
            }
        } catch (error) {
            console.error('Error in getStoreTemplate:', error);
            return null;
        }
    }
}

module.exports = StoreFeatureService;

