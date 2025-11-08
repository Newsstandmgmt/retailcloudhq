const { query } = require('../config/database');
const FeaturePricing = require('./FeaturePricing');

class StoreSubscription {
    constructor(data) {
        Object.assign(this, data);
    }

    // Calculate next billing date
    static calculateNextBillingDate(startDate, billingCycle) {
        const date = new Date(startDate);
        switch (billingCycle) {
            case 'monthly':
                date.setMonth(date.getMonth() + 1);
                break;
            case 'quarterly':
                date.setMonth(date.getMonth() + 3);
                break;
            case 'yearly':
                date.setFullYear(date.getFullYear() + 1);
                break;
            default:
                date.setMonth(date.getMonth() + 1);
        }
        return date.toISOString().split('T')[0];
    }

    // Calculate subscription price for a store based on its template and addons
    static async calculateStorePrice(storeId) {
        // Get store
        const Store = require('./Store');
        const store = await Store.findById(storeId);
        if (!store) {
            throw new Error('Store not found');
        }

        // Get template pricing (template is now the subscription plan)
        let basePrice = 0;
        let templateFeatureKeys = [];
        
        if (store.template_id) {
            const StoreTemplate = require('./StoreTemplate');
            const template = await StoreTemplate.findById(store.template_id);
            if (template) {
                basePrice = parseFloat(template.price_per_month || 0);
                templateFeatureKeys = await StoreTemplate.getFeatureKeys(store.template_id);
            }
        }

        // Get feature addons (individual features added beyond the template)
        // This includes manager_access if it's been added as a feature addon
        const addonFeatureKeys = await this.getAddonFeatures(storeId);
        
        // Calculate addon pricing (only for addon features, not template features)
        // Manager access is now a feature addon, so it's included in this calculation
        const featureAddonsTotal = await FeaturePricing.calculateFeatureAddonsTotal(addonFeatureKeys);

        // Calculate total (each store has its own base price + feature addons)
        const totalMonthlyPrice = basePrice + featureAddonsTotal;

        return {
            base_price: basePrice,
            feature_addons_total: featureAddonsTotal,
            total_monthly_price: totalMonthlyPrice,
            template_feature_keys: templateFeatureKeys,
            addon_feature_keys: addonFeatureKeys,
            all_feature_keys: [...templateFeatureKeys, ...addonFeatureKeys]
        };
    }

    // Get addon features for a store
    static async getAddonFeatures(storeId) {
        const result = await query(
            `SELECT feature_key FROM store_feature_addons WHERE store_id = $1`,
            [storeId]
        );
        return result.rows.map(row => row.feature_key);
    }

    // Add feature addon to store
    static async addFeatureAddon(storeId, featureKey, addedBy) {
        const result = await query(
            `INSERT INTO store_feature_addons (store_id, feature_key, added_by)
             VALUES ($1, $2, $3)
             ON CONFLICT (store_id, feature_key) DO NOTHING
             RETURNING *`,
            [storeId, featureKey, addedBy]
        );
        return result.rows[0] || null;
    }

    // Remove feature addon from store
    static async removeFeatureAddon(storeId, featureKey) {
        const result = await query(
            `DELETE FROM store_feature_addons
             WHERE store_id = $1 AND feature_key = $2
             RETURNING *`,
            [storeId, featureKey]
        );
        return result.rows[0] || null;
    }

    // Create or update store subscription
    static async upsert(storeId, subscriptionData) {
        const { 
            template_id,
            billing_cycle = 'monthly', 
            start_date, 
            discount_percentage = 0, 
            discount_amount = 0, 
            discount_applied_to_next_billing = false,
            auto_renew = true 
        } = subscriptionData;

        // First, update the store's template_id if provided
        if (template_id) {
            const Store = require('./Store');
            await Store.update(storeId, { template_id });
        }

        // Calculate pricing based on store's template and addons (now that template_id is set)
        const pricing = await this.calculateStorePrice(storeId);

        // Get billing cycle from template if not provided
        let finalBillingCycle = billing_cycle;
        if (template_id && billing_cycle === 'monthly') {
            const StoreTemplate = require('./StoreTemplate');
            const template = await StoreTemplate.findById(template_id);
            if (template && template.billing_cycle) {
                finalBillingCycle = template.billing_cycle;
            }
        }

        const nextBillingDate = start_date 
            ? this.calculateNextBillingDate(start_date, finalBillingCycle)
            : this.calculateNextBillingDate(new Date().toISOString().split('T')[0], finalBillingCycle);

        const startDate = start_date || new Date().toISOString().split('T')[0];

        const result = await query(
            `INSERT INTO store_subscriptions 
             (store_id, template_id, base_price, feature_addons_total, total_monthly_price, 
              billing_cycle, start_date, next_billing_date, discount_percentage, discount_amount,
              discount_applied_to_next_billing, auto_renew, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active')
             ON CONFLICT (store_id) DO UPDATE SET
                 template_id = EXCLUDED.template_id,
                 base_price = EXCLUDED.base_price,
                 feature_addons_total = EXCLUDED.feature_addons_total,
                 total_monthly_price = EXCLUDED.total_monthly_price,
                 billing_cycle = EXCLUDED.billing_cycle,
                 next_billing_date = EXCLUDED.next_billing_date,
                 discount_percentage = EXCLUDED.discount_percentage,
                 discount_amount = EXCLUDED.discount_amount,
                 discount_applied_to_next_billing = EXCLUDED.discount_applied_to_next_billing,
                 auto_renew = EXCLUDED.auto_renew,
                 updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [
                storeId, template_id, pricing.base_price, pricing.feature_addons_total,
                pricing.total_monthly_price, finalBillingCycle, startDate, nextBillingDate,
                discount_percentage, discount_amount, discount_applied_to_next_billing, auto_renew
            ]
        );

        const subscription = result.rows[0];

        // Update store subscription features (template features + addons)
        await this.updateStoreSubscriptionFeatures(subscription.id, pricing.all_feature_keys);

        return subscription;
    }

    // Update store subscription features
    static async updateStoreSubscriptionFeatures(subscriptionId, featureKeys) {
        // Delete existing features
        await query(
            'DELETE FROM store_subscription_features WHERE store_subscription_id = $1',
            [subscriptionId]
        );

        // Add new features with pricing
        if (featureKeys && featureKeys.length > 0) {
            const pricing = await FeaturePricing.getPricingForFeatures(featureKeys);
            
            for (const price of pricing) {
                await query(
                    `INSERT INTO store_subscription_features 
                     (store_subscription_id, feature_key, feature_price)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (store_subscription_id, feature_key) DO UPDATE SET
                         feature_price = EXCLUDED.feature_price`,
                    [subscriptionId, price.feature_key, price.price_per_month]
                );
            }
        }
    }

    // Recalculate subscription when store template changes
    static async recalculate(storeId) {
        const subscription = await this.findByStoreId(storeId);
        if (!subscription) {
            return null;
        }

        const pricing = await this.calculateStorePrice(storeId);
        
        const result = await query(
            `UPDATE store_subscriptions 
             SET base_price = $1,
                 feature_addons_total = $2,
                 total_monthly_price = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE store_id = $4
             RETURNING *`,
            [
                pricing.base_price, 
                pricing.feature_addons_total,
                pricing.total_monthly_price, 
                storeId
            ]
        );

        if (result.rows[0]) {
            await this.updateStoreSubscriptionFeatures(result.rows[0].id, pricing.all_feature_keys);
        }

        return result.rows[0] || null;
    }

    // Find subscription by store ID
    static async findByStoreId(storeId) {
        try {
            const result = await query(
                `SELECT ss.*, s.name as store_name, st.name as template_name, st.price_per_month as template_price
                 FROM store_subscriptions ss
                 LEFT JOIN stores s ON s.id = ss.store_id
                 LEFT JOIN store_templates st ON st.id = ss.template_id
                 WHERE ss.store_id = $1`,
                [storeId]
            );
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error in findByStoreId:', error);
            throw error;
        }
    }

    // Get all subscriptions
    static async findAll(filters = {}) {
        let sql = `SELECT ss.*, s.name as store_name, s.template_id,
                          st.name as template_name, st.price_per_month as template_price
                   FROM store_subscriptions ss
                   JOIN stores s ON s.id = ss.store_id
                   LEFT JOIN store_templates st ON st.id = ss.template_id
                   WHERE 1=1`;
        const params = [];
        let paramCount = 1;

        if (filters.status) {
            sql += ` AND ss.status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }

        sql += ' ORDER BY ss.next_billing_date ASC';

        const result = await query(sql, params);
        return result.rows;
    }

    // Get subscription with features (template features + addons)
    static async findWithFeatures(storeId) {
        try {
            const subscription = await this.findByStoreId(storeId);
            if (!subscription) {
                return null;
            }

            // Template name is already fetched in findByStoreId via JOIN
            // If not present, fetch it separately
            if (subscription.template_id && !subscription.template_name) {
                const StoreTemplate = require('./StoreTemplate');
                try {
                    const template = await StoreTemplate.findById(subscription.template_id);
                    if (template) {
                        subscription.template_name = template.name;
                    }
                } catch (error) {
                    console.error('Error fetching template name:', error);
                    subscription.template_name = 'Unknown Template';
                }
            }

            // Get template features
            const StoreTemplate = require('./StoreTemplate');
            let templateFeatures = [];
            if (subscription.template_id) {
                try {
                    templateFeatures = await StoreTemplate.getFeatures(subscription.template_id);
                } catch (error) {
                    console.error('Error fetching template features for template_id:', subscription.template_id, error);
                    console.error('Error stack:', error.stack);
                    templateFeatures = [];
                }
            }

            // Get addon features
            let addonFeatureKeys = [];
            try {
                addonFeatureKeys = await this.getAddonFeatures(storeId);
            } catch (error) {
                console.error('Error fetching addon features for store:', storeId, error);
                console.error('Error stack:', error.stack);
                addonFeatureKeys = [];
            }

            const FeaturePricing = require('./FeaturePricing');
            
            // Get all features to match addon feature keys with feature details
            // We need to get all features from the store_features table
            const { query } = require('../config/database');
            let allStoreFeatures = [];
            try {
                const allStoreFeaturesResult = await query(
                    'SELECT * FROM store_features WHERE is_active = true ORDER BY category, feature_name'
                );
                allStoreFeatures = allStoreFeaturesResult.rows;
            } catch (error) {
                console.error('Error fetching all store features:', error);
                allStoreFeatures = [];
            }

            const addonFeatures = allStoreFeatures.filter(f => addonFeatureKeys.includes(f.feature_key));
            
            // Get pricing for addon features
            let addonPricing = [];
            if (addonFeatureKeys.length > 0) {
                try {
                    addonPricing = await FeaturePricing.getPricingForFeatures(addonFeatureKeys);
                } catch (error) {
                    console.error('Error fetching addon pricing:', error);
                    addonPricing = [];
                }
            }
            
            // Merge feature details with pricing
            const addonFeaturesWithPricing = addonFeatures.map(feature => {
              const pricing = addonPricing.find(p => p.feature_key === feature.feature_key);
              return {
                ...feature,
                price_per_month: pricing?.price_per_month || 0
              };
            });

            // Mark which features are from template vs addons
            const templateFeatureKeys = templateFeatures.map(f => f.feature_key);
            const allFeatures = [
                ...templateFeatures.map(f => ({ ...f, is_addon: false })),
                ...addonFeaturesWithPricing.map(f => ({ 
                    ...f, 
                    is_addon: true,
                    feature_name: f.feature_name || f.feature_key.replace(/_/g, ' ')
                }))
            ];

            subscription.features = allFeatures;
            subscription.template_feature_keys = templateFeatureKeys;
            subscription.addon_feature_keys = addonFeatureKeys;

            return subscription;
        } catch (error) {
            console.error('Error in findWithFeatures:', error);
            throw error;
        }
    }

    // Calculate invoice amount with discount
    static calculateInvoiceAmount(subscription) {
        let amount = parseFloat(subscription.total_monthly_price || 0);
        
        // Adjust amount based on billing cycle
        switch (subscription.billing_cycle) {
            case 'quarterly':
                amount = amount * 3;
                break;
            case 'yearly':
                amount = amount * 12;
                break;
            case 'monthly':
            default:
                break;
        }
        
        // Apply discount if set for next billing
        if (subscription.discount_applied_to_next_billing) {
            if (subscription.discount_percentage > 0) {
                amount = amount * (1 - subscription.discount_percentage / 100);
            }
            if (subscription.discount_amount > 0) {
                amount = amount - subscription.discount_amount;
            }
        }

        return Math.max(0, amount);
    }

    // Update next billing date after invoice generation
    static async updateNextBillingDate(storeId) {
        const subscription = await this.findByStoreId(storeId);
        if (!subscription) {
            return;
        }

        const nextBillingDate = this.calculateNextBillingDate(
            subscription.next_billing_date, 
            subscription.billing_cycle
        );

        await query(
            `UPDATE store_subscriptions 
             SET next_billing_date = $1, updated_at = CURRENT_TIMESTAMP
             WHERE store_id = $2`,
            [nextBillingDate, storeId]
        );
    }

    // Update discount
    static async updateDiscount(storeId, discountData) {
        const { 
            discount_percentage = 0, 
            discount_amount = 0, 
            discount_applied_to_next_billing = true,
            discount_start_date = null,
            discount_end_date = null
        } = discountData;

        const result = await query(
            `UPDATE store_subscriptions 
             SET discount_percentage = $1,
                 discount_amount = $2,
                 discount_applied_to_next_billing = $3,
                 discount_start_date = $4,
                 discount_end_date = $5,
                 updated_at = CURRENT_TIMESTAMP
             WHERE store_id = $6
             RETURNING *`,
            [discount_percentage, discount_amount, discount_applied_to_next_billing, discount_start_date, discount_end_date, storeId]
        );

        return result.rows[0] || null;
    }

    // Update status
    static async updateStatus(storeId, status) {
        const result = await query(
            `UPDATE store_subscriptions 
             SET status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE store_id = $2
             RETURNING *`,
            [status, storeId]
        );

        return result.rows[0] || null;
    }
}

module.exports = StoreSubscription;

