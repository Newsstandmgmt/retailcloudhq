const { query } = require('../config/database');

class StateLotteryConfig {
    constructor(data) {
        Object.assign(this, data);
    }

    static async create(configData) {
        const {
            state_code,
            state_name,
            lottery_name,
            official_email_domain,
            retailer_id_label = 'Retailer Number',
            csv_format = {},
            supports_daily_reports = true,
            supports_weekly_reports = true,
            supports_settlement_reports = true,
            supports_13week_average = false,
            email_parser_type = 'combined_settlement',
            date_format = 'MM/DD/YYYY',
            column_mappings = {},
            is_active = true
        } = configData;

        const result = await query(
            `INSERT INTO state_lottery_configs (
                state_code, state_name, lottery_name, official_email_domain,
                retailer_id_label, csv_format, supports_daily_reports,
                supports_weekly_reports, supports_settlement_reports,
                supports_13week_average, email_parser_type, date_format,
                column_mappings, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *`,
            [
                state_code, state_name, lottery_name, official_email_domain,
                retailer_id_label, JSON.stringify(csv_format), supports_daily_reports,
                supports_weekly_reports, supports_settlement_reports,
                supports_13week_average, email_parser_type, date_format,
                JSON.stringify(column_mappings), is_active
            ]
        );
        return result.rows[0];
    }

    static async findByStateCode(stateCode) {
        const result = await query(
            'SELECT * FROM state_lottery_configs WHERE state_code = $1 AND is_active = true',
            [stateCode]
        );
        if (result.rows.length === 0) return null;
        
        const config = result.rows[0];
        // Parse JSONB fields
        if (config.csv_format) config.csv_format = typeof config.csv_format === 'string' ? JSON.parse(config.csv_format) : config.csv_format;
        if (config.column_mappings) config.column_mappings = typeof config.column_mappings === 'string' ? JSON.parse(config.column_mappings) : config.column_mappings;
        return config;
    }

    static async findByStoreId(storeId) {
        // Get store's state, then get config
        const storeResult = await query('SELECT state FROM stores WHERE id = $1', [storeId]);
        if (storeResult.rows.length === 0 || !storeResult.rows[0].state) {
            return null;
        }
        
        const stateCode = storeResult.rows[0].state;
        return await this.findByStateCode(stateCode);
    }

    static async findAll() {
        const result = await query(
            'SELECT * FROM state_lottery_configs WHERE is_active = true ORDER BY state_name'
        );
        return result.rows.map(row => {
            if (row.csv_format) row.csv_format = typeof row.csv_format === 'string' ? JSON.parse(row.csv_format) : row.csv_format;
            if (row.column_mappings) row.column_mappings = typeof row.column_mappings === 'string' ? JSON.parse(row.column_mappings) : row.column_mappings;
            return row;
        });
    }

    static async update(id, updateData) {
        const allowedFields = [
            'state_name', 'lottery_name', 'official_email_domain',
            'retailer_id_label', 'csv_format', 'supports_daily_reports',
            'supports_weekly_reports', 'supports_settlement_reports',
            'supports_13week_average', 'email_parser_type', 'date_format',
            'column_mappings', 'is_active'
        ];
        
        const updates = [];
        const values = [];
        let paramCount = 1;

        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                if (field === 'csv_format' || field === 'column_mappings') {
                    updates.push(`${field} = $${paramCount}`);
                    values.push(JSON.stringify(updateData[field]));
                } else {
                    updates.push(`${field} = $${paramCount}`);
                    values.push(updateData[field]);
                }
                paramCount++;
            }
        }

        if (updates.length === 0) {
            return await this.findById(id);
        }

        values.push(id);
        const result = await query(
            `UPDATE state_lottery_configs SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${paramCount}
             RETURNING *`,
            values
        );
        
        if (result.rows.length === 0) return null;
        
        const config = result.rows[0];
        if (config.csv_format) config.csv_format = typeof config.csv_format === 'string' ? JSON.parse(config.csv_format) : config.csv_format;
        if (config.column_mappings) config.column_mappings = typeof config.column_mappings === 'string' ? JSON.parse(config.column_mappings) : config.column_mappings;
        return config;
    }

    static async findById(id) {
        const result = await query('SELECT * FROM state_lottery_configs WHERE id = $1', [id]);
        if (result.rows.length === 0) return null;
        
        const config = result.rows[0];
        if (config.csv_format) config.csv_format = typeof config.csv_format === 'string' ? JSON.parse(config.csv_format) : config.csv_format;
        if (config.column_mappings) config.column_mappings = typeof config.column_mappings === 'string' ? JSON.parse(config.column_mappings) : config.column_mappings;
        return config;
    }

    static async delete(id) {
        const result = await query('UPDATE state_lottery_configs SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
        return result.rows[0] || null;
    }
}

module.exports = StateLotteryConfig;

