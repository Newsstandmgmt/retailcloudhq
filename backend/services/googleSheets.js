const { google } = require('googleapis');

class GoogleSheetsService {
    constructor(serviceAccountKey) {
        // serviceAccountKey can be a JSON string or file path
        let credentials;
        
        if (typeof serviceAccountKey === 'string') {
            try {
                // Try parsing as JSON
                credentials = JSON.parse(serviceAccountKey);
            } catch (e) {
                // If not JSON, assume it's a file path
                const fs = require('fs');
                credentials = JSON.parse(fs.readFileSync(serviceAccountKey, 'utf8'));
            }
        } else {
            credentials = serviceAccountKey;
        }
        
        this.auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        
        this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    }
    
    /**
     * Get data from a specific range in a Google Sheet
     * @param {string} spreadsheetId - The Google Sheet ID
     * @param {string} range - The range to read (e.g., 'Sheet1!A1:Z100')
     * @returns {Promise<Array>} Array of rows
     */
    async getSheetData(spreadsheetId, range) {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId,
                range,
            });
            
            return response.data.values || [];
        } catch (error) {
            console.error('Error fetching Google Sheet data:', error);
            throw new Error(`Failed to fetch Google Sheet data: ${error.message}`);
        }
    }
    
    /**
     * Get all data from a sheet
     * @param {string} spreadsheetId - The Google Sheet ID
     * @param {string} sheetName - Name of the sheet tab
     * @returns {Promise<Array>} Array of rows
     */
    async getAllSheetData(spreadsheetId, sheetName) {
        try {
            // First, get the sheet to determine the range
            const sheetInfo = await this.sheets.spreadsheets.get({
                spreadsheetId,
                ranges: [sheetName],
            });
            
            const sheet = sheetInfo.data.sheets?.[0];
            if (!sheet) {
                throw new Error(`Sheet "${sheetName}" not found`);
            }
            
            // Get all data from the sheet
            const range = `${sheetName}!A:ZZ`;
            return await this.getSheetData(spreadsheetId, range);
        } catch (error) {
            console.error('Error fetching all sheet data:', error);
            throw error;
        }
    }
    
    /**
     * Get headers from the first row
     * @param {string} spreadsheetId - The Google Sheet ID
     * @param {string} sheetName - Name of the sheet tab
     * @returns {Promise<Array>} Array of header names
     */
    async getHeaders(spreadsheetId, sheetName) {
        try {
            const range = `${sheetName}!1:1`;
            const data = await this.getSheetData(spreadsheetId, range);
            return data[0] || [];
        } catch (error) {
            console.error('Error fetching headers:', error);
            throw error;
        }
    }
    
    /**
     * Map sheet data to database format using column mapping
     * @param {Array} sheetData - Raw sheet data (rows)
     * @param {Object} columnMapping - Mapping of sheet columns to DB fields
     * @returns {Array} Mapped data
     */
    mapSheetDataToDatabase(sheetData, columnMapping) {
        if (!sheetData || sheetData.length === 0) {
            return [];
        }
        
        const headers = sheetData[0];
        const dataRows = sheetData.slice(1);
        
        // Normalize headers (trim, handle case-insensitive matching)
        const normalizedHeaders = headers.map(h => h ? h.toString().trim() : '');
        
        // Create a mapping of normalized header names to their indices
        const headerIndexMap = {};
        normalizedHeaders.forEach((header, index) => {
            if (header) {
                const normalized = header.toLowerCase().trim();
                if (!headerIndexMap[normalized]) {
                    headerIndexMap[normalized] = [];
                }
                headerIndexMap[normalized].push({ original: header, index });
            }
        });
        
        console.log('📊 Column Mapping Debug:');
        console.log('  Headers found:', normalizedHeaders);
        console.log('  Column mapping:', JSON.stringify(columnMapping, null, 2));
        
        return dataRows.map((row, rowIndex) => {
            const mapped = {};
            
            // Track which fields were actually mapped (for partial updates)
            mapped._mappedFields = [];
            
            // Apply column mapping
            Object.keys(columnMapping).forEach((dbField) => {
                const sheetColumn = columnMapping[dbField];
                if (!sheetColumn) {
                    return; // Skip if no column mapped
                }
                
                // Normalize the sheet column name for matching
                const normalizedSheetColumn = sheetColumn.toString().trim().toLowerCase();
                
                // Find column index (case-insensitive, trimmed)
                let columnIndex = -1;
                
                // First try exact match (case-sensitive, trimmed)
                columnIndex = normalizedHeaders.findIndex(h => h === sheetColumn.toString().trim());
                
                // If not found, try case-insensitive match
                if (columnIndex === -1 && headerIndexMap[normalizedSheetColumn]) {
                    // Use the first match if multiple found
                    columnIndex = headerIndexMap[normalizedSheetColumn][0].index;
                }
                
                // Log if column not found
                if (columnIndex === -1) {
                    console.warn(`⚠️  Column "${sheetColumn}" not found in headers for field "${dbField}"`);
                    console.warn(`   Available headers: ${normalizedHeaders.join(', ')}`);
                    return;
                }
                
                if (row[columnIndex] !== undefined && row[columnIndex] !== null && row[columnIndex] !== '') {
                    // Convert to appropriate type
                    const value = row[columnIndex].toString().trim();
                    
                    if (value === '') {
                        return; // Skip empty values
                    }
                    
                    // Try to parse as number if it's a numeric field
                    const numericFields = [
                        'cash', 'amount', 'fee', 'commission', 'sold', 'net', 'sales', 
                        'adj', 'due', 'pays', 'trans', 'cards', 'prepaid', 'forward',
                        'draw', 'scratch', 'instant', 'lottery', 'card', 'gift',
                        'vch', 'webcash', 'promos', 'cancels', 'comm', 'rtrns', 'prms'
                    ];
                    
                    if (numericFields.some(field => dbField.toLowerCase().includes(field))) {
                        // Remove currency symbols and commas
                        const cleanedValue = value.replace(/[$,\s]/g, '');
                        const numValue = parseFloat(cleanedValue);
                        if (!isNaN(numValue)) {
                            mapped[dbField] = numValue;
                            mapped._mappedFields.push(dbField);
                            if (rowIndex === 0) { // Log first row mapping
                                console.log(`  ✓ Mapped "${sheetColumn}" (index ${columnIndex}) -> ${dbField} = ${numValue}`);
                            }
                        } else {
                            console.warn(`  ⚠️  Could not parse "${value}" as number for field "${dbField}"`);
                        }
                    } else if (dbField === 'entry_date' || dbField === 'date') {
                        // Handle date conversion
                        const dateValue = this.parseDate(value);
                        if (dateValue) {
                            mapped[dbField] = dateValue;
                            mapped._mappedFields.push(dbField);
                        }
                    } else {
                        mapped[dbField] = value;
                        mapped._mappedFields.push(dbField);
                        if (rowIndex === 0) { // Log first row mapping
                            console.log(`  ✓ Mapped "${sheetColumn}" (index ${columnIndex}) -> ${dbField} = "${value}"`);
                        }
                    }
                }
            });
            
            if (rowIndex === 0 && Object.keys(mapped).length > 0) {
                console.log(`  📋 First row mapped data:`, JSON.stringify(mapped, null, 2));
            }
            
            return mapped;
        }).filter(mapped => Object.keys(mapped).length > 1); // Filter out rows with only _mappedFields
    }
    
    /**
     * Parse date from various formats
     * @param {string} dateString - Date string in various formats
     * @returns {string} ISO date string (YYYY-MM-DD)
     */
    parseDate(dateString) {
        if (!dateString) return null;
        
        // Try parsing as Date
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
        
        // Try common formats
        const formats = [
            /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
            /(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
            /(\d{2})-(\d{2})-(\d{4})/, // MM-DD-YYYY
        ];
        
        for (const format of formats) {
            const match = dateString.match(format);
            if (match) {
                if (format === formats[0]) {
                    return `${match[1]}-${match[2]}-${match[3]}`;
                } else {
                    return `${match[3]}-${match[1]}-${match[2]}`;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Test connection to Google Sheet
     * @param {string} spreadsheetId - The Google Sheet ID
     * @param {string} sheetName - Name of the sheet tab
     * @returns {Promise<boolean>} True if connection successful
     */
    async testConnection(spreadsheetId, sheetName) {
        try {
            await this.getHeaders(spreadsheetId, sheetName);
            return true;
        } catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }
}

module.exports = GoogleSheetsService;

