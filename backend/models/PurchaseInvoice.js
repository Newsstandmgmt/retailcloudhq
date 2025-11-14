const { query } = require('../config/database');

class PurchaseInvoice {
    constructor(data) {
        Object.assign(this, data);
    }

    static hydrateInvoice(row) {
        if (!row) return null;
        const invoice = { ...row };
        if (invoice.invoice_items) {
            if (typeof invoice.invoice_items === 'string') {
                try {
                    invoice.invoice_items = JSON.parse(invoice.invoice_items) || [];
                } catch (error) {
                    console.warn('Failed to parse invoice_items JSON:', error.message);
                    invoice.invoice_items = [];
                }
            }
        } else {
            invoice.invoice_items = [];
        }
        return invoice;
    }

    // Calculate due date based on payment option and due days
    static calculateDueDate(purchaseDate, paymentOption, dueDays) {
        // Credit Memo doesn't have a due date
        if (paymentOption === 'credit_memo') {
            return null;
        }
        // Cash payment - due immediately
        if (paymentOption === 'cash') {
            return purchaseDate;
        }
        // Invoice payment - calculate based on due days
        if (paymentOption === 'invoice' && dueDays) {
            const date = new Date(purchaseDate);
            date.setDate(date.getDate() + parseInt(dueDays));
            return date.toISOString().split('T')[0];
        }
        // Legacy support for old payment options
        if (paymentOption === 'pay_now') {
            return purchaseDate;
        }
        if (paymentOption === 'pay_later' && dueDays) {
            const date = new Date(purchaseDate);
            date.setDate(date.getDate() + parseInt(dueDays));
            return date.toISOString().split('T')[0];
        }
        if (paymentOption === 'credit_invoice') {
            const date = new Date(purchaseDate);
            date.setDate(date.getDate() + (parseInt(dueDays) || 30));
            return date.toISOString().split('T')[0];
        }
        return purchaseDate;
    }

    // Create purchase invoice
    static async create(storeId, invoiceData) {
        const {
            invoice_number,
            purchase_date,
            vendor_id,
            department_id,
            amount,
            payment_option,
            due_days,
            notes,
            prepaid_tax,
            tax_type,
            tax_rate,
            paid_on_purchase,
            payment_method_on_purchase,
            bank_id_on_purchase,
            bank_account_name_on_purchase,
            credit_card_id_on_purchase,
            is_reimbursable,
            reimbursement_to,
            reimbursement_status,
            reimbursement_payment_method,
            reimbursement_check_number,
            expected_revenue,
            revenue_calculation_method,
            invoice_items,
            is_cigarette_purchase = false,
            cigarette_cartons_purchased,
            entered_by
        } = invoiceData;

        // Get vendor and department names
        let vendorName = null;
        let departmentName = null;

        if (vendor_id) {
            const vendorResult = await query('SELECT name FROM vendors WHERE id = $1', [vendor_id]);
            vendorName = vendorResult.rows[0]?.name || null;
        }

        if (department_id) {
            const deptResult = await query('SELECT name FROM departments WHERE id = $1', [department_id]);
            departmentName = deptResult.rows[0]?.name || null;
        }

        // Calculate tax amount
        let taxAmount = 0;
        const tax_inclusive = invoiceData.tax_inclusive || false;
        if (prepaid_tax && tax_rate && amount) {
            if (tax_inclusive) {
                // If tax is inclusive, calculate tax from total amount
                const totalAmount = parseFloat(amount);
                taxAmount = totalAmount - (totalAmount / (1 + parseFloat(tax_rate)));
            } else {
                // If tax is not inclusive, add tax to amount
                taxAmount = parseFloat(amount) * parseFloat(tax_rate);
            }
        }

        // Calculate due date (Credit Memo doesn't have due date)
        const dueDate = (payment_option === 'credit_memo') ? null : this.calculateDueDate(purchase_date, payment_option, due_days || 0);

        // Generate invoice number for cash payments if not provided
        let finalInvoiceNumber = invoice_number;
        if (!finalInvoiceNumber && payment_option === 'cash') {
            // Generate a unique invoice number for cash transactions
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 8).toUpperCase();
            finalInvoiceNumber = `CASH-${timestamp}-${random}`;
        }

        // Handle paid on purchase - set status to paid and set payment details
        const isPaidOnPurchase = paid_on_purchase || false;
        const finalStatus = isPaidOnPurchase ? 'paid' : 'pending';
        const paymentDate = isPaidOnPurchase ? purchase_date : null;
        // Only set payment_method if NOT paid by third party (is_reimbursable)
        const paymentMethod = (isPaidOnPurchase && !is_reimbursable) ? payment_method_on_purchase : null;
        // Use provided reimbursement_status or default to 'pending' if is_reimbursable
        const finalReimbursementStatus = is_reimbursable ? (reimbursement_status || 'pending') : 'none';

        // Prepare invoice_items JSON if provided
        let invoiceItemsJson = null;
        if (invoice_items && Array.isArray(invoice_items)) {
            invoiceItemsJson = JSON.stringify(invoice_items);
        }

        const normalizedCartonsPurchased = cigarette_cartons_purchased !== undefined && cigarette_cartons_purchased !== null
            ? parseInt(cigarette_cartons_purchased, 10) || 0
            : 0;

        const result = await query(
            `INSERT INTO purchase_invoices (
                store_id, invoice_number, purchase_date, vendor_id, vendor_name,
                department_id, department_name, amount, payment_option, due_days, due_date,
                notes, prepaid_tax, tax_amount, tax_type, tax_rate, tax_inclusive,
                paid_on_purchase, payment_method_on_purchase, bank_id_on_purchase, bank_account_name_on_purchase, credit_card_id_on_purchase,
                is_reimbursable, reimbursement_to, reimbursement_status,
                reimbursement_payment_method, reimbursement_check_number,
                expected_revenue, revenue_calculation_method, invoice_items,
                is_cigarette_purchase, cigarette_cartons_purchased,
                status, payment_date, payment_method, entered_by
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36)
             RETURNING *`,
            [
                storeId, finalInvoiceNumber || null, purchase_date, vendor_id, vendorName,
                department_id, departmentName, amount, payment_option, due_days, dueDate,
                notes || null, prepaid_tax || false, taxAmount, tax_type || null, tax_rate || null, tax_inclusive || false,
                isPaidOnPurchase, paymentMethod, bank_id_on_purchase || null, bank_account_name_on_purchase || null, credit_card_id_on_purchase || null,
                is_reimbursable || false, reimbursement_to || null, finalReimbursementStatus,
                (finalReimbursementStatus === 'reimbursed' ? reimbursement_payment_method : null) || null,
                (finalReimbursementStatus === 'reimbursed' && reimbursement_payment_method === 'check' ? reimbursement_check_number : null) || null,
                expected_revenue ? parseFloat(expected_revenue) : null,
                revenue_calculation_method || null,
                invoiceItemsJson,
                is_cigarette_purchase === true || is_cigarette_purchase === 'true',
                normalizedCartonsPurchased,
                finalStatus, paymentDate, paymentMethod, entered_by
            ]
        );

        const createdInvoice = result.rows[0];

        // Process invoice_items for vape tax tracking and inventory movements
        if (invoice_items && Array.isArray(invoice_items) && invoice_items.length > 0) {
            try {
                const Product = require('./Product');
                
                for (const item of invoice_items) {
                    // item structure: { product_id: UUID, quantity: number, unit_cost: number, vape_tax_paid: boolean }
                    if (item.product_id && item.quantity) {
                        // Get product details
                        const product = await Product.findById(item.product_id);
                        if (!product || product.store_id !== storeId) continue;

                        // Check if product has vape_tax enabled
                        const vapeTaxColumnCheck = await query(`
                            SELECT column_name 
                            FROM information_schema.columns 
                            WHERE table_name = 'products' 
                            AND column_name = 'vape_tax'
                        `);
                        const hasVapeTax = vapeTaxColumnCheck.rows.length > 0;

                        // Update last_vape_tax_paid_date if vape tax was paid
                        if (hasVapeTax && product.vape_tax && item.vape_tax_paid) {
                            const lastVapeTaxColumnCheck = await query(`
                                SELECT column_name 
                                FROM information_schema.columns 
                                WHERE table_name = 'products' 
                                AND column_name = 'last_vape_tax_paid_date'
                            `);
                            const hasLastVapeTaxDate = lastVapeTaxColumnCheck.rows.length > 0;
                            
                            if (hasLastVapeTaxDate) {
                                await query(
                                    `UPDATE products 
                                     SET last_vape_tax_paid_date = $1 
                                     WHERE id = $2`,
                                    [purchase_date, item.product_id]
                                );
                            }
                        }

                        // Create inventory movement for received items
                        const inventoryTableCheck = await query(`
                            SELECT table_name 
                            FROM information_schema.tables 
                            WHERE table_name = 'inventory_movements'
                        `);
                        const hasInventoryTable = inventoryTableCheck.rows.length > 0;

                        if (hasInventoryTable) {
                            await query(
                                `INSERT INTO inventory_movements (
                                    store_id, product_id, movement_type, quantity, unit_cost,
                                    movement_date, invoice_id, notes, entered_by
                                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                                [
                                    storeId,
                                    item.product_id,
                                    'received',
                                    parseInt(item.quantity) || 0,
                                    item.unit_cost ? parseFloat(item.unit_cost) : null,
                                    purchase_date,
                                    createdInvoice.id,
                                    `Received from invoice ${finalInvoiceNumber || createdInvoice.id}`,
                                    entered_by
                                ]
                            );
                        }
                    }
                }
            } catch (itemError) {
                console.error('Error processing invoice items (non-blocking):', itemError);
                // Don't fail invoice creation if item processing fails
            }
        }

        return this.hydrateInvoice(createdInvoice);
    }

    // Get all invoices for a store
    static async findByStore(storeId, filters = {}) {
        let sql = `SELECT pi.*, 
                   v.name as vendor_name_full, 
                   d.name as department_name_full,
                   b.bank_name,
                   b.bank_short_name,
                   rb.bank_name as reimbursement_bank_name,
                   cc.card_name as credit_card_name,
                   cc.last_four_digits as credit_card_last_four
                   FROM purchase_invoices pi
                   LEFT JOIN vendors v ON v.id = pi.vendor_id
                   LEFT JOIN departments d ON d.id = pi.department_id
                   LEFT JOIN banks b ON b.id = pi.bank_id_on_purchase
                   LEFT JOIN banks rb ON rb.id = pi.reimbursement_bank_id
                   LEFT JOIN credit_cards cc ON cc.id = pi.credit_card_id_on_purchase
                   WHERE pi.store_id = $1`;
        const params = [storeId];
        let paramCount = 2;

        if (filters.status) {
            if (filters.status === 'overdue') {
                // Overdue invoices: status is pending and due_date is in the past
                sql += ` AND pi.status = 'pending' AND pi.due_date IS NOT NULL AND pi.due_date < CURRENT_DATE`;
            } else {
                sql += ` AND pi.status = $${paramCount}`;
                params.push(filters.status);
                paramCount++;
            }
        }

        if (filters.start_date) {
            sql += ` AND pi.purchase_date >= $${paramCount}`;
            params.push(filters.start_date);
            paramCount++;
        }

        if (filters.end_date) {
            sql += ` AND pi.purchase_date <= $${paramCount}`;
            params.push(filters.end_date);
            paramCount++;
        }

        if (filters.vendor_id) {
            sql += ` AND pi.vendor_id = $${paramCount}`;
            params.push(filters.vendor_id);
            paramCount++;
        }

        sql += ' ORDER BY pi.purchase_date DESC, pi.created_at DESC';

        const result = await query(sql, params);
        return result.rows.map(row => this.hydrateInvoice(row));
    }

    // Get invoice by ID
    static async findById(id) {
        const result = await query(
            `SELECT pi.*, 
             v.name as vendor_name_full, 
             d.name as department_name_full,
             b.bank_name,
             b.bank_short_name,
             rb.bank_name as reimbursement_bank_name,
             cc.card_name as credit_card_name,
             cc.last_four_digits as credit_card_last_four
             FROM purchase_invoices pi
             LEFT JOIN vendors v ON v.id = pi.vendor_id
             LEFT JOIN departments d ON d.id = pi.department_id
             LEFT JOIN banks b ON b.id = pi.bank_id_on_purchase
             LEFT JOIN banks rb ON rb.id = pi.reimbursement_bank_id
             LEFT JOIN credit_cards cc ON cc.id = pi.credit_card_id_on_purchase
             WHERE pi.id = $1`,
            [id]
        );
        return this.hydrateInvoice(result.rows[0] || null);
    }

    // Update invoice
    static async update(id, updateData) {
        const allowedFields = [
            'invoice_number', 'purchase_date', 'vendor_id', 'department_id', 'amount',
            'payment_option', 'due_days', 'due_date', 'notes', 'prepaid_tax',
            'tax_type', 'tax_rate', 'status', 'payment_date', 'payment_method', 'check_number',
            'paid_on_purchase', 'payment_method_on_purchase', 'bank_id_on_purchase', 'bank_account_name_on_purchase', 'credit_card_id_on_purchase',
            'is_reimbursable', 'reimbursement_to', 'reimbursement_status', 'reimbursement_date', 'reimbursement_amount',
            'reimbursement_payment_method', 'reimbursement_check_number', 'reimbursement_bank_id',
            'is_cigarette_purchase', 'cigarette_cartons_purchased',
            'expected_revenue', 'revenue_calculation_method', 'invoice_items'
        ];
        const updates = [];
        const values = [];
        let paramCount = 1;

        // Handle tax amount calculation
        if (updateData.prepaid_tax && updateData.tax_rate && updateData.amount) {
            updateData.tax_amount = parseFloat(updateData.amount) * parseFloat(updateData.tax_rate);
        } else if (!updateData.prepaid_tax) {
            updateData.tax_amount = 0;
        }

        if (updateData.hasOwnProperty('expected_revenue')) {
            const parsedExpectedRevenue = updateData.expected_revenue !== null && updateData.expected_revenue !== undefined
                ? parseFloat(updateData.expected_revenue)
                : null;
            updateData.expected_revenue = Number.isFinite(parsedExpectedRevenue) ? parsedExpectedRevenue : null;
        }

        if (updateData.hasOwnProperty('invoice_items')) {
            if (Array.isArray(updateData.invoice_items)) {
                updateData.invoice_items = JSON.stringify(updateData.invoice_items);
            } else if (updateData.invoice_items === null) {
                updateData.invoice_items = null;
            }
        }

        // Recalculate due date if payment option or due_days changed
        if (updateData.payment_option || updateData.due_days) {
            const currentInvoice = await this.findById(id);
            if (currentInvoice) {
                updateData.due_date = this.calculateDueDate(
                    updateData.purchase_date || currentInvoice.purchase_date,
                    updateData.payment_option || currentInvoice.payment_option,
                    updateData.due_days !== undefined ? updateData.due_days : currentInvoice.due_days
                );
            }
        }

        if (updateData.hasOwnProperty('is_cigarette_purchase')) {
            updateData.is_cigarette_purchase = updateData.is_cigarette_purchase === true || updateData.is_cigarette_purchase === 'true';
        }

        if (updateData.hasOwnProperty('cigarette_cartons_purchased')) {
            const parsedCartons = parseInt(updateData.cigarette_cartons_purchased, 10);
            updateData.cigarette_cartons_purchased = Number.isFinite(parsedCartons) ? parsedCartons : 0;
        }

        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                updates.push(`${field} = $${paramCount}`);
                values.push(updateData[field]);
                paramCount++;
            }
        }

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        values.push(id);
        const result = await query(
            `UPDATE purchase_invoices SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${paramCount}
             RETURNING *`,
            values
        );

        return this.hydrateInvoice(result.rows[0] || null);
    }

    // Mark invoice as reimbursed
    static async markReimbursed(id, reimbursementData) {
        const { 
            reimbursement_date, 
            reimbursement_amount,
            reimbursement_payment_method,
            reimbursement_check_number,
            reimbursement_bank_id
        } = reimbursementData;
        
        // Validate payment method
        if (reimbursement_payment_method === 'check' && !reimbursement_check_number) {
            throw new Error('Check number is required for check reimbursements');
        }
        
        if (reimbursement_payment_method === 'bank' && !reimbursement_bank_id) {
            throw new Error('Bank account is required for bank reimbursements');
        }
        
        const result = await query(
            `UPDATE purchase_invoices 
             SET reimbursement_status = 'reimbursed',
                 reimbursement_date = $1,
                 reimbursement_amount = $2,
                 reimbursement_payment_method = $3,
                 reimbursement_check_number = $4,
                 reimbursement_bank_id = $5,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6
             RETURNING *`,
            [
                reimbursement_date || new Date().toISOString().split('T')[0],
                reimbursement_amount ? parseFloat(reimbursement_amount) : null,
                reimbursement_payment_method || null,
                reimbursement_check_number || null,
                reimbursement_bank_id || null,
                id
            ]
        );
        
        return result.rows[0] || null;
    }

    // Get pending reimbursements for a store
    static async getPendingReimbursements(storeId) {
        const result = await query(
            `SELECT pi.*, 
             v.name as vendor_name_full,
             b.bank_name,
             b.bank_short_name
             FROM purchase_invoices pi
             LEFT JOIN vendors v ON v.id = pi.vendor_id
             LEFT JOIN banks b ON b.id = pi.bank_id_on_purchase
             LEFT JOIN credit_cards cc ON cc.id = pi.credit_card_id_on_purchase
             WHERE pi.store_id = $1 
             AND pi.reimbursement_status = 'pending'
             AND pi.is_reimbursable = true
             ORDER BY pi.purchase_date DESC`,
            [storeId]
        );
        return result.rows;
    }

    // Delete invoice (soft delete via status)
    static async delete(id) {
        const result = await query(
            `UPDATE purchase_invoices SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        return result.rows[0] || null;
    }
}

module.exports = PurchaseInvoice;

