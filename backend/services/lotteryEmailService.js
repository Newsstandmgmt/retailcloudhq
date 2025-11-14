const LotteryEmailConfig = require('../models/LotteryEmailConfig');
const LotteryDrawDay = require('../models/LotteryDrawDay');
const LotteryInstantDay = require('../models/LotteryInstantDay');
const LotteryWeeklySettlement = require('../models/LotteryWeeklySettlement');
const { query } = require('../config/database');
const { parse } = require('csv-parse/sync');
const LotteryRawReport = require('../models/LotteryRawReport');
const LotteryMappingService = require('./lotteryMappingService');

class LotteryEmailService {
    /**
     * Parse daily sales CSV using state-specific configuration
     * Supports both formats:
     * 1. Legacy format with "Date" column
     * 2. Combined Settlement format: "Combined Settlement","From MM/DD/YYYY to MM/DD/YYYY"
     */
    static async parseDailySalesCSV(csvContent, stateConfig = null) {
        // If no config provided, use PA defaults (backward compatibility)
        const config = stateConfig || {
            column_mappings: {
                retailer_number: 'Retailer Number',
                location_name: 'Location Name',
                balance_forward: 'Balance Forward',
                draw_sales: 'Draw Sales',
                draw_cancels: 'Draw Cancels',
                draw_promos: 'Draw Promos',
                draw_comm: ['Draw  Comm', 'Draw Comm'],
                draw_pays: 'Draw Pays',
                vch_iss: 'VCH ISS',
                vch_rd: 'VCH RD',
                webcash_iss: 'WebCash ISS',
                draw_adj: 'Draw Adj',
                draw_due: 'Draw Due',
                scratch_offs_sales: ['Scratch- Offs Sales', 'Scratch-Offs Sales'],
                scratch_offs_rtrns: ['Scratch- Offs Rtrns', 'Scratch-Offs Rtrns'],
                scratch_offs_comm: ['Scratch- Offs Comm', 'Scratch-Offs Comm'],
                scratch_offs_prms: ['Scratch- Offs Prms', 'Scratch-Offs Prms'],
                scratch_offs_pays: ['Scratch- Offs Pays', 'Scratch-Offs Pays'],
                scratch_offs_adj: ['Scratch- Offs Adj', 'Scratch-Offs Adj'],
                scratch_offs_due: ['Scratch- Offs Due', 'Scratch-Offs Due'],
                card_trans: 'Card Trans',
                gift_cards: 'Gift Cards',
                prepaid: ['Prepaid ', 'Prepaid'],
                total_due: 'Total Due'
            },
            retailer_id_label: 'Retailer Number',
            date_format: 'MM/DD/YYYY'
        };
        
        const columnMappings = config.column_mappings || {};
        const retailerIdLabel = config.retailer_id_label || 'Retailer Number';
        try {
            const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            
            let date = null;
            let parsedData = null;
            
            // Check if it's the "Combined Settlement" format
            if (lines.length > 0 && lines[0].includes('Combined Settlement')) {
                // Extract date from header: "Combined Settlement","From 11/03/2025 to 11/03/2025"
                const firstLine = lines[0];
                const dateRangeMatch = firstLine.match(/From\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
                if (dateRangeMatch) {
                    // For daily reports, start and end dates are the same, use the first one
                    date = this.parseDate(dateRangeMatch[1]);
                }

                // Find the header row (contains retailer ID label)
                let headerIndex = -1;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(retailerIdLabel) || lines[i].includes(`"${retailerIdLabel}"`)) {
                        headerIndex = i;
                        break;
                    }
                }

                if (headerIndex === -1) {
                    throw new Error('Could not find header row in CSV');
                }

                // Parse CSV starting from header row
                const csvFromHeader = lines.slice(headerIndex).join('\n');
                const records = parse(csvFromHeader, {
                    columns: true,
                    skip_empty_lines: true,
                    trim: true,
                    relax_quotes: true,
                    relax_column_count: true
                });

                if (records.length === 0) {
                    throw new Error('No data found in CSV');
                }

                const row = records[0];
                const rawRow = {};
                Object.keys(row).forEach((key) => {
                    rawRow[key] = row[key];
                });

                // Helper function to clean and parse numeric values
                const parseNumeric = (value) => {
                    if (!value) return 0;
                    // Remove quotes, commas, and spaces
                    const cleaned = value.toString().replace(/["\s,]/g, '');
                    return parseFloat(cleaned) || 0;
                };

                // Helper function to get value from row using column mapping
                const getValue = (fieldName) => {
                    const mapping = columnMappings[fieldName];
                    if (!mapping) return null;
                    
                    // Handle array of possible column names
                    if (Array.isArray(mapping)) {
                        for (const colName of mapping) {
                            if (row[colName] !== undefined) {
                                return row[colName];
                            }
                        }
                        return null;
                    }
                    
                    return row[mapping] || null;
                };

                parsedData = {
                    date: date,
                    retailer_number: getValue('retailer_number')?.toString().replace(/"/g, '').trim() || '',
                    location_name: getValue('location_name')?.toString().replace(/"/g, '').trim() || '',
                    balance_forward: parseNumeric(getValue('balance_forward')),
                    
                    // Draw/Online
                    draw_sales: parseNumeric(getValue('draw_sales')),
                    draw_cancels: parseNumeric(getValue('draw_cancels')),
                    draw_promos: parseNumeric(getValue('draw_promos')),
                    draw_comm: parseNumeric(getValue('draw_comm')),
                    draw_pays: parseNumeric(getValue('draw_pays')),
                    vch_iss: parseNumeric(getValue('vch_iss')),
                    vch_rd: parseNumeric(getValue('vch_rd')),
                    webcash_iss: parseNumeric(getValue('webcash_iss')),
                    draw_adj: parseNumeric(getValue('draw_adj')),
                    draw_due: parseNumeric(getValue('draw_due')),
                    
                    // Instant/Scratch-Offs
                    scratch_offs_sales: parseNumeric(getValue('scratch_offs_sales')),
                    scratch_offs_rtrns: parseNumeric(getValue('scratch_offs_rtrns')),
                    scratch_offs_comm: parseNumeric(getValue('scratch_offs_comm')),
                    scratch_offs_prms: parseNumeric(getValue('scratch_offs_prms')),
                    scratch_offs_pays: parseNumeric(getValue('scratch_offs_pays')),
                    scratch_offs_adj: parseNumeric(getValue('scratch_offs_adj')),
                    scratch_offs_due: parseNumeric(getValue('scratch_offs_due')),
                    
                    // Other
                    card_trans: parseNumeric(getValue('card_trans')),
                    gift_cards: parseNumeric(getValue('gift_cards')),
                    prepaid: parseNumeric(getValue('prepaid')),
                    total_due: parseNumeric(getValue('total_due')),
                    raw_data: rawRow,
                    raw_columns: Object.keys(rawRow)
                };
            } else {
                // Legacy format with "Date" column
                const records = parse(csvContent, {
                    columns: true,
                    skip_empty_lines: true,
                    trim: true
                });

                if (records.length === 0) {
                    throw new Error('No data found in CSV');
                }

                const row = records[0];
                const rawRow = {};
                Object.keys(row).forEach((key) => {
                    rawRow[key] = row[key];
                });

                parsedData = {
                    date: this.parseDate(row.Date),
                    retailer_number: row['Retailer Number']?.trim(),
                    location_name: row['Location Name']?.trim(),
                    balance_forward: parseFloat(row['Balance Forward']?.replace(/,/g, '') || 0),
                    
                    // Draw/Online
                    draw_sales: parseFloat(row['Draw Sales']?.replace(/,/g, '') || 0),
                    draw_cancels: parseFloat(row['Draw Cancels']?.replace(/,/g, '') || 0),
                    draw_promos: parseFloat(row['Draw Promos']?.replace(/,/g, '') || 0),
                    draw_comm: parseFloat(row['Draw  Comm']?.replace(/,/g, '') || 0),
                    draw_pays: parseFloat(row['Draw Pays']?.replace(/,/g, '') || 0),
                    vch_iss: parseFloat(row['VCH ISS']?.replace(/,/g, '') || 0),
                    vch_rd: parseFloat(row['VCH RD']?.replace(/,/g, '') || 0),
                    webcash_iss: parseFloat(row['WebCash ISS']?.replace(/,/g, '') || 0),
                    draw_adj: parseFloat(row['Draw Adj']?.replace(/,/g, '') || 0),
                    draw_due: parseFloat(row['Draw Due']?.replace(/,/g, '') || 0),
                    
                    // Instant/Scratch-Offs
                    scratch_offs_sales: parseFloat(row['Scratch- Offs Sales']?.replace(/,/g, '') || 0),
                    scratch_offs_rtrns: parseFloat(row['Scratch- Offs Rtrns']?.replace(/,/g, '') || 0),
                    scratch_offs_comm: parseFloat(row['Scratch- Offs Comm']?.replace(/,/g, '') || 0),
                    scratch_offs_prms: parseFloat(row['Scratch- Offs Prms']?.replace(/,/g, '') || 0),
                    scratch_offs_pays: parseFloat(row['Scratch- Offs Pays']?.replace(/,/g, '') || 0),
                    scratch_offs_adj: parseFloat(row['Scratch- Offs Adj']?.replace(/,/g, '') || 0),
                    scratch_offs_due: parseFloat(row['Scratch- Offs Due']?.replace(/,/g, '') || 0),
                    
                    // Other
                    card_trans: parseFloat(row['Card Trans']?.replace(/,/g, '') || 0),
                    gift_cards: parseFloat(row['Gift Cards']?.replace(/,/g, '') || 0),
                    prepaid: parseFloat(row['Prepaid ']?.replace(/,/g, '') || 0),
                    total_due: parseFloat(row['Total Due']?.replace(/,/g, '') || 0),
                    raw_data: rawRow,
                    raw_columns: Object.keys(rawRow)
                };
            }

            return parsedData;
        } catch (error) {
            console.error('Error parsing CSV:', error);
            throw new Error(`Failed to parse CSV: ${error.message}`);
        }
    }

    static parseDateFromFilename(filename) {
        if (!filename) return null;
        const match = filename.match(/(20\d{6})/);
        if (match) {
            const digits = match[1];
            const year = digits.substring(0, 4);
            const month = digits.substring(4, 6);
            const day = digits.substring(6, 8);
            return `${year}-${month}-${day}`;
        }
        return null;
    }

    /**
     * Parse date from various formats
     */
    static parseDate(dateString) {
        if (!dateString) return null;
        
        // Try common date formats
        const formats = [
            /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY
            /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
        ];

        for (const format of formats) {
            const match = dateString.match(format);
            if (match) {
                if (format === formats[0]) {
                    // MM/DD/YYYY
                    const [, month, day, year] = match;
                    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                } else {
                    // YYYY-MM-DD
                    return match[0];
                }
            }
        }

        // Try Date.parse as fallback
        const parsed = new Date(dateString);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
        }

        throw new Error(`Unable to parse date: ${dateString}`);
    }

    /**
     * Process daily sales email
     */
    static async processDailySalesEmail(storeId, csvContent, emailId, emailSubject, retailerNumber = null, metadata = {}) {
        const DailyLottery = require('../models/DailyLottery');
        const Store = require('../models/Store');
        const StateLotteryConfig = require('../models/StateLotteryConfig');
        const LotteryDailyReport = require('../models/LotteryDailyReport');
        
        // Get store's state lottery configuration
        const stateConfig = await StateLotteryConfig.findByStoreId(storeId);
        
        // Parse CSV using state-specific configuration
        const parsedData = await this.parseDailySalesCSV(csvContent, stateConfig);
        if (metadata.filename && (!parsedData.date || parsedData.date === null)) {
            const filenameDate = this.parseDateFromFilename(metadata.filename);
            if (filenameDate) {
                parsedData.date = filenameDate;
            }
        }
        const rawData = parsedData.raw_data || {};
        const rawColumns = parsedData.raw_columns || Object.keys(rawData);

        // Get store's lottery_retailer_id if rule doesn't specify one
        let expectedRetailerNumber = retailerNumber;
        if (!expectedRetailerNumber) {
            const store = await Store.findById(storeId);
            if (store && store.lottery_retailer_id) {
                expectedRetailerNumber = store.lottery_retailer_id;
            }
        }

        // Verify retailer number if available
        if (expectedRetailerNumber && parsedData.retailer_number && parsedData.retailer_number !== expectedRetailerNumber) {
            throw new Error(`Retailer number mismatch. Expected: ${expectedRetailerNumber}, Got: ${parsedData.retailer_number}`);
        }

        // Store raw report data for future mapping
        const rawReportRecord = await LotteryRawReport.upsert({
            storeId,
            reportDate: parsedData.date,
            retailerNumber: parsedData.retailer_number,
            locationName: parsedData.location_name,
            data: {
                ...rawData,
                __columns: rawColumns,
            },
            sourceEmailId: emailId,
            sourceEmailSubject: emailSubject,
            filename: metadata.filename || null,
            receivedAt: metadata.receivedAt || new Date(),
            reportType: 'daily',
        });

        await LotteryMappingService.applyMappings({
            storeId,
            reportDate: parsedData.date,
            reportType: 'daily',
            rawReport: rawReportRecord,
        });

        // Save to daily_lottery table (this is the main storage for daily sales data)
        const dailyLottery = await DailyLottery.upsert(storeId, parsedData.date, {
            retailer_number: parsedData.retailer_number,
            location_name: parsedData.location_name,
            balance_forward: parsedData.balance_forward,
            draw_sales: parsedData.draw_sales,
            draw_cancels: parsedData.draw_cancels,
            draw_promos: parsedData.draw_promos,
            draw_comm: parsedData.draw_comm,
            draw_pays: parsedData.draw_pays,
            vch_iss: parsedData.vch_iss,
            vch_rd: parsedData.vch_rd,
            webcash_iss: parsedData.webcash_iss,
            draw_adj: parsedData.draw_adj,
            draw_due: parsedData.draw_due,
            scratch_offs_sales: parsedData.scratch_offs_sales,
            scratch_offs_rtrns: parsedData.scratch_offs_rtrns,
            scratch_offs_comm: parsedData.scratch_offs_comm,
            scratch_offs_prms: parsedData.scratch_offs_prms,
            scratch_offs_pays: parsedData.scratch_offs_pays,
            scratch_offs_adj: parsedData.scratch_offs_adj,
            scratch_offs_due: parsedData.scratch_offs_due,
            card_trans: parsedData.card_trans,
            gift_cards: parsedData.gift_cards,
            prepaid: parsedData.prepaid,
            total_due: parsedData.total_due,
            notes: `Auto-imported from lottery daily email: ${emailSubject}`
        });

        // Also create or update Draw Day for lottery system integration
        const drawDay = await LotteryDrawDay.createOrUpdate({
            date: parsedData.date,
            store_id: storeId,
            total_sales: parsedData.draw_sales,
            total_cashed: parsedData.draw_pays,
            adjustments: parsedData.draw_adj,
            commission_source: 'statement',
            commission_amount: parsedData.draw_comm,
            notes: `Auto-imported from lottery daily email. Draw Cancels: ${parsedData.draw_cancels}, Draw Promos: ${parsedData.draw_promos}, VCH ISS: ${parsedData.vch_iss}, VCH RD: ${parsedData.vch_rd}, WebCash ISS: ${parsedData.webcash_iss}`
        });

        // Also create or update Instant Day for lottery system integration
        const instantDay = await LotteryInstantDay.createOrUpdate({
            date: parsedData.date,
            store_id: storeId,
            instant_face_sales: parsedData.scratch_offs_sales,
            instant_payouts: parsedData.scratch_offs_pays,
            instant_returns: parsedData.scratch_offs_rtrns,
            instant_net_sale_ops: parsedData.scratch_offs_sales - parsedData.scratch_offs_pays - parsedData.scratch_offs_rtrns,
            instant_commission: parsedData.scratch_offs_comm
        });

        // Logging will be done by the caller (gmailService)

        return {
            dailyLottery,
            drawDay,
            instantDay,
            parsedData
        };
    }

    /**
     * Process weekly sales email (similar structure but may have multiple days)
     */
    static async processWeeklySalesEmail(emailConfigId, csvContent, emailId, emailSubject) {
        // Similar to daily but may need to handle multiple rows
        // For now, we'll process each row as a separate day
        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        const results = [];
        for (const row of records) {
            const parsedData = this.parseDailySalesCSV(csvContent); // Reuse parsing logic
            // Process each day...
            results.push(parsedData);
        }

        return results;
    }

    /**
     * Parse PA Lottery weekly settlement CSV
     * Format: First line has "Combined Settlement","From MM/DD/YYYY to MM/DD/YYYY"
     * Then column headers, then data row
     */
    static parseWeeklySettlementCSV(csvContent) {
        try {
            const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            
            // Extract date range from first line: "Combined Settlement","From 10/28/2025 to 11/03/2025"
            let periodStartDate = null;
            let periodEndDate = null;
            let settlementDate = null;
            
            if (lines.length > 0) {
                const firstLine = lines[0];
                // Extract date range: "From 10/28/2025 to 11/03/2025"
                const dateRangeMatch = firstLine.match(/From\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
                if (dateRangeMatch) {
                    periodStartDate = this.parseDate(dateRangeMatch[1]);
                    periodEndDate = this.parseDate(dateRangeMatch[2]);
                    settlementDate = periodEndDate; // Use end date as settlement date
                }
            }

            // Find the header row (contains retailer ID label)
            let headerIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(retailerIdLabel) || lines[i].includes(`"${retailerIdLabel}"`)) {
                    headerIndex = i;
                    break;
                }
            }

            if (headerIndex === -1) {
                throw new Error('Could not find header row in CSV');
            }

            // Parse CSV starting from header row
            const csvFromHeader = lines.slice(headerIndex).join('\n');
            const records = parse(csvFromHeader, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                relax_quotes: true,
                relax_column_count: true
            });

            if (records.length === 0) {
                throw new Error('No data found in CSV');
            }

            // Get the first data row
            const row = records[0];

            // Helper function to clean and parse numeric values
            const parseNumeric = (value) => {
                if (!value) return 0;
                // Remove quotes, commas, and spaces
                const cleaned = value.toString().replace(/["\s,]/g, '');
                return parseFloat(cleaned) || 0;
            };
            
            const columnMappings = config.column_mappings || {};
            
            // Helper function to get value from row using column mapping
            const getValue = (fieldName) => {
                const mapping = columnMappings[fieldName];
                if (!mapping) return null;
                
                // Handle array of possible column names
                if (Array.isArray(mapping)) {
                    for (const colName of mapping) {
                        if (row[colName] !== undefined) {
                            return row[colName];
                        }
                    }
                    return null;
                }
                
                return row[mapping] || null;
            };

            return {
                settlement_date: settlementDate,
                period_start_date: periodStartDate,
                period_end_date: periodEndDate,
                retailer_number: getValue('retailer_number')?.toString().replace(/"/g, '').trim() || '',
                location_name: getValue('location_name')?.toString().replace(/"/g, '').trim() || '',
                balance_forward: parseNumeric(getValue('balance_forward')),
                
                // Draw/Online
                draw_sales: parseNumeric(getValue('draw_sales')),
                draw_cancels: parseNumeric(getValue('draw_cancels')),
                draw_promos: parseNumeric(getValue('draw_promos')),
                draw_comm: parseNumeric(getValue('draw_comm')),
                draw_pays: parseNumeric(getValue('draw_pays')),
                vch_iss: parseNumeric(getValue('vch_iss')),
                vch_rd: parseNumeric(getValue('vch_rd')),
                webcash_iss: parseNumeric(getValue('webcash_iss')),
                draw_adj: parseNumeric(getValue('draw_adj')),
                draw_due: parseNumeric(getValue('draw_due')),
                
                // Instant/Scratch-Offs
                scratch_offs_sales: parseNumeric(getValue('scratch_offs_sales')),
                scratch_offs_rtrns: parseNumeric(getValue('scratch_offs_rtrns')),
                scratch_offs_comm: parseNumeric(getValue('scratch_offs_comm')),
                scratch_offs_prms: parseNumeric(getValue('scratch_offs_prms')),
                scratch_offs_pays: parseNumeric(getValue('scratch_offs_pays')),
                scratch_offs_adj: parseNumeric(getValue('scratch_offs_adj')),
                scratch_offs_due: parseNumeric(getValue('scratch_offs_due')),
                
                // Other
                card_trans: parseNumeric(getValue('card_trans')),
                gift_cards: parseNumeric(getValue('gift_cards')),
                prepaid: parseNumeric(getValue('prepaid')),
                total_due: parseNumeric(getValue('total_due')),
            };
        } catch (error) {
            console.error('Error parsing weekly settlement CSV:', error);
            throw new Error(`Failed to parse weekly settlement CSV: ${error.message}`);
        }
    }

    /**
     * Process weekly settlement email
     */
    static async processWeeklySettlementEmail(storeId, csvContent, emailId, emailSubject, retailerNumber = null) {
        const Store = require('../models/Store');
        const StateLotteryConfig = require('../models/StateLotteryConfig');
        
        // Get store's state lottery configuration
        const stateConfig = await StateLotteryConfig.findByStoreId(storeId);
        
        // Parse CSV using state-specific configuration
        const parsedData = await this.parseWeeklySettlementCSV(csvContent, stateConfig);

        // Get store's lottery_retailer_id if rule doesn't specify one
        let expectedRetailerNumber = retailerNumber;
        if (!expectedRetailerNumber) {
            const store = await Store.findById(storeId);
            if (store && store.lottery_retailer_id) {
                expectedRetailerNumber = store.lottery_retailer_id;
            }
        }

        // Verify retailer number if available
        if (expectedRetailerNumber && parsedData.retailer_number && parsedData.retailer_number !== expectedRetailerNumber) {
            throw new Error(`Retailer number mismatch. Expected: ${expectedRetailerNumber}, Got: ${parsedData.retailer_number}`);
        }

        // Calculate totals
        const totalSales = (parsedData.draw_sales || 0) + (parsedData.scratch_offs_sales || 0);
        const totalCommissions = (parsedData.draw_comm || 0) + (parsedData.scratch_offs_comm || 0);
        const totalAdjustments = (parsedData.draw_adj || 0) + (parsedData.scratch_offs_adj || 0);
        const totalPayments = (parsedData.draw_pays || 0) + (parsedData.scratch_offs_pays || 0);

        // Create or update Weekly Settlement
        const settlement = await LotteryWeeklySettlement.create(
            storeId,
            parsedData.settlement_date || parsedData.period_end_date,
            {
                period_start_date: parsedData.period_start_date,
                period_end_date: parsedData.period_end_date,
                retailer_number: parsedData.retailer_number,
                location_name: parsedData.location_name,
                balance_forward: parsedData.balance_forward,
                total_sales: totalSales,
                total_commissions: totalCommissions,
                total_adjustments: totalAdjustments,
                total_payments: totalPayments,
                balance_due: parsedData.total_due,
                draw_sales: parsedData.draw_sales,
                draw_cancels: parsedData.draw_cancels,
                draw_promos: parsedData.draw_promos,
                draw_comm: parsedData.draw_comm,
                draw_pays: parsedData.draw_pays,
                vch_iss: parsedData.vch_iss,
                vch_rd: parsedData.vch_rd,
                webcash_iss: parsedData.webcash_iss,
                draw_adj: parsedData.draw_adj,
                draw_due: parsedData.draw_due,
                scratch_offs_sales: parsedData.scratch_offs_sales,
                scratch_offs_rtrns: parsedData.scratch_offs_rtrns,
                scratch_offs_comm: parsedData.scratch_offs_comm,
                scratch_offs_prms: parsedData.scratch_offs_prms,
                scratch_offs_pays: parsedData.scratch_offs_pays,
                scratch_offs_adj: parsedData.scratch_offs_adj,
                scratch_offs_due: parsedData.scratch_offs_due,
                card_trans: parsedData.card_trans,
                gift_cards: parsedData.gift_cards,
                prepaid: parsedData.prepaid,
                total_due: parsedData.total_due,
                source: 'email',
                notes: `Auto-imported from lottery weekly settlement email: ${emailSubject}`
            }
        );

        return {
            settlement,
            parsedData
        };
    }

    /**
     * Process settlement email (typically includes commission payments)
     */
    static async processSettlementEmail(storeId, csvContent, emailId, emailSubject, retailerNumber = null) {
        // Weekly settlement uses the same format
        return await this.processWeeklySettlementEmail(storeId, csvContent, emailId, emailSubject, retailerNumber);
    }
}

module.exports = LotteryEmailService;

