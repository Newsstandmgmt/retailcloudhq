/**
 * Utility functions for exporting reports to CSV, Excel, and PDF
 */

/**
 * Export data to CSV
 */
export const exportToCSV = (data, filename) => {
  let csvContent = '';
  
  // Handle both array format and { headers, rows } format
  let headers = [];
  let rows = [];
  
  if (data && typeof data === 'object' && data.headers && data.rows) {
    headers = data.headers;
    rows = data.rows;
  } else if (Array.isArray(data)) {
    // If array, try to infer headers from first row
    if (data.length > 0 && typeof data[0] === 'object') {
      headers = Object.keys(data[0]);
      rows = data.map(row => Object.values(row));
    } else {
      rows = data;
    }
  }
  
  // Add headers if available
  if (headers.length > 0) {
    csvContent += headers.map(h => `"${String(h || '').replace(/"/g, '""')}"`).join(',') + '\n';
  }
  
  // Add data rows
  rows.forEach(row => {
    if (Array.isArray(row)) {
      csvContent += row.map(cell => {
        const value = cell === null || cell === undefined ? '' : String(cell);
        return `"${value.replace(/"/g, '""')}"`;
      }).join(',') + '\n';
    } else if (typeof row === 'object') {
      // Extract values in header order
      const values = headers.map(h => {
        const value = row[h] !== undefined ? row[h] : '';
        return String(value || '').replace(/"/g, '""');
      });
      csvContent += values.map(v => `"${v}"`).join(',') + '\n';
    }
  });
  
  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export data to Excel (using CSV format with .xlsx extension - basic implementation)
 * For full Excel support, consider using a library like xlsx
 */
export const exportToExcel = (data, filename) => {
  // For now, use CSV format (Excel can open CSV files)
  // In production, use a library like 'xlsx' for proper Excel format
  exportToCSV(data, filename);
};

/**
 * Export data to PDF (professional styling)
 */
export const exportToPDF = (title, content, filename, metadata = {}) => {
  const { storeName = '', period = '', generatedBy = '', generatedDate = new Date().toLocaleDateString() } = metadata;
  
  // Create HTML content with professional styling
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @page {
          margin: 1.5cm;
          size: A4;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 11pt;
          line-height: 1.6;
          color: #2c3e50;
          background: #fff;
        }
        .header {
          border-bottom: 3px solid #2d8659;
          padding-bottom: 15px;
          margin-bottom: 25px;
        }
        .header h1 {
          color: #2d8659;
          font-size: 24pt;
          font-weight: 600;
          margin-bottom: 5px;
        }
        .header .subtitle {
          color: #7f8c8d;
          font-size: 10pt;
          margin-top: 5px;
        }
        .metadata {
          display: flex;
          justify-content: space-between;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #ecf0f1;
          font-size: 9pt;
          color: #7f8c8d;
        }
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 25px;
        }
        .summary-card {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 15px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .summary-card.positive {
          background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
          border-color: #28a745;
        }
        .summary-card.negative {
          background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
          border-color: #dc3545;
        }
        .summary-card.neutral {
          background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%);
          border-color: #17a2b8;
        }
        .summary-card .label {
          font-size: 9pt;
          color: #6c757d;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
          font-weight: 600;
        }
        .summary-card .value {
          font-size: 20pt;
          font-weight: 700;
          color: #2c3e50;
        }
        .summary-card.positive .value {
          color: #155724;
        }
        .summary-card.negative .value {
          color: #721c24;
        }
        .summary-card.neutral .value {
          color: #0c5460;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border-radius: 6px;
          overflow: hidden;
        }
        thead {
          background: linear-gradient(135deg, #2d8659 0%, #256b49 100%);
          color: white;
        }
        th {
          padding: 12px 15px;
          text-align: left;
          font-weight: 600;
          font-size: 9pt;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border: none;
        }
        th.text-right {
          text-align: right;
        }
        tbody tr {
          border-bottom: 1px solid #e9ecef;
        }
        tbody tr:last-child {
          border-bottom: none;
        }
        tbody tr:nth-child(even) {
          background-color: #f8f9fa;
        }
        tbody tr:hover {
          background-color: #e9ecef;
        }
        td {
          padding: 10px 15px;
          font-size: 10pt;
          border: none;
        }
        td.text-right {
          text-align: right;
        }
        .currency {
          font-weight: 600;
          font-family: 'Courier New', monospace;
        }
        .badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 8pt;
          font-weight: 600;
          text-transform: uppercase;
        }
        .badge-success {
          background: #d4edda;
          color: #155724;
        }
        .badge-warning {
          background: #fff3cd;
          color: #856404;
        }
        .badge-danger {
          background: #f8d7da;
          color: #721c24;
        }
        .section {
          margin: 30px 0;
          page-break-inside: avoid;
        }
        .section-title {
          font-size: 14pt;
          font-weight: 600;
          color: #2d8659;
          margin-bottom: 15px;
          padding-bottom: 8px;
          border-bottom: 2px solid #e9ecef;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #ecf0f1;
          text-align: center;
          font-size: 8pt;
          color: #95a5a6;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin: 20px 0;
        }
        .grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin: 20px 0;
        }
        .grid-4 {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin: 20px 0;
        }
        @media print {
          body { margin: 0; }
          .page-break {
            page-break-before: always;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        ${storeName ? `<div class="subtitle">Store: ${storeName}</div>` : ''}
        ${period ? `<div class="subtitle">Period: ${period}</div>` : ''}
        <div class="metadata">
          <span>Generated: ${generatedDate}</span>
          ${generatedBy ? `<span>By: ${generatedBy}</span>` : ''}
        </div>
      </div>
      ${content}
      <div class="footer">
        <p>This report was generated by RetailCloudHQ</p>
        <p>Confidential - For internal use only</p>
      </div>
    </body>
    </html>
  `;
  
  // Open in new window for printing
  const printWindow = window.open('', '_blank');
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  
  // Wait for content to load, then print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
};

/**
 * Format table data for export
 */
export const formatTableForExport = (tableData, columns) => {
  const headers = columns.map(col => col.label || col.key);
  const rows = tableData.map(row => {
    return columns.map(col => {
      const value = col.accessor ? col.accessor(row) : row[col.key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return value;
    });
  });
  
  return { headers, rows };
};

