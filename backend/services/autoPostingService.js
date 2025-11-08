const JournalEntry = require('../models/JournalEntry');
const { query } = require('../config/database');

class AutoPostingService {
    /**
     * Find or create account by name and type
     * Returns account ID or null if not found
     */
    static async findAccountByName(storeId, accountName, accountType = null) {
        let sql = `SELECT id FROM chart_of_accounts 
                   WHERE store_id = $1 AND account_name = $2 AND is_active = true`;
        const params = [storeId, accountName];
        
        if (accountType) {
            sql += ` AND account_type = $3`;
            params.push(accountType);
        }
        
        const result = await query(sql, params);
        return result.rows[0]?.id || null;
    }

    /**
     * Find account by type (returns first matching account)
     */
    static async findAccountByType(storeId, accountType) {
        const result = await query(
            `SELECT id FROM chart_of_accounts 
             WHERE store_id = $1 AND account_type = $2 AND is_active = true 
             ORDER BY account_name LIMIT 1`,
            [storeId, accountType]
        );
        return result.rows[0]?.id || null;
    }

    /**
     * Auto-post expense to general ledger
     */
    static async postExpense(expense, expenseTypeName) {
        try {
            const { store_id, entry_date, amount, payment_method, bank_id, expense_type_id } = expense;
            
            // Find expense account - try to find by expense type name first, then default to first expense account
            let expenseAccountId = await this.findAccountByName(store_id, expenseTypeName, 'expense');
            
            if (!expenseAccountId) {
                // Try to find any expense account as fallback
                expenseAccountId = await this.findAccountByType(store_id, 'expense');
            }
            
            if (!expenseAccountId) {
                console.warn(`No expense account found for store ${store_id}. Expense not posted to GL.`);
                return null; // Don't throw error, just skip posting
            }

            // Find payment account based on payment method
            let paymentAccountId = null;
            let paymentAccountName = 'Cash';
            
            if (payment_method === 'cash') {
                paymentAccountId = await this.findAccountByName(store_id, 'Cash', 'asset');
                if (!paymentAccountId) {
                    paymentAccountId = await this.findAccountByName(store_id, 'Cash on Hand', 'asset');
                }
                if (!paymentAccountId) {
                    // Try to find any cash/asset account
                    paymentAccountId = await this.findAccountByType(store_id, 'asset');
                }
            } else if (payment_method === 'bank' && bank_id) {
                // Get bank name and find account
                const bankResult = await query('SELECT bank_name FROM banks WHERE id = $1', [bank_id]);
                if (bankResult.rows[0]) {
                    paymentAccountName = bankResult.rows[0].bank_name;
                    paymentAccountId = await this.findAccountByName(store_id, paymentAccountName, 'asset');
                    if (!paymentAccountId) {
                        // Try generic bank account name
                        paymentAccountId = await this.findAccountByName(store_id, 'Bank Account', 'asset');
                    }
                    if (!paymentAccountId) {
                        paymentAccountId = await this.findAccountByType(store_id, 'asset');
                    }
                }
            } else if (payment_method === 'check') {
                paymentAccountId = await this.findAccountByName(store_id, 'Bank Account', 'asset');
                if (!paymentAccountId) {
                    paymentAccountId = await this.findAccountByType(store_id, 'asset');
                }
            } else if (payment_method === 'card') {
                paymentAccountId = await this.findAccountByName(store_id, 'Credit Card', 'liability');
                if (!paymentAccountId) {
                    paymentAccountId = await this.findAccountByType(store_id, 'liability');
                }
            }

            if (!paymentAccountId) {
                console.warn(`No payment account found for payment method ${payment_method} in store ${store_id}. Expense not posted to GL.`);
                return null;
            }

            // Create journal entry lines
            const lines = [
                {
                    account_id: expenseAccountId,
                    debit_amount: parseFloat(amount),
                    credit_amount: 0,
                    description: `${expenseTypeName} Expense`
                },
                {
                    account_id: paymentAccountId,
                    debit_amount: 0,
                    credit_amount: parseFloat(amount),
                    description: `Paid via ${payment_method}`
                }
            ];

            // Create and auto-post journal entry
            const journalEntry = await JournalEntry.create(store_id, {
                entry_date,
                entry_type: 'auto',
                description: `${expenseTypeName} Expense - ${paymentAccountName}`,
                reference_type: 'expense',
                reference_id: expense.id,
                status: 'posted', // Auto-post expenses
                lines,
                entered_by: expense.entered_by,
                notes: `Auto-posted from expense entry`
            });

            // Post the entry
            await JournalEntry.post(journalEntry.id, expense.entered_by);

            return journalEntry;
        } catch (error) {
            console.error('Error auto-posting expense to GL:', error);
            // Don't throw - allow expense to be created even if GL posting fails
            return null;
        }
    }

    /**
     * Auto-post purchase invoice to general ledger
     */
    static async postPurchaseInvoice(invoice) {
        try {
            const { store_id, purchase_date, amount, payment_option, paid_on_purchase, 
                    payment_method_on_purchase, bank_id_on_purchase, is_reimbursable,
                    reimbursement_status, reimbursement_to, id } = invoice;

            // If invoice is paid on purchase, post immediately
            if (paid_on_purchase) {
                // Find Accounts Payable account (or use expense account if paid immediately)
                let expenseAccountId = await this.findAccountByName(store_id, 'Accounts Payable', 'liability');
                if (!expenseAccountId) {
                    expenseAccountId = await this.findAccountByType(store_id, 'expense');
                }

                // Find payment account
                let paymentAccountId = null;
                if (is_reimbursable) {
                    // If reimbursable, credit Accounts Receivable (or similar)
                    paymentAccountId = await this.findAccountByName(store_id, 'Accounts Receivable', 'asset');
                    if (!paymentAccountId) {
                        paymentAccountId = await this.findAccountByType(store_id, 'asset');
                    }
                } else {
                    // Normal payment
                    if (payment_method_on_purchase === 'cash') {
                        paymentAccountId = await this.findAccountByName(store_id, 'Cash', 'asset');
                        if (!paymentAccountId) {
                            paymentAccountId = await this.findAccountByType(store_id, 'asset');
                        }
                    } else if (payment_method_on_purchase === 'bank' && bank_id_on_purchase) {
                        const bankResult = await query('SELECT bank_name FROM banks WHERE id = $1', [bank_id_on_purchase]);
                        if (bankResult.rows[0]) {
                            paymentAccountId = await this.findAccountByName(store_id, bankResult.rows[0].bank_name, 'asset');
                            if (!paymentAccountId) {
                                paymentAccountId = await this.findAccountByType(store_id, 'asset');
                            }
                        }
                    } else {
                        paymentAccountId = await this.findAccountByType(store_id, 'asset');
                    }
                }

                if (!expenseAccountId || !paymentAccountId) {
                    console.warn(`Missing accounts for invoice posting in store ${store_id}`);
                    return null;
                }

                const lines = [
                    {
                        account_id: expenseAccountId,
                        debit_amount: parseFloat(amount),
                        credit_amount: 0,
                        description: `Purchase Invoice`
                    },
                    {
                        account_id: paymentAccountId,
                        debit_amount: 0,
                        credit_amount: parseFloat(amount),
                        description: is_reimbursable ? `To be reimbursed: ${reimbursement_to}` : `Paid via ${payment_method_on_purchase}`
                    }
                ];

                const journalEntry = await JournalEntry.create(store_id, {
                    entry_date: purchase_date,
                    entry_type: 'auto',
                    description: `Purchase Invoice - Paid on Purchase`,
                    reference_type: 'purchase_invoice',
                    reference_id: id,
                    status: 'posted',
                    lines,
                    entered_by: invoice.entered_by,
                    notes: is_reimbursable ? `Reimbursable to: ${reimbursement_to}` : null
                });

                await JournalEntry.post(journalEntry.id, invoice.entered_by);
                return journalEntry;
            } else {
                // Invoice not paid - create Accounts Payable entry
                let expenseAccountId = await this.findAccountByType(store_id, 'expense');
                let apAccountId = await this.findAccountByName(store_id, 'Accounts Payable', 'liability');
                
                if (!apAccountId) {
                    // Try to find any liability account as fallback
                    apAccountId = await this.findAccountByType(store_id, 'liability');
                    if (!apAccountId) {
                        console.warn(`No Accounts Payable account found for store ${store_id}. Please create one in Settings > Chart of Accounts.`);
                    }
                }

                if (!expenseAccountId) {
                    expenseAccountId = await this.findAccountByType(store_id, 'expense');
                }

                if (!expenseAccountId || !apAccountId) {
                    console.warn(`Missing accounts for invoice posting in store ${store_id}`);
                    return null;
                }

                const lines = [
                    {
                        account_id: expenseAccountId,
                        debit_amount: parseFloat(amount),
                        credit_amount: 0,
                        description: `Purchase Invoice`
                    },
                    {
                        account_id: apAccountId,
                        debit_amount: 0,
                        credit_amount: parseFloat(amount),
                        description: `Accounts Payable`
                    }
                ];

                const journalEntry = await JournalEntry.create(store_id, {
                    entry_date: purchase_date,
                    entry_type: 'auto',
                    description: `Purchase Invoice - ${invoice.invoice_number || 'Pending Payment'}`,
                    reference_type: 'purchase_invoice',
                    reference_id: id,
                    status: 'posted',
                    lines,
                    entered_by: invoice.entered_by
                });

                await JournalEntry.post(journalEntry.id, invoice.entered_by);
                return journalEntry;
            }
        } catch (error) {
            console.error('Error auto-posting purchase invoice to GL:', error);
            return null;
        }
    }

    /**
     * Auto-post payment to general ledger
     */
    static async postPayment(invoice, paymentData) {
        try {
            const { store_id, payment_date, payment_method, check_number, amount } = paymentData;
            
            // Find Accounts Payable account
            let apAccountId = await this.findAccountByName(store_id, 'Accounts Payable', 'liability');
            if (!apAccountId) {
                apAccountId = await this.findAccountByType(store_id, 'liability');
            }

            // Find payment account
            let paymentAccountId = null;
            if (payment_method === 'cash') {
                paymentAccountId = await this.findAccountByName(store_id, 'Cash', 'asset');
                if (!paymentAccountId) {
                    paymentAccountId = await this.findAccountByType(store_id, 'asset');
                }
            } else if (payment_method === 'bank' || payment_method === 'check') {
                paymentAccountId = await this.findAccountByName(store_id, 'Bank Account', 'asset');
                if (!paymentAccountId) {
                    paymentAccountId = await this.findAccountByType(store_id, 'asset');
                }
            } else {
                paymentAccountId = await this.findAccountByType(store_id, 'asset');
            }

            if (!apAccountId || !paymentAccountId) {
                console.warn(`Missing accounts for payment posting in store ${store_id}`);
                return null;
            }

            const lines = [
                {
                    account_id: apAccountId,
                    debit_amount: parseFloat(amount),
                    credit_amount: 0,
                    description: `Payment for Invoice ${invoice.invoice_number || ''}`
                },
                {
                    account_id: paymentAccountId,
                    debit_amount: 0,
                    credit_amount: parseFloat(amount),
                    description: `Paid via ${payment_method}${check_number ? ` - Check #${check_number}` : ''}`
                }
            ];

            const journalEntry = await JournalEntry.create(store_id, {
                entry_date: payment_date,
                entry_type: 'auto',
                description: `Payment for Invoice ${invoice.invoice_number || ''}`,
                reference_type: 'payment',
                reference_id: invoice.id,
                status: 'posted',
                lines,
                entered_by: paymentData.entered_by,
                notes: check_number ? `Check #${check_number}` : null
            });

            await JournalEntry.post(journalEntry.id, paymentData.entered_by);
            return journalEntry;
        } catch (error) {
            console.error('Error auto-posting payment to GL:', error);
            return null;
        }
    }

    /**
     * Auto-post reimbursement to general ledger
     */
    static async postReimbursement(invoice, reimbursementData) {
        try {
            const { store_id, reimbursement_date, reimbursement_amount, 
                    reimbursement_payment_method, reimbursement_check_number } = reimbursementData;

            // Find Accounts Receivable (or similar) account
            let arAccountId = await this.findAccountByName(store_id, 'Accounts Receivable', 'asset');
            if (!arAccountId) {
                arAccountId = await this.findAccountByName(store_id, 'Reimbursements Receivable', 'asset');
            }
            if (!arAccountId) {
                arAccountId = await this.findAccountByType(store_id, 'asset');
            }

            // Find payment account
            let paymentAccountId = null;
            if (reimbursement_payment_method === 'cash') {
                paymentAccountId = await this.findAccountByName(store_id, 'Cash', 'asset');
                if (!paymentAccountId) {
                    paymentAccountId = await this.findAccountByType(store_id, 'asset');
                }
            } else if (reimbursement_payment_method === 'check' || reimbursement_payment_method === 'bank') {
                paymentAccountId = await this.findAccountByName(store_id, 'Bank Account', 'asset');
                if (!paymentAccountId) {
                    paymentAccountId = await this.findAccountByType(store_id, 'asset');
                }
            }

            if (!arAccountId || !paymentAccountId) {
                console.warn(`Missing accounts for reimbursement posting in store ${store_id}`);
                return null;
            }

            const lines = [
                {
                    account_id: paymentAccountId,
                    debit_amount: parseFloat(reimbursement_amount),
                    credit_amount: 0,
                    description: `Reimbursement paid to ${invoice.reimbursement_to}`
                },
                {
                    account_id: arAccountId,
                    debit_amount: 0,
                    credit_amount: parseFloat(reimbursement_amount),
                    description: `Reimbursement for ${invoice.reimbursement_to}${reimbursement_check_number ? ` - Check #${reimbursement_check_number}` : ''}`
                }
            ];

            const journalEntry = await JournalEntry.create(store_id, {
                entry_date: reimbursement_date,
                entry_type: 'auto',
                description: `Reimbursement for ${invoice.reimbursement_to}`,
                reference_type: 'reimbursement',
                reference_id: invoice.id,
                status: 'posted',
                lines,
                entered_by: reimbursementData.entered_by,
                notes: reimbursement_check_number ? `Check #${reimbursement_check_number}` : null
            });

            await JournalEntry.post(journalEntry.id, reimbursementData.entered_by);
            return journalEntry;
        } catch (error) {
            console.error('Error auto-posting reimbursement to GL:', error);
            return null;
        }
    }

    /**
     * Auto-post revenue entry to general ledger
     * Creates journal entries for all revenue components
     * Daily revenue entry is the input form, this posts data to the accounting database (GL)
     */
    static async postRevenue(revenue, store) {
        try {
            const ChartOfAccounts = require('../models/ChartOfAccounts');

            // Get or create default accounts for this store
            const accounts = await ChartOfAccounts.findByStore(store.id);
            
            // Find or create accounts we need
            const getAccount = async (accountType, accountName) => {
                let account = accounts.find(a => 
                    a.account_type === accountType && 
                    a.account_name.toLowerCase().includes(accountName.toLowerCase())
                );
                
                if (!account) {
                    // Create default account if it doesn't exist
                    account = await ChartOfAccounts.create(store.id, {
                        account_name: accountName,
                        account_type: accountType,
                        account_number: `AUTO-${Date.now()}`,
                        is_active: true,
                        description: `Auto-created for revenue posting`
                    });
                }
                
                return account;
            };

            const cashAccount = await getAccount('asset', 'Cash');
            const revenueAccount = await getAccount('revenue', 'Sales Revenue');
            const creditCardReceivableAccount = await getAccount('asset', 'Credit Card Receivable');
            const onlineSalesAccount = await getAccount('asset', 'Online Sales Receivable');
            const expenseAccount = await getAccount('expense', 'Transaction Fees');
            const customerTabAccount = await getAccount('asset', 'Customer Tabs Receivable');
            const otherExpenseAccount = await getAccount('expense', 'Other Cash Expenses');

            // Prepare journal entry lines
            const lines = [];
            let totalDebit = 0;
            let totalCredit = 0;

            // Cash revenue (if calculated business cash exists, use it; otherwise use total_cash)
            const businessCash = parseFloat(revenue.calculated_business_cash || revenue.total_cash || 0);
            if (businessCash > 0) {
                lines.push({
                    account_id: cashAccount.id,
                    debit_amount: businessCash,
                    credit_amount: 0,
                    description: `Daily cash revenue - ${revenue.entry_date}`
                });
                totalDebit += businessCash;
            }

            // Business credit card sales
            const businessCC = parseFloat(revenue.business_credit_card || 0);
            if (businessCC > 0) {
                lines.push({
                    account_id: creditCardReceivableAccount.id,
                    debit_amount: businessCC,
                    credit_amount: 0,
                    description: `Business credit card sales - ${revenue.entry_date}`
                });
                totalDebit += businessCC;
            }

            // Online sales (net)
            const onlineNet = parseFloat(revenue.online_net || 0);
            if (onlineNet > 0) {
                lines.push({
                    account_id: onlineSalesAccount.id,
                    debit_amount: onlineNet,
                    credit_amount: 0,
                    description: `Online sales (net) - ${revenue.entry_date}`
                });
                totalDebit += onlineNet;
            }

            // Customer tabs (net)
            const customerTab = parseFloat(revenue.customer_tab || 0);
            if (customerTab > 0) {
                lines.push({
                    account_id: customerTabAccount.id,
                    debit_amount: customerTab,
                    credit_amount: 0,
                    description: `Customer tabs (net) - ${revenue.entry_date}`
                });
                totalDebit += customerTab;
            }

            // Credit side: Revenue
            const totalRevenue = businessCash + businessCC + onlineNet + customerTab;
            if (totalRevenue > 0) {
                lines.push({
                    account_id: revenueAccount.id,
                    debit_amount: 0,
                    credit_amount: totalRevenue,
                    description: `Total revenue - ${revenue.entry_date}`
                });
                totalCredit += totalRevenue;
            }

            // Credit card transaction fees (expense)
            const ccFees = parseFloat(revenue.credit_card_transaction_fees || 0);
            if (ccFees > 0) {
                lines.push({
                    account_id: expenseAccount.id,
                    debit_amount: ccFees,
                    credit_amount: 0,
                    description: `Credit card transaction fees - ${revenue.entry_date}`
                });
                totalDebit += ccFees;
                
                // Offset in credit card receivable
                lines.push({
                    account_id: creditCardReceivableAccount.id,
                    debit_amount: 0,
                    credit_amount: ccFees,
                    description: `Transaction fees paid - ${revenue.entry_date}`
                });
                totalCredit += ccFees;
            }

            // Other cash expenses
            const otherExpense = parseFloat(revenue.other_cash_expense || 0);
            if (otherExpense > 0) {
                lines.push({
                    account_id: otherExpenseAccount.id,
                    debit_amount: otherExpense,
                    credit_amount: 0,
                    description: `Other cash expenses - ${revenue.entry_date}`
                });
                totalDebit += otherExpense;
                
                // Offset in cash
                lines.push({
                    account_id: cashAccount.id,
                    debit_amount: 0,
                    credit_amount: otherExpense,
                    description: `Cash expense paid - ${revenue.entry_date}`
                });
                totalCredit += otherExpense;
            }

            // Lottery transactions (if applicable)
            const lotteryOwed = parseFloat(revenue.calculated_lottery_owed || 0);
            if (lotteryOwed !== 0) {
                // Lottery owed is a liability (we owe money to lottery)
                const lotteryLiabilityAccount = await getAccount('liability', 'Lottery Payable');
                
                if (lotteryOwed > 0) {
                    // We owe money (liability increases)
                    lines.push({
                        account_id: lotteryLiabilityAccount.id,
                        debit_amount: 0,
                        credit_amount: lotteryOwed,
                        description: `Lottery cash owed - ${revenue.entry_date}`
                    });
                    totalCredit += lotteryOwed;
                } else {
                    // Negative means we received money (liability decreases)
                    lines.push({
                        account_id: lotteryLiabilityAccount.id,
                        debit_amount: Math.abs(lotteryOwed),
                        credit_amount: 0,
                        description: `Lottery payment received - ${revenue.entry_date}`
                    });
                    totalDebit += Math.abs(lotteryOwed);
                }
            }

            // Only create journal entry if we have balanced lines
            if (lines.length >= 2 && Math.abs(totalDebit - totalCredit) < 0.01) {
                const journalEntry = await JournalEntry.create(store.id, {
                    entry_date: revenue.entry_date,
                    entry_type: 'auto',
                    description: `Daily revenue entry - ${revenue.entry_date}`,
                    reference_type: 'revenue',
                    reference_id: revenue.id,
                    status: 'posted', // Auto-post revenue entries
                    lines: lines,
                    entered_by: revenue.entered_by,
                    notes: `Auto-posted from daily revenue entry (input form)`
                });

                // Post the entry
                await JournalEntry.post(journalEntry.id, revenue.entered_by);

                return journalEntry;
            }
        } catch (error) {
            console.error('Error auto-posting revenue to GL:', error);
            // Don't throw - allow revenue to be saved even if GL posting fails
            return null;
        }
    }
}

module.exports = AutoPostingService;

