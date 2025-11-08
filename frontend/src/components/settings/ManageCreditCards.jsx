import { useState, useEffect } from 'react';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';
import { creditCardsAPI } from '../../services/api';

const ManageCreditCards = () => {
  const { selectedStore } = useStore();
  const { user } = useAuth();
  const [creditCards, setCreditCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [formData, setFormData] = useState({
    card_name: '',
    card_short_name: '',
    last_four_digits: ''
  });

  useEffect(() => {
    if (selectedStore) {
      loadCreditCards();
    }
  }, [selectedStore]);

  const loadCreditCards = async () => {
    if (!selectedStore) return;
    try {
      setLoading(true);
      const response = await creditCardsAPI.getAll(selectedStore.id);
      setCreditCards(response.data.credit_cards || []);
    } catch (error) {
      console.error('Error loading credit cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!selectedStore) return;

    try {
      await creditCardsAPI.create(selectedStore.id, formData);
      alert('Credit card added successfully!');
      setShowAddModal(false);
      setFormData({ card_name: '', card_short_name: '', last_four_digits: '' });
      loadCreditCards();
    } catch (error) {
      alert('Error adding credit card: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEditCard = (card) => {
    setEditingCard(card);
    setFormData({
      card_name: card.card_name,
      card_short_name: card.card_short_name || '',
      last_four_digits: card.last_four_digits || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateCard = async (e) => {
    e.preventDefault();
    if (!editingCard) return;

    try {
      await creditCardsAPI.update(editingCard.id, formData);
      alert('Credit card updated successfully!');
      setShowEditModal(false);
      setEditingCard(null);
      setFormData({ card_name: '', card_short_name: '', last_four_digits: '' });
      loadCreditCards();
    } catch (error) {
      alert('Error updating credit card: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteCard = async (cardId) => {
    if (!window.confirm('Are you sure you want to delete this credit card?')) {
      return;
    }

    try {
      await creditCardsAPI.delete(cardId);
      alert('Credit card deleted successfully!');
      loadCreditCards();
    } catch (error) {
      alert('Error deleting credit card: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleMarkDefault = async (cardId) => {
    try {
      await creditCardsAPI.updateDefault(selectedStore.id, cardId);
      alert('Default credit card updated successfully!');
      loadCreditCards();
    } catch (error) {
      alert('Error updating default credit card: ' + (error.response?.data?.error || error.message));
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
        <h2 className="text-xl font-bold text-gray-900">Manage Credit Cards</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49] flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Credit Card
        </button>
      </div>

      {creditCards.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No credit cards added yet.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49]"
          >
            Add Your First Credit Card
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Card Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Short Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last 4 Digits
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Default
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {creditCards.map((card) => (
                <tr key={card.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {card.card_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {card.card_short_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {card.last_four_digits ? `****${card.last_four_digits}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {card.is_default ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Default
                      </span>
                    ) : (
                      <button
                        onClick={() => handleMarkDefault(card.id)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Set Default
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEditCard(card)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Add Credit Card</h3>
            <form onSubmit={handleAddCard}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Card Name *
                  </label>
                  <input
                    type="text"
                    value={formData.card_name}
                    onChange={(e) => setFormData({ ...formData, card_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="e.g., Business Visa, Company Amex"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Short Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.card_short_name}
                    onChange={(e) => setFormData({ ...formData, card_short_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="e.g., Visa, Amex"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last 4 Digits (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength="4"
                    value={formData.last_four_digits}
                    onChange={(e) => setFormData({ ...formData, last_four_digits: e.target.value.replace(/\D/g, '') })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="1234"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({ card_name: '', card_short_name: '', last_four_digits: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49]"
                >
                  Add Credit Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Edit Credit Card</h3>
            <form onSubmit={handleUpdateCard}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Card Name *
                  </label>
                  <input
                    type="text"
                    value={formData.card_name}
                    onChange={(e) => setFormData({ ...formData, card_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Short Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.card_short_name}
                    onChange={(e) => setFormData({ ...formData, card_short_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last 4 Digits (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength="4"
                    value={formData.last_four_digits}
                    onChange={(e) => setFormData({ ...formData, last_four_digits: e.target.value.replace(/\D/g, '') })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="1234"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingCard(null);
                    setFormData({ card_name: '', card_short_name: '', last_four_digits: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49]"
                >
                  Update Credit Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageCreditCards;

