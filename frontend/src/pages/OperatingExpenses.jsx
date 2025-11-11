import { useState, useEffect } from 'react';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { expensesAPI, settingsAPI, banksAPI, creditCardsAPI, crossStorePaymentsAPI } from '../services/api';

const OperatingExpenses = () => {
  const { selectedStore, stores } = useStore();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [pendingReimbursements, setPendingReimbursements] = useState([]);
  const [expenseTypes, setExpenseTypes] = useState([]);
  const [banks, setBanks] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReimburseModal, setShowReimburseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [reimbursingExpense, setReimbursingExpense] = useState(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    period: 'This Month',
    expense_type: '',
    payment_method: '',
    reimbursement_status: '',
    dateRange: { start: '', end: '' }
  });
  const [entriesPerPage, setEntriesPerPage] = useState(100);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'pending-reimbursements'
  
  // Form states
  const [expenseForm, setExpenseForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    expense_type_id: '',
    amount: '',
    is_recurring: false,
    recurring_frequency: '',
    is_autopay: false,
    payment_method: 'cash',
    bank_id: '',
    bank_account_name: '',
    credit_card_id: '',
    is_reimbursable: false,
    reimbursement_to: '',
    notes: '',
  });

  const [reimburseForm, setReimburseForm] = useState({
    reimbursement_date: new Date().toISOString().split('T')[0],
    reimbursement_amount: '',
  });
  const [crossStorePayments, setCrossStorePayments] = useState([]);
  const [crossStoreLoading, setCrossStoreLoading] = useState(false);
  const [crossStoreError, setCrossStoreError] = useState('');
  const [showCrossStoreExpenseModal, setShowCrossStoreExpenseModal] = useState(false);
  const [crossStoreSubmitting, setCrossStoreSubmitting] = useState(false);
  const [updatingAllocationId, setUpdatingAllocationId] = useState(null);

  const createDefaultCrossStoreExpenseForm = (defaultSourceId = selectedStore?.id || '') => {
    const defaultTarget = (stores || []).find(
      (store) => store.id !== defaultSourceId && store.is_active !== false && !store.deleted_at
    );
    const sourceStore = (stores || []).find((store) => store.id === defaultSourceId);
    return {
      split_mode: 'amount',
      source_store_id: defaultSourceId,
      payment_date: new Date().toISOString().split('T')[0],
      entry_date: new Date().toISOString().split('T')[0],
      payment_method: 'bank',
      amount: '',
      payment_reference: '',
      paid_to: '',
      expense_type_id: '',
      expense_payment_method: '',
      notes: '',
      payment_notes: '',
      reimbursement_to: sourceStore ? sourceStore.name || '' : '',
      allocations: [
        {
          target_store_id: defaultTarget ? defaultTarget.id : '',
          allocated_amount: '',
          percentage: '',
          memo: '',
          reimbursement_required: true,
          reimbursement_note: '',
        },
      ],
    };
  };

  const [crossStoreExpenseForm, setCrossStoreExpenseForm] = useState(createDefaultCrossStoreExpenseForm());
  const resetCrossStoreExpenseForm = (defaultSourceId = selectedStore?.id || '') => {
    setCrossStoreExpenseForm(createDefaultCrossStoreExpenseForm(defaultSourceId));
  };

  const handleAddCrossStoreExpenseAllocation = () => {
    setCrossStoreExpenseForm((prev) => ({
      ...prev,
      allocations: [
        ...prev.allocations,
        {
          target_store_id: '',
          allocated_amount: '',
          percentage: '',
          memo: '',
          reimbursement_required: true,
          reimbursement_note: '',
        },
      ],
    }));
  };

  const handleUpdateCrossStoreExpenseAllocation = (index, field, value) => {
    setCrossStoreExpenseForm((prev) => {
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

  const handleRemoveCrossStoreExpenseAllocation = (index) => {
    setCrossStoreExpenseForm((prev) => ({
      ...prev,
      allocations: prev.allocations.filter((_, allocIndex) => allocIndex !== index),
    }));
  };

  const handleCrossStoreExpenseSplitModeChange = (mode) => {
    setCrossStoreExpenseForm((prev) => {
      if (prev.split_mode === mode) {
        return prev;
      }

      const totalAmount = parseFloat(prev.amount);
      return {
        ...prev,
        split_mode: mode,
        allocations: prev.allocations.map((allocation) => {
          if (mode === 'percentage') {
            const amount = parseFloat(allocation.allocated_amount ?? allocation.amount);
            const derivedPercentage =
              Number.isFinite(totalAmount) && totalAmount > 0 && Number.isFinite(amount)
                ? (amount / totalAmount) * 100
                : NaN;
            return {
              ...allocation,
              allocated_amount: '',
              percentage: Number.isFinite(derivedPercentage)
                ? derivedPercentage.toFixed(3)
                : allocation.percentage || '',
            };
          }

          const rawPercentage = parseFloat(allocation.percentage ?? allocation.allocation_percentage);
          const derivedAmount =
            Number.isFinite(totalAmount) && totalAmount > 0 && Number.isFinite(rawPercentage)
              ? (totalAmount * rawPercentage) / 100
              : NaN;

          return {
            ...allocation,
            allocated_amount: Number.isFinite(derivedAmount)
              ? derivedAmount.toFixed(2)
              : allocation.allocated_amount || '',
            percentage: allocation.percentage || (Number.isFinite(rawPercentage) ? rawPercentage.toFixed(3) : ''),
          };
        }),
      };
    });
  };

  useEffect(() => {
    if (selectedStore) {
      loadExpenses();
      loadExpenseTypes();
      loadBanks();
      loadCreditCards();
      loadPendingReimbursements();
    }
  }, [selectedStore]);

  useEffect(() => {
    if (selectedStore) {
      loadCrossStorePayments(selectedStore.id);
      resetCrossStoreExpenseForm(selectedStore.id);
    } else {
      setCrossStorePayments([]);
      resetCrossStoreExpenseForm('');
    }
  }, [selectedStore, stores]);

  useEffect(() => {
    if (selectedStore) {
      if (activeTab === 'pending-reimbursements') {
        loadPendingReimbursements();
      } else {
        loadExpenses();
      }
    }
  }, [filters, entriesPerPage, currentPage, activeTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.period, filters.expense_type, filters.payment_method, filters.reimbursement_status, filters.dateRange.start, filters.dateRange.end, activeTab]);

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

  const loadExpenses = async () => {
    if (!selectedStore) return;
    try {
      setLoading(true);
      
      const apiFilters = {};
      if (filters.period) {
        const dateRange = getDateRangeForPeriod(filters.period, filters.dateRange);
        if (dateRange.start_date) apiFilters.start_date = dateRange.start_date;
        if (dateRange.end_date) apiFilters.end_date = dateRange.end_date;
      }
      
      if (filters.expense_type) apiFilters.expense_type_id = filters.expense_type;
      if (filters.payment_method) apiFilters.payment_method = filters.payment_method;
      if (filters.reimbursement_status) apiFilters.reimbursement_status = filters.reimbursement_status;
      if (searchTerm) apiFilters.search = searchTerm;
      
      const response = await expensesAPI.getAll(selectedStore.id, apiFilters);
      setExpenses(response.data.expenses || []);
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingReimbursements = async () => {
    if (!selectedStore) return;
    try {
      const response = await expensesAPI.getPendingReimbursements(selectedStore.id);
      setPendingReimbursements(response.data.expenses || []);
    } catch (error) {
      console.error('Error loading pending reimbursements:', error);
    }
  };

  const loadExpenseTypes = async () => {
    if (!selectedStore) return;
    try {
      const response = await settingsAPI.getExpenseTypes(selectedStore.id);
      setExpenseTypes(response.data.expense_types || []);
    } catch (error) {
      console.error('Error loading expense types:', error);
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

  const isCrossStoreExpensePercentageMode = crossStoreExpenseForm.split_mode === 'percentage';
  const getCrossStoreExpenseBreakdown = () => {
    const totalAmount = parseFloat(crossStoreExpenseForm.amount);
    const amounts = [];
    const percentages = [];

    if (isCrossStoreExpensePercentageMode && Number.isFinite(totalAmount) && totalAmount > 0) {
      const rawPercentages = [];
      crossStoreExpenseForm.allocations.forEach((allocation) => {
        const percentage = parseFloat(allocation.percentage ?? allocation.allocation_percentage);
        rawPercentages.push(Number.isFinite(percentage) ? percentage : NaN);
      });

      let runningAmount = 0;
      rawPercentages.forEach((percentage, index) => {
        percentages.push(percentage);

        if (!Number.isFinite(percentage)) {
          amounts.push(NaN);
          return;
        }

        let amount;
        if (index === crossStoreExpenseForm.allocations.length - 1) {
          amount = parseFloat((totalAmount - runningAmount).toFixed(2));
        } else {
          amount = Math.round(totalAmount * percentage * 100) / 100;
          amount = parseFloat(amount.toFixed(2));
          runningAmount += amount;
        }
        amounts.push(amount);
      });
    } else {
      const totalAmountNumber = Number.isFinite(parseFloat(crossStoreExpenseForm.amount))
        ? parseFloat(crossStoreExpenseForm.amount)
        : NaN;

      crossStoreExpenseForm.allocations.forEach((allocation) => {
        const amount = parseFloat(allocation.allocated_amount ?? allocation.amount);
        amounts.push(Number.isFinite(amount) ? parseFloat(amount.toFixed(2)) : NaN);

        const rawPercentage = parseFloat(allocation.percentage ?? allocation.allocation_percentage);
        if (Number.isFinite(rawPercentage)) {
          percentages.push(rawPercentage);
        } else if (Number.isFinite(totalAmountNumber) && totalAmountNumber > 0 && Number.isFinite(amount)) {
          percentages.push(parseFloat(((amount / totalAmountNumber) * 100).toFixed(3)));
        } else {
          percentages.push(NaN);
        }
      });
    }

    const total = amounts.reduce((sum, value) => (Number.isFinite(value) ? sum + value : sum), 0);
    return { amounts, percentages, total };
  };

  const crossStoreExpenseBreakdown = getCrossStoreExpenseBreakdown();
  const crossStoreExpenseAllocationAmounts = crossStoreExpenseBreakdown.amounts;
  const crossStoreExpenseAllocationPercentages = crossStoreExpenseBreakdown.percentages;
  const crossStoreExpenseAllocatedTotal = crossStoreExpenseBreakdown.total;
  const crossStoreExpenseTotalAmount = parseFloat(crossStoreExpenseForm.amount);
  const crossStoreExpenseDifference =
    (Number.isFinite(crossStoreExpenseTotalAmount) ? crossStoreExpenseTotalAmount : 0) - crossStoreExpenseAllocatedTotal;
  const crossStoreExpenseDifferenceWithinTolerance = Math.abs(crossStoreExpenseDifference) < 0.01;
  const hasSourceExpenseAllocation = crossStoreExpenseForm.allocations.some(
    (allocation) => allocation.target_store_id === crossStoreExpenseForm.source_store_id
  );
  const crossStoreExpenseSourceStore = (stores || []).find(
    (store) => store.id === crossStoreExpenseForm.source_store_id
  );

  const loadCrossStorePayments = async (storeIdParam) => {
    const storeId = storeIdParam || selectedStore?.id;
    if (!storeId) return;
    try {
      setCrossStoreLoading(true);
      setCrossStoreError('');
      const response = await crossStorePaymentsAPI.list({
        store_id: storeId,
        role: 'all',
        limit: 100,
      });
      const payments = response.data.payments || [];
      const filtered = payments
        .map((payment) => {
          const relevantAllocations = (payment.allocations || []).filter(
            (allocation) => allocation.target_type === 'expense' || allocation.expense_id
          );
          const storeAllocations = relevantAllocations.filter(
            (allocation) =>
              allocation.target_store_id === storeId || payment.source_store_id === storeId
          );
          if (storeAllocations.length === 0) {
            return null;
          }
          return {
            ...payment,
            allocations: storeAllocations,
          };
        })
        .filter(Boolean);
      setCrossStorePayments(filtered);
    } catch (error) {
      console.error('Error loading cross-store expenses:', error);
      setCrossStoreError(error.response?.data?.error || 'Failed to load cross-store expenses.');
    } finally {
      setCrossStoreLoading(false);
    }
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    if (!selectedStore) {
      alert('Please select a store');
      return;
    }

    if (!expenseForm.expense_type_id || !expenseForm.amount) {
      alert('Please fill in all required fields');
      return;
    }

    // Validate payment method requirements
    if (expenseForm.payment_method === 'bank' && !expenseForm.bank_id && !expenseForm.is_autopay) {
      alert('Please select a bank account for bank payments');
      return;
    }

    if (expenseForm.payment_method === 'card' && !expenseForm.credit_card_id) {
      alert('Please select a credit card for card payments');
      return;
    }

    // Validate autopay requires bank
    if (expenseForm.is_autopay && !expenseForm.bank_id) {
      alert('Please select a bank account for autopay expenses');
      return;
    }

    // Validate recurring requires frequency
    if (expenseForm.is_recurring && !expenseForm.recurring_frequency) {
      alert('Please select a recurring frequency');
      return;
    }

    // Validate reimbursement
    if (expenseForm.is_reimbursable && !expenseForm.reimbursement_to) {
      alert('Please enter who to reimburse');
      return;
    }

    try {
      const expenseData = {
        entry_date: expenseForm.entry_date,
        expense_type_id: expenseForm.expense_type_id,
        amount: expenseForm.amount,
        is_recurring: expenseForm.is_recurring,
        recurring_frequency: expenseForm.is_recurring ? expenseForm.recurring_frequency : null,
        is_autopay: expenseForm.is_autopay,
        payment_method: expenseForm.payment_method,
        bank_id: (expenseForm.payment_method === 'bank' || expenseForm.is_autopay) ? expenseForm.bank_id : null,
        bank_account_name: expenseForm.bank_account_name || null,
        credit_card_id: expenseForm.payment_method === 'card' ? expenseForm.credit_card_id : null,
        is_reimbursable: expenseForm.is_reimbursable,
        reimbursement_to: expenseForm.is_reimbursable ? expenseForm.reimbursement_to : null,
        reimbursement_status: expenseForm.is_reimbursable ? 'pending' : 'none',
        notes: expenseForm.notes || null,
      };
      
      await expensesAPI.create(selectedStore.id, expenseData);
      
      alert('Expense entry created successfully!');
      setShowAddExpenseModal(false);
      resetExpenseForm();
      loadExpenses();
      loadPendingReimbursements();
    } catch (error) {
      alert('Error creating expense entry: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      entry_date: expense.entry_date,
      expense_type_id: expense.expense_type_id,
      amount: expense.amount,
      is_recurring: expense.is_recurring || false,
      recurring_frequency: expense.recurring_frequency || '',
      is_autopay: expense.is_autopay || false,
      payment_method: expense.payment_method,
      bank_id: expense.bank_id || '',
      credit_card_id: expense.credit_card_id || '',
      bank_account_name: expense.bank_account_name || '',
      is_reimbursable: expense.is_reimbursable || false,
      reimbursement_to: expense.reimbursement_to || '',
      notes: expense.notes || '',
    });
    setShowEditModal(true);
  };

  const handleUpdateExpense = async (e) => {
    e.preventDefault();
    if (!editingExpense) return;

    try {
      const expenseData = {
        entry_date: expenseForm.entry_date,
        expense_type_id: expenseForm.expense_type_id,
        amount: expenseForm.amount,
        is_recurring: expenseForm.is_recurring,
        recurring_frequency: expenseForm.is_recurring ? expenseForm.recurring_frequency : null,
        is_autopay: expenseForm.is_autopay,
        payment_method: expenseForm.payment_method,
        bank_id: (expenseForm.payment_method === 'bank' || expenseForm.is_autopay) ? expenseForm.bank_id : null,
        bank_account_name: expenseForm.bank_account_name || null,
        credit_card_id: expenseForm.payment_method === 'card' ? expenseForm.credit_card_id : null,
        is_reimbursable: expenseForm.is_reimbursable,
        reimbursement_to: expenseForm.is_reimbursable ? expenseForm.reimbursement_to : null,
        notes: expenseForm.notes || null,
      };
      
      // If reimbursement status changed from pending to none, reset reimbursement fields
      if (editingExpense.reimbursement_status === 'pending' && !expenseForm.is_reimbursable) {
        expenseData.reimbursement_status = 'none';
        expenseData.reimbursement_to = null;
      } else if (editingExpense.reimbursement_status === 'none' && expenseForm.is_reimbursable) {
        expenseData.reimbursement_status = 'pending';
      }
      
      await expensesAPI.update(selectedStore.id, editingExpense.id, expenseData);
      
      alert('Expense entry updated successfully!');
      setShowEditModal(false);
      setEditingExpense(null);
      resetExpenseForm();
      loadExpenses();
      loadPendingReimbursements();
    } catch (error) {
      alert('Error updating expense entry: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense entry? This action cannot be undone.')) {
      return;
    }

    try {
      await expensesAPI.delete(selectedStore.id, expenseId);
      alert('Expense entry deleted successfully!');
      loadExpenses();
      loadPendingReimbursements();
      if (selectedStore) {
        loadCrossStorePayments(selectedStore.id);
      }
    } catch (error) {
      alert('Error deleting expense entry: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleReimburse = (expense) => {
    setReimbursingExpense(expense);
    setReimburseForm({
      reimbursement_date: new Date().toISOString().split('T')[0],
      reimbursement_amount: expense.amount,
    });
    setShowReimburseModal(true);
  };

  const handleSubmitReimbursement = async (e) => {
    e.preventDefault();
    if (!reimbursingExpense) return;

    try {
      await expensesAPI.reimburse(selectedStore.id, reimbursingExpense.id, reimburseForm);

      if (reimbursingExpense.cross_store_allocation_id) {
        try {
          await crossStorePaymentsAPI.updateAllocationReimbursement(
            reimbursingExpense.cross_store_allocation_id,
            {
              status: 'completed',
              reimbursed_amount: reimburseForm.reimbursement_amount
                ? parseFloat(reimburseForm.reimbursement_amount)
                : undefined,
            }
          );
        } catch (syncError) {
          console.error('Failed to sync cross-store reimbursement status:', syncError);
        }
      }
      
      alert('Expense marked as reimbursed successfully!');
      setShowReimburseModal(false);
      setReimbursingExpense(null);
      loadExpenses();
      loadPendingReimbursements();
      if (selectedStore) {
        loadCrossStorePayments(selectedStore.id);
      }
    } catch (error) {
      alert('Error marking expense as reimbursed: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleOpenCrossStoreExpenseModal = () => {
    resetCrossStoreExpenseForm(selectedStore?.id || '');
    setShowCrossStoreExpenseModal(true);
  };

  const handleCloseCrossStoreExpenseModal = () => {
    setShowCrossStoreExpenseModal(false);
    resetCrossStoreExpenseForm(selectedStore?.id || '');
  };

  const handleSubmitCrossStoreExpense = async (event) => {
    event.preventDefault();

    if (!crossStoreExpenseForm.source_store_id) {
      alert('Please select the store that made the payment.');
      return;
    }

    if (!Number.isFinite(crossStoreExpenseTotalAmount) || crossStoreExpenseTotalAmount <= 0) {
      alert('Please enter a valid total payment amount.');
      return;
    }

    if (!crossStoreExpenseForm.payment_method) {
      alert('Please select a payment method.');
      return;
    }

    if (!crossStoreExpenseForm.entry_date) {
      alert('Please select an expense entry date.');
      return;
    }

    if (!crossStoreExpenseForm.allocations.length) {
      alert('Add at least one store allocation.');
      return;
    }

    if (isCrossStoreExpensePercentageMode) {
      let percentageTotal = 0;
      for (const allocation of crossStoreExpenseForm.allocations) {
        const perc = parseFloat(allocation.percentage ?? allocation.allocation_percentage);
        if (!Number.isFinite(perc) || perc <= 0) {
          alert('Each allocation must have a percentage greater than 0%.');
          return;
        }
        percentageTotal += perc;
      }

      if (!Number.isFinite(percentageTotal)) {
        alert('Allocation percentages must be valid numbers.');
        return;
      }

      if (percentageTotal > 100.01) {
        alert('Allocation percentages cannot exceed 100%.');
        return;
      }

      if (percentageTotal < 99.99 && hasSourceExpenseAllocation) {
        alert('Allocation percentages must add up to 100% when the paying store already has an allocation.');
        return;
      }
    }

    for (let index = 0; index < crossStoreExpenseForm.allocations.length; index++) {
      const allocation = crossStoreExpenseForm.allocations[index];
      if (!allocation.target_store_id) {
        alert('Each allocation must have a target store selected.');
        return;
      }
      const allocationAmount = crossStoreExpenseAllocationAmounts[index];
      if (!Number.isFinite(allocationAmount) || allocationAmount <= 0) {
        alert('Each allocation must have a valid amount.');
        return;
      }
      if (isCrossStoreExpensePercentageMode) {
        const allocationPercentage = parseFloat(allocation.percentage ?? allocation.allocation_percentage);
        if (!Number.isFinite(allocationPercentage) || allocationPercentage <= 0) {
          alert('Each allocation must have a valid percentage.');
          return;
        }
      }
    }

    try {
      setCrossStoreSubmitting(true);
      let allocationsPayload = crossStoreExpenseForm.allocations.map((allocation, index) => {
        const amount = crossStoreExpenseAllocationAmounts[index];
        const rawPercentage = isCrossStoreExpensePercentageMode
          ? crossStoreExpenseAllocationPercentages[index]
          : parseFloat(allocation.percentage ?? allocation.allocation_percentage);
        const normalizedPercentage =
          Number.isFinite(rawPercentage) && rawPercentage > 0
            ? parseFloat(rawPercentage.toFixed(3))
            : Number.isFinite(crossStoreExpenseTotalAmount) &&
              crossStoreExpenseTotalAmount > 0 &&
              Number.isFinite(amount)
              ? parseFloat(((amount / crossStoreExpenseTotalAmount) * 100).toFixed(3))
              : null;

        return {
          target_store_id: allocation.target_store_id,
          amount: Number.isFinite(amount) ? parseFloat(amount.toFixed(2)) : 0,
          memo: allocation.memo || null,
          reimbursement_required: allocation.reimbursement_required !== false,
          reimbursement_note: allocation.reimbursement_note || null,
          allocation_percentage: normalizedPercentage,
        };
      });

      let remainingDifference = crossStoreExpenseDifference;
      if (!crossStoreExpenseDifferenceWithinTolerance) {
        if (remainingDifference > 0.01 && !hasSourceExpenseAllocation && crossStoreExpenseForm.source_store_id) {
          const remainderAmount = parseFloat(remainingDifference.toFixed(2));
          const remainderPercentage =
            Number.isFinite(crossStoreExpenseTotalAmount) && crossStoreExpenseTotalAmount > 0
              ? parseFloat(((remainderAmount / crossStoreExpenseTotalAmount) * 100).toFixed(3))
              : null;

          allocationsPayload.push({
            target_store_id: crossStoreExpenseForm.source_store_id,
            amount: remainderAmount,
            memo: 'Auto remainder for paying store',
            reimbursement_required: false,
            reimbursement_note: null,
            allocation_percentage: remainderPercentage,
          });
          remainingDifference = 0;
        } else {
          alert('Allocated amounts must add up to the total payment amount.');
          return;
        }
      }

      await crossStorePaymentsAPI.create({
        context: 'expense',
        split_mode: crossStoreExpenseForm.split_mode,
        source_store_id: crossStoreExpenseForm.source_store_id,
        payment_date: crossStoreExpenseForm.payment_date,
        payment_method: crossStoreExpenseForm.payment_method,
        payment_reference: crossStoreExpenseForm.payment_reference || null,
        amount: crossStoreExpenseTotalAmount,
        currency: 'USD',
        paid_to: crossStoreExpenseForm.paid_to || null,
        notes: crossStoreExpenseForm.payment_notes || null,
        allocations: allocationsPayload,
        expense_defaults: {
          entry_date: crossStoreExpenseForm.entry_date,
          expense_type_id: crossStoreExpenseForm.expense_type_id,
          payment_method:
            crossStoreExpenseForm.expense_payment_method || crossStoreExpenseForm.payment_method,
          notes: crossStoreExpenseForm.notes || null,
          reimbursement_to: crossStoreExpenseForm.reimbursement_to || null,
        },
      });

      alert('Cross-store expense recorded successfully.');
      setShowCrossStoreExpenseModal(false);
      const resetSourceId = crossStoreExpenseForm.source_store_id || selectedStore?.id || '';
      resetCrossStoreExpenseForm(resetSourceId);
      if (selectedStore) {
        loadCrossStorePayments(selectedStore.id);
        loadExpenses();
        loadPendingReimbursements();
      }
    } catch (error) {
      console.error('Error creating cross-store expense:', error);
      alert(error.response?.data?.error || 'Failed to create cross-store expense.');
    } finally {
      setCrossStoreSubmitting(false);
    }
  };

  const handleUpdateCrossStoreAllocationStatus = async (allocationId, updates, successMessage = 'Reimbursement status updated.') => {
    try {
      setUpdatingAllocationId(allocationId);
      await crossStorePaymentsAPI.updateAllocationReimbursement(allocationId, updates);
      if (selectedStore) {
        await loadCrossStorePayments(selectedStore.id);
        await loadExpenses();
        await loadPendingReimbursements();
      }
      alert(successMessage);
    } catch (error) {
      console.error('Error updating reimbursement status:', error);
      alert(error.response?.data?.error || 'Failed to update reimbursement status.');
    } finally {
      setUpdatingAllocationId(null);
    }
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      entry_date: new Date().toISOString().split('T')[0],
      expense_type_id: '',
      amount: '',
      is_recurring: false,
      recurring_frequency: '',
      is_autopay: false,
      payment_method: 'cash',
      bank_id: '',
      bank_account_name: '',
      credit_card_id: '',
      is_reimbursable: false,
      reimbursement_to: '',
      notes: '',
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const crossStoreExpenseAllocations = crossStorePayments.flatMap((payment) =>
    (payment.allocations || []).map((allocation) => ({
      payment,
      allocation,
    }))
  );

  const crossStoreExpensePendingAllocations = crossStoreExpenseAllocations.filter(
    ({ allocation }) =>
      allocation.reimbursement_required !== false &&
      (allocation.reimbursement_status === 'pending' || allocation.reimbursement_status === 'pending_reimbursement')
  );

  const crossStoreExpensePendingAmount = crossStoreExpensePendingAllocations.reduce((sum, { allocation }) => {
    const amount = parseFloat(allocation.allocated_amount);
    if (!Number.isFinite(amount)) {
      return sum;
    }
    return sum + amount;
  }, 0);
  const crossStoreExpensePendingSummaryText =
    crossStoreExpensePendingAllocations.length === 0
      ? ''
      : `${crossStoreExpensePendingAllocations.length} pending reimbursement${crossStoreExpensePendingAllocations.length === 1 ? '' : 's'} • Pending amount ${formatCurrency(crossStoreExpensePendingAmount)}`;

  const filteredExpenses = activeTab === 'pending-reimbursements' 
    ? pendingReimbursements 
    : expenses.filter(expense => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
          expense.notes?.toLowerCase().includes(searchLower) ||
          expense.expense_type_name?.toLowerCase().includes(searchLower) ||
          expense.reimbursement_to?.toLowerCase().includes(searchLower)
        );
      });

  const totalPages = Math.ceil(filteredExpenses.length / entriesPerPage);
  const paginatedExpenses = filteredExpenses.slice(
    (currentPage - 1) * entriesPerPage,
    currentPage * entriesPerPage
  );

  if (!selectedStore && (user?.role === 'admin' || user?.role === 'manager')) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-gray-500 mb-4">Please select a store from the header dropdown.</p>
      </div>
    );
  }

  const renderExpenseForm = (isEdit = false) => (
    <form onSubmit={isEdit ? handleUpdateExpense : handleCreateExpense} className="space-y-6">
      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Date *
        </label>
        <input
          type="date"
          value={expenseForm.entry_date}
          onChange={(e) => setExpenseForm({ ...expenseForm, entry_date: e.target.value })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
          required
        />
      </div>

      {/* Expense Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Expense Type *
        </label>
        <select
          value={expenseForm.expense_type_id}
          onChange={(e) => setExpenseForm({ ...expenseForm, expense_type_id: e.target.value })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
          required
        >
          <option value="">Select Expense Type</option>
          {expenseTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.expense_type_name}
            </option>
          ))}
        </select>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Amount *
        </label>
        <input
          type="number"
          step="0.01"
          value={expenseForm.amount}
          onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
          placeholder="0.00"
          required
        />
      </div>

      {/* Recurring Expense */}
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={expenseForm.is_recurring}
            onChange={(e) => setExpenseForm({ 
              ...expenseForm, 
              is_recurring: e.target.checked,
              recurring_frequency: e.target.checked ? expenseForm.recurring_frequency : ''
            })}
            className="mr-2"
          />
          <span className="text-sm font-medium text-gray-700">Recurring Expense</span>
        </label>
        {expenseForm.is_recurring && (
          <select
            value={expenseForm.recurring_frequency}
            onChange={(e) => setExpenseForm({ ...expenseForm, recurring_frequency: e.target.value })}
            className="w-full mt-2 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
            required
          >
            <option value="">Select Frequency</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        )}
      </div>

      {/* Payment Method */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Payment Method *
        </label>
        <select
          value={expenseForm.payment_method}
          onChange={(e) => setExpenseForm({ 
            ...expenseForm, 
            payment_method: e.target.value,
            bank_id: e.target.value !== 'bank' ? '' : expenseForm.bank_id,
            credit_card_id: e.target.value !== 'card' ? '' : expenseForm.credit_card_id
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

      {/* Autopay */}
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={expenseForm.is_autopay}
            onChange={(e) => setExpenseForm({ 
              ...expenseForm, 
              is_autopay: e.target.checked,
              payment_method: e.target.checked ? 'bank' : expenseForm.payment_method
            })}
            className="mr-2"
          />
          <span className="text-sm font-medium text-gray-700">Autopay</span>
        </label>
        {(expenseForm.is_autopay || expenseForm.payment_method === 'bank') && (
          <div className="mt-2 space-y-2">
            <select
              value={expenseForm.bank_id}
              onChange={(e) => setExpenseForm({ ...expenseForm, bank_id: e.target.value })}
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
              value={expenseForm.bank_account_name}
              onChange={(e) => setExpenseForm({ ...expenseForm, bank_account_name: e.target.value })}
              className="w-full mt-2 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
              placeholder="Account Name (Optional)"
            />
          </div>
        )}

        {/* Credit Card Selection - Only show when payment method is card */}
        {expenseForm.payment_method === 'card' && (
          <div className="mt-2">
            <select
              value={expenseForm.credit_card_id}
              onChange={(e) => setExpenseForm({ ...expenseForm, credit_card_id: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
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

      {/* Reimbursement */}
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={expenseForm.is_reimbursable}
            onChange={(e) => setExpenseForm({ 
              ...expenseForm, 
              is_reimbursable: e.target.checked,
              reimbursement_to: e.target.checked ? expenseForm.reimbursement_to : ''
            })}
            className="mr-2"
          />
          <span className="text-sm font-medium text-gray-700">Needs Reimbursement</span>
        </label>
        {expenseForm.is_reimbursable && (
          <input
            type="text"
            value={expenseForm.reimbursement_to}
            onChange={(e) => setExpenseForm({ ...expenseForm, reimbursement_to: e.target.value })}
            className="w-full mt-2 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
            placeholder="Enter name or select person"
            required
          />
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes
        </label>
        <textarea
          value={expenseForm.notes}
          onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
          rows="3"
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
          placeholder="Additional notes or comments..."
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            if (isEdit) {
              setShowEditModal(false);
              setEditingExpense(null);
            } else {
              setShowAddExpenseModal(false);
            }
            resetExpenseForm();
          }}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-[#2d8659] text-white rounded-md hover:bg-[#256b49]"
        >
          {isEdit ? 'Update' : 'Save'} Expense Entry
        </button>
      </div>
    </form>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Operating Expenses</h1>
        <div className="flex gap-3">
          {(user?.role === 'admin' || user?.role === 'super_admin') &&
            (stores || []).filter((store) => store.is_active !== false && !store.deleted_at).length > 1 && (
              <button
                onClick={handleOpenCrossStoreExpenseModal}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.1 0-2 .9-2 2v7h4v-7c0-1.1-.9-2-2-2zm0-5a3 3 0 013 3v1h3a2 2 0 012 2v2.268a2 2 0 01-.586 1.414l-1.828 1.828A2 2 0 0117 15.732V17a2 2 0 01-2 2h-6a2 2 0 01-2-2v-1.268a2 2 0 01-.586-1.414L4.586 12.682A2 2 0 014 11.268V9a2 2 0 012-2h3V6a3 3 0 013-3z"
                  />
                </svg>
                Cross-Store Expense
              </button>
            )}
          <button
            onClick={() => setShowAddExpenseModal(true)}
            className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49] transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Expense Entry
          </button>
        </div>
      </div>

      {(user?.role === 'admin' || user?.role === 'super_admin') && selectedStore && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Cross-Store Expenses</h2>
              <p className="text-sm text-gray-500">
                Expenses paid by {selectedStore.name} for other stores (or received from others).
              </p>
            </div>
            <button
              onClick={() => loadCrossStorePayments(selectedStore.id)}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={crossStoreLoading}
            >
              <svg
                className={`w-4 h-4 ${crossStoreLoading ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5 19A9 9 0 0119 5" />
              </svg>
              Refresh
            </button>
          </div>
          {crossStoreExpensePendingAllocations.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium text-orange-700">
                {crossStoreExpensePendingSummaryText}
              </span>
            </div>
          )}
          {crossStoreError && (
            <div className="mb-3 text-sm text-red-600">
              {crossStoreError}
            </div>
          )}
          {crossStoreLoading ? (
            <div className="py-6 text-center text-sm text-gray-500">Loading cross-store expenses...</div>
          ) : crossStorePayments.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">
              No cross-store expenses recorded for this store yet.
            </div>
          ) : (
            <div className="space-y-4">
              {crossStorePayments.map((payment) => {
                const isSourceStore = payment.source_store_id === selectedStore.id;
                return (
                  <div key={payment.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-600">
                          Payment Method: <span className="capitalize">{payment.payment_method}</span>
                          {payment.payment_reference && (
                            <span className="ml-2 text-gray-500">Ref: {payment.payment_reference}</span>
                          )}
                        </div>
                        {payment.paid_to && (
                          <div className="text-sm text-gray-600">
                            Paid to: {payment.paid_to}
                          </div>
                        )}
                        <div className="mt-1 text-xs text-gray-500">
                          Source Store: {payment.source_store_name || 'Unknown'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500 uppercase tracking-wide">Total</div>
                        <div className="text-lg font-semibold text-gray-900">
                          {formatCurrency(payment.amount)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 space-y-3">
                      {payment.allocations.map((allocation) => {
                        const statusLabel =
                          allocation.reimbursement_required === false
                            ? 'Not Required'
                            : allocation.reimbursement_status === 'completed'
                              ? 'Reimbursed'
                              : 'Pending';
                        const statusClass =
                          allocation.reimbursement_required === false
                            ? 'bg-gray-100 text-gray-600'
                            : allocation.reimbursement_status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-orange-100 text-orange-700';
                        const isPending =
                          allocation.reimbursement_required !== false &&
                          allocation.reimbursement_status !== 'completed';
                        const isCompleted =
                          allocation.reimbursement_required !== false &&
                          allocation.reimbursement_status === 'completed';
                      const isTargetStore = allocation.target_store_id === selectedStore.id;
                      const allocationPercentage = parseFloat(allocation.allocation_percentage);
                        return (
                          <div key={allocation.id} className="border border-gray-200 bg-white rounded-md p-3 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="font-medium text-gray-900">
                                  {allocation.target_store_name || 'Target Store'}
                                  {isSourceStore && !isTargetStore && (
                                    <span className="ml-2 text-xs uppercase tracking-wide text-purple-600">
                                      Due from {allocation.target_store_name || 'store'}
                                    </span>
                                  )}
                                  {!isSourceStore && isTargetStore && (
                                    <span className="ml-2 text-xs uppercase tracking-wide text-blue-600">
                                      Paid by {payment.source_store_name || 'store'}
                                    </span>
                                  )}
                                </div>
                                {allocation.expense_type_name && (
                                  <div className="text-xs text-gray-500">
                                    Expense Type: {allocation.expense_type_name}
                                  </div>
                                )}
                                {allocation.expense_entry_date && (
                                  <div className="text-xs text-gray-500">
                                    Recorded on {formatDate(allocation.expense_entry_date)}
                                  </div>
                                )}
                                {allocation.memo && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Note: {allocation.memo}
                                  </div>
                                )}
                                {allocation.expense_notes && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Expense Notes: {allocation.expense_notes}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-semibold text-gray-900">
                                  {formatCurrency(allocation.allocated_amount)}
                                </div>
                                {Number.isFinite(allocationPercentage) && (
                                  <div className="text-xs text-gray-500">
                                    ({allocationPercentage.toFixed(2)}%)
                                  </div>
                                )}
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}>
                                  {statusLabel}
                                </span>
                              </div>
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
                                    handleUpdateCrossStoreAllocationStatus(
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
                                    handleUpdateCrossStoreAllocationStatus(
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
                                    handleUpdateCrossStoreAllocationStatus(
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
                              {allocation.reimbursement_required === false && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateCrossStoreAllocationStatus(
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
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-4">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'all'
                  ? 'border-[#2d8659] text-[#2d8659]'
                  : 'border-transparent text-gray-600 hover:text-[#2d8659] hover:border-[#2d8659]'
              }`}
            >
              All Expenses
            </button>
            <button
              onClick={() => setActiveTab('pending-reimbursements')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors relative ${
                activeTab === 'pending-reimbursements'
                  ? 'border-[#2d8659] text-[#2d8659]'
                  : 'border-transparent text-gray-600 hover:text-[#2d8659] hover:border-[#2d8659]'
              }`}
            >
              Pending Reimbursements
              {pendingReimbursements.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                  {pendingReimbursements.length}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Filters and Search Section */}
      {activeTab === 'all' && (
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

            {/* Expense Type Filter */}
            <div className="flex-1 min-w-[150px]">
              <select
                value={filters.expense_type}
                onChange={(e) => setFilters({ ...filters, expense_type: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
              >
                <option value="">All Expense Types</option>
                {expenseTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.expense_type_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method Filter */}
            <div className="flex-1 min-w-[150px]">
              <select
                value={filters.payment_method}
                onChange={(e) => setFilters({ ...filters, payment_method: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
              >
                <option value="">All Payment Methods</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="check">Check</option>
                <option value="card">Card</option>
              </select>
            </div>

            {/* Reimbursement Status Filter */}
            <div className="flex-1 min-w-[150px]">
              <select
                value={filters.reimbursement_status}
                onChange={(e) => setFilters({ ...filters, reimbursement_status: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
              >
                <option value="">All Reimbursement Status</option>
                <option value="none">Not Reimbursable</option>
                <option value="pending">Pending Reimbursement</option>
                <option value="reimbursed">Reimbursed</option>
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
          {(filters.expense_type || filters.payment_method || filters.reimbursement_status || filters.period !== 'This Month' || filters.dateRange.start || filters.dateRange.end) && (
            <div className="mb-2">
              <button
                onClick={() => {
                  setFilters({
                    period: 'This Month',
                    expense_type: '',
                    payment_method: '',
                    reimbursement_status: '',
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
      )}

      {/* Cross-Store Expense Modal */}
      {showCrossStoreExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Record Cross-Store Expense</h2>
                <p className="text-sm text-gray-500">
                  Track an expense that was paid from one store but should be allocated to other stores you manage.
                </p>
              </div>
              <button onClick={handleCloseCrossStoreExpenseModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmitCrossStoreExpense} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Paying Store</label>
                  <select
                    value={crossStoreExpenseForm.source_store_id}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCrossStoreExpenseForm((prev) => ({
                        ...prev,
                        source_store_id: value,
                        reimbursement_to: (() => {
                          const sourceStore = (stores || []).find((store) => store.id === value);
                          return sourceStore ? sourceStore.name || '' : '';
                        })(),
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
                    value={crossStoreExpenseForm.payment_date}
                    onChange={(e) =>
                      setCrossStoreExpenseForm((prev) => ({ ...prev, payment_date: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expense Entry Date</label>
                  <input
                    type="date"
                    value={crossStoreExpenseForm.entry_date}
                    onChange={(e) =>
                      setCrossStoreExpenseForm((prev) => ({ ...prev, entry_date: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={crossStoreExpenseForm.amount}
                    onChange={(e) =>
                      setCrossStoreExpenseForm((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={crossStoreExpenseForm.payment_method}
                    onChange={(e) =>
                      setCrossStoreExpenseForm((prev) => ({ ...prev, payment_method: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent capitalize"
                  >
                    <option value="bank">Bank</option>
                    <option value="card">Card</option>
                    <option value="check">Check</option>
                    <option value="cash">Cash</option>
                    <option value="ach">ACH</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Reference <span className="text-xs text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={crossStoreExpenseForm.payment_reference}
                    onChange={(e) =>
                      setCrossStoreExpenseForm((prev) => ({ ...prev, payment_reference: e.target.value }))
                    }
                    placeholder="Check #1234 or Card ending 4321"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Paid To <span className="text-xs text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={crossStoreExpenseForm.paid_to}
                    onChange={(e) =>
                      setCrossStoreExpenseForm((prev) => ({ ...prev, paid_to: e.target.value }))
                    }
                    placeholder="Vendor or payee name"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expense Type <span className="text-xs text-gray-400">(optional)</span>
                  </label>
                  <select
                    value={crossStoreExpenseForm.expense_type_id}
                    onChange={(e) =>
                      setCrossStoreExpenseForm((prev) => ({ ...prev, expense_type_id: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  >
                    <option value="">Select expense type</option>
                    {expenseTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.expense_type_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expense Notes <span className="text-xs text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={crossStoreExpenseForm.notes}
                    onChange={(e) =>
                      setCrossStoreExpenseForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder="Note for the expense entry"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reimbursement To <span className="text-xs text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={crossStoreExpenseForm.reimbursement_to}
                    onChange={(e) =>
                      setCrossStoreExpenseForm((prev) => ({ ...prev, reimbursement_to: e.target.value }))
                    }
                    placeholder="Who should reimburse (defaults to paying store)"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Notes <span className="text-xs text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={crossStoreExpenseForm.payment_notes}
                    onChange={(e) =>
                      setCrossStoreExpenseForm((prev) => ({ ...prev, payment_notes: e.target.value }))
                    }
                    placeholder="Note for the payment record"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <div className="flex flex-col gap-3 mb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">Allocate to stores</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Split By:</span>
                      <div className="inline-flex rounded-md shadow-sm border border-gray-200 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => handleCrossStoreExpenseSplitModeChange('amount')}
                          className={`px-3 py-1.5 text-sm font-medium ${
                            isCrossStoreExpensePercentageMode
                              ? 'bg-white text-gray-600 hover:bg-gray-50'
                              : 'bg-purple-600 text-white'
                          }`}
                        >
                          Dollar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCrossStoreExpenseSplitModeChange('percentage')}
                          className={`px-3 py-1.5 text-sm font-medium ${
                            isCrossStoreExpensePercentageMode
                              ? 'bg-purple-600 text-white'
                              : 'bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          Percentage
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCrossStoreExpenseAllocation}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Allocation
                  </button>
                </div>
                {crossStoreExpenseForm.allocations.length === 0 ? (
                  <div className="p-4 border border-dashed border-gray-300 rounded-md text-sm text-gray-500">
                    Add at least one target store allocation.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {crossStoreExpenseForm.allocations.map((allocation, index) => {
                      const availableStores = (stores || []).filter(
                        (store) => store.is_active !== false && !store.deleted_at
                      );
                      return (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-1">Target Store</label>
                              <select
                                value={allocation.target_store_id}
                                onChange={(e) =>
                                  handleUpdateCrossStoreExpenseAllocation(index, 'target_store_id', e.target.value)
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
                            {isCrossStoreExpensePercentageMode ? (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Percentage</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={allocation.percentage}
                                  onChange={(e) =>
                                    handleUpdateCrossStoreExpenseAllocation(index, 'percentage', e.target.value)
                                  }
                                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                  Amount: {formatCurrency(crossStoreExpenseAllocationAmounts[index] || 0)}
                                </p>
                              </div>
                            ) : (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={allocation.allocated_amount}
                                  onChange={(e) =>
                                    handleUpdateCrossStoreExpenseAllocation(index, 'allocated_amount', e.target.value)
                                  }
                                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                  {Number.isFinite(crossStoreExpenseAllocationPercentages[index])
                                    ? `≈ ${crossStoreExpenseAllocationPercentages[index].toFixed(2)}%`
                                    : 'Percentage shown after totals entered'}
                                </p>
                              </div>
                            )}
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Notes <span className="text-xs text-gray-400">(optional)</span>
                              </label>
                              <input
                                type="text"
                                value={allocation.memo}
                                onChange={(e) =>
                                  handleUpdateCrossStoreExpenseAllocation(index, 'memo', e.target.value)
                                }
                                placeholder="Describe this allocation"
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                              />
                            </div>
                            <div className="md:col-span-5">
                              <label className="inline-flex items-center text-sm text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={allocation.reimbursement_required !== false}
                                  onChange={(e) =>
                                    handleUpdateCrossStoreExpenseAllocation(
                                      index,
                                      'reimbursement_required',
                                      e.target.checked
                                    )
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
                                  handleUpdateCrossStoreExpenseAllocation(
                                    index,
                                    'reimbursement_note',
                                    e.target.value
                                  )
                                }
                                placeholder="Add a note for the receiving store"
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                              />
                            </div>
                          </div>
                          {crossStoreExpenseForm.allocations.length > 1 && (
                            <div className="mt-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveCrossStoreExpenseAllocation(index)}
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
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(crossStoreExpenseAllocatedTotal)}
                  </span>
                </div>
                <div
                  className={`text-sm font-semibold ${
                    crossStoreExpenseDifferenceWithinTolerance ? 'text-green-600' : 'text-orange-600'
                  }`}
                >
                  Remaining Difference:{' '}
                  {formatCurrency(crossStoreExpenseDifference)}
                </div>
              {!crossStoreExpenseDifferenceWithinTolerance &&
                crossStoreExpenseDifference > 0.01 &&
                !hasSourceExpenseAllocation &&
                crossStoreExpenseSourceStore && (
                  <div className="text-xs text-gray-500">
                    The remaining difference will be automatically allocated to {crossStoreExpenseSourceStore.name} when
                    you save.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseCrossStoreExpenseModal}
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
                  {crossStoreSubmitting ? 'Saving...' : 'Save Cross-Store Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expense Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recurring
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reimbursement
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : paginatedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center">
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
                        onClick={() => setShowAddExpenseModal(true)}
                        className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49] transition-colors flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Expense Entry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(expense.entry_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.expense_type_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="capitalize">{expense.payment_method || '-'}</span>
                      {expense.is_autopay && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                          Autopay
                        </span>
                      )}
                      {expense.paid_by_store_name && expense.paid_by_store_name !== selectedStore?.name && (
                        <div className="text-xs text-purple-600 mt-1">
                          Paid by {expense.paid_by_store_name}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.bank_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.is_recurring ? (
                        <span className="capitalize">{expense.recurring_frequency || 'Recurring'}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {expense.reimbursement_status === 'pending' ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Pending: {expense.reimbursement_to}
                        </span>
                      ) : expense.reimbursement_status === 'reimbursed' ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Reimbursed
                          {expense.reimbursement_date && (
                            <span className="ml-1">({formatDate(expense.reimbursement_date)})</span>
                          )}
                        </span>
                      ) : (
                        '-'
                      )}
                      {expense.cross_store_reimbursement_status && (
                        <div className="mt-1 text-xs text-gray-500">
                          Cross-store status:{' '}
                          {expense.cross_store_reimbursement_status === 'completed'
                            ? 'Reimbursed'
                            : expense.cross_store_reimbursement_status === 'not_required'
                              ? 'Not required'
                              : 'Pending'}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {expense.notes || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEditExpense(expense)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                        {expense.reimbursement_status === 'pending' && (
                          <button 
                            onClick={() => handleReimburse(expense)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Reimburse
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {paginatedExpenses.length > 0 && totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Showing {(currentPage - 1) * entriesPerPage + 1} to{' '}
              {Math.min(currentPage * entriesPerPage, filteredExpenses.length)} of{' '}
              {filteredExpenses.length} entries
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

      {/* Add Expense Modal */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Add Expense Entry</h2>
              <button
                onClick={() => {
                  setShowAddExpenseModal(false);
                  resetExpenseForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {renderExpenseForm(false)}
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {showEditModal && editingExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Edit Expense Entry</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingExpense(null);
                  resetExpenseForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {renderExpenseForm(true)}
          </div>
        </div>
      )}

      {/* Reimburse Modal */}
      {showReimburseModal && reimbursingExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Reimburse Expense</h2>
              <button
                onClick={() => {
                  setShowReimburseModal(false);
                  setReimbursingExpense(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Expense Type</p>
              <p className="font-medium">{reimbursingExpense.expense_type_name}</p>
              <p className="text-sm text-gray-600 mb-1 mt-2">Amount</p>
              <p className="font-medium">{formatCurrency(reimbursingExpense.amount)}</p>
              <p className="text-sm text-gray-600 mb-1 mt-2">To</p>
              <p className="font-medium">{reimbursingExpense.reimbursement_to}</p>
            </div>

            <form onSubmit={handleSubmitReimbursement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reimbursement Date *
                </label>
                <input
                  type="date"
                  value={reimburseForm.reimbursement_date}
                  onChange={(e) => setReimburseForm({ ...reimburseForm, reimbursement_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reimbursement Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={reimburseForm.reimbursement_amount}
                  onChange={(e) => setReimburseForm({ ...reimburseForm, reimbursement_amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                  required
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowReimburseModal(false);
                    setReimbursingExpense(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2d8659] text-white rounded-md hover:bg-[#256b49]"
                >
                  Mark as Reimbursed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperatingExpenses;
