import { useState, useEffect } from 'react';
import { useStore } from '../../contexts/StoreContext';
import { settingsAPI } from '../../services/api';

const CopyToStoreModal = ({ isOpen, onClose, sourceStoreId, copyType, onSuccess }) => {
  const { selectedStore } = useStore();
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
      let response;
      switch (copyType) {
        case 'chart-of-accounts':
          response = await settingsAPI.copyChartOfAccounts(sourceStoreId, selectedStores);
          break;
        case 'departments':
          response = await settingsAPI.copyDepartments(sourceStoreId, selectedStores);
          break;
        case 'vendors':
          response = await settingsAPI.copyVendors(sourceStoreId, selectedStores);
          break;
        case 'expense-types':
          response = await settingsAPI.copyExpenseTypes(sourceStoreId, selectedStores);
          break;
        case 'other-income':
          response = await settingsAPI.copyOtherIncome(sourceStoreId, selectedStores);
          break;
        default:
          throw new Error('Invalid copy type');
      }

      const successCount = response.data.results.filter(r => r.success).length;
      alert(`Successfully copied to ${successCount} store(s)!`);
      onSuccess();
      onClose();
    } catch (error) {
      alert('Error copying: ' + (error.response?.data?.error || error.message));
    } finally {
      setCopying(false);
    }
  };

  if (!isOpen) return null;

  const copyTypeLabels = {
    'chart-of-accounts': 'Chart of Accounts',
    'departments': 'Departments',
    'vendors': 'Vendors',
    'expense-types': 'Expense Types',
    'other-income': 'Other Income Categories'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Copy {copyTypeLabels[copyType] || copyType}</h2>
        <p className="text-sm text-gray-600 mb-6">
          Select one or more stores to copy <strong>{copyTypeLabels[copyType] || copyType}</strong> to.
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

export default CopyToStoreModal;

