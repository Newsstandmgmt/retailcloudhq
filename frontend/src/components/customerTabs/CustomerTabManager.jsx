import { useState, useEffect } from 'react';
import { useStore } from '../../contexts/StoreContext';
import { customerTabsAPI } from '../../services/api';
import CustomerTabDetails from './CustomerTabDetails';

const CustomerTabManager = ({ onTabSelect, selectedDate }) => {
  const { selectedStore } = useStore();
  const [tabs, setTabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTabModal, setShowAddTabModal] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState(null);
  const [newTabName, setNewTabName] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeDescription, setChargeDescription] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [selectedTabForDetails, setSelectedTabForDetails] = useState(null);

  useEffect(() => {
    if (selectedStore) {
      loadTabs();
    }
  }, [selectedStore]);

  const loadTabs = async () => {
    if (!selectedStore) return;
    try {
      setLoading(true);
      const response = await customerTabsAPI.getByStore(selectedStore.id);
      setTabs(response.data.tabs || []);
    } catch (error) {
      console.error('Error loading customer tabs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTab = async () => {
    if (!newTabName.trim()) {
      alert('Please enter a customer name');
      return;
    }
    try {
      await customerTabsAPI.findOrCreate(selectedStore.id, { customer_name: newTabName });
      setNewTabName('');
      setShowAddTabModal(false);
      loadTabs();
    } catch (error) {
      alert('Error creating tab: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAddCharge = async () => {
    if (!selectedTab || !chargeAmount || !selectedDate) return;
    try {
      await customerTabsAPI.addCharge(selectedTab.id, {
        transaction_date: selectedDate,
        amount: chargeAmount,
        description: chargeDescription
      });
      setChargeAmount('');
      setChargeDescription('');
      setShowChargeModal(false);
      setSelectedTab(null);
      loadTabs();
      if (onTabSelect) onTabSelect();
    } catch (error) {
      alert('Error adding charge: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAddPayment = async () => {
    if (!selectedTab || !paymentAmount || !selectedDate) return;
    try {
      await customerTabsAPI.addPayment(selectedTab.id, {
        transaction_date: selectedDate,
        amount: paymentAmount,
        payment_method: paymentMethod
      });
      setPaymentAmount('');
      setPaymentMethod('cash');
      setShowPaymentModal(false);
      setSelectedTab(null);
      loadTabs();
      if (onTabSelect) onTabSelect();
    } catch (error) {
      alert('Error adding payment: ' + (error.response?.data?.error || error.message));
    }
  };

  if (!selectedStore) {
    return <div className="text-sm text-gray-500">Please select a store</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Customer Tabs</h3>
        <button
          onClick={() => setShowAddTabModal(true)}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + New Tab
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading...</div>
      ) : tabs.length === 0 ? (
        <div className="text-sm text-gray-500">No customer tabs yet</div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {tabs.map(tab => (
            <div key={tab.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
              <div 
                className="flex-1 cursor-pointer"
                onClick={() => setSelectedTabForDetails(tab)}
                title="Click to view detailed transactions"
              >
                <div className="font-medium text-sm">{tab.customer_name}</div>
                <div className="text-xs text-gray-600">
                  Balance: <span className={tab.current_balance > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                    ${parseFloat(tab.current_balance || 0).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTabForDetails(tab);
                  }}
                  className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                  title="View detailed transactions"
                >
                  Details
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTab(tab);
                    setShowChargeModal(true);
                  }}
                  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  disabled={!selectedDate}
                >
                  Charge
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTab(tab);
                    setShowPaymentModal(true);
                  }}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={!selectedDate || tab.current_balance <= 0}
                >
                  Pay
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Tab Modal */}
      {showAddTabModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Create Customer Tab</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Adna, John Doe"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateTab()}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowAddTabModal(false);
                    setNewTabName('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTab}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Charge Modal */}
      {showChargeModal && selectedTab && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Add Charge - {selectedTab.customer_name}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={chargeDescription}
                  onChange={(e) => setChargeDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Lottery tickets, Products"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowChargeModal(false);
                    setSelectedTab(null);
                    setChargeAmount('');
                    setChargeDescription('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCharge}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Add Charge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showPaymentModal && selectedTab && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Record Payment - {selectedTab.customer_name}</h3>
            <div className="mb-2 text-sm text-gray-600">
              Current Balance: <span className="font-semibold">${parseFloat(selectedTab.current_balance || 0).toFixed(2)}</span>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedTab.current_balance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="check">Check</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedTab(null);
                    setPaymentAmount('');
                    setPaymentMethod('cash');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPayment}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Tab Details Modal */}
      {selectedTabForDetails && (
        <CustomerTabDetails
          tab={selectedTabForDetails}
          onClose={() => {
            setSelectedTabForDetails(null);
            loadTabs();
          }}
          onUpdate={() => {
            loadTabs();
            if (onTabSelect) onTabSelect();
          }}
        />
      )}
    </div>
  );
};

export default CustomerTabManager;

