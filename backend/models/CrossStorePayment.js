const { query, getClient } = require('../config/database');
const DailyOperatingExpenses = require('./DailyOperatingExpenses');

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
                et.expense_type_name AS expense_type_name
             FROM cross_store_payment_allocations a
             JOIN stores target_store ON target_store.id = a.target_store_id
             LEFT JOIN users approver ON approver.id = a.approved_by
             LEFT JOIN daily_operating_expenses doe ON doe.cross_store_allocation_id = a.id
             LEFT JOIN expense_types et ON doe.expense_type_id = et.id
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
                et.expense_type_name AS expense_type_name
             FROM cross_store_payment_allocations a
             JOIN stores target_store ON target_store.id = a.target_store_id
             LEFT JOIN users approver ON approver.id = a.approved_by
             LEFT JOIN daily_operating_expenses doe ON doe.cross_store_allocation_id = a.id
             LEFT JOIN expense_types et ON doe.expense_type_id = et.id
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
                reimbursement_required
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

            const updateResult = await client.query(
                `UPDATE cross_store_payment_allocations
                 SET reimbursement_required = $2,
                     reimbursement_status = $3,
                     reimbursed_at = $4,
                     reimbursed_amount = $5,
                     reimbursed_by = $6,
                     reimbursement_note = $7,
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
                    newNote
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
                        reimbursement_payment_method: updates.reimbursement_payment_method || null,
                        reimbursement_check_number: updates.reimbursement_check_number || null,
                        reimbursement_bank_id: updates.reimbursement_bank_id || null
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
}

module.exports = CrossStorePayment;

