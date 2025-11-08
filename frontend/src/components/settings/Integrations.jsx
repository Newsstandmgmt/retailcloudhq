import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../contexts/StoreContext';
import { googleSheetsAPI } from '../../services/api';
import LotteryEmailSettings from '../lottery/LotteryEmailSettings';
import ColumnMappingEditor from './ColumnMappingEditor';

const Integrations = () => {
  const { user } = useAuth();
  const { selectedStore } = useStore();
  const [activeTab, setActiveTab] = useState('google-sheets');

  if (!selectedStore) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Please select a store to manage integrations.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'google-sheets', label: 'Google Sheets', icon: '📊' },
    { id: 'gmail', label: 'Gmail', icon: '📧' },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Integrations</h2>
        <p className="text-gray-600">
          Connect external services to automatically import data into your store. Configure Google Sheets for data import or Gmail for lottery report emails.
        </p>
      </div>

      {/* Integration Type Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-[#2d8659] text-[#2d8659]'
                    : 'border-transparent text-gray-600 hover:text-[#2d8659] hover:border-[#2d8659]'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'google-sheets' && (
            <GoogleSheetsIntegration storeId={selectedStore.id} />
          )}
          {activeTab === 'gmail' && (
            <GmailIntegration storeId={selectedStore.id} />
          )}
        </div>
      </div>
    </div>
  );
};

// Google Sheets Integration Component
const GoogleSheetsIntegration = ({ storeId }) => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [selectedDataType, setSelectedDataType] = useState('lottery');
  const [fixingMappings, setFixingMappings] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, [storeId]);

  const loadConfigs = async () => {
    try {
      const response = await googleSheetsAPI.getStoreConfig(storeId);
      setConfigs(response.data.configurations || []);
    } catch (error) {
      console.error('Error loading Google Sheets configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFixColumnMappings = async () => {
    if (!window.confirm('This will add default column mappings to any configurations that are missing them. Continue?')) {
      return;
    }
    
    setFixingMappings(true);
    try {
      const response = await googleSheetsAPI.fixColumnMappings(storeId);
      alert(`Successfully fixed ${response.data.fixed} configuration(s). Please try syncing again.`);
      loadConfigs(); // Reload to show updated configs
    } catch (error) {
      alert('Error fixing column mappings: ' + (error.response?.data?.error || error.message));
    } finally {
      setFixingMappings(false);
    }
  };

  const dataTypes = [
    { value: 'lottery', label: 'Daily Lottery', description: 'Import daily lottery sales data' },
    { value: 'lottery_weekly', label: 'Weekly Lottery', description: 'Import weekly lottery data' },
    { value: 'revenue', label: 'Revenue / Credit Card Sales', description: 'Import POS/credit card sales data' },
    { value: 'cashflow', label: 'Cash Flow', description: 'Import cash flow data' },
  ];

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#2d8659]"></div>
        <p className="mt-4 text-gray-600">Loading configurations...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Google Sheets Integration</h3>
          <p className="text-gray-600 text-sm">
            Connect your Google Sheets to automatically import data. Each data type (Lottery, Revenue, etc.) can use a different Google Sheet or the same sheet with different tabs.
          </p>
        </div>
        <button
          onClick={handleFixColumnMappings}
          disabled={fixingMappings || configs.length === 0}
          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          title="Fix missing column mappings in existing configurations"
        >
          {fixingMappings ? 'Fixing...' : '🔧 Fix Column Mappings'}
        </button>
      </div>

      {/* Existing Configurations */}
      {configs.length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">Configured Integrations</h4>
          <div className="space-y-4">
            {configs.map((config) => (
              <GoogleSheetsConfigCard
                key={config.id}
                config={config}
                storeId={storeId}
                onUpdate={loadConfigs}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add New Configuration */}
      <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
        <h4 className="text-md font-medium text-gray-900 mb-4">
          {configs.length > 0 ? 'Add Another Integration' : 'Setup Google Sheets Integration'}
        </h4>
        
        {!showSetup ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Data Type to Configure
              </label>
              <select
                value={selectedDataType}
                onChange={(e) => setSelectedDataType(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-[#2d8659] focus:border-[#2d8659]"
              >
                {dataTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {dataTypes.find(t => t.value === selectedDataType)?.description}
              </p>
            </div>
            <button
              onClick={() => setShowSetup(true)}
              className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#25634d] transition-colors"
            >
              Configure {dataTypes.find(t => t.value === selectedDataType)?.label}
            </button>
          </div>
        ) : (
          <GoogleSheetsSetup
            storeId={storeId}
            dataType={selectedDataType}
            existingConfigs={configs}
            onSuccess={() => {
              setShowSetup(false);
              loadConfigs();
            }}
            onCancel={() => setShowSetup(false)}
          />
        )}
      </div>
    </div>
  );
};

// Gmail Integration Component
const GmailIntegration = ({ storeId }) => {
  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Gmail Integration</h3>
        <p className="text-gray-600 text-sm">
          Connect your Gmail account to automatically import lottery reports from emails. The system will read emails and extract lottery data from CSV attachments.
        </p>
      </div>
      <LotteryEmailSettings storeId={storeId} />
    </div>
  );
};

// Google Sheets Setup Component
const GoogleSheetsSetup = ({ storeId, dataType, existingConfigs = [], onSuccess, onCancel }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    spreadsheet_id: '',
    sheet_name: 'Sheet1',
    service_account_key: '',
    auto_sync_enabled: true,
    sync_frequency: 'daily',
    data_type: dataType,
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [customColumnMapping, setCustomColumnMapping] = useState(null);
  const [showColumnMapping, setShowColumnMapping] = useState(false);

  // Update data_type when prop changes
  useEffect(() => {
    setFormData(prev => ({ ...prev, data_type: dataType }));
  }, [dataType]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target.result);
          setFormData({
            ...formData,
            service_account_key: JSON.stringify(json),
          });
        } catch (error) {
          setError('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleTest = async () => {
    if (!formData.spreadsheet_id || !formData.sheet_name || !formData.service_account_key) {
      setError('Please fill in all required fields');
      return;
    }

    setTesting(true);
    setError('');
    setTestResult(null);

    try {
      const response = await googleSheetsAPI.testConnection(storeId, {
        spreadsheet_id: formData.spreadsheet_id,
        sheet_name: formData.sheet_name,
        service_account_key: formData.service_account_key,
      });

      setTestResult(response.data);
      // Auto-show column mapping if columns are found and user is super admin
      if (response.data.headers && response.data.headers.length > 0) {
        setShowColumnMapping(true);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.spreadsheet_id || !formData.sheet_name || !formData.service_account_key) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Use custom column mapping if provided, otherwise use default
      let columnMapping = customColumnMapping;
      
      if (!columnMapping || Object.keys(columnMapping).length === 0) {
        // Build default column mapping based on data type
        columnMapping = {};
        
        if (formData.data_type === 'lottery' || formData.data_type === 'lottery_weekly') {
          columnMapping.lottery = {
            entry_date: 'Date',
            retailer_number: 'Retailer Number',
            location_name: 'Location Name',
            balance_forward: 'Balance Forward',
            draw_sales: 'Draw Sales',
            draw_cancels: 'Draw Cancels',
            draw_promos: 'Draw Promos',
            draw_comm: 'Draw  Comm', // Note: space before Comm
            draw_pays: 'Draw Pays',
            vch_iss: 'VCH ISS',
            vch_rd: 'VCH RD',
            webcash_iss: 'WebCash ISS',
            draw_adj: 'Draw Adj',
            draw_due: 'Draw Due',
            scratch_offs_sales: 'Scratch- Offs Sales', // Note: space before Offs
            scratch_offs_rtrns: 'Scratch- Offs Rtrns',
            scratch_offs_comm: 'Scratch- Offs Comm',
            scratch_offs_prms: 'Scratch- Offs Prms',
            scratch_offs_pays: 'Scratch- Offs Pays',
            scratch_offs_adj: 'Scratch- Offs Adj',
            scratch_offs_due: 'Scratch- Offs Due',
            card_trans: 'Card Trans',
            gift_cards: 'Gift Cards',
            prepaid: 'Prepaid ', // Note: trailing space
            total_due: 'Total Due',
          };
        } else if (formData.data_type === 'revenue') {
          columnMapping.revenue = {
            entry_date: 'Date',
            business_credit_card: 'Total Gross Amount ($)',
            credit_card_transaction_fees: 'Total Processing Fee ($)',
          };
        } else if (formData.data_type === 'cashflow') {
          columnMapping.cashflow = {
            entry_date: 'Date',
            ending_cash_on_hand: 'Ending Cash',
            beginning_cash: 'Beginning Cash',
            business_daily_cash: 'Business Cash',
            payroll_paid: 'Payroll',
          };
        }
      }

      // Ensure data_type is explicitly set from the form
      const configData = {
        ...formData,
        data_type: formData.data_type || dataType, // Use formData first, fallback to prop
        column_mapping: columnMapping,
      };
      
      console.log('Saving config with data_type:', configData.data_type); // Debug log
      
      await googleSheetsAPI.createConfig(storeId, configData);

      onSuccess();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {testResult && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          <p className="font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Connection successful!
          </p>
          <p className="text-sm mt-1">Found {testResult.headers?.length || 0} columns</p>
        </div>
      )}

      {/* Data Type Display (Read-only) */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <label className="block text-sm font-medium text-blue-900 mb-1">
          Data Type Being Configured
        </label>
        <p className="text-sm text-blue-700 font-semibold">
          {formData.data_type === 'lottery' ? 'Daily Lottery' :
           formData.data_type === 'lottery_weekly' ? 'Weekly Lottery' :
           formData.data_type === 'revenue' ? 'Revenue / Credit Card Sales' :
           formData.data_type === 'cashflow' ? 'Cash Flow' : formData.data_type}
        </p>
        <p className="text-xs text-blue-600 mt-1">
          To change this, go back and select a different data type
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Google Spreadsheet ID *
        </label>
        <input
          type="text"
          name="spreadsheet_id"
          required
          value={formData.spreadsheet_id}
          onChange={handleChange}
          placeholder="Extract from Google Sheets URL"
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-[#2d8659] focus:border-[#2d8659]"
        />
        <p className="text-xs text-gray-500 mt-1">
          Get this from your Google Sheet URL (the long ID between /d/ and /edit)
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Sheet Name (Tab Name) *
        </label>
        <input
          type="text"
          name="sheet_name"
          required
          value={formData.sheet_name}
          onChange={handleChange}
          placeholder="Sheet1"
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-[#2d8659] focus:border-[#2d8659]"
        />
        <p className="text-xs text-gray-500 mt-1">
          The name of the tab/sheet within your spreadsheet
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Service Account JSON Key *
        </label>
        <textarea
          name="service_account_key"
          required
          value={formData.service_account_key}
          onChange={handleChange}
          rows="6"
          placeholder='{"type":"service_account","project_id":"..."}'
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-[#2d8659] focus:border-[#2d8659] font-mono text-sm"
        />
        <div className="mt-2">
          <label className="block text-sm text-gray-600 mb-1">Or upload JSON file:</label>
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="text-sm"
          />
        </div>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          name="auto_sync_enabled"
          checked={formData.auto_sync_enabled}
          onChange={handleChange}
          className="h-4 w-4 text-[#2d8659] focus:ring-[#2d8659] border-gray-300 rounded"
        />
        <label className="ml-2 block text-sm text-gray-700">
          Enable automatic daily sync
        </label>
      </div>

      {formData.auto_sync_enabled && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sync Frequency
          </label>
          <select
            name="sync_frequency"
            value={formData.sync_frequency}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-[#2d8659] focus:border-[#2d8659]"
          >
            <option value="hourly">Hourly</option>
            <option value="daily">Daily (2 AM)</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleTest}
          disabled={testing}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        {testResult && testResult.headers && user?.role === 'super_admin' && (
          <button
            type="button"
            onClick={() => setShowColumnMapping(!showColumnMapping)}
            className="px-4 py-2 border border-[#2d8659] text-[#2d8659] rounded-md hover:bg-green-50"
          >
            {showColumnMapping ? 'Hide' : 'Show'} Column Mapping
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !testResult}
          className="px-4 py-2 bg-[#2d8659] text-white rounded-md hover:bg-[#25634d] disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {/* Column Mapping Editor - Only for super admins */}
      {showColumnMapping && testResult && testResult.headers && (
        <div className="mt-6">
          <ColumnMappingEditor
            googleSheetColumns={testResult.headers}
            dataType={formData.data_type}
            existingMapping={customColumnMapping?.lottery || customColumnMapping?.revenue || customColumnMapping?.cashflow || {}}
            onMappingChange={setCustomColumnMapping}
          />
        </div>
      )}
    </form>
  );
};

// Google Sheets Config Card Component
const GoogleSheetsConfigCard = ({ config, storeId, onUpdate }) => {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await googleSheetsAPI.sync(storeId, config.data_type || 'lottery');
      alert('Sync completed successfully!');
      onUpdate();
    } catch (error) {
      alert('Sync failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this integration?')) {
      return;
    }
    try {
      await googleSheetsAPI.deleteConfig(storeId, config.id);
      onUpdate();
    } catch (error) {
      alert('Failed to delete: ' + (error.response?.data?.error || error.message));
    }
  };

  const getDataTypeLabel = (type) => {
    const labels = {
      lottery: 'Daily Lottery',
      lottery_weekly: 'Weekly Lottery',
      revenue: 'Revenue / Credit Card Sales',
      cashflow: 'Cash Flow',
    };
    return labels[type] || type;
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">{getDataTypeLabel(config.data_type)}</h3>
          <p className="text-sm text-gray-600">
            Spreadsheet: {config.spreadsheet_id?.substring(0, 30)}...
          </p>
          <p className="text-sm text-gray-600">Sheet: {config.sheet_name}</p>
        </div>
        <div className="text-right">
          <span
            className={`px-2 py-1 rounded text-xs ${
              config.auto_sync_enabled
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {config.auto_sync_enabled ? 'Auto-sync ON' : 'Auto-sync OFF'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {config.last_sync_at && (
            <span>
              Last sync: {new Date(config.last_sync_at).toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3 py-1 bg-[#2d8659] text-white text-sm rounded hover:bg-[#25634d] disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default Integrations;

