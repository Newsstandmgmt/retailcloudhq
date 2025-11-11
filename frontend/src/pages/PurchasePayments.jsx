import { useState, useEffect } from 'react';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { purchaseInvoicesAPI, banksAPI, creditCardsAPI, productsAPI, inventoryOrdersAPI, crossStorePaymentsAPI } from '../services/api';

const PurchasePayments = () => {
  const { selectedStore, stores } = useStore();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddInvoiceModal, setShowAddInvoiceModal] = useState(false);
  const [showMakePaymentModal, setShowMakePaymentModal] = useState(false);
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    check_number: '',
    credit_card_id: '',
    split_payments: []
  });
  const [vendors, setVendors] = useState([]);
  const [banks, setBanks] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [crossStorePayments, setCrossStorePayments] = useState([]);
  const [crossStoreLoading, setCrossStoreLoading] = useState(false);
  const [crossStoreError, setCrossStoreError] = useState('');
  const [showCrossStoreModal, setShowCrossStoreModal] = useState(false);
  const [crossStoreSubmitting, setCrossStoreSubmitting] = useState(false);
  const [updatingAllocationId, setUpdatingAllocationId] = useState(null);
  const [crossStoreForm, setCrossStoreForm] = useState({
    source_store_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank',
    payment_reference: '',
    paid_to: '',
    amount: '',
    notes: '',
    allocations: [],
  });
  const crossStorePaymentMethods = [
    { value: 'bank', label: 'Bank Transfer' },
    { value: 'card', label: 'Store Credit Card' },
    { value: 'check', label: 'Check' },
    { value: 'cash', label: 'Cash' },
    { value: 'ach', label: 'ACH' },
    { value: 'other', label: 'Other' },
  ];
  
  // Invoice form state
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_number: '',
    purchase_date: new Date().toISOString().split('T')[0],
    vendor_id: '',
    amount: '',
    payment_option: 'cash',
    due_days: '',
    notes: '',
    paid_on_purchase: false,
    payment_method_on_purchase: 'cash',
    bank_id_on_purchase: '',
    bank_account_name_on_purchase: '',
    credit_card_id_on_purchase: '',
    is_reimbursable: false,
    reimbursement_to: '',
    reimbursement_status: 'pending',
    reimbursement_payment_method: 'cash',
    reimbursement_check_number: '',
    expected_revenue: '',
    revenue_calculation_method: 'none', // 'none', 'manual', 'product_selection', 'auto_calculate'
    invoice_items: [], // Array of { product_id, quantity }
  });
  
  // Products for revenue calculation
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]); // For product selection
  const [calculatingRevenue, setCalculatingRevenue] = useState(false);

  // Pending inventory order items for revenue calculation
  const [pendingOrderItems, setPendingOrderItems] = useState([]);
  const [pendingItemsLoading, setPendingItemsLoading] = useState(false);
  const [pendingItemsError, setPendingItemsError] = useState('');
  const [includeAllPendingItems, setIncludeAllPendingItems] = useState(false);
  const [pendingDeliveryQuantities, setPendingDeliveryQuantities] = useState({});
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [editForm, setEditForm] = useState({});
  
  // Payment details modal state
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);
  const [selectedPaymentInvoice, setSelectedPaymentInvoice] = useState(null);
  
  // Reimbursement modal state
  const [showReimburseModal, setShowReimburseModal] = useState(false);
  const [selectedReimburseInvoice, setSelectedReimburseInvoice] = useState(null);
  const [reimburseForm, setReimburseForm] = useState({
    reimbursement_date: new Date().toISOString().split('T')[0],
    reimbursement_amount: '',
    reimbursement_payment_method: 'cash',
    reimbursement_check_number: '',
    reimbursement_bank_id: '',
  });
  
  // Revenue Calculation modal state
  const [showRevenueCalculationModal, setShowRevenueCalculationModal] = useState(false);
  const [calculatedInvoiceAmount, setCalculatedInvoiceAmount] = useState(null); // Track if amount was calculated or manually entered
  
  // Filter states
  const [filters, setFilters] = useState({
    period: 'This Month',
    vendor: '',
    filterType: '',
    dateRange: { start: '', end: '' }
  });
  const [entriesPerPage, setEntriesPerPage] = useState(100);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (selectedStore) {
      loadInvoices();
      loadVendors();
      loadBanks();
      loadCreditCards();
      loadProducts();
      loadCrossStorePayments(selectedStore.id);
      setCrossStoreForm((prev) => ({
        ...prev,
        source_store_id: selectedStore.id,
      }));
    }
  }, [selectedStore]);
  
  useEffect(() => {
    if (showAddInvoiceModal && selectedStore) {
      loadProducts();
    }
  }, [showAddInvoiceModal, selectedStore]);

  useEffect(() => {
    if (showMakePaymentModal && selectedStore) {
      loadUnpaidInvoices();
    }
  }, [showMakePaymentModal, selectedStore]);

  useEffect(() => {
    if (selectedStore) {
      loadInvoices();
    }
  }, [filters, entriesPerPage, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.period, filters.vendor, filters.filterType, filters.dateRange.start, filters.dateRange.end]);

  useEffect(() => {
    if (showRevenueCalculationModal && selectedStore) {
      loadPendingOrderItems();
    }
  }, [showRevenueCalculationModal, selectedStore]);

  useEffect(() => {
    if (showRevenueCalculationModal && selectedStore) {
      loadPendingOrderItems();
    }
  }, [invoiceForm.vendor_id, includeAllPendingItems]);

  const getDateRangeForPeriod = (period, customDateRange = null) => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    const startOfQuarter = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
    const endOfQuarter = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 + 3, 0);
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const endOfYear = new Date(today.getFullYear(), 11, 31);

    switch (period) {
      case 'This Month':
        return {
          start_date: startOfMonth.toISOString().split('T')[0],
          end_date: endOfMonth.toISOString().split('T')[0]
        };
      case 'Last Month':
        return {
          start_date: startOfLastMonth.toISOString().split('T')[0],
          end_date: endOfLastMonth.toISOString().split('T')[0]
        };
      case 'This Quarter':
        return {
          start_date: startOfQuarter.toISOString().split('T')[0],
          end_date: endOfQuarter.toISOString().split('T')[0]
        };
      case 'This Year':
        return {
          start_date: startOfYear.toISOString().split('T')[0],
          end_date: endOfYear.toISOString().split('T')[0]
        };
      case 'Custom Range':
        return {
          start_date: customDateRange?.start || null,
          end_date: customDateRange?.end || null
        };
      default:
        return {};
    }
  };

  const loadInvoices = async () => {
    if (!selectedStore) return;
    try {
      setLoading(true);
      
      // Transform filters for API
      const apiFilters = {};
      
      // Convert period to date range
      if (filters.period) {
        const dateRange = getDateRangeForPeriod(filters.period, filters.dateRange);
        if (dateRange.start_date) apiFilters.start_date = dateRange.start_date;
        if (dateRange.end_date) apiFilters.end_date = dateRange.end_date;
      }
      
      // Convert filterType to status
      if (filters.filterType) {
        if (filters.filterType === 'unpaid') {
          apiFilters.status = 'pending';
        } else {
          apiFilters.status = filters.filterType;
        }
      }
      
      // Add vendor filter
      if (filters.vendor) {
        apiFilters.vendor_id = filters.vendor;
      }
      
      const response = await purchaseInvoicesAPI.getAll(selectedStore.id, apiFilters);
      setInvoices(response.data.invoices || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  // Transform invoices to include payment records
  const getDisplayRecords = () => {
    const records = [];
    
    invoices.forEach(invoice => {
      // Add invoice record
      records.push({
        ...invoice,
        recordType: 'invoice'
      });
      
      // If invoice has payment_date, add a payment record
      if (invoice.payment_date && invoice.status === 'paid') {
        records.push({
          ...invoice,
          recordType: 'payment',
          id: `payment-${invoice.id}` // Unique ID for payment record
        });
      }
    });
    
    // Sort by date (purchase_date or payment_date) descending
    return records.sort((a, b) => {
      const dateA = a.recordType === 'payment' ? a.payment_date : a.purchase_date;
      const dateB = b.recordType === 'payment' ? b.payment_date : b.purchase_date;
      return new Date(dateB) - new Date(dateA);
    });
  };

  const handleEditInvoice = (invoice) => {
    setEditingInvoice(invoice);
    setEditForm({
      invoice_number: invoice.invoice_number || '',
      purchase_date: invoice.purchase_date || new Date().toISOString().split('T')[0],
      vendor_id: invoice.vendor_id || '',
      amount: invoice.amount || '',
      payment_option: invoice.payment_option || 'cash',
      due_days: invoice.due_days || '',
      notes: invoice.notes || '',
      paid_on_purchase: invoice.paid_on_purchase || false,
      payment_method_on_purchase: invoice.payment_method_on_purchase || 'cash',
      bank_id_on_purchase: invoice.bank_id_on_purchase || '',
      bank_account_name_on_purchase: invoice.bank_account_name_on_purchase || '',
      credit_card_id_on_purchase: invoice.credit_card_id_on_purchase || '',
      is_reimbursable: invoice.is_reimbursable || false,
      reimbursement_to: invoice.reimbursement_to || '',
      reimbursement_status: invoice.reimbursement_status || 'pending',
        reimbursement_payment_method: invoice.reimbursement_payment_method || 'cash',
        reimbursement_check_number: invoice.reimbursement_check_number || '',
        expected_revenue: invoice.expected_revenue || '',
        revenue_calculation_method: invoice.revenue_calculation_method || 'none',
        invoice_items: invoice.invoice_items || [],
      });
      setShowEditModal(true);
    };

  const handleUpdateInvoice = async (e) => {
    e.preventDefault();
    if (!editingInvoice) return;

    // Validate paid on purchase fields (only if NOT paid by third party)
    if (editForm.paid_on_purchase && !editForm.is_reimbursable && !editForm.payment_method_on_purchase) {
      alert('Please select a payment method when invoice is paid on purchase');
      return;
    }

    if (editForm.paid_on_purchase && !editForm.is_reimbursable && editForm.payment_method_on_purchase === 'bank' && !editForm.bank_id_on_purchase) {
      alert('Please select a bank account for bank payments');
      return;
    }

    if (editForm.paid_on_purchase && !editForm.is_reimbursable && editForm.payment_method_on_purchase === 'card' && !editForm.credit_card_id_on_purchase) {
      alert('Please select a credit card for card payments');
      return;
    }

    if (editForm.is_reimbursable && !editForm.reimbursement_to) {
      alert('Please enter person name when paid by third party');
      return;
    }

    // Validate reimbursement status fields if reimbursed
    if (editForm.is_reimbursable && editForm.reimbursement_status === 'reimbursed' && !editForm.reimbursement_payment_method) {
      alert('Please select a reimbursement payment method when status is reimbursed');
      return;
    }

    try {
      // Prepare invoice data - don't send invoice_number for cash payments
      const invoiceData = {
        ...editForm,
        invoice_number: (editForm.payment_option === 'cash') ? undefined : editForm.invoice_number,
        // Only send paid_on_purchase fields if checkbox is checked (and not paid by third party)
        paid_on_purchase: (editForm.paid_on_purchase || editForm.is_reimbursable) || false,
        payment_method_on_purchase: editForm.paid_on_purchase && !editForm.is_reimbursable ? editForm.payment_method_on_purchase : null,
        bank_id_on_purchase: editForm.paid_on_purchase && !editForm.is_reimbursable && editForm.payment_method_on_purchase === 'bank' ? editForm.bank_id_on_purchase : null,
        bank_account_name_on_purchase: editForm.paid_on_purchase && !editForm.is_reimbursable && editForm.payment_method_on_purchase === 'bank' ? editForm.bank_account_name_on_purchase : null,
        credit_card_id_on_purchase: editForm.paid_on_purchase && !editForm.is_reimbursable && editForm.payment_method_on_purchase === 'card' ? editForm.credit_card_id_on_purchase : null,
        is_reimbursable: editForm.is_reimbursable || false,
        reimbursement_to: editForm.is_reimbursable ? editForm.reimbursement_to : null,
        reimbursement_status: editForm.is_reimbursable ? (editForm.reimbursement_status || 'pending') : 'none',
        reimbursement_payment_method: editForm.is_reimbursable && editForm.reimbursement_status === 'reimbursed' ? editForm.reimbursement_payment_method : null,
        reimbursement_check_number: editForm.is_reimbursable && editForm.reimbursement_status === 'reimbursed' && editForm.reimbursement_payment_method === 'check' ? editForm.reimbursement_check_number : null,
      };
      
      await purchaseInvoicesAPI.update(editingInvoice.id, invoiceData);
      alert('Invoice updated successfully!');
      setShowEditModal(false);
      setEditingInvoice(null);
      loadInvoices();
    } catch (error) {
      alert('Error updating invoice: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteInvoice = async (invoiceId) => {
    if (!window.confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      return;
    }

    try {
      await purchaseInvoicesAPI.delete(invoiceId);
      alert('Invoice deleted successfully!');
      loadInvoices();
    } catch (error) {
      alert('Error deleting invoice: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleReimburseInvoice = (invoice) => {
    setSelectedReimburseInvoice(invoice);
    setReimburseForm({
      reimbursement_date: new Date().toISOString().split('T')[0],
      reimbursement_amount: invoice.amount || '',
      reimbursement_payment_method: 'cash',
      reimbursement_check_number: '',
      reimbursement_bank_id: '',
    });
    setShowReimburseModal(true);
  };

  const handleSubmitReimbursement = async (e) => {
    e.preventDefault();
    if (!selectedReimburseInvoice) return;

    // Validate form
    if (reimburseForm.reimbursement_payment_method === 'check' && !reimburseForm.reimbursement_check_number) {
      alert('Check number is required for check reimbursements');
      return;
    }

    if (reimburseForm.reimbursement_payment_method === 'bank' && !reimburseForm.reimbursement_bank_id) {
      alert('Bank account is required for bank reimbursements');
      return;
    }

    try {
      await purchaseInvoicesAPI.reimburse(selectedReimburseInvoice.id, reimburseForm);
      alert('Invoice marked as reimbursed successfully!');
      setShowReimburseModal(false);
      setSelectedReimburseInvoice(null);
      loadInvoices();
    } catch (error) {
      alert('Error marking invoice as reimbursed: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleViewPaymentDetails = (invoice) => {
    setSelectedPaymentInvoice(invoice);
    setShowPaymentDetailsModal(true);
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

  const loadBanks = async () => {
    if (!selectedStore) return;
    try {
      const response = await banksAPI.getAll(selectedStore.id);
      setBanks(response.data.banks || []);
    } catch (error) {
      console.error('Error loading banks:', error);
    }
  };

  const loadCreditCards = async () => {
    if (!selectedStore) return;
    try {
      const response = await creditCardsAPI.getAll(selectedStore.id);
      setCreditCards(response.data.credit_cards || []);
    } catch (error) {
      console.error('Error loading credit cards:', error);
    }
  };

  const loadProducts = async () => {
    if (!selectedStore) return;
    try {
      const response = await productsAPI.getAll(selectedStore.id, { is_active: true });
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadPendingOrderItems = async () => {
    if (!selectedStore) return;
    try {
      setPendingItemsLoading(true);
      setPendingItemsError('');
      const params = {};
      if (includeAllPendingItems) {
        params.includeAll = true;
      } else if (invoiceForm.vendor_id) {
        params.vendorId = invoiceForm.vendor_id;
      }
      const response = await inventoryOrdersAPI.getPendingItemsForInvoice(selectedStore.id, params);
      const items = response.data.items || [];
      setPendingOrderItems(items);
      const quantitiesMap = {};
      items.forEach(item => {
        quantitiesMap[item.order_item_id] = item.quantity_pending;
      });
      setPendingDeliveryQuantities(quantitiesMap);
    } catch (error) {
      console.error('Error loading pending order items:', error);
      setPendingItemsError(error.response?.data?.error || error.message || 'Failed to load pending orders');
      setPendingOrderItems([]);
      setPendingDeliveryQuantities({});
    } finally {
      setPendingItemsLoading(false);
    }
  };

  const loadCrossStorePayments = async (storeId) => {
    if (!storeId) return;
    try {
      setCrossStoreLoading(true);
      const response = await crossStorePaymentsAPI.list({
        store_id: storeId,
        role: 'all',
        limit: 100,
      });
      setCrossStorePayments(response.data.payments || []);
      setCrossStoreError('');
    } catch (error) {
      console.error('Error loading cross-store payments:', error);
      setCrossStoreError(error.response?.data?.error || 'Failed to load cross-store payments.');
    } finally {
      setCrossStoreLoading(false);
    }
  };

  const resetCrossStoreForm = (defaultSourceStoreId) => {
    const sourceId = defaultSourceStoreId || selectedStore?.id || '';
    const defaultTarget = stores.find((store) => store.id !== sourceId);
    setCrossStoreForm({
      source_store_id: sourceId,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'bank',
      payment_reference: '',
      paid_to: '',
      amount: '',
      notes: '',
      allocations: [
        {
          target_store_id: defaultTarget ? defaultTarget.id : '',
          allocated_amount: '',
          memo: '',
          target_type: 'manual',
          reimbursement_required: true,
          reimbursement_note: '',
        },
      ],
    });
  };

  const handleOpenCrossStoreModal = () => {
    resetCrossStoreForm(selectedStore?.id);
    setShowCrossStoreModal(true);
  };

  const handleCloseCrossStoreModal = () => {
    setShowCrossStoreModal(false);
    resetCrossStoreForm(selectedStore?.id);
  };

  const handleAddCrossStoreAllocation = () => {
    setCrossStoreForm((prev) => ({
      ...prev,
      allocations: [
        ...prev.allocations,
        {
          target_store_id: '',
          allocated_amount: '',
          memo: '',
          target_type: 'manual',
          reimbursement_required: true,
          reimbursement_note: '',
        },
      ],
    }));
  };

  const handleUpdateCrossStoreAllocation = (index, field, value) => {
    setCrossStoreForm((prev) => {
      const updated = [...prev.allocations];
      let newValue = value;
      if (field === 'reimbursement_required') {
        newValue = !!value;
      }
      updated[index] = {
        ...updated[index],
        [field]: newValue,
      };
      return {
        ...prev,
        allocations: updated,
      };
    });
  };

  const handleRemoveCrossStoreAllocation = (index) => {
    setCrossStoreForm((prev) => ({
      ...prev,
      allocations: prev.allocations.filter((_, allocIndex) => allocIndex !== index),
    }));
  };

  const crossStoreAllocatedTotal = crossStoreForm.allocations.reduce((sum, alloc) => {
    const rawValue = alloc.allocated_amount ?? alloc.amount ?? '';
    const amount = parseFloat(rawValue);
    if (!Number.isFinite(amount)) {
      return sum;
    }
    return sum + amount;
  }, 0);

  const handleSubmitCrossStorePayment = async (event) => {
    event.preventDefault();

    if (!crossStoreForm.source_store_id) {
      alert('Please select the source store for this payment.');
      return;
    }

    const totalPaymentAmount = parseFloat(crossStoreForm.amount);
    if (!Number.isFinite(totalPaymentAmount) || totalPaymentAmount <= 0) {
      alert('Please enter a valid total payment amount.');
      return;
    }

    if (!crossStoreForm.payment_method) {
      alert('Please select a payment method.');
      return;
    }

    if (!crossStoreForm.payment_date) {
      alert('Please select a payment date.');
      return;
    }

    if (!crossStoreForm.allocations.length) {
      alert('Add at least one store allocation.');
      return;
    }

    if (Math.abs(totalPaymentAmount - crossStoreAllocatedTotal) > 0.01) {
      alert('Allocated amounts must match the total payment amount.');
      return;
    }

    for (const allocation of crossStoreForm.allocations) {
      if (!allocation.target_store_id) {
        alert('Each allocation must have a target store selected.');
        return;
      }
      const allocationAmount = parseFloat(allocation.allocated_amount ?? allocation.amount);
      if (!Number.isFinite(allocationAmount) || allocationAmount <= 0) {
        alert('Each allocation must have a valid amount.');
        return;
      }
    }

    try {
      setCrossStoreSubmitting(true);
      await crossStorePaymentsAPI.create({
        source_store_id: crossStoreForm.source_store_id,
        payment_date: crossStoreForm.payment_date,
        payment_method: crossStoreForm.payment_method,
        payment_reference: crossStoreForm.payment_reference || null,
        amount: totalPaymentAmount,
        currency: 'USD',
        paid_to: crossStoreForm.paid_to || null,
        notes: crossStoreForm.notes || null,
        allocations: crossStoreForm.allocations.map((allocation) => ({
          target_store_id: allocation.target_store_id,
          amount: parseFloat(allocation.allocated_amount ?? allocation.amount),
          memo: allocation.memo || null,
          target_type: allocation.target_type || null,
          reimbursement_required: allocation.reimbursement_required !== false,
          reimbursement_note: allocation.reimbursement_note || null,
        })),
      });

      alert('Cross-store payment recorded successfully.');
      setShowCrossStoreModal(false);
      const refreshStoreId = crossStoreForm.source_store_id || selectedStore?.id;
      resetCrossStoreForm(refreshStoreId);
      if (refreshStoreId) {
        loadCrossStorePayments(refreshStoreId);
      }
    } catch (error) {
      console.error('Error creating cross-store payment:', error);
      alert(error.response?.data?.error || 'Failed to create cross-store payment.');
    } finally {
      setCrossStoreSubmitting(false);
    }
  };

  const handleUpdateAllocationStatus = async (allocationId, updates, successMessage = 'Reimbursement status updated.') => {
    if (!selectedStore) return;
    try {
      setUpdatingAllocationId(allocationId);
      await crossStorePaymentsAPI.updateAllocationReimbursement(allocationId, updates);
      await loadCrossStorePayments(selectedStore.id);
      alert(successMessage);
    } catch (error) {
      console.error('Error updating reimbursement status:', error);
      alert(error.response?.data?.error || 'Failed to update reimbursement status.');
    } finally {
      setUpdatingAllocationId(null);
    }
  };

  const formatCurrency = (value) => {
    const number = parseFloat(value);
    if (!Number.isFinite(number)) {
      return '$0.00';
    }
    return number.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handlePendingQuantityChange = (itemId, value) => {
    setPendingDeliveryQuantities(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  const handleAddPendingItemToInvoice = async (pendingItem) => {
    if (!selectedStore) return;
    const rawValue = pendingDeliveryQuantities[pendingItem.order_item_id];
    const quantity = parseFloat(rawValue);
    if (!quantity || quantity <= 0) {
      alert('Please enter a quantity greater than 0.');
      return;
    }
    if (quantity > pendingItem.quantity_pending) {
      alert('Delivered quantity cannot exceed pending quantity.');
      return;
    }

    try {
      const response = await inventoryOrdersAPI.markItemDelivered(pendingItem.order_item_id, {
        quantity_delivered: quantity,
        attach_to_invoice: true
      });
      const { item, delivered_quantity, remaining_quantity, invoice_item, product } = response.data;

      if (invoice_item) {
        setInvoiceForm(prev => {
          const existingIndex = prev.invoice_items.findIndex(i => i.product_id === invoice_item.product_id);
          let updatedItems;
          if (existingIndex >= 0) {
            updatedItems = [...prev.invoice_items];
            const existingItem = updatedItems[existingIndex];
            updatedItems[existingIndex] = {
              ...existingItem,
              quantity: (parseFloat(existingItem.quantity) || 0) + parseFloat(invoice_item.quantity || 0),
              unit_cost: parseFloat(invoice_item.unit_cost || existingItem.unit_cost || 0)
            };
          } else {
            updatedItems = [
              ...prev.invoice_items,
              {
                product_id: invoice_item.product_id,
                quantity: parseFloat(invoice_item.quantity || 0),
                unit_cost: parseFloat(invoice_item.unit_cost || 0),
                vape_tax_paid: invoice_item.vape_tax_paid || false
              }
            ];
          }
          return {
            ...prev,
            invoice_items: updatedItems,
            revenue_calculation_method: prev.revenue_calculation_method === 'none'
              ? 'product_selection'
              : prev.revenue_calculation_method
          };
        });

        // Ensure the product is available in the selection list
        if (product) {
          setProducts(prev => {
            if (prev.find(p => p.id === product.id)) {
              return prev;
            }
            return [
              ...prev,
              {
                id: product.id,
                full_product_name: product.full_product_name,
                product_name: product.full_product_name,
                variant: product.variant,
                quantity_per_pack: product.quantity_per_pack,
                cost_price: product.cost_price,
                sell_price_per_piece: product.sell_price_per_piece,
                supplier: product.supplier,
                profit_margin: product.profit_margin
              }
            ];
          });
        }

        setTimeout(() => {
          calculateInvoiceAmount(true);
          calculateExpectedRevenue();
        }, 200);
      }

      setPendingOrderItems(prev =>
        prev
          .map(orderItem =>
            orderItem.order_item_id === pendingItem.order_item_id
              ? {
                  ...orderItem,
                  quantity_delivered: (orderItem.quantity_delivered || 0) + (delivered_quantity || quantity),
                  quantity_pending: remaining_quantity
                }
              : orderItem
          )
          .filter(orderItem => orderItem.quantity_pending > 0)
      );

      setPendingDeliveryQuantities(prev => {
        const updated = { ...prev };
        if (remaining_quantity > 0) {
          updated[pendingItem.order_item_id] = remaining_quantity;
        } else {
          delete updated[pendingItem.order_item_id];
        }
        return updated;
      });

      alert('Order item delivered and added to cost calculation.');
    } catch (error) {
      console.error('Error delivering pending item:', error);
      alert(error.response?.data?.error || error.message || 'Failed to mark order item as delivered');
    }
  };

  const handleCloseRevenueModal = () => {
    setShowRevenueCalculationModal(false);
    setPendingOrderItems([]);
    setPendingDeliveryQuantities({});
    setPendingItemsError('');
  };

  // Calculate invoice amount (cost) from invoice_items
  const calculateInvoiceAmount = (force = false) => {
    // Use functional state update to get the latest invoice_items
    setInvoiceForm(prevForm => {
      if (prevForm.invoice_items.length === 0) {
        // Only update if amount was calculated (not manually entered)
        if (calculatedInvoiceAmount !== null) {
          setInvoiceForm(prev => ({ ...prev, amount: '' }));
          setCalculatedInvoiceAmount(null);
        }
        return prevForm;
      }

      // Calculate total cost: sum of (quantity * cost_price) for each item
      let totalCost = 0;
      prevForm.invoice_items.forEach(item => {
        const quantity = parseFloat(item.quantity) || 0;
        const costPrice = parseFloat(item.unit_cost || item.cost_price) || 0;
        totalCost += quantity * costPrice;
      });

      // Only update if amount was calculated (not manually entered) or if forced
      if (calculatedInvoiceAmount !== null || force) {
        setInvoiceForm(prev => ({ ...prev, amount: totalCost.toFixed(2) }));
        setCalculatedInvoiceAmount(totalCost);
      }
      
      return prevForm; // Return unchanged form, amount will be updated async
    });
  };

  const calculateExpectedRevenue = async () => {
    if (!selectedStore) {
      return;
    }

    // Calculate invoice amount first (only if it was previously calculated)
    if (calculatedInvoiceAmount !== null) {
      calculateInvoiceAmount();
    }

    // Use functional state update to get the latest invoice_items
    setInvoiceForm(prevForm => {
      if (prevForm.invoice_items.length === 0) {
        return { ...prevForm, expected_revenue: '' };
      }

      // Calculate revenue asynchronously with the latest items
      (async () => {
        try {
          setCalculatingRevenue(true);
          // Use the items from the closure (prevForm) to ensure we have the latest state
          const response = await productsAPI.calculateRevenue(selectedStore.id, prevForm.invoice_items);
          setInvoiceForm(prev => ({ ...prev, expected_revenue: response.data.expected_revenue || 0 }));
        } catch (error) {
          console.error('Error calculating revenue:', error);
          // Don't show alert on every calculation error, just log it
        } finally {
          setCalculatingRevenue(false);
        }
      })();
      
      return prevForm; // Return unchanged form, revenue will be updated async
    });
  };

  const handleAddProductToInvoice = (product) => {
    const existingItem = invoiceForm.invoice_items.find(item => item.product_id === product.id);
    if (existingItem) {
      // Update quantity
      const updatedItems = invoiceForm.invoice_items.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: (parseFloat(item.quantity) || 0) + 1 }
          : item
      );
      setInvoiceForm({ ...invoiceForm, invoice_items: updatedItems });
    } else {
      // Add new item with all required fields
      setInvoiceForm({
        ...invoiceForm,
        invoice_items: [...invoiceForm.invoice_items, { 
          product_id: product.id, 
          quantity: 1,
          unit_cost: product.cost_price || 0,
          vape_tax_paid: false
        }]
      });
    }
  };

  const handleRemoveProductFromInvoice = (productId) => {
    setInvoiceForm({
      ...invoiceForm,
      invoice_items: invoiceForm.invoice_items.filter(item => item.product_id !== productId)
    });
  };

  const handleUpdateProductQuantity = (productId, quantity) => {
    const updatedItems = invoiceForm.invoice_items.map(item =>
      item.product_id === productId
        ? { ...item, quantity: parseFloat(quantity) || 0 }
        : item
    );
    setInvoiceForm({ ...invoiceForm, invoice_items: updatedItems });
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

  const calculateSelectedTotal = () => {
    return unpaidInvoices
      .filter(inv => selectedInvoiceIds.includes(inv.id))
      .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
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

  const handleAddSplitPayment = () => {
    setPaymentForm({
      ...paymentForm,
      split_payments: [
        ...paymentForm.split_payments,
        { payment_method: 'cash', amount: '', check_number: '', credit_card_id: '' }
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
      if (paymentForm.payment_method === 'card' && !paymentForm.credit_card_id) {
        alert('Please select a credit card for card payments.');
        return;
      }
    }

    // Validate split payments
    if (paymentForm.split_payments && paymentForm.split_payments.length > 0) {
      for (const split of paymentForm.split_payments) {
        if (split.payment_method === 'card' && !split.credit_card_id) {
          alert(`Please select a credit card for payment method "Card" in split payment ${paymentForm.split_payments.indexOf(split) + 1}.`);
          return;
        }
        if (split.payment_method === 'check' && !split.check_number) {
          alert(`Please enter a check number for payment method "Check" in split payment ${paymentForm.split_payments.indexOf(split) + 1}.`);
          return;
        }
      }
    }

    try {
      // Prepare payment data
      const paymentData = {
        invoice_ids: selectedInvoiceIds,
        payment_date: paymentForm.payment_date,
        payment_method: paymentForm.payment_method,
        check_number: paymentForm.check_number || null,
        credit_card_id: paymentForm.credit_card_id || null,
        split_payments: paymentForm.split_payments.length > 0 ? paymentForm.split_payments.map(split => ({
          ...split,
          credit_card_id: split.payment_method === 'card' ? split.credit_card_id : null
        })) : null
      };

      await purchaseInvoicesAPI.recordPayments(selectedStore.id, paymentData);
      alert('Payment recorded successfully!');
      setShowMakePaymentModal(false);
      setSelectedInvoiceIds([]);
      setPaymentForm({
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        check_number: '',
        split_payments: []
      });
      loadInvoices();
    } catch (error) {
      alert('Error recording payment: ' + (error.response?.data?.error || error.message));
    }
  };



  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (!selectedStore) {
      alert('Please select a store');
      return;
    }

    // Validate paid on purchase fields (only if NOT paid by third party)
    if (invoiceForm.paid_on_purchase && !invoiceForm.is_reimbursable && !invoiceForm.payment_method_on_purchase) {
      alert('Please select a payment method when invoice is paid on purchase');
      return;
    }

    if (invoiceForm.paid_on_purchase && !invoiceForm.is_reimbursable && invoiceForm.payment_method_on_purchase === 'bank' && !invoiceForm.bank_id_on_purchase) {
      alert('Please select a bank account for bank payments');
      return;
    }

    if (invoiceForm.paid_on_purchase && !invoiceForm.is_reimbursable && invoiceForm.payment_method_on_purchase === 'card' && !invoiceForm.credit_card_id_on_purchase) {
      alert('Please select a credit card for card payments');
      return;
    }

    if (invoiceForm.is_reimbursable && !invoiceForm.reimbursement_to) {
      alert('Please enter person name when paid by third party');
      return;
    }

    // Validate reimbursement status fields if reimbursed
    if (invoiceForm.is_reimbursable && invoiceForm.reimbursement_status === 'reimbursed' && !invoiceForm.reimbursement_payment_method) {
      alert('Please select a reimbursement payment method when status is reimbursed');
      return;
    }

    try {
      // Calculate revenue if using product selection or auto-calculate
      let finalExpectedRevenue = invoiceForm.expected_revenue ? parseFloat(invoiceForm.expected_revenue) : null;
      let finalInvoiceItems = invoiceForm.invoice_items || [];
      
      if (invoiceForm.revenue_calculation_method === 'product_selection' || invoiceForm.revenue_calculation_method === 'auto_calculate') {
        if (invoiceForm.invoice_items && invoiceForm.invoice_items.length > 0) {
          try {
            const response = await productsAPI.calculateRevenue(selectedStore.id, invoiceForm.invoice_items);
            finalExpectedRevenue = response.data.expected_revenue || 0;
          } catch (calcError) {
            console.error('Error calculating revenue:', calcError);
            // Continue with manual value if calculation fails
          }
        }
      } else if (invoiceForm.revenue_calculation_method === 'manual') {
        finalExpectedRevenue = invoiceForm.expected_revenue ? parseFloat(invoiceForm.expected_revenue) : null;
        finalInvoiceItems = [];
      } else {
        finalExpectedRevenue = null;
        finalInvoiceItems = [];
      }

      // Prepare invoice data - don't send invoice_number for cash payments
      const invoiceData = {
        ...invoiceForm,
        invoice_number: (invoiceForm.payment_option === 'cash') ? undefined : invoiceForm.invoice_number,
        // Only send paid_on_purchase fields if checkbox is checked (and not paid by third party)
        paid_on_purchase: (invoiceForm.paid_on_purchase || invoiceForm.is_reimbursable) || false,
        payment_method_on_purchase: invoiceForm.paid_on_purchase && !invoiceForm.is_reimbursable ? invoiceForm.payment_method_on_purchase : null,
        bank_id_on_purchase: invoiceForm.paid_on_purchase && !invoiceForm.is_reimbursable && invoiceForm.payment_method_on_purchase === 'bank' ? invoiceForm.bank_id_on_purchase : null,
        bank_account_name_on_purchase: invoiceForm.paid_on_purchase && !invoiceForm.is_reimbursable && invoiceForm.payment_method_on_purchase === 'bank' ? invoiceForm.bank_account_name_on_purchase : null,
        credit_card_id_on_purchase: invoiceForm.paid_on_purchase && !invoiceForm.is_reimbursable && invoiceForm.payment_method_on_purchase === 'card' ? invoiceForm.credit_card_id_on_purchase : null,
        is_reimbursable: invoiceForm.is_reimbursable || false,
        reimbursement_to: invoiceForm.is_reimbursable ? invoiceForm.reimbursement_to : null,
        reimbursement_status: invoiceForm.is_reimbursable ? (invoiceForm.reimbursement_status || 'pending') : 'none',
        reimbursement_payment_method: invoiceForm.is_reimbursable && invoiceForm.reimbursement_status === 'reimbursed' ? invoiceForm.reimbursement_payment_method : null,
        reimbursement_check_number: invoiceForm.is_reimbursable && invoiceForm.reimbursement_status === 'reimbursed' && invoiceForm.reimbursement_payment_method === 'check' ? invoiceForm.reimbursement_check_number : null,
        expected_revenue: finalExpectedRevenue,
        revenue_calculation_method: invoiceForm.revenue_calculation_method !== 'none' ? invoiceForm.revenue_calculation_method : null,
        invoice_items: finalInvoiceItems.length > 0 ? finalInvoiceItems : null,
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
        paid_on_purchase: false,
        payment_method_on_purchase: 'cash',
        bank_id_on_purchase: '',
        bank_account_name_on_purchase: '',
        credit_card_id_on_purchase: '',
        is_reimbursable: false,
        reimbursement_to: '',
        reimbursement_status: 'pending',
        reimbursement_payment_method: 'cash',
        reimbursement_check_number: '',
        expected_revenue: '',
        revenue_calculation_method: 'none',
        invoice_items: [],
      });
      setSelectedProducts([]);
      loadInvoices();
    } catch (error) {
      alert('Error creating invoice: ' + (error.response?.data?.error || error.message));
    }
  };


  // Get display records (invoices + payment records)
  const displayRecords = getDisplayRecords();

  const pendingReimbursements = crossStorePayments.flatMap((payment) =>
    (payment.allocations || []).filter(
      (allocation) =>
        allocation.reimbursement_required !== false &&
        allocation.reimbursement_status === 'pending'
    )
  );

  const pendingReimbursementAmount = pendingReimbursements.reduce((sum, allocation) => {
    const amount = parseFloat(allocation.allocated_amount);
    if (!Number.isFinite(amount)) {
      return sum;
    }
    return sum + amount;
  }, 0);

  const totalPaymentAmountNumber = parseFloat(crossStoreForm.amount);
  const differenceAmount =
    (Number.isFinite(totalPaymentAmountNumber) ? totalPaymentAmountNumber : 0) - crossStoreAllocatedTotal;
  const differenceWithinTolerance = Math.abs(differenceAmount) < 0.01;

  const filteredInvoices = displayRecords.filter(record => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      record.invoice_number?.toLowerCase().includes(searchLower) ||
      record.vendor_name?.toLowerCase().includes(searchLower) ||
      record.vendor_name_full?.toLowerCase().includes(searchLower) ||
      record.notes?.toLowerCase().includes(searchLower) ||
      record.payment_method?.toLowerCase().includes(searchLower) ||
      record.check_number?.toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(filteredInvoices.length / entriesPerPage);

  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * entriesPerPage,
    currentPage * entriesPerPage
  );

  // Show message if no store selected
  if (!selectedStore && (user?.role === 'admin' || user?.role === 'manager')) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-gray-500 mb-4">Please select a store from the header dropdown.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Purchase & Payments</h1>
        <div className="flex gap-3">
          {(user?.role === 'admin' || user?.role === 'super_admin') && (stores || []).filter(store => store.is_active !== false && !store.deleted_at).length > 1 && (
            <button
              onClick={handleOpenCrossStoreModal}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.1 0-2 .9-2 2v7h4v-7c0-1.1-.9-2-2-2zm0-5a3 3 0 013 3v1h3a2 2 0 012 2v2.268a2 2 0 01-.586 1.414l-1.828 1.828A2 2 0 0117 15.732V17a2 2 0 01-2 2h-6a2 2 0 01-2-2v-1.268a2 2 0 01-.586-1.414L4.586 12.682A2 2 0 014 11.268V9a2 2 0 012-2h3V6a3 3 0 013-3z" />
              </svg>
              Cross-Store Payment
            </button>
          )}
          <button
            onClick={() => setShowAddInvoiceModal(true)}
            className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49] transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Add Invoice
          </button>
          <button
            onClick={() => setShowMakePaymentModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Make Payment
          </button>
        </div>
      </div>

      {(user?.role === 'admin' || user?.role === 'super_admin') && selectedStore && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Cross-Store Payments</h2>
              <p className="text-sm text-gray-500">
                Payments recorded from {selectedStore.name} and allocations to other stores you manage.
              </p>
            </div>
            <button
              onClick={() => loadCrossStorePayments(selectedStore.id)}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={crossStoreLoading}
            >
              <svg className={`w-4 h-4 ${crossStoreLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5 19A9 9 0 0119 5" />
              </svg>
              Refresh
            </button>
          </div>
        {pendingReimbursements.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium text-orange-700">
              {pendingReimbursements.length} pending reimbursement{pendingReimbursements.length === 1 ? '' : 's'}
            </span>
            <span className="text-gray-600">
              Pending amount: {formatCurrency(pendingReimbursementAmount)}
            </span>
          </div>
        )}
          {crossStoreError && (
            <div className="mb-3 text-sm text-red-600">
              {crossStoreError}
            </div>
          )}
          {crossStoreLoading ? (
            <div className="py-6 text-center text-sm text-gray-500">Loading cross-store payments...</div>
          ) : crossStorePayments.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">
              No cross-store payments recorded for this store yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Payment Date</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Source Store</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Payment Details</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Allocations</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {crossStorePayments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-3 align-top text-gray-700">
                        <div className="font-medium">{new Date(payment.payment_date).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500">
                          {payment.created_at ? new Date(payment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-gray-900">{payment.source_store_name || 'Source Store'}</div>
                        {payment.paid_to && <div className="text-xs text-gray-500">Paid to: {payment.paid_to}</div>}
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700">
                        <div className="font-medium capitalize">{payment.payment_method.replace(/_/g, ' ')}</div>
                        {payment.payment_reference && (
                          <div className="text-xs text-gray-500">Ref: {payment.payment_reference}</div>
                        )}
                        {payment.notes && (
                          <div className="text-xs text-gray-500 mt-1 line-clamp-2">{payment.notes}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="space-y-3">
                          {payment.allocations && payment.allocations.length > 0 ? (
                            payment.allocations.map((allocation) => {
                              const reimbursementRequired = allocation.reimbursement_required !== false;
                              const status = allocation.reimbursement_status || (reimbursementRequired ? 'pending' : 'not_required');
                              const isPending = reimbursementRequired && status === 'pending';
                              const isCompleted = reimbursementRequired && status === 'completed';
                              const statusLabel = !reimbursementRequired
                                ? 'Not Required'
                                : isCompleted
                                  ? 'Reimbursed'
                                  : 'Pending';
                              const statusClass = !reimbursementRequired
                                ? 'bg-gray-100 text-gray-600'
                                : isCompleted
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-orange-100 text-orange-700';
                              const reimbursedDate = allocation.reimbursed_at
                                ? new Date(allocation.reimbursed_at).toLocaleDateString()
                                : null;
                              const reimbursedTime = allocation.reimbursed_at
                                ? new Date(allocation.reimbursed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : null;

                              return (
                                <div key={allocation.id} className="border border-gray-200 rounded-md bg-white p-3 shadow-sm">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <div className="font-medium text-gray-900">
                                        {allocation.target_store_name || 'Target Store'}
                                      </div>
                                      {allocation.memo && (
                                        <div className="text-xs text-gray-500 mt-1">
                                          Note: {allocation.memo}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <div className="font-semibold text-gray-900">
                                        {formatCurrency(allocation.allocated_amount)}
                                      </div>
                                      <div className="text-xs text-gray-500">Allocated</div>
                                    </div>
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium ${statusClass}`}>
                                      {statusLabel}
                                    </span>
                                    {isCompleted && (
                                      <span className="text-gray-500">
                                        {allocation.reimbursed_amount
                                          ? `Reimbursed ${formatCurrency(allocation.reimbursed_amount)}`
                                          : 'Reimbursed'}
                                        {reimbursedDate ? ` on ${reimbursedDate}` : ''}
                                        {reimbursedTime ? ` at ${reimbursedTime}` : ''}
                                      </span>
                                    )}
                                    {isPending && (
                                      <span className="text-orange-600">
                                        Awaiting reimbursement
                                      </span>
                                    )}
                                    {!reimbursementRequired && (
                                      <span className="text-gray-500">
                                        No reimbursement required
                                      </span>
                                    )}
                                  </div>
                                  {allocation.reimbursement_note && (
                                    <div className="mt-2 text-xs text-gray-500">
                                      Reimbursement note: {allocation.reimbursement_note}
                                    </div>
                                  )}
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {isPending && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleUpdateAllocationStatus(
                                            allocation.id,
                                            { status: 'completed' },
                                            'Reimbursement marked as completed.'
                                          )
                                        }
                                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                        disabled={updatingAllocationId === allocation.id}
                                      >
                                        {updatingAllocationId === allocation.id ? 'Updating…' : 'Mark Reimbursed'}
                                      </button>
                                    )}
                                    {isPending && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleUpdateAllocationStatus(
                                            allocation.id,
                                            { status: 'not_required' },
                                            'Marked as not requiring reimbursement.'
                                          )
                                        }
                                        className="px-2 py-1 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                                        disabled={updatingAllocationId === allocation.id}
                                      >
                                        {updatingAllocationId === allocation.id ? 'Updating…' : 'Mark Not Required'}
                                      </button>
                                    )}
                                    {isCompleted && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleUpdateAllocationStatus(
                                            allocation.id,
                                            { status: 'pending' },
                                            'Reimbursement marked as pending.'
                                          )
                                        }
                                        className="px-2 py-1 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                                        disabled={updatingAllocationId === allocation.id}
                                      >
                                        {updatingAllocationId === allocation.id ? 'Updating…' : 'Mark Pending'}
                                      </button>
                                    )}
                                    {!reimbursementRequired && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleUpdateAllocationStatus(
                                            allocation.id,
                                            { status: 'pending', reimbursement_required: true },
                                            'Reimbursement requirement enabled and set to pending.'
                                          )
                                        }
                                        className="px-2 py-1 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                                        disabled={updatingAllocationId === allocation.id}
                                      >
                                        {updatingAllocationId === allocation.id ? 'Updating…' : 'Require Reimbursement'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-sm text-gray-500">No allocations.</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-right font-semibold text-gray-900">
                        {formatCurrency(payment.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Filters and Search Section */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {/* Period Filter */}
          <div className="flex-1 min-w-[150px]">
            <select
              value={filters.period}
              onChange={(e) => setFilters({ ...filters, period: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
            >
              <option>This Month</option>
              <option>Last Month</option>
              <option>This Quarter</option>
              <option>This Year</option>
              <option>Custom Range</option>
            </select>
          </div>

          {/* Vendor Filter */}
          <div className="flex-1 min-w-[150px]">
            <select
              value={filters.vendor}
              onChange={(e) => setFilters({ ...filters, vendor: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
            >
              <option value="">All Vendors</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Type */}
          <div className="flex-1 min-w-[150px]">
            <select
              value={filters.filterType}
              onChange={(e) => setFilters({ ...filters, filterType: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
            >
              <option value="">Select Filter</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          {/* Date Range - Only show when Custom Range is selected */}
          {filters.period === 'Custom Range' && (
            <>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) => setFilters({ 
                    ...filters, 
                    dateRange: { ...filters.dateRange, start: e.target.value } 
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) => setFilters({ 
                    ...filters, 
                    dateRange: { ...filters.dateRange, end: e.target.value } 
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                />
              </div>
            </>
          )}
        </div>

        {/* Clear Filters Button */}
        {(filters.vendor || filters.filterType || filters.period !== 'This Month' || filters.dateRange.start || filters.dateRange.end) && (
          <div className="mb-2">
            <button
              onClick={() => {
                setFilters({
                  period: 'This Month',
                  vendor: '',
                  filterType: '',
                  dateRange: { start: '', end: '' }
                });
                setSearchTerm('');
              }}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear Filters
            </button>
          </div>
        )}

        {/* Entries and Search */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Show</span>
            <select
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-600">entries</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              {currentPage} of {totalPages || 1}
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
              />
              <svg
                className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sr
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Purchase date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Note
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <svg
                        className="w-16 h-16 text-gray-400 mb-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="text-gray-600 mb-4">No Data Found (Add new or check filter range)</p>
                      <button
                        onClick={() => setShowAddInvoiceModal(true)}
                        className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49] transition-colors flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Invoice
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((record, index) => {
                  const isPayment = record.recordType === 'payment';
                  const displayDate = isPayment ? record.payment_date : record.purchase_date;
                  
                  return (
                    <tr 
                      key={record.id} 
                      className={`hover:bg-gray-50 ${isPayment ? 'bg-blue-50' : ''} ${isPayment ? 'cursor-pointer' : ''}`}
                      onClick={isPayment ? () => handleViewPaymentDetails(record) : undefined}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(currentPage - 1) * entriesPerPage + index + 1}
                        {isPayment && <span className="ml-2 text-xs text-blue-600">(Payment)</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {displayDate ? new Date(displayDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.vendor_name || record.vendor_name_full || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {isPayment ? '-' : (record.invoice_number || '-')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {isPayment ? `Payment for Invoice: ${record.invoice_number || 'N/A'}` : (record.notes || '-')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {isPayment ? '-' : (record.due_date ? new Date(record.due_date).toLocaleDateString() : '-')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {isPayment ? (
                          record.payment_method?.toUpperCase() || '-'
                        ) : (
                          record.paid_on_purchase 
                            ? (record.payment_method_on_purchase?.toUpperCase() || '-')
                            : (record.payment_method || '-')
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {isPayment ? record.check_number || '-' : (record.check_number || '-')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${record.amount ? parseFloat(record.amount).toFixed(2) : '0.00'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isPayment ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Paid
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                record.status === 'paid'
                                  ? 'bg-green-100 text-green-800'
                                  : record.status === 'overdue'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {record.status || 'Pending'}
                            </span>
                            {record.reimbursement_status === 'pending' && (
                              <div className="flex items-center gap-2">
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                  Pending Reimbursement: {record.reimbursement_to}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReimburseInvoice(record);
                                  }}
                                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                  Reimburse
                                </button>
                              </div>
                            )}
                            {record.reimbursement_status === 'reimbursed' && (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                Reimbursed {record.reimbursement_payment_method ? `(${record.reimbursement_payment_method.toUpperCase()})` : ''}
                                {record.reimbursement_check_number ? ` - Check #${record.reimbursement_check_number}` : ''}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {isPayment ? (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewPaymentDetails(record);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View Details
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditInvoice(record);
                              }}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteInvoice(record.id);
                              }}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {paginatedInvoices.length > 0 && totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Showing {(currentPage - 1) * entriesPerPage + 1} to{' '}
              {Math.min(currentPage * entriesPerPage, filteredInvoices.length)} of{' '}
              {filteredInvoices.length} entries
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

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
                    payment_option: 'pay_later',
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
                {/* Left Column */}
                <div className="space-y-4">
                  {/* Bill Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bill Date *
                    </label>
                    <input
                      type="date"
                      value={invoiceForm.purchase_date}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, purchase_date: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Select Vendor */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Vendor
                    </label>
                    <select
                      value={invoiceForm.vendor_id}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, vendor_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                    >
                      <option value="">Select Vendor</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Purchase Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Purchase Type *
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="payment_option"
                          value="cash"
                          checked={invoiceForm.payment_option === 'cash'}
                          onChange={(e) => setInvoiceForm({ ...invoiceForm, payment_option: e.target.value, due_days: '', invoice_number: '' })}
                          className="mr-2"
                          required
                        />
                        <span className="text-sm text-gray-700">Cash</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="payment_option"
                          value="invoice"
                          checked={invoiceForm.payment_option === 'invoice'}
                          onChange={(e) => setInvoiceForm({ ...invoiceForm, payment_option: e.target.value })}
                          className="mr-2"
                          required
                        />
                        <span className="text-sm text-gray-700">Invoice</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="payment_option"
                          value="credit_memo"
                          checked={invoiceForm.payment_option === 'credit_memo'}
                          onChange={(e) => setInvoiceForm({ ...invoiceForm, payment_option: e.target.value, due_days: '' })}
                          className="mr-2"
                          required
                        />
                        <span className="text-sm text-gray-700">Credit Memo</span>
                      </label>
                    </div>
                  </div>

                  {/* Select Due Days - Only for Invoice, not Credit Memo */}
                  {invoiceForm.payment_option === 'invoice' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Due Days
                      </label>
                      <select
                        value={invoiceForm.due_days}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, due_days: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                      >
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

                {/* Right Column */}
                <div className="space-y-4">
                  {/* Invoice Number - Only show for Invoice or Credit Memo */}
                  {(invoiceForm.payment_option === 'invoice' || invoiceForm.payment_option === 'credit_memo') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Invoice Number *
                      </label>
                      <input
                        type="text"
                        value={invoiceForm.invoice_number}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })}
                        placeholder={invoiceForm.payment_option === 'credit_memo' ? 'Credit Memo Number' : 'Invoice Number'}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                        required
                      />
                    </div>
                  )}

                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={invoiceForm.amount}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                      placeholder="Amount"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Revenue Calculation Section */}
                  <div className="border-t pt-4 mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Revenue Calculation
                    </label>
                    <select
                      value={invoiceForm.revenue_calculation_method}
                      onChange={(e) => {
                        const method = e.target.value;
                        setInvoiceForm({ 
                          ...invoiceForm, 
                          revenue_calculation_method: method,
                          expected_revenue: method === 'none' ? '' : invoiceForm.expected_revenue,
                          invoice_items: method === 'none' ? [] : invoiceForm.invoice_items
                        });
                        if (method === 'product_selection') {
                          // Auto-calculate when method changes
                          setTimeout(() => {
                            if (invoiceForm.invoice_items.length > 0) {
                              calculateExpectedRevenue();
                            }
                          }, 100);
                        } else if (method === 'auto_calculate') {
                          // Open Revenue Calculation modal
                          setShowRevenueCalculationModal(true);
                          // Calculate invoice amount when modal opens if items exist (force calculation)
                          setTimeout(() => {
                            if (invoiceForm.invoice_items.length > 0) {
                              calculateInvoiceAmount(true);
                            }
                          }, 100);
                        }
                      }}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                    >
                      <option value="none">No Revenue Calculation</option>
                      <option value="manual">Enter Expected Revenue Manually</option>
                      <option value="product_selection">Select Products & Calculate</option>
                      <option value="auto_calculate">Calculate Cost (Which is invoice amount) and Revenue</option>
                    </select>

                    {/* Manual Entry */}
                    {invoiceForm.revenue_calculation_method === 'manual' && (
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Expected Revenue ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={invoiceForm.expected_revenue}
                          onChange={(e) => setInvoiceForm({ ...invoiceForm, expected_revenue: e.target.value })}
                          placeholder="Enter expected revenue"
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                        />
                      </div>
                    )}

                    {/* Product Selection */}
                    {invoiceForm.revenue_calculation_method === 'product_selection' && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Products Delivered
                          </label>
                          <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto">
                            {products.length === 0 ? (
                              <p className="text-sm text-gray-500">No products available. <a href="/inventory/products" className="text-[#2d8659] hover:underline">Add products</a> first.</p>
                            ) : (
                              <div className="space-y-2">
                                {products.map((product) => {
                                  const invoiceItem = invoiceForm.invoice_items.find(item => item.product_id === product.id);
                                  const isSelected = !!invoiceItem;
                                  return (
                                    <div key={product.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">{product.full_product_name}</div>
                                        <div className="text-xs text-gray-500">
                                          ${parseFloat(product.sell_price_per_piece || 0).toFixed(2)} per piece
                                        </div>
                                      </div>
                                      {isSelected ? (
                                        <div className="flex flex-col gap-2">
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              value={invoiceItem.quantity || 0}
                                              onChange={(e) => {
                                                const qty = parseFloat(e.target.value) || 0;
                                                if (qty > 0) {
                                                  handleUpdateProductQuantity(product.id, qty);
                                                } else {
                                                  handleRemoveProductFromInvoice(product.id);
                                                }
                                                setTimeout(() => calculateExpectedRevenue(), 100);
                                              }}
                                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                                              placeholder="Qty"
                                            />
                                            <input
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              value={invoiceItem.unit_cost || product.cost_price || 0}
                                              onChange={(e) => {
                                                handleUpdateProductUnitCost(product.id, e.target.value);
                                              }}
                                              className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                                              placeholder="Unit Cost"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => {
                                                handleRemoveProductFromInvoice(product.id);
                                                setTimeout(() => calculateExpectedRevenue(), 100);
                                              }}
                                              className="text-red-600 hover:text-red-800 text-sm"
                                            >
                                              Remove
                                            </button>
                                          </div>
                                          {product.vape_tax && (
                                            <label className="flex items-center gap-2 text-xs">
                                              <input
                                                type="checkbox"
                                                checked={invoiceItem.vape_tax_paid || false}
                                                onChange={(e) => handleUpdateProductVapeTax(product.id, e.target.checked)}
                                                className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                                              />
                                              <span className="text-yellow-700 font-medium">Vape Tax Paid (PA)</span>
                                            </label>
                                          )}
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleAddProductToInvoice(product);
                                            setTimeout(() => calculateExpectedRevenue(), 100);
                                          }}
                                          className="px-3 py-1 bg-[#2d8659] text-white text-sm rounded hover:bg-[#256b49]"
                                        >
                                          Add
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        {invoiceForm.invoice_items.length > 0 && (
                          <div className="bg-gray-50 p-3 rounded">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-700">Expected Revenue:</span>
                              <span className="text-lg font-bold text-[#2d8659]">
                                ${calculatingRevenue ? 'Calculating...' : parseFloat(invoiceForm.expected_revenue || 0).toFixed(2)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={calculateExpectedRevenue}
                              disabled={calculatingRevenue}
                              className="mt-2 text-sm text-[#2d8659] hover:underline disabled:opacity-50"
                            >
                              {calculatingRevenue ? 'Calculating...' : 'Recalculate'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Auto Calculate - Show button to open Revenue Calculation modal */}
                    {invoiceForm.revenue_calculation_method === 'auto_calculate' && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setShowRevenueCalculationModal(true);
                            // Calculate invoice amount when modal opens if items exist (force calculation)
                            setTimeout(() => {
                              if (invoiceForm.invoice_items.length > 0) {
                                calculateInvoiceAmount(true);
                              }
                            }, 100);
                          }}
                          className="w-full px-4 py-2 bg-[#2d8659] text-white rounded-md hover:bg-[#256348] transition-colors focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:ring-offset-2"
                        >
                          Open Revenue Calculation
                        </button>
                        {invoiceForm.expected_revenue && (
                          <div className="mt-3 bg-gray-50 p-3 rounded">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-700">Expected Revenue:</span>
                              <span className="text-lg font-bold text-[#2d8659]">
                                ${parseFloat(invoiceForm.expected_revenue || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Invoice Paid / Paid By Third Party */}
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={invoiceForm.paid_on_purchase || invoiceForm.is_reimbursable}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setInvoiceForm({ 
                            ...invoiceForm, 
                            paid_on_purchase: isChecked && !invoiceForm.is_reimbursable,
                            is_reimbursable: isChecked && !invoiceForm.paid_on_purchase ? false : invoiceForm.is_reimbursable,
                            payment_method_on_purchase: isChecked && !invoiceForm.is_reimbursable ? invoiceForm.payment_method_on_purchase : 'cash',
                            bank_id_on_purchase: isChecked && !invoiceForm.is_reimbursable ? invoiceForm.bank_id_on_purchase : ''
                          });
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {invoiceForm.is_reimbursable ? 'Invoice Paid (Paid By Third Party)' : 'Invoice paid on purchase'}
                      </span>
                    </label>

                    {/* Payment Type - Only show when paid on purchase AND NOT paid by third party */}
                    {invoiceForm.paid_on_purchase && !invoiceForm.is_reimbursable && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Payment Type *
                          </label>
                          <select
                            value={invoiceForm.payment_method_on_purchase}
                            onChange={(e) => setInvoiceForm({ 
                              ...invoiceForm, 
                              payment_method_on_purchase: e.target.value,
                              bank_id_on_purchase: e.target.value !== 'bank' ? '' : invoiceForm.bank_id_on_purchase,
                              credit_card_id_on_purchase: e.target.value !== 'card' ? '' : invoiceForm.credit_card_id_on_purchase
                            })}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                            required
                          >
                            <option value="cash">Cash</option>
                            <option value="bank">Bank</option>
                            <option value="check">Check</option>
                            <option value="card">Card</option>
                          </select>
                        </div>

                        {/* Bank Selection - Only show when payment method is bank */}
                        {invoiceForm.payment_method_on_purchase === 'bank' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Select Bank Account *
                            </label>
                            <select
                              value={invoiceForm.bank_id_on_purchase}
                              onChange={(e) => setInvoiceForm({ ...invoiceForm, bank_id_on_purchase: e.target.value })}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                              required
                            >
                              <option value="">Select Bank Account</option>
                              {banks.map((bank) => (
                                <option key={bank.id} value={bank.id}>
                                  {bank.bank_name} {bank.bank_short_name ? `(${bank.bank_short_name})` : ''}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={invoiceForm.bank_account_name_on_purchase}
                              onChange={(e) => setInvoiceForm({ ...invoiceForm, bank_account_name_on_purchase: e.target.value })}
                              className="w-full mt-2 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                              placeholder="Account Name (Optional)"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Paid By Third Party Section */}
                    <div className="mt-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={invoiceForm.is_reimbursable}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setInvoiceForm({ 
                              ...invoiceForm, 
                              is_reimbursable: isChecked,
                              paid_on_purchase: isChecked ? true : invoiceForm.paid_on_purchase,
                              reimbursement_to: isChecked ? invoiceForm.reimbursement_to : '',
                              reimbursement_status: isChecked ? 'pending' : 'none'
                            });
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm font-medium text-gray-700">Paid By Third Party</span>
                      </label>
                      
                      {invoiceForm.is_reimbursable && (
                        <div className="mt-3 space-y-3">
                          {/* Person Name */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Person Name *
                            </label>
                            <input
                              type="text"
                              value={invoiceForm.reimbursement_to}
                              onChange={(e) => setInvoiceForm({ ...invoiceForm, reimbursement_to: e.target.value })}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                              placeholder="Enter name or select person"
                              required
                            />
                          </div>

                          {/* Reimbursement Status */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Reimbursement Status *
                            </label>
                            <select
                              value={invoiceForm.reimbursement_status || 'pending'}
                              onChange={(e) => setInvoiceForm({ 
                                ...invoiceForm, 
                                reimbursement_status: e.target.value,
                                reimbursement_payment_method: e.target.value === 'reimbursed' ? invoiceForm.reimbursement_payment_method : '',
                                reimbursement_check_number: e.target.value === 'reimbursed' ? invoiceForm.reimbursement_check_number : ''
                              })}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                              required
                            >
                              <option value="pending">Pending Reimbursement</option>
                              <option value="reimbursed">Reimbursed</option>
                            </select>
                          </div>

                          {/* Reimbursement Type - Only show when status is reimbursed */}
                          {invoiceForm.reimbursement_status === 'reimbursed' && (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Reimbursement Type *
                                </label>
                                <select
                                  value={invoiceForm.reimbursement_payment_method || 'cash'}
                                  onChange={(e) => setInvoiceForm({ 
                                    ...invoiceForm, 
                                    reimbursement_payment_method: e.target.value,
                                    reimbursement_check_number: e.target.value !== 'check' ? '' : invoiceForm.reimbursement_check_number
                                  })}
                                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                                  required
                                >
                                  <option value="cash">Cash</option>
                                  <option value="check">Check</option>
                                </select>
                              </div>

                              {/* Check Number - Only show when reimbursement type is check */}
                              {invoiceForm.reimbursement_payment_method === 'check' && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Check # (Optional)
                                  </label>
                                  <input
                                    type="text"
                                    value={invoiceForm.reimbursement_check_number || ''}
                                    onChange={(e) => setInvoiceForm({ ...invoiceForm, reimbursement_check_number: e.target.value })}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                                    placeholder="Enter check number"
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={invoiceForm.notes}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                      placeholder="Notes"
                      rows="4"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end mt-6">
                <button
                  type="button"
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
                    paid_on_purchase: false,
                    payment_method_on_purchase: 'cash',
                    bank_id_on_purchase: '',
                    bank_account_name_on_purchase: '',
                    is_reimbursable: false,
                    reimbursement_to: '',
                  });
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 mr-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49] transition-colors"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cross-Store Payment Modal */}
      {showCrossStoreModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Record Cross-Store Payment</h2>
                <p className="text-sm text-gray-500">
                  Track payments made from one store that need to be allocated to other stores under your management.
                </p>
              </div>
              <button onClick={handleCloseCrossStoreModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmitCrossStorePayment} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source Store</label>
                  <select
                    value={crossStoreForm.source_store_id}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCrossStoreForm((prev) => ({
                        ...prev,
                        source_store_id: value,
                        allocations: prev.allocations.map((allocation) => ({
                          ...allocation,
                          target_store_id: allocation.target_store_id === value ? '' : allocation.target_store_id,
                        })),
                      }));
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  >
                    <option value="">Select store</option>
                    {(stores || [])
                      .filter((store) => store.is_active !== false && !store.deleted_at)
                      .map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={crossStoreForm.payment_date}
                    onChange={(e) => setCrossStoreForm((prev) => ({ ...prev, payment_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={crossStoreForm.payment_method}
                    onChange={(e) => setCrossStoreForm((prev) => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent capitalize"
                  >
                    {crossStorePaymentMethods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference / Check No. <span className="text-xs text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={crossStoreForm.payment_reference}
                    onChange={(e) => setCrossStoreForm((prev) => ({ ...prev, payment_reference: e.target.value }))}
                    placeholder="e.g., Check #1234 or Card ending 4321"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payee <span className="text-xs text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={crossStoreForm.paid_to}
                    onChange={(e) => setCrossStoreForm((prev) => ({ ...prev, paid_to: e.target.value }))}
                    placeholder="Vendor, credit card, or payee name"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Payment Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={crossStoreForm.amount}
                    onChange={(e) => setCrossStoreForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes <span className="text-xs text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={crossStoreForm.notes}
                  onChange={(e) => setCrossStoreForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="Add context for this payment, e.g., 'Paid via Store A card for Store B & C inventory'"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Allocate to other stores</h3>
                  <button
                    type="button"
                    onClick={handleAddCrossStoreAllocation}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Store Allocation
                  </button>
                </div>

                {crossStoreForm.allocations.length === 0 ? (
                  <div className="p-4 border border-dashed border-gray-300 rounded-md text-sm text-gray-500">
                    Add at least one target store allocation.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {crossStoreForm.allocations.map((allocation, index) => {
                      const availableStores = (stores || []).filter(
                        (store) =>
                          store.is_active !== false &&
                          !store.deleted_at &&
                          store.id !== crossStoreForm.source_store_id
                      );
                      return (
                        <div
                          key={index}
                          className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-1">Target Store</label>
                              <select
                                value={allocation.target_store_id}
                                onChange={(e) =>
                                  handleUpdateCrossStoreAllocation(index, 'target_store_id', e.target.value)
                                }
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                              >
                                <option value="">Select store</option>
                                {availableStores.map((store) => (
                                  <option key={store.id} value={store.id}>
                                    {store.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={allocation.allocated_amount}
                                onChange={(e) =>
                                  handleUpdateCrossStoreAllocation(index, 'allocated_amount', e.target.value)
                                }
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Notes <span className="text-xs text-gray-400">(optional)</span>
                              </label>
                              <input
                                type="text"
                                value={allocation.memo}
                                onChange={(e) => handleUpdateCrossStoreAllocation(index, 'memo', e.target.value)}
                                placeholder="e.g., 'Invoice #123 for Store B'"
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                              />
                            </div>
                            <div className="md:col-span-5">
                              <label className="inline-flex items-center text-sm text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={allocation.reimbursement_required !== false}
                                  onChange={(e) =>
                                    handleUpdateCrossStoreAllocation(index, 'reimbursement_required', e.target.checked)
                                  }
                                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="ml-2">Reimbursement required</span>
                              </label>
                              <p className="mt-1 text-xs text-gray-500">
                                Uncheck if the paying store will absorb this expense and no reimbursement is expected.
                              </p>
                            </div>
                            <div className="md:col-span-5">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Reimbursement Note <span className="text-xs text-gray-400">(optional)</span>
                              </label>
                              <input
                                type="text"
                                value={allocation.reimbursement_note || ''}
                                onChange={(e) =>
                                  handleUpdateCrossStoreAllocation(index, 'reimbursement_note', e.target.value)
                                }
                                placeholder="Add a note for the receiving store (optional)"
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                              />
                            </div>
                          </div>
                          {crossStoreForm.allocations.length > 1 && (
                            <div className="mt-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveCrossStoreAllocation(index)}
                                className="text-sm text-red-600 hover:text-red-800"
                              >
                                Remove allocation
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-gray-200 pt-4">
                <div className="text-sm text-gray-600">
                  Allocated Total:{' '}
                  <span className="font-semibold text-gray-900">{formatCurrency(crossStoreAllocatedTotal)}</span>
                </div>
                <div
                  className={`text-sm font-semibold ${
                    differenceWithinTolerance ? 'text-green-600' : 'text-orange-600'
                  }`}
                >
                  Remaining Difference:{' '}
                  {formatCurrency(differenceAmount)}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseCrossStoreModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={crossStoreSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={crossStoreSubmitting}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {crossStoreSubmitting ? 'Saving...' : 'Save Cross-Store Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Make Payment Modal */}
      {showMakePaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Make Payment</h2>
              <button
                onClick={() => {
                  setShowMakePaymentModal(false);
                  setSelectedInvoiceIds([]);
                  setPaymentForm({
                    payment_date: new Date().toISOString().split('T')[0],
                    payment_method: 'cash',
                    check_number: '',
                    split_payments: []
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Unpaid Invoices List */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Select Invoices to Pay</h3>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleSelectAll}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {selectedInvoiceIds.length === unpaidInvoices.length ? 'Deselect All' : 'Select All'}
                    </button>
                    {selectedInvoiceIds.length > 0 && (
                      <span className="text-sm font-medium text-gray-700">
                        Total: ${calculateSelectedTotal().toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {unpaidInvoices.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No unpaid invoices found.</p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            <input
                              type="checkbox"
                              checked={selectedInvoiceIds.length === unpaidInvoices.length && unpaidInvoices.length > 0}
                              onChange={handleSelectAll}
                              className="rounded"
                            />
                          </th>
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
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedInvoiceIds.includes(invoice.id)}
                                onChange={() => handleToggleInvoice(invoice.id)}
                                className="rounded"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {invoice.purchase_date ? new Date(invoice.purchase_date).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {invoice.vendor_name || invoice.vendor_name_full || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {invoice.invoice_number || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                              ${parseFloat(invoice.amount || 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Payment Details */}
              {selectedInvoiceIds.length > 0 && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Date *
                      </label>
                      <input
                        type="date"
                        value={paymentForm.payment_date}
                        onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                        required
                      />
                    </div>

                    {/* Split Payment Toggle */}
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={paymentForm.split_payments.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPaymentForm({
                                ...paymentForm,
                                split_payments: [{ payment_method: 'cash', amount: calculateSelectedTotal().toFixed(2), check_number: '' }]
                              });
                            } else {
                              setPaymentForm({
                                ...paymentForm,
                                split_payments: [],
                                payment_method: 'cash',
                                check_number: ''
                              });
                            }
                          }}
                          className="mr-2 rounded"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Split Payment (Multiple Payment Methods)
                        </span>
                      </label>
                    </div>

                    {/* Split Payments */}
                    {paymentForm.split_payments.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-600">
                          Total Amount: <strong>${calculateSelectedTotal().toFixed(2)}</strong>
                        </p>
                        {paymentForm.split_payments.map((split, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-medium text-gray-700">Payment {index + 1}</span>
                              {paymentForm.split_payments.length > 1 && (
                                <button
                                  onClick={() => handleRemoveSplitPayment(index)}
                                  className="text-red-600 hover:text-red-800 text-sm"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Payment Type *
                                </label>
                                <select
                                  value={split.payment_method}
                                  onChange={(e) => handleUpdateSplitPayment(index, 'payment_method', e.target.value)}
                                  className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                                  required
                                >
                                  <option value="cash">Cash</option>
                                  <option value="check">Check</option>
                                  <option value="card">Card</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Amount *
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={split.amount}
                                  onChange={(e) => handleUpdateSplitPayment(index, 'amount', e.target.value)}
                                  className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                                  required
                                />
                              </div>
                              {split.payment_method === 'card' && (
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Credit Card *
                                  </label>
                                  <select
                                    value={split.credit_card_id || ''}
                                    onChange={(e) => handleUpdateSplitPayment(index, 'credit_card_id', e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                                    required
                                  >
                                    <option value="">Select Credit Card</option>
                                    {creditCards.map((card) => (
                                      <option key={card.id} value={card.id}>
                                        {card.card_name}{card.last_four_digits ? ` (****${card.last_four_digits})` : ''}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              {split.payment_method === 'check' && (
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Check # *
                                  </label>
                                  <input
                                    type="text"
                                    value={split.check_number || ''}
                                    onChange={(e) => handleUpdateSplitPayment(index, 'check_number', e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                                    required
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={handleAddSplitPayment}
                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add Another Payment
                        </button>
                        <div className="mt-2">
                          <p className="text-sm text-gray-600">
                            Split Total: <strong>${calculateSplitTotal().toFixed(2)}</strong>
                            {Math.abs(calculateSplitTotal() - calculateSelectedTotal()) > 0.01 && (
                              <span className="text-red-600 ml-2">
                                (Difference: ${(calculateSplitTotal() - calculateSelectedTotal()).toFixed(2)})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Single Payment */
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Payment Type *
                          </label>
                          <select
                            value={paymentForm.payment_method}
                            onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value, check_number: '', credit_card_id: '' })}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                            required
                          >
                            <option value="cash">Cash</option>
                            <option value="check">Check</option>
                            <option value="card">Card</option>
                          </select>
                        </div>
                        {paymentForm.payment_method === 'card' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Select Credit Card *
                            </label>
                            <select
                              value={paymentForm.credit_card_id || ''}
                              onChange={(e) => setPaymentForm({ ...paymentForm, credit_card_id: e.target.value })}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                              required
                            >
                              <option value="">Select Credit Card</option>
                              {creditCards.map((card) => (
                                <option key={card.id} value={card.id}>
                                  {card.card_name}{card.last_four_digits ? ` (****${card.last_four_digits})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        {paymentForm.payment_method === 'check' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Check Number *
                            </label>
                            <input
                              type="text"
                              value={paymentForm.check_number}
                              onChange={(e) => setPaymentForm({ ...paymentForm, check_number: e.target.value })}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                              required
                            />
                          </div>
                        )}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-blue-800">
                            <strong>Total Amount:</strong> ${calculateSelectedTotal().toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowMakePaymentModal(false);
                    setSelectedInvoiceIds([]);
                    setPaymentForm({
                      payment_date: new Date().toISOString().split('T')[0],
                      payment_method: 'cash',
                      check_number: '',
                      credit_card_id: '',
                      split_payments: []
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRecordPayment}
                  disabled={selectedInvoiceIds.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {showEditModal && editingInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Edit Invoice</h2>
              <form onSubmit={handleUpdateInvoice}>
                <div className="space-y-4">
                  {/* Purchase Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Purchase Date *
                    </label>
                    <input
                      type="date"
                      value={editForm.purchase_date}
                      onChange={(e) => setEditForm({ ...editForm, purchase_date: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                      required
                    />
                  </div>

                  {/* Vendor */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vendor
                    </label>
                    <select
                      value={editForm.vendor_id}
                      onChange={(e) => setEditForm({ ...editForm, vendor_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    >
                      <option value="">Select Vendor</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Purchase Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Purchase Type *
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="cash"
                          checked={editForm.payment_option === 'cash'}
                          onChange={(e) => setEditForm({ ...editForm, payment_option: e.target.value })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Cash</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="invoice"
                          checked={editForm.payment_option === 'invoice'}
                          onChange={(e) => setEditForm({ ...editForm, payment_option: e.target.value })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Invoice</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="credit_memo"
                          checked={editForm.payment_option === 'credit_memo'}
                          onChange={(e) => setEditForm({ ...editForm, payment_option: e.target.value })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Credit Memo</span>
                      </label>
                    </div>
                  </div>

                  {/* Due Days - Only for Invoice */}
                  {editForm.payment_option === 'invoice' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Due Days *
                      </label>
                      <select
                        value={editForm.due_days}
                        onChange={(e) => setEditForm({ ...editForm, due_days: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                        required
                      >
                        <option value="">Select Due Days</option>
                        <option value="15">15 Days</option>
                        <option value="30">30 Days</option>
                        <option value="45">45 Days</option>
                        <option value="60">60 Days</option>
                        <option value="90">90 Days</option>
                      </select>
                    </div>
                  )}

                  {/* Invoice Number - Only for Invoice or Credit Memo */}
                  {(editForm.payment_option === 'invoice' || editForm.payment_option === 'credit_memo') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {editForm.payment_option === 'credit_memo' ? 'Credit Memo Number *' : 'Invoice Number *'}
                      </label>
                      <input
                        type="text"
                        value={editForm.invoice_number}
                        onChange={(e) => setEditForm({ ...editForm, invoice_number: e.target.value })}
                        placeholder={editForm.payment_option === 'credit_memo' ? 'Credit Memo Number' : 'Invoice Number'}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                        required
                      />
                    </div>
                  )}

                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.amount}
                      onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                      required
                    />
                  </div>

                  {/* Invoice Paid / Paid By Third Party */}
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editForm.paid_on_purchase || editForm.is_reimbursable}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setEditForm({ 
                            ...editForm, 
                            paid_on_purchase: isChecked && !editForm.is_reimbursable,
                            is_reimbursable: isChecked && !editForm.paid_on_purchase ? false : editForm.is_reimbursable,
                            payment_method_on_purchase: isChecked && !editForm.is_reimbursable ? editForm.payment_method_on_purchase : 'cash',
                            bank_id_on_purchase: isChecked && !editForm.is_reimbursable ? editForm.bank_id_on_purchase : ''
                          });
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {editForm.is_reimbursable ? 'Invoice Paid (Paid By Third Party)' : 'Invoice paid on purchase'}
                      </span>
                    </label>

                    {/* Payment Type - Only show when paid on purchase AND NOT paid by third party */}
                    {editForm.paid_on_purchase && !editForm.is_reimbursable && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Payment Type *
                          </label>
                          <select
                            value={editForm.payment_method_on_purchase}
                            onChange={(e) => setEditForm({ 
                              ...editForm, 
                              payment_method_on_purchase: e.target.value,
                              bank_id_on_purchase: e.target.value !== 'bank' ? '' : editForm.bank_id_on_purchase,
                              credit_card_id_on_purchase: e.target.value !== 'card' ? '' : editForm.credit_card_id_on_purchase
                            })}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                            required
                          >
                            <option value="cash">Cash</option>
                            <option value="bank">Bank</option>
                            <option value="check">Check</option>
                            <option value="card">Card</option>
                          </select>
                        </div>

                        {/* Bank Selection - Only show when payment method is bank */}
                        {editForm.payment_method_on_purchase === 'bank' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Select Bank Account *
                            </label>
                            <select
                              value={editForm.bank_id_on_purchase}
                              onChange={(e) => setEditForm({ ...editForm, bank_id_on_purchase: e.target.value })}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                              required
                            >
                              <option value="">Select Bank Account</option>
                              {banks.map((bank) => (
                                <option key={bank.id} value={bank.id}>
                                  {bank.bank_name} {bank.bank_short_name ? `(${bank.bank_short_name})` : ''}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={editForm.bank_account_name_on_purchase}
                              onChange={(e) => setEditForm({ ...editForm, bank_account_name_on_purchase: e.target.value })}
                              className="w-full mt-2 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                              placeholder="Account Name (Optional)"
                            />
                          </div>
                        )}

                        {/* Credit Card Selection - Only show when payment method is card */}
                        {editForm.payment_method_on_purchase === 'card' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Select Credit Card *
                            </label>
                            <select
                              value={editForm.credit_card_id_on_purchase}
                              onChange={(e) => setEditForm({ ...editForm, credit_card_id_on_purchase: e.target.value })}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                              required
                            >
                              <option value="">Select Credit Card</option>
                              {creditCards.map((card) => (
                                <option key={card.id} value={card.id}>
                                  {card.card_name}{card.last_four_digits ? ` (****${card.last_four_digits})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Paid By Third Party Section */}
                    <div className="mt-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editForm.is_reimbursable}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setEditForm({ 
                              ...editForm, 
                              is_reimbursable: isChecked,
                              paid_on_purchase: isChecked ? true : editForm.paid_on_purchase,
                              reimbursement_to: isChecked ? editForm.reimbursement_to : '',
                              reimbursement_status: isChecked ? (editForm.reimbursement_status || 'pending') : 'none'
                            });
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm font-medium text-gray-700">Paid By Third Party</span>
                      </label>
                      
                      {editForm.is_reimbursable && (
                        <div className="mt-3 space-y-3">
                          {/* Person Name */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Person Name *
                            </label>
                            <input
                              type="text"
                              value={editForm.reimbursement_to}
                              onChange={(e) => setEditForm({ ...editForm, reimbursement_to: e.target.value })}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                              placeholder="Enter name or select person"
                              required
                            />
                          </div>

                          {/* Reimbursement Status */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Reimbursement Status *
                            </label>
                            <select
                              value={editForm.reimbursement_status || 'pending'}
                              onChange={(e) => setEditForm({ 
                                ...editForm, 
                                reimbursement_status: e.target.value,
                                reimbursement_payment_method: e.target.value === 'reimbursed' ? editForm.reimbursement_payment_method : '',
                                reimbursement_check_number: e.target.value === 'reimbursed' ? editForm.reimbursement_check_number : ''
                              })}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                              required
                            >
                              <option value="pending">Pending Reimbursement</option>
                              <option value="reimbursed">Reimbursed</option>
                            </select>
                          </div>

                          {/* Reimbursement Type - Only show when status is reimbursed */}
                          {editForm.reimbursement_status === 'reimbursed' && (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Reimbursement Type *
                                </label>
                                <select
                                  value={editForm.reimbursement_payment_method || 'cash'}
                                  onChange={(e) => setEditForm({ 
                                    ...editForm, 
                                    reimbursement_payment_method: e.target.value,
                                    reimbursement_check_number: e.target.value !== 'check' ? '' : editForm.reimbursement_check_number
                                  })}
                                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                                  required
                                >
                                  <option value="cash">Cash</option>
                                  <option value="check">Check</option>
                                </select>
                              </div>

                              {/* Check Number - Only show when reimbursement type is check */}
                              {editForm.reimbursement_payment_method === 'check' && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Check # (Optional)
                                  </label>
                                  <input
                                    type="text"
                                    value={editForm.reimbursement_check_number || ''}
                                    onChange={(e) => setEditForm({ ...editForm, reimbursement_check_number: e.target.value })}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                                    placeholder="Enter check number"
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={3}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingInvoice(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#2d8659] text-white rounded hover:bg-[#256b49]"
                  >
                    Update Invoice
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {showPaymentDetailsModal && selectedPaymentInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Payment Details</h2>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-700 mb-3">Invoice Information</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Invoice Number:</span>
                      <span className="ml-2 font-medium">{selectedPaymentInvoice.invoice_number || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Purchase Date:</span>
                      <span className="ml-2 font-medium">
                        {selectedPaymentInvoice.purchase_date ? new Date(selectedPaymentInvoice.purchase_date).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Vendor:</span>
                      <span className="ml-2 font-medium">
                        {selectedPaymentInvoice.vendor_name || selectedPaymentInvoice.vendor_name_full || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Amount:</span>
                      <span className="ml-2 font-medium">
                        ${selectedPaymentInvoice.amount ? parseFloat(selectedPaymentInvoice.amount).toFixed(2) : '0.00'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-700 mb-3">Payment Information</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Payment Date:</span>
                      <span className="ml-2 font-medium">
                        {selectedPaymentInvoice.payment_date ? new Date(selectedPaymentInvoice.payment_date).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Payment Method:</span>
                      <span className="ml-2 font-medium uppercase">
                        {selectedPaymentInvoice.payment_method || 'N/A'}
                      </span>
                    </div>
                    {selectedPaymentInvoice.check_number && (
                      <div>
                        <span className="text-gray-600">Check Number:</span>
                        <span className="ml-2 font-medium">{selectedPaymentInvoice.check_number}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                        Paid
                      </span>
                    </div>
                  </div>
                </div>

                {selectedPaymentInvoice.notes && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2 text-sm">Notes</h3>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded p-3">
                      {selectedPaymentInvoice.notes}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-6 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowPaymentDetailsModal(false);
                    setSelectedPaymentInvoice(null);
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reimbursement Modal */}
      {showReimburseModal && selectedReimburseInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Mark Invoice as Reimbursed</h2>
                <button
                  onClick={() => {
                    setShowReimburseModal(false);
                    setSelectedReimburseInvoice(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmitReimbursement}>
                <div className="space-y-4">
                  {/* Invoice Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-700 mb-3">Invoice Information</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Invoice Number:</span>
                        <span className="ml-2 font-medium">{selectedReimburseInvoice.invoice_number || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Paid By:</span>
                        <span className="ml-2 font-medium">{selectedReimburseInvoice.reimbursement_to || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Amount:</span>
                        <span className="ml-2 font-medium">
                          ${selectedReimburseInvoice.amount ? parseFloat(selectedReimburseInvoice.amount).toFixed(2) : '0.00'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Reimbursement Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reimbursement Date *
                    </label>
                    <input
                      type="date"
                      value={reimburseForm.reimbursement_date}
                      onChange={(e) => setReimburseForm({ ...reimburseForm, reimbursement_date: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                      required
                    />
                  </div>

                  {/* Reimbursement Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reimbursement Amount *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={reimburseForm.reimbursement_amount}
                      onChange={(e) => setReimburseForm({ ...reimburseForm, reimbursement_amount: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                      required
                    />
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Method *
                    </label>
                    <select
                      value={reimburseForm.reimbursement_payment_method}
                      onChange={(e) => setReimburseForm({ 
                        ...reimburseForm, 
                        reimbursement_payment_method: e.target.value,
                        reimbursement_check_number: e.target.value !== 'check' ? '' : reimburseForm.reimbursement_check_number,
                        reimbursement_bank_id: e.target.value !== 'bank' ? '' : reimburseForm.reimbursement_bank_id
                      })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                      required
                    >
                      <option value="cash">Cash</option>
                      <option value="check">Check</option>
                      <option value="bank">Bank</option>
                    </select>
                  </div>

                  {/* Check Number - Only show when payment method is check */}
                  {reimburseForm.reimbursement_payment_method === 'check' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Check Number *
                      </label>
                      <input
                        type="text"
                        value={reimburseForm.reimbursement_check_number}
                        onChange={(e) => setReimburseForm({ ...reimburseForm, reimbursement_check_number: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                        required
                      />
                    </div>
                  )}

                  {/* Bank Selection - Only show when payment method is bank */}
                  {reimburseForm.reimbursement_payment_method === 'bank' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Bank Account *
                      </label>
                      <select
                        value={reimburseForm.reimbursement_bank_id}
                        onChange={(e) => setReimburseForm({ ...reimburseForm, reimbursement_bank_id: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                        required
                      >
                        <option value="">Select Bank Account</option>
                        {banks.map((bank) => (
                          <option key={bank.id} value={bank.id}>
                            {bank.bank_name} {bank.bank_short_name ? `(${bank.bank_short_name})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Note about cash on hand */}
                  {reimburseForm.reimbursement_payment_method === 'cash' && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-800">
                        <strong>Note:</strong> Cash on hand will be reduced when this feature is fully implemented with the accounting system.
                      </p>
                    </div>
                  )}

                  {/* Note about bank transaction */}
                  {reimburseForm.reimbursement_payment_method === 'bank' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> This transaction will appear in business bank transactions when bank linking is fully implemented.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReimburseModal(false);
                      setSelectedReimburseInvoice(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49]"
                  >
                    Mark as Reimbursed
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Calculation Modal */}
      {showRevenueCalculationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Revenue Calculation</h2>
                <button
                  onClick={handleCloseRevenueModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Cost Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Cost Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Invoice Amount (Cost)
                        {calculatedInvoiceAmount !== null && (
                          <span className="ml-2 text-xs text-gray-500">(Calculated)</span>
                        )}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={invoiceForm.amount || ''}
                        onChange={(e) => {
                          // User manually entered amount - mark as manual entry
                          setCalculatedInvoiceAmount(null);
                          setInvoiceForm({ ...invoiceForm, amount: e.target.value });
                        }}
                        placeholder="Enter invoice amount or it will be calculated"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                      />
                      {calculatedInvoiceAmount !== null && (
                        <p className="text-xs text-gray-500 mt-1">
                          Calculated from: Sum of (Quantity × Cost Price) for all products
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expected Revenue
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={invoiceForm.expected_revenue || ''}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, expected_revenue: e.target.value })}
                        placeholder="Enter expected revenue"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                      />
                      {invoiceForm.invoice_items.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Calculated from: Sum of (Sell Price × Quantity Per Pack × Quantity) for all products
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pending Order Items */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Pending Order Items</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Pull items from handheld orders that are still pending delivery and add them directly to this invoice.
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center text-sm text-gray-700 gap-2">
                        <input
                          type="checkbox"
                          checked={includeAllPendingItems}
                          onChange={(e) => setIncludeAllPendingItems(e.target.checked)}
                        />
                        Show all vendors
                      </label>
                      <button
                        type="button"
                        onClick={loadPendingOrderItems}
                        className="text-sm px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-100"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>

                  {pendingItemsError && (
                    <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded">
                      {pendingItemsError}
                    </div>
                  )}

                  {pendingItemsLoading ? (
                    <div className="text-sm text-gray-600">Loading pending order items...</div>
                  ) : pendingOrderItems.length === 0 ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                      No pending order items found{invoiceForm.vendor_id && !includeAllPendingItems ? ` for the selected vendor.` : '.'}
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                      {pendingOrderItems.map((item) => {
                        const quantityValue = pendingDeliveryQuantities[item.order_item_id] ?? item.quantity_pending;
                        return (
                          <div
                            key={item.order_item_id}
                            className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm"
                          >
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                              <div className="flex-1">
                                <div className="text-sm font-semibold text-gray-900">
                                  {item.product_name}
                                  {item.variant ? (
                                    <span className="ml-2 text-xs font-medium text-gray-500">
                                      Variant: {item.variant}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-1 text-xs text-gray-500 space-y-1">
                                  <div>
                                    Order #{item.order_number} • {new Date(item.order_date).toLocaleDateString()} • Supplier:{' '}
                                    {item.supplier || 'N/A'}
                                  </div>
                                  <div>
                                    Ordered: {item.quantity_ordered} • Delivered: {item.quantity_delivered} • Pending:{' '}
                                    <span className="font-medium text-[#2d8659]">{item.quantity_pending}</span>
                                  </div>
                                  <div>
                                    Cost/pack: ${parseFloat(item.cost_price || 0).toFixed(2)} • Revenue/pack:{' '}
                                    ${parseFloat(item.revenue_per_pack || 0).toFixed(2)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex flex-col text-sm">
                                  <label className="text-gray-600 mb-1">Deliver quantity</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max={item.quantity_pending}
                                    step="1"
                                    value={quantityValue}
                                    onChange={(e) => handlePendingQuantityChange(item.order_item_id, e.target.value)}
                                    className="w-24 border border-gray-300 rounded-md px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                                  />
                                  <span className="text-xs text-gray-500 mt-1">
                                    Pending: {item.quantity_pending}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAddPendingItemToInvoice(item)}
                                  className="px-3 py-2 bg-[#2d8659] text-white text-sm rounded-md hover:bg-[#256348] transition-colors"
                                >
                                  Add to Cost
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Product Selection for Revenue Calculation */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Select Products for Revenue Calculation</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Select the products delivered with this invoice to automatically calculate expected revenue.
                  </p>
                  
                  {products.length === 0 ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        No products available. <a href="/inventory/products" className="text-[#2d8659] hover:underline font-medium">Add products</a> first to calculate revenue.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-gray-300 rounded-md p-4 max-h-96 overflow-y-auto">
                      <div className="space-y-3">
                        {products.map((product) => {
                          const invoiceItem = invoiceForm.invoice_items.find(item => item.product_id === product.id);
                          const isSelected = !!invoiceItem;
                          const quantity = invoiceItem ? invoiceItem.quantity : 0;
                          // Revenue = sell_price_per_piece * quantity_per_pack * quantity (of packs)
                          const quantityPerPack = parseFloat(product.quantity_per_pack || 1);
                          const sellPricePerPiece = parseFloat(product.sell_price_per_piece || 0);
                          const itemRevenue = (sellPricePerPiece * quantityPerPack * parseFloat(quantity || 0)).toFixed(2);
                          
                          return (
                            <div key={product.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                              <div className="flex-1">
                                <div className="font-medium text-sm text-gray-900">{product.full_product_name}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Cost: ${parseFloat(product.cost_per_unit || 0).toFixed(2)}/unit | 
                                  Sell: ${parseFloat(product.sell_price_per_piece || 0).toFixed(2)}/piece | 
                                  Margin: {parseFloat(product.profit_margin || 0).toFixed(1)}%
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {isSelected ? (
                                  <>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={quantity}
                                      onChange={(e) => {
                                        const newQuantity = parseFloat(e.target.value) || 0;
                                        if (newQuantity > 0) {
                                          const updatedItems = invoiceForm.invoice_items.map(item =>
                                            item.product_id === product.id
                                              ? { ...item, quantity: newQuantity }
                                              : item
                                          );
                                          setInvoiceForm({ ...invoiceForm, invoice_items: updatedItems });
                                          // Recalculate revenue and invoice amount after state update
                                          setTimeout(() => {
                                            calculateInvoiceAmount(true); // Force calculation when quantity changes
                                            calculateExpectedRevenue();
                                          }, 200);
                                        } else {
                                          const updatedItems = invoiceForm.invoice_items.filter(item => item.product_id !== product.id);
                                          setInvoiceForm({ ...invoiceForm, invoice_items: updatedItems });
                                          // Recalculate revenue and invoice amount after removal
                                          setTimeout(() => {
                                            calculateInvoiceAmount(true); // Force calculation when removing products
                                            calculateExpectedRevenue();
                                          }, 200);
                                        }
                                      }}
                                      className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                                    />
                                    <span className="text-sm font-medium text-[#2d8659] min-w-[80px] text-right">
                                      ${itemRevenue}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updatedItems = invoiceForm.invoice_items.filter(item => item.product_id !== product.id);
                                        setInvoiceForm({ ...invoiceForm, invoice_items: updatedItems });
                                        setTimeout(() => {
                                          calculateExpectedRevenue();
                                        }, 100);
                                      }}
                                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                                    >
                                      Remove
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // Add new item with all required fields
                                      const newItem = { 
                                        product_id: product.id, 
                                        quantity: 1,
                                        unit_cost: product.cost_price || 0,
                                        vape_tax_paid: false
                                      };
                                      const updatedItems = [...invoiceForm.invoice_items, newItem];
                                      setInvoiceForm({ ...invoiceForm, invoice_items: updatedItems });
                                      // Recalculate revenue and invoice amount after state update
                                      setTimeout(() => {
                                        calculateInvoiceAmount(true); // Force calculation when adding products
                                        calculateExpectedRevenue();
                                      }, 200);
                                    }}
                                    className="px-3 py-1 bg-[#2d8659] text-white text-sm rounded-md hover:bg-[#256348] transition-colors"
                                  >
                                    Add
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Summary */}
                {invoiceForm.invoice_items.length > 0 && (
                  <div className="bg-[#e8f5e9] border border-[#2d8659] rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900">Total Expected Revenue:</span>
                      <span className="text-2xl font-bold text-[#2d8659]">
                        ${parseFloat(invoiceForm.expected_revenue || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      Based on {invoiceForm.invoice_items.length} product{invoiceForm.invoice_items.length !== 1 ? 's' : ''} selected
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleCloseRevenueModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Calculate invoice amount when closing if items exist and it was calculated
                    if (invoiceForm.invoice_items.length > 0 && calculatedInvoiceAmount !== null) {
                      calculateInvoiceAmount();
                    }
                    handleCloseRevenueModal();
                  }}
                  className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49]"
                >
                  Save & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchasePayments;

