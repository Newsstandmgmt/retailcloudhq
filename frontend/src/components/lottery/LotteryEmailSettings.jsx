import { useState, useEffect } from 'react';
import { lotteryEmailOAuthAPI, lotteryDailyReportsAPI, lotteryReportMappingsAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const LotteryEmailSettings = ({ storeId }) => {
  const { user, loading: authLoading } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [recentReports, setRecentReports] = useState([]);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [ruleForm, setRuleForm] = useState({
    report_type: 'daily',
    to_address: '',
    subject_contains: '',
    sender_contains: '',
    retailer_number: '',
    label_id: '',
    label_name: '',
    include_read: false
  });
  const [isEditingRule, setIsEditingRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [ruleSubmitting, setRuleSubmitting] = useState(false);
  const [labelsByAccount, setLabelsByAccount] = useState({});
  const [labelsLoading, setLabelsLoading] = useState(false);
  const [labelsError, setLabelsError] = useState(null);
  const [alert, setAlert] = useState(null);
  const [showDeleteRuleModal, setShowDeleteRuleModal] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState(null);
  const [deleteMode, setDeleteMode] = useState('rule');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [mappings, setMappings] = useState([]);
  const [mappingsLoading, setMappingsLoading] = useState(false);
  const [mappingForm, setMappingForm] = useState({
    id: null,
    report_type: 'daily',
    source_column: '',
    target_type: 'daily_revenue',
    target_field: '',
    data_type: 'number',
    formula_expression: '',
    notes: ''
  });
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [availableColumns, setAvailableColumns] = useState([]);
  const [availableColumnsLoading, setAvailableColumnsLoading] = useState(false);
  const [mappingSubmitting, setMappingSubmitting] = useState(false);
  const [mappingError, setMappingError] = useState(null);

  useEffect(() => {
    // Only load accounts if user is authenticated
    if (!authLoading && user && storeId) {
      loadAccounts();
      loadRecentReports();
      loadMappings();
    }
  }, [storeId, user, authLoading]);

  const loadAccounts = async () => {
    if (!user || !storeId) {
      console.log('loadAccounts: Missing user or storeId', { user: !!user, storeId });
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      console.log('loadAccounts: Token check', { hasToken: !!token, tokenLength: token?.length });
      
      if (!token) {
        setAlert({ type: 'error', message: 'Please log in to view email accounts' });
        setLoading(false);
        return;
      }

      console.log('loadAccounts: Making API call', { storeId });
      const response = await lotteryEmailOAuthAPI.getAccounts(storeId);
      console.log('loadAccounts: Success', response.data);
      setAccounts(response.data.accounts || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
      console.error('Error response:', error.response);
      if (error.response?.status === 401) {
        setAlert({ type: 'error', message: 'Session expired. Please log in again.' });
        // Redirect to login
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        setAlert({ type: 'error', message: error.response?.data?.error || 'Failed to load email accounts' });
      }
    } finally {
      setLoading(false);
    }
  };

  const loadRecentReports = async () => {
    if (!user || !storeId) return;

    setReportsLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setReportsLoading(false);
        return;
      }

      const response = await lotteryDailyReportsAPI.getByStore(storeId, { limit: 10 });
      setRecentReports(response.data.reports || []);
    } catch (error) {
      console.error('Error loading lottery reports:', error);
    } finally {
      setReportsLoading(false);
    }
  };

  const loadMappings = async () => {
    if (!user || !storeId) return;
    setMappingsLoading(true);
    try {
      const response = await lotteryReportMappingsAPI.list(storeId, { reportType: 'daily' });
      setMappings(response.data.mappings || []);
    } catch (error) {
      console.error('Error loading mappings:', error);
      setAlert({ type: 'error', message: error.response?.data?.error || 'Failed to load mappings' });
    } finally {
      setMappingsLoading(false);
    }
  };

  const loadAvailableColumns = async (reportType = 'daily') => {
    if (!user || !storeId) return;
    setAvailableColumnsLoading(true);
    try {
      const response = await lotteryReportMappingsAPI.availableColumns(storeId, { reportType, limit: 15 });
      setAvailableColumns(response.data.columns || []);
    } catch (error) {
      console.error('Error loading columns:', error);
      setAvailableColumns([]);
    } finally {
      setAvailableColumnsLoading(false);
    }
  };

  const resetMappingForm = () => {
    setMappingForm({
      id: null,
      report_type: 'daily',
      source_column: '',
      target_type: 'daily_revenue',
      target_field: '',
      data_type: 'number',
      formula_expression: '',
      notes: ''
    });
    setMappingError(null);
  };

  const handleOpenMappingModal = async (mapping = null) => {
    if (mapping) {
      setMappingForm({
        id: mapping.id,
        report_type: mapping.report_type || 'daily',
        source_column: mapping.source_column || '',
        target_type: mapping.target_type || 'daily_revenue',
        target_field: mapping.target_field || '',
        data_type: mapping.data_type || 'number',
        formula_expression: mapping.formula_expression || '',
        notes: mapping.notes || ''
      });
    } else {
      resetMappingForm();
    }

    await loadAvailableColumns(mapping ? mapping.report_type : 'daily');
    setShowMappingModal(true);
  };

  const handleCloseMappingModal = () => {
    setShowMappingModal(false);
    resetMappingForm();
  };

  const handleSubmitMapping = async (e) => {
    e.preventDefault();
    if (!mappingForm.source_column) {
      setMappingError('Select a source column from the imported CSV.');
      return;
    }
    if (!mappingForm.target_field) {
      setMappingError('Target field is required.');
      return;
    }

    setMappingSubmitting(true);
    setMappingError(null);

    try {
      if (mappingForm.id) {
        await lotteryReportMappingsAPI.update(mappingForm.id, {
          report_type: mappingForm.report_type,
          source_column: mappingForm.source_column,
          target_type: mappingForm.target_type,
          target_field: mappingForm.target_field,
          data_type: mappingForm.data_type,
        formula_expression: mappingForm.formula_expression,
          notes: mappingForm.notes
        });
        setAlert({ type: 'success', message: 'Mapping updated successfully.' });
      } else {
        await lotteryReportMappingsAPI.create(storeId, {
          report_type: mappingForm.report_type,
          source_column: mappingForm.source_column,
          target_type: mappingForm.target_type,
          target_field: mappingForm.target_field,
          data_type: mappingForm.data_type,
        formula_expression: mappingForm.formula_expression,
          notes: mappingForm.notes
        });
        setAlert({ type: 'success', message: 'Mapping created successfully.' });
      }

      handleCloseMappingModal();
      await loadMappings();
      await loadRecentReports();
    } catch (error) {
      console.error('Error saving mapping:', error);
      const message =
        error.response?.data?.error ||
        error.response?.data?.details ||
        'Failed to save mapping';
      setMappingError(message);
      setAlert({ type: 'error', message });
    } finally {
      setMappingSubmitting(false);
    }
  };

  const handleDeleteMapping = async (mappingId) => {
    if (!window.confirm('Delete this mapping? This will stop auto-populating the mapped field.')) {
      return;
    }

    try {
      await lotteryReportMappingsAPI.delete(mappingId);
      setAlert({ type: 'success', message: 'Mapping deleted successfully.' });
      await loadMappings();
    } catch (error) {
      console.error('Error deleting mapping:', error);
      const message =
        error.response?.data?.error ||
        error.response?.data?.details ||
        'Failed to delete mapping';
      setAlert({ type: 'error', message });
    }
  };

  const handleConnectGmail = async () => {
    try {
      // Check if token exists
      const token = localStorage.getItem('token');
      console.log('handleConnectGmail: Token check', { hasToken: !!token, tokenLength: token?.length, user: !!user, storeId });
      
      if (!token) {
        setAlert({ type: 'error', message: 'Please log in to connect Gmail. Token not found in localStorage.' });
        return;
      }

      if (!user) {
        setAlert({ type: 'error', message: 'User not authenticated. Please refresh the page and log in again.' });
        return;
      }

      console.log('handleConnectGmail: Making API call', { storeId });
      const response = await lotteryEmailOAuthAPI.getAuthUrl(storeId);
      console.log('handleConnectGmail: Success, redirecting to:', response.data.authUrl);
      // Redirect to Google OAuth
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Error getting auth URL:', error);
      console.error('Error response:', error.response);
      if (error.response?.status === 401) {
        setAlert({ type: 'error', message: 'Session expired. Please log in again.' });
      } else {
        setAlert({ type: 'error', message: error.response?.data?.error || 'Failed to initiate Gmail connection' });
      }
    }
  };

  const resetRuleForm = () => {
    setRuleForm({
      report_type: 'daily',
      to_address: '',
      subject_contains: '',
      sender_contains: '',
      retailer_number: '',
      label_id: '',
      label_name: '',
      include_read: false
    });
    setIsEditingRule(false);
    setEditingRuleId(null);
  };

  const openCreateRuleModal = (account) => {
    setSelectedAccount(account);
    resetRuleForm();
    setShowRuleModal(true);
    if (account && !labelsByAccount[account.id]) {
      loadLabelsForAccount(account.id);
    }
  };

  const openEditRuleModal = (account, rule) => {
    setSelectedAccount(account);
    setRuleForm({
      report_type: rule.report_type || 'daily',
      to_address: rule.to_address || '',
      subject_contains: rule.subject_contains || '',
      sender_contains: rule.sender_contains || '',
      retailer_number: rule.retailer_number || '',
      label_id: rule.label_id || '',
      label_name: rule.label_name || '',
      include_read: !!rule.include_read
    });
    setIsEditingRule(true);
    setEditingRuleId(rule.id);
    setShowRuleModal(true);
    if (account && !labelsByAccount[account.id]) {
      loadLabelsForAccount(account.id);
    }
  };

  const handleSubmitRule = async (e) => {
    e.preventDefault();
    if (!selectedAccount) {
      setAlert({ type: 'error', message: 'No email account selected' });
      return;
    }

    setRuleSubmitting(true);
    try {
      if (isEditingRule && editingRuleId) {
        await lotteryEmailOAuthAPI.updateRule(editingRuleId, ruleForm);
        setAlert({ type: 'success', message: 'Email rule updated successfully' });
      } else {
        await lotteryEmailOAuthAPI.createRule(selectedAccount.id, ruleForm);
        setAlert({ type: 'success', message: 'Email rule created successfully' });
      }
      setShowRuleModal(false);
      resetRuleForm();
      loadAccounts();
    } catch (error) {
      console.error('Error creating rule:', error);
      const message =
        error.response?.data?.error ||
        error.response?.data?.details ||
        'Failed to save rule';
      setAlert({ type: 'error', message });
    } finally {
      setRuleSubmitting(false);
    }
  };

  const handleOpenDeleteRuleModal = (account, rule) => {
    setSelectedAccount(account);
    setRuleToDelete(rule);
    setDeleteMode('rule');
    setDeleteConfirmText('');
    setDeleteError(null);
    setShowDeleteRuleModal(true);
  };

  const handleCloseDeleteRuleModal = () => {
    setShowDeleteRuleModal(false);
    setRuleToDelete(null);
    setDeleteConfirmText('');
    setDeleteError(null);
  };

  const handleConfirmDeleteRule = async () => {
    if (!ruleToDelete) {
      return;
    }

    if (deleteMode === 'data' && deleteConfirmText.trim() !== 'DELETE') {
      setDeleteError('Type DELETE to confirm full deletion.');
      return;
    }

    setDeleteSubmitting(true);
    setDeleteError(null);

    try {
      await lotteryEmailOAuthAPI.deleteRule(ruleToDelete.id, {
        deleteData: deleteMode === 'data',
        confirmText: deleteMode === 'data' ? deleteConfirmText.trim() : undefined
      });

      setAlert({
        type: 'success',
        message:
          deleteMode === 'data'
            ? 'Email rule and imported data deleted successfully.'
            : 'Email rule deleted successfully.'
      });

      handleCloseDeleteRuleModal();
      await loadAccounts();
      if (deleteMode === 'data') {
        await loadRecentReports();
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
      const message =
        error.response?.data?.error ||
        error.response?.data?.details ||
        'Failed to delete rule';
      setDeleteError(message);
      setAlert({ type: 'error', message });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const loadLabelsForAccount = async (accountId) => {
    if (!accountId) return;
    setLabelsLoading(true);
    setLabelsError(null);
    try {
      const response = await lotteryEmailOAuthAPI.getLabels(accountId);
      setLabelsByAccount((prev) => ({
        ...prev,
        [accountId]: response.data.labels || []
      }));
    } catch (error) {
      console.error('Error loading Gmail labels:', error);
      setLabelsError(error.response?.data?.error || 'Failed to load Gmail labels');
    } finally {
      setLabelsLoading(false);
    }
  };

  const handleCloseRuleModal = () => {
    setShowRuleModal(false);
    setSelectedAccount(null);
    resetRuleForm();
  };

  useEffect(() => {
    if (showRuleModal && selectedAccount && !labelsByAccount[selectedAccount.id]) {
      loadLabelsForAccount(selectedAccount.id);
    }
  }, [showRuleModal, selectedAccount]);

  useEffect(() => {
    if (showMappingModal) {
      loadAvailableColumns(mappingForm.report_type);
    }
  }, [showMappingModal, mappingForm.report_type]);

  const availableLabels = selectedAccount ? labelsByAccount[selectedAccount.id] || [] : [];

  const handleCheckEmails = async (accountId) => {
    try {
      const response = await lotteryEmailOAuthAPI.checkEmails(accountId);
      setAlert({ 
        type: 'success', 
        message: `Checked emails. Processed ${response.data.processedCount} email(s).` 
      });
      loadAccounts();
      loadRecentReports();
    } catch (error) {
      console.error('Error checking emails:', error);
      setAlert({ type: 'error', message: 'Failed to check emails' });
    }
  };

  const handleDisconnect = async (accountId) => {
    if (!window.confirm('Are you sure you want to disconnect this email account?')) {
      return;
    }
    try {
      await lotteryEmailOAuthAPI.disconnect(accountId);
      setAlert({ type: 'success', message: 'Email account disconnected' });
      loadAccounts();
    } catch (error) {
      console.error('Error disconnecting:', error);
      setAlert({ type: 'error', message: 'Failed to disconnect account' });
    }
  };

  const reportTypes = [
    { value: 'daily', label: 'Daily Sales Report' },
    { value: 'weekly', label: 'Weekly Sales Report' },
    { value: 'settlement', label: 'Weekly Settlement Report' },
    { value: '13week', label: '13 Week Average Report' },
  ];

  const dailyRevenueFieldOptions = [
    { value: 'total_cash', label: 'Total Cash' },
    { value: 'cash_adjustment', label: 'Cash Adjustment' },
    { value: 'business_credit_card', label: 'Business Credit Card' },
    { value: 'credit_card_transaction_fees', label: 'Credit Card Fees' },
    { value: 'online_sales', label: 'Online Sales' },
    { value: 'online_net', label: 'Online Net' },
    { value: 'total_instant', label: 'Total Instant' },
    { value: 'total_instant_adjustment', label: 'Instant Adjustment' },
    { value: 'instant_pay', label: 'Instant Pay' },
    { value: 'lottery_credit_card', label: 'Lottery Credit Card' },
    { value: 'sales_tax_amount', label: 'Sales Tax Amount' },
    { value: 'other_cash_expense', label: 'Other Cash Expense' },
    { value: 'weekly_lottery_due', label: 'Weekly Lottery Due' },
    { value: 'weekly_lottery_commission', label: 'Weekly Lottery Commission' },
    { value: 'thirteen_week_average', label: '13 Week Average' },
  ];

  if (authLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-yellow-800">Please log in to configure email auto-import.</p>
      </div>
    );
  }

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
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Email Auto-Import Setup</h3>
          <button
            onClick={handleConnectGmail}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.146C21.69 2.28 24 3.434 24 5.457z"/>
            </svg>
            Connect Gmail
          </button>
        </div>

        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-blue-800">
            <strong>How it works:</strong> Connect your Gmail account that receives lottery reports from your state. 
            The system will automatically check for new emails every 15 minutes and process any CSV attachments.
            You can set up rules to match specific report types by subject or sender.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading email accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-4">No email accounts connected yet.</p>
            <button
              onClick={handleConnectGmail}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Connect Your Gmail Account
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active accounts first */}
            {accounts.filter(acc => acc.is_active !== false).map((account) => (
              <div key={account.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-semibold text-lg">{account.email_address}</h4>
                    <p className="text-sm text-gray-600">
                      Provider: {account.provider} | 
                      Last checked: {account.last_checked_at 
                        ? new Date(account.last_checked_at).toLocaleString()
                        : 'Never'}
                    </p>
                    {account.is_active === false && (
                      <p className="text-sm text-yellow-600 mt-1">⚠️ Disconnected</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {account.is_active !== false && (
                      <button
                        onClick={() => handleCheckEmails(account.id)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Check Now
                      </button>
                    )}
                    <button
                      onClick={() => handleDisconnect(account.id)}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                    >
                      {account.is_active === false ? 'Remove' : 'Disconnect'}
                    </button>
                  </div>
                </div>

                {/* Rules */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h5 className="font-medium">Email Rules</h5>
                    <button
                      onClick={() => openCreateRuleModal(account)}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                    >
                      + Add Rule
                    </button>
                  </div>
                  
                  {account.rules && account.rules.length > 0 ? (
                    <div className="space-y-2">
                      {account.rules.map((rule) => (
                        <div key={rule.id} className="bg-gray-50 p-3 rounded">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                            <span className="font-medium">{reportTypes.find(r => r.value === rule.report_type)?.label}</span>
                            {rule.to_address && (
                              <span className="text-sm text-gray-600 ml-2">Inbox: {rule.to_address}</span>
                            )}
                            {rule.subject_contains && (
                              <span className="text-sm text-gray-600 ml-2">Subject: "{rule.subject_contains}"</span>
                            )}
                            {rule.sender_contains && (
                              <span className="text-sm text-gray-600 ml-2">From: {rule.sender_contains}</span>
                            )}
                            {rule.retailer_number && (
                              <span className="text-sm text-gray-600 ml-2">Retailer: {rule.retailer_number}</span>
                            )}
                            {rule.label_name && (
                              <span className="text-sm text-gray-600 ml-2">Label: {rule.label_name}</span>
                            )}
                            {rule.include_read && (
                              <span className="text-sm text-gray-600 ml-2">Reads: All</span>
                            )}
                          </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded text-xs ${
                                rule.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {rule.is_active ? 'Active' : 'Inactive'}
                              </span>
                              <button
                                onClick={() => openEditRuleModal(account, rule)}
                                className="px-2 py-1 text-xs border border-blue-200 text-blue-700 rounded hover:bg-blue-50"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleOpenDeleteRuleModal(account, rule)}
                                className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No rules configured. Click "Add Rule" to set up email processing.</p>
                  )}
                </div>
              </div>
            ))}
            
            {/* Disconnected accounts (if any) */}
            {accounts.filter(acc => acc.is_active === false).length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-300">
                <h4 className="text-sm font-semibold text-gray-600 mb-4">Disconnected Accounts</h4>
                {accounts.filter(acc => acc.is_active === false).map((account) => (
                  <div key={account.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50 mb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-lg text-gray-600">{account.email_address}</h4>
                        <p className="text-sm text-gray-500">Disconnected</p>
                      </div>
                      <button
                        onClick={() => handleDisconnect(account.id)}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Lottery Column Mapping</h3>
          <button
            onClick={() => handleOpenMappingModal()}
            className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
          >
            + Add Mapping
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Map CSV columns from the imported lottery reports to Daily Revenue fields or custom lottery metrics. These
          mappings run automatically after each email import.
        </p>
        {mappingsLoading ? (
          <div className="text-center py-4 text-gray-500">Loading mappings...</div>
        ) : mappings.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-md p-6 text-center text-sm text-gray-500">
            No mappings created yet. Click &ldquo;Add Mapping&rdquo; to start linking CSV columns to revenue fields.
          </div>
        ) : (
          <div className="space-y-3">
            {mappings.map((mapping) => (
              <div key={mapping.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-sm text-gray-600">
                      <span className="font-semibold text-gray-800">{mapping.source_column}</span>
                      <span className="mx-2 text-gray-400">→</span>
                      <span className="font-medium text-gray-800">
                        {mapping.target_type === 'daily_revenue' ? `Daily Revenue: ${mapping.target_field}` : `Lottery Field: ${mapping.target_field}`}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Report: {reportTypes.find((r) => r.value === mapping.report_type)?.label || mapping.report_type}
                      {' · '}
                      Data Type: {mapping.data_type || 'number'}
                      {mapping.formula_expression ? ` · Formula: ${mapping.formula_expression}` : ''}
                      {mapping.notes ? ` · Notes: ${mapping.notes}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenMappingModal(mapping)}
                      className="px-2 py-1 text-xs border border-blue-200 text-blue-700 rounded hover:bg-blue-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteMapping(mapping.id)}
                      className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Recent Lottery Daily Reports</h3>
          <button
            onClick={loadRecentReports}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
        {reportsLoading ? (
          <div className="text-center py-6 text-gray-500">Loading reports...</div>
        ) : recentReports.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            No reports imported yet. Once emails are processed, they will appear here.
          </div>
        ) : (
          <div className="space-y-3">
            {recentReports.map((report) => {
              const columns = Array.isArray(report.data?.__columns)
                ? report.data.__columns.filter((key) => key !== '__columns')
                : Object.keys(report.data || {}).filter((key) => key !== '__columns');
              const previewEntries = columns.slice(0, 4).map((key) => `${key}: ${report.data?.[key]}`).join(' | ');

              return (
                <div key={report.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-gray-800">
                        {report.report_date ? new Date(report.report_date).toLocaleDateString() : 'Unknown Date'}
                      </h4>
                      <p className="text-sm text-gray-600">
                        File: {report.filename || 'N/A'} • Retailer: {report.retailer_number || 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Imported: {report.created_at ? new Date(report.created_at).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                    <div className="text-sm text-gray-700">
                      <p>Columns Detected: {columns.length}</p>
                      {previewEntries && (
                        <p className="text-xs text-gray-500 mt-1">
                          Sample: {previewEntries}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showMappingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">
              {mappingForm.id ? 'Edit Column Mapping' : 'Add Column Mapping'}
            </h3>
            <form onSubmit={handleSubmitMapping} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
                  <select
                    value={mappingForm.report_type}
                    onChange={(e) => setMappingForm({ ...mappingForm, report_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    {reportTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source Column <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={mappingForm.source_column}
                    onChange={(e) => setMappingForm({ ...mappingForm, source_column: e.target.value })}
                    list="available-columns"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Select or type column name"
                    required
                  />
                  <datalist id="available-columns">
                    {availableColumns.map((col) => (
                      <option key={col} value={col} />
                    ))}
                  </datalist>
                  <p className="text-xs text-gray-500 mt-1">
                    Columns detected from recent imports. {availableColumnsLoading ? 'Refreshing list…' : ''}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={mappingForm.target_type}
                    onChange={(e) => setMappingForm({ ...mappingForm, target_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="daily_revenue">Daily Revenue Field</option>
                    <option value="lottery_field">Lottery Custom Field</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Field <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={mappingForm.target_field}
                    onChange={(e) => setMappingForm({ ...mappingForm, target_field: e.target.value })}
                    list={mappingForm.target_type === 'daily_revenue' ? 'daily-revenue-fields' : undefined}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder={
                      mappingForm.target_type === 'daily_revenue'
                        ? 'e.g., lottery_credit_card'
                        : 'e.g., total_due'
                    }
                    required
                  />
                  {mappingForm.target_type === 'daily_revenue' && (
                    <datalist id="daily-revenue-fields">
                      {dailyRevenueFieldOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </datalist>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {mappingForm.target_type === 'daily_revenue'
                      ? 'Enter the column name from Daily Revenue you want to update.'
                      : 'Provide a key to store within the lottery report mapped values.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Type</label>
                  <select
                    value={mappingForm.data_type}
                    onChange={(e) => setMappingForm({ ...mappingForm, data_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="number">Number</option>
                    <option value="string">String</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    value={mappingForm.notes}
                    onChange={(e) => setMappingForm({ ...mappingForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Formula (optional)
                </label>
                <textarea
                  value={mappingForm.formula_expression}
                  onChange={(e) => setMappingForm({ ...mappingForm, formula_expression: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Example: {{Card Trans}} + {{Draw Sales}} - {{Scratch- Offs Pays}}"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Wrap column names in double braces. Supported operators: +, -, *, /. If provided, the formula overrides
                  the single source column value. Missing columns evaluate as 0.
                </p>
                {availableColumns.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {availableColumns.map((col) => (
                      <button
                        type="button"
                        key={col}
                        onClick={() =>
                          setMappingForm((prev) => ({
                            ...prev,
                            formula_expression: `${prev.formula_expression ? `${prev.formula_expression} ` : ''}{{${col}}}`
                          }))
                        }
                        className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
                      >
                        {'{{'}
                        {col}
                        {'}}'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {mappingError && <div className="text-sm text-red-600">{mappingError}</div>}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseMappingModal}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={mappingSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={mappingSubmitting}
                  className={`px-4 py-2 rounded-md text-white ${
                    mappingSubmitting ? 'bg-purple-300 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {mappingSubmitting ? 'Saving…' : mappingForm.id ? 'Update Mapping' : 'Create Mapping'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rule Modal */}
      {showRuleModal && selectedAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">
              {isEditingRule ? 'Edit Email Rule' : 'Create Email Rule'}
            </h3>
            <form onSubmit={handleSubmitRule}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Report Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={ruleForm.report_type}
                    onChange={(e) => setRuleForm({ ...ruleForm, report_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    {reportTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monitor Inbox (Optional)
                  </label>
                  <input
                    type="email"
                    value={ruleForm.to_address}
                    onChange={(e) => setRuleForm({ ...ruleForm, to_address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., newsstandmgmt+1daily@gmail.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Specific inbox to monitor (for Gmail plus addressing). 
                    Leave empty to monitor all emails to the connected account.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject Contains (Optional)
                  </label>
                  <input
                    type="text"
                    value={ruleForm.subject_contains}
                    onChange={(e) => setRuleForm({ ...ruleForm, subject_contains: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., Daily Sales Report"
                  />
                  <p className="text-xs text-gray-500 mt-1">Match emails with subject containing this text</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sender Contains
                  </label>
                  <input
                    type="text"
                    value={ruleForm.sender_contains}
                    onChange={(e) => setRuleForm({ ...ruleForm, sender_contains: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., palottery.com, nylottery.org"
                  />
                  <p className="text-xs text-gray-500 mt-1">Match emails from this sender (e.g., palottery.com, nylottery.org)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lottery Retailer Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={ruleForm.retailer_number}
                    onChange={(e) => setRuleForm({ ...ruleForm, retailer_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="For validation"
                  />
                  <p className="text-xs text-gray-500 mt-1">Used to verify reports match this store</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gmail Label (Optional)
                  </label>
                  {labelsError && (
                    <p className="text-xs text-red-600 mb-1">{labelsError}</p>
                  )}
                  <select
                    value={ruleForm.label_id}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const label = availableLabels.find((item) => item.id === selectedId);
                      setRuleForm((prev) => ({
                        ...prev,
                        label_id: selectedId,
                        label_name: label ? label.name : ''
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    disabled={labelsLoading && !availableLabels.length}
                  >
                    <option value="">All labels (default)</option>
                    {availableLabels.map((label) => (
                      <option key={label.id} value={label.id}>
                        {label.name}
                      </option>
                    ))}
                  </select>
                  {labelsLoading && (
                    <p className="text-xs text-gray-500 mt-1">Loading labels…</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Choose a Gmail label/folder to scan. Leave blank to search the entire inbox.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="include-read"
                    type="checkbox"
                    checked={ruleForm.include_read}
                    onChange={(e) => setRuleForm({ ...ruleForm, include_read: e.target.checked })}
                    className="h-4 w-4 border-gray-300 rounded"
                  />
                  <label htmlFor="include-read" className="text-sm text-gray-700">
                    Include emails that are already marked as read
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseRuleModal}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ruleSubmitting}
                  className={`px-4 py-2 rounded-md text-white ${
                    ruleSubmitting
                      ? 'bg-green-300 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {ruleSubmitting
                    ? 'Saving...'
                    : isEditingRule
                      ? 'Update Rule'
                      : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteRuleModal && ruleToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Delete Email Rule</h3>
            <p className="text-sm text-gray-600 mb-4">
              Decide whether to remove only this rule or remove the rule and every report it imported.
            </p>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-md cursor-pointer hover:border-gray-300">
                <input
                  type="radio"
                  name="delete-mode"
                  value="rule"
                  checked={deleteMode === 'rule'}
                  onChange={() => setDeleteMode('rule')}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-sm text-gray-800">Delete rule only</p>
                  <p className="text-xs text-gray-600">
                    Keeps previously imported lottery data intact. Future emails will not be processed by this rule.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border border-red-200 rounded-md cursor-pointer hover:border-red-300 bg-red-50/60">
                <input
                  type="radio"
                  name="delete-mode"
                  value="data"
                  checked={deleteMode === 'data'}
                  onChange={() => setDeleteMode('data')}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-sm text-red-700">Delete rule and imported data</p>
                  <p className="text-xs text-red-600">
                    Removes this rule, its email logs, and any raw lottery reports imported through it. This cannot be undone.
                  </p>
                </div>
              </label>

              {deleteMode === 'data' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type <span className="font-semibold">DELETE</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="DELETE"
                  />
                </div>
              )}

              {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseDeleteRuleModal}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={deleteSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRule}
                disabled={
                  deleteSubmitting ||
                  (deleteMode === 'data' && deleteConfirmText.trim() !== 'DELETE')
                }
                className={`px-4 py-2 rounded-md text-white ${
                  deleteMode === 'data' ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'
                } disabled:opacity-50`}
              >
                {deleteSubmitting
                  ? 'Deleting…'
                  : deleteMode === 'data'
                    ? 'Delete rule & data'
                    : 'Delete rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LotteryEmailSettings;
