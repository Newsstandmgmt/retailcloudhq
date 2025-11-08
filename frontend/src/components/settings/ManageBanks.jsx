import { useState, useEffect } from 'react';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';
import { banksAPI } from '../../services/api';

const ManageBanks = () => {
  const { selectedStore } = useStore();
  const { user } = useAuth();
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    bank_name: '',
    bank_short_name: ''
  });

  useEffect(() => {
    if (selectedStore) {
      loadBanks();
    }
  }, [selectedStore]);

  const loadBanks = async () => {
    if (!selectedStore) return;
    try {
      setLoading(true);
      const response = await banksAPI.getAll(selectedStore.id);
      setBanks(response.data.banks || []);
    } catch (error) {
      console.error('Error loading banks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBank = async (e) => {
    e.preventDefault();
    if (!selectedStore) return;

    try {
      await banksAPI.create(selectedStore.id, formData);
      alert('Bank added successfully!');
      setShowAddModal(false);
      setFormData({ bank_name: '', bank_short_name: '' });
      loadBanks();
    } catch (error) {
      alert('Error adding bank: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteBank = async (bankId) => {
    if (!window.confirm('Are you sure you want to delete this bank?')) {
      return;
    }

    try {
      await banksAPI.delete(bankId);
      alert('Bank deleted successfully!');
      loadBanks();
    } catch (error) {
      alert('Error deleting bank: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleMarkDefault = async (bankId, type) => {
    try {
      await banksAPI.updateDefault(selectedStore.id, bankId, type);
      alert('Default bank updated successfully!');
      loadBanks();
    } catch (error) {
      alert('Error updating default bank: ' + (error.response?.data?.error || error.message));
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
        <h2 className="text-xl font-bold text-gray-900">Manage Bank</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49] flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Bank
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
        {banks.map((bank) => (
          <div key={bank.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm relative">
            <button
              onClick={() => handleDeleteBank(bank.id)}
              className="absolute top-4 right-4 text-red-600 hover:text-red-800"
              title="Delete Bank"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>

            <div className="mb-4">
              <p className="text-sm text-gray-600">Bank Name</p>
              <p className="text-lg font-semibold text-gray-900">{bank.bank_name}</p>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600">Bank Short Name</p>
              <p className="text-lg font-semibold text-gray-900">{bank.bank_short_name || '-'}</p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleMarkDefault(bank.id, 'default_bank')}
                className={`w-full px-4 py-2 rounded text-sm font-medium transition-colors ${
                  bank.is_default_bank
                    ? 'bg-[#2d8659] text-white'
                    : 'bg-green-100 text-[#2d8659] hover:bg-green-200'
                }`}
              >
                Mark Default Bank
              </button>
              <button
                onClick={() => handleMarkDefault(bank.id, 'default_atm_bank')}
                className={`w-full px-4 py-2 rounded text-sm font-medium transition-colors ${
                  bank.is_default_atm_bank
                    ? 'bg-[#2d8659] text-white'
                    : 'bg-green-100 text-[#2d8659] hover:bg-green-200'
                }`}
              >
                Mark Default ATM Bank
              </button>
              <button
                onClick={() => handleMarkDefault(bank.id, 'default_lottery_bank')}
                className={`w-full px-4 py-2 rounded text-sm font-medium transition-colors ${
                  bank.is_default_lottery_bank
                    ? 'bg-[#2d8659] text-white'
                    : 'bg-green-100 text-[#2d8659] hover:bg-green-200'
                }`}
              >
                Mark Default Lottery Bank
              </button>
              <button
                onClick={() => handleMarkDefault(bank.id, 'default_credit_card_bank')}
                className={`w-full px-4 py-2 rounded text-sm font-medium transition-colors ${
                  bank.is_default_credit_card_bank
                    ? 'bg-[#2d8659] text-white'
                    : 'bg-green-100 text-[#2d8659] hover:bg-green-200'
                }`}
              >
                Mark Default Credit Card Bank
              </button>
            </div>
          </div>
        ))}
      </div>

      {banks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No banks added yet. Click "Add Bank" to get started.</p>
        </div>
      )}

      {/* Add Bank Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Add Bank</h2>
            <form onSubmit={handleAddBank}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bank Name *
                  </label>
                  <input
                    type="text"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bank Short Name
                  </label>
                  <input
                    type="text"
                    value={formData.bank_short_name}
                    onChange={(e) => setFormData({ ...formData, bank_short_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2d8659] text-white rounded hover:bg-[#256b49]"
                >
                  Add Bank
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageBanks;

