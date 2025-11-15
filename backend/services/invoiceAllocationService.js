const PurchaseInvoice = require('../models/PurchaseInvoice');
const PurchaseInvoiceAllocation = require('../models/PurchaseInvoiceAllocation');

class InvoiceAllocationService {
    static async createChildInvoiceFromAllocation({
        parentInvoiceId,
        targetStoreId,
        allocationItems = [],
        allocationAmount = 0,
        allocationMetadata = {},
        crossStorePaymentId = null,
        createdBy = null,
    }) {
        if (!parentInvoiceId || !targetStoreId) {
            throw new Error('Parent invoice and target store are required for allocations.');
        }

        const parentInvoice = await PurchaseInvoice.findById(parentInvoiceId);
        if (!parentInvoice) {
            throw new Error('Parent invoice not found.');
        }

        const childInvoiceData = {
            invoice_number: parentInvoice.invoice_number
                ? `${parentInvoice.invoice_number}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
                : null,
            purchase_date: parentInvoice.purchase_date,
            vendor_id: parentInvoice.vendor_id,
            department_id: parentInvoice.department_id,
            amount: allocationAmount || parentInvoice.amount,
            payment_option: parentInvoice.payment_option,
            due_days: parentInvoice.due_days,
            notes: parentInvoice.notes,
            prepaid_tax: parentInvoice.prepaid_tax,
            tax_type: parentInvoice.tax_type,
            tax_rate: parentInvoice.tax_rate,
            paid_on_purchase: parentInvoice.paid_on_purchase,
            payment_method_on_purchase: parentInvoice.payment_method_on_purchase,
            bank_id_on_purchase: parentInvoice.bank_id_on_purchase,
            bank_account_name_on_purchase: parentInvoice.bank_account_name_on_purchase,
            credit_card_id_on_purchase: parentInvoice.credit_card_id_on_purchase,
            is_reimbursable: parentInvoice.is_reimbursable,
            reimbursement_to: parentInvoice.reimbursement_to,
            reimbursement_status: parentInvoice.reimbursement_status,
            reimbursement_payment_method: parentInvoice.reimbursement_payment_method,
            reimbursement_check_number: parentInvoice.reimbursement_check_number,
            expected_revenue: parentInvoice.expected_revenue,
            revenue_calculation_method: parentInvoice.revenue_calculation_method,
            invoice_items: allocationItems.length > 0 ? allocationItems : parentInvoice.invoice_items,
            is_cigarette_purchase: parentInvoice.is_cigarette_purchase,
            cigarette_cartons_purchased: parentInvoice.cigarette_cartons_purchased,
            entered_by: createdBy || parentInvoice.entered_by,
            parent_invoice_id: parentInvoice.id,
            allocation_source_store_id: parentInvoice.store_id,
            cross_store_payment_id: crossStorePaymentId,
            allocation_metadata: allocationMetadata || {},
        };

        const childInvoice = await PurchaseInvoice.create(targetStoreId, childInvoiceData);

        const allocationRecord = await PurchaseInvoiceAllocation.create({
            parent_invoice_id: parentInvoice.id,
            child_invoice_id: childInvoice.id,
            source_store_id: parentInvoice.store_id,
            target_store_id: targetStoreId,
            cross_store_payment_id: crossStorePaymentId,
            allocation_amount: allocationAmount,
            allocation_metadata: allocationMetadata,
            created_by: createdBy,
        });

        return {
            parent: parentInvoice,
            child: childInvoice,
            allocation: allocationRecord,
        };
    }

    static async listAllocations(parentInvoiceId) {
        return PurchaseInvoiceAllocation.findByParent(parentInvoiceId);
    }
}

module.exports = InvoiceAllocationService;

