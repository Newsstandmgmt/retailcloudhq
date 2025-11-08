import { useState, useEffect } from 'react';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { journalEntriesAPI, settingsAPI } from '../services/api';

const GeneralLedger = () => {
  const { selectedStore } = useStore();
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showTrialBalanceModal, setShowTrialBalanceModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [trialBalance, setTrialBalance] = useState([]);
  
  // Filters
  const [filters, setFilters] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    status: '',
    entry_type: ''
  });

  // Form state
  const [entryForm, setEntryForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    entry_type: 'manual',
    description: '',
    notes: '',
    lines: [
      { account_id: '', debit_amount: '', credit_amount: '', description: '' },
      { account_id: '', debit_amount: '', credit_amount: '', description: '' }
    ]
  });

  useEffect(() => {
    if (selectedStore) {
      loadEntries();
      loadAccounts();
    }
  }, [selectedStore, filters]);

  const loadEntries = async () => {
    if (!selectedStore) return;
    try {
      setLoading(true);
      const response = await journalEntriesAPI.getAll(selectedStore.id, filters);
      setEntries(response.data.entries || []);
    } catch (error) {
      console.error('Error loading journal entries:', error);
      alert('Failed to load journal entries');
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    if (!selectedStore) return;
    try {
      const response = await settingsAPI.getChartOfAccounts(selectedStore.id);
      setAccounts(response.data.accounts || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const loadTrialBalance = async () => {
    if (!selectedStore) return;
    try {
      const response = await journalEntriesAPI.getTrialBalance(selectedStore.id);
      setTrialBalance(response.data.trial_balance || []);
    } catch (error) {
      console.error('Error loading trial balance:', error);
      alert('Failed to load trial balance');
    }
  };

  const handleAddLine = () => {
    setEntryForm({
      ...entryForm,
      lines: [...entryForm.lines, { account_id: '', debit_amount: '', credit_amount: '', description: '' }]
    });
  };

  const handleRemoveLine = (index) => {
    if (entryForm.lines.length <= 2) {
      alert('Journal entry must have at least 2 lines');
      return;
    }
    const newLines = entryForm.lines.filter((_, i) => i !== index);
    setEntryForm({ ...entryForm, lines: newLines });
  };

  const handleLineChange = (index, field, value) => {
    const newLines = [...entryForm.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    // If debit is set, clear credit and vice versa
    if (field === 'debit_amount' && value) {
      newLines[index].credit_amount = '';
    }
    if (field === 'credit_amount' && value) {
      newLines[index].debit_amount = '';
    }
    
    setEntryForm({ ...entryForm, lines: newLines });
  };

  const calculateTotals = () => {
    const totalDebit = entryForm.lines.reduce((sum, line) => 
      sum + parseFloat(line.debit_amount || 0), 0
    );
    const totalCredit = entryForm.lines.reduce((sum, line) => 
      sum + parseFloat(line.credit_amount || 0), 0
    );
    return { totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStore) {
      alert('Please select a store');
      return;
    }

    // Validate form
    if (!entryForm.description.trim()) {
      alert('Please enter a description');
      return;
    }

    // Validate all lines have account and amount
    for (let i = 0; i < entryForm.lines.length; i++) {
      const line = entryForm.lines[i];
      if (!line.account_id) {
        alert(`Line ${i + 1}: Please select an account`);
        return;
      }
      const hasDebit = parseFloat(line.debit_amount || 0) > 0;
      const hasCredit = parseFloat(line.credit_amount || 0) > 0;
      if (!hasDebit && !hasCredit) {
        alert(`Line ${i + 1}: Please enter either debit or credit amount`);
        return;
      }
      if (hasDebit && hasCredit) {
        alert(`Line ${i + 1}: Cannot have both debit and credit`);
        return;
      }
    }

    // Check balance
    const { isBalanced } = calculateTotals();
    if (!isBalanced) {
      alert('Journal entry is not balanced. Total debits must equal total credits.');
      return;
    }

    try {
      // Prepare lines for API
      const lines = entryForm.lines.map(line => ({
        account_id: line.account_id,
        debit_amount: parseFloat(line.debit_amount || 0),
        credit_amount: parseFloat(line.credit_amount || 0),
        description: line.description || null
      }));

      await journalEntriesAPI.create(selectedStore.id, {
        entry_date: entryForm.entry_date,
        entry_type: entryForm.entry_type,
        description: entryForm.description,
        status: 'draft',
        lines,
        notes: entryForm.notes || null
      });

      alert('Journal entry created successfully!');
      setShowAddModal(false);
      setEntryForm({
        entry_date: new Date().toISOString().split('T')[0],
        entry_type: 'manual',
        description: '',
        notes: '',
        lines: [
          { account_id: '', debit_amount: '', credit_amount: '', description: '' },
          { account_id: '', debit_amount: '', credit_amount: '', description: '' }
        ]
      });
      loadEntries();
    } catch (error) {
      alert('Error creating journal entry: ' + (error.response?.data?.error || error.message));
    }
  };

  const handlePost = async (entryId) => {
    if (!window.confirm('Are you sure you want to post this journal entry? This action cannot be undone.')) {
      return;
    }

    try {
      await journalEntriesAPI.post(entryId);
      alert('Journal entry posted successfully!');
      loadEntries();
    } catch (error) {
      alert('Error posting journal entry: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this journal entry?')) {
      return;
    }

    try {
      await journalEntriesAPI.delete(entryId);
      alert('Journal entry deleted successfully!');
      loadEntries();
    } catch (error) {
      alert('Error deleting journal entry: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleView = async (entryId) => {
    try {
      const response = await journalEntriesAPI.getById(entryId);
      setSelectedEntry(response.data.entry);
      setShowViewModal(true);
    } catch (error) {
      alert('Error loading journal entry: ' + (error.response?.data?.error || error.message));
    }
  };

  const { totalDebit, totalCredit, isBalanced } = calculateTotals();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">General Ledger</h1>
          <p className="text-sm text-gray-600 mt-1">
            Cash expenses, purchase invoices, and payments are automatically posted to the General Ledger
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setShowTrialBalanceModal(true);
              loadTrialBalance();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Trial Balance
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49]"
          >
            Add Journal Entry
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="posted">Posted</option>
              <option value="reversed">Reversed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entry Type</label>
            <select
              value={filters.entry_type}
              onChange={(e) => setFilters({ ...filters, entry_type: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All</option>
              <option value="manual">Manual</option>
              <option value="auto">Auto</option>
              <option value="adjustment">Adjustment</option>
              <option value="reversal">Reversal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Journal Entries Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">Loading...</td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">No journal entries found</td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{entry.entry_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(entry.entry_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">{entry.entry_type}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{entry.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      ${parseFloat(entry.total_debit || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      ${parseFloat(entry.total_credit || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        entry.status === 'posted' ? 'bg-green-100 text-green-800' :
                        entry.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleView(entry.id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </button>
                        {entry.status === 'draft' && ['admin', 'super_admin', 'manager'].includes(user?.role) && (
                          <>
                            <button
                              onClick={() => handlePost(entry.id)}
                              className="text-green-600 hover:text-green-900"
                            >
                              Post
                            </button>
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Journal Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Add Journal Entry</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Entry Date *</label>
                    <input
                      type="date"
                      value={entryForm.entry_date}
                      onChange={(e) => setEntryForm({ ...entryForm, entry_date: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Entry Type *</label>
                    <select
                      value={entryForm.entry_type}
                      onChange={(e) => setEntryForm({ ...entryForm, entry_type: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      required
                    >
                      <option value="manual">Manual</option>
                      <option value="adjustment">Adjustment</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                  <input
                    type="text"
                    value={entryForm.description}
                    onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Enter journal entry description"
                    required
                  />
                </div>
              </div>

              {/* Journal Entry Lines */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Journal Entry Lines</h3>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Add Line
                  </button>
                </div>

                <div className="space-y-3">
                  {entryForm.lines.map((line, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-end border-b pb-3">
                      <div className="col-span-4">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Account *</label>
                        <select
                          value={line.account_id}
                          onChange={(e) => handleLineChange(index, 'account_id', e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                          required
                        >
                          <option value="">Select Account</option>
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.account_code ? `${account.account_code} - ` : ''}{account.account_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Debit</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.debit_amount}
                          onChange={(e) => handleLineChange(index, 'debit_amount', e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Credit</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.credit_amount}
                          onChange={(e) => handleLineChange(index, 'credit_amount', e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                          placeholder="Optional"
                        />
                      </div>
                      <div className="col-span-1">
                        {entryForm.lines.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="mt-4 flex justify-end gap-6">
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Total Debit</div>
                    <div className={`text-lg font-semibold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                      ${totalDebit.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Total Credit</div>
                    <div className={`text-lg font-semibold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                      ${totalCredit.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Difference</div>
                    <div className={`text-lg font-semibold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                      ${Math.abs(totalDebit - totalCredit).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={entryForm.notes}
                  onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows="3"
                  placeholder="Optional notes"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isBalanced}
                  className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Entry Modal */}
      {showViewModal && selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Journal Entry Details</h2>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedEntry(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Entry Number</label>
                  <p className="text-gray-900">{selectedEntry.entry_number}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date</label>
                  <p className="text-gray-900">{new Date(selectedEntry.entry_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <p className="text-gray-900 capitalize">{selectedEntry.entry_type}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    selectedEntry.status === 'posted' ? 'bg-green-100 text-green-800' :
                    selectedEntry.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedEntry.status}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <p className="text-gray-900">{selectedEntry.description}</p>
              </div>

              {selectedEntry.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <p className="text-gray-900">{selectedEntry.notes}</p>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Journal Entry Lines</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedEntry.lines?.map((line, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {line.account_code ? `${line.account_code} - ` : ''}{line.account_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {parseFloat(line.debit_amount || 0) > 0 ? `$${parseFloat(line.debit_amount).toFixed(2)}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {parseFloat(line.credit_amount || 0) > 0 ? `$${parseFloat(line.credit_amount).toFixed(2)}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{line.description || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">Total</td>
                        <td className="px-4 py-3 text-sm font-semibold text-right text-gray-900">
                          ${parseFloat(selectedEntry.total_debit || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-right text-gray-900">
                          ${parseFloat(selectedEntry.total_credit || 0).toFixed(2)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedEntry(null);
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trial Balance Modal */}
      {showTrialBalanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Trial Balance</h2>
              <button
                onClick={() => setShowTrialBalanceModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {trialBalance.map((account) => (
                    <tr key={account.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">{account.account_code || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{account.account_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 capitalize">{account.account_type}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        ${parseFloat(account.total_debit || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        ${parseFloat(account.total_credit || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                        ${parseFloat(account.balance || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-900">Total</td>
                    <td className="px-4 py-3 text-sm font-semibold text-right text-gray-900">
                      ${trialBalance.reduce((sum, acc) => sum + parseFloat(acc.total_debit || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-right text-gray-900">
                      ${trialBalance.reduce((sum, acc) => sum + parseFloat(acc.total_credit || 0), 0).toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowTrialBalanceModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralLedger;

