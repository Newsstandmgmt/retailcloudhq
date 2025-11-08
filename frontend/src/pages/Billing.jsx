import { useState, useEffect } from 'react';
import { billingAPI, adminManagementAPI, subscriptionsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Billing = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAutoGenerateModal, setShowAutoGenerateModal] = useState(false);
  const [selectedAdminForAuto, setSelectedAdminForAuto] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({
    admin_id: '',
    amount: '',
    billing_period_start: '',
    billing_period_end: '',
    due_date: ''
  });

  useEffect(() => {
    if (user?.role === 'super_admin') {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      const [invoicesRes, adminsRes, subscriptionsRes] = await Promise.all([
        billingAPI.getAll(),
        adminManagementAPI.getAdmins(),
        subscriptionsAPI.getAll({ status: 'active' }).catch(() => ({ data: { subscriptions: [] } }))
      ]);
      setInvoices(invoicesRes.data.invoices || []);
      setAdmins(adminsRes.data.admins || []);
      setSubscriptions(subscriptionsRes.data.subscriptions || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    try {
      await billingAPI.create(invoiceForm);
      alert('Invoice created successfully!');
      setShowCreateModal(false);
      setInvoiceForm({
        admin_id: '',
        amount: '',
        billing_period_start: '',
        billing_period_end: '',
        due_date: ''
      });
      loadData();
    } catch (error) {
      alert('Error creating invoice: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleUpdateStatus = async (invoiceId, newStatus) => {
    try {
      await billingAPI.updateStatus(invoiceId, newStatus);
      alert('Invoice status updated successfully!');
      loadData();
    } catch (error) {
      alert('Error updating status: ' + (error.response?.data?.error || error.message));
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (user?.role !== 'super_admin') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Access denied. Only Super Admin can access this page.
        </div>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing Management</h1>
          <p className="text-gray-600">Manage invoices and billing for store owners</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAutoGenerateModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Auto-Generate from Subscriptions
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Create Manual Invoice
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                  No invoices found
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {invoice.invoice_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {invoice.first_name} {invoice.last_name}
                    <br />
                    <span className="text-gray-500 text-xs">{invoice.email}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${parseFloat(invoice.amount).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(invoice.billing_period_start).toLocaleDateString()} - {new Date(invoice.billing_period_end).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(invoice.due_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {invoice.status !== 'paid' && (
                      <button
                        onClick={() => handleUpdateStatus(invoice.id, 'paid')}
                        className="text-green-600 hover:text-green-900 mr-3"
                      >
                        Mark Paid
                      </button>
                    )}
                    {invoice.status === 'pending' && (
                      <button
                        onClick={() => handleUpdateStatus(invoice.id, 'overdue')}
                        className="text-red-600 hover:text-red-900"
                      >
                        Mark Overdue
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Create Invoice</h2>
            <form onSubmit={handleCreateInvoice}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin (Store Owner) *
                  </label>
                  <select
                    value={invoiceForm.admin_id}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, admin_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    <option value="">Select an admin...</option>
                    {admins.map((admin) => (
                      <option key={admin.user_id} value={admin.user_id}>
                        {admin.first_name} {admin.last_name} ({admin.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={invoiceForm.amount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Billing Period Start *
                  </label>
                  <input
                    type="date"
                    value={invoiceForm.billing_period_start}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, billing_period_start: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Billing Period End *
                  </label>
                  <input
                    type="date"
                    value={invoiceForm.billing_period_end}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, billing_period_end: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    value={invoiceForm.due_date}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auto-Generate Invoices Modal */}
      {showAutoGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Auto-Generate Invoices from Subscriptions</h2>
            <p className="text-sm text-gray-600 mb-4">
              Select admins with active subscriptions to generate invoices for their next billing cycle.
            </p>
            <div className="space-y-3 mb-4">
              {subscriptions.filter(sub => {
                const nextBillingDate = new Date(sub.next_billing_date);
                const today = new Date();
                return nextBillingDate <= today; // Only show subscriptions due for billing
              }).map((subscription) => (
                <div key={subscription.id} className="border border-gray-200 rounded p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{subscription.first_name} {subscription.last_name}</p>
                      <p className="text-sm text-gray-600">{subscription.email}</p>
                      <p className="text-sm text-gray-500">
                        Plan: {subscription.plan_name} - ${parseFloat(subscription.price_per_month).toFixed(2)}/{subscription.billing_cycle}
                      </p>
                      <p className="text-sm text-gray-500">
                        Next Billing: {new Date(subscription.next_billing_date).toLocaleDateString()}
                      </p>
                      {(subscription.discount_percentage > 0 || subscription.discount_amount > 0) && (
                        <p className="text-sm text-green-600 mt-1">
                          Discount: {subscription.discount_percentage > 0 && `${subscription.discount_percentage}%`}
                          {subscription.discount_percentage > 0 && subscription.discount_amount > 0 && ' + '}
                          {subscription.discount_amount > 0 && `$${parseFloat(subscription.discount_amount).toFixed(2)}`}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await subscriptionsAPI.generateInvoice(subscription.admin_id);
                          alert('Invoice generated successfully!');
                          loadData();
                        } catch (error) {
                          alert('Error generating invoice: ' + (error.response?.data?.error || error.message));
                        }
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Generate Invoice
                    </button>
                  </div>
                </div>
              ))}
              {subscriptions.filter(sub => {
                const nextBillingDate = new Date(sub.next_billing_date);
                const today = new Date();
                return nextBillingDate <= today;
              }).length === 0 && (
                <p className="text-gray-500 text-center py-4">No subscriptions due for billing</p>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowAutoGenerateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;

