import { useState, useEffect } from 'react';
import { lotterySalesDataAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

const WeeklySettlement = ({ storeId }) => {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingDate, setEditingDate] = useState(null);
  const [formData, setFormData] = useState({
    settlement_date: new Date().toISOString().split('T')[0],
    period_start_date: new Date().toISOString().split('T')[0],
    period_end_date: new Date().toISOString().split('T')[0],
    retailer_number: '',
    location_name: '',
    balance_forward: '',
    total_sales: '',
    total_commissions: '',
    balance_due: '',
    notes: ''
  });
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadReports();
  }, [storeId]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const response = await lotterySalesDataAPI.getSettlementReports(storeId);
      setReports(response.data.reports || []);
    } catch (error) {
      console.error('Error loading weekly settlement reports:', error);
      setAlert({ type: 'error', message: 'Failed to load weekly settlement reports' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await lotterySalesDataAPI.saveSettlementReport(storeId, formData);
      setAlert({ type: 'success', message: 'Weekly settlement report saved successfully' });
      setShowForm(false);
      setEditingDate(null);
      resetForm();
      loadReports();
    } catch (error) {
      console.error('Error saving weekly settlement report:', error);
      setAlert({ type: 'error', message: error.response?.data?.error || 'Failed to save weekly settlement report' });
    }
  };

  const handleEdit = (report) => {
    setFormData({
      settlement_date: report.settlement_date,
      period_start_date: report.period_start_date || report.settlement_date,
      period_end_date: report.period_end_date || report.settlement_date,
      retailer_number: report.retailer_number || '',
      location_name: report.location_name || '',
      balance_forward: report.balance_forward || '',
      total_sales: report.total_sales || '',
      total_commissions: report.total_commissions || '',
      balance_due: report.balance_due || '',
      notes: report.notes || ''
    });
    setEditingDate(report.settlement_date);
    setShowForm(true);
  };

  const handleDelete = async (date) => {
    if (!window.confirm('Are you sure you want to delete this weekly settlement report?')) {
      return;
    }
    try {
      await lotterySalesDataAPI.deleteSettlementReport(storeId, date);
      setAlert({ type: 'success', message: 'Weekly settlement report deleted successfully' });
      loadReports();
    } catch (error) {
      console.error('Error deleting weekly settlement report:', error);
      setAlert({ type: 'error', message: 'Failed to delete weekly settlement report' });
    }
  };

  const handleReconcile = async (date) => {
    const notes = window.prompt('Enter reconciliation notes:');
    if (notes === null) return;
    try {
      await lotterySalesDataAPI.reconcileSettlement(storeId, date, notes);
      setAlert({ type: 'success', message: 'Settlement marked as reconciled' });
      loadReports();
    } catch (error) {
      console.error('Error reconciling settlement:', error);
      setAlert({ type: 'error', message: 'Failed to reconcile settlement' });
    }
  };

  const resetForm = () => {
    const today = new Date().toISOString().split('T')[0];
    setFormData({
      settlement_date: today,
      period_start_date: today,
      period_end_date: today,
      retailer_number: '',
      location_name: '',
      balance_forward: '',
      total_sales: '',
      total_commissions: '',
      balance_due: '',
      notes: ''
    });
  };

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  return (
    <div>
      {alert && (
        <div className={`mb-4 p-4 rounded ${
          alert.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
          'bg-green-50 text-green-800 border border-green-200'
        }`}>
          <div className="flex justify-between items-center">
            <span>{alert.message}</span>
            <button onClick={() => setAlert(null)} className="text-lg">×</button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Weekly Settlement Reports</h3>
        <button
          onClick={() => {
            resetForm();
            setEditingDate(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add Weekly Settlement
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-semibold mb-4">
            {editingDate ? 'Edit Weekly Settlement Report' : 'Add Weekly Settlement Report'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Settlement Date *</label>
                <input
                  type="date"
                  value={formData.settlement_date}
                  onChange={(e) => setFormData({ ...formData, settlement_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period Start Date</label>
                <input
                  type="date"
                  value={formData.period_start_date}
                  onChange={(e) => setFormData({ ...formData, period_start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period End Date</label>
                <input
                  type="date"
                  value={formData.period_end_date}
                  onChange={(e) => setFormData({ ...formData, period_end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Sales</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.total_sales}
                  onChange={(e) => setFormData({ ...formData, total_sales: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Commissions</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.total_commissions}
                  onChange={(e) => setFormData({ ...formData, total_commissions: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Balance Due</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.balance_due}
                  onChange={(e) => setFormData({ ...formData, balance_due: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingDate(null);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No weekly settlement reports found.</p>
          <p className="text-sm mt-2">Click "Add Weekly Settlement" to create a new entry.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Settlement Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sales</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Commissions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance Due</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reports.map((report) => (
                <tr key={report.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(report.settlement_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(report.total_sales)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(report.total_commissions)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(report.balance_due)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {report.reconciled ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Reconciled</span>
                    ) : (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">Pending</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(report)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Edit
                    </button>
                    {!report.reconciled && (
                      <button
                        onClick={() => handleReconcile(report.settlement_date)}
                        className="text-green-600 hover:text-green-900 mr-3"
                      >
                        Reconcile
                      </button>
                    )}
                    {(user?.role === 'super_admin' || user?.role === 'admin') && (
                      <button
                        onClick={() => handleDelete(report.settlement_date)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default WeeklySettlement;

