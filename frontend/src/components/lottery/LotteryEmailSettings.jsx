import { useState, useEffect } from 'react';
import { lotteryEmailOAuthAPI, lotteryDailyReportsAPI } from '../../services/api';
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
    retailer_number: ''
  });
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    // Only load accounts if user is authenticated
    if (!authLoading && user && storeId) {
      loadAccounts();
      loadRecentReports();
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

  const handleCreateRule = async (e) => {
    e.preventDefault();
    try {
      await lotteryEmailOAuthAPI.createRule(selectedAccount.id, ruleForm);
      setAlert({ type: 'success', message: 'Email rule created successfully' });
      setShowRuleModal(false);
      setRuleForm({
        report_type: 'daily',
        to_address: '',
        subject_contains: '',
        sender_contains: '',
        retailer_number: ''
      });
      loadAccounts();
    } catch (error) {
      console.error('Error creating rule:', error);
      setAlert({ type: 'error', message: error.response?.data?.error || 'Failed to create rule' });
    }
  };

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
                      onClick={() => {
                        setSelectedAccount(account);
                        setShowRuleModal(true);
                      }}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                    >
                      + Add Rule
                    </button>
                  </div>
                  
                  {account.rules && account.rules.length > 0 ? (
                    <div className="space-y-2">
                      {account.rules.map((rule) => (
                        <div key={rule.id} className="bg-gray-50 p-3 rounded flex justify-between items-center">
                          <div>
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
                          </div>
                          <span className={`px-2 py-1 rounded text-xs ${
                            rule.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {rule.is_active ? 'Active' : 'Inactive'}
                          </span>
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

      {/* Rule Modal */}
      {showRuleModal && selectedAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Create Email Rule</h3>
            <form onSubmit={handleCreateRule}>
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
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowRuleModal(false);
                    setSelectedAccount(null);
                    setRuleForm({
                      report_type: 'daily',
                      to_address: '',
                      subject_contains: '',
                      sender_contains: '',
                      retailer_number: ''
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Create Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LotteryEmailSettings;
