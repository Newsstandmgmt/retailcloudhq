const { query } = require('../config/database');

class CashDrawerCalculationConfig {
    constructor(data) {
        Object.assign(this, data);
    }
    
    // Get configuration for a store (store-specific or default)
    static async getForStore(storeId) {
        // First try to get store-specific config
        let result = await query(
            `SELECT * FROM cash_drawer_calculation_config 
             WHERE store_id = $1 AND config_type = 'store'`,
            [storeId]
        );
        
        if (result.rows.length > 0) {
            return result.rows[0];
        }
        
        // Fall back to default config
        result = await query(
            `SELECT * FROM cash_drawer_calculation_config 
             WHERE config_type = 'default' AND store_id IS NULL
             LIMIT 1`
        );
        
        return result.rows[0] || null;
    }
    
    // Get default configuration
    static async getDefault() {
        const result = await query(
            `SELECT * FROM cash_drawer_calculation_config 
             WHERE config_type = 'default' AND store_id IS NULL
             LIMIT 1`
        );
        return result.rows[0] || null;
    }
    
    // Get configuration by store (alias for getForStore)
    static async findByStore(storeId) {
        return await this.getForStore(storeId);
    }
    
    // Get all configurations
    static async findAll() {
        const result = await query(
            `SELECT 
                c.*,
                s.name as store_name
             FROM cash_drawer_calculation_config c
             LEFT JOIN stores s ON s.id = c.store_id
             ORDER BY c.config_type, s.name`
        );
        return result.rows;
    }
    
    // Create or update configuration
    static async upsert(storeId, configData) {
        const {
            config_type = storeId ? 'store' : 'default',
            combined_drawer_formula,
            lottery_owed_formula,
            field_visibility,
            business_fields_config,
            lottery_fields_config
        } = configData;
        
        // Check if config exists
        const existing = await query(
            `SELECT id FROM cash_drawer_calculation_config 
             WHERE (store_id = $1 OR (store_id IS NULL AND $1 IS NULL)) AND config_type = $2`,
            [storeId, config_type]
        );
        
        if (existing.rows.length > 0) {
            // Update
            const updates = [];
            const values = [];
            let paramCount = 1;
            
            if (combined_drawer_formula !== undefined) {
                updates.push(`combined_drawer_formula = $${paramCount}`);
                values.push(typeof combined_drawer_formula === 'string' 
                    ? JSON.parse(combined_drawer_formula) 
                    : combined_drawer_formula);
                paramCount++;
            }
            
            if (business_fields_config !== undefined) {
                updates.push(`business_fields_config = $${paramCount}`);
                values.push(typeof business_fields_config === 'string'
                    ? JSON.parse(business_fields_config)
                    : business_fields_config);
                paramCount++;
            }
            
            if (lottery_fields_config !== undefined) {
                updates.push(`lottery_fields_config = $${paramCount}`);
                values.push(typeof lottery_fields_config === 'string'
                    ? JSON.parse(lottery_fields_config)
                    : lottery_fields_config);
                paramCount++;
            }
            
            if (lottery_owed_formula !== undefined) {
                updates.push(`lottery_owed_formula = $${paramCount}`);
                values.push(typeof lottery_owed_formula === 'string'
                    ? JSON.parse(lottery_owed_formula)
                    : lottery_owed_formula);
                paramCount++;
            }
            
            if (field_visibility !== undefined) {
                updates.push(`field_visibility = $${paramCount}`);
                values.push(typeof field_visibility === 'string'
                    ? JSON.parse(field_visibility)
                    : field_visibility);
                paramCount++;
            }
            
            if (updates.length === 0) {
                return existing.rows[0];
            }
            
            values.push(storeId, config_type);
            
            const result = await query(
                `UPDATE cash_drawer_calculation_config 
                 SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
                 WHERE (store_id = $${paramCount} OR (store_id IS NULL AND $${paramCount} IS NULL)) 
                 AND config_type = $${paramCount + 1}
                 RETURNING *`,
                values
            );
            
            return result.rows[0];
        } else {
            // Insert
            const result = await query(
                `INSERT INTO cash_drawer_calculation_config 
                 (store_id, config_type, combined_drawer_formula, business_fields_config, lottery_fields_config)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [
                    storeId,
                    config_type,
                    combined_drawer_formula || null,
                    business_fields_config || null,
                    lottery_fields_config || null
                ]
            );
            
            return result.rows[0];
        }
    }
    
    // Calculate business cash for combined drawer
    static async calculateBusinessCash(storeId, entryDate, revenueData, lotteryData) {
        // Get store and config
        const Store = require('./Store');
        const store = await Store.findById(storeId);
        
        if (!store || store.cash_drawer_type !== 'same') {
            // Separate drawers - return revenue cash directly
            return parseFloat(revenueData.total_cash || 0);
        }
        
        // Combined drawer - use formula
        const config = await this.getForStore(storeId);
        
        if (!config || !config.combined_drawer_formula) {
            // Fallback to default calculation
            const totalCash = parseFloat(revenueData.total_cash || 0);
            const lotterySales = parseFloat(lotteryData?.daily_instant_sales || 0);
            const lotteryPay = parseFloat(lotteryData?.daily_instant_pay || 0);
            const lotteryAdjustment = parseFloat(lotteryData?.daily_instant_adjustment || 0);
            
            return totalCash - lotterySales - lotteryPay - lotteryAdjustment;
        }
        
        // Use configured formula
        const formula = config.combined_drawer_formula;
        const fields = formula.fields || {};

        let businessCash = 0; // Start from 0

        // Apply formula based on operation type
        Object.keys(fields).forEach(fieldKey => {
            const fieldConfig = fields[fieldKey];
            let value = 0;

            if (fieldConfig.source === 'lottery' && lotteryData) {
                value = parseFloat(lotteryData[fieldConfig.field] || fieldConfig.default || 0);
            } else if (fieldConfig.source === 'revenue' && revenueData) {
                value = parseFloat(revenueData[fieldConfig.field] || fieldConfig.default || 0);
            }

            // Apply operation based on field configuration
            const operation = fieldConfig.operation || 'add';
            
            if (operation === 'ignore') {
                // Do nothing - skip this field
                return;
            } else if (operation === 'add') {
                businessCash += value;
            } else if (operation === 'subtract') {
                businessCash -= value;
            } else if (operation === 'add_if_positive_subtract_if_negative') {
                // Cash adjustment: add if positive, subtract if negative (value already has sign)
                businessCash += value;
            } else if (operation === 'subtract_if_positive_add_if_negative') {
                // Instant adjustment: subtract if positive, add if negative (reverse the sign)
                businessCash -= value;
            }
        });

        return businessCash; // Can be negative if adjustments are larger than cash
    }
    
    // Calculate daily lottery cash owed to lottery
    static async calculateLotteryOwed(storeId, entryDate, revenueData) {
        // Get store and config
        const Store = require('./Store');
        const store = await Store.findById(storeId);
        
        if (!store || store.cash_drawer_type !== 'same') {
            // Separate drawers - lottery cash is tracked separately
            return 0; // Or return actual lottery cash if tracked separately
        }
        
        // Combined drawer - use formula
        const config = await this.getForStore(storeId);
        
        if (!config || !config.lottery_owed_formula) {
            // Fallback calculation
            const onlineNet = parseFloat(revenueData.online_net || 0);
            const totalInstant = parseFloat(revenueData.total_instant || 0);
            const instantPay = parseFloat(revenueData.instant_pay || 0);
            const instantAdjustment = parseFloat(revenueData.total_instant_adjustment || 0);
            const lotteryCreditCard = parseFloat(revenueData.lottery_credit_card || 0);
            
            return onlineNet + totalInstant - instantPay + instantAdjustment - lotteryCreditCard;
        }
        
        // Use configured formula
        const formula = config.lottery_owed_formula;
        const fields = formula.fields || {};
        
        let lotteryOwed = 0; // Start from 0
        
        // Apply formula based on operation type
        Object.keys(fields).forEach(fieldKey => {
            const fieldConfig = fields[fieldKey];
            let value = 0;
            
            if (fieldConfig.source === 'revenue' && revenueData) {
                value = parseFloat(revenueData[fieldConfig.field] || fieldConfig.default || 0);
            }
            
            // Apply operation based on field configuration
            const operation = fieldConfig.operation || 'add';
            
            if (operation === 'ignore') {
                // Do nothing - skip this field
                return;
            } else if (operation === 'add') {
                lotteryOwed += value;
            } else if (operation === 'subtract') {
                lotteryOwed -= value;
            } else if (operation === 'add_if_positive_subtract_if_negative') {
                // Instant adjustment: add if positive, subtract if negative (value already has sign)
                lotteryOwed += value;
            }
        });
        
        return lotteryOwed;
    }
}

module.exports = CashDrawerCalculationConfig;

