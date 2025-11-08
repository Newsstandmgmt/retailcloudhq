const { query } = require('../config/database');
const DailyOperatingExpenses = require('../models/DailyOperatingExpenses');

class RecurringExpensesService {
    /**
     * Get all recurring expenses that need to be processed
     */
    static async getRecurringExpensesToProcess() {
        const result = await query(
            `SELECT DISTINCT e.*, et.expense_type_name
             FROM daily_operating_expenses e
             LEFT JOIN expense_types et ON e.expense_type_id = et.id
             WHERE e.is_recurring = true
             AND e.recurring_frequency IS NOT NULL
             ORDER BY e.store_id, e.entry_date`
        );
        
        return result.rows;
    }

    /**
     * Calculate next due date based on frequency and last entry date
     */
    static calculateNextDueDate(lastDate, frequency) {
        const date = new Date(lastDate);
        
        switch (frequency) {
            case 'daily':
                date.setDate(date.getDate() + 1);
                break;
            case 'weekly':
                date.setDate(date.getDate() + 7);
                break;
            case 'monthly':
                date.setMonth(date.getMonth() + 1);
                break;
            case 'yearly':
                date.setFullYear(date.getFullYear() + 1);
                break;
            default:
                return null;
        }
        
        return date.toISOString().split('T')[0];
    }

    /**
     * Check if an expense entry should be created today
     */
    static shouldCreateEntry(today, lastDate, frequency) {
        const nextDueDate = this.calculateNextDueDate(lastDate, frequency);
        if (!nextDueDate) return false;
        
        return today >= nextDueDate;
    }

    /**
     * Create expense entries for all due recurring expenses
     */
    static async processRecurringExpenses(forDate = null) {
        const today = forDate || new Date().toISOString().split('T')[0];
        const recurringExpenses = await this.getRecurringExpensesToProcess();
        
        const createdEntries = [];
        const errors = [];

        for (const expense of recurringExpenses) {
            try {
                // Get the most recent entry for this recurring expense
                // We identify recurring expenses by matching store_id, expense_type_id, amount, and is_recurring
                const lastEntryResult = await query(
                    `SELECT entry_date, id
                     FROM daily_operating_expenses
                     WHERE store_id = $1
                     AND expense_type_id = $2
                     AND amount = $3
                     AND is_recurring = true
                     AND recurring_frequency = $4
                     ORDER BY entry_date DESC
                     LIMIT 1`,
                    [expense.store_id, expense.expense_type_id, expense.amount, expense.recurring_frequency]
                );

                const lastEntry = lastEntryResult.rows[0];
                if (!lastEntry) continue;

                // Check if we need to create an entry
                if (!this.shouldCreateEntry(today, lastEntry.entry_date, expense.recurring_frequency)) {
                    continue;
                }

                // Check if entry already exists for today
                const existingCheck = await query(
                    `SELECT id FROM daily_operating_expenses
                     WHERE store_id = $1
                     AND expense_type_id = $2
                     AND amount = $3
                     AND is_recurring = true
                     AND recurring_frequency = $4
                     AND entry_date = $5`,
                    [expense.store_id, expense.expense_type_id, expense.amount, expense.recurring_frequency, today]
                );

                if (existingCheck.rows.length > 0) {
                    continue; // Already created
                }

                // Calculate the next entry date
                const nextEntryDate = this.calculateNextDueDate(lastEntry.entry_date, expense.recurring_frequency);
                
                // Use the calculated next entry date, but don't go beyond today
                const entryDate = nextEntryDate <= today ? nextEntryDate : today;

                // Create the new expense entry
                const newExpense = await DailyOperatingExpenses.create({
                    store_id: expense.store_id,
                    entry_date: entryDate,
                    expense_type_id: expense.expense_type_id,
                    amount: expense.amount,
                    is_recurring: expense.is_recurring,
                    recurring_frequency: expense.recurring_frequency,
                    is_autopay: expense.is_autopay,
                    payment_method: expense.payment_method,
                    bank_id: expense.bank_id,
                    bank_account_name: expense.bank_account_name,
                    credit_card_id: expense.credit_card_id,
                    is_reimbursable: expense.is_reimbursable,
                    reimbursement_to: expense.reimbursement_to,
                    reimbursement_status: expense.reimbursement_status || 'none',
                    notes: expense.notes ? `${expense.notes} (Auto-created from recurring expense)` : 'Auto-created from recurring expense',
                    entered_by: expense.entered_by // Use original creator
                });

                createdEntries.push({
                    expense_id: newExpense.id,
                    store_id: expense.store_id,
                    expense_type: expense.expense_type_name,
                    amount: expense.amount,
                    entry_date: entryDate
                });

            } catch (error) {
                console.error(`Error processing recurring expense ${expense.id}:`, error);
                errors.push({
                    expense_id: expense.id,
                    error: error.message
                });
            }
        }

        return {
            created: createdEntries,
            errors: errors,
            total_processed: recurringExpenses.length
        };
    }

    /**
     * Get all recurring expense templates for a store
     */
    static async getRecurringTemplates(storeId) {
        const result = await query(
            `SELECT DISTINCT ON (expense_type_id, amount, recurring_frequency)
             e.*, et.expense_type_name
             FROM daily_operating_expenses e
             LEFT JOIN expense_types et ON e.expense_type_id = et.id
             WHERE e.store_id = $1
             AND e.is_recurring = true
             AND e.recurring_frequency IS NOT NULL
             ORDER BY expense_type_id, amount, recurring_frequency, entry_date DESC`,
            [storeId]
        );

        // Get next due date for each template (using Promise.all for async operations)
        const templatesWithNextDates = await Promise.all(result.rows.map(async (template) => {
            const lastEntryResult = await query(
                `SELECT entry_date
                 FROM daily_operating_expenses
                 WHERE store_id = $1
                 AND expense_type_id = $2
                 AND amount = $3
                 AND is_recurring = true
                 AND recurring_frequency = $4
                 ORDER BY entry_date DESC
                 LIMIT 1`,
                [template.store_id, template.expense_type_id, template.amount, template.recurring_frequency]
            );

            const lastEntry = lastEntryResult.rows[0];
            if (lastEntry) {
                template.next_due_date = this.calculateNextDueDate(lastEntry.entry_date, template.recurring_frequency);
            } else {
                template.next_due_date = null;
            }

            return template;
        }));

        return templatesWithNextDates;
    }
}

module.exports = RecurringExpensesService;

