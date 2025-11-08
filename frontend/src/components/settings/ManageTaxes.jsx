import { useState, useEffect } from 'react';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';
import { purchaseInvoicesAPI, settingsAPI } from '../../services/api';

// Copy Taxes Modal Component
const CopyTaxesModal = ({ isOpen, onClose, sourceStoreId, onCopy }) => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStores, setSelectedStores] = useState([]);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (isOpen && sourceStoreId) {
      loadStores();
    }
  }, [isOpen, sourceStoreId]);

  const loadStores = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.getStoresForCopy(sourceStoreId);
      setStores(response.data.stores || []);
      setSelectedStores([]);
    } catch (error) {
      console.error('Error loading stores:', error);
      alert('Error loading stores: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStore = (storeId) => {
    setSelectedStores(prev => 
      prev.includes(storeId) 
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
  };

  const handleSelectAll = () => {
    if (selectedStores.length === stores.length) {
      setSelectedStores([]);
    } else {
      setSelectedStores(stores.map(s => s.id));
    }
  };

  const handleCopy = async () => {
    if (selectedStores.length === 0) {
      alert('Please select at least one store to copy to.');
      return;
    }
    
    setCopying(true);
    try {
      await onCopy(sourceStoreId, selectedStores);
      onClose();
    } catch (error) {
      // Error already handled in onCopy
    } finally {
      setCopying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Copy Taxes to Other Stores</h2>
        <p className="text-sm text-gray-600 mb-6">
          Select one or more stores to copy taxes to.
        </p>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-lg">Loading stores...</div>
          </div>
        ) : stores.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No other stores available to copy to.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={handleSelectAll}
                className="text-sm text-[#2d8659] hover:underline"
              >
                {selectedStores.length === stores.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-sm text-gray-600">
                {selectedStores.length} of {stores.length} selected
              </span>
            </div>

            <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto mb-6">
              {stores.map((store) => (
                <label
                  key={store.id}
                  className="flex items-center gap-3 p-4 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedStores.includes(store.id)}
                    onChange={() => handleToggleStore(store.id)}
                    className="w-4 h-4 text-[#2d8659] border-gray-300 rounded focus:ring-[#2d8659]"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{store.name}</div>
                    {store.city && store.state && (
                      <div className="text-sm text-gray-500">{store.city}, {store.state}</div>
                    )}
                    {store.admin_email && (
                      <div className="text-xs text-gray-400">Admin: {store.admin_email}</div>
                    )}
                  </div>
                  {!store.is_active && (
                    <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                      Inactive
                    </span>
                  )}
                </label>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={copying}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCopy}
            disabled={copying || selectedStores.length === 0}
            className="px-4 py-2 bg-[#2d8659] text-white rounded hover:bg-[#256b49] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {copying ? 'Copying...' : `Copy to ${selectedStores.length} Store(s)`}
          </button>
        </div>
      </div>
    </div>
  );
};

const ManageTaxes = () => {
  const { selectedStore } = useStore();
  const { user } = useAuth();
  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    state: '',
    tax_type: '',
    tax_rate: '',
    tax_applicable_to: 'customer',
    is_inclusive: false
  });

  useEffect(() => {
    if (selectedStore) {
      loadTaxes();
    }
  }, [selectedStore]);

  const loadTaxes = async () => {
    if (!selectedStore) return;
    setLoading(true);
    try {
      const response = await purchaseInvoicesAPI.getTaxes(selectedStore.id);
      setTaxes(response.data.taxes || []);
    } catch (error) {
      console.error('Error loading taxes:', error);
      alert('Failed to load taxes.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUpdateTax = async (e) => {
    e.preventDefault();
    if (!selectedStore) return;

    try {
      // Convert percentage to decimal (8.5% -> 0.085)
      const taxRateDecimal = parseFloat(formData.tax_rate) / 100;
      
      const taxData = {
        state: formData.state,
        tax_type: formData.tax_type,
        tax_rate: taxRateDecimal,
        tax_applicable_to: formData.tax_applicable_to,
        is_inclusive: formData.is_inclusive
      };

      await purchaseInvoicesAPI.createTax(selectedStore.id, taxData);
      alert(editingId ? 'Tax updated successfully!' : 'Tax added successfully!');
      
      setShowAddModal(false);
      setEditingId(null);
      setFormData({
        state: '',
        tax_type: '',
        tax_rate: '',
        tax_applicable_to: 'customer',
        is_inclusive: false
      });
      loadTaxes();
    } catch (error) {
      alert('Error saving tax: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEditTax = (tax) => {
    setEditingId(tax.id);
    setFormData({
      state: tax.state,
      tax_type: tax.tax_type,
      tax_rate: (parseFloat(tax.tax_rate) * 100).toFixed(2), // Convert to percentage
      tax_applicable_to: tax.tax_applicable_to || 'customer',
      is_inclusive: tax.is_inclusive || false
    });
    setShowAddModal(true);
  };

  const handleDeleteTax = async (taxId) => {
    if (!window.confirm('Are you sure you want to delete this tax?')) return;
    try {
      await purchaseInvoicesAPI.deleteTax(taxId);
      alert('Tax deleted successfully!');
      loadTaxes();
    } catch (error) {
      alert('Error deleting tax: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCopyTaxes = async (sourceStoreId, targetStoreIds) => {
    try {
      // Get source taxes
      const sourceResponse = await purchaseInvoicesAPI.getTaxes(sourceStoreId);
      const sourceTaxes = sourceResponse.data.taxes || [];

      // Copy each tax to target stores
      for (const targetStoreId of targetStoreIds) {
        for (const tax of sourceTaxes) {
          await purchaseInvoicesAPI.createTax(targetStoreId, {
            state: tax.state,
            tax_type: tax.tax_type,
            tax_rate: parseFloat(tax.tax_rate), // Already in decimal format
            tax_applicable_to: tax.tax_applicable_to || 'customer',
            is_inclusive: tax.is_inclusive || false
          });
        }
      }

      alert('Taxes copied successfully!');
      setShowCopyModal(false);
      loadTaxes();
    } catch (error) {
      alert('Error copying taxes: ' + (error.response?.data?.error || error.message));
    }
  };

  if (!selectedStore) {
    return (
      <div className="p-12 text-center">
        <p className="text-gray-500">Please select a store from the header dropdown.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // US States list
  const usStates = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];

  return (
    <div className="p-6 w-full min-w-0">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Local Taxes</h2>
        <div className="flex items-center gap-2">
          {taxes.length > 0 && (
            <button
              onClick={() => setShowCopyModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              title="Copy to other stores"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy to Store
            </button>
          )}
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({
                state: selectedStore.state || '',
                tax_type: '',
                tax_rate: '',
                tax_applicable_to: 'customer',
                is_inclusive: false
              });
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49] flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Tax
          </button>
        </div>
      </div>

      <div className="space-y-4 w-full overflow-x-auto">
        {taxes.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No taxes configured yet. Click "Add Tax" to get started.</p>
          </div>
        ) : (
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">State</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applicable To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax Inclusive</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {taxes.map((tax) => (
                <tr key={tax.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tax.state}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tax.tax_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{(parseFloat(tax.tax_rate) * 100).toFixed(2)}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">{tax.tax_applicable_to || 'customer'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tax.is_inclusive ? 'Yes' : 'No'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEditTax(tax)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTax(tax.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Tax Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingId ? 'Edit Tax' : 'Add Tax'}</h2>
            <form onSubmit={handleAddUpdateTax}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State *
                  </label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  >
                    <option value="">Select State</option>
                    {usStates.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tax Type * (e.g., Sales Tax, Vape Tax, Soda Tax)
                  </label>
                  <input
                    type="text"
                    value={formData.tax_type}
                    onChange={(e) => setFormData({ ...formData, tax_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    placeholder="e.g., Sales Tax, Vape Tax"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tax Rate (%) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.tax_rate}
                    onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    placeholder="e.g., 8.5 for 8.5%"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Applicable To *
                  </label>
                  <select
                    value={formData.tax_applicable_to}
                    onChange={(e) => setFormData({ ...formData, tax_applicable_to: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  >
                    <option value="customer">Customer</option>
                    <option value="business_owner">Business Owner</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Business Owner taxes will appear when adding invoices
                  </p>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_inclusive}
                      onChange={(e) => setFormData({ ...formData, is_inclusive: e.target.checked })}
                      className="mr-2 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Invoice amount is inclusive of tax
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    If checked, the invoice amount includes tax. If unchecked, tax is added to the amount.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingId(null);
                    setFormData({
                      state: '',
                      tax_type: '',
                      tax_rate: '',
                      tax_applicable_to: 'customer',
                      is_inclusive: false
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2d8659] text-white rounded hover:bg-[#256b49]"
                >
                  {editingId ? 'Update' : 'Add'} Tax
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Copy to Store Modal */}
      {showCopyModal && (
        <CopyTaxesModal
          isOpen={showCopyModal}
          onClose={() => setShowCopyModal(false)}
          sourceStoreId={selectedStore.id}
          onCopy={handleCopyTaxes}
        />
      )}
    </div>
  );
};

export default ManageTaxes;

