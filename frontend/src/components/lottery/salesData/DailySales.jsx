import { useEffect, useMemo, useState } from 'react';
import { revenueAPI, lotterySalesDataAPI } from '../../../services/api';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value || 0);

const formatDateLabel = (dateStr) => {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const getToday = () => {
  const date = new Date();
  return date.toISOString().split('T')[0];
};

const getDateDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
};

const DailySales = ({ storeId }) => {
  const [startDate, setStartDate] = useState(getDateDaysAgo(14));
  const [endDate, setEndDate] = useState(getToday());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const validDateRange = useMemo(() => {
    if (!startDate || !endDate) return false;
    return new Date(startDate) <= new Date(endDate);
  }, [startDate, endDate]);

  useEffect(() => {
    if (storeId && validDateRange) {
      loadData();
    } else {
      setRows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, startDate, endDate, validDateRange]);

  const loadData = async () => {
    if (!storeId || !validDateRange) return;
    setLoading(true);
    setError(null);

    try {
      const [revenueRes, lotteryRes] = await Promise.all([
        revenueAPI.getDailyRevenueRange(storeId, startDate, endDate),
        lotterySalesDataAPI.getDailySales(storeId, { startDate, endDate })
      ]);

      const revenueEntries = revenueRes.data.revenues || [];
      const lotteryEntries = lotteryRes.data.sales || [];

      const revenueMap = revenueEntries.reduce((acc, entry) => {
        if (entry.entry_date) {
          acc[entry.entry_date] = entry;
        }
        return acc;
      }, {});

      const lotteryMap = lotteryEntries.reduce((acc, entry) => {
        if (entry.entry_date) {
          acc[entry.entry_date] = entry;
        }
        return acc;
      }, {});

      const uniqueDates = Array.from(
        new Set([...Object.keys(revenueMap), ...Object.keys(lotteryMap)])
      ).sort();

      const combinedRows = uniqueDates.map((date) => {
        const revenue = revenueMap[date] || {};
        const lottery = lotteryMap[date] || {};
        return {
          date,
          onlineSales: parseFloat(revenue.online_sales || 0),
          onlineNet: parseFloat(revenue.online_net || 0),
          instantSales: parseFloat(revenue.total_instant || 0),
          instantPay: parseFloat(revenue.instant_pay || 0),
          dailyLotteryCash: parseFloat(
            lottery.daily_lottery_cash ??
              lottery.draw_sales ??
              revenue.calculated_lottery_owed ??
              0
          ),
          dataSource: lottery.id
            ? lottery.entered_by
              ? 'Manual Override'
              : 'Email Import'
            : 'Daily Revenue Entry'
        };
      });

      setRows(combinedRows);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error loading combined daily lottery data:', err);
      setError(err.response?.data?.error || 'Failed to load daily sales');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  if (!storeId) {
    return (
      <div className="text-center py-8 text-gray-500">
        Select a store to view daily lottery sales.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Daily Sales Snapshot</h3>
            <p className="text-sm text-gray-600">
              Numbers are sourced directly from Daily Revenue entries and any Gmail-imported lottery
              reports for the same dates to ensure a single source of truth.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={loadData}
              disabled={loading || !validDateRange}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>
        {!validDateRange && (
          <p className="text-sm text-red-600 mt-3">Start date must be before end date.</p>
        )}
        {lastUpdated && (
          <p className="text-xs text-gray-500 mt-2">
            Last synced: {lastUpdated.toLocaleString()}
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading daily sales…</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          No data available for the selected date range.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Daily Online Sales
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Online Pay (Net)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Instant Sales
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Instant Pay
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Daily Lottery Cash
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Source
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((row) => (
                <tr key={row.date}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {formatDateLabel(row.date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    {formatCurrency(row.onlineSales)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    {formatCurrency(row.onlineNet)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    {formatCurrency(row.instantSales)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    {formatCurrency(row.instantPay)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    {formatCurrency(row.dailyLotteryCash)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{row.dataSource}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Totals</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  {formatCurrency(rows.reduce((sum, row) => sum + row.onlineSales, 0))}
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  {formatCurrency(rows.reduce((sum, row) => sum + row.onlineNet, 0))}
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  {formatCurrency(rows.reduce((sum, row) => sum + row.instantSales, 0))}
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  {formatCurrency(rows.reduce((sum, row) => sum + row.instantPay, 0))}
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  {formatCurrency(rows.reduce((sum, row) => sum + row.dailyLotteryCash, 0))}
                </th>
                <th />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default DailySales;

