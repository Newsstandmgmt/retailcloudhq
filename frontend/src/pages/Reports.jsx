import { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const Reports = () => {
  const { selectedStore } = useStore();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profit-loss');
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);

  const { isFeatureEnabled } = useStore();
  
  const allTabs = [
    { id: 'profit-loss', name: 'Profit & Loss' },
    { id: 'cash-flow', name: 'Cash Flow' },
    { id: 'expense-breakdown', name: 'Expense Breakdown' },
    { id: 'vendor-payments', name: 'Vendor Payments' },
    { id: 'sales-trends', name: 'Sales Trends' },
    { id: 'daily-business', name: 'Daily Business' },
    { id: 'monthly-business', name: 'Monthly Business' },
    { id: 'lottery-sales', name: 'Lottery Sales', feature: 'lottery' },
    { id: 'deposits', name: 'Deposits' },
    { id: 'payroll', name: 'Payroll', feature: 'payroll' },
    { id: 'inventory', name: 'Inventory Data' },
  ];
  
  // Filter tabs based on enabled features
  const tabs = allTabs.filter(tab => {
    if (!tab.feature) return true;
    return isFeatureEnabled(tab.feature);
  });

  useEffect(() => {
    if (selectedStore) {
      loadReport();
    }
  }, [selectedStore, activeTab, startDate, endDate, selectedDate, selectedYear, selectedMonth]);

  const loadReport = async () => {
    if (!selectedStore) return;
    
    setLoading(true);
    setError(null);
    try {
      let response;
      switch (activeTab) {
        case 'profit-loss':
          response = await reportsAPI.getProfitLoss(selectedStore.id, startDate, endDate);
          break;
        case 'cash-flow':
          response = await reportsAPI.getCashFlowDetailed(selectedStore.id, startDate, endDate);
          break;
        case 'expense-breakdown':
          response = await reportsAPI.getExpenseBreakdown(selectedStore.id, startDate, endDate);
          break;
        case 'vendor-payments':
          response = await reportsAPI.getVendorPayments(selectedStore.id, startDate, endDate);
          break;
        case 'daily-business':
          response = await reportsAPI.getDailyBusiness(selectedStore.id, selectedDate);
          break;
        case 'monthly-business':
          response = await reportsAPI.getMonthlyBusiness(selectedStore.id, selectedYear, selectedMonth);
          break;
        case 'lottery-sales':
          response = await reportsAPI.getLotterySales(selectedStore.id, startDate, endDate);
          break;
        case 'deposits':
          response = await reportsAPI.getDeposits(selectedStore.id, startDate, endDate);
          break;
        case 'payroll':
          response = await reportsAPI.getPayroll(selectedStore.id, startDate, endDate);
          break;
        case 'sales-trends':
          response = await reportsAPI.getSalesTrends(selectedStore.id, startDate, endDate);
          break;
        case 'inventory':
          response = await reportsAPI.getInventory(selectedStore.id, startDate, endDate);
          break;
        default:
          return;
      }
      setReportData(response.data);
    } catch (err) {
      console.error('Error loading report:', err);
      setError(err.response?.data?.error || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  const handleExport = (format) => {
    if (!reportData) return;
    
    const reportName = tabs.find(t => t.id === activeTab)?.name || 'Report';
    let filename = reportName.replace(/\s+/g, '_');
    
    if (needsDateRange) {
      filename += `_${startDate}_to_${endDate}`;
    } else if (needsSingleDate) {
      filename += `_${selectedDate}`;
    } else if (needsMonthYear) {
      filename += `_${selectedYear}_${selectedMonth}`;
    }
    
    try {
      switch (format) {
        case 'csv':
          exportToCSV(prepareExportData(), filename);
          break;
        case 'excel':
          exportToExcel(prepareExportData(), filename);
          break;
        case 'pdf':
          const metadata = {
            storeName: selectedStore?.name || '',
            period: getPeriodString(),
            generatedBy: `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || '',
            generatedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          };
          exportToPDF(reportName, prepareExportHTML(), filename, metadata);
          break;
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('Error exporting report: ' + err.message);
    }
  };

  const getPeriodString = () => {
    if (needsDateRange) {
      return `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
    } else if (needsSingleDate) {
      return new Date(selectedDate).toLocaleDateString();
    } else if (needsMonthYear) {
      return new Date(`${selectedYear}-${selectedMonth}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    return '';
  };

  const prepareExportData = () => {
    if (!reportData) return { headers: [], rows: [] };
    
    switch (activeTab) {
      case 'profit-loss':
        return prepareProfitLossExport();
      case 'cash-flow':
        return prepareCashFlowExport();
      case 'expense-breakdown':
        return prepareExpenseBreakdownExport();
      case 'vendor-payments':
        return prepareVendorPaymentsExport();
      case 'daily-business':
        return prepareDailyBusinessExport();
      case 'monthly-business':
        return prepareMonthlyBusinessExport();
      case 'lottery-sales':
        return prepareLotterySalesExport();
      case 'deposits':
        return prepareDepositsExport();
      case 'payroll':
        return preparePayrollExport();
      case 'sales-trends':
        return prepareSalesTrendsExport();
      default:
        return { headers: [], rows: [] };
    }
  };

  const prepareExportHTML = () => {
    if (!reportData) return '<p>No data available</p>';
    
    switch (activeTab) {
      case 'profit-loss':
        return prepareProfitLossHTML();
      case 'cash-flow':
        return prepareCashFlowHTML();
      case 'expense-breakdown':
        return prepareExpenseBreakdownHTML();
      case 'vendor-payments':
        return prepareVendorPaymentsHTML();
      case 'daily-business':
        return prepareDailyBusinessHTML();
      case 'monthly-business':
        return prepareMonthlyBusinessHTML();
      case 'lottery-sales':
        return prepareLotterySalesHTML();
      case 'deposits':
        return prepareDepositsHTML();
      case 'payroll':
        return preparePayrollHTML();
      case 'sales-trends':
        return prepareSalesTrendsHTML();
      default:
        return '<p>No data available</p>';
    }
  };

  // Enhanced Cash Flow with daily breakdown and charts
  const renderCashFlow = () => {
    if (!reportData) return null;
    const { 
      starting_balance = 0, 
      ending_balance = 0, 
      net_cash_flow = 0, 
      inflows = { total: 0, by_type: [] }, 
      outflows = { total: 0, by_type: [] }, 
      daily_breakdown = [] 
    } = reportData;

    // Prepare chart data
    const cashFlowChartData = daily_breakdown && daily_breakdown.length > 0 
      ? daily_breakdown.map(day => ({
          date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          inflow: day.inflow || 0,
          outflow: day.outflow || 0,
          net: day.net || 0,
          balance: (starting_balance || 0) + (daily_breakdown.slice(0, daily_breakdown.indexOf(day) + 1).reduce((sum, d) => sum + (d.net || 0), 0))
        }))
      : [];

    const inflowOutflowData = [
      { name: 'Inflows', value: inflows?.total || 0, color: '#10b981' },
      { name: 'Outflows', value: outflows?.total || 0, color: '#ef4444' }
    ];

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-gray-500">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Starting Balance</h3>
            <div className="text-3xl font-bold text-gray-700">{formatCurrency(starting_balance)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Inflows</h3>
            <div className="text-3xl font-bold text-green-600">{formatCurrency(inflows?.total || 0)}</div>
            <div className="mt-2 text-xs text-gray-500">{(inflows?.by_type || []).length} types</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Outflows</h3>
            <div className="text-3xl font-bold text-red-600">{formatCurrency(outflows?.total || 0)}</div>
            <div className="mt-2 text-xs text-gray-500">{(outflows?.by_type || []).length} types</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Net Cash Flow</h3>
            <div className={`text-3xl font-bold ${net_cash_flow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(net_cash_flow)}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Ending: {formatCurrency(ending_balance)}
            </div>
          </div>
        </div>

        {/* Charts Row */}
        {cashFlowChartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Cash Flow Line Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Cash Flow Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={cashFlowChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Area type="monotone" dataKey="inflow" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Inflows" />
                  <Area type="monotone" dataKey="outflow" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Outflows" />
                  <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={3} name="Net Flow" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Inflow vs Outflow Comparison */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Inflows vs Outflows</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={inflowOutflowData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="value" fill="#8884d8">
                    {inflowOutflowData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cash Inflows</h3>
            <div className="text-2xl font-bold text-green-600 mb-4">{formatCurrency(inflows?.total || 0)}</div>
            <div className="space-y-2">
              {(inflows?.by_type || []).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b">
                  <div>
                    <span className="text-gray-700 capitalize">{item?.type?.replace('_', ' ') || 'Unknown'}</span>
                    <span className="text-xs text-gray-500 ml-2">({item?.count || 0} transactions)</span>
                  </div>
                  <span className="font-medium text-green-600">{formatCurrency(item?.amount || 0)}</span>
                </div>
              ))}
              {(inflows?.by_type || []).length === 0 && (
                <div className="text-sm text-gray-500 py-4 text-center">No inflows recorded</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cash Outflows</h3>
            <div className="text-2xl font-bold text-red-600 mb-4">{formatCurrency(outflows?.total || 0)}</div>
            <div className="space-y-2">
              {(outflows?.by_type || []).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b">
                  <div>
                    <span className="text-gray-700 capitalize">{item?.type?.replace('_', ' ') || 'Unknown'}</span>
                    <span className="text-xs text-gray-500 ml-2">({item?.count || 0} transactions)</span>
                  </div>
                  <span className="font-medium text-red-600">{formatCurrency(item?.amount || 0)}</span>
                </div>
              ))}
              {(outflows?.by_type || []).length === 0 && (
                <div className="text-sm text-gray-500 py-4 text-center">No outflows recorded</div>
              )}
            </div>
          </div>
        </div>

        {daily_breakdown && daily_breakdown.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Inflow</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outflow</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {daily_breakdown.map((day, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(day.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                        {formatCurrency(day.inflow)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                        {formatCurrency(day.outflow)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                        day.net >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(day.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Enhanced Expense Breakdown with charts
  const renderExpenseBreakdown = () => {
    if (!reportData || typeof reportData !== 'object') return null;
    const { total_expenses = 0, categories = [] } = reportData || {};

    // Prepare chart data
    const expenseBarData = categories.slice(0, 10).map(cat => ({
      name: cat.category.length > 15 ? cat.category.substring(0, 15) + '...' : cat.category,
      fullName: cat.category,
      amount: cat.total,
      percentage: parseFloat(cat.percentage)
    }));

    const paymentMethodData = categories.reduce((acc, cat) => {
      acc.cash += cat.payment_methods.cash;
      acc.bank += cat.payment_methods.bank;
      acc.card += cat.payment_methods.card;
      return acc;
    }, { cash: 0, bank: 0, card: 0 });

    const paymentMethodChartData = [
      { name: 'Cash', value: paymentMethodData.cash, color: '#10b981' },
      { name: 'Bank', value: paymentMethodData.bank, color: '#3b82f6' },
      { name: 'Card', value: paymentMethodData.card, color: '#f59e0b' }
    ];

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];

    return (
      <div className="space-y-6">
        {/* Summary Card */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Expenses</h3>
          <div className="text-3xl font-bold text-red-600">{formatCurrency(total_expenses)}</div>
          <div className="mt-2 text-xs text-gray-500">{categories.length} categories</div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Expenses Bar Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Expense Categories</h3>
            {expenseBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={expenseBarData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip 
                    formatter={(value) => formatCurrency(value)}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                  />
                  <Bar dataKey="amount" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-500 py-12">No expense data available</div>
            )}
          </div>

          {/* Payment Methods Pie Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentMethodChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentMethodChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Average</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Min</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Max</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">% of Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {categories.map((cat, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{cat.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700">{cat.count}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">{formatCurrency(cat.total)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700">{formatCurrency(cat.average)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700">{formatCurrency(cat.min)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700">{formatCurrency(cat.max)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700">{cat.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods by Category</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat, idx) => (
              <div key={idx} className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">{cat.category}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cash:</span>
                    <span className="font-medium">{formatCurrency(cat.payment_methods.cash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bank:</span>
                    <span className="font-medium">{formatCurrency(cat.payment_methods.bank)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Card:</span>
                    <span className="font-medium">{formatCurrency(cat.payment_methods.card)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Enhanced Vendor Payments
  const renderVendorPayments = () => {
    if (!reportData || typeof reportData !== 'object') return null;
    const { vendors = [] } = reportData || {};

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Total Vendors</div>
              <div className="text-2xl font-bold text-gray-900">{vendors.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Paid</div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(vendors.reduce((sum, v) => sum + v.paid_amount, 0))}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Pending</div>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(vendors.reduce((sum, v) => sum + v.pending_amount, 0))}
              </div>
            </div>
          </div>
        </div>

        {vendors.map((vendor) => (
          <div key={vendor.vendor_id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{vendor.vendor_name}</h3>
                <p className="text-sm text-gray-600">{vendor.total_invoices} invoice(s)</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Total Amount</div>
                <div className="text-xl font-bold text-gray-900">{formatCurrency(vendor.total_amount)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-green-50 p-4 rounded">
                <div className="text-sm text-gray-600">Paid</div>
                <div className="text-lg font-semibold text-green-700">{formatCurrency(vendor.paid_amount)}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {vendor.invoices.filter(i => i.status === 'paid').length} paid
                </div>
              </div>
              <div className="bg-orange-50 p-4 rounded">
                <div className="text-sm text-gray-600">Pending</div>
                <div className="text-lg font-semibold text-orange-700">{formatCurrency(vendor.pending_amount)}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {vendor.invoices.filter(i => i.status === 'pending').length} pending
                </div>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Invoice Details</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment Method</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {vendor.invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">{invoice.invoice_number || 'N/A'}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {new Date(invoice.purchase_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(invoice.amount)}</td>
                        <td className="px-4 py-2 text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${
                            invoice.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                          }`}>
                            {invoice.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700 capitalize">
                          {invoice.payment_method || invoice.payment_option || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Daily Business Report
  const renderDailyBusiness = () => {
    if (!reportData || typeof reportData !== 'object') return null;
    const { 
      date, 
      revenue = { total: 0 }, 
      expenses = { total: 0 }, 
      purchases = { total: 0 }, 
      payments = { total: 0 }, 
      cash_transactions = [], 
      cash_on_hand = 0, 
      net_income = 0 
    } = reportData || {};

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Summary - {new Date(date).toLocaleDateString()}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Revenue</div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(safeRevenue.total || 0)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Expenses</div>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(safeExpenses.total || 0)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Purchases</div>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(safePurchases.total || 0)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Net Income</div>
              <div className={`text-2xl font-bold ${safeNetIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(safeNetIncome)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Breakdown</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-700">Cash</span>
                <span className="font-medium">{formatCurrency(safeRevenueBreakdown.cash || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Credit Card</span>
                <span className="font-medium">{formatCurrency(safeRevenueBreakdown.credit_card || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Online</span>
                <span className="font-medium">{formatCurrency(safeRevenueBreakdown.online || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Instant Pay</span>
                <span className="font-medium">{formatCurrency(safeRevenueBreakdown.instant_pay || 0)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cash on Hand</h3>
            <div className="text-3xl font-bold text-gray-900">{formatCurrency(safeCashOnHand)}</div>
          </div>
        </div>

        {(safeExpenses.items || []).length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Expenses ({safeExpenses.count || 0})</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment Method</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(safeExpenses.items || []).map((exp, idx) => (
                    <tr key={exp?.id || idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{exp?.type || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(exp?.amount || 0)}</td>
                      <td className="px-4 py-2 text-sm text-gray-700 capitalize">{exp?.payment_method || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(safePurchases.items || []).length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Purchases ({safePurchases.count || 0})</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(safePurchases.items || []).map((purchase, idx) => (
                    <tr key={purchase?.id || idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{purchase?.vendor || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{purchase?.invoice_number || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(purchase?.amount || 0)}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          purchase?.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {purchase?.status || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(safePayments.items || []).length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payments Made ({safePayments.count || 0})</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(safePayments.items || []).map((payment, idx) => (
                    <tr key={payment?.id || idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{payment?.vendor || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{payment?.invoice_number || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(payment?.amount || 0)}</td>
                      <td className="px-4 py-2 text-sm text-gray-700 capitalize">{payment?.payment_method || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Monthly Business Report
  const renderMonthlyBusiness = () => {
    if (!reportData || typeof reportData !== 'object') return null;
    const { 
      period = { year: new Date().getFullYear(), month: new Date().getMonth() + 1 }, 
      revenue, 
      expenses, 
      purchases, 
      payments, 
      net_income, 
      days_in_month 
    } = reportData || {};
    
    // Ensure all values have defaults with proper nested structure
    const safePeriod = period || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
    const safeRevenue = revenue && typeof revenue === 'object' ? revenue : { total: 0, daily_average: 0, breakdown: {}, days_with_revenue: 0 };
    const safeRevenueBreakdown = safeRevenue.breakdown && typeof safeRevenue.breakdown === 'object' ? safeRevenue.breakdown : { cash: 0, credit_card: 0, online: 0, instant_pay: 0 };
    const safeExpenses = expenses && typeof expenses === 'object' ? expenses : { total: 0, daily_average: 0, count: 0, unique_categories: 0 };
    const safePurchases = purchases && typeof purchases === 'object' ? purchases : { total: 0, daily_average: 0, count: 0, unique_vendors: 0 };
    const safePayments = payments && typeof payments === 'object' ? payments : { total: 0, count: 0 };
    const safeNetIncome = net_income || 0;
    const safeDaysInMonth = days_in_month || 30;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Monthly Summary - {new Date(`${safePeriod.year}-${safePeriod.month}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Total Revenue</div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(safeRevenue.total || 0)}</div>
              <div className="text-xs text-gray-500 mt-1">Daily avg: {formatCurrency(safeRevenue.daily_average || 0)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Expenses</div>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(safeExpenses.total || 0)}</div>
              <div className="text-xs text-gray-500 mt-1">Daily avg: {formatCurrency(safeExpenses.daily_average || 0)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Purchases</div>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(safePurchases.total || 0)}</div>
              <div className="text-xs text-gray-500 mt-1">Daily avg: {formatCurrency(safePurchases.daily_average || 0)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Net Income</div>
              <div className={`text-2xl font-bold ${safeNetIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(safeNetIncome)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Breakdown</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-700">Cash</span>
                <span className="font-medium">{formatCurrency(safeRevenueBreakdown.cash || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Credit Card</span>
                <span className="font-medium">{formatCurrency(safeRevenueBreakdown.credit_card || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Online</span>
                <span className="font-medium">{formatCurrency(safeRevenueBreakdown.online || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Instant Pay</span>
                <span className="font-medium">{formatCurrency(safeRevenueBreakdown.instant_pay || 0)}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="text-sm text-gray-600">Days with Revenue</div>
              <div className="text-lg font-semibold">{safeRevenue.days_with_revenue || 0} / {safeDaysInMonth}</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-700">Expense Categories</span>
                <span className="font-medium">{safeExpenses.unique_categories || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Total Expenses</span>
                <span className="font-medium">{safeExpenses.count || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Unique Vendors</span>
                <span className="font-medium">{safePurchases.unique_vendors || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Total Purchases</span>
                <span className="font-medium">{safePurchases.count || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Payments Made</span>
                <span className="font-medium">{safePayments.count || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Lottery Sales Report
  const renderLotterySales = () => {
    if (!reportData || typeof reportData !== 'object') return null;
    const { 
      period = {}, 
      totals = { total_cash: 0, daily_cash: 0, commission: 0, due: 0, deposits: 0 }, 
      daily_breakdown = [] 
    } = reportData || {};

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Lottery Sales Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <div className="text-sm text-gray-600">Total Cash</div>
              <div className="text-xl font-bold text-gray-900">{formatCurrency(totals.total_cash)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Daily Cash</div>
              <div className="text-xl font-bold text-gray-900">{formatCurrency(totals.daily_cash)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Commission</div>
              <div className="text-xl font-bold text-green-600">{formatCurrency(totals.commission)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Due</div>
              <div className="text-xl font-bold text-orange-600">{formatCurrency(totals.due)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Deposits</div>
              <div className="text-xl font-bold text-blue-600">{formatCurrency(totals.deposits)}</div>
            </div>
          </div>
        </div>

        {daily_breakdown && daily_breakdown.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Cash</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Daily Cash</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Commission</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Due</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Deposit</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Bank Balance</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {daily_breakdown.map((day, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {new Date(day.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-right">{formatCurrency(day.total_lottery_cash)}</td>
                      <td className="px-4 py-2 text-sm text-right">{formatCurrency(day.daily_lottery_cash)}</td>
                      <td className="px-4 py-2 text-sm text-right text-green-600">{formatCurrency(day.commission)}</td>
                      <td className="px-4 py-2 text-sm text-right text-orange-600">{formatCurrency(day.due)}</td>
                      <td className="px-4 py-2 text-sm text-right text-blue-600">{formatCurrency(day.deposit)}</td>
                      <td className="px-4 py-2 text-sm text-right">{formatCurrency(day.bank_balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Deposit Report
  const renderDeposits = () => {
    if (!reportData || typeof reportData !== 'object') return null;
    const { 
      period = {}, 
      summary = { total_bank_deposits: 0, total_cash_revenue: 0, total_lottery_deposits: 0, grand_total: 0 }, 
      bank_deposits = [], 
      cash_revenue = [], 
      lottery_deposits = [] 
    } = reportData || {};

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Deposit Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Bank Deposits</div>
              <div className="text-xl font-bold text-blue-600">{formatCurrency(summary.total_bank_deposits)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Cash Revenue</div>
              <div className="text-xl font-bold text-green-600">{formatCurrency(summary.total_cash_revenue)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Lottery Deposits</div>
              <div className="text-xl font-bold text-purple-600">{formatCurrency(summary.total_lottery_deposits)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Grand Total</div>
              <div className="text-xl font-bold text-gray-900">{formatCurrency(summary.grand_total)}</div>
            </div>
          </div>
        </div>

        {bank_deposits.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Bank Deposits</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bank_deposits.map((deposit, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {new Date(deposit.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(deposit.amount)}</td>
                      <td className="px-4 py-2 text-sm text-right">{deposit.count}</td>
                      <td className="px-4 py-2 text-sm text-gray-700 capitalize">{deposit.method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {cash_revenue.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cash Revenue</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cash</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Credit Card</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {cash_revenue.map((rev, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {new Date(rev.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-right">{formatCurrency(rev.cash)}</td>
                      <td className="px-4 py-2 text-sm text-right">{formatCurrency(rev.credit_card)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {lottery_deposits.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Lottery Deposits</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lottery_deposits.map((deposit, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {new Date(deposit.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(deposit.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Payroll Report
  const renderPayroll = () => {
    if (!reportData || typeof reportData !== 'object') return null;
    const { 
      period = {}, 
      summary = { total_gross_pay: 0, total_hours: 0, total_time_off_hours: 0, employee_count: 0, payroll_runs: 0 }, 
      payroll_runs = [] 
    } = reportData || {};

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <div className="text-sm text-gray-600">Total Gross Pay</div>
              <div className="text-xl font-bold text-gray-900">{formatCurrency(summary.total_gross_pay)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Hours</div>
              <div className="text-xl font-bold text-gray-900">{summary.total_hours.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Time Off Hours</div>
              <div className="text-xl font-bold text-orange-600">{summary.total_time_off_hours.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Employees</div>
              <div className="text-xl font-bold text-gray-900">{summary.employee_count}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Payroll Runs</div>
              <div className="text-xl font-bold text-gray-900">{summary.payroll_runs}</div>
            </div>
          </div>
        </div>

        {payroll_runs.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll Details</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pay Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pay Period</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Hours</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Time Off</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Gross Pay</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payroll_runs.map((run) => (
                    <tr key={run.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{run.employee_name}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {new Date(run.payroll_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">{run.pay_period}</td>
                      <td className="px-4 py-2 text-sm text-right">{run.hours_worked.toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right text-orange-600">{run.time_off_hours.toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(run.gross_pay)}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {run.check_number ? `Check #${run.check_number}` : run.bank || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Inventory Data Report
  const renderInventory = () => {
    if (!reportData || typeof reportData !== 'object') return null;
    const { 
      summary = { 
        total_products: 0, 
        total_movements: 0, 
        total_received: 0, 
        total_sold: 0, 
        total_adjusted: 0, 
        total_transferred: 0,
        vape_tax_products_count: 0
      }, 
      products = [], 
      movements = [],
      vape_tax_products = []
    } = reportData || {};

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Products</div>
            <div className="text-2xl font-bold text-gray-900">{summary.total_products}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Movements</div>
            <div className="text-2xl font-bold text-gray-900">{summary.total_movements}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Received</div>
            <div className="text-2xl font-bold text-green-600">{summary.total_received}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Sold</div>
            <div className="text-2xl font-bold text-blue-600">{summary.total_sold}</div>
          </div>
        </div>

        {/* Vape Tax Products Section */}
        {vape_tax_products && vape_tax_products.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-yellow-600">⚠️</span>
              Vape Tax Products (PA) - {vape_tax_products.length} products
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-yellow-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Product ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Product Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Category</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Brand</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Last Tax Paid Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vape_tax_products.map((product) => (
                    <tr key={product.id} className="hover:bg-yellow-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{product.product_id}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{product.full_product_name}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{product.category}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{product.brand || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {product.last_vape_tax_paid_date 
                          ? new Date(product.last_vape_tax_paid_date).toLocaleDateString()
                          : <span className="text-red-600 font-medium">Never</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Products Summary */}
        {products.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Inventory Summary</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Received</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Sold</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Adjusted</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Transferred</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Vape Tax</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{product.product_id}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{product.full_product_name}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{product.category}</td>
                      <td className="px-4 py-2 text-sm text-right text-green-600">{parseInt(product.total_received) || 0}</td>
                      <td className="px-4 py-2 text-sm text-right text-blue-600">{parseInt(product.total_sold) || 0}</td>
                      <td className="px-4 py-2 text-sm text-right text-orange-600">{parseInt(product.total_adjusted) || 0}</td>
                      <td className="px-4 py-2 text-sm text-right text-purple-600">{parseInt(product.total_transferred) || 0}</td>
                      <td className="px-4 py-2 text-sm text-center">
                        {product.vape_tax ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Yes
                            {product.last_vape_tax_paid_date && (
                              <span className="ml-1 text-yellow-600">
                                ({new Date(product.last_vape_tax_paid_date).toLocaleDateString()})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Inventory Movements */}
        {movements.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Movements</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {movements.map((movement) => (
                    <tr key={movement.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {new Date(movement.movement_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">{movement.full_product_name}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          movement.movement_type === 'received' ? 'bg-green-100 text-green-800' :
                          movement.movement_type === 'sold' ? 'bg-blue-100 text-blue-800' :
                          movement.movement_type === 'adjusted' ? 'bg-orange-100 text-orange-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {movement.movement_type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-right">{parseInt(movement.quantity) || 0}</td>
                      <td className="px-4 py-2 text-sm text-right">
                        {movement.unit_cost ? formatCurrency(movement.unit_cost) : 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">{movement.invoice_number || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{movement.notes || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {products.length === 0 && movements.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">No inventory data found for the selected date range.</p>
          </div>
        )}
      </div>
    );
  };

  // Sales Trends Report
  const renderSalesTrends = () => {
    if (!reportData || typeof reportData !== 'object') return null;
    const { 
      summary = { total_revenue: 0, avg_daily_revenue: 0, max_daily_revenue: 0, min_daily_revenue: 0, days_with_data: 0 }, 
      daily_trends = [], 
      weekly_trends = [], 
      monthly_trends = [] 
    } = reportData || {};

    // Chart data preparation
    const dailyChartData = (daily_trends || []).map(d => ({
      date: d?.date ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      revenue: d?.revenue || 0,
      cash: d?.cash || 0,
      credit_card: d?.credit_card || 0,
      online: d?.online || 0
    }));

    const weeklyChartData = (weekly_trends || []).map(w => ({
      week: w?.week_start ? new Date(w.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      revenue: w?.weekly_revenue || 0,
      avgDaily: w?.avg_daily_revenue || 0
    }));

    const monthlyChartData = (monthly_trends || []).map(m => ({
      month: m?.month_start ? new Date(m.month_start).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '',
      revenue: m?.monthly_revenue || 0,
      avgDaily: m?.avg_daily_revenue || 0
    }));

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Revenue</h3>
            <div className="text-3xl font-bold text-green-600">{formatCurrency(summary.total_revenue || 0)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Avg Daily Revenue</h3>
            <div className="text-3xl font-bold text-blue-600">{formatCurrency(summary.avg_daily_revenue || 0)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Max Daily Revenue</h3>
            <div className="text-3xl font-bold text-purple-600">{formatCurrency(summary.max_daily_revenue || 0)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Min Daily Revenue</h3>
            <div className="text-3xl font-bold text-orange-600">{formatCurrency(summary.min_daily_revenue || 0)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-gray-500">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Days with Data</h3>
            <div className="text-3xl font-bold text-gray-700">{summary.days_with_data || 0}</div>
          </div>
        </div>

        {/* Charts Row */}
        {dailyChartData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Total Revenue" />
                <Line type="monotone" dataKey="cash" stroke="#3b82f6" strokeWidth={1} name="Cash" dot={false} />
                <Line type="monotone" dataKey="credit_card" stroke="#f59e0b" strokeWidth={1} name="Credit Card" dot={false} />
                <Line type="monotone" dataKey="online" stroke="#8884d8" strokeWidth={1} name="Online Sales" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {weeklyChartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Revenue Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weeklyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#00C49F" name="Weekly Revenue" />
                  <Line type="monotone" dataKey="avgDaily" stroke="#FFBB28" name="Avg Daily Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Revenue Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#FF8042" name="Monthly Revenue" />
                  <Line type="monotone" dataKey="avgDaily" stroke="#8884d8" name="Avg Daily Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Detailed Tables */}
        {daily_trends.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Trends Detail</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cash</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Credit Card</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Online</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {daily_trends.map((trend, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{trend?.date ? new Date(trend.date).toLocaleDateString() : 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-right">{formatCurrency(trend?.revenue || 0)}</td>
                      <td className="px-4 py-2 text-sm text-right">{formatCurrency(trend?.cash || 0)}</td>
                      <td className="px-4 py-2 text-sm text-right">{formatCurrency(trend?.credit_card || 0)}</td>
                      <td className="px-4 py-2 text-sm text-right">{formatCurrency(trend?.online || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {weekly_trends.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Trends Detail</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Week Start</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Weekly Revenue</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Avg Daily Revenue</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Days with Data</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {weekly_trends.map((trend, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{trend?.week_start ? new Date(trend.week_start).toLocaleDateString() : 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-right">{formatCurrency(trend?.weekly_revenue || 0)}</td>
                      <td className="px-4 py-2 text-sm text-right">{formatCurrency(trend?.avg_daily_revenue || 0)}</td>
                      <td className="px-4 py-2 text-sm text-right">{trend?.days_count || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {monthly_trends.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Trends Detail</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Monthly Revenue</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Avg Daily Revenue</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Days with Data</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {monthly_trends.map((trend, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{trend?.month_start ? new Date(trend.month_start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-right">{formatCurrency(trend?.monthly_revenue || 0)}</td>
                      <td className="px-4 py-2 text-sm text-right">{formatCurrency(trend?.avg_daily_revenue || 0)}</td>
                      <td className="px-4 py-2 text-sm text-right">{trend?.days_count || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Profit & Loss with charts
  const renderProfitLoss = () => {
    if (!reportData || typeof reportData !== 'object') return null;
    const { 
      revenue, 
      cost_of_goods_sold, 
      gross_profit, 
      operating_expenses, 
      net_profit, 
      margin_percentage 
    } = reportData || {};
    
    // Ensure all values have defaults
    const safeRevenue = revenue && typeof revenue === 'object' ? revenue : { total: 0, breakdown: {} };
    const safeCostOfGoodsSold = cost_of_goods_sold || 0;
    const safeGrossProfit = gross_profit || 0;
    const safeOperatingExpenses = operating_expenses && typeof operating_expenses === 'object' ? operating_expenses : { total: 0, by_category: [] };
    const safeNetProfit = net_profit || 0;
    const safeMarginPercentage = margin_percentage || 0;

    // Prepare data for charts
    const profitLossData = [
      { name: 'Revenue', value: safeRevenue.total || 0, color: '#10b981' },
      { name: 'COGS', value: safeCostOfGoodsSold, color: '#ef4444' },
      { name: 'Operating Expenses', value: safeOperatingExpenses.total || 0, color: '#f59e0b' },
      { name: 'Net Profit', value: safeNetProfit, color: safeNetProfit >= 0 ? '#10b981' : '#ef4444' }
    ];

    const expensePieData = (safeOperatingExpenses.by_category || []).map((cat, idx) => ({
      name: cat?.category || 'Unknown',
      value: cat?.amount || 0
    }));

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Revenue</h3>
            <div className="text-3xl font-bold text-green-600">{formatCurrency(safeRevenue.total || 0)}</div>
            {safeRevenue.breakdown && (
              <div className="mt-2 text-xs text-gray-500">
                Cash: {formatCurrency(safeRevenue.breakdown.cash || 0)} | 
                Card: {formatCurrency(safeRevenue.breakdown.credit_card || 0)}
              </div>
            )}
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Cost of Goods Sold</h3>
            <div className="text-3xl font-bold text-red-600">{formatCurrency(safeCostOfGoodsSold)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Gross Profit</h3>
            <div className="text-3xl font-bold text-blue-600">{formatCurrency(safeGrossProfit)}</div>
            <div className="mt-2 text-xs text-gray-500">
              Margin: {(safeRevenue.total || 0) > 0 ? ((safeGrossProfit || 0) / (safeRevenue.total || 1) * 100).toFixed(1) : 0}%
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Net Profit</h3>
            <div className={`text-3xl font-bold ${safeNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(safeNetProfit)}
            </div>
            <div className="mt-2 text-xs text-gray-500">Margin: {safeMarginPercentage}%</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profit & Loss Breakdown Bar Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Profit & Loss Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={profitLossData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="value" fill="#8884d8">
                  {profitLossData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Operating Expenses Pie Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Operating Expenses by Category</h3>
            {expensePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expensePieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {expensePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-500 py-12">No expense data available</div>
            )}
          </div>
        </div>

        {/* Operating Expenses Table */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Operating Expenses Detail</h3>
          <div className="text-2xl font-bold text-red-600 mb-4">{formatCurrency(safeOperatingExpenses.total || 0)}</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">% of Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(safeOperatingExpenses.by_category || []).map((cat, idx) => {
                  const percentage = (safeOperatingExpenses.total || 0) > 0 
                    ? ((cat?.amount || 0) / (safeOperatingExpenses.total || 1) * 100).toFixed(1) 
                    : 0;
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{cat?.category || 'Unknown'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium">{formatCurrency(cat?.amount || 0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600">{percentage}%</td>
                    </tr>
                  );
                })}
                {(safeOperatingExpenses.by_category || []).length === 0 && (
                  <tr>
                    <td colSpan="3" className="px-6 py-4 text-sm text-gray-500 text-center">No operating expenses recorded</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const needsDateRange = ['profit-loss', 'cash-flow', 'expense-breakdown', 'vendor-payments', 'lottery-sales', 'deposits', 'payroll', 'sales-trends'].includes(activeTab);
  const needsSingleDate = ['daily-business'].includes(activeTab);
  const needsMonthYear = ['monthly-business'].includes(activeTab);

  // ========== CSV/Excel Export Functions ==========
  
  const prepareProfitLossExport = () => {
    if (!reportData) return { headers: [], rows: [] };
    const { 
      revenue = { total: 0 }, 
      cost_of_goods_sold = 0, 
      gross_profit = 0, 
      operating_expenses = { total: 0, by_category: [] }, 
      net_profit = 0, 
      margin_percentage = 0 
    } = reportData;
    const headers = ['Category', 'Amount'];
    const rows = [
      ['Total Revenue', formatCurrency(revenue?.total || 0)],
      ['Cost of Goods Sold', formatCurrency(cost_of_goods_sold || 0)],
      ['Gross Profit', formatCurrency(gross_profit || 0)],
      ['Operating Expenses - Total', formatCurrency(operating_expenses?.total || 0)],
      ...(operating_expenses?.by_category || []).map(cat => [cat?.category || 'Unknown', formatCurrency(cat?.amount || 0)]),
      ['Net Profit', formatCurrency(net_profit || 0)],
      ['Profit Margin (%)', `${margin_percentage || 0}%`]
    ];
    return { headers, rows };
  };

  const prepareCashFlowExport = () => {
    const { starting_balance, ending_balance, net_cash_flow, inflows, outflows, daily_breakdown } = reportData;
    const headers = ['Item', 'Amount'];
    const rows = [
      ['Starting Balance', formatCurrency(starting_balance)],
      ['Cash Inflows - Total', formatCurrency(inflows.total)],
      ...inflows.by_type.map(item => [`  ${item.type.replace('_', ' ')} (${item.count} transactions)`, formatCurrency(item.amount)]),
      ['Cash Outflows - Total', formatCurrency(outflows.total)],
      ...outflows.by_type.map(item => [`  ${item.type.replace('_', ' ')} (${item.count} transactions)`, formatCurrency(item.amount)]),
      ['Net Cash Flow', formatCurrency(net_cash_flow)],
      ['Ending Balance', formatCurrency(ending_balance)],
      ['', ''],
      ['Daily Breakdown', '']
    ];
    
    if (daily_breakdown && daily_breakdown.length > 0) {
      rows.push(['Date', 'Inflow', 'Outflow', 'Net']);
      daily_breakdown.forEach(day => {
        rows.push([
          new Date(day.date).toLocaleDateString(),
          formatCurrency(day.inflow),
          formatCurrency(day.outflow),
          formatCurrency(day.net)
        ]);
      });
    }
    
    return { headers, rows };
  };

  const prepareExpenseBreakdownExport = () => {
    const { categories } = reportData;
    const headers = ['Category', 'Count', 'Total', 'Average', 'Min', 'Max', '% of Total', 'Cash', 'Bank', 'Card'];
    const rows = categories.map(cat => [
      cat.category,
      cat.count,
      formatCurrency(cat.total),
      formatCurrency(cat.average),
      formatCurrency(cat.min),
      formatCurrency(cat.max),
      `${cat.percentage}%`,
      formatCurrency(cat.payment_methods.cash),
      formatCurrency(cat.payment_methods.bank),
      formatCurrency(cat.payment_methods.card)
    ]);
    return { headers, rows };
  };

  const prepareVendorPaymentsExport = () => {
    const { vendors } = reportData;
    const headers = ['Vendor', 'Invoice #', 'Date', 'Due Date', 'Amount', 'Status', 'Payment Method'];
    const rows = [];
    
    vendors.forEach(vendor => {
      rows.push([vendor.vendor_name, 'SUMMARY', '', '', formatCurrency(vendor.total_amount), '', '']);
      rows.push(['', 'Total Paid', '', '', formatCurrency(vendor.paid_amount), '', '']);
      rows.push(['', 'Total Pending', '', '', formatCurrency(vendor.pending_amount), '', '']);
      vendor.invoices.forEach(inv => {
        rows.push([
          '',
          inv.invoice_number || 'N/A',
          new Date(inv.purchase_date).toLocaleDateString(),
          inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A',
          formatCurrency(inv.amount),
          inv.status,
          inv.payment_method || inv.payment_option || 'N/A'
        ]);
      });
      rows.push(['', '', '', '', '', '', '']); // Empty row between vendors
    });
    
    return { headers, rows };
  };

  const prepareDailyBusinessExport = () => {
    if (!reportData) return { headers: [], rows: [] };
    const { date, revenue, expenses, purchases, payments, cash_on_hand, net_income } = reportData || {};
    const safeRevenue = revenue && typeof revenue === 'object' ? revenue : { total: 0, breakdown: {} };
    const safeRevenueBreakdown = safeRevenue.breakdown && typeof safeRevenue.breakdown === 'object' ? safeRevenue.breakdown : { cash: 0, credit_card: 0, online: 0, instant_pay: 0 };
    const safeExpenses = expenses && typeof expenses === 'object' ? expenses : { total: 0, items: [] };
    const safePurchases = purchases && typeof purchases === 'object' ? purchases : { total: 0, items: [] };
    const safePayments = payments && typeof payments === 'object' ? payments : { total: 0, items: [] };
    const headers = ['Category', 'Item', 'Amount'];
    const rows = [
      ['REVENUE', '', ''],
      ['', 'Cash', formatCurrency(safeRevenueBreakdown.cash || 0)],
      ['', 'Credit Card', formatCurrency(safeRevenueBreakdown.credit_card || 0)],
      ['', 'Online', formatCurrency(safeRevenueBreakdown.online || 0)],
      ['', 'Instant Pay', formatCurrency(safeRevenueBreakdown.instant_pay || 0)],
      ['', 'Total Revenue', formatCurrency(safeRevenue.total || 0)],
      ['', '', ''],
      ['EXPENSES', '', ''],
      ...(safeExpenses.items || []).map(exp => ['', exp?.type || 'N/A', formatCurrency(exp?.amount || 0)]),
      ['', 'Total Expenses', formatCurrency(safeExpenses.total || 0)],
      ['', '', ''],
      ['PURCHASES', '', ''],
      ...(safePurchases.items || []).map(p => ['', `${p?.vendor || 'N/A'} - ${p?.invoice_number || 'N/A'}`, formatCurrency(p?.amount || 0)]),
      ['', 'Total Purchases', formatCurrency(safePurchases.total || 0)],
      ['', '', ''],
      ['PAYMENTS MADE', '', ''],
      ...(safePayments.items || []).map(p => ['', `${p?.vendor || 'N/A'} - ${p?.invoice_number || 'N/A'}`, formatCurrency(p?.amount || 0)]),
      ['', 'Total Payments', formatCurrency(safePayments.total || 0)],
      ['', '', ''],
      ['SUMMARY', '', ''],
      ['', 'Cash on Hand', formatCurrency(cash_on_hand || 0)],
      ['', 'Net Income', formatCurrency(net_income || 0)]
    ];
    return { headers, rows };
  };

  const prepareMonthlyBusinessExport = () => {
    if (!reportData) return { headers: [], rows: [] };
    const { period, revenue, expenses, purchases, payments, net_income, days_in_month } = reportData || {};
    const safeRevenue = revenue && typeof revenue === 'object' ? revenue : { total: 0, daily_average: 0, breakdown: {}, days_with_revenue: 0 };
    const safeRevenueBreakdown = safeRevenue.breakdown && typeof safeRevenue.breakdown === 'object' ? safeRevenue.breakdown : { cash: 0, credit_card: 0, online: 0, instant_pay: 0 };
    const safeExpenses = expenses && typeof expenses === 'object' ? expenses : { total: 0, daily_average: 0, count: 0, unique_categories: 0 };
    const safePurchases = purchases && typeof purchases === 'object' ? purchases : { total: 0, daily_average: 0, count: 0, unique_vendors: 0 };
    const safePayments = payments && typeof payments === 'object' ? payments : { total: 0, count: 0 };
    const safeDaysInMonth = days_in_month || 30;
    const headers = ['Category', 'Total', 'Daily Average', 'Details'];
    const rows = [
      ['REVENUE', formatCurrency(safeRevenue.total || 0), formatCurrency(safeRevenue.daily_average || 0), ''],
      ['', 'Cash', formatCurrency(safeRevenueBreakdown.cash || 0), ''],
      ['', 'Credit Card', formatCurrency(safeRevenueBreakdown.credit_card || 0), ''],
      ['', 'Online', formatCurrency(safeRevenueBreakdown.online || 0), ''],
      ['', 'Instant Pay', formatCurrency(safeRevenueBreakdown.instant_pay || 0), ''],
      ['', `Days with Revenue: ${safeRevenue.days_with_revenue || 0}/${safeDaysInMonth}`, '', ''],
      ['', '', '', ''],
      ['EXPENSES', formatCurrency(safeExpenses.total || 0), formatCurrency(safeExpenses.daily_average || 0), `Count: ${safeExpenses.count || 0}, Categories: ${safeExpenses.unique_categories || 0}`],
      ['', '', '', ''],
      ['PURCHASES', formatCurrency(safePurchases.total || 0), formatCurrency(safePurchases.daily_average || 0), `Count: ${safePurchases.count || 0}, Vendors: ${safePurchases.unique_vendors || 0}`],
      ['', '', '', ''],
      ['PAYMENTS', formatCurrency(safePayments.total || 0), '', `Count: ${safePayments.count || 0}`],
      ['', '', '', ''],
      ['NET INCOME', formatCurrency(net_income || 0), '', '']
    ];
    return { headers, rows };
  };

  const prepareLotterySalesExport = () => {
    const { totals, daily_breakdown } = reportData;
    const headers = ['Date', 'Total Cash', 'Daily Cash', 'Commission', 'Due', 'Deposit', 'Bank Balance'];
    const rows = [
      ['TOTALS', formatCurrency(totals.total_cash), formatCurrency(totals.daily_cash), formatCurrency(totals.commission), formatCurrency(totals.due), formatCurrency(totals.deposits), ''],
      ['', '', '', '', '', '', ''],
      ...daily_breakdown.map(day => [
        new Date(day.date).toLocaleDateString(),
        formatCurrency(day.total_lottery_cash),
        formatCurrency(day.daily_lottery_cash),
        formatCurrency(day.commission),
        formatCurrency(day.due),
        formatCurrency(day.deposit),
        formatCurrency(day.bank_balance)
      ])
    ];
    return { headers, rows };
  };

  const prepareDepositsExport = () => {
    const { summary, bank_deposits, cash_revenue, lottery_deposits } = reportData;
    const headers = ['Type', 'Date', 'Amount', 'Details'];
    const rows = [
      ['SUMMARY', '', '', ''],
      ['', 'Bank Deposits', formatCurrency(summary.total_bank_deposits), ''],
      ['', 'Cash Revenue', formatCurrency(summary.total_cash_revenue), ''],
      ['', 'Lottery Deposits', formatCurrency(summary.total_lottery_deposits), ''],
      ['', 'Grand Total', formatCurrency(summary.grand_total), ''],
      ['', '', '', ''],
      ['BANK DEPOSITS', '', '', ''],
      ...bank_deposits.map(d => [d.method, new Date(d.date).toLocaleDateString(), formatCurrency(d.amount), `${d.count} transactions`]),
      ['', '', '', ''],
      ['CASH REVENUE', '', '', ''],
      ...cash_revenue.map(r => ['Cash', new Date(r.date).toLocaleDateString(), formatCurrency(r.cash), '']),
      ...cash_revenue.map(r => ['Credit Card', new Date(r.date).toLocaleDateString(), formatCurrency(r.credit_card), '']),
      ['', '', '', ''],
      ['LOTTERY DEPOSITS', '', '', ''],
      ...lottery_deposits.map(d => ['Lottery', new Date(d.date).toLocaleDateString(), formatCurrency(d.amount), ''])
    ];
    return { headers, rows };
  };

  const preparePayrollExport = () => {
    const { summary, payroll_runs } = reportData;
    const headers = ['Employee', 'Pay Date', 'Pay Period', 'Hours', 'Time Off', 'Gross Pay', 'Rate', 'Payment Info'];
    const rows = [
      ['SUMMARY', '', '', '', '', '', '', ''],
      ['', 'Total Gross Pay', formatCurrency(summary.total_gross_pay), '', '', '', '', ''],
      ['', 'Total Hours', summary.total_hours.toFixed(2), '', '', '', '', ''],
      ['', 'Time Off Hours', summary.total_time_off_hours.toFixed(2), '', '', '', '', ''],
      ['', 'Employees', summary.employee_count, '', '', '', '', ''],
      ['', 'Payroll Runs', summary.payroll_runs, '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['PAYROLL DETAILS', '', '', '', '', '', '', ''],
      ...payroll_runs.map(run => [
        run.employee_name,
        new Date(run.payroll_date).toLocaleDateString(),
        run.pay_period,
        run.hours_worked.toFixed(2),
        run.time_off_hours.toFixed(2),
        formatCurrency(run.gross_pay),
        formatCurrency(run.pay_rate),
        run.check_number ? `Check #${run.check_number}` : run.bank || 'N/A'
      ])
    ];
    return { headers, rows };
  };

  const prepareSalesTrendsExport = () => {
    if (!reportData) return { headers: [], rows: [] };
    const { 
      summary = { total_revenue: 0, avg_daily_revenue: 0, max_daily_revenue: 0, min_daily_revenue: 0, days_with_data: 0 }, 
      daily_trends = [], 
      weekly_trends = [], 
      monthly_trends = [] 
    } = reportData || {};
    const headers = ['Date/Period', 'Revenue', 'Cash', 'Credit Card', 'Online', 'Avg Daily'];
    const rows = [
      ['SUMMARY', '', '', '', '', ''],
      ['', 'Total Revenue', formatCurrency(summary.total_revenue), '', '', ''],
      ['', 'Avg Daily Revenue', formatCurrency(summary.avg_daily_revenue), '', '', ''],
      ['', 'Max Daily Revenue', formatCurrency(summary.max_daily_revenue), '', '', ''],
      ['', 'Min Daily Revenue', formatCurrency(summary.min_daily_revenue), '', '', ''],
      ['', 'Days with Data', summary.days_with_data, '', '', ''],
      ['', '', '', '', '', ''],
      ['DAILY TRENDS', '', '', '', '', ''],
      ...daily_trends.map(trend => [
        new Date(trend.date).toLocaleDateString(),
        formatCurrency(trend.revenue),
        formatCurrency(trend.cash),
        formatCurrency(trend.credit_card),
        formatCurrency(trend.online),
        ''
      ]),
      ['', '', '', '', '', ''],
      ['WEEKLY TRENDS', '', '', '', '', ''],
      ...weekly_trends.map(trend => [
        new Date(trend.week_start).toLocaleDateString(),
        formatCurrency(trend.weekly_revenue),
        '',
        '',
        '',
        formatCurrency(trend.avg_daily_revenue)
      ]),
      ['', '', '', '', '', ''],
      ['MONTHLY TRENDS', '', '', '', '', ''],
      ...monthly_trends.map(trend => [
        new Date(trend.month_start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        formatCurrency(trend.monthly_revenue),
        '',
        '',
        '',
        formatCurrency(trend.avg_daily_revenue)
      ])
    ];
    return { headers, rows };
  };

  // ========== PDF HTML Export Functions ==========

  const prepareProfitLossHTML = () => {
    if (!reportData) return '<p>No data available</p>';
    const { 
      revenue = { total: 0 }, 
      cost_of_goods_sold = 0, 
      gross_profit = 0, 
      operating_expenses = { total: 0, by_category: [] }, 
      net_profit = 0, 
      margin_percentage = 0 
    } = reportData;
    return `
      <div class="summary-cards">
        <div class="summary-card positive">
          <div class="label">Total Revenue</div>
          <div class="value">${formatCurrency(revenue?.total || 0)}</div>
        </div>
        <div class="summary-card negative">
          <div class="label">Cost of Goods Sold</div>
          <div class="value">${formatCurrency(cost_of_goods_sold || 0)}</div>
        </div>
        <div class="summary-card neutral">
          <div class="label">Gross Profit</div>
          <div class="value">${formatCurrency(gross_profit || 0)}</div>
        </div>
        <div class="summary-card ${(net_profit || 0) >= 0 ? 'positive' : 'negative'}">
          <div class="label">Net Profit</div>
          <div class="value">${formatCurrency(net_profit || 0)}</div>
          <div style="font-size: 9pt; margin-top: 5px;">Margin: ${margin_percentage || 0}%</div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Operating Expenses Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${(operating_expenses?.by_category || []).map(cat => `
              <tr>
                <td>${cat?.category || 'Unknown'}</td>
                <td class="text-right currency">${formatCurrency(cat?.amount || 0)}</td>
              </tr>
            `).join('')}
            <tr style="background: #e9ecef; font-weight: 600;">
              <td>Total Operating Expenses</td>
              <td class="text-right currency">${formatCurrency(operating_expenses?.total || 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  };

  const prepareCashFlowHTML = () => {
    const { starting_balance, ending_balance, net_cash_flow, inflows, outflows, daily_breakdown } = reportData;
    return `
      <div class="summary-cards">
        <div class="summary-card neutral">
          <div class="label">Starting Balance</div>
          <div class="value">${formatCurrency(starting_balance)}</div>
        </div>
        <div class="summary-card positive">
          <div class="label">Total Inflows</div>
          <div class="value">${formatCurrency(inflows.total)}</div>
        </div>
        <div class="summary-card negative">
          <div class="label">Total Outflows</div>
          <div class="value">${formatCurrency(outflows.total)}</div>
        </div>
        <div class="summary-card ${net_cash_flow >= 0 ? 'positive' : 'negative'}">
          <div class="label">Net Cash Flow</div>
          <div class="value">${formatCurrency(net_cash_flow)}</div>
        </div>
        <div class="summary-card neutral">
          <div class="label">Ending Balance</div>
          <div class="value">${formatCurrency(ending_balance)}</div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Cash Inflows by Type</div>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th class="text-right">Count</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${inflows.by_type.map(item => `
              <tr>
                <td>${item.type.replace('_', ' ')}</td>
                <td class="text-right">${item.count}</td>
                <td class="text-right currency">${formatCurrency(item.amount)}</td>
              </tr>
            `).join('')}
            <tr style="background: #e9ecef; font-weight: 600;">
              <td>Total Inflows</td>
              <td class="text-right">${inflows.by_type.reduce((sum, item) => sum + item.count, 0)}</td>
              <td class="text-right currency">${formatCurrency(inflows.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="section">
        <div class="section-title">Cash Outflows by Type</div>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th class="text-right">Count</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${outflows.by_type.map(item => `
              <tr>
                <td>${item.type.replace('_', ' ')}</td>
                <td class="text-right">${item.count}</td>
                <td class="text-right currency">${formatCurrency(item.amount)}</td>
              </tr>
            `).join('')}
            <tr style="background: #e9ecef; font-weight: 600;">
              <td>Total Outflows</td>
              <td class="text-right">${outflows.by_type.reduce((sum, item) => sum + item.count, 0)}</td>
              <td class="text-right currency">${formatCurrency(outflows.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      ${daily_breakdown && daily_breakdown.length > 0 ? `
      <div class="section">
        <div class="section-title">Daily Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th class="text-right">Inflow</th>
              <th class="text-right">Outflow</th>
              <th class="text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            ${daily_breakdown.map(day => `
              <tr>
                <td>${new Date(day.date).toLocaleDateString()}</td>
                <td class="text-right currency">${formatCurrency(day.inflow)}</td>
                <td class="text-right currency">${formatCurrency(day.outflow)}</td>
                <td class="text-right currency ${day.net >= 0 ? '' : 'text-danger'}">${formatCurrency(day.net)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
    `;
  };

  const prepareExpenseBreakdownHTML = () => {
    const { total_expenses, categories } = reportData;
    return `
      <div class="summary-cards">
        <div class="summary-card negative">
          <div class="label">Total Expenses</div>
          <div class="value">${formatCurrency(total_expenses)}</div>
        </div>
        <div class="summary-card neutral">
          <div class="label">Categories</div>
          <div class="value">${categories.length}</div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Expense Breakdown by Category</div>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th class="text-right">Count</th>
              <th class="text-right">Total</th>
              <th class="text-right">Average</th>
              <th class="text-right">Min</th>
              <th class="text-right">Max</th>
              <th class="text-right">% of Total</th>
            </tr>
          </thead>
          <tbody>
            ${categories.map(cat => `
              <tr>
                <td>${cat.category}</td>
                <td class="text-right">${cat.count}</td>
                <td class="text-right currency">${formatCurrency(cat.total)}</td>
                <td class="text-right currency">${formatCurrency(cat.average)}</td>
                <td class="text-right currency">${formatCurrency(cat.min)}</td>
                <td class="text-right currency">${formatCurrency(cat.max)}</td>
                <td class="text-right">${cat.percentage}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="section">
        <div class="section-title">Payment Methods by Category</div>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th class="text-right">Cash</th>
              <th class="text-right">Bank</th>
              <th class="text-right">Card</th>
            </tr>
          </thead>
          <tbody>
            ${categories.map(cat => `
              <tr>
                <td>${cat.category}</td>
                <td class="text-right currency">${formatCurrency(cat.payment_methods.cash)}</td>
                <td class="text-right currency">${formatCurrency(cat.payment_methods.bank)}</td>
                <td class="text-right currency">${formatCurrency(cat.payment_methods.card)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  const prepareVendorPaymentsHTML = () => {
    const { vendors } = reportData;
    const totalPaid = vendors.reduce((sum, v) => sum + v.paid_amount, 0);
    const totalPending = vendors.reduce((sum, v) => sum + v.pending_amount, 0);
    
    return `
      <div class="summary-cards">
        <div class="summary-card neutral">
          <div class="label">Total Vendors</div>
          <div class="value">${vendors.length}</div>
        </div>
        <div class="summary-card positive">
          <div class="label">Total Paid</div>
          <div class="value">${formatCurrency(totalPaid)}</div>
        </div>
        <div class="summary-card negative">
          <div class="label">Total Pending</div>
          <div class="value">${formatCurrency(totalPending)}</div>
        </div>
      </div>
      
      ${vendors.map(vendor => `
        <div class="section page-break">
          <div class="section-title">${vendor.vendor_name}</div>
          <div class="grid-3" style="margin-bottom: 15px;">
            <div class="summary-card neutral">
              <div class="label">Total Amount</div>
              <div class="value">${formatCurrency(vendor.total_amount)}</div>
            </div>
            <div class="summary-card positive">
              <div class="label">Paid</div>
              <div class="value">${formatCurrency(vendor.paid_amount)}</div>
            </div>
            <div class="summary-card negative">
              <div class="label">Pending</div>
              <div class="value">${formatCurrency(vendor.pending_amount)}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Due Date</th>
                <th class="text-right">Amount</th>
                <th>Status</th>
                <th>Payment Method</th>
              </tr>
            </thead>
            <tbody>
              ${vendor.invoices.map(inv => `
                <tr>
                  <td>${inv.invoice_number || 'N/A'}</td>
                  <td>${new Date(inv.purchase_date).toLocaleDateString()}</td>
                  <td>${inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}</td>
                  <td class="text-right currency">${formatCurrency(inv.amount)}</td>
                  <td><span class="badge ${inv.status === 'paid' ? 'badge-success' : 'badge-warning'}">${inv.status}</span></td>
                  <td>${inv.payment_method || inv.payment_option || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    `;
  };

  const prepareDailyBusinessHTML = () => {
    const { date, revenue, expenses, purchases, payments, cash_on_hand, net_income } = reportData;
    return `
      <div class="summary-cards">
        <div class="summary-card positive">
          <div class="label">Total Revenue</div>
          <div class="value">${formatCurrency(revenue.total)}</div>
        </div>
        <div class="summary-card negative">
          <div class="label">Total Expenses</div>
          <div class="value">${formatCurrency(expenses.total)}</div>
        </div>
        <div class="summary-card negative">
          <div class="label">Total Purchases</div>
          <div class="value">${formatCurrency(purchases.total)}</div>
        </div>
        <div class="summary-card ${net_income >= 0 ? 'positive' : 'negative'}">
          <div class="label">Net Income</div>
          <div class="value">${formatCurrency(net_income)}</div>
        </div>
        <div class="summary-card neutral">
          <div class="label">Cash on Hand</div>
          <div class="value">${formatCurrency(cash_on_hand)}</div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Revenue Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Cash</td><td class="text-right currency">${formatCurrency(revenue.breakdown.cash)}</td></tr>
            <tr><td>Credit Card</td><td class="text-right currency">${formatCurrency(revenue.breakdown.credit_card)}</td></tr>
            <tr><td>Online</td><td class="text-right currency">${formatCurrency(revenue.breakdown.online)}</td></tr>
            <tr><td>Instant Pay</td><td class="text-right currency">${formatCurrency(revenue.breakdown.instant_pay)}</td></tr>
            <tr style="background: #e9ecef; font-weight: 600;">
              <td>Total Revenue</td>
              <td class="text-right currency">${formatCurrency(revenue.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      ${expenses.items.length > 0 ? `
      <div class="section">
        <div class="section-title">Expenses (${expenses.count})</div>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th class="text-right">Amount</th>
              <th>Payment Method</th>
            </tr>
          </thead>
          <tbody>
            ${expenses.items.map(exp => `
              <tr>
                <td>${exp.type}</td>
                <td class="text-right currency">${formatCurrency(exp.amount)}</td>
                <td>${exp.payment_method || 'N/A'}</td>
              </tr>
            `).join('')}
            <tr style="background: #e9ecef; font-weight: 600;">
              <td>Total Expenses</td>
              <td class="text-right currency">${formatCurrency(expenses.total)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      ` : ''}
      
      ${purchases.items.length > 0 ? `
      <div class="section">
        <div class="section-title">Purchases (${purchases.count})</div>
        <table>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Invoice #</th>
              <th class="text-right">Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${purchases.items.map(p => `
              <tr>
                <td>${p.vendor}</td>
                <td>${p.invoice_number}</td>
                <td class="text-right currency">${formatCurrency(p.amount)}</td>
                <td><span class="badge ${p.status === 'paid' ? 'badge-success' : 'badge-warning'}">${p.status}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      ${payments.items.length > 0 ? `
      <div class="section">
        <div class="section-title">Payments Made (${payments.count})</div>
        <table>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Invoice #</th>
              <th class="text-right">Amount</th>
              <th>Method</th>
            </tr>
          </thead>
          <tbody>
            ${payments.items.map(p => `
              <tr>
                <td>${p.vendor}</td>
                <td>${p.invoice_number}</td>
                <td class="text-right currency">${formatCurrency(p.amount)}</td>
                <td>${p.payment_method}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
    `;
  };

  const prepareMonthlyBusinessHTML = () => {
    const { period, revenue, expenses, purchases, payments, net_income, days_in_month } = reportData;
    return `
      <div class="summary-cards">
        <div class="summary-card positive">
          <div class="label">Total Revenue</div>
          <div class="value">${formatCurrency(revenue.total)}</div>
          <div style="font-size: 9pt; margin-top: 5px;">Daily avg: ${formatCurrency(revenue.daily_average)}</div>
        </div>
        <div class="summary-card negative">
          <div class="label">Total Expenses</div>
          <div class="value">${formatCurrency(expenses.total)}</div>
          <div style="font-size: 9pt; margin-top: 5px;">Daily avg: ${formatCurrency(expenses.daily_average)}</div>
        </div>
        <div class="summary-card negative">
          <div class="label">Total Purchases</div>
          <div class="value">${formatCurrency(purchases.total)}</div>
          <div style="font-size: 9pt; margin-top: 5px;">Daily avg: ${formatCurrency(purchases.daily_average)}</div>
        </div>
        <div class="summary-card ${net_income >= 0 ? 'positive' : 'negative'}">
          <div class="label">Net Income</div>
          <div class="value">${formatCurrency(net_income)}</div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Revenue Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th class="text-right">Total</th>
              <th class="text-right">Daily Average</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cash</td>
              <td class="text-right currency">${formatCurrency(revenue.breakdown.cash)}</td>
              <td class="text-right currency">${formatCurrency(revenue.breakdown.cash / days_in_month)}</td>
            </tr>
            <tr>
              <td>Credit Card</td>
              <td class="text-right currency">${formatCurrency(revenue.breakdown.credit_card)}</td>
              <td class="text-right currency">${formatCurrency(revenue.breakdown.credit_card / days_in_month)}</td>
            </tr>
            <tr>
              <td>Online</td>
              <td class="text-right currency">${formatCurrency(revenue.breakdown.online)}</td>
              <td class="text-right currency">${formatCurrency(revenue.breakdown.online / days_in_month)}</td>
            </tr>
            <tr>
              <td>Instant Pay</td>
              <td class="text-right currency">${formatCurrency(revenue.breakdown.instant_pay)}</td>
              <td class="text-right currency">${formatCurrency(revenue.breakdown.instant_pay / days_in_month)}</td>
            </tr>
            <tr style="background: #e9ecef; font-weight: 600;">
              <td>Total Revenue</td>
              <td class="text-right currency">${formatCurrency(revenue.total)}</td>
              <td class="text-right currency">${formatCurrency(revenue.daily_average)}</td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top: 10px; font-size: 9pt; color: #6c757d;">
          Days with Revenue: ${revenue.days_with_revenue} / ${days_in_month}
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Statistics</div>
        <div class="grid-2">
          <div>
            <table>
              <tbody>
                <tr><td><strong>Expense Categories</strong></td><td class="text-right">${expenses.unique_categories}</td></tr>
                <tr><td><strong>Total Expenses</strong></td><td class="text-right">${expenses.count}</td></tr>
                <tr><td><strong>Unique Vendors</strong></td><td class="text-right">${purchases.unique_vendors}</td></tr>
                <tr><td><strong>Total Purchases</strong></td><td class="text-right">${purchases.count}</td></tr>
                <tr><td><strong>Payments Made</strong></td><td class="text-right">${payments.count}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  };

  const prepareLotterySalesHTML = () => {
    const { totals, daily_breakdown } = reportData;
    return `
      <div class="summary-cards">
        <div class="summary-card neutral">
          <div class="label">Total Cash</div>
          <div class="value">${formatCurrency(totals.total_cash)}</div>
        </div>
        <div class="summary-card neutral">
          <div class="label">Daily Cash</div>
          <div class="value">${formatCurrency(totals.daily_cash)}</div>
        </div>
        <div class="summary-card positive">
          <div class="label">Commission</div>
          <div class="value">${formatCurrency(totals.commission)}</div>
        </div>
        <div class="summary-card negative">
          <div class="label">Due</div>
          <div class="value">${formatCurrency(totals.due)}</div>
        </div>
        <div class="summary-card neutral">
          <div class="label">Deposits</div>
          <div class="value">${formatCurrency(totals.deposits)}</div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Daily Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th class="text-right">Total Cash</th>
              <th class="text-right">Daily Cash</th>
              <th class="text-right">Commission</th>
              <th class="text-right">Due</th>
              <th class="text-right">Deposit</th>
              <th class="text-right">Bank Balance</th>
            </tr>
          </thead>
          <tbody>
            ${daily_breakdown.map(day => `
              <tr>
                <td>${new Date(day.date).toLocaleDateString()}</td>
                <td class="text-right currency">${formatCurrency(day.total_lottery_cash)}</td>
                <td class="text-right currency">${formatCurrency(day.daily_lottery_cash)}</td>
                <td class="text-right currency">${formatCurrency(day.commission)}</td>
                <td class="text-right currency">${formatCurrency(day.due)}</td>
                <td class="text-right currency">${formatCurrency(day.deposit)}</td>
                <td class="text-right currency">${formatCurrency(day.bank_balance)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  const prepareDepositsHTML = () => {
    const { summary, bank_deposits, cash_revenue, lottery_deposits } = reportData;
    return `
      <div class="summary-cards">
        <div class="summary-card neutral">
          <div class="label">Bank Deposits</div>
          <div class="value">${formatCurrency(summary.total_bank_deposits)}</div>
        </div>
        <div class="summary-card positive">
          <div class="label">Cash Revenue</div>
          <div class="value">${formatCurrency(summary.total_cash_revenue)}</div>
        </div>
        <div class="summary-card neutral">
          <div class="label">Lottery Deposits</div>
          <div class="value">${formatCurrency(summary.total_lottery_deposits)}</div>
        </div>
        <div class="summary-card positive">
          <div class="label">Grand Total</div>
          <div class="value">${formatCurrency(summary.grand_total)}</div>
        </div>
      </div>
      
      ${bank_deposits.length > 0 ? `
      <div class="section">
        <div class="section-title">Bank Deposits</div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Method</th>
              <th class="text-right">Amount</th>
              <th class="text-right">Count</th>
            </tr>
          </thead>
          <tbody>
            ${bank_deposits.map(d => `
              <tr>
                <td>${new Date(d.date).toLocaleDateString()}</td>
                <td>${d.method}</td>
                <td class="text-right currency">${formatCurrency(d.amount)}</td>
                <td class="text-right">${d.count}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      ${cash_revenue.length > 0 ? `
      <div class="section">
        <div class="section-title">Cash Revenue</div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th class="text-right">Cash</th>
              <th class="text-right">Credit Card</th>
            </tr>
          </thead>
          <tbody>
            ${cash_revenue.map(r => `
              <tr>
                <td>${new Date(r.date).toLocaleDateString()}</td>
                <td class="text-right currency">${formatCurrency(r.cash)}</td>
                <td class="text-right currency">${formatCurrency(r.credit_card)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      ${lottery_deposits.length > 0 ? `
      <div class="section">
        <div class="section-title">Lottery Deposits</div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lottery_deposits.map(d => `
              <tr>
                <td>${new Date(d.date).toLocaleDateString()}</td>
                <td class="text-right currency">${formatCurrency(d.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
    `;
  };

  const preparePayrollHTML = () => {
    const { summary, payroll_runs } = reportData;
    return `
      <div class="summary-cards">
        <div class="summary-card negative">
          <div class="label">Total Gross Pay</div>
          <div class="value">${formatCurrency(summary.total_gross_pay)}</div>
        </div>
        <div class="summary-card neutral">
          <div class="label">Total Hours</div>
          <div class="value">${summary.total_hours.toFixed(2)}</div>
        </div>
        <div class="summary-card neutral">
          <div class="label">Time Off Hours</div>
          <div class="value">${summary.total_time_off_hours.toFixed(2)}</div>
        </div>
        <div class="summary-card neutral">
          <div class="label">Employees</div>
          <div class="value">${summary.employee_count}</div>
        </div>
        <div class="summary-card neutral">
          <div class="label">Payroll Runs</div>
          <div class="value">${summary.payroll_runs}</div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Payroll Details</div>
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Pay Date</th>
              <th>Pay Period</th>
              <th class="text-right">Hours</th>
              <th class="text-right">Time Off</th>
              <th class="text-right">Gross Pay</th>
              <th class="text-right">Rate</th>
              <th>Payment Info</th>
            </tr>
          </thead>
          <tbody>
            ${payroll_runs.map(run => `
              <tr>
                <td>${run.employee_name}</td>
                <td>${new Date(run.payroll_date).toLocaleDateString()}</td>
                <td>${run.pay_period}</td>
                <td class="text-right">${run.hours_worked.toFixed(2)}</td>
                <td class="text-right">${run.time_off_hours.toFixed(2)}</td>
                <td class="text-right currency">${formatCurrency(run.gross_pay)}</td>
                <td class="text-right currency">${formatCurrency(run.pay_rate)}</td>
                <td>${run.check_number ? `Check #${run.check_number}` : run.bank || 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  const prepareSalesTrendsHTML = () => {
    if (!reportData) return '<p>No data available</p>';
    const { 
      summary = { total_revenue: 0, avg_daily_revenue: 0, max_daily_revenue: 0, min_daily_revenue: 0, days_with_data: 0 }, 
      daily_trends = [], 
      weekly_trends = [], 
      monthly_trends = [] 
    } = reportData || {};
    return `
      <div class="summary-cards">
        <div class="summary-card positive">
          <div class="label">Total Revenue</div>
          <div class="value">${formatCurrency(summary.total_revenue)}</div>
        </div>
        <div class="summary-card neutral">
          <div class="label">Avg Daily Revenue</div>
          <div class="value">${formatCurrency(summary.avg_daily_revenue)}</div>
        </div>
        <div class="summary-card positive">
          <div class="label">Max Daily Revenue</div>
          <div class="value">${formatCurrency(summary.max_daily_revenue)}</div>
        </div>
        <div class="summary-card negative">
          <div class="label">Min Daily Revenue</div>
          <div class="value">${formatCurrency(summary.min_daily_revenue)}</div>
        </div>
        <div class="summary-card neutral">
          <div class="label">Days with Data</div>
          <div class="value">${summary.days_with_data}</div>
        </div>
      </div>
      
      ${daily_trends.length > 0 ? `
      <div class="section">
        <div class="section-title">Daily Revenue Trends</div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th class="text-right">Total Revenue</th>
              <th class="text-right">Cash</th>
              <th class="text-right">Credit Card</th>
              <th class="text-right">Online</th>
            </tr>
          </thead>
          <tbody>
            ${daily_trends.map(trend => `
              <tr>
                <td>${new Date(trend.date).toLocaleDateString()}</td>
                <td class="text-right currency">${formatCurrency(trend.revenue)}</td>
                <td class="text-right currency">${formatCurrency(trend.cash)}</td>
                <td class="text-right currency">${formatCurrency(trend.credit_card)}</td>
                <td class="text-right currency">${formatCurrency(trend.online)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      ${weekly_trends.length > 0 ? `
      <div class="section">
        <div class="section-title">Weekly Revenue Trends</div>
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th class="text-right">Weekly Revenue</th>
              <th class="text-right">Avg Daily</th>
              <th class="text-right">Days</th>
            </tr>
          </thead>
          <tbody>
            ${weekly_trends.map(trend => `
              <tr>
                <td>${new Date(trend.week_start).toLocaleDateString()}</td>
                <td class="text-right currency">${formatCurrency(trend.weekly_revenue)}</td>
                <td class="text-right currency">${formatCurrency(trend.avg_daily_revenue)}</td>
                <td class="text-right">${trend.days_count}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      ${monthly_trends.length > 0 ? `
      <div class="section">
        <div class="section-title">Monthly Revenue Trends</div>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th class="text-right">Monthly Revenue</th>
              <th class="text-right">Avg Daily</th>
              <th class="text-right">Days</th>
            </tr>
          </thead>
          <tbody>
            ${monthly_trends.map(trend => `
              <tr>
                <td>${new Date(trend.month_start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</td>
                <td class="text-right currency">${formatCurrency(trend.monthly_revenue)}</td>
                <td class="text-right currency">${formatCurrency(trend.avg_daily_revenue)}</td>
                <td class="text-right">${trend.days_count}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
    `;
  };

  if (!selectedStore) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>No store selected.</strong> Please select a store from the header to view reports.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">
            Financial reports and analytics for <span className="font-medium">{selectedStore.name}</span>
          </p>
        </div>
        {reportData && (
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('csv')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              CSV
            </button>
            <button
              onClick={() => handleExport('excel')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Excel
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF
            </button>
          </div>
        )}
      </div>

      {/* Date/Period Selector */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        {needsDateRange && (
          <>
            {/* Quick Date Presets */}
            <div className="mb-4 pb-4 border-b border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">Quick Select</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Today', days: 0 },
                  { label: 'Last 7 Days', days: 7 },
                  { label: 'Last 30 Days', days: 30 },
                  { label: 'This Month', preset: 'this_month' },
                  { label: 'Last Month', preset: 'last_month' },
                  { label: 'This Year', preset: 'this_year' }
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      
                      if (preset.preset === 'this_month') {
                        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                        setStartDate(firstDay.toISOString().split('T')[0]);
                        setEndDate(today.toISOString().split('T')[0]);
                      } else if (preset.preset === 'last_month') {
                        const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                        const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                        setStartDate(firstDayLastMonth.toISOString().split('T')[0]);
                        setEndDate(lastDayLastMonth.toISOString().split('T')[0]);
                      } else if (preset.preset === 'this_year') {
                        const firstDay = new Date(today.getFullYear(), 0, 1);
                        setStartDate(firstDay.toISOString().split('T')[0]);
                        setEndDate(today.toISOString().split('T')[0]);
                      } else {
                        const end = new Date(today);
                        const start = new Date(today);
                        start.setDate(start.getDate() - preset.days);
                        setStartDate(start.toISOString().split('T')[0]);
                        setEndDate(end.toISOString().split('T')[0]);
                      }
                    }}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Custom Date Range */}
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </>
        )}
        {needsSingleDate && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}
        {needsMonthYear && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                min="2020"
                max="2099"
                className="border border-gray-300 rounded-md px-3 py-2 w-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const month = (i + 1).toString().padStart(2, '0');
                  const monthName = new Date(2000, i, 1).toLocaleDateString('en-US', { month: 'long' });
                  return (
                    <option key={month} value={month}>{monthName}</option>
                  );
                })}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <nav className="-mb-px flex space-x-8 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#2d8659] text-[#2d8659]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#2d8659]"></div>
          <p className="mt-4 text-gray-600">Loading report...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      ) : !reportData ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No data available</h3>
          <p className="mt-1 text-sm text-gray-500">Select a date range and generate a report to view data.</p>
        </div>
      ) : (
        <div>
          {activeTab === 'profit-loss' && renderProfitLoss()}
          {activeTab === 'cash-flow' && renderCashFlow()}
          {activeTab === 'expense-breakdown' && renderExpenseBreakdown()}
          {activeTab === 'vendor-payments' && renderVendorPayments()}
          {activeTab === 'sales-trends' && renderSalesTrends()}
          {activeTab === 'daily-business' && renderDailyBusiness()}
          {activeTab === 'monthly-business' && renderMonthlyBusiness()}
          {activeTab === 'lottery-sales' && renderLotterySales()}
          {activeTab === 'deposits' && renderDeposits()}
          {activeTab === 'payroll' && renderPayroll()}
          {activeTab === 'inventory' && renderInventory()}
        </div>
      )}
    </div>
  );
};

export default Reports;
