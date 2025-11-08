import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { storesAPI, googleSheetsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const StoreIntegrations = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [store, setStore] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [syncLogs, setSyncLogs] = useState([]);

  useEffect(() => {
    if (storeId) {
      loadStore();
      loadConfigs();
      loadSyncLogs();
    }
  }, [storeId]);

  const loadStore = async () => {
    try {
      const response = await storesAPI.getById(storeId);
      setStore(response.data.store);
    } catch (error) {
      console.error('Error loading store:', error);
    }
  };

  const loadConfigs = async () => {
    try {
      const response = await googleSheetsAPI.getStoreConfig(storeId);
      setConfigs(response.data.configurations || []);
    } catch (error) {
      console.error('Error loading configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSyncLogs = async () => {
    try {
      const response = await googleSheetsAPI.getLogs(storeId);
      setSyncLogs(response.data.logs || []);
    } catch (error) {
      console.error('Error loading sync logs:', error);
    }
  };

  const handleSync = async (syncType) => {
    try {
      const response = await googleSheetsAPI.sync(storeId, syncType);
      alert(`Sync completed: ${response.data.result.status}\nRecords processed: ${response.data.result.records_processed}`);
      loadSyncLogs();
    } catch (error) {
      alert('Sync failed: ' + (error.response?.data?.error || error.message));
    }
  };

  if (!user || (user.role !== 'super_admin' && user.role !== 'admin')) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Access denied. Only Super Admin and Admin can manage integrations.
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link to="/stores" className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
          ← Back to Stores
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          Integrations - {store?.name}
        </h1>
        <p className="text-gray-600">Manage Google Sheets integration for this store</p>
      </div>

      {/* Google Sheets Integration Section */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Google Sheets Integration</h2>
            <p className="text-sm text-gray-600">Automatically sync lottery and revenue data from Google Sheets</p>
          </div>
          {configs.length === 0 && (
            <button
              onClick={() => setShowSetup(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Setup Google Sheets
            </button>
          )}
        </div>

        <div className="p-6">
          {showSetup ? (
            <GoogleSheetsSetup
              storeId={storeId}
              existingConfigs={configs}
              onSuccess={() => {
                setShowSetup(false);
                loadConfigs();
              }}
              onCancel={() => setShowSetup(false)}
            />
          ) : configs.length > 0 ? (
            <div className="space-y-4">
              {configs.map((config) => (
                <GoogleSheetsConfigCard
                  key={config.id}
                  config={config}
                  storeId={storeId}
                  onUpdate={loadConfigs}
                  onSync={handleSync}
                  onDelete={handleDelete}
                  onToggleSync={handleToggleSync}
                />
              ))}
              <button
                onClick={() => setShowSetup(true)}
                className="mt-4 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
              >
                + Add Another Integration
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-4">No Google Sheets integration configured.</p>
              <p className="text-sm mb-4">Set up daily lottery, weekly lottery, or both from the same Google Sheet.</p>
              <button
                onClick={() => setShowSetup(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Setup Google Sheets Integration
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sync Logs */}
      {syncLogs.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Sync Logs</h2>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Records</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {syncLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 text-sm">
                        {new Date(log.sync_started_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm capitalize">{log.sync_type}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            log.status === 'success'
                              ? 'bg-green-100 text-green-800'
                              : log.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {log.records_processed} processed ({log.records_added} added)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Google Sheets Setup Component
const GoogleSheetsSetup = ({ storeId, existingConfigs = [], onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    spreadsheet_id: '',
    sheet_name: 'Sheet1',
    service_account_key: '',
    auto_sync_enabled: true,
    sync_frequency: 'daily',
    data_type: 'lottery', // 'lottery' for daily, 'lottery_weekly' for weekly
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      // Use the lottery column mapping (same for daily and weekly)
      const lotteryMapping = {
        entry_date: 'Date',
        retailer_number: 'Retailer Number',
        location_name: 'Location Name',
        balance_forward: 'Balance Forward',
        draw_sales: 'Draw Sales',
        draw_cancels: 'Draw Cancels',
        draw_promos: 'Draw Promos',
        draw_comm: 'Draw Comm',
        draw_pays: 'Draw Pays',
        vch_iss: 'VCH ISS',
        vch_rd: 'VCH RD',
        webcash_iss: 'WebCash ISS',
        draw_adj: 'Draw Adj',
        draw_due: 'Draw Due',
        scratch_offs_sales: 'Scratch-Offs Sales',
        scratch_offs_rtrns: 'Scratch-Offs Rtrns',
        scratch_offs_comm: 'Scratch-Offs Comm',
        scratch_offs_prms: 'Scratch-Offs Prms',
        scratch_offs_pays: 'Scratch-Offs Pays',
        scratch_offs_adj: 'Scratch-Offs Adj',
        scratch_offs_due: 'Scratch-Offs Due',
        card_trans: 'Card Trans',
        gift_cards: 'Gift Cards',
        prepaid: 'Prepaid',
        total_due: 'Total Due',
      };

      // POS/CC Data mapping
      const revenueMapping = {
        entry_date: 'Date',
        business_credit_card: 'Total Gross Amount ($)',
        credit_card_transaction_fees: 'Total Processing Fee ($)',
      };

      // Build column mapping based on data type
      const columnMapping = {};
      
      if (formData.data_type === 'lottery' || formData.data_type === 'lottery_weekly') {
        columnMapping.lottery = lotteryMapping;
        columnMapping.lottery_weekly = lotteryMapping;
      } else if (formData.data_type === 'revenue') {
        columnMapping.revenue = revenueMapping;
      } else if (formData.data_type === 'cashflow') {
        // Cash flow mapping can be added later if needed
        columnMapping.cashflow = {};
      }

      await googleSheetsAPI.createConfig(storeId, {
        ...formData,
        column_mapping: columnMapping,
      });

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
          placeholder="Extract from Google Sheets URL: docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit"
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          Get this from your Google Sheet URL (the long ID between /d/ and /edit)
        </p>
        {existingConfigs.length > 0 && (
          <p className="text-xs text-blue-600 mt-1">
            💡 Tip: You can use the same spreadsheet ID for daily and weekly lottery (just different sheet names)
          </p>
        )}
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
          placeholder="Sheet1 or Weekly"
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          For daily lottery: use "Sheet1" or your daily tab name<br/>
          For weekly lottery: use your weekly tab name (e.g., "Weekly", "Weekly Data")
        </p>
        {existingConfigs.length > 0 && (
          <p className="text-xs text-blue-600 mt-1">
            Existing integrations: {existingConfigs.map(c => `${c.sheet_name} (${c.data_type?.replace('_', ' ')})`).join(', ')}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Data Type *
        </label>
        <select
          name="data_type"
          value={formData.data_type}
          onChange={handleChange}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="lottery">Daily Lottery</option>
          <option value="lottery_weekly">Weekly Lottery</option>
          <option value="revenue">Revenue / POS/CC Data</option>
          <option value="cashflow">Cash Flow</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          {formData.data_type === 'revenue' && (
            <>For POS/CC data: Select "Revenue" and map Total Gross Amount → Credit Card, Processing Fee → Transaction Fees</>
          )}
          {formData.data_type === 'lottery' && <>Select "Daily Lottery" for daily lottery data</>}
          {formData.data_type === 'lottery_weekly' && <>Select "Weekly Lottery" for weekly lottery data</>}
          {formData.data_type === 'cashflow' && <>Select "Cash Flow" for cash flow data</>}
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
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
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
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="hourly">Hourly</option>
            <option value="daily">Daily (2 AM)</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
      )}

      <div className="flex space-x-4">
        <button
          type="button"
          onClick={handleTest}
          disabled={testing}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
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
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </form>
  );
};

// Google Sheets Config Card Component
const GoogleSheetsConfigCard = ({ config, storeId, onUpdate, onSync, onDelete, onToggleSync }) => {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async (syncType) => {
    setSyncing(true);
    try {
      await onSync(syncType);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Google Sheets Integration</h3>
          <p className="text-sm text-gray-600">
            Spreadsheet: {config.spreadsheet_id.substring(0, 20)}...
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
          {config.last_sync_status && (
            <p className="text-xs text-gray-500 mt-1">
              Last sync: {config.last_sync_status}
            </p>
          )}
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-gray-600">
          Type: <span className="font-semibold capitalize">{config.data_type?.replace('_', ' ')}</span>
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.auto_sync_enabled}
              onChange={(e) => onToggleSync(config.id, e.target.checked)}
              className="rounded"
            />
            <span className="text-gray-600">Auto Sync</span>
          </label>
          <button
            onClick={() => onDelete(config.id)}
            className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
      <div className="flex space-x-2 flex-wrap gap-2">
        <button
          onClick={() => onSync(config.data_type || 'lottery')}
          disabled={syncing}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {syncing ? 'Syncing...' : `Sync ${config.data_type === 'lottery_weekly' ? 'Weekly' : config.data_type === 'lottery' ? 'Daily Lottery' : config.data_type === 'revenue' ? 'Revenue/POS' : config.data_type?.replace('_', ' ')}`}
        </button>
      </div>
    </div>
  );
};

export default StoreIntegrations;

