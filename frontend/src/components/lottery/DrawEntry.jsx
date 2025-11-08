import { useState, useEffect } from 'react';
import { lotteryAPI } from '../../services/api';

const DrawEntry = ({ storeId }) => {
  const [drawDay, setDrawDay] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    total_sales: '',
    total_cashed: '',
    adjustments: '',
    commission_source: 'manual',
    commission_amount: '',
    notes: ''
  });
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadDrawDay();
  }, [storeId, formData.date]);

  const loadDrawDay = async () => {
    if (!formData.date) return;
    setLoading(true);
    try {
      const response = await lotteryAPI.getDrawDay(storeId, formData.date);
      if (response.data.drawDay) {
        setDrawDay(response.data.drawDay);
        setFormData({
          date: response.data.drawDay.date,
          total_sales: response.data.drawDay.total_sales || '',
          total_cashed: response.data.drawDay.total_cashed || '',
          adjustments: response.data.drawDay.adjustments || '',
          commission_source: response.data.drawDay.commission_source || 'manual',
          commission_amount: response.data.drawDay.commission_amount || '',
          notes: response.data.drawDay.notes || ''
        });
      } else {
        setDrawDay(null);
        setFormData({
          date: formData.date,
          total_sales: '',
          total_cashed: '',
          adjustments: '',
          commission_source: 'manual',
          commission_amount: '',
          notes: ''
        });
      }
    } catch (error) {
      console.error('Error loading draw day:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        ...formData,
        total_sales: parseFloat(formData.total_sales) || 0,
        total_cashed: parseFloat(formData.total_cashed) || 0,
        adjustments: parseFloat(formData.adjustments) || 0,
        commission_amount: formData.commission_amount ? parseFloat(formData.commission_amount) : null,
      };

      await lotteryAPI.saveDrawDay(storeId, data);
      setAlert({ type: 'success', message: 'Draw/Online lottery entry saved successfully' });
      loadDrawDay();
    } catch (error) {
      console.error('Error saving draw day:', error);
      setAlert({ type: 'error', message: error.response?.data?.error || 'Failed to save entry' });
    } finally {
      setLoading(false);
    }
  };

  const netSale = (parseFloat(formData.total_sales) || 0) - 
                  (parseFloat(formData.total_cashed) || 0) - 
                  (parseFloat(formData.adjustments) || 0);

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

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Draw/Online Lottery Entry</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Commission Source
              </label>
              <select
                value={formData.commission_source}
                onChange={(e) => setFormData({ ...formData, commission_source: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="manual">Manual Entry</option>
                <option value="statement">Operator Statement</option>
                <option value="rate">Rate-Based</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Sales <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.total_sales}
                onChange={(e) => setFormData({ ...formData, total_sales: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Cashed
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.total_cashed}
                onChange={(e) => setFormData({ ...formData, total_cashed: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adjustments
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.adjustments}
                onChange={(e) => setFormData({ ...formData, adjustments: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="0.00"
              />
              <p className="text-xs text-gray-500 mt-1">Enter negative for fees/deductions</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Net Sale (Ops)
              </label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                ${netSale.toFixed(2)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Sales - Cashed - Adjustments</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Commission Amount
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.commission_amount}
                onChange={(e) => setFormData({ ...formData, commission_amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="0.00"
              />
              <p className="text-xs text-gray-500 mt-1">Leave blank if from statement</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows="3"
              placeholder="Enter any notes or reference terminal tape information..."
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={loadDrawDay}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              Reset
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </form>

        {drawDay && (
          <div className="mt-6 p-4 bg-gray-50 rounded">
            <h3 className="font-semibold mb-2">Last Saved Entry</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="font-medium">Total Sales:</span> ${drawDay.total_sales?.toFixed(2)}</div>
              <div><span className="font-medium">Total Cashed:</span> ${drawDay.total_cashed?.toFixed(2)}</div>
              <div><span className="font-medium">Adjustments:</span> ${drawDay.adjustments?.toFixed(2)}</div>
              <div><span className="font-medium">Net Sale:</span> ${drawDay.net_sale?.toFixed(2)}</div>
              {drawDay.commission_amount && (
                <div><span className="font-medium">Commission:</span> ${drawDay.commission_amount.toFixed(2)}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DrawEntry;

