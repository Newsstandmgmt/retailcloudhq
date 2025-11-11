const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');
const CrossStorePayment = require('../models/CrossStorePayment');
const AuditLog = require('../models/AuditLog');

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

        let allocationTotal = 0;
        const cleanedAllocations = [];

        for (const alloc of allocations) {
            const targetStoreId = alloc.target_store_id;
            const allocatedAmount = parseFloat(alloc.amount || alloc.allocated_amount);

            if (!targetStoreId) {
                return res.status(400).json({ error: 'Each allocation must include a target store.' });
            }

            if (!allocatedAmount || allocatedAmount <= 0) {
                return res.status(400).json({ error: 'Each allocation must have a valid amount.' });
            }

            const canAccessTarget = await hasStoreAccess(req.user.id, targetStoreId);
            if (!canAccessTarget) {
                return res.status(403).json({ error: 'You do not have access to one of the target stores.' });
            }

            allocationTotal += allocatedAmount;
            cleanedAllocations.push({
                target_store_id: targetStoreId,
                allocated_amount: allocatedAmount,
                target_type: alloc.target_type || null,
                target_id: alloc.target_id || null,
                memo: alloc.memo || null,
                metadata: alloc.metadata || null,
                reimbursement_required: alloc.reimbursement_required !== false,
                reimbursement_note: alloc.reimbursement_note || null
            });
        }

        if (Math.abs(allocationTotal - numericAmount) > 0.01) {
            return res.status(400).json({ error: 'Allocations must add up to the total payment amount.' });
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
                    allocations: cleanedAllocations
                }
            });
        } catch (auditError) {
            console.warn('Failed to create audit log for cross store payment:', auditError.message);
        }

        const result = await CrossStorePayment.findById(payment.id);
        res.status(201).json({ payment: result });
    } catch (error) {
        console.error('Create cross-store payment error:', error);
        res.status(500).json({ error: error.message || 'Failed to create cross-store payment.' });
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
                    : undefined
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
                    reimbursement_note: allocation.reimbursement_note
                },
                new_values: {
                    reimbursement_status: updateResult.allocation.reimbursement_status,
                    reimbursement_required: updateResult.allocation.reimbursement_required,
                    reimbursed_amount: updateResult.allocation.reimbursed_amount,
                    reimbursement_note: updateResult.allocation.reimbursement_note
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

