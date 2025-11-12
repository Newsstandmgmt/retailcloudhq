const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');
const CrossStorePayment = require('../models/CrossStorePayment');
const AuditLog = require('../models/AuditLog');
const DailyOperatingExpenses = require('../models/DailyOperatingExpenses');

const router = express.Router();

router.use(authenticate);

const hasStoreAccess = async (userId, storeId) => {
    if (!storeId) return false;
    const result = await query(
        'SELECT can_user_access_store($1, $2) as can_access',
        [userId, storeId]
    );
    return result.rows[0]?.can_access === true;
};

const normalizeAllocations = async ({
    userId,
    sourceStoreId,
    allocations,
    splitMode,
    numericAmount
}) => {
    if (!Array.isArray(allocations) || allocations.length === 0) {
        throw new Error('At least one allocation is required.');
    }

    const computedAmounts = [];
    const computedPercentages = [];

    if (splitMode === 'percentage') {
        const rawPercentages = [];
        for (let index = 0; index < allocations.length; index++) {
            const allocation = allocations[index];
            const percentage = parseFloat(allocation.percentage ?? allocation.allocation_percentage);
            if (!Number.isFinite(percentage) || percentage <= 0) {
                throw new Error(`Allocation ${index + 1} must include a positive percentage.`);
            }
            rawPercentages.push(percentage);
        }

        const totalPercentage = rawPercentages.reduce((sum, value) => sum + value, 0);
        if (!Number.isFinite(totalPercentage) || Math.abs(totalPercentage - 100) > 0.01) {
            throw new Error('Allocation percentages must add up to 100%.');
        }

        let runningAmount = 0;
        rawPercentages.forEach((percentage, index) => {
            let amount;
            if (index === allocations.length - 1) {
                amount = parseFloat((numericAmount - runningAmount).toFixed(2));
            } else {
                amount = Math.round(numericAmount * percentage * 100) / 100;
                amount = parseFloat(amount.toFixed(2));
                runningAmount += amount;
            }
            computedAmounts.push(amount);
            computedPercentages.push(percentage);
        });
    }

    let allocationTotal = 0;
    const cleanedAllocations = [];

    for (let index = 0; index < allocations.length; index++) {
        const alloc = allocations[index];
        const targetStoreId = alloc.target_store_id;

        if (!targetStoreId) {
            throw new Error('Each allocation must include a target store.');
        }

        const canAccessTarget = await hasStoreAccess(userId, targetStoreId);
        if (!canAccessTarget) {
            throw new Error('You do not have access to one of the target stores.');
        }

        let allocatedAmount;
        let allocationPercentage = null;

        if (splitMode === 'percentage') {
            allocatedAmount = computedAmounts[index];
            allocationPercentage = computedPercentages[index];
        } else {
            allocatedAmount = parseFloat(alloc.amount ?? alloc.allocated_amount);
            if (!Number.isFinite(allocatedAmount) || allocatedAmount <= 0) {
                throw new Error('Each allocation must have a valid amount.');
            }
            const rawPercentage = parseFloat(alloc.percentage ?? alloc.allocation_percentage);
            if (Number.isFinite(rawPercentage) && rawPercentage > 0) {
                allocationPercentage = rawPercentage;
            } else if (numericAmount > 0) {
                allocationPercentage = (allocatedAmount / numericAmount) * 100;
            }
            allocatedAmount = parseFloat(allocatedAmount.toFixed(2));
        }

        allocationTotal += allocatedAmount;
        cleanedAllocations.push({
            target_store_id: targetStoreId,
            allocated_amount: parseFloat(allocatedAmount.toFixed(2)),
            allocation_percentage:
                allocationPercentage !== null && Number.isFinite(allocationPercentage)
                    ? parseFloat(allocationPercentage.toFixed(3))
                    : null,
            target_type: alloc.target_type || null,
            target_id: alloc.target_id || null,
            memo: alloc.memo || null,
            metadata: alloc.metadata || null,
            reimbursement_required: alloc.reimbursement_required !== false,
            reimbursement_note: alloc.reimbursement_note || null
        });
    }

    if (Math.abs(allocationTotal - numericAmount) > 0.01) {
        throw new Error('Allocations must add up to the total payment amount.');
    }

    return cleanedAllocations;
};

router.post('/', authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const {
            source_store_id,
            payment_date,
            payment_method,
            payment_reference,
            amount,
            currency,
            paid_to,
            notes,
            metadata,
            allocations
        } = req.body;
        const context = req.body.context || 'payment';
        const expenseDefaults = req.body.expense_defaults || {};
        const splitMode = req.body.split_mode === 'percentage' ? 'percentage' : 'amount';

        if (!source_store_id) {
            return res.status(400).json({ error: 'Source store is required.' });
        }

        if (!payment_date) {
            return res.status(400).json({ error: 'Payment date is required.' });
        }

        if (!payment_method) {
            return res.status(400).json({ error: 'Payment method is required.' });
        }

        const numericAmount = parseFloat(amount);
        if (!numericAmount || numericAmount <= 0) {
            return res.status(400).json({ error: 'Valid payment amount is required.' });
        }

        if (!Array.isArray(allocations) || allocations.length === 0) {
            return res.status(400).json({ error: 'At least one allocation is required.' });
        }

        // Check access to source store
        const canAccessSource = await hasStoreAccess(req.user.id, source_store_id);
        if (!canAccessSource) {
            return res.status(403).json({ error: 'You do not have access to the source store.' });
        }

        let computedAmounts = [];
        let computedPercentages = [];

        if (splitMode === 'percentage') {
            // Legacy support: computedAmounts populated for downstream calculations
            // normalizeAllocations handles validation; this retains previous behaviour for remainder logic
            const rawPercentages = allocations.map((allocation) =>
                parseFloat(allocation.percentage ?? allocation.allocation_percentage)
            );
            let runningAmount = 0;
            rawPercentages.forEach((percentage, index) => {
                let amount;
                if (index === allocations.length - 1) {
                    amount = parseFloat((numericAmount - runningAmount).toFixed(2));
                } else {
                    amount = Math.round(numericAmount * percentage * 100) / 100;
                    amount = parseFloat(amount.toFixed(2));
                    runningAmount += amount;
                }
                computedAmounts.push(amount);
                computedPercentages.push(percentage);
            });
        }

        let cleanedAllocations;
        try {
            cleanedAllocations = await normalizeAllocations({
                userId: req.user.id,
                sourceStoreId: source_store_id,
                allocations,
                splitMode,
                numericAmount
            });
        } catch (validationError) {
            return res.status(400).json({ error: validationError.message });
        }

        const payment = await CrossStorePayment.create(
            {
                source_store_id,
                payment_date,
                payment_method,
                payment_reference,
                amount: numericAmount,
                currency: currency || 'USD',
                paid_to,
                notes,
                metadata,
                created_by: req.user.id
            },
            cleanedAllocations
        );

        let expensesCreated = [];
        try {
            if (context === 'expense') {
                for (let index = 0; index < payment.allocations.length; index++) {
                    const allocationRow = payment.allocations[index];
                    const allocationInput = allocations[index] || {};

                    if (allocationInput.create_expense === false) {
                        continue;
                    }

                    const expenseTypeId =
                        allocationInput.expense_type_id || expenseDefaults.expense_type_id || null;

                    const expenseEntryDate =
                        allocationInput.entry_date ||
                        expenseDefaults.entry_date ||
                        payment_date;

                    const expensePaymentMethod =
                        allocationInput.expense_payment_method ||
                        expenseDefaults.payment_method ||
                        payment_method;

                    const reimbursementRequired = allocationRow.reimbursement_required !== false;
                    const reimbursementStatus = reimbursementRequired ? 'pending' : 'none';
                    const reimbursementTo = reimbursementRequired
                        ? (allocationInput.reimbursement_to ||
                            expenseDefaults.reimbursement_to ||
                            paid_to ||
                            null)
                        : null;

                    const notesParts = [
                        allocationInput.expense_note,
                        expenseDefaults.notes,
                        allocationRow.memo
                    ].filter(Boolean);

                    const expenseData = {
                        store_id: allocationRow.target_store_id,
                        entry_date: expenseEntryDate,
                        expense_type_id: expenseTypeId,
                        amount: parseFloat(allocationRow.allocated_amount),
                        is_recurring: expenseDefaults.is_recurring || false,
                        recurring_frequency: expenseDefaults.recurring_frequency || null,
                        is_autopay: expenseDefaults.is_autopay || false,
                        payment_method: expensePaymentMethod,
                        bank_id: expenseDefaults.bank_id || null,
                        bank_account_name: expenseDefaults.bank_account_name || null,
                        credit_card_id: expenseDefaults.credit_card_id || null,
                        is_reimbursable: reimbursementRequired,
                        reimbursement_to: reimbursementTo,
                        reimbursement_status: reimbursementStatus,
                        notes: notesParts.join(' • ') || null,
                        entered_by: req.user.id,
                        paid_by_store_id: source_store_id,
                        cross_store_payment_id: payment.id,
                        cross_store_allocation_id: allocationRow.id
                    };

                    const createdExpense = await DailyOperatingExpenses.create(expenseData);
                    expensesCreated.push(createdExpense);

                    await query(
                        `UPDATE cross_store_payment_allocations
                         SET target_type = 'expense',
                             target_id = $1
                         WHERE id = $2`,
                        [createdExpense.id, allocationRow.id]
                    );

                    payment.allocations[index] = {
                        ...allocationRow,
                        target_type: 'expense',
                        target_id: createdExpense.id,
                        expense_id: createdExpense.id
                    };
                }
            }
        } catch (expenseError) {
            console.error('Failed to create cross-store expense entries:', expenseError);
            await query('DELETE FROM cross_store_payments WHERE id = $1', [payment.id]);
            throw expenseError;
        }

        try {
            await AuditLog.create({
                user_id: req.user.id,
                user_email: req.user.email,
                user_name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim(),
                action_type: 'create',
                entity_type: 'cross_store_payment',
                entity_id: payment.id,
                action_description: `Created cross-store payment from ${source_store_id} with ${cleanedAllocations.length} allocations.`,
                resource_path: req.originalUrl,
                http_method: req.method,
                store_id: source_store_id,
                new_values: {
                    payment,
                    allocations: cleanedAllocations,
                    expenses_created: expensesCreated
                }
            });
        } catch (auditError) {
            console.warn('Failed to create audit log for cross store payment:', auditError.message);
        }

        const result = await CrossStorePayment.findById(payment.id);
        if (result) {
            result.split_mode = splitMode;
        }
        res.status(201).json({ payment: result });
    } catch (error) {
        console.error('Create cross-store payment error:', error);
        res.status(500).json({ error: error.message || 'Failed to create cross-store payment.' });
    }
});

router.put('/:paymentId', authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const paymentId = req.params.paymentId;
        const existing = await CrossStorePayment.findById(paymentId);

        if (!existing) {
            return res.status(404).json({ error: 'Cross-store payment not found.' });
        }

        const canAccessExistingSource = await hasStoreAccess(req.user.id, existing.source_store_id);
        if (!canAccessExistingSource) {
            return res.status(403).json({ error: 'You do not have access to the source store.' });
        }

        const {
            source_store_id = existing.source_store_id,
            payment_date,
            payment_method,
            payment_reference,
            amount,
            currency,
            paid_to,
            notes,
            metadata,
            allocations
        } = req.body;
        const context = req.body.context || 'payment';
        const expenseDefaults = req.body.expense_defaults || {};
        const splitMode = req.body.split_mode === 'percentage' ? 'percentage' : 'amount';

        const numericAmount = parseFloat(amount);
        if (!numericAmount || numericAmount <= 0) {
            return res.status(400).json({ error: 'Valid payment amount is required.' });
        }

        if (!payment_date) {
            return res.status(400).json({ error: 'Payment date is required.' });
        }

        if (!payment_method) {
            return res.status(400).json({ error: 'Payment method is required.' });
        }

        if (!Array.isArray(allocations) || allocations.length === 0) {
            return res.status(400).json({ error: 'At least one allocation is required.' });
        }

        let cleanedAllocations;
        try {
            cleanedAllocations = await normalizeAllocations({
                userId: req.user.id,
                sourceStoreId: source_store_id,
                allocations,
                splitMode,
                numericAmount
            });
        } catch (validationError) {
            return res.status(400).json({ error: validationError.message });
        }

        const canAccessSource = await hasStoreAccess(req.user.id, source_store_id);
        if (!canAccessSource) {
            return res.status(403).json({ error: 'You do not have access to the source store.' });
        }

        const updatedPayment = await CrossStorePayment.updatePayment(
            paymentId,
            {
                source_store_id,
                payment_date,
                payment_method,
                payment_reference,
                amount: numericAmount,
                currency: currency || existing.currency || 'USD',
                paid_to,
                notes,
                metadata
            },
            cleanedAllocations,
            {
                context,
                expenseDefaults,
                rawAllocations: allocations,
                userId: req.user.id
            }
        );

        try {
            await AuditLog.create({
                user_id: req.user.id,
                user_email: req.user.email,
                user_name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim(),
                action_type: 'update',
                entity_type: 'cross_store_payment',
                entity_id: paymentId,
                action_description: `Updated cross-store payment ${paymentId}.`,
                resource_path: req.originalUrl,
                http_method: req.method,
                store_id: source_store_id,
                old_values: existing,
                new_values: updatedPayment
            });
        } catch (auditError) {
            console.warn('Failed to create audit log for cross store payment update:', auditError.message);
        }

        res.json({ payment: updatedPayment });
    } catch (error) {
        console.error('Update cross-store payment error:', error);
        res.status(500).json({ error: error.message || 'Failed to update cross-store payment.' });
    }
});

router.delete('/allocations/:allocationId', authorize('admin', 'super_admin', 'manager'), async (req, res) => {
    try {
        const allocationId = req.params.allocationId;
        const updatedPayment = await CrossStorePayment.removeAllocation(allocationId, req.user.id);
        res.json({ payment: updatedPayment });
    } catch (error) {
        console.error('Delete cross-store allocation error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete cross-store allocation.' });
    }
});

router.delete('/:paymentId', authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const paymentId = req.params.paymentId;
        const payment = await CrossStorePayment.findById(paymentId);

        if (!payment) {
            return res.status(404).json({ error: 'Cross-store payment not found.' });
        }

        const canAccessSource = await hasStoreAccess(req.user.id, payment.source_store_id);
        if (!canAccessSource) {
            return res.status(403).json({ error: 'You do not have access to the source store.' });
        }

        const hasCompletedReimbursement =
            Array.isArray(payment.allocations) &&
            payment.allocations.some((alloc) => alloc.reimbursement_status === 'completed');
        if (hasCompletedReimbursement) {
            return res.status(400).json({
                error: 'Cannot delete a cross-store payment that has completed reimbursements. Mark them as pending first.',
            });
        }

        await CrossStorePayment.deletePayment(paymentId);

        try {
            await AuditLog.create({
                user_id: req.user.id,
                user_email: req.user.email,
                user_name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim(),
                action_type: 'delete',
                entity_type: 'cross_store_payment',
                entity_id: paymentId,
                action_description: `Deleted cross-store payment ${paymentId}.`,
                resource_path: req.originalUrl,
                http_method: req.method,
                store_id: payment.source_store_id,
                old_values: payment
            });
        } catch (auditError) {
            console.warn('Failed to create audit log for cross store payment deletion:', auditError.message);
        }

        res.status(204).send();
    } catch (error) {
        console.error('Delete cross-store payment error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete cross-store payment.' });
    }
});

router.get('/', authorize('admin', 'super_admin', 'manager'), async (req, res) => {
    try {
        const payments = await CrossStorePayment.findByFilters(req.user.id, {
            store_id: req.query.store_id || null,
            role: req.query.role || 'all',
            start_date: req.query.start_date || null,
            end_date: req.query.end_date || null,
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            offset: req.query.offset ? parseInt(req.query.offset) : 0
        });

        res.json({ payments });
    } catch (error) {
        console.error('List cross-store payments error:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch cross-store payments.' });
    }
});

router.get('/:paymentId', authorize('admin', 'super_admin', 'manager'), async (req, res) => {
    try {
        const payment = await CrossStorePayment.findById(req.params.paymentId);

        if (!payment) {
            return res.status(404).json({ error: 'Cross-store payment not found.' });
        }

        const userId = req.user.id;
        const canAccessSource = await hasStoreAccess(userId, payment.source_store_id);
        let canAccessTarget = false;

        if (payment.allocations && payment.allocations.length > 0) {
            for (const alloc of payment.allocations) {
                if (await hasStoreAccess(userId, alloc.target_store_id)) {
                    canAccessTarget = true;
                    break;
                }
            }
        }

        if (!canAccessSource && !canAccessTarget) {
            return res.status(403).json({ error: 'Access denied to this payment.' });
        }

        res.json({ payment });
    } catch (error) {
        console.error('Get cross-store payment error:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch cross-store payment.' });
    }
});

router.post('/allocations/:allocationId/reimbursement', authorize('admin', 'super_admin', 'manager'), async (req, res) => {
    try {
        const allocationId = req.params.allocationId;

        const allocationResult = await query(
            `SELECT 
                a.*,
                p.source_store_id
             FROM cross_store_payment_allocations a
             JOIN cross_store_payments p ON p.id = a.payment_id
             WHERE a.id = $1`,
            [allocationId]
        );

        if (allocationResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cross-store payment allocation not found.' });
        }

        const allocation = allocationResult.rows[0];

        const canAccessSource = await hasStoreAccess(req.user.id, allocation.source_store_id);
        const canAccessTarget = await hasStoreAccess(req.user.id, allocation.target_store_id);

        if (!canAccessSource && !canAccessTarget) {
            return res.status(403).json({ error: 'Access denied to this allocation.' });
        }

        const updates = {
            status: req.body.status,
            reimbursed_amount: req.body.reimbursed_amount,
            reimbursement_note: req.body.reimbursement_note,
            reimbursement_required:
                typeof req.body.reimbursement_required === 'boolean'
                    ? req.body.reimbursement_required
                    : undefined,
            reimbursement_method: req.body.reimbursement_method,
            reimbursement_reference: req.body.reimbursement_reference,
            reimbursed_cash_amount: req.body.reimbursed_cash_amount,
            reimbursement_payment_method: req.body.reimbursement_payment_method,
            reimbursement_check_number: req.body.reimbursement_check_number,
            reimbursement_bank_id: req.body.reimbursement_bank_id
        };

        const updateResult = await CrossStorePayment.updateAllocationReimbursement(
            allocationId,
            updates,
            req.user.id
        );

        try {
            await AuditLog.create({
                user_id: req.user.id,
                user_email: req.user.email,
                user_name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim(),
                action_type: 'update',
                entity_type: 'cross_store_payment_allocation',
                entity_id: allocationId,
                action_description: `Updated reimbursement status for cross-store payment allocation ${allocationId}.`,
                resource_path: req.originalUrl,
                http_method: req.method,
                store_id: allocation.target_store_id,
                old_values: {
                    reimbursement_status: allocation.reimbursement_status,
                    reimbursement_required: allocation.reimbursement_required,
                    reimbursed_amount: allocation.reimbursed_amount,
                    reimbursement_note: allocation.reimbursement_note,
                    reimbursement_method: allocation.reimbursement_method,
                    reimbursement_reference: allocation.reimbursement_reference
                },
                new_values: {
                    reimbursement_status: updateResult.allocation.reimbursement_status,
                    reimbursement_required: updateResult.allocation.reimbursement_required,
                    reimbursed_amount: updateResult.allocation.reimbursed_amount,
                    reimbursement_note: updateResult.allocation.reimbursement_note,
                    reimbursement_method: updateResult.allocation.reimbursement_method,
                    reimbursement_reference: updateResult.allocation.reimbursement_reference
                }
            });
        } catch (auditError) {
            console.warn('Failed to create audit log for cross store reimbursement update:', auditError.message);
        }

        const payment = await CrossStorePayment.findById(updateResult.payment_id);
        res.json({ payment });
    } catch (error) {
        console.error('Update cross-store allocation reimbursement error:', error);
        res.status(500).json({ error: error.message || 'Failed to update reimbursement status.' });
    }
});

module.exports = router;

