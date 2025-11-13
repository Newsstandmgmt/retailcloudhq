/**
 * DailyBusinessReport Component
 * 
 * IMPORTANT: This component is designed for stores with COMBINED DRAWER only
 * (cash_drawer_type = 'combined' or 'same_drawer').
 * 
 * For stores with separate lottery and business drawers, a separate report
 * will be implemented in a future update.
 * 
 * This component calculates:
 * - Total Revenue (cash + card + online + customer tabs)
 * - Cash Expenses (vendor payments + other cash expenses)
 * - Net Sales (Total Revenue - Cash Expenses)
 * 
 * Note: Vendor payments from register cash are properly accounted for to avoid
 * double counting in the calculation.
 */
import { useState, useEffect } from 'react';
import { expensesAPI, customerTabsAPI } from '../../services/api';

const DailyBusinessReport = ({ storeId, date, revenueData }) => {
  const [cashExpenses, setCashExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expensesTotal, setExpensesTotal] = useState(0);
  const [customerTabTotals, setCustomerTabTotals] = useState({ total_charges: 0, total_payments: 0, net_tab_amount: 0 });

  useEffect(() => {
    if (storeId && date) {
      loadCashExpenses();
      loadCustomerTabTotals();
    }
  }, [storeId, date, revenueData]);

  const loadCashExpenses = async () => {
    if (!storeId || !date) return;
    try {
      setLoading(true);
      const response = await expensesAPI.getAll(storeId, {
        start_date: date,
        end_date: date
      });
      
      const expenses = response.data.expenses || [];
      
      const cashOnly = expenses.filter(exp => (exp.payment_method || '').toLowerCase() === 'cash');

      setCashExpenses(expenses);
      
      const total = cashOnly.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
      setExpensesTotal(total);
    } catch (error) {
      console.error('Error loading cash expenses:', error);
      setCashExpenses([]);
      setExpensesTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerTabTotals = async () => {
    if (!storeId || !date) return;
    try {
      const response = await customerTabsAPI.getDailyTotals(storeId, date);
      const totals = response.data.totals || { total_charges: 0, total_payments: 0, net_tab_amount: 0 };
      setCustomerTabTotals(totals);
    } catch (error) {
      console.error('Error loading customer tab totals:', error);
      setCustomerTabTotals({ total_charges: 0, total_payments: 0, net_tab_amount: 0 });
    }
  };

  // Calculate totals from revenue data with proper null/undefined handling
  // Helper function to safely parse numbers
  const safeParse = (value, defaultValue = 0) => {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  };
  
  const calculatedBusinessCash = safeParse(revenueData?.calculated_business_cash, 0);
  const totalCash = safeParse(revenueData?.total_cash, 0);
  const businessCreditCard = safeParse(revenueData?.business_credit_card, 0);
  const creditCardFees = safeParse(revenueData?.credit_card_transaction_fees, 0);
  const otherIncome = safeParse(revenueData?.other_cash_expense, 0); // Note: This is stored as other_cash_expense but used as income
  
  // Customer Tab: Credits (charges) increase revenue, Debits (payments) decrease revenue
  // Credits = customer bought on tab (new revenue, even without cash received)
  // Debits = customer paid back tab (cash received, but it's payment for previous revenue)
  const customerTabCredits = safeParse(customerTabTotals.total_charges, 0); // Customer owes - increases revenue
  const customerTabDebits = safeParse(customerTabTotals.total_payments, 0); // Customer paid - decreases revenue
  const customerTabNet = customerTabCredits - customerTabDebits; // Net: positive = subtract, negative = add
  
  // Calculate vendor payments from cash expenses
  // Vendor payments are marked with [Vendor Payment] in the notes
  const vendorPaymentsTotal = cashExpenses
    .filter(exp => {
      const paymentMethod = (exp?.payment_method || '').toLowerCase();
      return paymentMethod === 'cash' && exp && exp.notes && exp.notes.includes('[Vendor Payment]');
    })
    .reduce((sum, exp) => sum + safeParse(exp.amount, 0), 0);
  
  // Other cash expenses (excluding vendor payments)
  const otherCashExpenses = Math.max(0, safeParse(expensesTotal, 0) - vendorPaymentsTotal);
  
  // Lottery fields (for separate section, NOT included in business calculations)
  const onlineSales = safeParse(revenueData?.online_sales, 0);
  const onlineNet = safeParse(revenueData?.online_net, 0);
  const totalInstant = safeParse(revenueData?.total_instant, 0);
  const instantAdjustment = safeParse(revenueData?.total_instant_adjustment, 0);
  const instantPay = safeParse(revenueData?.instant_pay, 0);
  const lotteryCreditCard = safeParse(revenueData?.lottery_credit_card, 0);
  
  // Daily Business Calculation (per user's formula for Combined Drawer):
  // Total cash: Add
  // Business credit card: Add
  // Other Income: Add
  // Paid Vendor From Register Cash: Add
  // Customer Tab: Subtract if positive, add if negative
  // Online net: Subtract
  // Total instant: Subtract
  // Instant adjustment: Subtract if positive, add if negative
  // Instant pay: Add
  // Lottery credit card: Add
  
  // Customer Tab: If net is positive (more charges than payments), subtract it. If negative (more payments than charges), add it.
  // Formula: customerTabNet = credits - debits
  // If positive: customer owes money (subtract from business cash)
  // If negative: customer overpaid (add back to business cash)
  const customerTabAdjustment = customerTabNet > 0 ? -customerTabNet : Math.abs(customerTabNet);
  
  // Instant Adjustment: If positive, subtract it. If negative, add it.
  // Formula: instantAdjustment can be positive (loss) or negative (gain)
  // If positive: subtract from business cash
  // If negative: add to business cash
  const instantAdjustmentAdjustment = instantAdjustment > 0 ? -instantAdjustment : Math.abs(instantAdjustment);
  
  // Calculate Daily Business step by step for verification
  let dailyBusinessStepByStep = {
    totalCash: totalCash,
    businessCreditCard: businessCreditCard,
    otherIncome: otherIncome,
    vendorPaymentsTotal: vendorPaymentsTotal,
    customerTabAdjustment: customerTabAdjustment,
    onlineNet: -onlineNet,
    totalInstant: -totalInstant,
    instantAdjustmentAdjustment: instantAdjustmentAdjustment,
    instantPay: instantPay,
    lotteryCreditCard: lotteryCreditCard
  };
  
  const dailyBusiness = totalCash 
    + businessCreditCard 
    + otherIncome 
    + vendorPaymentsTotal 
    + customerTabAdjustment 
    - onlineNet 
    - totalInstant 
    + instantAdjustmentAdjustment 
    + instantPay 
    + lotteryCreditCard;
  
  // Total Revenue calculation (for display purposes - BUSINESS ONLY, NO LOTTERY):
  // Cash + Vendor Payments + Business Credit Card - Credit Card Fees + Other Income + Customer Tab Credits - Customer Tab Debits
  // NOTE: Lottery fields (online_net, total_instant, instant_pay, instant_adjustment, lottery_credit_card) are NOT included in business revenue
  // This is for combined drawer businesses where lottery affects the drawer but is tracked separately
  const totalRevenue = totalCash + vendorPaymentsTotal + businessCreditCard + customerTabCredits - customerTabDebits + otherIncome;
  
  // Total Expenses = Vendor Payments + Other Cash Expenses
  // This shows all expenses paid from cash
  const totalExpenses = vendorPaymentsTotal + otherCashExpenses;
  
  // Net Sales = Total Revenue - Total Expenses
  // This properly accounts for: revenue (all cash that came in + customer tab credits) minus customer tab debits (payments for previous revenue) minus expenses (all cash paid out)
  const netSales = totalRevenue - totalExpenses;
  
  // Display business cash (use calculated if available, otherwise use raw cash)
  const displayBusinessCash = calculatedBusinessCash > 0 ? calculatedBusinessCash : totalCash;
  
  // Lottery Due Calculation
  const lotteryOwed = parseFloat(revenueData?.calculated_lottery_owed || 0);
  const bankDepositAmount = parseFloat(revenueData?.bank_deposit_amount || 0);
  const isLotteryBankDeposit = revenueData?.is_lottery_bank_deposit || false;
  const lotteryDueAfterDeposit = isLotteryBankDeposit 
    ? lotteryOwed - bankDepositAmount 
    : lotteryOwed;

  if (!storeId || !date) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500 text-center">Please select a store and date to view business report</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Daily Business Report</h2>
        <div className="text-sm text-gray-600">
          {new Date(date).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm font-medium text-green-700 mb-1">Daily Revenue</div>
          <div className="text-2xl font-bold text-green-900">
            ${dailyBusiness.toFixed(2)}
          </div>
          <div className="text-xs text-green-600 mt-1">
            Calculated from daily business formula
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-sm font-medium text-purple-700 mb-1">Daily Lottery Due</div>
          <div className="text-2xl font-bold text-purple-900">
            ${lotteryDueAfterDeposit.toFixed(2)}
          </div>
          <div className="text-xs text-purple-600 mt-1">
            {isLotteryBankDeposit && bankDepositAmount > 0 ? (
              <>Lottery Owed: ${lotteryOwed.toFixed(2)} - Deposit: ${bankDepositAmount.toFixed(2)}</>
            ) : (
              <>Lottery amount due for this date</>
            )}
          </div>
        </div>
      </div>

      {/* Cash Expenses List */}
      {loading ? (
        <div className="text-center py-4 text-gray-500">Loading expenses...</div>
      ) : cashExpenses.length > 0 ? (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Cash Expenses Paid Today</h3>
          <div className="mb-2 text-xs text-gray-600 bg-blue-50 p-2 rounded">
            <strong>Accounting Note:</strong> Vendor payments from register cash are tracked separately. They reduce the cash drawer and are properly accounted for in Net Sales calculation (no double counting).
          </div>
          <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Expense Type</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Description</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {cashExpenses.map((expense) => {
                  const isVendorPayment = expense.notes && expense.notes.includes('[Vendor Payment]');
                  const paymentMethodLabel = (expense.payment_method || 'N/A').replace('_', ' ');
                  const isAutoCardFee = (expense.expense_type_name || '').toLowerCase() === 'credit card fees' || (expense.notes || '').includes('credit card processing fees');
                  return (
                    <tr key={expense.id} className={`hover:bg-gray-100 ${isVendorPayment ? 'bg-blue-50' : ''}`}>
                      <td className="px-3 py-2 text-gray-900">
                        {expense.expense_type_name || 'N/A'}
                        {isVendorPayment && <span className="ml-2 text-xs text-blue-600">(Vendor)</span>}
                        {isAutoCardFee && <span className="ml-2 text-xs text-purple-600">(Auto)</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {expense.notes || '-'}
                        <div className="text-xs text-gray-400 mt-1">Payment Method: {paymentMethodLabel}</div>
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${isVendorPayment ? 'text-red-600' : 'text-gray-800'}`}>
                        ${safeParse(expense.amount, 0).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-100 sticky bottom-0">
                <tr>
                  <td colSpan="2" className="px-3 py-2 font-semibold text-gray-900">Total Cash Expenses</td>
                  <td className="px-3 py-2 text-right font-bold text-red-700">
                    ${expensesTotal.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
          No cash expenses recorded for this date
        </div>
      )}

      {/* Daily Business Summary */}
      <div className="mt-6 pt-6 border-t border-gray-300">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Business Summary (Combined Drawer)</h3>
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 mb-4">
          <div className="text-sm font-medium text-blue-700 mb-2">Daily Business Amount</div>
          <div className="text-3xl font-bold text-blue-900 mb-4">
            ${dailyBusiness.toFixed(2)}
          </div>
          <div className="text-xs text-blue-600 space-y-1">
            <div className="flex justify-between">
              <span>Total Cash:</span>
              <span className="font-medium">+ ${totalCash.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Business Credit Card:</span>
              <span className="font-medium">+ ${businessCreditCard.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Credit Card Fees (logged as expense):</span>
              <span className="font-medium text-gray-700">${creditCardFees.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Other Income:</span>
              <span className="font-medium">+ ${otherIncome.toFixed(2)}</span>
            </div>
            {vendorPaymentsTotal > 0 && (
              <div className="flex justify-between">
                <span>Paid Vendor From Register Cash:</span>
                <span className="font-medium">+ ${vendorPaymentsTotal.toFixed(2)}</span>
              </div>
            )}
            {customerTabNet !== 0 && (
              <div className="flex justify-between">
                <span>Customer Tab {customerTabNet > 0 ? '(Subtract)' : '(Add)'}:</span>
                <span className={`font-medium ${customerTabAdjustment < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {customerTabAdjustment >= 0 ? '+' : ''}${customerTabAdjustment.toFixed(2)}
                </span>
              </div>
            )}
            {onlineNet !== 0 && (
              <div className="flex justify-between">
                <span>Online Net:</span>
                <span className="font-medium text-red-600">- ${onlineNet.toFixed(2)}</span>
              </div>
            )}
            {totalInstant !== 0 && (
              <div className="flex justify-between">
                <span>Total Instant:</span>
                <span className="font-medium text-red-600">- ${totalInstant.toFixed(2)}</span>
              </div>
            )}
            {instantAdjustment !== 0 && (
              <div className="flex justify-between">
                <span>Instant Adjustment {instantAdjustment > 0 ? '(Subtract)' : '(Add)'}:</span>
                <span className={`font-medium ${instantAdjustmentAdjustment < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {instantAdjustmentAdjustment > 0 ? '+' : ''}${instantAdjustmentAdjustment.toFixed(2)}
                </span>
              </div>
            )}
            {instantPay !== 0 && (
              <div className="flex justify-between">
                <span>Instant Pay:</span>
                <span className="font-medium">+ ${instantPay.toFixed(2)}</span>
              </div>
            )}
            {lotteryCreditCard !== 0 && (
              <div className="flex justify-between">
                <span>Lottery Card Trans:</span>
                <span className="font-medium">+ ${lotteryCreditCard.toFixed(2)}</span>
              </div>
            )}
          </div>
          {creditCardFees > 0 && (
            <div className="text-xs text-blue-500 mt-3">
              Credit card processing fees are automatically logged as an operating expense for this date and are not deducted from the daily business total.
            </div>
          )}
          <div className="border-t border-blue-300 pt-2 mt-2">
            <div className="flex justify-between font-bold">
              <span>Daily Business Total:</span>
              <span className="text-blue-900">${dailyBusiness.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lottery Information Section */}
      <div className="mt-6 pt-6 border-t border-gray-300">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Lottery Information (Separate from Business)</h3>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Online Sales:</span>
              <span className="font-semibold text-gray-900">${onlineSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Online Net:</span>
              <span className="font-semibold text-gray-900">${onlineNet.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Total Instant:</span>
              <span className="font-semibold text-gray-900">${totalInstant.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Instant Adjustment:</span>
              <span className={`font-semibold ${instantAdjustment >= 0 ? 'text-gray-900' : 'text-green-600'}`}>
                ${instantAdjustment.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Instant Pay:</span>
              <span className="font-semibold text-gray-900">${instantPay.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Lottery Card Trans:</span>
              <span className="font-semibold text-gray-900">${lotteryCreditCard.toFixed(2)}</span>
            </div>
          </div>
          <div className="border-t border-purple-300 pt-3">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-gray-900">Lottery Owed (Calculated):</span>
              <span className="font-semibold text-gray-900">
                ${lotteryOwed.toFixed(2)}
              </span>
            </div>
            {isLotteryBankDeposit && bankDepositAmount > 0 && (
              <>
                <div className="flex justify-between items-center text-sm text-gray-600 pt-2">
                  <span>Less: Bank Deposit</span>
                  <span className="text-green-600 font-semibold">- ${bankDepositAmount.toFixed(2)}</span>
                </div>
                <div className="border-t border-purple-300 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-900">Remaining Lottery Due</span>
                    <span className={`text-xl font-bold ${lotteryDueAfterDeposit >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ${lotteryDueAfterDeposit.toFixed(2)}
                    </span>
                  </div>
                  {lotteryDueAfterDeposit < 0 && (
                    <p className="text-xs text-green-600 mt-1">(Overpayment/credit)</p>
                  )}
                </div>
              </>
            )}
            {!isLotteryBankDeposit && lotteryOwed !== 0 && (
              <div className="flex justify-between items-center pt-2">
                <span className="font-semibold text-gray-900">Total Lottery Due</span>
                <span className={`text-xl font-bold ${lotteryDueAfterDeposit >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ${lotteryDueAfterDeposit.toFixed(2)}
                </span>
              </div>
            )}
            {lotteryOwed === 0 && !isLotteryBankDeposit && (
              <p className="text-sm text-gray-500 text-center pt-2">No lottery due for this date</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyBusinessReport;

