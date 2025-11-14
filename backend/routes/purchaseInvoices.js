const express = require('express');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const Vendor = require('../models/Vendor');
const Department = require('../models/Department');
const TaxConfiguration = require('../models/TaxConfiguration');
const Store = require('../models/Store');
const AutoPostingService = require('../services/autoPostingService');
const CashOnHandService = require('../services/cashOnHandService');
const { authenticate, canAccessStore } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

async function revertInvoicePayment(invoice, userId) {
    if (!invoice || invoice.status !== 'paid') {
        return invoice;
    }

    await PurchaseInvoice.update(invoice.id, {
        status: 'pending',
        payment_date: null,
        payment_method: null,
        check_number: null
    });

    await CashOnHandService.reversePaymentTransactions(
        invoice.store_id,
        invoice.id,
        userId,
        new Date().toISOString().split('T')[0]
    );

    return await PurchaseInvoice.findById(invoice.id);
}

// Get all invoices for a store
router.get('/store/:storeId', canAccessStore, async (req, res) => {
    try {
        const { status, start_date, end_date, vendor_id } = req.query;
        const invoices = await PurchaseInvoice.findByStore(req.params.storeId, {
            status,
            start_date,
            end_date,
            vendor_id
        });
        res.json({ invoices });
    } catch (error) {
        console.error('Get invoices error:', error);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});

// Get invoice by ID
router.get('/:invoiceId', async (req, res) => {
    try {
        const invoice = await PurchaseInvoice.findById(req.params.invoiceId);
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        
        // Check access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, invoice.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }
        
        res.json({ invoice });
    } catch (error) {
        console.error('Get invoice error:', error);
        res.status(500).json({ error: 'Failed to fetch invoice' });
    }
});

// Create invoice
router.post('/store/:storeId', canAccessStore, async (req, res) => {
    try {
        const { 
            invoice_number, purchase_date, vendor_id, department_id, amount, payment_option, due_days, notes, 
            prepaid_tax, tax_type, tax_rate, tax_inclusive,
            paid_on_purchase, payment_method_on_purchase, bank_id_on_purchase, bank_account_name_on_purchase, credit_card_id_on_purchase,
            is_reimbursable, reimbursement_to, reimbursement_status, reimbursement_payment_method, reimbursement_check_number,
            expected_revenue, revenue_calculation_method, invoice_items,
            is_cigarette_purchase, cigarette_cartons_purchased
        } = req.body;
        
        // Invoice number is only required for Invoice or Credit Memo payment options
        // Cash payments will get an auto-generated invoice number
        if ((payment_option === 'invoice' || payment_option === 'credit_memo') && !invoice_number) {
            return res.status(400).json({ error: 'Invoice number is required for Invoice or Credit Memo payments' });
        }
        
        if (!purchase_date || !amount || !payment_option) {
            return res.status(400).json({ error: 'Purchase date, amount, and payment option are required' });
        }

        // Validate paid on purchase fields (only if NOT paid by third party)
        if (paid_on_purchase && !is_reimbursable && !payment_method_on_purchase) {
            return res.status(400).json({ error: 'Payment method is required when invoice is paid on purchase' });
        }

        if (paid_on_purchase && !is_reimbursable && payment_method_on_purchase === 'bank' && !bank_id_on_purchase) {
            return res.status(400).json({ error: 'Bank account is required for bank payments' });
        }

        if (paid_on_purchase && !is_reimbursable && payment_method_on_purchase === 'card' && !req.body.credit_card_id_on_purchase) {
            return res.status(400).json({ error: 'Credit card is required for card payments' });
        }

        if (is_reimbursable && !reimbursement_to) {
            return res.status(400).json({ error: 'Person name is required when paid by third party' });
        }

        // Validate reimbursement status fields if reimbursed
        if (is_reimbursable && reimbursement_status === 'reimbursed' && !reimbursement_payment_method) {
            return res.status(400).json({ error: 'Reimbursement payment method is required when status is reimbursed' });
        }

        // Calculate expected revenue if using product selection or auto-calculate
        let calculatedExpectedRevenue = expected_revenue ? parseFloat(expected_revenue) : null;
        if (revenue_calculation_method === 'product_selection' || revenue_calculation_method === 'auto_calculate') {
            if (invoice_items && Array.isArray(invoice_items) && invoice_items.length > 0) {
                const Product = require('../models/Product');
                try {
                    calculatedExpectedRevenue = await Product.calculateExpectedRevenue(req.params.storeId, invoice_items);
                } catch (calcError) {
                    console.error('Error calculating expected revenue:', calcError);
                    // Continue without calculated revenue if calculation fails
                }
            }
        }

        const invoice = await PurchaseInvoice.create(req.params.storeId, {
            invoice_number: invoice_number || null,
            purchase_date,
            vendor_id: vendor_id || null,
            department_id: department_id || null,
            amount,
            payment_option,
            due_days: due_days || null,
            notes,
            prepaid_tax: prepaid_tax || false,
            tax_type: tax_type || null,
            tax_rate: tax_rate || null,
            tax_inclusive: tax_inclusive || false,
            paid_on_purchase: paid_on_purchase || false,
            payment_method_on_purchase: payment_method_on_purchase || null,
            bank_id_on_purchase: bank_id_on_purchase || null,
            bank_account_name_on_purchase: bank_account_name_on_purchase || null,
            credit_card_id_on_purchase: credit_card_id_on_purchase || null,
            is_reimbursable: is_reimbursable || false,
            reimbursement_to: reimbursement_to || null,
            reimbursement_status: reimbursement_status || null,
            reimbursement_payment_method: reimbursement_payment_method || null,
            reimbursement_check_number: reimbursement_check_number || null,
            expected_revenue: calculatedExpectedRevenue,
            revenue_calculation_method: revenue_calculation_method || null,
            invoice_items: invoice_items || null,
            is_cigarette_purchase: is_cigarette_purchase === true || is_cigarette_purchase === 'true',
            cigarette_cartons_purchased: is_cigarette_purchase
                ? (parseInt(cigarette_cartons_purchased, 10) || 0)
                : 0,
            entered_by: req.user.id
        });

        // Auto-post to General Ledger
        try {
            const fullInvoice = await PurchaseInvoice.findById(invoice.id);
            await AutoPostingService.postPurchaseInvoice(fullInvoice);
        } catch (glError) {
            console.error('Error auto-posting invoice to GL (non-blocking):', glError);
            // Don't fail invoice creation if GL posting fails
        }

        // Update cash on hand if paid on purchase with cash
        if (paid_on_purchase && payment_method_on_purchase === 'cash') {
            try {
                const { query } = require('../config/database');
                const vendorResult = await query('SELECT name FROM vendors WHERE id = $1', [vendor_id]);
                const vendorName = vendorResult.rows[0]?.name || 'Vendor';
                await CashOnHandService.subtractCash(
                    req.params.storeId,
                    parseFloat(amount),
                    'payment',
                    invoice.id,
                    purchase_date,
                    `Invoice payment: ${vendorName} - $${parseFloat(amount).toFixed(2)}`,
                    req.user.id
                );
            } catch (cashError) {
                console.error('Error updating cash on hand (non-blocking):', cashError);
            }
        }

        res.status(201).json({
            message: 'Invoice created successfully',
            invoice
        });
    } catch (error) {
        console.error('Create invoice error:', error);
        if (error.constraint === 'purchase_invoices_store_id_invoice_number_key') {
            return res.status(400).json({ error: 'Invoice number already exists for this store' });
        }
        res.status(500).json({ error: error.message || 'Failed to create invoice' });
    }
});

// Update invoice
router.put('/:invoiceId', async (req, res) => {
    try {
        const invoice = await PurchaseInvoice.findById(req.params.invoiceId);
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        // Check access
        req.params.storeId = invoice.store_id;
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, invoice.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        const updatedInvoice = await PurchaseInvoice.update(req.params.invoiceId, req.body);
        res.json({
            message: 'Invoice updated successfully',
            invoice: updatedInvoice
        });
    } catch (error) {
        console.error('Update invoice error:', error);
        res.status(500).json({ error: error.message || 'Failed to update invoice' });
    }
});

// Delete invoice
router.delete('/:invoiceId', async (req, res) => {
    try {
        const invoice = await PurchaseInvoice.findById(req.params.invoiceId);
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        // Check access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, invoice.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        if (invoice.status === 'paid') {
            await revertInvoicePayment(invoice, req.user.id);
        }

        await PurchaseInvoice.delete(req.params.invoiceId);
        res.json({ message: 'Invoice deleted successfully' });
    } catch (error) {
        console.error('Delete invoice error:', error);
        res.status(500).json({ error: 'Failed to delete invoice' });
    }
});

router.post('/:invoiceId/void-payment', async (req, res) => {
    try {
        const invoice = await PurchaseInvoice.findById(req.params.invoiceId);
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, invoice.store_id]
        );

        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        if (invoice.status !== 'paid') {
            return res.status(400).json({ error: 'Invoice is not marked as paid.' });
        }

        const updatedInvoice = await revertInvoicePayment(invoice, req.user.id);

        res.json({
            message: 'Invoice payment reversed successfully.',
            invoice: updatedInvoice
        });
    } catch (error) {
        console.error('Void invoice payment error:', error);
        res.status(500).json({ error: error.message || 'Failed to void invoice payment' });
    }
});

// ========== Vendors Routes ==========

// Get all vendors for a store
router.get('/store/:storeId/vendors', canAccessStore, async (req, res) => {
    try {
        const vendors = await Vendor.findByStore(req.params.storeId);
        res.json({ vendors });
    } catch (error) {
        console.error('Get vendors error:', error);
        res.status(500).json({ error: 'Failed to fetch vendors' });
    }
});

// Create vendor
router.post('/store/:storeId/vendors', canAccessStore, async (req, res) => {
    try {
        const vendor = await Vendor.create(req.params.storeId, req.body);
        res.status(201).json({
            message: 'Vendor created successfully',
            vendor
        });
    } catch (error) {
        console.error('Create vendor error:', error);
        res.status(500).json({ error: 'Failed to create vendor' });
    }
});

// Update vendor
router.put('/vendors/:vendorId', async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.vendorId);
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        // Check access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, vendor.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        const updated = await Vendor.update(req.params.vendorId, req.body);
        res.json({
            message: 'Vendor updated successfully',
            vendor: updated
        });
    } catch (error) {
        console.error('Update vendor error:', error);
        res.status(500).json({ error: 'Failed to update vendor' });
    }
});

// Delete vendor
router.delete('/vendors/:vendorId', async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.vendorId);
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        // Check access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, vendor.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        await Vendor.delete(req.params.vendorId);
        res.json({ message: 'Vendor deleted successfully' });
    } catch (error) {
        console.error('Delete vendor error:', error);
        res.status(500).json({ error: 'Failed to delete vendor' });
    }
});

// ========== Departments Routes ==========

// Get all departments for a store
router.get('/store/:storeId/departments', canAccessStore, async (req, res) => {
    try {
        const departments = await Department.findByStore(req.params.storeId);
        res.json({ departments });
    } catch (error) {
        console.error('Get departments error:', error);
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
});

// Create department
router.post('/store/:storeId/departments', canAccessStore, async (req, res) => {
    try {
        const department = await Department.create(req.params.storeId, req.body);
        res.status(201).json({
            message: 'Department created successfully',
            department
        });
    } catch (error) {
        console.error('Create department error:', error);
        res.status(500).json({ error: 'Failed to create department' });
    }
});

// Update department
router.put('/departments/:departmentId', async (req, res) => {
    try {
        const department = await Department.findById(req.params.departmentId);
        if (!department) {
            return res.status(404).json({ error: 'Department not found' });
        }

        // Check access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, department.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        const updated = await Department.update(req.params.departmentId, req.body);
        res.json({
            message: 'Department updated successfully',
            department: updated
        });
    } catch (error) {
        console.error('Update department error:', error);
        res.status(500).json({ error: 'Failed to update department' });
    }
});

// Delete department
router.delete('/departments/:departmentId', async (req, res) => {
    try {
        const department = await Department.findById(req.params.departmentId);
        if (!department) {
            return res.status(404).json({ error: 'Department not found' });
        }

        // Check access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, department.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        await Department.delete(req.params.departmentId);
        res.json({ message: 'Department deleted successfully' });
    } catch (error) {
        console.error('Delete department error:', error);
        res.status(500).json({ error: 'Failed to delete department' });
    }
});

// ========== Tax Configuration Routes ==========

// Get tax configurations for a store
router.get('/store/:storeId/taxes', canAccessStore, async (req, res) => {
    try {
        const { state, applicable_to } = req.query;
        let taxes;
        if (state) {
            taxes = await TaxConfiguration.findByStoreAndState(req.params.storeId, state, applicable_to || null);
        } else {
            taxes = await TaxConfiguration.findByStore(req.params.storeId, applicable_to || null);
        }
        res.json({ taxes });
    } catch (error) {
        console.error('Get taxes error:', error);
        res.status(500).json({ error: 'Failed to fetch tax configurations' });
    }
});

// Create or update tax configuration
router.post('/store/:storeId/taxes', canAccessStore, async (req, res) => {
    try {
        const { state, tax_type, tax_rate, is_active, tax_applicable_to, is_inclusive } = req.body;
        
        if (!state || !tax_type || tax_rate === undefined) {
            return res.status(400).json({ error: 'State, tax type, and tax rate are required' });
        }

        const tax = await TaxConfiguration.upsert(req.params.storeId, {
            state,
            tax_type,
            tax_rate,
            is_active: is_active !== false,
            tax_applicable_to: tax_applicable_to || 'customer',
            is_inclusive: is_inclusive || false
        });

        res.status(201).json({
            message: 'Tax configuration saved successfully',
            tax
        });
    } catch (error) {
        console.error('Create tax error:', error);
        res.status(500).json({ error: 'Failed to save tax configuration' });
    }
});

// Delete tax configuration
router.delete('/taxes/:taxId', async (req, res) => {
    try {
        await TaxConfiguration.delete(req.params.taxId);
        res.json({ message: 'Tax configuration deleted successfully' });
    } catch (error) {
        console.error('Delete tax error:', error);
        res.status(500).json({ error: 'Failed to delete tax configuration' });
    }
});

// ========== Payment Routes ==========

router.post('/store/:storeId/record-payments', canAccessStore, async (req, res) => {
        const { invoice_ids, payment_date, payment_method, check_number, credit_card_id, split_payments } = req.body;
        
    if (!Array.isArray(invoice_ids) || invoice_ids.length === 0) {
        return res.status(400).json({ error: 'No invoices selected for payment.' });
        }
        if (!payment_date) {
        return res.status(400).json({ error: 'Payment date is required.' });
    }

    try {
        const { getClient } = require('../config/database');
        const client = await getClient();
        const cashAdjustments = [];

        try {
            await client.query('BEGIN');

            const invoicesResult = await client.query(
                `SELECT * FROM purchase_invoices 
                 WHERE store_id = $1 AND id = ANY($2)
                 FOR UPDATE`,
                [req.params.storeId, invoice_ids]
            );

            const invoices = invoicesResult.rows;
            if (invoices.length !== invoice_ids.length) {
                throw new Error('Unable to locate all selected invoices.');
            }

            invoices.forEach(inv => {
                if (inv.status === 'paid') {
                    throw new Error(`Invoice ${inv.invoice_number || inv.id} is already paid.`);
                }
            });

            const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);

            let payments = [];
            if (Array.isArray(split_payments) && split_payments.length > 0) {
                payments = split_payments.map(split => ({
                    payment_method: split.payment_method,
                    amount: parseFloat(split.amount || 0),
                    check_number: split.check_number || null,
                    credit_card_id: split.payment_method === 'card' ? split.credit_card_id || null : null,
                }));
            } else {
                payments = [{
                    payment_method: payment_method || 'cash',
                    amount: totalInvoiceAmount,
                    check_number: payment_method === 'check' ? (check_number || null) : null,
                    credit_card_id: payment_method === 'card' ? (credit_card_id || null) : null,
                }];
            }

            const totalPaymentAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
            if (Math.abs(totalPaymentAmount - totalInvoiceAmount) > 0.01) {
                throw new Error('Payment total does not match selected invoice total.');
            }

            const remainingByMethod = payments.map(p => ({ ...p, remaining: parseFloat(p.amount || 0) }));

            for (const invoice of invoices) {
                let amountRemaining = parseFloat(invoice.amount || 0);
                const vendorName = invoice.vendor_name || 'Vendor';

                for (const payment of remainingByMethod) {
                    if (amountRemaining <= 0) break;
                    if (payment.remaining <= 0) continue;

                    const applied = Math.min(payment.remaining, amountRemaining);
                    payment.remaining -= applied;
                    amountRemaining -= applied;

                    if (payment.payment_method === 'cash') {
                        cashAdjustments.push({
                            storeId: req.params.storeId,
                            amount: applied,
                            invoiceId: invoice.id,
                            paymentDate: payment_date,
                            vendorName: vendorName,
                        });
                    }
                }

                const primaryMethod = payments.length > 1 ? 'split' : payments[0].payment_method;
                const primaryCheckNumber = payments.length === 1 && payments[0].payment_method === 'check'
                    ? payments[0].check_number || null
                    : null;

                await client.query(
                    `UPDATE purchase_invoices
                     SET status = 'paid',
                         payment_date = $1,
                         payment_method = $2,
                         check_number = $3,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $4`,
                    [payment_date, primaryMethod, primaryCheckNumber, invoice.id]
                );
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

        for (const adjustment of cashAdjustments) {
            try {
                        await CashOnHandService.subtractCash(
                    adjustment.storeId,
                    adjustment.amount,
                            'payment',
                    adjustment.invoiceId,
                            payment_date,
                    `Invoice payment: ${adjustment.vendorName} - $${adjustment.amount.toFixed(2)}`,
                            req.user.id
                        );
                    } catch (cashError) {
                        console.error('Error updating cash on hand (non-blocking):', cashError);
                    }
                }
                
        res.json({ message: 'Payments recorded successfully' });
    } catch (error) {
        console.error('Record payments error:', error);
        res.status(500).json({ error: error.message || 'Failed to record payments' });
    }
});

// Mark invoice as reimbursed
router.post('/:invoiceId/reimburse', async (req, res) => {
    try {
        const invoice = await PurchaseInvoice.findById(req.params.invoiceId);
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        // Check access
        const { query } = require('../config/database');
        const accessResult = await query(
            'SELECT can_user_access_store($1, $2) as can_access',
            [req.user.id, invoice.store_id]
        );
        
        if (!accessResult.rows[0]?.can_access) {
            return res.status(403).json({ error: 'Access denied to this store.' });
        }

        if (invoice.reimbursement_status !== 'pending') {
            return res.status(400).json({ error: 'Invoice is not pending reimbursement' });
        }

        const { 
            reimbursement_date, 
            reimbursement_amount,
            reimbursement_payment_method,
            reimbursement_check_number,
            reimbursement_bank_id
        } = req.body;

        if (!reimbursement_payment_method) {
            return res.status(400).json({ error: 'Reimbursement payment method is required' });
        }

        if (reimbursement_payment_method === 'check' && !reimbursement_check_number) {
            return res.status(400).json({ error: 'Check number is required for check reimbursements' });
        }

        if (reimbursement_payment_method === 'bank' && !reimbursement_bank_id) {
            return res.status(400).json({ error: 'Bank account is required for bank reimbursements' });
        }

        const updated = await PurchaseInvoice.markReimbursed(req.params.invoiceId, {
            reimbursement_date: reimbursement_date || new Date().toISOString().split('T')[0],
            reimbursement_amount: reimbursement_amount || invoice.amount,
            reimbursement_payment_method,
            reimbursement_check_number,
            reimbursement_bank_id
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
        if (reimbursement_payment_method === 'cash') {
            try {
                const vendorName = invoice.vendor_name || 'Vendor';
                await CashOnHandService.subtractCash(
                    invoice.store_id,
                    parseFloat(updated.reimbursement_amount || invoice.amount),
                    'reimbursement',
                    invoice.id,
                    updated.reimbursement_date,
                    `Reimbursement: ${vendorName} - $${parseFloat(updated.reimbursement_amount || invoice.amount).toFixed(2)}`,
                    req.user.id
                );
            } catch (cashError) {
                console.error('Error updating cash on hand (non-blocking):', cashError);
            }
        }

        res.json({
            message: 'Invoice marked as reimbursed successfully',
            invoice: updated
        });
    } catch (error) {
        console.error('Reimburse invoice error:', error);
        res.status(500).json({ error: error.message || 'Failed to mark invoice as reimbursed' });
    }
});

// Get pending reimbursements for a store
router.get('/store/:storeId/reimbursements/pending', canAccessStore, async (req, res) => {
    try {
        const invoices = await PurchaseInvoice.getPendingReimbursements(req.params.storeId);
        res.json({ invoices });
    } catch (error) {
        console.error('Get pending reimbursements error:', error);
        res.status(500).json({ error: 'Failed to fetch pending reimbursements' });
    }
});

module.exports = router;

