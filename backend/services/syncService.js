const StoreGoogleSheet = require('../models/StoreGoogleSheet');
const GoogleSheetsService = require('./googleSheets');
const DailyRevenue = require('../models/DailyRevenue');
const DailyLottery = require('../models/DailyLottery');
const WeeklyLottery = require('../models/WeeklyLottery');
const DailyCashFlow = require('../models/DailyCashFlow');
const { query } = require('../config/database');

class SyncService {
    /**
     * Sync data from Google Sheets for a specific store
     * @param {string} storeId - Store ID
     * @param {string} syncType - Type of data to sync ('revenue', 'lottery', 'cashflow')
     * @returns {Promise<Object>} Sync result
     */
    async syncStoreData(storeId, syncType = 'revenue') {
        const startTime = new Date();
        let syncLog = {
            store_id: storeId,
            sync_type: syncType,
            status: 'pending',
            records_processed: 0,
            records_added: 0,
            records_updated: 0,
            records_skipped: 0,
            error_message: null,
            details: {}
        };
        
        try {
            // Get Google Sheets configuration for this store
            const configs = await StoreGoogleSheet.findByStore(storeId);
            if (configs.length === 0) {
                throw new Error('No Google Sheets configuration found for this store');
            }
            
            // Find config matching the sync type exactly
            let config = configs.find(c => {
                if (syncType === 'lottery' && c.data_type === 'lottery') return true;
                if (syncType === 'lottery_weekly' && c.data_type === 'lottery_weekly') return true;
                if (syncType === 'revenue' && c.data_type === 'revenue') return true;
                if (syncType === 'cashflow' && c.data_type === 'cashflow') return true;
                return false;
            });
            
            if (!config) {
                throw new Error(`No Google Sheets configuration found for sync type: ${syncType}. Please configure the integration first.`);
            }
            
            // Initialize Google Sheets service
            const sheetsService = new GoogleSheetsService(config.service_account_key);
            
        // Determine data type (lottery vs lottery_weekly)
        const dataType = config.data_type || syncType;
        const effectiveSyncType = dataType === 'lottery_weekly' ? 'lottery_weekly' : syncType;
        
        // Parse column_mapping if it's a string (shouldn't happen with JSONB, but just in case)
        let columnMappingObj = config.column_mapping;
        if (typeof columnMappingObj === 'string') {
            try {
                columnMappingObj = JSON.parse(columnMappingObj);
            } catch (e) {
                console.error('Error parsing column_mapping:', e);
                columnMappingObj = null;
            }
        }
        
        // Get column mapping for this sync type
        // PostgreSQL JSONB is automatically parsed, but let's handle all cases
        let columnMapping = {};
        
        if (columnMappingObj) {
            // Handle if it's already a parsed object (most common case with JSONB)
            if (typeof columnMappingObj === 'object' && columnMappingObj !== null) {
                // First try the exact sync type key
                if (columnMappingObj[effectiveSyncType] && typeof columnMappingObj[effectiveSyncType] === 'object') {
                    columnMapping = columnMappingObj[effectiveSyncType];
                } 
                // For lottery types, check the 'lottery' key (since frontend stores both lottery and lottery_weekly under 'lottery')
                else if ((effectiveSyncType === 'lottery' || effectiveSyncType === 'lottery_weekly') && columnMappingObj.lottery && typeof columnMappingObj.lottery === 'object') {
                    columnMapping = columnMappingObj.lottery;
                }
                // For revenue/cashflow, try their specific keys
                else if (columnMappingObj[effectiveSyncType] && typeof columnMappingObj[effectiveSyncType] === 'object') {
                    columnMapping = columnMappingObj[effectiveSyncType];
                }
                // If it's lottery and column_mapping is a flat object (not nested), use it directly
                else if (effectiveSyncType === 'lottery' && Object.keys(columnMappingObj).length > 0) {
                    // Check if it looks like a nested structure
                    const hasNestedKeys = ['lottery', 'revenue', 'cashflow'].some(key => columnMappingObj[key]);
                    if (!hasNestedKeys && columnMappingObj.entry_date) {
                        // It's a flat mapping, use it directly
                        columnMapping = columnMappingObj;
                    }
                }
            }
        }
        
        if (Object.keys(columnMapping).length === 0) {
            console.error('Column mapping debug:', {
                storeId,
                syncType,
                effectiveSyncType,
                dataType: config.data_type,
                columnMappingExists: !!config.column_mapping,
                columnMappingType: typeof config.column_mapping,
                columnMappingIsNull: config.column_mapping === null,
                columnMappingObjType: typeof columnMappingObj,
                columnMappingObjKeys: columnMappingObj && typeof columnMappingObj === 'object' ? Object.keys(columnMappingObj) : 'N/A',
                fullColumnMapping: config.column_mapping ? JSON.stringify(config.column_mapping, null, 2) : 'null'
            });
            throw new Error(`No column mapping configured for ${effectiveSyncType}. Please configure column mapping in Settings → Integrations.`);
        }
            
            // Fetch data from Google Sheets
            const sheetData = await sheetsService.getAllSheetData(
                config.spreadsheet_id,
                config.sheet_name
            );
            
            if (!sheetData || sheetData.length < 2) {
                throw new Error('No data found in Google Sheet');
            }
            
            // Map sheet data to database format
            console.log('🔄 Starting data mapping...');
            console.log('  Column mapping keys:', Object.keys(columnMapping));
            const mappedData = sheetsService.mapSheetDataToDatabase(sheetData, columnMapping);
            console.log(`  ✅ Mapped ${mappedData.length} rows`);
            
            syncLog.records_processed = mappedData.length;
            
            // Save to database based on sync type
            let added = 0;
            let updated = 0;
            let skipped = 0;
            
            for (const data of mappedData) {
                try {
                    if (!data.entry_date) {
                        skipped++;
                        continue;
                    }
                    
                    switch (effectiveSyncType) {
                        case 'revenue':
                            // For revenue, only include fields that were actually mapped
                            // This allows POS/CC data to only update credit card fields
                            const revenueData = {
                                entry_date: data.entry_date,
                                entered_by: null, // System entry
                            };
                            
                            // Only include fields that were mapped from the sheet
                            if (data._mappedFields) {
                                data._mappedFields.forEach(field => {
                                    if (field !== 'entry_date' && field !== '_mappedFields') {
                                        revenueData[field] = data[field];
                                    }
                                });
                            } else {
                                // Fallback: include all data if _mappedFields not available
                                Object.keys(data).forEach(key => {
                                    if (key !== '_mappedFields') {
                                        revenueData[key] = data[key];
                                    }
                                });
                            }
                            
                            await DailyRevenue.upsert(storeId, data.entry_date, revenueData);
                            break;
                        case 'lottery':
                            await DailyLottery.upsert(storeId, data.entry_date, {
                                ...data,
                                entered_by: null,
                                notes: `Auto-imported from Google Sheets (${config.spreadsheet_id.substring(0, 20)}...)`,
                            });
                            break;
                        case 'lottery_weekly':
                            await WeeklyLottery.upsert(storeId, data.entry_date, {
                                ...data,
                                entered_by: null,
                                notes: `Auto-imported from Google Sheets (${config.spreadsheet_id.substring(0, 20)}...)`,
                            });
                            break;
                        case 'cashflow':
                            await DailyCashFlow.upsert(storeId, data.entry_date, {
                                ...data,
                                entered_by: null,
                            });
                            break;
                        default:
                            throw new Error(`Unknown sync type: ${effectiveSyncType}`);
                    }
                    
                    // Check if it was a new record or update (simple heuristic)
                    // You can enhance this by checking if record existed before
                    updated++;
                    added++;
                } catch (error) {
                    console.error(`Error syncing record for ${data.entry_date}:`, error);
                    skipped++;
                }
            }
            
            syncLog.records_added = added;
            syncLog.records_updated = updated;
            syncLog.records_skipped = skipped;
            syncLog.status = skipped === mappedData.length ? 'failed' : 'success';
            syncLog.sync_type = effectiveSyncType;
            
            // Update sync status
            await StoreGoogleSheet.updateSyncStatus(
                config.id,
                syncLog.status,
                syncLog.error_message
            );
            
            // Log sync
            await this.logSync(syncLog);
            
        } catch (error) {
            console.error(`Sync failed for store ${storeId}:`, error);
            syncLog.status = 'failed';
            syncLog.error_message = error.message;
            syncLog.sync_completed_at = new Date();
            
            // Update sync status
            const configs = await StoreGoogleSheet.findByStore(storeId);
            if (configs.length > 0) {
                await StoreGoogleSheet.updateSyncStatus(
                    configs[0].id,
                    'failed',
                    error.message
                );
            }
            
            // Log sync
            await this.logSync(syncLog);
            
            throw error;
        }
        
        syncLog.sync_completed_at = new Date();
        syncLog.details.duration_ms = syncLog.sync_completed_at - startTime;
        
        return syncLog;
    }
    
    /**
     * Log sync operation
     * @param {Object} syncLog - Sync log data
     */
    async logSync(syncLog) {
        try {
            await query(
                `INSERT INTO google_sheets_sync_logs (
                    store_id, sync_type, status, records_processed,
                    records_added, records_updated, records_skipped,
                    error_message, sync_completed_at, details
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    syncLog.store_id,
                    syncLog.sync_type,
                    syncLog.status,
                    syncLog.records_processed,
                    syncLog.records_added,
                    syncLog.records_updated,
                    syncLog.records_skipped,
                    syncLog.error_message,
                    syncLog.sync_completed_at,
                    JSON.stringify(syncLog.details || {})
                ]
            );
        } catch (error) {
            console.error('Error logging sync:', error);
        }
    }
    
    /**
     * Sync all stores with auto-sync enabled
     * @param {string} syncType - Type of data to sync
     */
    async syncAllStores(syncType = 'revenue') {
        const stores = await StoreGoogleSheet.findAutoSyncEnabled();
        const results = [];
        
        for (const storeConfig of stores) {
            try {
                const result = await this.syncStoreData(storeConfig.store_id, syncType);
                results.push({
                    store_id: storeConfig.store_id,
                    store_name: storeConfig.store_name,
                    status: result.status,
                    records_processed: result.records_processed,
                });
            } catch (error) {
                results.push({
                    store_id: storeConfig.store_id,
                    store_name: storeConfig.store_name,
                    status: 'failed',
                    error: error.message,
                });
            }
        }
        
        return results;
    }
}

module.exports = new SyncService();

