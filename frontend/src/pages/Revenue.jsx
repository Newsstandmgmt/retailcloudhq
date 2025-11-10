/**
 * Revenue Entry Page
 * 
 * IMPORTANT: This page is designed for stores with COMBINED DRAWER only
 * (cash_drawer_type = 'combined' or 'same_drawer').
 * 
 * For stores with separate lottery and business drawers, separate revenue
 * entry forms will be implemented in a future update.
 * 
 * This page includes:
 * - Daily revenue entry (cash, card, online sales)
 * - Customer tab management
 * - Vendor payments from register cash (combined drawer only)
 * - Daily business report with net sales calculation
 */
import { useState, useEffect } from 'react';
import { revenueAPI, storesAPI, customerTabsAPI, banksAPI, squareAPI } from '../services/api';
import { useStore } from '../contexts/StoreContext';
import CustomerTabManager from '../components/customerTabs/CustomerTabManager';
import DailyBusinessReport from '../components/revenue/DailyBusinessReport';
import VendorPaymentsFromCash from '../components/revenue/VendorPaymentsFromCash';

// Helper function to get today's date in local timezone (YYYY-MM-DD format)
const getTodayLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Revenue = () => {
  const { selectedStore: contextStore } = useStore();
  const selectedStore = contextStore?.id || '';
  const [selectedDate, setSelectedDate] = useState(getTodayLocal());
  const [showCustomerTabs, setShowCustomerTabs] = useState(false);
  const [dailyTabTotal, setDailyTabTotal] = useState(0);
  const [formData, setFormData] = useState({
    entry_date: getTodayLocal(),
    total_cash: '',
    business_credit_card: '',
    credit_card_transaction_fees: '',
    square_gross_card_sales: '',
    square_card_fees: '',
    square_net_card_sales: '',
    square_synced_at: null,
    online_sales: '',
    online_net: '',
    total_instant: '',
    total_instant_adjustment: '',
    instant_pay: '',
    lottery_credit_card: '',
    sales_tax_amount: '',
    newspaper_sold: '',
    elias_newspaper: '',
    sam_newspaper: '',
    customer_tab: '',
    other_cash_expense: '',
    weekly_lottery_commission: '',
    thirteen_week_average: '',
    weekly_lottery_due: '',
    notes: '',
    store_closed: false,
  });
  const [showWeeklyLotteryInfo, setShowWeeklyLotteryInfo] = useState(false);
  const [weeklyLotteryAlert, setWeeklyLotteryAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [currentRevenueData, setCurrentRevenueData] = useState(null);
  const [storeSettings, setStoreSettings] = useState(null);
  const [banks, setBanks] = useState([]);
  const [businessBankDepositAmount, setBusinessBankDepositAmount] = useState('');
  const [lotteryBankDepositAmount, setLotteryBankDepositAmount] = useState('');
  const [cashOnHand, setCashOnHand] = useState({ businessCashOnHand: 0, lotteryCashOnHand: 0 });
  const [squareSyncing, setSquareSyncing] = useState(false);
  const [squareError, setSquareError] = useState('');
  const [squareMessage, setSquareMessage] = useState('');

  // Check URL params on mount - this should run first to set the date before data loads
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dateFromUrl = urlParams.get('date');
    const storeIdFromUrl = urlParams.get('storeId');
    
    if (storeIdFromUrl && contextStore?.id !== storeIdFromUrl) {
      // If URL has storeId but it doesn't match context, we could update context
      // But for now, we'll just use the context store
    }
    
    // Set the date from URL if provided - this takes priority over default today's date
    // If no date in URL, always use current date (for sidebar navigation)
    if (dateFromUrl) {
      let dateStr = dateFromUrl;
      
      // Handle ISO date strings (e.g., "2025-11-05T05:00:00.000Z")
      if (dateFromUrl.includes('T')) {
        dateStr = dateFromUrl.split('T')[0];
      }
      
      // Validate date format (should be YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(dateStr)) {
        setSelectedDate(dateStr);
        setFormData(prev => ({
          ...prev,
          entry_date: dateStr
        }));
      } else {
        console.warn('Invalid date format in URL:', dateFromUrl);
        // If invalid date, use current date
        const today = getTodayLocal();
        setSelectedDate(today);
        setFormData(prev => ({
          ...prev,
          entry_date: today
        }));
      }
    } else {
      // No date in URL - always use current date (sidebar navigation)
      const today = getTodayLocal();
      setSelectedDate(today);
      setFormData(prev => ({
        ...prev,
        entry_date: today
      }));
      // Clean up URL if it has a stale date parameter
      if (window.location.search.includes('date=')) {
        const newUrl = window.location.pathname + (storeIdFromUrl ? `?storeId=${storeIdFromUrl}` : '');
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []); // Run once on mount - before other useEffects

  useEffect(() => {
    if (selectedStore) {
      loadStoreSettings();
      loadBanks();
    }
  }, [selectedStore]);

  const loadBanks = async () => {
    if (!selectedStore) return;
    try {
      const response = await banksAPI.getByStore(selectedStore);
      setBanks(response.data.banks || []);
    } catch (error) {
      console.error('Error loading banks:', error);
    }
  };

const handleSyncSquareSales = async () => {
  if (!selectedStore || !selectedDate) return;
  try {
    setSquareSyncing(true);
    setSquareMessage('');
    setSquareError('');
    const response = await squareAPI.syncDailySales(selectedStore, selectedDate);
    const dailyRevenue = response.data?.daily_revenue;
    const totals = response.data?.totals;
    if (dailyRevenue) {
      setFormData(prev => ({
        ...prev,
        business_credit_card: dailyRevenue.business_credit_card ?? prev.business_credit_card,
        credit_card_transaction_fees: dailyRevenue.credit_card_transaction_fees ?? prev.credit_card_transaction_fees,
        square_gross_card_sales: dailyRevenue.square_gross_card_sales ?? totals?.gross_card_sales ?? prev.square_gross_card_sales,
        square_card_fees: dailyRevenue.square_card_fees ?? totals?.card_fees ?? prev.square_card_fees,
        square_net_card_sales: dailyRevenue.square_net_card_sales ?? totals?.net_card_sales ?? prev.square_net_card_sales,
        square_synced_at: dailyRevenue.square_synced_at || new Date().toISOString(),
      }));
    } else if (totals) {
      setFormData(prev => ({
        ...prev,
        business_credit_card: totals.gross_card_sales ?? prev.business_credit_card,
        credit_card_transaction_fees: totals.card_fees ?? prev.credit_card_transaction_fees,
        square_gross_card_sales: totals.gross_card_sales ?? prev.square_gross_card_sales,
        square_card_fees: totals.card_fees ?? prev.square_card_fees,
        square_net_card_sales: totals.net_card_sales ?? prev.square_net_card_sales,
        square_synced_at: new Date().toISOString(),
      }));
    }
    setSquareMessage('Square totals imported successfully.');
    await loadRevenueData(true);
  } catch (error) {
    console.error('Error syncing Square sales:', error);
    const message =
      error.response?.data?.error || error.message || 'Failed to sync Square sales.';
    if (message.toLowerCase().includes('not connected')) {
      setSquareError(
        `${message} Please connect Square under Settings → Integrations → Square POS.`
      );
    } else {
      setSquareError(message);
    }
  } finally {
    setSquareSyncing(false);
  }
};

  
  useEffect(() => {
    // Load bank deposit amounts when revenue data changes
    if (currentRevenueData) {
      if (currentRevenueData.is_lottery_bank_deposit && currentRevenueData.bank_deposit_amount) {
        setLotteryBankDepositAmount(currentRevenueData.bank_deposit_amount);
        setBusinessBankDepositAmount('');
      } else if (!currentRevenueData.is_lottery_bank_deposit && currentRevenueData.bank_deposit_amount) {
        setBusinessBankDepositAmount(currentRevenueData.bank_deposit_amount);
        setLotteryBankDepositAmount('');
      } else {
        setBusinessBankDepositAmount('');
        setLotteryBankDepositAmount('');
      }
    } else {
      setBusinessBankDepositAmount('');
      setLotteryBankDepositAmount('');
    }
  }, [currentRevenueData]);

  // Helper function to check if a date is Tuesday
  const isTuesday = (date) => {
    const d = new Date(date);
    return d.getDay() === 2; // 2 = Tuesday
  };

  // Check for missing weekly lottery data and show alerts
  const checkWeeklyLotteryRequirements = async () => {
    if (!selectedStore) return;
    
    const today = new Date();
    const isSelectedDateTuesday = isTuesday(selectedDate);
    
    // Auto-expand weekly lottery section if it's Tuesday
    if (isSelectedDateTuesday) {
      setShowWeeklyLotteryInfo(true);
    }
    
    // Check for missing Tuesday data in the past
    try {
      // Find all Tuesdays in the last 4 weeks
      const missingTuesdays = [];
      for (let i = 0; i < 28; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        if (isTuesday(checkDate)) {
          // Format date in local timezone (YYYY-MM-DD)
          const year = checkDate.getFullYear();
          const month = String(checkDate.getMonth() + 1).padStart(2, '0');
          const day = String(checkDate.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          // Check if this Tuesday has weekly lottery data
          try {
            const response = await revenueAPI.getDailyRevenue(selectedStore, dateStr);
            const revenue = response.data.revenue;
            if (!revenue || revenue.weekly_lottery_commission === null || revenue.thirteen_week_average === null || revenue.weekly_lottery_due === null) {
              missingTuesdays.push(dateStr);
            }
          } catch (error) {
            // No revenue entry for this date, so it's missing
            missingTuesdays.push(dateStr);
          }
        }
      }
      
      if (missingTuesdays.length > 0) {
        const latestMissing = missingTuesdays[0];
        const daysAgo = Math.floor((today - new Date(latestMissing)) / (1000 * 60 * 60 * 24));
        let message = `Weekly lottery data is missing for ${missingTuesdays.length} Tuesday(s).`;
        if (daysAgo === 0) {
          message = `⚠️ Today is Tuesday! Please enter Weekly Lottery Commission, 13 Week Average, and Weekly Lottery Due.`;
        } else if (daysAgo <= 7) {
          message = `⚠️ Weekly lottery data is missing for last Tuesday (${new Date(latestMissing).toLocaleDateString()}). Please enter the data.`;
        }
        setWeeklyLotteryAlert({ message, missingDates: missingTuesdays });
      } else {
        setWeeklyLotteryAlert(null);
      }
    } catch (error) {
      console.error('Error checking weekly lottery requirements:', error);
    }
  };

  useEffect(() => {
    if (selectedStore && selectedDate) {
      loadDailyTabTotal().then(() => {
        loadRevenueData();
      });
      checkWeeklyLotteryRequirements();
    }
  }, [selectedStore, selectedDate]);

  const loadStoreSettings = async () => {
    if (!selectedStore) return;
    try {
      const response = await storesAPI.getById(selectedStore);
      setStoreSettings(response.data.store);
    } catch (error) {
      console.error('Error loading store settings:', error);
    }
  };

  const loadDailyTabTotal = async () => {
    if (!selectedStore || !selectedDate) return { credits: 0, debits: 0, netTab: 0 };
    try {
      const response = await customerTabsAPI.getDailyTotals(selectedStore, selectedDate);
      const totals = response.data.totals || {};
      // Net tab amount = charges - payments (positive means more charges, negative means more payments)
      // For formula: we add customer_tab, so we use net_tab_amount
      const netTab = parseFloat(totals.net_tab_amount || 0);
      const credits = parseFloat(totals.total_charges || 0);
      const debits = parseFloat(totals.total_payments || 0);
      setDailyTabTotal(netTab);
      return { credits, debits, netTab };
    } catch (error) {
      console.error('Error loading daily tab total:', error);
      setDailyTabTotal(0);
      return { credits: 0, debits: 0, netTab: 0 };
    }
  };


  const loadRevenueData = async (preserveFormData = false) => {
    try {
      const response = await revenueAPI.getDailyRevenue(selectedStore, selectedDate);
      if (response.data.revenue) {
        const revenue = response.data.revenue;
        
        // Only update form data if we're not preserving it (i.e., not from vendor payment callback)
        if (!preserveFormData) {
          const isStoreClosed = revenue.store_closed === true || revenue.store_closed === 'true';
          
          setFormData(prev => {
            // If store is closed, ensure all numeric fields are 0
            const formDataUpdate = {
              ...prev,
              ...revenue,
              entry_date: revenue.entry_date,
              store_closed: isStoreClosed,
            };
            
            // If store is closed, explicitly set all numeric fields to 0
            if (isStoreClosed) {
              formDataUpdate.total_cash = 0;
              formDataUpdate.business_credit_card = 0;
              formDataUpdate.credit_card_transaction_fees = 0;
              formDataUpdate.square_gross_card_sales = 0;
              formDataUpdate.square_card_fees = 0;
              formDataUpdate.square_net_card_sales = 0;
              formDataUpdate.square_synced_at = null;
              formDataUpdate.online_sales = 0;
              formDataUpdate.online_net = 0;
              formDataUpdate.total_instant = 0;
              formDataUpdate.total_instant_adjustment = 0;
              formDataUpdate.instant_pay = 0;
              formDataUpdate.lottery_credit_card = 0;
              formDataUpdate.sales_tax_amount = 0;
              formDataUpdate.newspaper_sold = 0;
              formDataUpdate.elias_newspaper = 0;
              formDataUpdate.sam_newspaper = 0;
              formDataUpdate.customer_tab = 0;
              formDataUpdate.other_cash_expense = 0;
              formDataUpdate.weekly_lottery_commission = '';
              formDataUpdate.thirteen_week_average = '';
              formDataUpdate.weekly_lottery_due = '';
            }
            
            return formDataUpdate;
          });
          
          // Clear bank deposit amounts if store is closed
          if (isStoreClosed) {
            setBusinessBankDepositAmount('');
            setLotteryBankDepositAmount('');
          }
        }
        
        // Always update current revenue data for the report
        setCurrentRevenueData(revenue);
      } else {
        // Only reset form if we're not preserving it
        if (!preserveFormData) {
          setCurrentRevenueData(null);
          // Reset form for new entry
          setFormData(prev => ({
            ...prev,
            entry_date: selectedDate,
            total_cash: '',
            sales_tax_amount: '',
            business_credit_card: '',
            credit_card_transaction_fees: '',
            square_gross_card_sales: '',
            square_card_fees: '',
            square_net_card_sales: '',
            square_synced_at: null,
            online_sales: '',
            online_net: '',
            total_instant: '',
            total_instant_adjustment: '',
            instant_pay: '',
            lottery_credit_card: '',
            weekly_lottery_commission: '',
            thirteen_week_average: '',
            weekly_lottery_due: '',
            notes: '',
            store_closed: false,
          }));
        }
      }
      
      // Load cash on hand balances
      if (response.data.cashOnHand) {
        setCashOnHand(response.data.cashOnHand);
      } else {
        // Default to 0 if not provided
        setCashOnHand({ businessCashOnHand: 0, lotteryCashOnHand: 0 });
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Error loading revenue:', error);
      }
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Handle checkbox for store_closed
    if (type === 'checkbox' && name === 'store_closed') {
      const isClosed = checked;
      const newFormData = {
        ...formData,
        store_closed: isClosed,
      };
      
      // If store is closed, set ALL numeric fields to 0
      if (isClosed) {
        // Set all numeric fields to 0
        newFormData.total_cash = 0;
        newFormData.business_credit_card = 0;
        newFormData.credit_card_transaction_fees = 0;
        newFormData.square_gross_card_sales = 0;
        newFormData.square_card_fees = 0;
        newFormData.square_net_card_sales = 0;
        newFormData.square_synced_at = null;
        newFormData.online_sales = 0;
        newFormData.online_net = 0;
        newFormData.total_instant = 0;
        newFormData.total_instant_adjustment = 0;
        newFormData.instant_pay = 0;
        newFormData.lottery_credit_card = 0;
        newFormData.sales_tax_amount = 0;
        newFormData.newspaper_sold = 0;
        newFormData.elias_newspaper = 0;
        newFormData.sam_newspaper = 0;
        newFormData.customer_tab = 0;
        newFormData.other_cash_expense = 0;
        // Clear weekly lottery fields
        newFormData.weekly_lottery_commission = '';
        newFormData.thirteen_week_average = '';
        newFormData.weekly_lottery_due = '';
        // Clear bank deposit amounts
        setBusinessBankDepositAmount('');
        setLotteryBankDepositAmount('');
      }
      
      setFormData(newFormData);
      
      // Trigger auto-save for checkbox changes immediately
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
      
      const timer = setTimeout(() => {
        autoSave(newFormData);
      }, 300); // Short delay for checkbox to save immediately
      
      setAutoSaveTimer(timer);
      return;
    }
    
    // Prevent changes to numeric fields if store is closed
    if (formData.store_closed && name !== 'notes' && name !== 'entry_date') {
      // Allow only notes and entry_date to be changed when store is closed
      return;
    }
    
    const numericValue = value === '' ? '' : parseFloat(value) || 0;
    const newFormData = {
      ...formData,
      [name]: numericValue,
    };
    setFormData(newFormData);
    
    // Auto-save after 2 seconds of no changes
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }
    
    const timer = setTimeout(() => {
      autoSave(newFormData);
    }, 2000); // Auto-save 2 seconds after last change
    
    setAutoSaveTimer(timer);
  };

  const autoSave = async (dataToSave = null) => {
    if (!selectedStore || !selectedDate) return;
    if (isSaving) return; // Don't save if already saving
    
    const data = dataToSave || formData;
    
    try {
      setIsSaving(true);
      setError('');
      
      // If store is closed, ensure all numeric fields are 0
      const isStoreClosed = data.store_closed === true || data.store_closed === 'true';
      
      // Calculate customer tab from daily totals (only if store is not closed)
      let dailyTabTotal = 0;
      if (!isStoreClosed) {
        try {
          const tabTotals = await customerTabsAPI.getDailyTotals(selectedStore, selectedDate);
          dailyTabTotal = parseFloat(tabTotals.data.totals?.net_tab_amount || 0);
        } catch (error) {
          console.error('Error loading daily tab total:', error);
          dailyTabTotal = 0;
        }
      }
      
      // Get banks for deposit
      const businessBank = banks.find(b => b.is_default_bank);
      const lotteryBank = banks.find(b => b.is_default_lottery_bank);
      
      // Determine deposit (set to 0 if store is closed)
      const depositAmount = isStoreClosed ? 0 : parseFloat(businessBankDepositAmount || lotteryBankDepositAmount || 0);
      const isLotteryDeposit = !isStoreClosed && !!lotteryBankDepositAmount && parseFloat(lotteryBankDepositAmount) > 0;
      const depositBankId = depositAmount > 0 ? (isLotteryDeposit ? (lotteryBank?.id || null) : (businessBank?.id || null)) : null;
      
      // Prepare submit data - ensure all numeric fields are 0 if store is closed
      const submitData = {
        ...data,
        entry_date: selectedDate,
        customer_tab: isStoreClosed ? 0 : dailyTabTotal,
        bank_deposit_bank_id: depositAmount > 0 ? depositBankId : null,
        bank_deposit_amount: depositAmount,
        is_lottery_bank_deposit: isLotteryDeposit,
        // Explicitly set all numeric fields to 0 if store is closed
        total_cash: isStoreClosed ? 0 : (data.total_cash || 0),
        business_credit_card: isStoreClosed ? 0 : (data.business_credit_card || 0),
        credit_card_transaction_fees: isStoreClosed ? 0 : (data.credit_card_transaction_fees || 0),
        square_gross_card_sales: isStoreClosed ? 0 : (data.square_gross_card_sales || 0),
        square_card_fees: isStoreClosed ? 0 : (data.square_card_fees || 0),
        square_net_card_sales: isStoreClosed ? 0 : (data.square_net_card_sales || 0),
        square_synced_at: isStoreClosed ? null : (data.square_synced_at || null),
        online_sales: isStoreClosed ? 0 : (data.online_sales || 0),
        online_net: isStoreClosed ? 0 : (data.online_net || 0),
        total_instant: isStoreClosed ? 0 : (data.total_instant || 0),
        total_instant_adjustment: isStoreClosed ? 0 : (data.total_instant_adjustment || 0),
        instant_pay: isStoreClosed ? 0 : (data.instant_pay || 0),
        lottery_credit_card: isStoreClosed ? 0 : (data.lottery_credit_card || 0),
        sales_tax_amount: isStoreClosed ? 0 : (data.sales_tax_amount || 0),
        newspaper_sold: isStoreClosed ? 0 : (data.newspaper_sold || 0),
        elias_newspaper: isStoreClosed ? 0 : (data.elias_newspaper || 0),
        sam_newspaper: isStoreClosed ? 0 : (data.sam_newspaper || 0),
        other_cash_expense: isStoreClosed ? 0 : (data.other_cash_expense || 0),
        // Weekly lottery fields should be null/empty if store is closed
        weekly_lottery_commission: isStoreClosed ? null : (data.weekly_lottery_commission || null),
        thirteen_week_average: isStoreClosed ? null : (data.thirteen_week_average || null),
        weekly_lottery_due: isStoreClosed ? null : (data.weekly_lottery_due || null),
      };
      
      const response = await revenueAPI.saveDailyRevenue(selectedStore, submitData);
      
      // Update current revenue data and cash on hand in one call
      if (response.data.revenue) {
        setCurrentRevenueData(response.data.revenue);
        // Load cash on hand if provided
        if (response.data.cashOnHand) {
          setCashOnHand(response.data.cashOnHand);
        }
      } else {
        // Only reload if response doesn't have data
        await loadRevenueData(true); // Preserve form data
      }
      
      setLastSaved(new Date());
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (error) {
      console.error('Auto-save error:', error);
      if (error.response?.status === 500) {
        console.error('Server error details:', error.response?.data);
      }
      // Don't show error for auto-save failures to avoid interrupting user
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Clear any pending auto-save
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      setAutoSaveTimer(null);
    }
    
    // Trigger immediate save
    await autoSave();
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  }, [autoSaveTimer]);

  // Form field definitions - clean structure
  // Daily Cash fields (separate section)
  const dailyCashFields = [
    { key: 'total_cash', label: 'Total Cash', required: true }
  ];
  
  // Business Revenue fields (excluding cash fields)
  const businessFields = [
    { key: 'business_credit_card', label: 'Credit Card Sales', required: false },
    { key: 'credit_card_transaction_fees', label: 'Credit Card Fees', required: false },
    { key: 'other_cash_expense', label: 'Other Income', required: false },
  ];

  const lotteryFields = [
    { key: 'online_sales', label: 'Online Sales', required: false },
    { key: 'online_net', label: 'Online Net', required: false },
    { key: 'total_instant', label: 'Total Instant', required: false },
    { key: 'total_instant_adjustment', label: 'Total Instant Adjustment', required: false },
    { key: 'instant_pay', label: 'Instant Pay', required: false },
    { key: 'lottery_credit_card', label: 'Lottery Card Trans', required: false },
  ];

  const lastSquareSync =
    formData.square_synced_at || currentRevenueData?.square_synced_at || null;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Daily Revenue Entry</h1>
        <p className="text-gray-600">Enter daily revenue data for your stores</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        {!selectedStore && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              Please select a store from the store selector in the header to enter revenue data.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Entry Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {selectedStore && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Store
              </label>
              <div className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700">
                {contextStore?.name || 'Store'}
              </div>
            </div>
          )}
        </div>
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              id="store_closed"
              name="store_closed"
              checked={formData.store_closed || false}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 block text-sm font-medium text-gray-700">
              Store Closed (All values will be set to 0)
            </span>
          </label>
        </div>
      </div>

      {selectedStore && (
        <div className="bg-white rounded-lg shadow p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              Revenue entry saved successfully!
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Cash On Hand Display */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cash On Hand</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="text-sm font-medium text-gray-600 mb-1">Business Cash On Hand</div>
                  <div className="text-2xl font-bold text-blue-600">
                    ${(cashOnHand.businessCashOnHand || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Auto-calculated from previous data</div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-purple-200">
                  <div className="text-sm font-medium text-gray-600 mb-1">Lottery Cash On Hand</div>
                  <div className="text-2xl font-bold text-purple-600">
                    ${(cashOnHand.lotteryCashOnHand || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Auto-calculated from previous data</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-600">
                <p>Balances are calculated based on previous day's balances, plus today's revenue, minus bank deposits and owner distributions.</p>
              </div>
            </div>

            {/* Daily Cash Section */}
            <div className="border-t border-gray-200 pt-4 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Cash</h3>
              <div className="grid grid-cols-2 gap-4">
                {dailyCashFields.map((field) => (
                  <div key={field.key}>
                    <label
                      htmlFor={field.key}
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      id={field.key}
                      name={field.key}
                      value={formData[field.key] || ''}
                      onChange={handleChange}
                      disabled={formData.store_closed}
                      className={`w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${formData.store_closed ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      required={field.required}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Business Revenue Section */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Revenue</h3>
              <div className="grid grid-cols-2 gap-4">
                {businessFields.map((field) => (
                  <div key={field.key}>
                    <label
                      htmlFor={field.key}
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      id={field.key}
                      name={field.key}
                      value={formData[field.key] || ''}
                      onChange={handleChange}
                      disabled={formData.store_closed}
                      className={`w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${formData.store_closed ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      required={field.required}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                {(squareError || squareMessage) && (
                  <div
                    className={`px-4 py-3 rounded border ${
                      squareError
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-green-50 border-green-200 text-green-700'
                    }`}
                  >
                    {squareError || squareMessage}
                  </div>
                )}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="text-sm text-gray-600">
                    Fetch credit card sales and processing fees from Square for{' '}
                    {new Date(selectedDate).toLocaleDateString()}.
                    <span className="block text-xs text-gray-500">
                      Square must be connected in Settings → Integrations → Square POS.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSyncSquareSales}
                    disabled={squareSyncing}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    {squareSyncing ? 'Fetching…' : 'Fetch Square Card Totals'}
                  </button>
                </div>
                {(formData.square_gross_card_sales ||
                  formData.square_card_fees ||
                  formData.square_net_card_sales) && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">Square Card Totals</div>
                        <div className="text-xs text-gray-500">
                          Last fetched:{' '}
                          {lastSquareSync ? new Date(lastSquareSync).toLocaleString() : 'Not yet synced'}
                        </div>
                      </div>
                      <div className="flex flex-col md:flex-row gap-4 text-sm text-gray-700">
                        <div>
                          <div className="font-semibold text-gray-900">
                            ${parseFloat(formData.square_gross_card_sales || 0).toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">Gross Card Sales</div>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">
                            ${parseFloat(formData.square_card_fees || 0).toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">Card Fees</div>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">
                            ${parseFloat(formData.square_net_card_sales || 0).toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">Net Card Sales</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Tab Section - Auto-pulled from customer tab data */}
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">Customer Tab</h3>
                  <p className="text-sm text-gray-600">
                    Daily Total: <span className="font-semibold">${dailyTabTotal.toFixed(2)}</span>
                    {dailyTabTotal > 0 && <span className="text-red-600 ml-2">(Unpaid charges)</span>}
                    {dailyTabTotal < 0 && <span className="text-green-600 ml-2">(Payments received)</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Credits: ${(dailyTabTotal > 0 ? dailyTabTotal : 0).toFixed(2)} | 
                    Debits: ${(dailyTabTotal < 0 ? Math.abs(dailyTabTotal) : 0).toFixed(2)}
                    {' '}(Auto-calculated from customer tab transactions)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomerTabs(!showCustomerTabs)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  {showCustomerTabs ? 'Hide' : 'Manage'} Customer Tabs
                </button>
              </div>
              {showCustomerTabs && (
                <CustomerTabManager 
                  selectedDate={selectedDate}
                  onTabSelect={loadDailyTabTotal}
                />
              )}
            </div>

            {/* Other Expenses - Vendor Payments from Drawer Cash */}
            <div className="border-t border-gray-200 pt-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Other Expenses</h3>
              <p className="text-sm text-gray-600 mb-4">
                Record vendor payments made from drawer cash today. These will be tracked as expenses and linked to Purchase & Payments.
              </p>
              <VendorPaymentsFromCash
                storeId={selectedStore}
                entryDate={selectedDate}
                onPaymentsChange={(payments) => {
                  // Payments are automatically saved as expenses
                  // Reload revenue data to update report, but preserve form data
                  // This ensures the Daily Business Report updates without losing unsaved form inputs
                  setTimeout(() => {
                    loadRevenueData(true); // Pass true to preserve form data
                  }, 500);
                }}
              />
            </div>

            {/* Lottery Section */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Lottery</h3>
              <div className="grid grid-cols-2 gap-4">
                {lotteryFields.map((field) => (
                  <div key={field.key}>
                    <label
                      htmlFor={field.key}
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      id={field.key}
                      name={field.key}
                      value={formData[field.key] || ''}
                      onChange={handleChange}
                      disabled={formData.store_closed}
                      className={`w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${formData.store_closed ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      required={field.required}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly Lottery Info Section (Collapsible) */}
            <div className="border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={() => setShowWeeklyLotteryInfo(!showWeeklyLotteryInfo)}
                className="w-full flex items-center justify-between text-left mb-4 focus:outline-none"
              >
                <h3 className="text-lg font-semibold text-gray-900">
                  Weekly Lottery Info {isTuesday(selectedDate) && <span className="text-orange-600 text-sm">(Tuesday - Required)</span>}
                </h3>
                <span className="text-gray-500">
                  {showWeeklyLotteryInfo ? '▼' : '▶'}
                </span>
              </button>

              {weeklyLotteryAlert && (
                <div className={`mb-4 p-3 rounded-lg ${
                  isTuesday(selectedDate) ? 'bg-orange-100 border border-orange-400' : 'bg-yellow-100 border border-yellow-400'
                }`}>
                  <p className="text-sm font-medium text-orange-800">{weeklyLotteryAlert.message}</p>
                </div>
              )}

              {showWeeklyLotteryInfo && (
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <p className="text-sm text-gray-600 mb-4">
                    Enter weekly lottery data from your Tuesday report. This data is required every Tuesday.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label
                        htmlFor="weekly_lottery_commission"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Weekly Lottery Commission
                        {isTuesday(selectedDate) && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        id="weekly_lottery_commission"
                        name="weekly_lottery_commission"
                        value={formData.weekly_lottery_commission || ''}
                        onChange={handleChange}
                        disabled={formData.store_closed}
                        className={`w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${formData.store_closed ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        required={isTuesday(selectedDate)}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="thirteen_week_average"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        13 Week Average
                        {isTuesday(selectedDate) && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        id="thirteen_week_average"
                        name="thirteen_week_average"
                        value={formData.thirteen_week_average || ''}
                        onChange={handleChange}
                        disabled={formData.store_closed}
                        className={`w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${formData.store_closed ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        required={isTuesday(selectedDate)}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="weekly_lottery_due"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Weekly Lottery Due
                        {isTuesday(selectedDate) && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        id="weekly_lottery_due"
                        name="weekly_lottery_due"
                        value={formData.weekly_lottery_due || ''}
                        onChange={handleChange}
                        disabled={formData.store_closed}
                        className={`w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${formData.store_closed ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        required={isTuesday(selectedDate)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bank Deposits Section */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Bank Deposits</h3>
              
              {/* Business Bank Deposit */}
              <div className="mb-4">
                <h4 className="text-md font-semibold text-gray-900 mb-3">Business Bank Deposit</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business Bank
                    </label>
                    <div className="text-sm text-gray-600">
                      {banks.find(b => b.is_default_bank)?.bank_name || 'No business bank selected'}
                    </div>
                    {!banks.find(b => b.is_default_bank) && (
                      <p className="text-xs text-red-600 mt-1">Please set a default business bank in Settings</p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="business_bank_deposit_amount"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Deposit Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      id="business_bank_deposit_amount"
                      value={businessBankDepositAmount}
                      onChange={(e) => {
                        setBusinessBankDepositAmount(e.target.value);
                        // Trigger auto-save for bank deposit changes
                        if (autoSaveTimer) {
                          clearTimeout(autoSaveTimer);
                        }
                        const timer = setTimeout(() => {
                          autoSave();
                        }, 2000);
                        setAutoSaveTimer(timer);
                      }}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      disabled={!banks.find(b => b.is_default_bank)}
                    />
                  </div>
                </div>
              </div>

              {/* Lottery Bank Deposit */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-md font-semibold text-gray-900 mb-3">Lottery Bank Deposit</h4>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lottery Bank
                    </label>
                    <div className="text-sm text-gray-600">
                      {banks.find(b => b.is_default_lottery_bank)?.bank_name || 'No lottery bank selected'}
                    </div>
                    {!banks.find(b => b.is_default_lottery_bank) && (
                      <p className="text-xs text-red-600 mt-1">Please set a default lottery bank in Settings</p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="lottery_bank_deposit_amount"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Deposit Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      id="lottery_bank_deposit_amount"
                      value={lotteryBankDepositAmount}
                      onChange={(e) => {
                    setLotteryBankDepositAmount(e.target.value);
                    // Trigger auto-save for bank deposit changes
                    if (autoSaveTimer) {
                      clearTimeout(autoSaveTimer);
                    }
                    const timer = setTimeout(() => {
                      autoSave();
                    }, 2000);
                    setAutoSaveTimer(timer);
                  }}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      disabled={!banks.find(b => b.is_default_lottery_bank)}
                    />
                  </div>
                  {lotteryBankDepositAmount && parseFloat(lotteryBankDepositAmount) > 0 && (
                    <p className="mt-2 text-sm text-blue-600">
                      This deposit will reduce the lottery due amount when you save.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows="3"
                value={formData.notes || ''}
                onChange={(e) => {
                  setFormData({ ...formData, notes: e.target.value });
                  // Trigger auto-save for notes changes
                  if (autoSaveTimer) {
                    clearTimeout(autoSaveTimer);
                  }
                  const timer = setTimeout(() => {
                    autoSave();
                  }, 2000);
                  setAutoSaveTimer(timer);
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {lastSaved && (
                  <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
                )}
                {!lastSaved && (
                  <span>Changes will be saved automatically</span>
                )}
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                onClick={(e) => {
                  e.preventDefault();
                  // Clear auto-save timer and save immediately
                  if (autoSaveTimer) {
                    clearTimeout(autoSaveTimer);
                    setAutoSaveTimer(null);
                  }
                  autoSave();
                }}
              >
                {isSaving ? 'Saving...' : 'Save Now'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Daily Business Report - Detailed view for selected date */}
      {selectedStore && selectedDate && (
        <div className="mt-6">
          <DailyBusinessReport 
            storeId={selectedStore}
            date={selectedDate}
            revenueData={currentRevenueData || formData}
            key={`${selectedStore}-${selectedDate}`}
          />
        </div>
      )}
    </div>
  );
};

export default Revenue;

