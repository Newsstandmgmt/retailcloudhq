/**
 * VendorPaymentsFromCash Component
 * 
 * IMPORTANT: This component is designed for stores with COMBINED DRAWER only
 * (cash_drawer_type = 'combined' or 'same_drawer').
 * 
 * For stores with separate lottery and business drawers, this functionality
 * will be implemented in a future update.
 * 
 * This component allows recording vendor payments made directly from register cash,
 * which creates both expense entries and purchase invoice records for tracking.
 */
import { useState, useEffect } from 'react';
import { expensesAPI, purchaseInvoicesAPI, settingsAPI, api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const VendorPaymentsFromCash = ({ storeId, entryDate, onPaymentsChange }) => {
  const { user } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [vendorPayments, setVendorPayments] = useState([]);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [newVendorName, setNewVendorName] = useState('');
  const [showNewVendorInput, setShowNewVendorInput] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (storeId) {
      loadVendors();
      loadExistingPayments();
    }
  }, [storeId, entryDate]);

  const loadVendors = async () => {
    try {
      const response = await purchaseInvoicesAPI.getVendors(storeId);
      setVendors(response.data.vendors || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const loadExistingPayments = async () => {
    if (!storeId || !entryDate) return;
    try {
      // Load expenses for this date that are vendor payments from cash
      const expenseResponse = await expensesAPI.getAll(storeId, {
        start_date: entryDate,
        end_date: entryDate,
        payment_method: 'cash'
      });
      
      // Filter for vendor payments (check if notes contain vendor info or expense type is vendor)
      const vendorExpenses = (expenseResponse.data.expenses || [])
        .filter(exp => exp.notes && exp.notes.includes('[Vendor Payment]'));
      
      // Load all invoices for this date to match with expenses
      const invoiceResponse = await purchaseInvoicesAPI.getAll(storeId, {
        start_date: entryDate,
        end_date: entryDate,
        status: 'paid'
      });
      
      const invoices = invoiceResponse.data.invoices || [];
      
      // Match expenses with invoices based on notes or date/amount
      const payments = vendorExpenses.map(expense => {
        // Try to extract invoice number from notes
        const invoiceMatch = expense.notes.match(/\[Invoice: ([^\]]+)\]/);
        let invoice = null;
        
        if (invoiceMatch) {
          const invoiceIdentifier = invoiceMatch[1];
          invoice = invoices.find(inv => 
            inv.invoice_number === invoiceIdentifier || 
            inv.id === invoiceIdentifier
          );
        }
        
        // If no invoice found by ID, try to match by vendor and amount
        if (!invoice) {
          const vendorMatch = expense.notes.match(/\[Vendor Payment\] ([^:]+):/);
          if (vendorMatch) {
            const vendorName = vendorMatch[1].trim();
            invoice = invoices.find(inv => 
              inv.vendor_name === vendorName &&
              Math.abs(parseFloat(inv.amount) - parseFloat(expense.amount)) < 0.01 &&
              inv.payment_method_on_purchase === 'cash'
            );
          }
        }
        
        // Extract vendor name from notes
        const vendorMatch = expense.notes.match(/\[Vendor Payment\] ([^:]+):/);
        const vendorName = vendorMatch ? vendorMatch[1].trim() : 'Vendor';
        
        return {
          id: expense.id,
          vendor_id: null, // We don't store this in expense, would need to extract from invoice
          vendor_name: vendorName,
          amount: parseFloat(expense.amount || 0),
          notes: expense.notes.replace(/\[Vendor Payment\] [^:]+: /, '').replace(/ \[Invoice: [^\]]+\]/, ''),
          expense: expense,
          invoice: invoice
        };
      });
      
      setVendorPayments(payments);
      if (onPaymentsChange) {
        onPaymentsChange(payments);
      }
    } catch (error) {
      console.error('Error loading vendor payments:', error);
    }
  };

  const handleCreateVendor = async (vendorName) => {
    if (!vendorName.trim()) {
      alert('Please enter a vendor name');
      return null;
    }

    try {
      const response = await purchaseInvoicesAPI.createVendor(storeId, {
        name: vendorName.trim(),
        contact_name: '',
        email: '',
        phone: '',
        address: ''
      });
      
      const newVendor = response.data.vendor;
      setVendors([...vendors, newVendor]);
      setSelectedVendor(newVendor.id);
      setShowNewVendorInput(false);
      setNewVendorName('');
      return newVendor;
    } catch (error) {
      console.error('Error creating vendor:', error);
      alert('Error creating vendor: ' + (error.response?.data?.error || error.message));
      return null;
    }
  };

  const handleAddPayment = async () => {
    let vendorId = selectedVendor;
    let vendor = vendors.find(v => v.id === vendorId);

    // If new vendor name is entered, create it first
    if (showNewVendorInput && newVendorName.trim()) {
      const newVendor = await handleCreateVendor(newVendorName);
      if (!newVendor) {
        return; // Failed to create vendor
      }
      vendorId = newVendor.id;
      vendor = newVendor;
    }

    if (!vendorId || !paymentAmount || !entryDate) {
      alert('Please select or create a vendor and enter an amount');
      return;
    }

    setLoading(true);
    try {
      if (!vendor) {
        vendor = vendors.find(v => v.id === vendorId);
      }
      
      // Get or create "Vendor Payment" expense type
      let expenseTypeId = null;
      try {
        const expenseTypesResponse = await settingsAPI.getExpenseTypes(storeId);
        const expenseTypes = expenseTypesResponse.data.expense_types || [];
        
        // Try to find existing vendor payment type
        let vendorPaymentType = expenseTypes.find(et => 
          et.expense_type_name?.toLowerCase().includes('vendor payment') ||
          et.expense_type_name?.toLowerCase() === 'vendor payment'
        );
        
        // If not found, try broader search
        if (!vendorPaymentType) {
          vendorPaymentType = expenseTypes.find(et => 
            et.expense_type_name?.toLowerCase().includes('vendor') || 
            et.expense_type_name?.toLowerCase().includes('payment')
          );
        }
        
        // If still not found, create a "Vendor Payment" expense type
        if (!vendorPaymentType && expenseTypes.length > 0) {
          try {
            const createResponse = await settingsAPI.createExpenseType(storeId, {
              expense_type_name: 'Vendor Payment',
              description: 'Payments made to vendors from register cash'
            });
            expenseTypeId = createResponse.data.expense_type.id;
          } catch (createError) {
            console.error('Error creating vendor payment expense type:', createError);
            // Fallback to first available expense type
            expenseTypeId = expenseTypes[0]?.id || null;
          }
        } else if (vendorPaymentType) {
          expenseTypeId = vendorPaymentType.id;
        } else if (expenseTypes.length > 0) {
          // Use first available expense type as fallback
          expenseTypeId = expenseTypes[0].id;
        } else {
          // No expense types available - create one
          try {
            const createResponse = await settingsAPI.createExpenseType(storeId, {
              expense_type_name: 'Vendor Payment',
              description: 'Payments made to vendors from register cash'
            });
            expenseTypeId = createResponse.data.expense_type.id;
          } catch (createError) {
            console.error('Error creating vendor payment expense type:', createError);
            alert('Error: No expense types available. Please create an expense type in Settings first.');
            return;
          }
        }
      } catch (error) {
        console.error('Error loading expense types:', error);
        alert('Error loading expense types. Please try again.');
        return;
      }

      // Create expense entry for vendor payment
      const expenseData = {
        entry_date: entryDate,
        expense_type_id: expenseTypeId,
        amount: parseFloat(paymentAmount),
        payment_method: 'cash',
        notes: `[Vendor Payment] ${vendor?.name || 'Vendor'}: ${paymentNotes || 'Payment from register cash'}`,
        is_reimbursable: false,
        reimbursement_status: 'none'
      };

      const expenseResponse = await expensesAPI.create(storeId, expenseData);
      const expense = expenseResponse.data.expense;
      
      // Create purchase invoice record for this vendor payment
      // This makes it show up in Purchase & Payments
      let invoice = null;
      try {
        const invoiceData = {
          purchase_date: entryDate,
          vendor_id: vendorId,
          amount: parseFloat(paymentAmount),
          payment_option: 'cash',
          paid_on_purchase: true,
          payment_method_on_purchase: 'cash',
          notes: paymentNotes || `Payment from register cash - ${vendor?.name || 'Vendor'}`,
          is_reimbursable: false,
          reimbursement_status: 'none'
        };
        
        // Create invoice using the correct API format
        // The API expects: POST /api/purchase-invoices/store/:storeId
        const invoiceResponse = await api.post(`/api/purchase-invoices/store/${storeId}`, invoiceData);
        
        // Handle response properly
        if (invoiceResponse && invoiceResponse.data) {
          invoice = invoiceResponse.data.invoice || invoiceResponse.data;
        } else {
          console.error('Unexpected invoice response format:', invoiceResponse);
          throw new Error('Invalid response from invoice creation');
        }
        
        // Link expense to invoice by updating expense notes with invoice ID
        if (invoice && invoice.id) {
          await expensesAPI.update(storeId, expense.id, {
            notes: `[Vendor Payment] ${vendor?.name || 'Vendor'}: ${paymentNotes || 'Payment from register cash'} [Invoice: ${invoice.invoice_number || invoice.id}]`
          });
        }
      } catch (invoiceError) {
        console.error('Error creating purchase invoice for vendor payment:', invoiceError);
        // Don't fail the entire operation if invoice creation fails
        // The expense is already created, which is the main record
      }
      
      // Add to local state
      const newPayment = {
        id: expense.id,
        vendor_id: vendorId,
        vendor_name: vendor?.name,
        amount: parseFloat(paymentAmount),
        notes: paymentNotes,
        expense: expense,
        invoice: invoice
      };
      
      setVendorPayments([...vendorPayments, newPayment]);
      if (onPaymentsChange) {
        onPaymentsChange([...vendorPayments, newPayment]);
      }

      // Reset form
      setSelectedVendor('');
      setNewVendorName('');
      setShowNewVendorInput(false);
      setPaymentAmount('');
      setPaymentNotes('');
      setShowAddPayment(false);
    } catch (error) {
      console.error('Error adding vendor payment:', error);
      alert('Error adding vendor payment: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePayment = async (paymentId) => {
    if (!confirm('Are you sure you want to remove this vendor payment? This will also remove the associated invoice.')) {
      return;
    }

    try {
      const payment = vendorPayments.find(p => p.id === paymentId);
      
      // Delete the expense first
      await expensesAPI.delete(storeId, paymentId);
      
      // Also delete the associated invoice if it exists
      if (payment?.invoice?.id) {
        try {
          // Delete invoice - need to check access first
          const invoice = await purchaseInvoicesAPI.getById(payment.invoice.id);
          if (invoice.data && invoice.data.invoice) {
            // Check if we have access to this invoice's store
            await purchaseInvoicesAPI.delete(payment.invoice.id);
          }
        } catch (invoiceError) {
          console.error('Error deleting associated invoice:', invoiceError);
          // Continue even if invoice deletion fails - expense is already deleted
        }
      }
      
      const updated = vendorPayments.filter(p => p.id !== paymentId);
      setVendorPayments(updated);
      if (onPaymentsChange) {
        onPaymentsChange(updated);
      }
    } catch (error) {
      console.error('Error removing vendor payment:', error);
      alert('Error removing vendor payment: ' + (error.response?.data?.error || error.message));
    }
  };

  const totalPayments = vendorPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  return (
    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">Paid Vendor From Register Cash</h3>
          <p className="text-sm text-gray-600">
            Total: <span className="font-semibold">${totalPayments.toFixed(2)}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddPayment(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          + Add Payment
        </button>
      </div>

      {vendorPayments.length > 0 && (
        <div className="space-y-2 mb-3">
          {vendorPayments.map((payment) => (
            <div key={payment.id} className="bg-white rounded border p-2 flex justify-between items-center">
              <div className="flex-1">
                <div className="font-medium text-sm">{payment.vendor_name || 'Vendor'}</div>
                <div className="text-xs text-gray-600">
                  ${parseFloat(payment.amount || 0).toFixed(2)}
                  {payment.notes && <span className="ml-2">- {payment.notes}</span>}
                  {payment.invoice && (
                    <span className="ml-2 text-blue-600">
                      (Invoice: {payment.invoice.invoice_number || payment.invoice.id})
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemovePayment(payment.id)}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 ml-2"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {showAddPayment && (
        <div className="bg-white rounded-lg border p-4 mt-3">
          <h4 className="font-semibold mb-3">Add Vendor Payment</h4>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Vendor *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewVendorInput(!showNewVendorInput);
                    if (!showNewVendorInput) {
                      setSelectedVendor('');
                    }
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  {showNewVendorInput ? 'Select Existing' : '+ Add New Vendor'}
                </button>
              </div>
              {showNewVendorInput ? (
                <div>
                  <input
                    type="text"
                    value={newVendorName}
                    onChange={(e) => setNewVendorName(e.target.value)}
                    placeholder="Enter vendor name"
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateVendor(newVendorName);
                      }
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Press Enter to create or continue with payment</p>
                </div>
              ) : (
                <select
                  value={selectedVendor}
                  onChange={(e) => setSelectedVendor(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                >
                  <option value="">Select a vendor</option>
                  {vendors.map(vendor => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount *
              </label>
              <input
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="e.g., Newspaper delivery payment"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddPayment(false);
                  setSelectedVendor('');
                  setNewVendorName('');
                  setShowNewVendorInput(false);
                  setPaymentAmount('');
                  setPaymentNotes('');
                }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddPayment}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorPaymentsFromCash;

