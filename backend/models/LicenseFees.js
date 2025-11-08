const { query } = require('../config/database');

class LicenseFees {
    constructor(data) {
        Object.assign(this, data);
    }
    
    // Create or update license fees entry
    static async upsert(storeId, entryYear, feesData) {
        const {
            city_license_fees = 0,
            newsstand_bond = 0,
            cigar_permit_fees = 0,
            food_license = 0,
            newsstand_license = 0,
            lottery_license = 0,
            pa_otp_cigarette_license_fees = 0,
            entered_by,
            notes
        } = feesData;
        
        const result = await query(
            `INSERT INTO license_fees (
                store_id, entry_year, city_license_fees, newsstand_bond, cigar_permit_fees,
                food_license, newsstand_license, lottery_license, pa_otp_cigarette_license_fees,
                entered_by, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (store_id, entry_year)
            DO UPDATE SET
                city_license_fees = EXCLUDED.city_license_fees,
                newsstand_bond = EXCLUDED.newsstand_bond,
                cigar_permit_fees = EXCLUDED.cigar_permit_fees,
                food_license = EXCLUDED.food_license,
                newsstand_license = EXCLUDED.newsstand_license,
                lottery_license = EXCLUDED.lottery_license,
                pa_otp_cigarette_license_fees = EXCLUDED.pa_otp_cigarette_license_fees,
                entered_by = EXCLUDED.entered_by,
                notes = EXCLUDED.notes,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
                storeId, entryYear, city_license_fees, newsstand_bond, cigar_permit_fees,
                food_license, newsstand_license, lottery_license, pa_otp_cigarette_license_fees,
                entered_by || null, notes || null
            ]
        );
        
        return result.rows[0];
    }
    
    // Get license fees entry for specific year
    static async findByYear(storeId, entryYear) {
        const result = await query(
            'SELECT * FROM license_fees WHERE store_id = $1 AND entry_year = $2',
            [storeId, entryYear]
        );
        return result.rows[0] || null;
    }
    
    // Get license fees entries for year range
    static async findByYearRange(storeId, startYear, endYear) {
        const result = await query(
            'SELECT * FROM license_fees WHERE store_id = $1 AND entry_year BETWEEN $2 AND $3 ORDER BY entry_year DESC',
            [storeId, startYear, endYear]
        );
        return result.rows;
    }
}

module.exports = LicenseFees;

