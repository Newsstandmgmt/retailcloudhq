const express = require('express');
const DailyOperatingExpenses = require('../models/DailyOperatingExpenses');
const AutoPostingService = require('../services/autoPostingService');
const CashOnHandService = require('../services/cashOnHandService');
const { authenticate, canAccessStore } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Get all expenses with filters
router.get('/:storeId', canAccessStore, async (req, res) => {
    try {
        const filters = {
            start_date: req.query.start_date || null,
            end_date: req.query.end_date || null,
            expense_type_id: req.query.expense_type_id || null,
            payment_method: req.query.payment_method || null,
            reimbursement_status: req.query.reimbursement_status || null,
            is_recurring: req.query.is_recurring ? req.query.is_recurring === 'true' : null,
            search: req.query.search || null
        };
        
        const expenses = await DailyOperatingExpenses.findByDateRange(req.params.storeId, filters);
        
        res.json({ expenses });
    } catch (error) {
        console.error('Get expenses error:', error);
        res.status(500).json({ error: 'Failed to fetch expenses' });
    }
});

// Create expense entry
router.post('/:storeId', canAccessStore, async (req, res) => {
    try {
        const expenseData = {
            ...req.body,
            store_id: req.params.storeId,
            entered_by: req.user.id
        };
        
        const expense = await DailyOperatingExpenses.create(expenseData);
 
         // Auto-post to General Ledger
        let expenseTypeName = 'Operating Expense';
        try {
            // Get expense type name for posting
            const { query } = require('../config/database');
            const expenseTypeResult = await query(
                'SELECT expense_type_name FROM expense_types WHERE id = $1',
                [expense.expense_type_id]
            );
            expenseTypeName = expenseTypeResult.rows[0]?.expense_type_name || 'Operating Expense';
            
            // Get full expense with type name
            const fullExpense = await DailyOperatingExpenses.findById(expense.id);
            await AutoPostingService.postExpense(fullExpense, expenseTypeName);
        } catch (glError) {
            console.error('Error auto-posting expense to GL (non-blocking):', glError);
            // Don't fail the expense creation if GL posting fails
        }
        
        // Update cash on hand if paid in cash
        if (expense.payment_method === 'cash') {
            try {
                await CashOnHandService.subtractCash(
                    req.params.storeId,
                    parseFloat(expense.amount),
                    'expense',
                    expense.id,
                    expense.entry_date,
                    `Operating expense: ${expenseTypeName || 'Expense'} - $${parseFloat(expense.amount).toFixed(2)}`,
                    req.user.id
                );
            } catch (cashError) {
                console.error('Error updating cash on hand (non-blocking):', cashError);
            }
        }
        
        res.status(201).json({
            message: 'Expense entry created successfully',
            expense
        });
    } catch (error) {
        console.error('Create expense error:', error);
        res.status(500).json({ error: 'Failed to create expense entry' });
    }
});

// Get expense by ID
router.get('/:storeId/:expenseId', canAccessStore, async (req, res) => {
    try {
        const expense = await DailyOperatingExpenses.findById(req.params.expenseId);
        
        if (!expense) {
            return res.status(404).json({ error: 'Expense entry not found' });
        }
        
        if (expense.store_id !== req.params.storeId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        res.json({ expense });
    } catch (error) {
        console.error('Get expense error:', error);
        res.status(500).json({ error: 'Failed to fetch expense entry' });
    }
});

// Update expense entry
router.put('/:storeId/:expenseId', canAccessStore, async (req, res) => {
    try {
        const expense = await DailyOperatingExpenses.findById(req.params.expenseId);
        
        if (!expense) {
            return res.status(404).json({ error: 'Expense entry not found' });
        }
        
        if (expense.store_id !== req.params.storeId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const updated = await DailyOperatingExpenses.update(req.params.expenseId, req.body);
        
        res.json({
            message: 'Expense entry updated successfully',
            expense: updated
        });
    } catch (error) {
        console.error('Update expense error:', error);
        res.status(500).json({ error: 'Failed to update expense entry' });
    }
});

// Delete expense entry
router.delete('/:storeId/:expenseId', canAccessStore, async (req, res) => {
    try {
        const expense = await DailyOperatingExpenses.findById(req.params.expenseId);
        
        if (!expense) {
            return res.status(404).json({ error: 'Expense entry not found' });
        }
        
        if (expense.store_id !== req.params.storeId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        await DailyOperatingExpenses.delete(req.params.expenseId);
        
        res.json({ message: 'Expense entry deleted successfully' });
    } catch (error) {
        console.error('Delete expense error:', error);
        res.status(500).json({ error: 'Failed to delete expense entry' });
    }
});

// Mark expense as reimbursed
router.post('/:storeId/:expenseId/reimburse', canAccessStore, async (req, res) => {
    try {
        const expense = await DailyOperatingExpenses.findById(req.params.expenseId);
        
        if (!expense) {
            return res.status(404).json({ error: 'Expense entry not found' });
        }
        
        if (expense.store_id !== req.params.storeId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (expense.reimbursement_status !== 'pending') {
            return res.status(400).json({ error: 'Expense is not pending reimbursement' });
        }
        
        const { reimbursement_date, reimbursement_amount } = req.body;
        
        const updated = await DailyOperatingExpenses.markReimbursed(req.params.expenseId, {
            reimbursement_date: reimbursement_date || new Date().toISOString().split('T')[0],
            reimbursement_amount: reimbursement_amount || expense.amount,
            reimbursement_payment_method: req.body.reimbursement_payment_method,
            reimbursement_check_number: req.body.reimbursement_check_number,
            reimbursement_bank_id: req.body.reimbursement_bank_id
        });

        // Auto-post reimbursement to General Ledger
        try {
            await AutoPostingService.postReimbursement(updated, {
                reimbursement_date: updated.reimbursement_date,
                reimbursement_amount: updated.reimbursement_amount,
                reimbursement_payment_method: updated.reimbursement_payment_method,
                reimbursement_check_number: updated.reimbursement_check_number,
                entered_by: req.user.id
            });
        } catch (glError) {
            console.error('Error auto-posting reimbursement to GL (non-blocking):', glError);
        }

        // Update cash on hand if cash reimbursement
        if (updated.reimbursement_payment_method === 'cash') {
            try {
                const expenseTypeName = updated.expense_type_name || 'Expense';
                await CashOnHandService.subtractCash(
                    req.params.storeId,
                    parseFloat(updated.reimbursement_amount || expense.amount),
                    'reimbursement',
                    expense.id,
                    updated.reimbursement_date,
                    `Expense reimbursement: ${expenseTypeName} - $${parseFloat(updated.reimbursement_amount || expense.amount).toFixed(2)}`,
                    req.user.id
                );
            } catch (cashError) {
                console.error('Error updating cash on hand (non-blocking):', cashError);
            }
        }
        
        res.json({
            message: 'Expense marked as reimbursed successfully',
            expense: updated
        });
    } catch (error) {
        console.error('Reimburse expense error:', error);
        res.status(500).json({ error: 'Failed to mark expense as reimbursed' });
    }
});

// Get pending reimbursements
router.get('/:storeId/reimbursements/pending', canAccessStore, async (req, res) => {
    try {
        const expenses = await DailyOperatingExpenses.getPendingReimbursements(req.params.storeId);
        
        res.json({ expenses });
    } catch (error) {
        console.error('Get pending reimbursements error:', error);
        res.status(500).json({ error: 'Failed to fetch pending reimbursements' });
    }
});

module.exports = router;
