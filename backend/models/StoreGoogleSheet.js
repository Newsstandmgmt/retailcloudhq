const { query } = require('../config/database');

class StoreGoogleSheet {
    constructor(data) {
        Object.assign(this, data);
    }
    
    // Create or update Google Sheets configuration
    static async upsert(storeId, sheetData) {
        const {
            spreadsheet_id,
            sheet_name,
            service_account_key,
            auto_sync_enabled = false,
            sync_frequency = 'daily',
            data_type = 'lottery',
            column_mapping,
            created_by
        } = sheetData;
        
        // Ensure column_mapping is properly formatted as JSON
        let columnMappingValue = null;
        if (column_mapping) {
            if (typeof column_mapping === 'string') {
                try {
                    // If it's already a string, parse it to validate, then it will be stored as JSONB
                    JSON.parse(column_mapping);
                    columnMappingValue = column_mapping;
                } catch (e) {
                    // Invalid JSON string, convert object to JSON string
                    columnMappingValue = JSON.stringify(column_mapping);
                }
            } else if (typeof column_mapping === 'object') {
                // Convert object to JSON string for PostgreSQL JSONB
                columnMappingValue = JSON.stringify(column_mapping);
            }
        }
        
        const result = await query(
            `INSERT INTO store_google_sheets (
                store_id, spreadsheet_id, sheet_name, service_account_key,
                auto_sync_enabled, sync_frequency, data_type, column_mapping, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
            ON CONFLICT (store_id, spreadsheet_id, sheet_name)
            DO UPDATE SET
                service_account_key = EXCLUDED.service_account_key,
                auto_sync_enabled = EXCLUDED.auto_sync_enabled,
                sync_frequency = EXCLUDED.sync_frequency,
                data_type = EXCLUDED.data_type,
                column_mapping = EXCLUDED.column_mapping::jsonb,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
                storeId, spreadsheet_id, sheet_name, service_account_key,
                auto_sync_enabled, sync_frequency, data_type, columnMappingValue, created_by || null
            ]
        );
        
        return result.rows[0];
    }
    
    // Get Google Sheets config for a store
    static async findByStore(storeId) {
        const result = await query(
            'SELECT * FROM store_google_sheets WHERE store_id = $1 ORDER BY created_at DESC',
            [storeId]
        );
        return result.rows;
    }
    
    // Get Google Sheets config by store and data type
    static async findByStoreAndType(storeId, dataType) {
        const result = await query(
            'SELECT * FROM store_google_sheets WHERE store_id = $1 AND data_type = $2 ORDER BY created_at DESC LIMIT 1',
            [storeId, dataType]
        );
        return result.rows[0] || null;
    }
    
    // Delete Google Sheets configuration
    static async delete(id) {
        const result = await query(
            'DELETE FROM store_google_sheets WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }
    
    // Toggle auto sync (pause/resume)
    static async toggleAutoSync(id, enabled) {
        const result = await query(
            'UPDATE store_google_sheets SET auto_sync_enabled = $1 WHERE id = $2 RETURNING *',
            [enabled, id]
        );
        return result.rows[0];
    }
    
    // Get single configuration
    static async findById(id) {
        const result = await query(
            'SELECT * FROM store_google_sheets WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }
    
    // Update sync status
    static async updateSyncStatus(id, status, error = null) {
        const result = await query(
            `UPDATE store_google_sheets 
             SET last_sync_at = CURRENT_TIMESTAMP,
                 last_sync_status = $2,
                 last_sync_error = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id, status, error]
        );
        return result.rows[0] || null;
    }
    
    // Get all stores with auto-sync enabled
    static async findAutoSyncEnabled() {
        const result = await query(
            `SELECT sgs.*, s.name as store_name 
             FROM store_google_sheets sgs
             JOIN stores s ON s.id = sgs.store_id
             WHERE sgs.auto_sync_enabled = true
             ORDER BY sgs.last_sync_at NULLS FIRST`
        );
        return result.rows;
    }
    
    // Delete configuration
    static async delete(id) {
        const result = await query(
            'DELETE FROM store_google_sheets WHERE id = $1 RETURNING id',
            [id]
        );
        return result.rows[0] || null;
    }
}

module.exports = StoreGoogleSheet;

