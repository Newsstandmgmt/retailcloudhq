import { useState, useEffect } from 'react';
import { useStore } from '../../contexts/StoreContext';
import { storesAPI } from '../../services/api';

const CashDrawerSettings = ({ storeId: propStoreId }) => {
  const { selectedStore: contextStore } = useStore();
  // Use propStoreId if provided (for StoreDetail page), otherwise use context store
  const selectedStore = propStoreId ? { id: propStoreId } : contextStore;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    cash_drawer_type: 'same', // 'same' or 'separate'
    registers: [{ register_id: 'register_1', name: 'Register 1', starting_cash: 0 }]
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (selectedStore?.id) {
      loadCashDrawerSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStore?.id, propStoreId]);

  const loadCashDrawerSettings = async () => {
    if (!selectedStore?.id) return;
    try {
      setLoading(true);
      const response = await storesAPI.getById(selectedStore.id);
      const store = response.data.store;
      
      // Parse register_starting_cash if it's a string
      let registers = [];
      if (store.register_starting_cash) {
        if (typeof store.register_starting_cash === 'string') {
          try {
            registers = JSON.parse(store.register_starting_cash);
          } catch (e) {
            console.error('Error parsing register_starting_cash:', e);
            registers = [];
          }
        } else {
          registers = store.register_starting_cash;
        }
      }
      
      // If no registers exist, create a default one
      if (!Array.isArray(registers) || registers.length === 0) {
        registers = [{ register_id: 'register_1', name: 'Register 1', starting_cash: 0 }];
      }
      
      setFormData({
        cash_drawer_type: store.cash_drawer_type || 'same',
        registers: registers
      });
    } catch (error) {
      console.error('Error loading cash drawer settings:', error);
      setError('Failed to load cash drawer settings');
    } finally {
      setLoading(false);
    }
  };

  const handleDrawerTypeChange = (type) => {
    setFormData({
      ...formData,
      cash_drawer_type: type
    });
  };

  const addRegister = () => {
    const newRegisterId = `register_${formData.registers.length + 1}`;
    setFormData({
      ...formData,
      registers: [
        ...formData.registers,
        { register_id: newRegisterId, name: `Register ${formData.registers.length + 1}`, starting_cash: 0 }
      ]
    });
  };

  const removeRegister = (index) => {
    if (formData.registers.length <= 1) {
      alert('You must have at least one register.');
      return;
    }
    setFormData({
      ...formData,
      registers: formData.registers.filter((_, i) => i !== index)
    });
  };

  const updateRegister = (index, field, value) => {
    const updatedRegisters = [...formData.registers];
    updatedRegisters[index] = {
      ...updatedRegisters[index],
      [field]: field === 'starting_cash' ? parseFloat(value) || 0 : value
    };
    setFormData({
      ...formData,
      registers: updatedRegisters
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStore?.id) return;

    // Validate that all registers have names and valid starting cash
    for (const register of formData.registers) {
      if (!register.name || register.name.trim() === '') {
        setError('All registers must have a name.');
        return;
      }
      if (isNaN(register.starting_cash) || register.starting_cash < 0) {
        setError('Starting cash must be a valid number greater than or equal to 0.');
        return;
      }
    }

    try {
      setSaving(true);
      setError('');
      setSuccess(false);
      
      await storesAPI.update(selectedStore?.id, {
        cash_drawer_type: formData.cash_drawer_type,
        register_starting_cash: formData.registers
      });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating cash drawer settings:', error);
      setError(error.response?.data?.error || 'Failed to update cash drawer settings');
    } finally {
      setSaving(false);
    }
  };

  if (!selectedStore?.id) {
    return (
      <div className="p-12 text-center">
        <p className="text-gray-500">Please select a store from the header dropdown.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="text-lg">Loading cash drawer settings...</div>
      </div>
    );
  }

  return (
    <div className="p-6 w-full min-w-0">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Cash Drawer Settings</h2>
      <p className="text-sm text-gray-600 mb-6">
        Configure how cash drawers are managed for this store. This setting affects how accounting is handled for lottery and business cash transactions.
      </p>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          Cash drawer settings updated successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cash Drawer Type */}
        <div className="bg-gray-50 rounded-lg p-6">
          <label className="block text-sm font-medium text-gray-700 mb-4">
            Cash Drawer Configuration *
          </label>
          <div className="space-y-3">
            <label className="flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-100"
              style={{ borderColor: formData.cash_drawer_type === 'same' ? '#2d8659' : '#e5e7eb' }}>
              <input
                type="radio"
                name="cash_drawer_type"
                value="same"
                checked={formData.cash_drawer_type === 'same'}
                onChange={() => handleDrawerTypeChange('same')}
                className="mt-1 mr-3"
              />
              <div>
                <div className="font-medium text-gray-900">Same Drawer</div>
                <div className="text-sm text-gray-600 mt-1">
                  Lottery and business cash share the same drawer. Accounting is combined.
                </div>
              </div>
            </label>

            <label className="flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-100"
              style={{ borderColor: formData.cash_drawer_type === 'separate' ? '#2d8659' : '#e5e7eb' }}>
              <input
                type="radio"
                name="cash_drawer_type"
                value="separate"
                checked={formData.cash_drawer_type === 'separate'}
                onChange={() => handleDrawerTypeChange('separate')}
                className="mt-1 mr-3"
              />
              <div>
                <div className="font-medium text-gray-900">Separate Drawers</div>
                <div className="text-sm text-gray-600 mt-1">
                  Lottery and business cash use separate drawers. Accounting is tracked separately.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Register Starting Cash */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Register Starting Cash</h3>
              <p className="text-sm text-gray-600 mt-1">
                Set the starting cash amount for each register. This is the amount of cash in the drawer at the start of each business day.
              </p>
            </div>
            <button
              type="button"
              onClick={addRegister}
              className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49] text-sm"
            >
              + Add Register
            </button>
          </div>

          <div className="space-y-4">
            {formData.registers.map((register, index) => (
              <div key={register.register_id || index} className="flex gap-4 items-start p-4 bg-gray-50 rounded-lg">
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Register Name *
                    </label>
                    <input
                      type="text"
                      value={register.name}
                      onChange={(e) => updateRegister(index, 'name', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                      required
                      placeholder="e.g., Register 1, Main Register"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Starting Cash ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={register.starting_cash}
                      onChange={(e) => updateRegister(index, 'starting_cash', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                      required
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {formData.registers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRegister(index)}
                    className="px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md text-sm font-medium"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Important Note */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-blue-900">Important</h4>
              <div className="mt-2 text-sm text-blue-700">
                <p className="mb-2">
                  The cash drawer configuration affects how accounting is handled:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Same Drawer:</strong> All cash transactions (lottery and business) are combined in a single accounting flow.</li>
                  <li><strong>Separate Drawers:</strong> Lottery cash and business cash are tracked separately with independent accounting.</li>
                </ul>
                <p className="mt-2">
                  This setting cannot be changed after the store has transaction history. Contact support if you need to change this later.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CashDrawerSettings;

