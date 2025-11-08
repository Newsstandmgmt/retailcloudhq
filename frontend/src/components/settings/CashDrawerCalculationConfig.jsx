import { useState, useEffect } from 'react';
import { storesAPI, cashDrawerCalculationAPI } from '../../services/api';
import { useStore } from '../../contexts/StoreContext';

const CashDrawerCalculationConfig = () => {
  const { stores, selectedStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [store, setStore] = useState(null);
  const [config, setConfig] = useState(null);
  const [formula, setFormula] = useState({
    formula: '',
    description: '',
    fields: {}
  });
  const [businessFields, setBusinessFields] = useState([]);
  const [lotteryFields, setLotteryFields] = useState([]);

  useEffect(() => {
    if (selectedStore) {
      setSelectedStoreId(selectedStore.id);
      loadStoreData(selectedStore.id);
    } else if (stores.length > 0) {
      setSelectedStoreId(stores[0].id);
      loadStoreData(stores[0].id);
    }
  }, [selectedStore, stores]);

  const loadStoreData = async (storeId) => {
    if (!storeId) return;
    setLoading(true);
    try {
      const [storeRes, configRes] = await Promise.all([
        storesAPI.getById(storeId),
        cashDrawerCalculationAPI.getForStore(storeId).catch(() => ({ data: { config: null } }))
      ]);
      
      const storeData = storeRes.data.store;
      setStore(storeData);
      
      const configData = configRes.data.config;
      if (configData) {
        setConfig(configData);
        setFormula(configData.combined_drawer_formula || {
          formula: 'total_cash - lottery_cash_sales - lottery_payments - lottery_adjustments',
          description: 'Business Cash = Total Cash - Lottery Cash Sales - Lottery Payments - Lottery Adjustments',
          fields: {}
        });
        setBusinessFields(configData.business_fields_config || []);
        setLotteryFields(configData.lottery_fields_config || []);
      } else {
        // Use defaults
        setFormula({
          formula: 'total_cash - lottery_cash_sales - lottery_payments - lottery_adjustments',
          description: 'Business Cash = Total Cash - Lottery Cash Sales - Lottery Payments - Lottery Adjustments',
          fields: {}
        });
        setBusinessFields([]);
        setLotteryFields([]);
      }
    } catch (error) {
      console.error('Error loading store data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedStoreId) return;
    setSaving(true);
    try {
      await cashDrawerCalculationAPI.updateForStore(selectedStoreId, {
        combined_drawer_formula: formula,
        business_fields_config: businessFields,
        lottery_fields_config: lotteryFields
      });
      alert('Configuration saved successfully!');
    } catch (error) {
      alert('Error saving configuration: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Cash Drawer Calculation Configuration</h2>
      <p className="text-sm text-gray-600 mb-6">
        Configure how business sales are calculated based on drawer type and which fields admins/managers see for data entry.
      </p>

      {/* Store Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Store
        </label>
        <select
          value={selectedStoreId || ''}
          onChange={(e) => {
            setSelectedStoreId(e.target.value);
            loadStoreData(e.target.value);
          }}
          className="w-full max-w-md border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
        >
          {stores.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {store && (
        <div className="space-y-6">
          {/* Current Drawer Type */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Current Cash Drawer Configuration</h3>
            <p className="text-sm text-blue-800">
              <strong>Type:</strong> {store.cash_drawer_type === 'same' ? 'Combined Drawer' : 'Separate Drawers'}
            </p>
            {store.cash_drawer_type === 'same' && (
              <p className="text-sm text-blue-800 mt-2">
                Business cash is calculated from total cash minus lottery transactions using the formula below.
              </p>
            )}
            {store.cash_drawer_type === 'separate' && (
              <p className="text-sm text-blue-800 mt-2">
                Business and lottery cash are tracked independently. No calculation needed.
              </p>
            )}
          </div>

          {/* Combined Drawer Formula (only show if drawer is combined) */}
          {store.cash_drawer_type === 'same' && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Combined Drawer Calculation Formula</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Formula Description
                  </label>
                  <input
                    type="text"
                    value={formula.description}
                    onChange={(e) => setFormula({ ...formula, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    placeholder="Business Cash = Total Cash - Lottery Transactions"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Formula Expression
                  </label>
                  <input
                    type="text"
                    value={formula.formula}
                    onChange={(e) => setFormula({ ...formula, formula: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] font-mono text-sm"
                    placeholder="total_cash - lottery_cash_sales - lottery_payments - lottery_adjustments"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Available variables: total_cash, lottery_cash_sales, lottery_payments, lottery_adjustments
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Field Visibility Configuration */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Field Visibility Configuration</h3>
            <p className="text-sm text-gray-600 mb-4">
              Configure which fields are visible and required for admins/managers when entering business and lottery data.
              The system uses sensible defaults - you can customize per store if needed.
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Field visibility configuration is currently using system defaults. 
                Custom field configuration per store will be available in a future update.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Business Bookkeeping Fields</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span>Total Cash</span>
                    <span className="text-green-600">✓ Visible, Required</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span>Cash Adjustment</span>
                    <span className="text-blue-600">✓ Visible</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span>Business Credit Card</span>
                    <span className="text-blue-600">✓ Visible</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span>Transaction Fees</span>
                    <span className="text-blue-600">✓ Visible</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span>Online Sales</span>
                    <span className="text-blue-600">✓ Visible</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span>Sales Tax</span>
                    <span className="text-blue-600">✓ Visible</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Lottery Bookkeeping Fields</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span>Draw Sales</span>
                    <span className="text-blue-600">✓ Visible</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span>Draw Net</span>
                    <span className="text-blue-600">✓ Visible</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span>Instant Sales</span>
                    <span className="text-blue-600">✓ Visible</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span>Instant Pay</span>
                    <span className="text-blue-600">✓ Visible</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span>Instant Adjustment</span>
                    <span className="text-blue-600">✓ Visible</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span>Lottery Card Transaction</span>
                    <span className="text-blue-600">✓ Visible</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || store.cash_drawer_type !== 'same'}
              className="px-6 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>

          {store.cash_drawer_type === 'separate' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>Separate Drawers:</strong> No formula configuration needed. Business and lottery cash are tracked independently.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CashDrawerCalculationConfig;

