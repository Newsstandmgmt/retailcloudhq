const { query } = require('../config/database');

class TaxConfiguration {
    constructor(data) {
        Object.assign(this, data);
    }

    // Create or update tax configuration
    static async upsert(storeId, taxData) {
        const { state, tax_type, tax_rate, is_active = true, tax_applicable_to = 'customer', is_inclusive = false } = taxData;
        
        const result = await query(
            `INSERT INTO tax_configurations (store_id, state, tax_type, tax_rate, is_active, tax_applicable_to, is_inclusive)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (store_id, state, tax_type) DO UPDATE SET
                 tax_rate = EXCLUDED.tax_rate,
                 is_active = EXCLUDED.is_active,
                 tax_applicable_to = EXCLUDED.tax_applicable_to,
                 is_inclusive = EXCLUDED.is_inclusive,
                 updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [storeId, state, tax_type, tax_rate, is_active, tax_applicable_to, is_inclusive]
        );
        
        return result.rows[0];
    }


    // Get tax configurations by state
    static async findByStoreAndState(storeId, state, applicableTo = null) {
        let sql = 'SELECT * FROM tax_configurations WHERE store_id = $1 AND state = $2 AND is_active = true';
        const params = [storeId, state];
        
        if (applicableTo) {
            sql += ' AND tax_applicable_to = $3';
            params.push(applicableTo);
        }
        
        sql += ' ORDER BY tax_type';
        const result = await query(sql, params);
        return result.rows;
    }
    
    // Get tax configurations with optional filter by applicable_to
    static async findByStore(storeId, applicableTo = null) {
        let sql = 'SELECT * FROM tax_configurations WHERE store_id = $1 AND is_active = true';
        const params = [storeId];
        
        if (applicableTo) {
            sql += ' AND tax_applicable_to = $2';
            params.push(applicableTo);
        }
        
        sql += ' ORDER BY state, tax_type';
        const result = await query(sql, params);
        return result.rows;
    }

    // Delete tax configuration
    static async delete(id) {
        const result = await query(
            'UPDATE tax_configurations SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0] || null;
    }
}

module.exports = TaxConfiguration;

