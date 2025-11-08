const { query } = require('../config/database');

class MonthlyUtilities {
    constructor(data) {
        Object.assign(this, data);
    }
    
    // Create or update monthly utilities entry
    static async upsert(storeId, entryMonth, utilitiesData) {
        const {
            utilities = 0,
            electric = 0,
            internet = 0,
            security_system = 0,
            tmobile_cellphone = 0,
            health_insurance = 0,
            other = 0,
            entered_by,
            notes
        } = utilitiesData;
        
        const result = await query(
            `INSERT INTO monthly_utilities (
                store_id, entry_month, utilities, electric, internet, security_system,
                tmobile_cellphone, health_insurance, other, entered_by, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (store_id, entry_month)
            DO UPDATE SET
                utilities = EXCLUDED.utilities,
                electric = EXCLUDED.electric,
                internet = EXCLUDED.internet,
                security_system = EXCLUDED.security_system,
                tmobile_cellphone = EXCLUDED.tmobile_cellphone,
                health_insurance = EXCLUDED.health_insurance,
                other = EXCLUDED.other,
                entered_by = EXCLUDED.entered_by,
                notes = EXCLUDED.notes,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
                storeId, entryMonth, utilities, electric, internet, security_system,
                tmobile_cellphone, health_insurance, other,
                entered_by || null, notes || null
            ]
        );
        
        return result.rows[0];
    }
    
    // Get utilities entry for specific month
    static async findByMonth(storeId, entryMonth) {
        const result = await query(
            'SELECT * FROM monthly_utilities WHERE store_id = $1 AND entry_month = $2',
            [storeId, entryMonth]
        );
        return result.rows[0] || null;
    }
    
    // Get utilities entries for date range
    static async findByDateRange(storeId, startMonth, endMonth) {
        const result = await query(
            'SELECT * FROM monthly_utilities WHERE store_id = $1 AND entry_month BETWEEN $2 AND $3 ORDER BY entry_month DESC',
            [storeId, startMonth, endMonth]
        );
        return result.rows;
    }
}

module.exports = MonthlyUtilities;

