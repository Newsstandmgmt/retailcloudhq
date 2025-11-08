const { query } = require('../config/database');

class SubscriptionPayment {
    constructor(data) {
        Object.assign(this, data);
    }

    // Create a payment record
    static async create(paymentData) {
        const {
            store_subscription_id,
            store_id,
            payment_date,
            amount,
            billing_period_start,
            billing_period_end,
            payment_method,
            check_number = null,
            transaction_id = null,
            notes = null,
            status = 'paid',
            created_by = null
        } = paymentData;

        const result = await query(
            `INSERT INTO subscription_payments 
             (store_subscription_id, store_id, payment_date, amount, billing_period_start, 
              billing_period_end, payment_method, check_number, transaction_id, notes, 
              status, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [
                store_subscription_id, store_id, payment_date, amount,
                billing_period_start, billing_period_end, payment_method,
                check_number, transaction_id, notes, status, created_by
            ]
        );

        return result.rows[0];
    }

    // Get payments for a store subscription
    static async findBySubscription(subscriptionId) {
        const result = await query(
            `SELECT sp.*, 
                    s.name as store_name,
                    u.first_name || ' ' || u.last_name as created_by_name
             FROM subscription_payments sp
             JOIN stores s ON s.id = sp.store_id
             LEFT JOIN users u ON u.id = sp.created_by
             WHERE sp.store_subscription_id = $1
             ORDER BY sp.payment_date DESC, sp.created_at DESC`,
            [subscriptionId]
        );

        return result.rows;
    }

    // Get payments for a store (all subscriptions)
    static async findByStore(storeId) {
        const result = await query(
            `SELECT sp.*, 
                    ss.template_id,
                    st.name as template_name,
                    u.first_name || ' ' || u.last_name as created_by_name
             FROM subscription_payments sp
             JOIN store_subscriptions ss ON ss.id = sp.store_subscription_id
             LEFT JOIN store_templates st ON st.id = ss.template_id
             LEFT JOIN users u ON u.id = sp.created_by
             WHERE sp.store_id = $1
             ORDER BY sp.payment_date DESC, sp.created_at DESC`,
            [storeId]
        );

        return result.rows;
    }

    // Get all payments for an admin (all their stores)
    static async findByAdmin(adminId) {
        const result = await query(
            `SELECT sp.*, 
                    s.name as store_name,
                    ss.template_id,
                    st.name as template_name,
                    u.first_name || ' ' || u.last_name as created_by_name
             FROM subscription_payments sp
             JOIN stores s ON s.id = sp.store_id
             JOIN store_subscriptions ss ON ss.id = sp.store_subscription_id
             LEFT JOIN store_templates st ON st.id = ss.template_id
             LEFT JOIN users u ON u.id = sp.created_by
             WHERE s.created_by = $1
             ORDER BY sp.payment_date DESC, sp.created_at DESC`,
            [adminId]
        );

        return result.rows;
    }

    // Get payment by ID
    static async findById(paymentId) {
        const result = await query(
            `SELECT sp.*, 
                    s.name as store_name,
                    ss.template_id,
                    st.name as template_name,
                    u.first_name || ' ' || u.last_name as created_by_name
             FROM subscription_payments sp
             JOIN stores s ON s.id = sp.store_id
             JOIN store_subscriptions ss ON ss.id = sp.store_subscription_id
             LEFT JOIN store_templates st ON st.id = ss.template_id
             LEFT JOIN users u ON u.id = sp.created_by
             WHERE sp.id = $1`,
            [paymentId]
        );

        return result.rows[0] || null;
    }

    // Update payment
    static async update(paymentId, updateData) {
        const allowedFields = ['payment_date', 'amount', 'payment_method', 'check_number', 
                             'transaction_id', 'notes', 'status'];
        const updates = [];
        const values = [];
        let paramCount = 1;

        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                updates.push(`${field} = $${paramCount}`);
                values.push(updateData[field]);
                paramCount++;
            }
        }

        if (updates.length === 0) {
            return await this.findById(paymentId);
        }

        values.push(paymentId);

        const result = await query(
            `UPDATE subscription_payments 
             SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${paramCount}
             RETURNING *`,
            values
        );

        return result.rows[0] || null;
    }

    // Delete payment
    static async delete(paymentId) {
        const result = await query(
            'DELETE FROM subscription_payments WHERE id = $1 RETURNING *',
            [paymentId]
        );

        return result.rows[0] || null;
    }
}

module.exports = SubscriptionPayment;

