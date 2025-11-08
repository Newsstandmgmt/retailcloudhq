import { useState, useEffect } from 'react';
import { recurringExpensesAPI } from '../services/api';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';

const RecurringExpenses = () => {
  const { selectedStore } = useStore();
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (selectedStore) {
      loadTemplates();
    }
  }, [selectedStore]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await recurringExpensesAPI.getTemplates(selectedStore.id);
      setTemplates(response.data.templates || []);
    } catch (error) {
      console.error('Error loading recurring expense templates:', error);
      alert('Error loading recurring expenses: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleProcessNow = async () => {
    if (!window.confirm('Are you sure you want to process recurring expenses now? This will create expense entries for all due recurring expenses.')) {
      return;
    }

    setProcessing(true);
    try {
      const response = await recurringExpensesAPI.process();
      const result = response.data;
      alert(`Processed ${result.created.length} recurring expenses.\n${result.errors.length > 0 ? `Errors: ${result.errors.length}` : 'No errors.'}`);
      loadTemplates(); // Refresh to show updated next due dates
    } catch (error) {
      alert('Error processing recurring expenses: ' + (error.response?.data?.error || error.message));
    } finally {
      setProcessing(false);
    }
  };

  const getFrequencyLabel = (frequency) => {
    const labels = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      yearly: 'Yearly'
    };
    return labels[frequency] || frequency;
  };

  const getPaymentMethodLabel = (method) => {
    const labels = {
      cash: 'Cash',
      bank: 'Bank',
      card: 'Card',
      check: 'Check'
    };
    return labels[method] || method;
  };

  const isOverdue = (nextDueDate) => {
    if (!nextDueDate) return false;
    return new Date(nextDueDate) < new Date();
  };

  const daysUntilDue = (nextDueDate) => {
    if (!nextDueDate) return null;
    const today = new Date();
    const due = new Date(nextDueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-8">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recurring Expenses</h1>
          <p className="text-gray-600 mt-1">Manage and view your recurring expense templates</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'super_admin') && (
          <button
            onClick={handleProcessNow}
            disabled={processing}
            className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {processing ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Process Now
              </>
            )}
          </button>
        )}
      </div>

      {templates.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Recurring Expenses</h3>
          <p className="text-gray-600 mb-4">Create recurring expenses in the Operating Expenses page by marking an expense as recurring.</p>
          <a
            href="/expenses"
            className="inline-flex items-center px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49]"
          >
            Go to Operating Expenses
          </a>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expense Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frequency</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Autopay</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Next Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {templates.map((template) => {
                const days = daysUntilDue(template.next_due_date);
                const overdue = isOverdue(template.next_due_date);
                
                return (
                  <tr key={template.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{template.expense_type_name || 'Uncategorized'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">${parseFloat(template.amount || 0).toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {getFrequencyLabel(template.recurring_frequency)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{getPaymentMethodLabel(template.payment_method)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {template.is_autopay ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Yes</span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">No</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {template.next_due_date ? (
                        <div className="text-sm text-gray-900">
                          {new Date(template.next_due_date).toLocaleDateString()}
                          {days !== null && (
                            <div className={`text-xs ${overdue ? 'text-red-600' : days <= 3 ? 'text-orange-600' : 'text-gray-500'}`}>
                              {overdue ? `${Math.abs(days)} days overdue` : days === 0 ? 'Due today' : `${days} days left`}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {overdue ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Overdue</span>
                      ) : days !== null && days <= 3 ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">Due Soon</span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Active</span>
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
  );
};

export default RecurringExpenses;

