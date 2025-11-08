import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const ColumnMappingEditor = ({ 
  googleSheetColumns = [], 
  dataType = 'lottery', 
  existingMapping = {},
  onMappingChange 
}) => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  // Define database fields for each data type
  const getDatabaseFields = () => {
    if (dataType === 'lottery' || dataType === 'lottery_weekly') {
      return [
        { field: 'entry_date', label: 'Date', required: true, category: 'basic' },
        // Accounting fields (shown first for importance)
        { field: 'daily_draw_sales', label: 'Daily Draw Sales', required: true, category: 'accounting' },
        { field: 'daily_draw_net', label: 'Daily Draw Net', required: true, category: 'accounting' },
        { field: 'daily_instant_sales', label: 'Daily Instant Sales', required: true, category: 'accounting' },
        { field: 'daily_instant_adjustment', label: 'Daily Instant Adjustment', required: true, category: 'accounting' },
        { field: 'daily_instant_pay', label: 'Daily Instant Pay', required: true, category: 'accounting' },
        { field: 'daily_lottery_card_transaction', label: 'Daily Lottery Card Transaction', required: true, category: 'accounting' },
        // Other fields
        { field: 'retailer_number', label: 'Retailer Number', required: false, category: 'basic' },
        { field: 'location_name', label: 'Location Name', required: false, category: 'basic' },
        { field: 'balance_forward', label: 'Balance Forward', required: false, category: 'basic' },
        { field: 'draw_sales', label: 'Draw Sales', required: false, category: 'detailed' },
        { field: 'draw_cancels', label: 'Draw Cancels', required: false, category: 'detailed' },
        { field: 'draw_promos', label: 'Draw Promos', required: false, category: 'detailed' },
        { field: 'draw_comm', label: 'Draw Comm', required: false, category: 'detailed' },
        { field: 'draw_pays', label: 'Draw Pays', required: false, category: 'detailed' },
        { field: 'vch_iss', label: 'VCH ISS', required: false, category: 'detailed' },
        { field: 'vch_rd', label: 'VCH RD', required: false, category: 'detailed' },
        { field: 'webcash_iss', label: 'WebCash ISS', required: false, category: 'detailed' },
        { field: 'draw_adj', label: 'Draw Adj', required: false, category: 'detailed' },
        { field: 'draw_due', label: 'Draw Due', required: false, category: 'detailed' },
        { field: 'scratch_offs_sales', label: 'Scratch-Offs Sales', required: false, category: 'detailed' },
        { field: 'scratch_offs_rtrns', label: 'Scratch-Offs Rtrns', required: false, category: 'detailed' },
        { field: 'scratch_offs_comm', label: 'Scratch-Offs Comm', required: false, category: 'detailed' },
        { field: 'scratch_offs_prms', label: 'Scratch-Offs Prms', required: false, category: 'detailed' },
        { field: 'scratch_offs_pays', label: 'Scratch-Offs Pays', required: false, category: 'detailed' },
        { field: 'scratch_offs_adj', label: 'Scratch-Offs Adj', required: false, category: 'detailed' },
        { field: 'scratch_offs_due', label: 'Scratch-Offs Due', required: false, category: 'detailed' },
        { field: 'card_trans', label: 'Card Trans', required: false, category: 'detailed' },
        { field: 'gift_cards', label: 'Gift Cards', required: false, category: 'detailed' },
        { field: 'prepaid', label: 'Prepaid', required: false, category: 'detailed' },
        { field: 'total_due', label: 'Total Due', required: false, category: 'basic' },
      ];
    } else if (dataType === 'revenue') {
      return [
        { field: 'entry_date', label: 'Date', required: true },
        { field: 'business_credit_card', label: 'Business Credit Card', required: false },
        { field: 'credit_card_transaction_fees', label: 'Credit Card Transaction Fees', required: false },
      ];
    } else if (dataType === 'cashflow') {
      return [
        { field: 'entry_date', label: 'Date', required: true },
        { field: 'ending_cash_on_hand', label: 'Ending Cash on Hand', required: false },
        { field: 'beginning_cash', label: 'Beginning Cash', required: false },
        { field: 'business_daily_cash', label: 'Business Daily Cash', required: false },
        { field: 'payroll_paid', label: 'Payroll Paid', required: false },
      ];
    }
    return [];
  };

  const databaseFields = getDatabaseFields();
  const [columnMapping, setColumnMapping] = useState(() => {
    // Initialize with existing mapping or default mapping
    const mapping = {};
    databaseFields.forEach(dbField => {
      // First try existing mapping, then try to auto-match by label
      if (existingMapping[dbField.field]) {
        mapping[dbField.field] = existingMapping[dbField.field];
      } else {
        // Try to auto-match by label (case-insensitive, handle spaces)
        const match = googleSheetColumns.find(col => {
          const normalizedCol = col.trim();
          const normalizedLabel = dbField.label.toLowerCase().replace(/\s+/g, ' ');
          return normalizedCol.toLowerCase() === normalizedLabel ||
                 normalizedCol.toLowerCase().replace(/\s+/g, ' ') === normalizedLabel;
        });
        if (match) {
          mapping[dbField.field] = match;
        }
      }
    });
    return mapping;
  });

  useEffect(() => {
    // Notify parent of mapping changes
    if (onMappingChange) {
      const lotteryMapping = {};
      databaseFields.forEach(dbField => {
        if (columnMapping[dbField.field]) {
          lotteryMapping[dbField.field] = columnMapping[dbField.field];
        }
      });
      
      // Wrap in the data_type key
      const wrappedMapping = {};
      if (dataType === 'lottery' || dataType === 'lottery_weekly') {
        wrappedMapping.lottery = lotteryMapping;
      } else if (dataType === 'revenue') {
        wrappedMapping.revenue = lotteryMapping;
      } else if (dataType === 'cashflow') {
        wrappedMapping.cashflow = lotteryMapping;
      }
      
      onMappingChange(wrappedMapping);
    }
  }, [columnMapping, dataType]);

  const handleMappingChange = (dbField, sheetColumn) => {
    setColumnMapping(prev => ({
      ...prev,
      [dbField]: sheetColumn || ''
    }));
  };

  if (!isSuperAdmin) {
    return null; // Only super admins can edit column mappings
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-1">Column Mapping</h4>
        <p className="text-xs text-gray-600">
          Map Google Sheets columns to database fields. Only required fields need to be mapped.
        </p>
      </div>

      {googleSheetColumns.length === 0 ? (
        <div className="text-sm text-gray-500 text-center py-4">
          <p>Test the connection first to see available columns from your Google Sheet.</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {/* Accounting Fields Section */}
          <div>
            <h5 className="text-xs font-semibold text-[#2d8659] mb-2 uppercase tracking-wide">
              📊 Accounting Fields (Required)
            </h5>
            <div className="space-y-3 pl-4 border-l-2 border-[#2d8659]">
              {databaseFields
                .filter(f => f.category === 'accounting')
                .map((dbField) => (
                  <div key={dbField.field} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-medium text-gray-900 mb-1">
                        {dbField.label}
                        {dbField.required && <span className="text-red-500 ml-1">*</span>}
                        <span className="text-gray-400 text-xs ml-2">({dbField.field})</span>
                      </label>
                    </div>
                    <div className="flex-1">
                      <select
                        value={columnMapping[dbField.field] || ''}
                        onChange={(e) => handleMappingChange(dbField.field, e.target.value)}
                        className="w-full text-sm border-2 border-[#2d8659] rounded-md px-2 py-1 focus:outline-none focus:ring-[#2d8659] focus:border-[#2d8659] font-medium"
                      >
                        <option value="">-- Select Column --</option>
                        {googleSheetColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Basic Fields Section */}
          <div>
            <h5 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Basic Information
            </h5>
            <div className="space-y-2 pl-4 border-l-2 border-gray-200">
              {databaseFields
                .filter(f => f.category === 'basic')
                .map((dbField) => (
                  <div key={dbField.field} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {dbField.label}
                        {dbField.required && <span className="text-red-500 ml-1">*</span>}
                        <span className="text-gray-400 text-xs ml-2">({dbField.field})</span>
                      </label>
                    </div>
                    <div className="flex-1">
                      <select
                        value={columnMapping[dbField.field] || ''}
                        onChange={(e) => handleMappingChange(dbField.field, e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-[#2d8659] focus:border-[#2d8659]"
                      >
                        <option value="">-- Select Column --</option>
                        {googleSheetColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Detailed Fields Section (Collapsible) */}
          <details className="group">
            <summary className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide cursor-pointer hover:text-gray-900">
              Detailed Fields (Optional)
            </summary>
            <div className="space-y-2 pl-4 border-l-2 border-gray-200 mt-2">
              {databaseFields
                .filter(f => f.category === 'detailed')
                .map((dbField) => (
                  <div key={dbField.field} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {dbField.label}
                        {dbField.required && <span className="text-red-500 ml-1">*</span>}
                        <span className="text-gray-400 text-xs ml-2">({dbField.field})</span>
                      </label>
                    </div>
                    <div className="flex-1">
                      <select
                        value={columnMapping[dbField.field] || ''}
                        onChange={(e) => handleMappingChange(dbField.field, e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-[#2d8659] focus:border-[#2d8659]"
                      >
                        <option value="">-- Select Column --</option>
                        {googleSheetColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
            </div>
          </details>
        </div>
      )}

      {/* Show mapping summary */}
      {Object.keys(columnMapping).filter(key => columnMapping[key]).length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-600">
            <span className="font-semibold">
              {Object.keys(columnMapping).filter(key => columnMapping[key]).length}
            </span> of {databaseFields.length} fields mapped
          </p>
        </div>
      )}
    </div>
  );
};

export default ColumnMappingEditor;

