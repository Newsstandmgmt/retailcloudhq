import { useState, useEffect } from 'react';
import { lotterySalesDataAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

const ThirteenWeekAverage = ({ storeId }) => {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingDate, setEditingDate] = useState(null);
  const [formData, setFormData] = useState({
    report_date: new Date().toISOString().split('T')[0],
    retailer_number: '',
    location_name: '',
    thirteen_week_average: '',
    total_sales: '',
    total_commissions: '',
    notes: ''
  });
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadReports();
  }, [storeId]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const response = await lotterySalesDataAPI.get13WeekReports(storeId);
      setReports(response.data.reports || []);
    } catch (error) {
      console.error('Error loading 13-week average reports:', error);
      setAlert({ type: 'error', message: 'Failed to load 13-week average reports' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await lotterySalesDataAPI.save13WeekReport(storeId, formData);
      setAlert({ type: 'success', message: '13-week average report saved successfully' });
      setShowForm(false);
      setEditingDate(null);
      resetForm();
      loadReports();
    } catch (error) {
      console.error('Error saving 13-week average report:', error);
      setAlert({ type: 'error', message: error.response?.data?.error || 'Failed to save 13-week average report' });
    }
  };

  const handleEdit = (report) => {
    setFormData({
      report_date: report.report_date,
      retailer_number: report.retailer_number || '',
      location_name: report.location_name || '',
      thirteen_week_average: report.thirteen_week_average || '',
      total_sales: report.total_sales || '',
      total_commissions: report.total_commissions || '',
      notes: report.notes || ''
    });
    setEditingDate(report.report_date);
    setShowForm(true);
  };

  const handleDelete = async (date) => {
    if (!window.confirm('Are you sure you want to delete this 13-week average report?')) {
      return;
    }
    try {
      await lotterySalesDataAPI.delete13WeekReport(storeId, date);
      setAlert({ type: 'success', message: '13-week average report deleted successfully' });
      loadReports();
    } catch (error) {
      console.error('Error deleting 13-week average report:', error);
      setAlert({ type: 'error', message: 'Failed to delete 13-week average report' });
    }
  };

  const resetForm = () => {
    setFormData({
      report_date: new Date().toISOString().split('T')[0],
      retailer_number: '',
      location_name: '',
      thirteen_week_average: '',
      total_sales: '',
      total_commissions: '',
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
        <h3 className="text-lg font-semibold">13 Week Average Reports</h3>
        <button
          onClick={() => {
            resetForm();
            setEditingDate(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add 13 Week Average
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-semibold mb-4">
            {editingDate ? 'Edit 13 Week Average Report' : 'Add 13 Week Average Report'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Report Date *</label>
                <input
                  type="date"
                  value={formData.report_date}
                  onChange={(e) => setFormData({ ...formData, report_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Retailer Number</label>
                <input
                  type="text"
                  value={formData.retailer_number}
                  onChange={(e) => setFormData({ ...formData, retailer_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">13 Week Average</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.thirteen_week_average}
                  onChange={(e) => setFormData({ ...formData, thirteen_week_average: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
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
          <p>No 13-week average reports found.</p>
          <p className="text-sm mt-2">Click "Add 13 Week Average" to create a new entry.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Report Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">13 Week Average</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sales</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Commissions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reports.map((report) => (
                <tr key={report.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(report.report_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(report.thirteen_week_average)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(report.total_sales)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(report.total_commissions)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(report)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Edit
                    </button>
                    {(user?.role === 'super_admin' || user?.role === 'admin') && (
                      <button
                        onClick={() => handleDelete(report.report_date)}
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

export default ThirteenWeekAverage;

