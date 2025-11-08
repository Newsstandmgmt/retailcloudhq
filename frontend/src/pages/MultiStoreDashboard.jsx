import { useState, useEffect } from 'react';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { purchaseInvoicesAPI, revenueAPI, lotteryAPI } from '../services/api';
import { CurrencyDollarIcon, ClipboardIcon, DocumentIcon } from '../components/Icons';

const MultiStoreDashboard = () => {
  const { stores, selectedStore } = useStore();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState('overview'); // overview, invoices, revenue, etc.
  
  // Aggregated stats
  const [stats, setStats] = useState({
    totalMonthlySales: 0,
    totalLotteryDue: 0,
    totalInvoicesPending: 0,
    totalInvoicesPendingAmount: 0,
  });

  // Invoice data grouped by vendor
  const [invoiceData, setInvoiceData] = useState({
    byVendor: [], // { vendorName, totalPending, totalAmount, stores: [] }
    byStore: [], // { storeName, totalPending, totalAmount }
  });

  // Add Invoice Modal State
  const [showAddInvoiceModal, setShowAddInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    store_id: '',
    invoice_number: '',
    purchase_date: new Date().toISOString().split('T')[0],
    vendor_id: '',
    amount: '',
    payment_option: 'cash',
    due_days: '',
    notes: '',
  });
  const [vendors, setVendors] = useState([]);
  const [vendorsByStore, setVendorsByStore] = useState({}); // storeId -> vendors array

  // Pay Bill Modal State
  const [showPayBillModal, setShowPayBillModal] = useState(false);
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [paymentForm, setPaymentForm] = useState({
    store_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    check_number: '',
    split_payments: []
  });

  // Filter active stores
  const activeStores = stores.filter(s => s.is_active !== false && !s.deleted_at);

  useEffect(() => {
    if (activeStores.length > 0) {
      loadAggregatedData();
    }
  }, [activeStores.length]);

  useEffect(() => {
    if (invoiceForm.store_id) {
      loadVendorsForStore(invoiceForm.store_id);
    }
  }, [invoiceForm.store_id]);

  useEffect(() => {
    if (showPayBillModal && paymentForm.store_id) {
      loadUnpaidInvoicesForStore(paymentForm.store_id);
    }
  }, [showPayBillModal, paymentForm.store_id]);

  const loadAggregatedData = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      // Load data from all stores
      const monthlySalesPromises = activeStores.map(store => 
        revenueAPI.getTotals(store.id, startOfMonth, endOfMonth).catch(() => ({ data: { totals: {} } }))
      );
      const lotteryPromises = activeStores.map(store => 
        lotteryAPI.getRange(store.id, startOfMonth, endOfMonth).catch(() => ({ data: { lotteries: [] } }))
      );
      const invoicePromises = activeStores.map(store => 
        purchaseInvoicesAPI.getAll(store.id, { status: 'pending' }).catch(() => ({ data: { invoices: [] } }))
      );

      const [monthlySalesResults, lotteryResults, invoiceResults] = await Promise.all([
        Promise.all(monthlySalesPromises),
        Promise.all(lotteryPromises),
        Promise.all(invoicePromises)
      ]);

      // Aggregate monthly sales
      let totalMonthlySales = 0;
      monthlySalesResults.forEach((result, index) => {
        if (result.data?.totals) {
          const totals = result.data.totals;
          const sales = parseFloat(totals.total_cash_sum || 0) + parseFloat(totals.business_credit_card_sum || 0);
          totalMonthlySales += sales;
        }
      });

      // Aggregate lottery due
      let totalLotteryDue = 0;
      lotteryResults.forEach((result) => {
        if (result.data?.lotteries) {
          const total = result.data.lotteries.reduce((sum, lot) => {
            return sum + parseFloat(lot.total_due || lot.pa_lottery_due || 0);
          }, 0);
          totalLotteryDue += total;
        }
      });

      // Aggregate invoices
      let totalInvoicesPending = 0;
      let totalInvoicesPendingAmount = 0;
      const vendorMap = new Map(); // vendorName -> { vendorName, totalPending, totalAmount, stores: [] }
      const storeMap = new Map(); // storeName -> { storeName, totalPending, totalAmount }

      invoiceResults.forEach((result, index) => {
        const store = activeStores[index];
        const invoices = result.data?.invoices || [];
        const storePending = invoices.length;
        const storeAmount = invoices.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);

        totalInvoicesPending += storePending;
        totalInvoicesPendingAmount += storeAmount;

        // Group by store
        storeMap.set(store.id, {
          storeId: store.id,
          storeName: store.name,
          totalPending: storePending,
          totalAmount: storeAmount,
        });

        // Group by vendor
        invoices.forEach(invoice => {
          const vendorName = invoice.vendor_name || invoice.vendor_name_full || 'Unknown Vendor';
          if (!vendorMap.has(vendorName)) {
            vendorMap.set(vendorName, {
              vendorName,
              totalPending: 0,
              totalAmount: 0,
              stores: new Map(), // storeId -> { storeName, count, amount }
            });
          }

          const vendorData = vendorMap.get(vendorName);
          vendorData.totalPending += 1;
          vendorData.totalAmount += parseFloat(invoice.amount || 0);

          if (!vendorData.stores.has(store.id)) {
            vendorData.stores.set(store.id, {
              storeName: store.name,
              count: 0,
              amount: 0,
            });
          }

          const storeData = vendorData.stores.get(store.id);
          storeData.count += 1;
          storeData.amount += parseFloat(invoice.amount || 0);
        });
      });

      // Convert maps to arrays
      const byVendor = Array.from(vendorMap.values()).map(vendor => ({
        ...vendor,
        stores: Array.from(vendor.stores.values()),
      })).sort((a, b) => b.totalAmount - a.totalAmount);

      const byStore = Array.from(storeMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);

      setStats({
        totalMonthlySales,
        totalLotteryDue,
        totalInvoicesPending,
        totalInvoicesPendingAmount,
      });

      setInvoiceData({ byVendor, byStore });
    } catch (error) {
      console.error('Error loading aggregated data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVendorsForStore = async (storeId) => {
    try {
      if (vendorsByStore[storeId]) {
        setVendors(vendorsByStore[storeId]);
        return;
      }
      const response = await purchaseInvoicesAPI.getVendors(storeId);
      const storeVendors = response.data.vendors || [];
      setVendors(storeVendors);
      setVendorsByStore({ ...vendorsByStore, [storeId]: storeVendors });
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const loadUnpaidInvoicesForStore = async (storeId) => {
    try {
      const response = await purchaseInvoicesAPI.getAll(storeId, { status: 'pending' });
      setUnpaidInvoices(response.data.invoices || []);
      setSelectedInvoiceIds([]);
    } catch (error) {
      console.error('Error loading unpaid invoices:', error);
      alert('Failed to load unpaid invoices.');
    }
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (!invoiceForm.store_id) {
      alert('Please select a store');
      return;
    }

    try {
      const invoiceData = {
        ...invoiceForm,
        invoice_number: (invoiceForm.payment_option === 'cash') ? undefined : invoiceForm.invoice_number
      };
      
      await purchaseInvoicesAPI.create(invoiceForm.store_id, invoiceData);
      alert('Invoice created successfully!');
      setShowAddInvoiceModal(false);
      setInvoiceForm({
        store_id: '',
        invoice_number: '',
        purchase_date: new Date().toISOString().split('T')[0],
        vendor_id: '',
        amount: '',
        payment_option: 'cash',
        due_days: '',
        notes: '',
      });
      loadAggregatedData();
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

  const handleRecordPayment = async () => {
    if (selectedInvoiceIds.length === 0) {
      alert('Please select at least one invoice to pay.');
      return;
    }

    if (!paymentForm.store_id) {
      alert('Please select a store');
      return;
    }

    const totalAmount = calculateSelectedTotal();
    
    if (!paymentForm.payment_method) {
      alert('Please select a payment method.');
      return;
    }
    if (paymentForm.payment_method === 'check' && !paymentForm.check_number) {
      alert('Please enter a check number for check payments.');
      return;
    }

    try {
      const paymentData = {
        invoice_ids: selectedInvoiceIds,
        payment_date: paymentForm.payment_date,
        payment_method: paymentForm.payment_method,
        check_number: paymentForm.check_number || null,
      };

      await purchaseInvoicesAPI.recordPayments(paymentForm.store_id, paymentData);
      alert('Payment recorded successfully!');
      setShowPayBillModal(false);
      setSelectedInvoiceIds([]);
      setPaymentForm({
        store_id: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        check_number: '',
        split_payments: []
      });
      loadAggregatedData();
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

  return (
    <div>
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Multi Store Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Viewing aggregated data from {activeStores.length} store{activeStores.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Monthly Sales</p>
              <p className="text-3xl font-bold text-gray-900">
                ${stats.totalMonthlySales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CurrencyDollarIcon className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

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

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Invoices Pending</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.totalInvoicesPending}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <DocumentIcon className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Amount Pending</p>
              <p className="text-3xl font-bold text-gray-900">
                ${stats.totalInvoicesPendingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <DocumentIcon className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setSelectedView('overview')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                selectedView === 'overview'
                  ? 'border-[#2d8659] text-[#2d8659]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setSelectedView('invoices')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                selectedView === 'invoices'
                  ? 'border-[#2d8659] text-[#2d8659]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Invoices by Vendor
            </button>
            <button
              onClick={() => setSelectedView('stores')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                selectedView === 'stores'
                  ? 'border-[#2d8659] text-[#2d8659]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Invoices by Store
            </button>
          </nav>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {/* Quick Actions */}
          <div className="mb-6 flex gap-4">
            <button
              onClick={() => setShowAddInvoiceModal(true)}
              className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49] transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Bill / Invoice
            </button>
            <button
              onClick={() => setShowPayBillModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Pay Bill / Invoice
            </button>
          </div>

          {selectedView === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Stores</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeStores.map((store) => (
                    <div key={store.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <h4 className="font-semibold text-lg mb-2">{store.name}</h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        {store.city && store.state && (
                          <p><span className="font-medium">Location:</span> {store.city}, {store.state}</p>
                        )}
                        <p>
                          <span className="font-medium">Status:</span>{' '}
                          <span className={`inline-block px-2 py-1 rounded text-xs ${
                            store.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {store.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selectedView === 'invoices' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Invoices by Vendor (All Stores)</h3>
              {invoiceData.byVendor.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No pending invoices found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Invoices</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stores</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {invoiceData.byVendor.map((vendor, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{vendor.vendorName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{vendor.totalPending}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                            ${vendor.totalAmount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="space-y-1">
                              {vendor.stores.map((store, idx) => (
                                <div key={idx} className="text-xs">
                                  <span className="font-medium">{store.storeName}:</span> {store.count} invoice{store.count !== 1 ? 's' : ''} (${store.amount.toFixed(2)})
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {selectedView === 'stores' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Invoices by Store</h3>
              {invoiceData.byStore.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No pending invoices found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Invoices</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {invoiceData.byStore.map((store, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{store.storeName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{store.totalPending}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                            ${store.totalAmount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Invoice Modal */}
      {showAddInvoiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Add Invoice</h2>
              <button onClick={() => { setShowAddInvoiceModal(false); setInvoiceForm({ store_id: '', invoice_number: '', purchase_date: new Date().toISOString().split('T')[0], vendor_id: '', amount: '', payment_option: 'cash', due_days: '', notes: '' }); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateInvoice}>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Store *</label>
                    <select value={invoiceForm.store_id} onChange={(e) => setInvoiceForm({ ...invoiceForm, store_id: e.target.value, vendor_id: '' })} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]" required>
                      <option value="">Select Store</option>
                      {activeStores.map((store) => (
                        <option key={store.id} value={store.id}>{store.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bill Date *</label>
                    <input type="date" value={invoiceForm.purchase_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, purchase_date: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Vendor</label>
                    <select value={invoiceForm.vendor_id} onChange={(e) => setInvoiceForm({ ...invoiceForm, vendor_id: e.target.value })} disabled={!invoiceForm.store_id} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] disabled:bg-gray-100">
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
                <button type="button" onClick={() => { setShowAddInvoiceModal(false); setInvoiceForm({ store_id: '', invoice_number: '', purchase_date: new Date().toISOString().split('T')[0], vendor_id: '', amount: '', payment_option: 'cash', due_days: '', notes: '' }); }} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 mr-3">Cancel</button>
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
              <button onClick={() => { setShowPayBillModal(false); setSelectedInvoiceIds([]); setPaymentForm({ store_id: '', payment_date: new Date().toISOString().split('T')[0], payment_method: 'cash', check_number: '', split_payments: [] }); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Store *</label>
                <select value={paymentForm.store_id} onChange={(e) => { setPaymentForm({ ...paymentForm, store_id: e.target.value }); setSelectedInvoiceIds([]); }} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]" required>
                  <option value="">Select Store</option>
                  {activeStores.map((store) => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </select>
              </div>
              {paymentForm.store_id && (
                <>
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
                          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
                          <select value={paymentForm.payment_method} onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value, check_number: '' })} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]" required>
                            <option value="cash">Cash</option>
                            <option value="check">Check</option>
                            <option value="card">Card</option>
                          </select>
                        </div>
                        {paymentForm.payment_method === 'check' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Check Number *</label>
                            <input type="text" value={paymentForm.check_number} onChange={(e) => setPaymentForm({ ...paymentForm, check_number: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]" required />
                          </div>
                        )}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-blue-800"><strong>Total Amount:</strong> ${calculateSelectedTotal().toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button onClick={() => { setShowPayBillModal(false); setSelectedInvoiceIds([]); setPaymentForm({ store_id: '', payment_date: new Date().toISOString().split('T')[0], payment_method: 'cash', check_number: '', split_payments: [] }); }} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                <button onClick={handleRecordPayment} disabled={selectedInvoiceIds.length === 0 || !paymentForm.store_id} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">Record Payment</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiStoreDashboard;

