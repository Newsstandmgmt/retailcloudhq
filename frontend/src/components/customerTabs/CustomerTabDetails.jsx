import { useState, useEffect } from 'react';
import { customerTabsAPI } from '../../services/api';

const CustomerTabDetails = ({ tab, onClose, onUpdate }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAddChargeModal, setShowAddChargeModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeDescription, setChargeDescription] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentTab, setCurrentTab] = useState(tab);

  useEffect(() => {
    setCurrentTab(tab);
  }, [tab]);

  useEffect(() => {
    if (currentTab) {
      loadTransactions();
    }
  }, [currentTab, startDate, endDate]);

  const loadTransactions = async () => {
    if (!currentTab) return;
    try {
      setLoading(true);
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      
      const response = await customerTabsAPI.getTransactions(currentTab.id, params);
      setTransactions(response.data.transactions || []);
      
      // Only update tab data if balance might have changed (not on every filter change)
      // This prevents infinite loops when filters change
      const shouldUpdateTab = !startDate && !endDate; // Only update when no filters
      
      if (shouldUpdateTab && onUpdate) {
        // Fetch updated tab data
        try {
          const tabsResponse = await customerTabsAPI.getByStore(currentTab.store_id);
          const updatedTab = tabsResponse.data.tabs?.find(t => t.id === currentTab.id);
          if (updatedTab && updatedTab.current_balance !== currentTab.current_balance) {
            setCurrentTab(updatedTab);
          }
        } catch (error) {
          console.error('Error reloading tab:', error);
        }
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      alert('Error loading transactions: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAddCharge = async () => {
    if (!chargeAmount || !transactionDate) {
      alert('Please enter amount and date');
      return;
    }
    try {
      await customerTabsAPI.addCharge(currentTab.id, {
        transaction_date: transactionDate,
        amount: chargeAmount,
        description: chargeDescription
      });
      setChargeAmount('');
      setChargeDescription('');
      setShowAddChargeModal(false);
      await loadTransactions();
      if (onUpdate) onUpdate();
    } catch (error) {
      alert('Error adding charge: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleVoidCharge = async (transactionId) => {
    if (!window.confirm('Are you sure you want to void this charge? This will reverse the charge and update the customer balance.')) {
      return;
    }
    try {
      await customerTabsAPI.voidCharge(transactionId);
      // Reload transactions and tab data to get updated balance
      await loadTransactions();
      // Fetch updated tab
      if (onUpdate) {
        try {
          const tabsResponse = await customerTabsAPI.getByStore(currentTab.store_id);
          const updatedTab = tabsResponse.data.tabs?.find(t => t.id === currentTab.id);
          if (updatedTab) {
            setCurrentTab(updatedTab);
          }
        } catch (error) {
          console.error('Error reloading tab:', error);
        }
        onUpdate();
      }
      alert('Charge voided successfully. Balance updated.');
    } catch (error) {
      alert('Error voiding charge: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAddPayment = async () => {
    if (!paymentAmount || !transactionDate) {
      alert('Please enter amount and date');
      return;
    }
    // Calculate balance from all transactions (including filtered ones)
    const currentBalance = sortedTransactions.reduce((balance, transaction) => {
      if (transaction.transaction_type === 'charge' && !transaction.is_voided) {
        return balance + parseFloat(transaction.amount || 0);
      } else if (transaction.transaction_type === 'payment') {
        return balance - parseFloat(transaction.amount || 0);
      }
      return balance;
    }, 0);
    if (parseFloat(paymentAmount) > currentBalance) {
      alert('Payment amount cannot exceed current balance');
      return;
    }
    try {
      await customerTabsAPI.addPayment(currentTab.id, {
        transaction_date: transactionDate,
        amount: paymentAmount,
        payment_method: paymentMethod
      });
      setPaymentAmount('');
      setPaymentMethod('cash');
      setShowAddPaymentModal(false);
      loadTransactions();
      if (onUpdate) onUpdate();
    } catch (error) {
      alert('Error adding payment: ' + (error.response?.data?.error || error.message));
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Sort transactions chronologically (oldest first) for balance calculation
  const sortedTransactions = [...transactions].sort((a, b) => {
    const dateA = new Date(a.transaction_date + 'T' + (a.created_at ? a.created_at.split('T')[1] : '00:00:00'));
    const dateB = new Date(b.transaction_date + 'T' + (b.created_at ? b.created_at.split('T')[1] : '00:00:00'));
    return dateA - dateB;
  });

  // Calculate running balance at each transaction point (oldest to newest)
  const calculateRunningBalance = (index) => {
    let balance = 0;
    // Start from the beginning and work forward to this index
    for (let i = 0; i <= index; i++) {
      if (sortedTransactions[i].transaction_type === 'charge' && !sortedTransactions[i].is_voided) {
        balance += parseFloat(sortedTransactions[i].amount || 0);
      } else if (sortedTransactions[i].transaction_type === 'payment') {
        balance -= parseFloat(sortedTransactions[i].amount || 0);
      }
    }
    return balance;
  };

  // Calculate actual current balance from all transactions (excluding voided charges)
  const calculateActualBalance = () => {
    return sortedTransactions.reduce((balance, transaction) => {
      if (transaction.transaction_type === 'charge' && !transaction.is_voided) {
        return balance + parseFloat(transaction.amount || 0);
      } else if (transaction.transaction_type === 'payment') {
        return balance - parseFloat(transaction.amount || 0);
      }
      return balance;
    }, 0);
  };

  const actualBalance = calculateActualBalance();

  if (!currentTab) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl mx-4 my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{currentTab.customer_name}</h2>
            <div className="mt-1 flex items-center gap-4 text-sm">
              <span className="text-gray-600">
                Current Balance: <span className={`font-semibold text-lg ${actualBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ${actualBalance.toFixed(2)}
                </span>
              </span>
              {currentTab.customer_id && (
                <span className="text-gray-500">Customer ID: {currentTab.customer_id}</span>
              )}
              {Math.abs(actualBalance - parseFloat(currentTab.current_balance || 0)) > 0.01 && (
                <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                  (Stored: ${parseFloat(currentTab.current_balance || 0).toFixed(2)})
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowAddChargeModal(true);
                setTransactionDate(new Date().toISOString().split('T')[0]);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              + Add Charge
            </button>
            <button
              onClick={() => {
                setShowAddPaymentModal(true);
                setTransactionDate(new Date().toISOString().split('T')[0]);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              disabled={actualBalance <= 0}
            >
              Record Payment
            </button>
            <button
              onClick={async () => {
                // Recalculate balance from transactions
                try {
                  await customerTabsAPI.recalculateBalance(currentTab.id);
                  if (onUpdate) onUpdate();
                  loadTransactions();
                  alert('Balance recalculated successfully');
                } catch (error) {
                  alert('Error recalculating balance: ' + (error.response?.data?.error || error.message));
                }
              }}
              className="px-4 py-2 border border-orange-300 rounded hover:bg-orange-50 text-sm text-orange-700"
              title="Recalculate balance from all transactions"
            >
              Recalculate Balance
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm"
            >
              Close
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 bg-gray-50 border-b flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No transactions found
              {startDate || endDate ? ' for the selected date range' : ''}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date & Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Payment Method</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Balance</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedTransactions.map((transaction, index) => {
                    const runningBalance = calculateRunningBalance(index);
                    return (
                      <tr key={transaction.id} className={
                        transaction.transaction_type === 'charge' 
                          ? transaction.is_voided 
                            ? 'bg-gray-100 opacity-60' 
                            : 'bg-red-50'
                          : 'bg-green-50'
                      }>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium">{formatDate(transaction.transaction_date)}</div>
                          <div className="text-xs text-gray-500">{formatTime(transaction.created_at)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              transaction.transaction_type === 'charge' 
                                ? transaction.is_voided 
                                  ? 'bg-gray-100 text-gray-500 line-through' 
                                  : 'bg-red-100 text-red-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {transaction.transaction_type === 'charge' 
                                ? transaction.is_voided ? 'Voided' : 'Charge' 
                                : 'Payment'}
                            </span>
                            {transaction.transaction_type === 'charge' && !transaction.is_voided && (
                              <button
                                onClick={() => handleVoidCharge(transaction.id)}
                                className="text-xs text-red-600 hover:text-red-800 underline"
                                title="Void this charge"
                              >
                                Void
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-900">{transaction.description || '-'}</div>
                          {transaction.notes && (
                            <div className="text-xs text-gray-500 mt-1">{transaction.notes}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${
                            transaction.transaction_type === 'charge' ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {transaction.transaction_type === 'charge' ? '+' : '-'}
                            ${parseFloat(transaction.amount || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {transaction.payment_method ? (
                            <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                              {transaction.payment_method.charAt(0).toUpperCase() + transaction.payment_method.slice(1)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${
                            runningBalance > 0 ? 'text-red-600' : runningBalance < 0 ? 'text-green-600' : 'text-gray-600'
                          }`}>
                            ${Math.abs(runningBalance).toFixed(2)}
                          </span>
                          {runningBalance < 0 && (
                            <span className="text-xs text-gray-500 ml-1">(Credit)</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t flex justify-between items-center text-sm">
          <div className="flex gap-6">
            <div>
              <span className="text-gray-600">Total Charges: </span>
              <span className="font-semibold text-red-600">
                ${sortedTransactions
                    .filter(t => t.transaction_type === 'charge' && !t.is_voided)
                    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
                    .toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Total Payments: </span>
              <span className="font-semibold text-green-600">
                ${sortedTransactions
                  .filter(t => t.transaction_type === 'payment')
                  .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
                  .toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Transactions: </span>
              <span className="font-semibold">{sortedTransactions.length}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-gray-600">Current Balance: </span>
            <span className={`font-bold text-lg ${actualBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ${actualBalance.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Add Charge Modal */}
      {showAddChargeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Add Charge - {currentTab.customer_name}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                <input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <input
                  type="text"
                  value={chargeDescription}
                  onChange={(e) => setChargeDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Lottery tickets, Products, Gas"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowAddChargeModal(false);
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
      {showAddPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Record Payment - {currentTab.customer_name}</h3>
            <div className="mb-2 text-sm text-gray-600">
              Current Balance: <span className="font-semibold">${actualBalance.toFixed(2)}</span>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                <input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  max={actualBalance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
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
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowAddPaymentModal(false);
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
    </div>
  );
};

export default CustomerTabDetails;


