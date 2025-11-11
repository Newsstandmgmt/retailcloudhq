import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { storesAPI, revenueAPI, lotteryAPI, purchaseInvoicesAPI, statisticsAPI, storeSubscriptionsAPI, storeTemplatesAPI, payrollAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../contexts/StoreContext';
import { CurrencyDollarIcon, ClipboardIcon, DocumentIcon, ChartIcon } from '../components/Icons';
import AlertSystem from '../components/alerts/AlertSystem';

const Dashboard = () => {
  const { user } = useAuth();
  const { stores, selectedStore, hasMultipleStores } = useStore();
  const navigate = useNavigate();
  
  // Super admin sees a simplified overview dashboard
  // Full statistics are available in the Statistics page
  if (user?.role === 'super_admin') {
    const [quickStats, setQuickStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      loadQuickStats();
    }, []);

    const loadQuickStats = async () => {
      try {
        const response = await statisticsAPI.getAll();
        setQuickStats(response.data.statistics);
      } catch (error) {
        console.error('Error loading quick stats:', error);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">Quick overview of your system</p>
          </div>
          <Link
            to="/statistics"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ChartIcon className="w-5 h-5 mr-2" />
            View Advanced Statistics
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
              <p className="text-sm text-gray-600 mb-1">Total Users</p>
              <p className="text-3xl font-bold text-gray-900">{quickStats?.users?.total_users || 0}</p>
              <p className="text-xs text-gray-500 mt-2">{quickStats?.users?.active_users || 0} active</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-indigo-500">
              <p className="text-sm text-gray-600 mb-1">Total Stores</p>
              <p className="text-3xl font-bold text-gray-900">{quickStats?.stores?.total_stores || 0}</p>
              <p className="text-xs text-gray-500 mt-2">{quickStats?.stores?.active_stores || 0} active</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-3xl font-bold text-green-600">
                ${parseFloat(quickStats?.billing?.total_revenue || 0).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                ${parseFloat(quickStats?.billing?.pending_revenue || 0).toFixed(2)} pending
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
              <p className="text-sm text-gray-600 mb-1">Monthly Recurring Revenue</p>
              <p className="text-3xl font-bold text-purple-600">
                ${parseFloat(quickStats?.subscriptions?.monthly_recurring_revenue || 0).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {quickStats?.subscriptions?.active_subscriptions || 0} active subscriptions
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    monthlySales: 0,
    totalLotteryDue: 0,
    invoicesPending: 0,
    invoicesPendingAmount: 0,
  });
  const [subscription, setSubscription] = useState(null);
  const [hasPayrollAccess, setHasPayrollAccess] = useState(false);
  
  // Widget customization state
  const [widgetVisibility, setWidgetVisibility] = useState({
    businessRevenue: true,
    lotteryDue: true,
    invoicesPending: true,
  });
  const [showWidgetSettings, setShowWidgetSettings] = useState(false);

  // Load widget preferences from localStorage when store changes
  useEffect(() => {
    if (selectedStore) {
      const saved = localStorage.getItem(`dashboard-widgets-${selectedStore.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setWidgetVisibility(parsed);
        } catch (e) {
          // If parse fails, keep defaults
        }
      }
    }
  }, [selectedStore]);

  // Save widget preferences to localStorage
  useEffect(() => {
    if (selectedStore) {
      localStorage.setItem(`dashboard-widgets-${selectedStore.id}`, JSON.stringify(widgetVisibility));
    }
  }, [widgetVisibility, selectedStore]);

  // Add Invoice Modal State
  const [showAddInvoiceModal, setShowAddInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_number: '',
    purchase_date: new Date().toISOString().split('T')[0],
    vendor_id: '',
    amount: '',
    payment_option: 'cash',
    due_days: '',
    notes: '',
  });
  const [vendors, setVendors] = useState([]);

  // Pay Bill Modal State
  const [showPayBillModal, setShowPayBillModal] = useState(false);
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    check_number: '',
    split_payments: []
  });

  useEffect(() => {
    loadDashboardData();
    if (selectedStore) {
      loadVendors();
      loadSubscription();
      checkPayrollAccess();
    }
  }, [selectedStore]);

  const checkPayrollAccess = async () => {
    if (!selectedStore) {
      setHasPayrollAccess(false);
      return;
    }
    
    // Super admin and admin always have access
    if (user?.role === 'super_admin' || user?.role === 'admin') {
      setHasPayrollAccess(true);
      return;
    }
    
    // For managers, check via API
    if (user?.role === 'manager') {
      try {
        const response = await payrollAPI.checkAccess(selectedStore.id);
        setHasPayrollAccess(response.data.hasAccess || false);
      } catch (error) {
        console.error('Error checking payroll access:', error);
        setHasPayrollAccess(false);
      }
    } else {
      setHasPayrollAccess(false);
    }
  };

  const loadSubscription = async () => {
    if (!selectedStore) {
      setSubscription(null);
      return;
    }
    
    try {
      // First, try to get subscription record
      try {
        const response = await storeSubscriptionsAPI.getByStore(selectedStore.id);
        const subscriptionData = response.data.subscription;
        
        // If subscription record exists, use it
        if (subscriptionData) {
          setSubscription(subscriptionData);
          return;
        }
      } catch (subError) {
        // Subscription record doesn't exist, try template
        if (subError.response?.status === 404 || !subError.response) {
          // Continue to check template_id
        } else {
          throw subError;
        }
      }
      
      // If no subscription record, check for template_id
      // Fetch store details to get template_id (in case it's not in selectedStore)
      let templateId = selectedStore.template_id;
      
      if (!templateId && selectedStore.id) {
        try {
          const storeRes = await storesAPI.getById(selectedStore.id);
          templateId = storeRes.data.store?.template_id;
        } catch (storeError) {
          console.error('Error fetching store details:', storeError);
        }
      }
      
      if (templateId) {
        try {
          const templateRes = await storeTemplatesAPI.getById(templateId);
          const template = templateRes.data.template;
          
          // Create a subscription-like object from template
          setSubscription({
            template_id: template.id,
            template_name: template.name,
            base_price: template.price_per_month || 0,
            total_monthly_price: template.price_per_month || 0,
            billing_cycle: template.billing_cycle || 'monthly',
            status: 'active',
            auto_renew: true,
            template_feature_keys: template.feature_keys || [],
            addon_feature_keys: [],
            features: template.features || []
          });
        } catch (templateError) {
          console.error('Error loading template:', templateError);
          setSubscription(null);
        }
      } else {
        setSubscription(null);
      }
    } catch (error) {
      // Subscription might not exist yet - that's okay
      if (error.response?.status !== 404) {
        console.error('Error loading subscription:', error);
        console.error('Error details:', error.response?.data);
      }
      // Don't set subscription to null if there's a template_id - try to show template data
      if (!selectedStore?.template_id) {
        setSubscription(null);
      }
    }
  };

  useEffect(() => {
    if (showPayBillModal && selectedStore) {
      loadUnpaidInvoices();
    }
  }, [showPayBillModal, selectedStore]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // Load data for selected store
      if (selectedStore && user?.role !== 'super_admin') {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        
        // Load total business revenue and lottery due for the month (using same calculation as Daily Analytics)
        try {
          // Fetch all revenue entries for the month (reuse for both calculations)
          const revenueRes = await revenueAPI.getRevenueRange(selectedStore.id, startOfMonth, endOfMonth);
          if (revenueRes.data?.revenues && revenueRes.data.revenues.length > 0) {
            // Calculate total business revenue (same as DailyReportTable)
            const totalBusinessRevenue = revenueRes.data.revenues.reduce((sum, revenue) => {
              const calculatedBusinessCash = parseFloat(revenue.calculated_business_cash || 0);
              
              // Use calculated_business_cash if available (most accurate)
              if (calculatedBusinessCash > 0) {
                return sum + calculatedBusinessCash;
              }
              
              // Fallback calculation (same as DailyReportTable)
              const totalCash = parseFloat(revenue.total_cash || 0);
              const creditCard = parseFloat(revenue.business_credit_card || 0);
              const onlineSales = parseFloat(revenue.online_sales || 0);
              const customerTab = parseFloat(revenue.customer_tab || 0);
              
              return sum + totalCash + creditCard + onlineSales + customerTab;
            }, 0);
            
            // Calculate total lottery due (same as Daily Analytics - uses calculated_lottery_owed)
            const totalLotteryDue = revenueRes.data.revenues.reduce((sum, revenue) => {
              return sum + parseFloat(revenue.calculated_lottery_owed || 0);
            }, 0);
            
            setStats(prev => ({
              ...prev,
              monthlySales: totalBusinessRevenue,
              totalLotteryDue: totalLotteryDue,
            }));
          } else {
            setStats(prev => ({
              ...prev,
              monthlySales: 0,
              totalLotteryDue: 0,
            }));
          }
        } catch (error) {
          console.error('Error loading revenue data for this month:', error);
          setStats(prev => ({
            ...prev,
            monthlySales: 0,
            totalLotteryDue: 0,
          }));
        }

        // Load pending invoices
        try {
          const invoicesRes = await purchaseInvoicesAPI.getAll(selectedStore.id, { status: 'pending' });
          if (invoicesRes.data?.invoices) {
            const invoicesPending = invoicesRes.data.invoices.length;
            const invoicesPendingAmount = invoicesRes.data.invoices.reduce((sum, invoice) => {
              return sum + parseFloat(invoice.total_amount || invoice.amount || 0);
            }, 0);
            setStats(prev => ({
              ...prev,
              invoicesPending,
              invoicesPendingAmount,
            }));
          }
        } catch (error) {
          console.log('No invoice data');
        }
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVendors = async () => {
    if (!selectedStore) return;
    try {
      const response = await purchaseInvoicesAPI.getVendors(selectedStore.id);
      setVendors(response.data.vendors || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const loadUnpaidInvoices = async () => {
    if (!selectedStore) return;
    try {
      const response = await purchaseInvoicesAPI.getAll(selectedStore.id, { status: 'pending' });
      setUnpaidInvoices(response.data.invoices || []);
      setSelectedInvoiceIds([]);
    } catch (error) {
      console.error('Error loading unpaid invoices:', error);
      alert('Failed to load unpaid invoices.');
    }
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (!selectedStore) {
      alert('Please select a store');
      return;
    }

    try {
      // Prepare invoice data - don't send invoice_number for cash payments
      const invoiceData = {
        ...invoiceForm,
        invoice_number: (invoiceForm.payment_option === 'cash') ? undefined : invoiceForm.invoice_number
      };
      
      await purchaseInvoicesAPI.create(selectedStore.id, invoiceData);
      alert('Invoice created successfully!');
      setShowAddInvoiceModal(false);
      setInvoiceForm({
        invoice_number: '',
        purchase_date: new Date().toISOString().split('T')[0],
        vendor_id: '',
        amount: '',
        payment_option: 'cash',
        due_days: '',
        notes: '',
      });
      loadDashboardData(); // Refresh dashboard stats
      navigate('/purchase-payments'); // Navigate to Purchase & Payments page
    } catch (error) {
      alert('Error creating invoice: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleToggleInvoice = (invoiceId) => {
    setSelectedInvoiceIds(prev => 
      prev.includes(invoiceId) 
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const handleSelectAll = () => {
    if (selectedInvoiceIds.length === unpaidInvoices.length) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(unpaidInvoices.map(inv => inv.id));
    }
  };

  const calculateSelectedTotal = () => {
    return unpaidInvoices
      .filter(inv => selectedInvoiceIds.includes(inv.id))
      .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
  };

  const handleAddSplitPayment = () => {
    setPaymentForm({
      ...paymentForm,
      split_payments: [
        ...paymentForm.split_payments,
        { payment_method: 'cash', amount: '', check_number: '' }
      ]
    });
  };

  const handleRemoveSplitPayment = (index) => {
    setPaymentForm({
      ...paymentForm,
      split_payments: paymentForm.split_payments.filter((_, i) => i !== index)
    });
  };

  const handleUpdateSplitPayment = (index, field, value) => {
    const updated = [...paymentForm.split_payments];
    updated[index] = { ...updated[index], [field]: value };
    setPaymentForm({ ...paymentForm, split_payments: updated });
  };

  const calculateSplitTotal = () => {
    return paymentForm.split_payments.reduce((sum, split) => {
      return sum + parseFloat(split.amount || 0);
    }, 0);
  };

  const handleRecordPayment = async () => {
    if (selectedInvoiceIds.length === 0) {
      alert('Please select at least one invoice to pay.');
      return;
    }

    const totalAmount = calculateSelectedTotal();
    const splitTotal = calculateSplitTotal();
    
    // If split payments are used, validate they add up to total
    if (paymentForm.split_payments.length > 0) {
      if (Math.abs(splitTotal - totalAmount) > 0.01) {
        alert(`Split payment total ($${splitTotal.toFixed(2)}) must equal selected invoices total ($${totalAmount.toFixed(2)})`);
        return;
      }
    } else {
      // Single payment - validate payment method
      if (!paymentForm.payment_method) {
        alert('Please select a payment method.');
        return;
      }
      if (paymentForm.payment_method === 'check' && !paymentForm.check_number) {
        alert('Please enter a check number for check payments.');
        return;
      }
    }

    try {
      // Prepare payment data
      const paymentData = {
        invoice_ids: selectedInvoiceIds,
        payment_date: paymentForm.payment_date,
        payment_method: paymentForm.payment_method,
        check_number: paymentForm.check_number || null,
        split_payments: paymentForm.split_payments.length > 0 ? paymentForm.split_payments : null
      };

      await purchaseInvoicesAPI.recordPayments(selectedStore.id, paymentData);
      alert('Payment recorded successfully!');
      setShowPayBillModal(false);
      setSelectedInvoiceIds([]);
      setPaymentForm({
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        check_number: '',
        split_payments: []
      });
      loadDashboardData(); // Refresh dashboard stats
      navigate('/purchase-payments'); // Navigate to Purchase & Payments page
    } catch (error) {
      alert('Error recording payment: ' + (error.response?.data?.error || error.message));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Show store selector message if no store selected
  if (!selectedStore && hasMultipleStores && (user?.role === 'admin' || user?.role === 'manager')) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-gray-500 mb-4">Please select a store from the header dropdown.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Page Title */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          {selectedStore && (user?.role === 'admin' || user?.role === 'manager') && (
            <p className="text-gray-600 mt-1">
              Viewing: <span className="font-medium">{selectedStore.name}</span>
            </p>
          )}
        </div>
        {selectedStore && (user?.role === 'admin' || user?.role === 'manager') && (
          <button
            onClick={() => setShowWidgetSettings(!showWidgetSettings)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {showWidgetSettings ? 'Done' : 'Customize Widgets'}
          </button>
        )}
      </div>

      {/* Alerts System - Creates notifications in background */}
      {selectedStore && (user?.role === 'admin' || user?.role === 'manager') && (
        <AlertSystem />
      )}

      {/* Widget Settings */}
      {showWidgetSettings && selectedStore && (user?.role === 'admin' || user?.role === 'manager') && (
        <div className="mb-6 bg-white rounded-lg shadow p-4 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Widget Visibility</h3>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={widgetVisibility.businessRevenue}
                onChange={(e) => setWidgetVisibility(prev => ({ ...prev, businessRevenue: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Total Business Revenue</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={widgetVisibility.lotteryDue}
                onChange={(e) => setWidgetVisibility(prev => ({ ...prev, lotteryDue: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Total Lottery Due</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={widgetVisibility.invoicesPending}
                onChange={(e) => setWidgetVisibility(prev => ({ ...prev, invoicesPending: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Invoices Pending</span>
            </label>
          </div>
        </div>
      )}

      {/* Summary Cards (like Hisably) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Total Business Revenue Card */}
        {widgetVisibility.businessRevenue && (
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Business Revenue</p>
              <p className="text-3xl font-bold text-gray-900">
                ${stats.monthlySales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CurrencyDollarIcon className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>
        )}

        {/* Total Lottery Due Card */}
        {widgetVisibility.lotteryDue && (
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Lottery Due</p>
              <p className="text-3xl font-bold text-gray-900">
                ${stats.totalLotteryDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <ClipboardIcon className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>
        )}

        {/* Invoices Pending Card */}
        {widgetVisibility.invoicesPending && (
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Invoices Pending</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.invoicesPending} ({stats.invoicesPendingAmount > 0 ? `$${stats.invoicesPendingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'})
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <DocumentIcon className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Quick Actions Tabs (like Hisably) */}
      {selectedStore && (user?.role === 'admin' || user?.role === 'manager') && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setShowAddInvoiceModal(true)}
                className="px-6 py-4 text-sm font-medium border-b-2 border-transparent hover:border-[#2d8659] hover:text-[#2d8659] transition-colors"
              >
                Add Bill / Invoice
              </button>
              <button
                onClick={() => setShowPayBillModal(true)}
                className="px-6 py-4 text-sm font-medium border-b-2 border-transparent hover:border-[#2d8659] hover:text-[#2d8659] transition-colors"
              >
                Pay Bill / Invoice
              </button>
              <Link
                to="/revenue"
                className="px-6 py-4 text-sm font-medium border-b-2 border-transparent hover:border-[#2d8659] hover:text-[#2d8659] transition-colors"
              >
                ATM Deposits
              </Link>
              <Link
                to="/revenue"
                className="px-6 py-4 text-sm font-medium border-b-2 border-transparent hover:border-[#2d8659] hover:text-[#2d8659] transition-colors"
              >
                Bank Deposits
              </Link>
              <Link
                to="/revenue"
                className="px-6 py-4 text-sm font-medium border-b-2 border-transparent hover:border-[#2d8659] hover:text-[#2d8659] transition-colors"
              >
                Owner Distribution
              </Link>
              {(user?.role === 'admin' || hasPayrollAccess) && (
                <Link
                  to="/payroll"
                  className="px-6 py-4 text-sm font-medium border-b-2 border-transparent hover:border-[#2d8659] hover:text-[#2d8659] transition-colors"
                >
                  Payroll
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}

      {/* Stores List (for Super Admin) */}
      {user?.role === 'super_admin' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold">All Stores</h2>
            <Link
              to="/stores/new"
              className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49] transition-colors"
            >
              + Add Store
            </Link>
          </div>
          <div className="p-6">
            {stores.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No stores found. Create your first store to get started.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stores.map((store) => (
                  <Link
                    key={store.id}
                    to={`/stores/${store.id}`}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <h3 className="font-semibold text-lg mb-2">{store.name}</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>
                        <span className="font-medium">Type:</span> {store.store_type || 'N/A'}
                      </p>
                      {store.city && store.state && (
                        <p>
                          <span className="font-medium">Location:</span> {store.city}, {store.state}
                        </p>
                      )}
                      <p>
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs ${
                            store.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {store.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Stats for Admin/Manager */}
      {selectedStore && (user?.role === 'admin' || user?.role === 'manager') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Store Information</h3>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium text-gray-600">Store Name:</span> {selectedStore.name}</p>
              <p><span className="font-medium text-gray-600">Type:</span> {selectedStore.store_type || 'N/A'}</p>
              {selectedStore.address && (
                <p><span className="font-medium text-gray-600">Address:</span> {selectedStore.address}</p>
              )}
              {selectedStore.city && selectedStore.state && (
                <p><span className="font-medium text-gray-600">Location:</span> {selectedStore.city}, {selectedStore.state}</p>
              )}
              {selectedStore.phone && (
                <p><span className="font-medium text-gray-600">Phone:</span> {selectedStore.phone}</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <div className="space-y-2">
              <Link
                to={`/stores/${selectedStore.id}/revenue`}
                className="block px-4 py-2 bg-[#2d8659] text-white rounded hover:bg-[#256b49] transition-colors text-center"
              >
                View & Edit Revenue Data
              </Link>
              {(user?.role === 'admin') && (
                <Link
                  to={`/stores/${selectedStore.id}/integrations`}
                  className="block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-center"
                >
                  Configure Integrations
                </Link>
              )}
              <Link
                to="/lottery"
                className="block px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-center"
              >
                Manage Lottery
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Add Invoice Modal */}
      {showAddInvoiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Add Invoice</h2>
              <button
                onClick={() => {
                  setShowAddInvoiceModal(false);
                  setInvoiceForm({
                    invoice_number: '',
                    purchase_date: new Date().toISOString().split('T')[0],
                    vendor_id: '',
                    amount: '',
                    payment_option: 'cash',
                    due_days: '',
                    notes: '',
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateInvoice}>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bill Date *</label>
                    <input
                      type="date"
                      value={invoiceForm.purchase_date}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, purchase_date: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Vendor</label>
                    <select
                      value={invoiceForm.vendor_id}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, vendor_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    >
                      <option value="">Select Vendor</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Purchase Type *</label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input type="radio" name="payment_option" value="cash" checked={invoiceForm.payment_option === 'cash'} onChange={(e) => setInvoiceForm({ ...invoiceForm, payment_option: e.target.value, due_days: '', invoice_number: '' })} className="mr-2" required />
                        <span className="text-sm text-gray-700">Cash</span>
                      </label>
                      <label className="flex items-center">
                        <input type="radio" name="payment_option" value="invoice" checked={invoiceForm.payment_option === 'invoice'} onChange={(e) => setInvoiceForm({ ...invoiceForm, payment_option: e.target.value })} className="mr-2" required />
                        <span className="text-sm text-gray-700">Invoice</span>
                      </label>
                      <label className="flex items-center">
                        <input type="radio" name="payment_option" value="credit_memo" checked={invoiceForm.payment_option === 'credit_memo'} onChange={(e) => setInvoiceForm({ ...invoiceForm, payment_option: e.target.value, due_days: '' })} className="mr-2" required />
                        <span className="text-sm text-gray-700">Credit Memo</span>
                      </label>
                    </div>
                  </div>
                  {invoiceForm.payment_option === 'invoice' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Due Days</label>
                      <select value={invoiceForm.due_days} onChange={(e) => setInvoiceForm({ ...invoiceForm, due_days: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]">
                        <option value="">Select Due Days</option>
                        <option value="7">7 days</option>
                        <option value="15">15 days</option>
                        <option value="30">30 days</option>
                        <option value="45">45 days</option>
                        <option value="60">60 days</option>
                        <option value="90">90 days</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {(invoiceForm.payment_option === 'invoice' || invoiceForm.payment_option === 'credit_memo') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Number *</label>
                      <input type="text" value={invoiceForm.invoice_number} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })} placeholder={invoiceForm.payment_option === 'credit_memo' ? 'Credit Memo Number' : 'Invoice Number'} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]" required />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
                    <input type="number" step="0.01" min="0" value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                    <textarea value={invoiceForm.notes} onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} rows="4" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <button type="button" onClick={() => { setShowAddInvoiceModal(false); setInvoiceForm({ invoice_number: '', purchase_date: new Date().toISOString().split('T')[0], vendor_id: '', amount: '', payment_option: 'cash', due_days: '', notes: '' }); }} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 mr-3">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49]">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Bill Modal */}
      {showPayBillModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Make Payment</h2>
              <button onClick={() => { setShowPayBillModal(false); setSelectedInvoiceIds([]); setPaymentForm({ payment_date: new Date().toISOString().split('T')[0], payment_method: 'cash', check_number: '', split_payments: [] }); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Select Invoices to Pay</h3>
                  <div className="flex items-center gap-4">
                    <button onClick={handleSelectAll} className="text-sm text-blue-600 hover:text-blue-800">{selectedInvoiceIds.length === unpaidInvoices.length ? 'Deselect All' : 'Select All'}</button>
                    {selectedInvoiceIds.length > 0 && <span className="text-sm font-medium text-gray-700">Total: ${calculateSelectedTotal().toFixed(2)}</span>}
                  </div>
                </div>
                {unpaidInvoices.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg"><p className="text-gray-500">No unpaid invoices found.</p></div>
                ) : (
                  <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"><input type="checkbox" checked={selectedInvoiceIds.length === unpaidInvoices.length && unpaidInvoices.length > 0} onChange={handleSelectAll} className="rounded" /></th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {unpaidInvoices.map((invoice) => (
                          <tr key={invoice.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3"><input type="checkbox" checked={selectedInvoiceIds.includes(invoice.id)} onChange={() => handleToggleInvoice(invoice.id)} className="rounded" /></td>
                            <td className="px-4 py-3 text-sm text-gray-900">{invoice.purchase_date ? new Date(invoice.purchase_date).toLocaleDateString() : '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{invoice.vendor_name || invoice.vendor_name_full || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{invoice.invoice_number || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">${parseFloat(invoice.amount || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              {selectedInvoiceIds.length > 0 && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Payment Date *</label>
                      <input type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]" required />
                    </div>
                    <div>
                      <label className="flex items-center">
                        <input type="checkbox" checked={paymentForm.split_payments.length > 0} onChange={(e) => { if (e.target.checked) { setPaymentForm({ ...paymentForm, split_payments: [{ payment_method: 'cash', amount: calculateSelectedTotal().toFixed(2), check_number: '' }] }); } else { setPaymentForm({ ...paymentForm, split_payments: [], payment_method: 'cash', check_number: '' }); } }} className="mr-2 rounded" />
                        <span className="text-sm font-medium text-gray-700">Split Payment (Multiple Payment Methods)</span>
                      </label>
                    </div>
                    {paymentForm.split_payments.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-600">Total Amount: <strong>${calculateSelectedTotal().toFixed(2)}</strong></p>
                        {paymentForm.split_payments.map((split, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-medium text-gray-700">Payment {index + 1}</span>
                              {paymentForm.split_payments.length > 1 && <button onClick={() => handleRemoveSplitPayment(index)} className="text-red-600 hover:text-red-800 text-sm">Remove</button>}
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Payment Type *</label>
                                <select value={split.payment_method} onChange={(e) => handleUpdateSplitPayment(index, 'payment_method', e.target.value)} className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659]" required>
                                  <option value="cash">Cash</option>
                                  <option value="check">Check</option>
                                  <option value="card">Card</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Amount *</label>
                                <input type="number" step="0.01" min="0" value={split.amount} onChange={(e) => handleUpdateSplitPayment(index, 'amount', e.target.value)} className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659]" required />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">{split.payment_method === 'check' ? 'Check # *' : 'Check #'}</label>
                                <input type="text" value={split.check_number} onChange={(e) => handleUpdateSplitPayment(index, 'check_number', e.target.value)} className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659]" required={split.payment_method === 'check'} disabled={split.payment_method !== 'check'} />
                              </div>
                            </div>
                          </div>
                        ))}
                        <button onClick={handleAddSplitPayment} className="text-sm text-blue-600 hover:text-blue-800">+ Add Another Payment</button>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-blue-800"><strong>Split Total:</strong> ${calculateSplitTotal().toFixed(2)} / <strong>Invoice Total:</strong> ${calculateSelectedTotal().toFixed(2)}</p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
                          <select value={paymentForm.payment_method} onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value, check_number: '' })} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]" required>
                            <option value="cash">Cash</option>
                            <option value="check">Check</option>
                            <option value="card">Card</option>
                          </select>
                        </div>
                        {paymentForm.payment_method === 'check' && (
                          <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Check Number *</label>
                            <input type="text" value={paymentForm.check_number} onChange={(e) => setPaymentForm({ ...paymentForm, check_number: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]" required />
                          </div>
                        )}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                          <p className="text-sm text-blue-800"><strong>Total Amount:</strong> ${calculateSelectedTotal().toFixed(2)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button onClick={() => { setShowPayBillModal(false); setSelectedInvoiceIds([]); setPaymentForm({ payment_date: new Date().toISOString().split('T')[0], payment_method: 'cash', check_number: '', split_payments: [] }); }} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                <button onClick={handleRecordPayment} disabled={selectedInvoiceIds.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">Record Payment</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Card for Admins - Moved to Bottom */}
      {subscription && (user?.role === 'admin' || user?.role === 'manager') && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg shadow-lg p-6 mt-6 border-l-4 border-blue-600">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {subscription.template_name || 'Active Subscription'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {subscription.auto_renew ? (
                      <span className="text-green-600 font-medium">✓ Auto-Renew Enabled</span>
                    ) : (
                      <span className="text-yellow-600">Manual Renewal</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div>
                  <p className="text-xs text-gray-600">Monthly Cost</p>
                  <p className="text-lg font-bold text-blue-600">
                    ${parseFloat(subscription.total_monthly_price || 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Next Billing</p>
                  <p className="text-sm font-medium text-gray-900">
                    {subscription.next_billing_date 
                      ? new Date(subscription.next_billing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Features</p>
                  <p className="text-sm font-medium text-gray-900">
                    {subscription.template_feature_keys?.length || subscription.features?.filter(f => !f.is_addon).length || 0} included
                    {subscription.addon_feature_keys?.length > 0 && ` + ${subscription.addon_feature_keys.length} addons`}
                  </p>
                </div>
              </div>
              {/* Display Feature List */}
              {subscription.features && subscription.features.length > 0 && (
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <p className="text-xs font-medium text-gray-700 mb-2">Included Features:</p>
                  <div className="flex flex-wrap gap-2">
                    {subscription.features.slice(0, 8).map((feature, idx) => (
                      <span
                        key={feature.id || feature.feature_key || idx}
                        className="px-2 py-1 bg-blue-200 text-blue-900 text-xs rounded font-medium"
                      >
                        {feature.feature_name || feature.feature_key?.replace(/_/g, ' ') || 'Unknown Feature'}
                      </span>
                    ))}
                    {subscription.features.length > 8 && (
                      <span className="px-2 py-1 bg-blue-200 text-blue-900 text-xs rounded font-medium">
                        +{subscription.features.length - 8} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="ml-4">
              <Link
                to="/settings"
                onClick={() => {
                  // Set active tab to subscription details in Settings
                  const event = new CustomEvent('setSettingsTab', { detail: 'subscription-details' });
                  window.dispatchEvent(event);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                View Details
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
