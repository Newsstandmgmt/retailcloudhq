import { useState, useEffect } from 'react';
import { lotterySalesDataAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

const DailySales = ({ storeId }) => {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingDate, setEditingDate] = useState(null);
  const [formData, setFormData] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    retailer_number: '',
    location_name: '',
    balance_forward: '',
    draw_sales: '',
    draw_cancels: '',
    draw_promos: '',
    draw_comm: '',
    draw_pays: '',
    vch_iss: '',
    vch_rd: '',
    webcash_iss: '',
    draw_adj: '',
    draw_due: '',
    scratch_offs_sales: '',
    scratch_offs_rtrns: '',
    scratch_offs_comm: '',
    scratch_offs_prms: '',
    scratch_offs_pays: '',
    scratch_offs_adj: '',
    scratch_offs_due: '',
    card_trans: '',
    gift_cards: '',
    prepaid: '',
    total_due: '',
    notes: ''
  });
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadSales();
  }, [storeId]);

  const loadSales = async () => {
    setLoading(true);
    try {
      const response = await lotterySalesDataAPI.getDailySales(storeId);
      setSales(response.data.sales || []);
    } catch (error) {
      console.error('Error loading daily sales:', error);
      setAlert({ type: 'error', message: 'Failed to load daily sales' });
    } finally {
      setLoading(false);
    }
  };

  const getDataSource = (sale) => {
    if (!sale.entered_by) {
      if (sale.notes && sale.notes.toLowerCase().includes('email')) {
        return { type: 'gmail', label: 'Gmail Import', color: 'blue' };
      }
      return { type: 'system', label: 'System Import', color: 'green' };
    }
    // Manual entry (has entered_by)
    return { type: 'manual', label: 'Manual', color: 'gray' };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await lotterySalesDataAPI.saveDailySale(storeId, formData);
      setAlert({ type: 'success', message: 'Daily sale saved successfully' });
      setShowForm(false);
      setEditingDate(null);
      resetForm();
      loadSales();
    } catch (error) {
      console.error('Error saving daily sale:', error);
      setAlert({ type: 'error', message: error.response?.data?.error || 'Failed to save daily sale' });
    }
  };

  const handleEdit = (sale) => {
    setFormData({
      entry_date: sale.entry_date,
      retailer_number: sale.retailer_number || '',
      location_name: sale.location_name || '',
      balance_forward: sale.balance_forward || '',
      draw_sales: sale.draw_sales || '',
      draw_cancels: sale.draw_cancels || '',
      draw_promos: sale.draw_promos || '',
      draw_comm: sale.draw_comm || '',
      draw_pays: sale.draw_pays || '',
      vch_iss: sale.vch_iss || '',
      vch_rd: sale.vch_rd || '',
      webcash_iss: sale.webcash_iss || '',
      draw_adj: sale.draw_adj || '',
      draw_due: sale.draw_due || '',
      scratch_offs_sales: sale.scratch_offs_sales || '',
      scratch_offs_rtrns: sale.scratch_offs_rtrns || '',
      scratch_offs_comm: sale.scratch_offs_comm || '',
      scratch_offs_prms: sale.scratch_offs_prms || '',
      scratch_offs_pays: sale.scratch_offs_pays || '',
      scratch_offs_adj: sale.scratch_offs_adj || '',
      scratch_offs_due: sale.scratch_offs_due || '',
      card_trans: sale.card_trans || '',
      gift_cards: sale.gift_cards || '',
      prepaid: sale.prepaid || '',
      total_due: sale.total_due || '',
      notes: sale.notes || ''
    });
    setEditingDate(sale.entry_date);
    setShowForm(true);
  };

  const handleDelete = async (date) => {
    if (!window.confirm('Are you sure you want to delete this daily sale entry?')) {
      return;
    }
    try {
      await lotterySalesDataAPI.deleteDailySale(storeId, date);
      setAlert({ type: 'success', message: 'Daily sale deleted successfully' });
      loadSales();
    } catch (error) {
      console.error('Error deleting daily sale:', error);
      setAlert({ type: 'error', message: 'Failed to delete daily sale' });
    }
  };

  const resetForm = () => {
    setFormData({
      entry_date: new Date().toISOString().split('T')[0],
      retailer_number: '',
      location_name: '',
      balance_forward: '',
      draw_sales: '',
      draw_cancels: '',
      draw_promos: '',
      draw_comm: '',
      draw_pays: '',
      vch_iss: '',
      vch_rd: '',
      webcash_iss: '',
      draw_adj: '',
      draw_due: '',
      scratch_offs_sales: '',
      scratch_offs_rtrns: '',
      scratch_offs_comm: '',
      scratch_offs_prms: '',
      scratch_offs_pays: '',
      scratch_offs_adj: '',
      scratch_offs_due: '',
      card_trans: '',
      gift_cards: '',
      prepaid: '',
      total_due: '',
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
        <h3 className="text-lg font-semibold">Daily Sales Reports</h3>
        <button
          onClick={() => {
            resetForm();
            setEditingDate(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add Daily Sale
        </button>
      </div>

      <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-2">Integration Data Status</h4>
        <p className="text-sm text-gray-600">
          Lottery sales are automatically updated when Gmail integrations import new reports.
          Manual edits can be made at any time to correct or supplement imported numbers.
        </p>
      </div>


      {showForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-semibold mb-4">
            {editingDate ? 'Edit Daily Sale' : 'Add Daily Sale'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={formData.entry_date}
                  onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location Name</label>
                <input
                  type="text"
                  value={formData.location_name}
                  onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Balance Forward</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.balance_forward}
                  onChange={(e) => setFormData({ ...formData, balance_forward: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h5 className="font-semibold mb-3">Draw/Online Lottery</h5>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Draw Sales</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.draw_sales}
                    onChange={(e) => setFormData({ ...formData, draw_sales: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Draw Cancels</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.draw_cancels}
                    onChange={(e) => setFormData({ ...formData, draw_cancels: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Draw Comm</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.draw_comm}
                    onChange={(e) => setFormData({ ...formData, draw_comm: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h5 className="font-semibold mb-3">Scratch-Offs</h5>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scratch-Offs Sales</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.scratch_offs_sales}
                    onChange={(e) => setFormData({ ...formData, scratch_offs_sales: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scratch-Offs Comm</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.scratch_offs_comm}
                    onChange={(e) => setFormData({ ...formData, scratch_offs_comm: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Due</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.total_due}
                    onChange={(e) => setFormData({ ...formData, total_due: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
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
      ) : sales.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No daily sales entries found.</p>
          <p className="text-sm mt-2">Data will appear here when Gmail integrations import reports or when entries are added manually.</p>
          <p className="text-sm mt-1">Configure email integrations in Settings → Integrations.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Draw Sales</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scratch-Offs Sales</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Comm</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Due</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sales.map((sale) => {
                const dataSource = getDataSource(sale);
                return (
                <tr key={sale.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(sale.entry_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      dataSource.color === 'green' ? 'bg-green-100 text-green-800' :
                      dataSource.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {dataSource.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(sale.draw_sales)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(sale.scratch_offs_sales)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency((sale.draw_comm || 0) + (sale.scratch_offs_comm || 0))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(sale.total_due)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(sale)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Edit
                    </button>
                    {(user?.role === 'super_admin' || user?.role === 'admin') && (
                      <button
                        onClick={() => handleDelete(sale.entry_date)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
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

export default DailySales;

