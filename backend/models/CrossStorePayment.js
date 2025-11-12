const { query, getClient } = require('../config/database');
const DailyOperatingExpenses = require('./DailyOperatingExpenses');
const CashOnHandService = require('../services/cashOnHandService');

class CrossStorePayment {
    static async create(paymentData, allocations = []) {
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
            created_by
        } = paymentData;

        const client = await getClient();

        try {
            await client.query('BEGIN');

            const paymentResult = await client.query(
                `INSERT INTO cross_store_payments (
                    source_store_id,
                    payment_date,
                    payment_method,
                    payment_reference,
                    amount,
                    currency,
                    paid_to,
                    notes,
                    metadata,
                    created_by
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                RETURNING *`,
                [
                    source_store_id,
                    payment_date,
                    payment_method,
                    payment_reference || null,
                    amount,
                    currency || 'USD',
                    paid_to || null,
                    notes || null,
                    metadata ? JSON.stringify(metadata) : null,
                    created_by || null
                ]
            );

            const payment = paymentResult.rows[0];
            const allocationRows = [];

            for (const alloc of allocations) {
                const reimbursementRequired = alloc.reimbursement_required !== false;
                const reimbursementStatus = reimbursementRequired ? 'pending' : 'not_required';
                const allocationResult = await client.query(
                    `INSERT INTO cross_store_payment_allocations (
                        payment_id,
                        target_store_id,
                        allocated_amount,
                        target_type,
                        target_id,
                        memo,
                        approved_by,
                        approved_at,
                        metadata,
                        reimbursement_required,
                        reimbursement_status,
                        reimbursed_at,
                        reimbursed_amount,
                        reimbursed_by,
                        reimbursement_note,
                        allocation_percentage
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                    RETURNING *`,
                    [
                        payment.id,
                        alloc.target_store_id,
                        alloc.allocated_amount,
                        alloc.target_type || null,
                        alloc.target_id || null,
                        alloc.memo || null,
                        alloc.approved_by || null,
                        alloc.approved_at || null,
                        alloc.metadata ? JSON.stringify(alloc.metadata) : null,
                        reimbursementRequired,
                        reimbursementStatus,
                        null,
                        null,
                        null,
                        alloc.reimbursement_note || null,
                        alloc.allocation_percentage !== undefined && alloc.allocation_percentage !== null
                            ? parseFloat(alloc.allocation_percentage)
                            : null
                    ]
                );
                allocationRows.push({
                    ...allocationResult.rows[0],
                    client_reference: alloc.client_reference || null
                });
            }

            await client.query('COMMIT');

            return {
                ...payment,
                allocations: allocationRows
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async findById(paymentId) {
        const paymentResult = await query(
            `SELECT 
                p.*,
                source_store.name AS source_store_name,
                u.first_name,
                u.last_name
             FROM cross_store_payments p
             JOIN stores source_store ON source_store.id = p.source_store_id
             LEFT JOIN users u ON u.id = p.created_by
             WHERE p.id = $1`,
            [paymentId]
        );

        if (paymentResult.rows.length === 0) {
            return null;
        }

        const allocationsResult = await query(
            `SELECT 
                a.*,
                target_store.name AS target_store_name,
                approver.first_name AS approved_by_first_name,
                approver.last_name AS approved_by_last_name,
                doe.id AS expense_id,
                doe.entry_date AS expense_entry_date,
                doe.expense_type_id AS expense_expense_type_id,
                doe.amount AS expense_amount,
                doe.notes AS expense_notes,
                doe.reimbursement_status AS expense_reimbursement_status,
                doe.reimbursement_date AS expense_reimbursement_date,
                doe.reimbursement_amount AS expense_reimbursement_amount,
                doe.reimbursement_payment_method,
                doe.reimbursement_check_number,
                doe.reimbursement_bank_id,
                rb.bank_name AS reimbursement_bank_name,
                rb.bank_short_name AS reimbursement_bank_short_name,
                et.expense_type_name AS expense_type_name
             FROM cross_store_payment_allocations a
             JOIN stores target_store ON target_store.id = a.target_store_id
             LEFT JOIN users approver ON approver.id = a.approved_by
             LEFT JOIN daily_operating_expenses doe ON doe.cross_store_payment_id = a.payment_id AND doe.cross_store_allocation_id = a.id
             LEFT JOIN expense_types et ON doe.expense_type_id = et.id
             LEFT JOIN banks rb ON rb.id = doe.reimbursement_bank_id
             WHERE a.payment_id = $1
             ORDER BY a.created_at`,
            [paymentId]
        );

        return {
            ...paymentResult.rows[0],
            allocations: allocationsResult.rows
        };
    }

    static async findByFilters(userId, filters = {}) {
        const {
            store_id,
            role = 'all', // source | target | all
            start_date,
            end_date,
            limit = 50,
            offset = 0
        } = filters;

        const params = [userId];
        let paramIndex = params.length + 1;

        let conditions = [
            `(can_user_access_store($1, p.source_store_id) = true 
              OR EXISTS (
                    SELECT 1 FROM cross_store_payment_allocations alloc
                    WHERE alloc.payment_id = p.id
                    AND can_user_access_store($1, alloc.target_store_id) = true
              ))`
        ];

        if (store_id) {
            params.push(store_id);
            paramIndex = params.length + 1;
            if (role === 'source') {
                conditions.push(`p.source_store_id = $${params.length}`);
            } else if (role === 'target') {
                conditions.push(`EXISTS (
                    SELECT 1 FROM cross_store_payment_allocations alloc2
                    WHERE alloc2.payment_id = p.id
                    AND alloc2.target_store_id = $${params.length}
                )`);
            } else {
                conditions.push(`(
                    p.source_store_id = $${params.length} OR
                    EXISTS (
                        SELECT 1 FROM cross_store_payment_allocations alloc3
                        WHERE alloc3.payment_id = p.id
                        AND alloc3.target_store_id = $${params.length}
                    )
                )`);
            }
        }

        if (start_date) {
            params.push(start_date);
            conditions.push(`p.payment_date >= $${params.length}`);
        }

        if (end_date) {
            params.push(end_date);
            conditions.push(`p.payment_date <= $${params.length}`);
        }

        params.push(limit);
        params.push(offset);

        const paymentRows = await query(
            `SELECT 
                p.*,
                source_store.name AS source_store_name,
                u.first_name,
                u.last_name
             FROM cross_store_payments p
             JOIN stores source_store ON source_store.id = p.source_store_id
             LEFT JOIN users u ON u.id = p.created_by
             WHERE ${conditions.join(' AND ')}
             ORDER BY p.payment_date DESC, p.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        if (paymentRows.rows.length === 0) {
            return [];
        }

        const paymentIds = paymentRows.rows.map(row => row.id);
        const allocationsResult = await query(
            `SELECT 
                a.*,
                target_store.name AS target_store_name,
                approver.first_name AS approved_by_first_name,
                approver.last_name AS approved_by_last_name,
                doe.id AS expense_id,
                doe.entry_date AS expense_entry_date,
                doe.expense_type_id AS expense_expense_type_id,
                doe.amount AS expense_amount,
                doe.notes AS expense_notes,
                doe.reimbursement_status AS expense_reimbursement_status,
                doe.reimbursement_date AS expense_reimbursement_date,
                doe.reimbursement_amount AS expense_reimbursement_amount,
                doe.reimbursement_payment_method,
                doe.reimbursement_check_number,
                doe.reimbursement_bank_id,
                rb.bank_name AS reimbursement_bank_name,
                rb.bank_short_name AS reimbursement_bank_short_name,
                et.expense_type_name AS expense_type_name
             FROM cross_store_payment_allocations a
             JOIN stores target_store ON target_store.id = a.target_store_id
             LEFT JOIN users approver ON approver.id = a.approved_by
             LEFT JOIN daily_operating_expenses doe ON doe.cross_store_allocation_id = a.id
             LEFT JOIN expense_types et ON doe.expense_type_id = et.id
             LEFT JOIN banks rb ON rb.id = doe.reimbursement_bank_id
             WHERE a.payment_id = ANY($1::uuid[])
             ORDER BY a.created_at`,
            [paymentIds]
        );

        const allocationsByPayment = allocationsResult.rows.reduce((acc, alloc) => {
            if (!acc[alloc.payment_id]) {
                acc[alloc.payment_id] = [];
            }
            acc[alloc.payment_id].push(alloc);
            return acc;
        }, {});

        return paymentRows.rows.map(row => ({
            ...row,
            allocations: allocationsByPayment[row.id] || []
        }));
    }

    static async updateAllocationReimbursement(allocationId, updates = {}, userId) {
        const client = await getClient();
        try {
            await client.query('BEGIN');

            const allocationResult = await client.query(
                `SELECT 
                    a.*,
                    p.source_store_id
                 FROM cross_store_payment_allocations a
                 JOIN cross_store_payments p ON p.id = a.payment_id
                 WHERE a.id = $1`,
                [allocationId]
            );

            if (allocationResult.rows.length === 0) {
                throw new Error('Cross-store payment allocation not found.');
            }

            const allocation = allocationResult.rows[0];
            const {
                status,
                reimbursed_amount,
                reimbursement_note,
                reimbursement_required,
                reimbursement_method,
                reimbursement_reference,
                reimbursed_cash_amount,
                reimbursement_payment_method,
                reimbursement_check_number,
                reimbursement_bank_id
            } = updates;

            let newRequired =
                typeof reimbursement_required === 'boolean'
                    ? reimbursement_required
                    : allocation.reimbursement_required;

            let newStatus = allocation.reimbursement_status;
            let newReimbursedAt = allocation.reimbursed_at;
            let newReimbursedAmount = allocation.reimbursed_amount;
            let newReimbursedBy = allocation.reimbursed_by;
            let newNote =
                reimbursement_note !== undefined
                    ? reimbursement_note
                    : allocation.reimbursement_note;
            let newMethod =
                reimbursement_method !== undefined && reimbursement_method !== null
                    ? reimbursement_method
                    : allocation.reimbursement_method;
            let newReference =
                reimbursement_reference !== undefined
                    ? reimbursement_reference
                    : allocation.reimbursement_reference;
            let newCashAmount =
                reimbursed_cash_amount !== undefined && reimbursed_cash_amount !== null
                    ? parseFloat(reimbursed_cash_amount)
                    : allocation.reimbursed_cash_amount;
            let sourceCashTransactionId = allocation.source_cash_transaction_id;
            let targetCashTransactionId = allocation.target_cash_transaction_id;

            if (status) {
                if (!['pending', 'completed', 'not_required'].includes(status)) {
                    throw new Error('Invalid reimbursement status.');
                }

                if (status === 'not_required') {
                    newRequired = false;
                    newStatus = 'not_required';
                    newReimbursedAt = null;
                    newReimbursedAmount = null;
                    newReimbursedBy = null;
                } else if (status === 'completed') {
                    newRequired = true;
                    newStatus = 'completed';
                    newReimbursedAt = new Date();
                    newReimbursedAmount =
                        reimbursed_amount !== undefined && reimbursed_amount !== null
                            ? parseFloat(reimbursed_amount)
                            : allocation.allocated_amount;
                    if (!newReimbursedAmount || newReimbursedAmount <= 0) {
                        throw new Error('Reimbursed amount must be greater than zero.');
                    }
                    newReimbursedBy = userId;
                } else if (status === 'pending') {
                    newRequired = true;
                    newStatus = 'pending';
                    newReimbursedAt = null;
                    newReimbursedAmount = null;
                    newReimbursedBy = null;
                }
            } else if (typeof reimbursement_required === 'boolean') {
                if (reimbursement_required === false) {
                    newStatus = 'not_required';
                    newReimbursedAt = null;
                    newReimbursedAmount = null;
                    newReimbursedBy = null;
                } else if (allocation.reimbursement_status === 'not_required') {
                    newStatus = 'pending';
                }
            }

            // Handle cash reimbursement reversal if previously completed and now not completed
            if (
                allocation.reimbursement_status === 'completed' &&
                newStatus !== 'completed' &&
                allocation.reimbursement_method === 'cash' &&
                (allocation.reimbursed_cash_amount || allocation.reimbursed_amount) &&
                (allocation.source_cash_transaction_id || allocation.target_cash_transaction_id)
            ) {
                const reversalAmount = parseFloat(
                    allocation.reimbursed_cash_amount ||
                        allocation.reimbursed_amount ||
                        allocation.allocated_amount
                );
                if (reversalAmount && reversalAmount > 0) {
                    const reversalDate = new Date().toISOString().split('T')[0];
                    const description = `Reversal of cross-store reimbursement ${allocationId}`;
                    await CashOnHandService.addCash(
                        allocation.target_store_id,
                        reversalAmount,
                        'cross_store_reimbursement_reversal',
                        allocationId,
                        reversalDate,
                        description,
                        userId,
                        client
                    );
                    await CashOnHandService.subtractCash(
                        allocation.source_store_id,
                        reversalAmount,
                        'cross_store_reimbursement_reversal',
                        allocationId,
                        reversalDate,
                        description,
                        userId,
                        client
                    );
                }
                sourceCashTransactionId = null;
                targetCashTransactionId = null;
                newCashAmount = null;
                if (newStatus !== 'completed') {
                    newMethod = newStatus === 'not_required' ? null : newMethod;
                    newReference = newStatus === 'not_required' ? null : newReference;
                }
            }

            // Handle cash reimbursement posting
            if (newStatus === 'completed') {
                newMethod = newMethod || reimbursement_method || allocation.reimbursement_method || null;
                newReference = newReference || reimbursement_reference || allocation.reimbursement_reference || null;
                if (newMethod === 'cash') {
                    const cashAmount = Number.isFinite(newCashAmount)
                        ? newCashAmount
                        : newReimbursedAmount;
                    if (!cashAmount || cashAmount <= 0) {
                        throw new Error('Cash reimbursements must include a positive cash amount.');
                    }
                    newCashAmount = parseFloat(cashAmount.toFixed(2));
                    const transactionDate = (newReimbursedAt || new Date()).toISOString().split('T')[0];
                    const description = `Cross-store reimbursement ${allocationId}`;

                    if (!targetCashTransactionId) {
                        const subtractResult = await CashOnHandService.subtractCash(
                            allocation.target_store_id,
                            newCashAmount,
                            'cross_store_reimbursement',
                            allocationId,
                            transactionDate,
                            description,
                            userId,
                            client
                        );
                        targetCashTransactionId = subtractResult.transaction?.id || null;
                    }

                    if (!sourceCashTransactionId) {
                        const addResult = await CashOnHandService.addCash(
                            allocation.source_store_id,
                            newCashAmount,
                            'cross_store_reimbursement',
                            allocationId,
                            transactionDate,
                            description,
                            userId,
                            client
                        );
                        sourceCashTransactionId = addResult.transaction?.id || null;
                    }
                } else {
                    newCashAmount = null;
                    sourceCashTransactionId = null;
                    targetCashTransactionId = null;
                }
            } else if (newStatus !== 'completed') {
                newCashAmount =
                    newMethod === 'cash' && allocation.reimbursement_status === 'completed'
                        ? allocation.reimbursed_cash_amount
                        : null;
            }

            const updateResult = await client.query(
                `UPDATE cross_store_payment_allocations
                 SET reimbursement_required = $2,
                     reimbursement_status = $3,
                     reimbursed_at = $4,
                     reimbursed_amount = $5,
                     reimbursed_by = $6,
                     reimbursement_note = $7,
                     reimbursement_method = $8,
                     reimbursement_reference = $9,
                     reimbursed_cash_amount = $10,
                     source_cash_transaction_id = $11,
                     target_cash_transaction_id = $12,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1
                 RETURNING *`,
                [
                    allocationId,
                    newRequired,
                    newStatus,
                    newReimbursedAt,
                    newReimbursedAmount,
                    newReimbursedBy,
                    newNote,
                    newMethod,
                    newReference,
                    newCashAmount,
                    sourceCashTransactionId,
                    targetCashTransactionId
                ]
            );

            await client.query('COMMIT');

            const updatedAllocation = updateResult.rows[0];

            // Synchronize linked expense entry (if any)
            const expenseResult = await query(
                `SELECT id FROM daily_operating_expenses WHERE cross_store_allocation_id = $1`,
                [allocationId]
            );

            if (expenseResult.rows.length > 0) {
                const expenseId = expenseResult.rows[0].id;
                if (newStatus === 'completed') {
                    await DailyOperatingExpenses.markReimbursed(expenseId, {
                        reimbursement_date: newReimbursedAt
                            ? newReimbursedAt.toISOString().split('T')[0]
                            : new Date().toISOString().split('T')[0],
                        reimbursement_amount: newReimbursedAmount || updatedAllocation.allocated_amount,
                        reimbursement_payment_method:
                            reimbursement_payment_method || newMethod || null,
                        reimbursement_check_number:
                            reimbursement_check_number ||
                            (newMethod === 'check' ? newReference : null) ||
                            null,
                        reimbursement_bank_id: reimbursement_bank_id || null
                    });
                } else if (newStatus === 'pending') {
                    await query(
                        `UPDATE daily_operating_expenses
                         SET reimbursement_status = 'pending',
                             reimbursement_date = NULL,
                             reimbursement_amount = NULL,
                             reimbursement_payment_method = NULL,
                             reimbursement_check_number = NULL,
                             reimbursement_bank_id = NULL,
                             updated_at = CURRENT_TIMESTAMP
                         WHERE cross_store_allocation_id = $1`,
                        [allocationId]
                    );
                } else if (newStatus === 'not_required') {
                    await query(
                        `UPDATE daily_operating_expenses
                         SET reimbursement_status = 'none',
                             reimbursement_date = NULL,
                             reimbursement_amount = NULL,
                             reimbursement_payment_method = NULL,
                             reimbursement_check_number = NULL,
                             reimbursement_bank_id = NULL,
                             updated_at = CURRENT_TIMESTAMP
                         WHERE cross_store_allocation_id = $1`,
                        [allocationId]
                    );
                }
            }

            return {
                allocation: updatedAllocation,
                payment_id: allocation.payment_id,
                source_store_id: allocation.source_store_id,
                target_store_id: allocation.target_store_id
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async updatePayment(paymentId, paymentData, allocations = [], options = {}) {
        const {
            source_store_id,
            payment_date,
            payment_method,
            payment_reference,
            amount,
            currency,
            paid_to,
            notes,
            metadata
        } = paymentData;
        const {
            context = 'payment',
            expenseDefaults = {},
            rawAllocations = [],
            userId = null
        } = options;

        const client = await getClient();
        try {
            await client.query('BEGIN');

            const existingPaymentResult = await client.query(
                'SELECT * FROM cross_store_payments WHERE id = $1',
                [paymentId]
            );

            if (existingPaymentResult.rows.length === 0) {
                throw new Error('Cross-store payment not found.');
            }

            const existingAllocationsResult = await client.query(
                'SELECT * FROM cross_store_payment_allocations WHERE payment_id = $1',
                [paymentId]
            );

            const hasCompletedReimbursement = existingAllocationsResult.rows.some(
                (row) => row.reimbursement_status === 'completed'
            );
            if (hasCompletedReimbursement) {
                throw new Error('Cannot edit a cross-store payment that has completed reimbursements. Mark them as pending first.');
            }

            await DailyOperatingExpenses.deleteByCrossStorePayment(paymentId, client);
            await client.query(
                'DELETE FROM cross_store_payment_allocations WHERE payment_id = $1',
                [paymentId]
            );

            const paymentResult = await client.query(
                `UPDATE cross_store_payments
                 SET source_store_id = $1,
                     payment_date = $2,
                     payment_method = $3,
                     payment_reference = $4,
                     amount = $5,
                     currency = $6,
                     paid_to = $7,
                     notes = $8,
                     metadata = $9,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $10
                 RETURNING *`,
                [
                    source_store_id,
                    payment_date,
                    payment_method,
                    payment_reference || null,
                    amount,
                    currency || 'USD',
                    paid_to || null,
                    notes || null,
                    metadata ? JSON.stringify(metadata) : null,
                    paymentId
                ]
            );

            const payment = paymentResult.rows[0];
            const allocationRows = [];

            for (const alloc of allocations) {
                const reimbursementRequired = alloc.reimbursement_required !== false;
                const reimbursementStatus = reimbursementRequired ? 'pending' : 'not_required';
                const allocationResult = await client.query(
                    `INSERT INTO cross_store_payment_allocations (
                        payment_id,
                        target_store_id,
                        allocated_amount,
                        target_type,
                        target_id,
                        memo,
                        approved_by,
                        approved_at,
                        metadata,
                        reimbursement_required,
                        reimbursement_status,
                        reimbursed_at,
                        reimbursed_amount,
                        reimbursed_by,
                        reimbursement_note,
                        allocation_percentage
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                    RETURNING *`,
                    [
                        payment.id,
                    alloc.target_store_id,
                    alloc.allocated_amount,
                    null,
                    null,
                    alloc.memo || null,
                        alloc.approved_by || null,
                        alloc.approved_at || null,
                        alloc.metadata ? JSON.stringify(alloc.metadata) : null,
                        reimbursementRequired,
                        reimbursementStatus,
                        null,
                        null,
                        null,
                        alloc.reimbursement_note || null,
                        alloc.allocation_percentage !== undefined && alloc.allocation_percentage !== null
                            ? parseFloat(alloc.allocation_percentage)
                            : null
                    ]
                );
                allocationRows.push({
                    ...allocationResult.rows[0],
                    client_reference: alloc.client_reference || null
                });
            }

            const contextIsExpense = context === 'expense';
            const expensesCreated = [];

            if (contextIsExpense) {
                for (let index = 0; index < allocationRows.length; index++) {
                    const allocationRow = allocationRows[index];
                    const allocationInput = rawAllocations[index] || {};

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
                        entered_by: userId || payment.created_by || null,
                        paid_by_store_id: source_store_id,
                        cross_store_payment_id: payment.id,
                        cross_store_allocation_id: allocationRow.id
                    };

                    const createdExpense = await DailyOperatingExpenses.create(expenseData, client);
                    expensesCreated.push(createdExpense);

                    await client.query(
                        `UPDATE cross_store_payment_allocations
                         SET target_type = 'expense',
                             target_id = $1
                         WHERE id = $2`,
                        [createdExpense.id, allocationRow.id]
                    );

                    allocationRows[index] = {
                        ...allocationRows[index],
                        target_type: 'expense',
                        target_id: createdExpense.id,
                        expense_id: createdExpense.id
                    };
                }
            }

            await client.query('COMMIT');

            const updatedPayment = await CrossStorePayment.findById(payment.id);
            if (updatedPayment) {
                updatedPayment.expenses_created = contextIsExpense ? expensesCreated : [];
            }
            return updatedPayment;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async deletePayment(paymentId) {
        const client = await getClient();
        try {
            await client.query('BEGIN');

            const paymentResult = await client.query(
                'SELECT * FROM cross_store_payments WHERE id = $1',
                [paymentId]
            );

            if (paymentResult.rows.length === 0) {
                throw new Error('Cross-store payment not found.');
            }

            const allocationResult = await client.query(
                'SELECT * FROM cross_store_payment_allocations WHERE payment_id = $1',
                [paymentId]
            );

            const hasCompletedReimbursement = allocationResult.rows.some(
                (row) => row.reimbursement_status === 'completed'
            );
            if (hasCompletedReimbursement) {
                throw new Error('Cannot delete a cross-store payment that has completed reimbursements. Mark them as pending first.');
            }

            await DailyOperatingExpenses.deleteByCrossStorePayment(paymentId, client);
            await client.query('DELETE FROM cross_store_payment_allocations WHERE payment_id = $1', [paymentId]);
            await client.query('DELETE FROM cross_store_payments WHERE id = $1', [paymentId]);

            await client.query('COMMIT');

            return paymentResult.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async removeAllocation(allocationId, userId) {
        const client = await getClient();
        try {
            await client.query('BEGIN');

            const allocationResult = await client.query(
                `SELECT 
                    a.*, 
                    p.source_store_id, 
                    p.amount AS payment_amount,
                    p.payment_date,
                    p.payment_method,
                    p.payment_reference,
                    p.paid_to,
                    p.notes,
                    p.id as payment_id
                 FROM cross_store_payment_allocations a
                 JOIN cross_store_payments p ON p.id = a.payment_id
                 WHERE a.id = $1
                 FOR UPDATE`,
                [allocationId]
            );

            if (allocationResult.rows.length === 0) {
                throw new Error('Cross-store allocation not found.');
            }

            const allocation = allocationResult.rows[0];

            if (allocation.reimbursement_status === 'completed') {
                throw new Error('Cannot remove an allocation that has already been reimbursed.');
            }

            const canAccessTarget = await client.query('SELECT can_user_access_store($1, $2) AS can_access', [userId, allocation.target_store_id]);
            const canAccessSource = await client.query('SELECT can_user_access_store($1, $2) AS can_access', [userId, allocation.source_store_id]);
            if (!canAccessTarget.rows[0]?.can_access && !canAccessSource.rows[0]?.can_access) {
                throw new Error('Access denied for this allocation.');
            }

            const allocationAmount = parseFloat(allocation.allocated_amount) || 0;

            await DailyOperatingExpenses.deleteByCrossStoreAllocation(allocationId, client);
            await client.query('DELETE FROM cross_store_payment_allocations WHERE id = $1', [allocationId]);

            if (allocationAmount > 0) {
                const sourceAllocResult = await client.query(
                    `SELECT * FROM cross_store_payment_allocations 
                     WHERE payment_id = $1 AND target_store_id = $2
                     FOR UPDATE`,
                    [allocation.payment_id, allocation.source_store_id]
                );

                if (sourceAllocResult.rows.length > 0) {
                    const sourceAllocation = sourceAllocResult.rows[0];
                    const updatedAmount = parseFloat(sourceAllocation.allocated_amount) + allocationAmount;
                    await client.query(
                        `UPDATE cross_store_payment_allocations
                         SET allocated_amount = $1,
                             reimbursement_required = false,
                             reimbursement_status = 'not_required',
                             updated_at = CURRENT_TIMESTAMP
                         WHERE id = $2`,
                        [updatedAmount, sourceAllocation.id]
                    );
                } else {
                    await client.query(
                        `INSERT INTO cross_store_payment_allocations (
                            payment_id,
                            target_store_id,
                            allocated_amount,
                            reimbursement_required,
                            reimbursement_status,
                            allocation_percentage
                        ) VALUES ($1, $2, $3, false, 'not_required', NULL)`,
                        [allocation.payment_id, allocation.source_store_id, allocationAmount]
                    );
                }
            }

            if (allocation.payment_amount && allocation.payment_amount > 0) {
                const remainingAllocations = await client.query(
                    'SELECT id, allocated_amount FROM cross_store_payment_allocations WHERE payment_id = $1',
                    [allocation.payment_id]
                );

                for (const row of remainingAllocations.rows) {
                    const percent = (parseFloat(row.allocated_amount) / parseFloat(allocation.payment_amount)) * 100;
                    await client.query(
                        `UPDATE cross_store_payment_allocations
                         SET allocation_percentage = $1,
                             updated_at = CURRENT_TIMESTAMP
                         WHERE id = $2`,
                        [Number.isFinite(percent) ? parseFloat(percent.toFixed(3)) : null, row.id]
                    );
                }
            }

            await client.query('COMMIT');
            return await CrossStorePayment.findById(allocation.payment_id);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = CrossStorePayment;

