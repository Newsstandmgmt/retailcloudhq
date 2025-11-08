const { query } = require('../config/database');

/**
 * Service for generating exportable report data
 * Formats data for Excel, CSV, and PDF exports
 */
class ReportExportService {
    /**
     * Format data for CSV export
     */
    static formatForCSV(data, headers) {
        const rows = [];
        
        // Add headers
        rows.push(headers.map(h => h.label || h.key));
        
        // Add data rows
        data.forEach(row => {
            const csvRow = headers.map(h => {
                const value = h.accessor ? h.accessor(row) : row[h.key];
                // Handle arrays and objects
                if (Array.isArray(value)) {
                    return value.join('; ');
                }
                if (typeof value === 'object' && value !== null) {
                    return JSON.stringify(value);
                }
                // Escape commas and quotes
                const stringValue = String(value || '');
                return stringValue.includes(',') || stringValue.includes('"') 
                    ? `"${stringValue.replace(/"/g, '""')}"` 
                    : stringValue;
            });
            rows.push(csvRow);
        });
        
        return rows.map(row => row.join(',')).join('\n');
    }

    /**
     * Format data for Excel export (JSON format that can be converted to Excel)
     */
    static formatForExcel(data, headers) {
        const excelData = [];
        
        // Add headers
        excelData.push(headers.map(h => h.label || h.key));
        
        // Add data rows
        data.forEach(row => {
            const excelRow = headers.map(h => {
                const value = h.accessor ? h.accessor(row) : row[h.key];
                if (Array.isArray(value)) {
                    return value.join('; ');
                }
                if (typeof value === 'object' && value !== null) {
                    return JSON.stringify(value);
                }
                return value || '';
            });
            excelData.push(excelRow);
        });
        
        return excelData;
    }

    /**
     * Format data for PDF (HTML table format)
     */
    static formatForPDF(data, headers, title = 'Report') {
        let html = `
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #2d8659; }
                    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                    th { background-color: #2d8659; color: white; padding: 10px; text-align: left; }
                    td { border: 1px solid #ddd; padding: 8px; }
                    tr:nth-child(even) { background-color: #f2f2f2; }
                    .summary { margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 5px; }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                <table>
                    <thead>
                        <tr>
                            ${headers.map(h => `<th>${h.label || h.key}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        data.forEach(row => {
            html += '<tr>';
            headers.forEach(h => {
                const value = h.accessor ? h.accessor(row) : row[h.key];
                let displayValue = '';
                if (Array.isArray(value)) {
                    displayValue = value.join('; ');
                } else if (typeof value === 'object' && value !== null) {
                    displayValue = JSON.stringify(value);
                } else {
                    displayValue = String(value || '');
                }
                html += `<td>${displayValue}</td>`;
            });
            html += '</tr>';
        });
        
        html += `
                    </tbody>
                </table>
            </body>
            </html>
        `;
        
        return html;
    }
}

module.exports = ReportExportService;

