import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { storesAPI, statisticsAPI, revenueAPI, purchaseInvoicesAPI, expensesAPI, payrollAPI, storeSubscriptionsAPI, storeTemplatesAPI, stateLotteryConfigsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LotteryEmailSettings from '../components/lottery/LotteryEmailSettings';
import CashDrawerSettings from '../components/settings/CashDrawerSettings';
import SquareIntegrationSettings from '../components/settings/SquareIntegrationSettings';
import HandheldDevices from '../components/settings/HandheldDevices';
import { US_STATES } from '../utils/usStates';

const StoreDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [store, setStore] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    lottery_retailer_id: '',
  });
  const [templates, setTemplates] = useState([]);
  const [lotteryConfig, setLotteryConfig] = useState(null);
  const [integrationTab, setIntegrationTab] = useState('square');

  useEffect(() => {
    if (id && user?.role === 'super_admin') {
      loadStoreData();
      loadTemplates();
    }
  }, [id, user]);

  const loadStoreData = async () => {
    try {
      const [storeRes, statsRes] = await Promise.all([
        storesAPI.getById(id),
        statisticsAPI.getByStore(id).catch(() => ({ data: { statistics: null } }))
      ]);
      
      const storeData = storeRes.data.store;
      setStore(storeData);
      setFormData({
        name: storeData.name || '',
        address: storeData.address || '',
        city: storeData.city || '',
        state: storeData.state || '',
        zip_code: storeData.zip_code || '',
        phone: storeData.phone || '',
        lottery_retailer_id: storeData.lottery_retailer_id || '',
      });
      setStats(statsRes.data.statistics);
      
      // Load lottery config if state is set
      if (storeData.state) {
        try {
          const configRes = await stateLotteryConfigsAPI.getByStoreId(id);
          setLotteryConfig(configRes.data.config || null);
        } catch (error) {
          console.error('Error loading lottery config:', error);
        }
      }
    } catch (error) {
      console.error('Error loading store data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await storeTemplatesAPI.getAll();
      setTemplates(response.data.templates || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = async () => {
    try {
      await storesAPI.update(id, formData);
      setEditing(false);
      await loadStoreData();
      alert('Store settings updated successfully!');
    } catch (error) {
      alert('Error updating store: ' + (error.response?.data?.error || error.message));
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  if (user?.role !== 'super_admin') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Access denied. Only Super Admin can view store details.
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-6 text-center py-8">Loading store details...</div>;
  }

  if (!store) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Store not found.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link to="/stores" className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
          ← Back to Stores
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{store.name}</h1>
            <p className="text-gray-600">Store Management & Statistics</p>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => {
                    setEditing(false);
                    // Reset form data
                    setFormData({
                      name: store.name || '',
                      address: store.address || '',
                      city: store.city || '',
                      state: store.state || '',
                      zip_code: store.zip_code || '',
                      phone: store.phone || '',
                      lottery_retailer_id: store.lottery_retailer_id || '',
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Edit Store Settings
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Store Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <p className="text-sm text-gray-600 mb-1">Store Status</p>
          <p className={`text-2xl font-bold ${store.is_active ? 'text-green-600' : 'text-yellow-600'}`}>
            {store.is_active ? 'Active' : 'Deactivated'}
          </p>
          {store.template_id && (
            <p className="text-xs text-gray-500 mt-2">
              Plan: {templates.find(t => t.id === store.template_id)?.name || 'Unknown'}
            </p>
          )}
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-indigo-500">
          <p className="text-sm text-gray-600 mb-1">Location</p>
          <p className="text-lg font-semibold text-gray-900">
            {store.city && store.state ? `${store.city}, ${store.state}` : 'Not set'}
          </p>
          {store.lottery_retailer_id && (
            <p className="text-xs text-gray-500 mt-2">
              Retailer ID: {store.lottery_retailer_id}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <p className="text-sm text-gray-600 mb-1">Assigned Admin</p>
          {store.admin_id ? (
            <Link
              to={store.admin_id ? `/admin-management/${store.admin_id}` : '#'}
              onClick={(e) => {
                if (!store.admin_id) {
                  e.preventDefault();
                  alert('No admin assigned to this store.');
                }
              }}
              className="text-lg font-semibold text-blue-600 hover:text-blue-800"
            >
              View Admin →
            </Link>
          ) : (
            <p className="text-lg font-semibold text-gray-400">No admin assigned</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <p className="text-sm text-gray-600 mb-1">Employees & Managers</p>
          <p className="text-2xl font-bold text-gray-900">
            {stats?.employees?.total_employees ?? 0} employees
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {stats?.managers?.total_managers ?? 0} managers
          </p>
        </div>
      </div>

      {/* Cash Drawer Settings */}
      <div className="mb-6 bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Cash Drawer Settings</h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure cash drawer type and register starting cash amounts
          </p>
        </div>
        <div className="p-6">
          <CashDrawerSettings storeId={id} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Store Settings */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Store Settings</h2>
          </div>
          <div className="p-6 space-y-4">
            {editing ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Store Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State
                    </label>
                    <select
                      name="state"
                      value={formData.state || ''}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select State</option>
                      {US_STATES.map(state => (
                        <option key={state.code} value={state.code}>
                          {state.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Zip Code
                    </label>
                    <input
                      type="text"
                      name="zip_code"
                      value={formData.zip_code}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lottery Retailer ID
                  </label>
                  <input
                    type="text"
                    name="lottery_retailer_id"
                    value={formData.lottery_retailer_id}
                    onChange={handleChange}
                    placeholder="e.g., 780162"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    State Lottery assigned Retailer ID for this location.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Store Name</p>
                    <p className="text-base font-medium">{store.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Address</p>
                    <p className="text-base font-medium">{store.address || 'Not set'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">City</p>
                      <p className="text-base font-medium">{store.city || 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">State</p>
                      <p className="text-base font-medium">{store.state || 'Not set'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Zip Code</p>
                      <p className="text-base font-medium">{store.zip_code || 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="text-base font-medium">{store.phone || 'Not set'}</p>
                    </div>
                  </div>
                  {store.lottery_retailer_id && (
                    <div>
                      <p className="text-sm text-gray-600">Lottery Retailer ID</p>
                      <p className="text-base font-medium">{store.lottery_retailer_id}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Quick Actions</h2>
          </div>
          <div className="p-6 space-y-3">
            <Link
              to={`/revenue?storeId=${id}`}
              className="block w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
            >
              <p className="font-medium text-blue-900">View Revenue Data</p>
              <p className="text-sm text-blue-700">Manage daily revenue entries</p>
            </Link>
            <Link
              to={`/purchase-payments?storeId=${id}`}
              className="block w-full text-left px-4 py-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
            >
              <p className="font-medium text-green-900">View Purchase & Payments</p>
              <p className="text-sm text-green-700">Manage invoices and payments</p>
            </Link>
            <Link
              to={`/lottery?storeId=${id}`}
              className="block w-full text-left px-4 py-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
            >
              <p className="font-medium text-indigo-900">Manage Lottery</p>
              <p className="text-sm text-indigo-700">Lottery tracking and management</p>
            </Link>
          </div>
        </div>
      </div>

      {/* Store Integrations */}
      <div className="mt-6 bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Store Integrations</h2>
          <p className="text-sm text-gray-600">
            Manage POS and automated data imports for this store. Square and Gmail connections are configured per store.
          </p>
        </div>
        <div className="px-6 border-b border-gray-200 bg-gray-50">
          <nav className="flex -mb-px overflow-x-auto">
            {[
              { id: 'square', label: 'Square POS', icon: '💳' },
              { id: 'lottery', label: 'Lottery Email Import', icon: '📧' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setIntegrationTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                  integrationTab === tab.id
                    ? 'border-[#2d8659] text-[#2d8659]'
                    : 'border-transparent text-gray-600 hover:text-[#2d8659] hover:border-[#2d8659]'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="p-6">
          {integrationTab === 'square' && <SquareIntegrationSettings storeId={id} />}
          {integrationTab === 'lottery' && (
            <>
              {store.state ? (
                <>
                  {lotteryConfig && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-blue-900 mb-2">
                        State Lottery Configuration: {lotteryConfig.lottery_name || lotteryConfig.state_name}
                      </p>
                      <p className="text-xs text-blue-700">
                        Email Domain: {lotteryConfig.official_email_domain || 'Not configured'}
                      </p>
                      <p className="text-xs text-blue-700">
                        Retailer ID Label: {lotteryConfig.retailer_id_label || 'Retailer ID'}
                      </p>
                    </div>
                  )}
                  <LotteryEmailSettings storeId={id} />
                </>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                  <strong>Note:</strong> Set the store's state in the store settings above to enable lottery integration configuration.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Handheld Device Management */}
      <div className="mt-6 bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Handheld Device Management</h2>
          <p className="text-sm text-gray-600 mt-1">
            Register handheld devices for {store.name} and manage employee access. Only Super Admins can provision or lock devices.
          </p>
        </div>
        <div className="p-6">
          <HandheldDevices storeIdOverride={id} storeNameOverride={store.name} embedded />
        </div>
      </div>
    </div>
  );
};

export default StoreDetail;

