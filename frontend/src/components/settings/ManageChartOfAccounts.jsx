import { useState, useEffect } from 'react';
import { useStore } from '../../contexts/StoreContext';
import { settingsAPI } from '../../services/api';
import CopyToStoreModal from './CopyToStoreModal';

const ManageChartOfAccounts = () => {
  const { selectedStore } = useStore();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    account_code: '',
    account_name: '',
    account_type: 'asset',
    parent_account_id: ''
  });

  useEffect(() => {
    if (selectedStore) {
      loadAccounts();
    }
  }, [selectedStore]);

  const loadAccounts = async () => {
    if (!selectedStore) return;
    try {
      setLoading(true);
      const response = await settingsAPI.getChartOfAccounts(selectedStore.id);
      setAccounts(response.data.accounts || []);
    } catch (error) {
      console.error('Error loading chart of accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    if (!selectedStore || !formData.account_name.trim()) return;

    try {
      await settingsAPI.createChartAccount(selectedStore.id, formData);
      setShowAddModal(false);
      setFormData({ account_code: '', account_name: '', account_type: 'asset', parent_account_id: '' });
      loadAccounts();
    } catch (error) {
      alert('Error adding account: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEditAccount = async (e) => {
    e.preventDefault();
    if (!editingId) return;

    try {
      await settingsAPI.updateChartAccount(editingId, formData);
      setShowAddModal(false);
      setEditingId(null);
      setFormData({ account_code: '', account_name: '', account_type: 'asset', parent_account_id: '' });
      loadAccounts();
    } catch (error) {
      alert('Error updating account: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteAccount = async (accountId) => {
    if (!window.confirm('Are you sure you want to delete this account?')) {
      return;
    }

    try {
      await settingsAPI.deleteChartAccount(accountId);
      loadAccounts();
    } catch (error) {
      alert('Error deleting account: ' + (error.response?.data?.error || error.message));
    }
  };

  const startEdit = (account) => {
    setEditingId(account.id);
    setFormData({
      account_code: account.account_code || '',
      account_name: account.account_name || '',
      account_type: account.account_type || 'asset',
      parent_account_id: account.parent_account_id || ''
    });
    setShowAddModal(true);
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

  const accountsByType = accounts.reduce((acc, account) => {
    if (!acc[account.account_type]) {
      acc[account.account_type] = [];
    }
    acc[account.account_type].push(account);
    return acc;
  }, {});

  return (
    <div className="p-6 w-full min-w-0">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Chart of Accounts</h2>
        <div className="flex items-center gap-2">
          {accounts.length > 0 && (
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
              setFormData({ account_code: '', account_name: '', account_type: 'asset', parent_account_id: '' });
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49] flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Account
          </button>
        </div>
      </div>

      <div className="space-y-6 w-full">
        {['asset', 'liability', 'equity', 'revenue', 'expense'].map((type) => (
          accountsByType[type] && accountsByType[type].length > 0 && (
            <div key={type} className="w-full overflow-x-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 capitalize">{type}</h3>
              <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto w-full">
                <table className="min-w-full w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Code</th>
                      <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Account Name</th>
                      <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Parent Account</th>
                      <th className="text-right py-2 px-4 text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountsByType[type].map((account) => (
                      <tr key={account.id} className="border-b border-gray-100">
                        <td className="py-2 px-4 text-sm text-gray-900">{account.account_code || '-'}</td>
                        <td className="py-2 px-4 text-sm text-gray-900">{account.account_name}</td>
                        <td className="py-2 px-4 text-sm text-gray-600">{account.parent_account_name || '-'}</td>
                        <td className="py-2 px-4 text-sm text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => startEdit(account)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteAccount(account.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ))}
      </div>

      {accounts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No accounts added yet. Click "Add Account" to get started.</p>
        </div>
      )}

      {/* Add/Edit Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">{editingId ? 'Edit Account' : 'Add Account'}</h2>
            <form onSubmit={editingId ? handleEditAccount : handleAddAccount}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Code
                  </label>
                  <input
                    type="text"
                    value={formData.account_code}
                    onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    placeholder="e.g., 1000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Name *
                  </label>
                  <input
                    type="text"
                    value={formData.account_name}
                    onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Type *
                  </label>
                  <select
                    value={formData.account_type}
                    onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  >
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="equity">Equity</option>
                    <option value="revenue">Revenue</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Parent Account (Optional)
                  </label>
                  <select
                    value={formData.parent_account_id}
                    onChange={(e) => setFormData({ ...formData, parent_account_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                  >
                    <option value="">None</option>
                    {accounts
                      .filter(acc => acc.id !== editingId)
                      .map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.account_code ? `${acc.account_code} - ` : ''}{acc.account_name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingId(null);
                    setFormData({ account_code: '', account_name: '', account_type: 'asset', parent_account_id: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2d8659] text-white rounded hover:bg-[#256b49]"
                >
                  {editingId ? 'Update' : 'Add'} Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Copy to Store Modal */}
      <CopyToStoreModal
        isOpen={showCopyModal}
        onClose={() => setShowCopyModal(false)}
        sourceStoreId={selectedStore?.id}
        copyType="chart-of-accounts"
        onSuccess={() => {
          // Optionally reload or show success message
        }}
      />
    </div>
  );
};

export default ManageChartOfAccounts;

