/**
 * Daily Analytics Page
 * 
 * Shows daily business and lottery data with filtering capabilities.
 * Focused on viewing and analyzing data, not data entry.
 */
import { useState, useEffect } from 'react';
import { revenueAPI, banksAPI } from '../services/api';
import { useStore } from '../contexts/StoreContext';
import DailyReportTable from '../components/revenue/DailyReportTable';

const BusinessAnalytics = () => {
  const { selectedStore: contextStore } = useStore();
  const selectedStore = contextStore?.id || '';
  const [loading, setLoading] = useState(false);
  const [revenueData, setRevenueData] = useState([]);
  const [latestCashOnHand, setLatestCashOnHand] = useState({ businessCashOnHand: 0, lotteryCashOnHand: 0 });
  const [banks, setBanks] = useState([]);
  const [weeklyLotteryData, setWeeklyLotteryData] = useState(null);
  const [bankBalances, setBankBalances] = useState({ business: 0, lottery: 0 });
  
  // Date filter state
  const [filterPeriod, setFilterPeriod] = useState('last_30_days'); // 'today', 'this_week', 'this_month', 'last_month', 'last_30_days', 'this_quarter', 'this_year', 'last_year', 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    // Check if storeId is in URL query params (for direct links)
    const urlParams = new URLSearchParams(window.location.search);
    const storeIdFromUrl = urlParams.get('storeId');
    if (storeIdFromUrl && contextStore?.id !== storeIdFromUrl) {
      // If URL has storeId but it doesn't match context, we could update context
      // But for now, we'll just use the context store
    }
  }, [contextStore]);

  useEffect(() => {
    if (selectedStore) {
      calculateDateRange();
    }
  }, [selectedStore, filterPeriod, customStartDate, customEndDate]);

  useEffect(() => {
    if (selectedStore) {
      loadBanks();
      calculateBankBalances();
    }
  }, [selectedStore]);

  useEffect(() => {
    if (selectedStore && dateRange.start && dateRange.end) {
      loadRevenueData();
    }
  }, [selectedStore, dateRange]);


  const calculateDateRange = () => {
    // Get today's date in local timezone
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start, end;

    switch (filterPeriod) {
      case 'today':
        start = new Date(today);
        start.setHours(0, 0, 0, 0);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      
      case 'this_week':
        start = new Date(today);
        start.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
        start.setHours(12, 0, 0, 0);
        end = new Date(today);
        break;
      
      case 'last_week':
        start = new Date(today);
        start.setDate(today.getDate() - today.getDay() - 7); // Start of last week
        start.setHours(12, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 6); // End of last week
        end.setHours(12, 0, 0, 0);
        break;
      
      case 'this_month':
        start = new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0);
        end = new Date(today);
        break;
      
      case 'last_month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1, 12, 0, 0, 0);
        end = new Date(today.getFullYear(), today.getMonth(), 0, 12, 0, 0, 0);
        break;
      
      case 'last_30_days':
        start = new Date(today);
        start.setDate(today.getDate() - 29); // -29 to include today (30 days total: today + 29 previous days)
        start.setHours(0, 0, 0, 0); // Start of day
        end = new Date(today);
        end.setHours(23, 59, 59, 999); // End of day to include full current day
        break;
      
      case 'this_quarter':
        const quarter = Math.floor(today.getMonth() / 3);
        start = new Date(today.getFullYear(), quarter * 3, 1, 12, 0, 0, 0);
        end = new Date(today);
        break;
      
      case 'last_quarter':
        const lastQuarter = Math.floor(today.getMonth() / 3) - 1;
        const year = lastQuarter < 0 ? today.getFullYear() - 1 : today.getFullYear();
        const quarterMonth = lastQuarter < 0 ? 9 : lastQuarter * 3;
        start = new Date(year, quarterMonth, 1, 12, 0, 0, 0);
        end = new Date(year, quarterMonth + 2, new Date(year, quarterMonth + 3, 0).getDate(), 12, 0, 0, 0);
        break;
      
      case 'this_year':
        start = new Date(today.getFullYear(), 0, 1, 12, 0, 0, 0);
        end = new Date(today);
        break;
      
      case 'last_year':
        start = new Date(today.getFullYear() - 1, 0, 1, 12, 0, 0, 0);
        end = new Date(today.getFullYear() - 1, 11, 31, 12, 0, 0, 0);
        break;
      
      case 'last_6_months':
        start = new Date(today);
        start.setMonth(today.getMonth() - 6);
        start.setHours(12, 0, 0, 0);
        end = new Date(today);
        break;
      
      case 'last_12_months':
        start = new Date(today);
        start.setMonth(today.getMonth() - 12);
        start.setHours(12, 0, 0, 0);
        end = new Date(today);
        break;
      
      case 'custom':
        if (customStartDate && customEndDate) {
          start = new Date(customStartDate + 'T12:00:00');
          end = new Date(customEndDate + 'T12:00:00');
        } else {
          return; // Don't update dateRange if custom dates aren't set
        }
        break;
      
      default:
        start = new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0);
        end = new Date(today);
    }

    if (start && end) {
      // Format dates in local timezone to avoid timezone shift issues
      const formatDateLocal = (date) => {
        // Use local date components to avoid timezone shifts
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      // Ensure end date includes the full day by using the date as-is (not time-based)
      const endDateFormatted = formatDateLocal(end);
      const startDateFormatted = formatDateLocal(start);
      
      setDateRange({
        start: startDateFormatted,
        end: endDateFormatted
      });
    }
  };

  const loadBanks = async () => {
    if (!selectedStore) return;
    try {
      const response = await banksAPI.getByStore(selectedStore);
      setBanks(response.data.banks || []);
    } catch (error) {
      console.error('Error loading banks:', error);
    }
  };

  const loadRevenueData = async () => {
    if (!selectedStore || !dateRange.start || !dateRange.end) return;

    try {
      setLoading(true);
      const response = await revenueAPI.getDailyRevenueRange(selectedStore, dateRange.start, dateRange.end);
      const data = response.data.revenues || [];
      
      // Sort by date descending (most recent first)
      data.sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date));
      
      setRevenueData(data);
      
      // Get latest Tuesday's weekly lottery data
      loadWeeklyLotteryData(data);
    } catch (error) {
      console.error('Error loading revenue data:', error);
      setRevenueData([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateBankBalances = async () => {
    if (!selectedStore) {
      setBankBalances({ business: 0, lottery: 0 });
      return;
    }

    try {
      // Get all revenue entries to calculate total bank balance (not just selected range)
      const response = await revenueAPI.getDailyRevenueRange(
        selectedStore,
        '2000-01-01', // Start from a very early date
        new Date().toISOString().split('T')[0] // To today
      );
      
      const allRevenues = response.data.revenues || [];
      
      // Sort by date ascending to calculate running balance
      const sortedRevenues = [...allRevenues].sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date));
      
      let businessBalance = 0;
      let lotteryBalance = 0;

      sortedRevenues.forEach(revenue => {
        if (revenue.bank_deposit_amount && parseFloat(revenue.bank_deposit_amount) > 0) {
          if (revenue.is_lottery_bank_deposit) {
            lotteryBalance += parseFloat(revenue.bank_deposit_amount);
          } else {
            businessBalance += parseFloat(revenue.bank_deposit_amount);
          }
        }
        
        // Subtract weekly lottery due from lottery bank (taken out on Tuesdays)
        if (revenue.weekly_lottery_due && parseFloat(revenue.weekly_lottery_due) > 0) {
          lotteryBalance -= parseFloat(revenue.weekly_lottery_due);
        }
      });

      setBankBalances({ business: businessBalance, lottery: lotteryBalance });
    } catch (error) {
      console.error('Error calculating bank balances:', error);
      // Fallback to calculating from current date range
      if (revenueData && revenueData.length > 0) {
        const sortedRevenues = [...revenueData].sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date));
        let businessBalance = 0;
        let lotteryBalance = 0;

        sortedRevenues.forEach(revenue => {
          if (revenue.bank_deposit_amount && parseFloat(revenue.bank_deposit_amount) > 0) {
            if (revenue.is_lottery_bank_deposit) {
              lotteryBalance += parseFloat(revenue.bank_deposit_amount);
            } else {
              businessBalance += parseFloat(revenue.bank_deposit_amount);
            }
          }
          
          if (revenue.weekly_lottery_due && parseFloat(revenue.weekly_lottery_due) > 0) {
            lotteryBalance -= parseFloat(revenue.weekly_lottery_due);
          }
        });

        setBankBalances({ business: businessBalance, lottery: lotteryBalance });
      }
    }
  };

  const loadWeeklyLotteryData = (revenues) => {
    if (!revenues || revenues.length === 0) {
      setWeeklyLotteryData(null);
      return;
    }

    // Find the most recent entry with weekly lottery data (not just Tuesdays)
    const entriesWithWeeklyLottery = revenues
      .filter(r => r.weekly_lottery_commission || r.thirteen_week_average || r.weekly_lottery_due)
      .sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date));

    if (entriesWithWeeklyLottery.length > 0) {
      setWeeklyLotteryData(entriesWithWeeklyLottery[0]);
    } else {
      setWeeklyLotteryData(null);
    }
  };

  // Calculate totals
  const totals = revenueData.reduce((acc, entry) => {
    acc.totalCash += parseFloat(entry.total_cash || 0);
    acc.businessCreditCard += parseFloat(entry.business_credit_card || 0);
    acc.onlineSales += parseFloat(entry.online_sales || 0);
    acc.onlineNet += parseFloat(entry.online_net || 0);
    acc.totalInstant += parseFloat(entry.total_instant || 0);
    acc.instantPay += parseFloat(entry.instant_pay || 0);
    acc.lotteryCreditCard += parseFloat(entry.lottery_credit_card || 0);
    acc.customerTab += parseFloat(entry.customer_tab || 0);
    acc.otherCashExpense += parseFloat(entry.other_cash_expense || 0);
    acc.calculatedBusinessCash += parseFloat(entry.calculated_business_cash || 0);
    acc.calculatedLotteryOwed += parseFloat(entry.calculated_lottery_owed || 0);
    acc.dailyBusinessTotal += parseFloat(entry.calculated_business_cash || 0) || 0;
    return acc;
  }, {
    totalCash: 0,
    businessCreditCard: 0,
    onlineSales: 0,
    onlineNet: 0,
    totalInstant: 0,
    instantPay: 0,
    lotteryCreditCard: 0,
    customerTab: 0,
    otherCashExpense: 0,
    calculatedBusinessCash: 0,
    calculatedLotteryOwed: 0,
    dailyBusinessTotal: 0,
  });

  const calculatedDailyBusinessTotal = totals.dailyBusinessTotal > 0
    ? totals.dailyBusinessTotal
    : totals.totalCash + totals.businessCreditCard;

  const totalBusinessCashValue = Math.max(0, calculatedDailyBusinessTotal - totals.businessCreditCard);
  const totalCreditCardSalesValue = totals.businessCreditCard;
  const totalOnlineSalesValue = totals.onlineSales > 0 ? totals.onlineSales : totals.onlineNet;
  const totalInstantSalesValue = totals.totalInstant;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    // Parse date string as local date (YYYY-MM-DD format)
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Daily Analytics</h1>
        <p className="text-gray-600">View and analyze your daily business and lottery performance</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        {!selectedStore && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              Please select a store from the store selector in the header to view analytics.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter Period
            </label>
            <select
              value={filterPeriod}
              onChange={(e) => {
                setFilterPeriod(e.target.value);
                if (e.target.value !== 'custom') {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="last_week">Last Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="this_quarter">This Quarter</option>
              <option value="last_quarter">Last Quarter</option>
              <option value="last_6_months">Last 6 Months</option>
              <option value="this_year">This Year</option>
              <option value="last_year">Last Year</option>
              <option value="last_12_months">Last 12 Months</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {filterPeriod === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </>
          )}
        </div>

        {dateRange.start && dateRange.end && (
          <div className="text-sm text-gray-600 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div>
              Showing data from <strong>{formatDate(dateRange.start)}</strong> to <strong>{formatDate(dateRange.end)}</strong>
              {' '}({revenueData.length} {revenueData.length === 1 ? 'day' : 'days'})
            </div>
            <div className="text-gray-500">
              Current Date: {new Date().toLocaleDateString('en-US', { 
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
       {revenueData.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm font-medium text-gray-600 mb-1">Total Business Cash</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalBusinessCashValue)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Daily business total minus credit card sales</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm font-medium text-gray-600 mb-1">Total Credit Card Sales</div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totalCreditCardSalesValue)}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm font-medium text-gray-600 mb-1">Total Online Sales</div>
                <div className="text-2xl font-bold text-teal-600">
                  {formatCurrency(totalOnlineSalesValue)}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm font-medium text-gray-600 mb-1">Total Instant Sales</div>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(totalInstantSalesValue)}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                <div className="text-sm font-medium text-gray-600 mb-1">Total Cash On Hand</div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(latestCashOnHand.businessCashOnHand)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Latest balance</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
                <div className="text-sm font-medium text-gray-600 mb-1">Lottery Cash On Hand</div>
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(latestCashOnHand.lotteryCashOnHand)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Latest balance</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm font-medium text-gray-600 mb-1">Total Lottery Owed</div>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(totals.calculatedLotteryOwed)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="text-sm font-medium text-gray-600 mb-1">Current Business Bank Balance</div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(bankBalances.business)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {banks.find(b => b.is_default_bank)?.bank_name || 'No default bank'}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-indigo-500">
              <div className="text-sm font-medium text-gray-600 mb-1">Current Lottery Bank Balance</div>
              <div className="text-2xl font-bold text-indigo-600">
                {formatCurrency(bankBalances.lottery)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {banks.find(b => b.is_default_lottery_bank)?.bank_name || 'No default lottery bank'}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Weekly Lottery Info Section */}
      {weeklyLotteryData && (
        <div className="bg-white rounded-lg shadow p-6 mb-6 border-l-4 border-purple-500">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Lottery Information</h3>
          <p className="text-sm text-gray-600 mb-4">
            Latest entry: <strong>{formatDate(weeklyLotteryData.entry_date)}</strong>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-600 mb-1">Weekly Lottery Commission</div>
              <div className="text-xl font-bold text-purple-600">
                {formatCurrency(weeklyLotteryData.weekly_lottery_commission || 0)}
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-600 mb-1">13 Week Average</div>
              <div className="text-xl font-bold text-purple-600">
                {formatCurrency(weeklyLotteryData.thirteen_week_average || 0)}
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-600 mb-1">Weekly Lottery Due</div>
              <div className="text-xl font-bold text-purple-600">
                {formatCurrency(weeklyLotteryData.weekly_lottery_due || 0)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Report Table - Shows all entered data */}
      {selectedStore && dateRange.start && dateRange.end && (
        <DailyReportTable
          storeId={selectedStore}
          selectedDate={null}
          initialDateRange={dateRange}
          onDateSelect={(date) => {
            // Navigate to revenue entry page with selected date
            // Ensure date is in YYYY-MM-DD format
            let dateStr = date;
            if (typeof date === 'string') {
              // Handle ISO date strings or other formats
              if (date.includes('T')) {
                dateStr = date.split('T')[0];
              } else if (date.includes(' ')) {
                // Handle date strings with spaces
                dateStr = date.split(' ')[0];
              }
            } else if (date instanceof Date) {
              // Convert Date object to YYYY-MM-DD
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              dateStr = `${year}-${month}-${day}`;
            }
            window.location.href = `/revenue?storeId=${selectedStore}&date=${dateStr}`;
          }}
          onCashOnHandLoaded={(cashOnHand) => {
            setLatestCashOnHand(cashOnHand);
          }}
        />
      )}
    </div>
  );
};

export default BusinessAnalytics;

