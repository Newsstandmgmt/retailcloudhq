import { useState, useEffect } from 'react';
import { useStore } from '../../contexts/StoreContext';
import { settingsAPI } from '../../services/api';
import CopyToStoreModal from './CopyToStoreModal';

const ManageExpenseTypes = () => {
  const { selectedStore } = useStore();
  const [expenseTypes, setExpenseTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newExpenseType, setNewExpenseType] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [showCopyModal, setShowCopyModal] = useState(false);

  useEffect(() => {
    if (selectedStore) {
      loadExpenseTypes();
    }
  }, [selectedStore]);

  const loadExpenseTypes = async () => {
    if (!selectedStore) return;
    try {
      setLoading(true);
      const response = await settingsAPI.getExpenseTypes(selectedStore.id);
      setExpenseTypes(response.data.expense_types || []);
    } catch (error) {
      console.error('Error loading expense types:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpenseType = async (e) => {
    e.preventDefault();
    if (!selectedStore || !newExpenseType.trim()) return;

    try {
      await settingsAPI.createExpenseType(selectedStore.id, { expense_type_name: newExpenseType.trim() });
      setNewExpenseType('');
      loadExpenseTypes();
    } catch (error) {
      alert('Error adding expense type: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEditExpenseType = async (expenseTypeId) => {
    if (!editName.trim()) return;

    try {
      await settingsAPI.updateExpenseType(expenseTypeId, { expense_type_name: editName.trim() });
      setEditingId(null);
      setEditName('');
      loadExpenseTypes();
    } catch (error) {
      alert('Error updating expense type: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteExpenseType = async (expenseTypeId) => {
    if (!window.confirm('Are you sure you want to delete this expense type?')) {
      return;
    }

    try {
      await settingsAPI.deleteExpenseType(expenseTypeId);
      loadExpenseTypes();
    } catch (error) {
      alert('Error deleting expense type: ' + (error.response?.data?.error || error.message));
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
      <div className="p-12 text-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 w-full min-w-0">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Manage Expense Type</h2>
        {expenseTypes.length > 0 && (
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
      </div>

      {/* Add New Expense Type */}
      <div className="mb-6 flex items-center gap-2">
        <input
          type="text"
          value={newExpenseType}
          onChange={(e) => setNewExpenseType(e.target.value)}
          placeholder="New Expense Type"
          className="flex-1 border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
          onKeyPress={(e) => e.key === 'Enter' && handleAddExpenseType(e)}
        />
        <button
          onClick={handleAddExpenseType}
          className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49] flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>

      {/* Expense Types Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 w-full">
        {expenseTypes.map((expenseType) => (
          <div key={expenseType.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-2">
            {editingId === expenseType.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                  autoFocus
                  onKeyPress={(e) => e.key === 'Enter' && handleEditExpenseType(expenseType.id)}
                  onBlur={() => handleEditExpenseType(expenseType.id)}
                />
                <button
                  onClick={() => {
                    setEditingId(null);
                    setEditName('');
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium text-gray-900">{expenseType.expense_type_name}</span>
                <button
                  onClick={() => {
                    setEditingId(expenseType.id);
                    setEditName(expenseType.expense_type_name);
                  }}
                  className="text-blue-600 hover:text-blue-800"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteExpenseType(expenseType.id)}
                  className="text-red-600 hover:text-red-800"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {expenseTypes.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No expense types added yet. Add an expense type above to get started.</p>
        </div>
      )}

      {/* Copy to Store Modal */}
      <CopyToStoreModal
        isOpen={showCopyModal}
        onClose={() => setShowCopyModal(false)}
        sourceStoreId={selectedStore?.id}
        copyType="expense-types"
        onSuccess={() => {
          // Optionally reload or show success message
        }}
      />
    </div>
  );
};

export default ManageExpenseTypes;

