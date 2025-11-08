const { query } = require('../config/database');
const SubscriptionPlan = require('./SubscriptionPlan');

class AdminSubscription {
    constructor(data) {
        Object.assign(this, data);
    }

    // Calculate next billing date based on billing cycle
    static calculateNextBillingDate(startDate, billingCycle) {
        const date = new Date(startDate);
        switch (billingCycle) {
            case 'monthly':
                date.setMonth(date.getMonth() + 1);
                break;
            case 'quarterly':
                date.setMonth(date.getMonth() + 3);
                break;
            case 'yearly':
                date.setFullYear(date.getFullYear() + 1);
                break;
            default:
                date.setMonth(date.getMonth() + 1);
        }
        return date.toISOString().split('T')[0];
    }

    // Create or update subscription
    static async upsert(adminId, subscriptionData) {
        const { plan_id, start_date, discount_percentage = 0, discount_amount = 0, discount_applied_to_next_billing = false, auto_renew = true } = subscriptionData;
        
        // Get plan details
        const plan = await SubscriptionPlan.findById(plan_id);
        if (!plan) {
            throw new Error('Subscription plan not found');
        }

        const nextBillingDate = this.calculateNextBillingDate(start_date, plan.billing_cycle);

        const result = await query(
            `INSERT INTO admin_subscriptions 
             (admin_id, plan_id, start_date, next_billing_date, discount_percentage, discount_amount, discount_applied_to_next_billing, auto_renew, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
             ON CONFLICT (admin_id) DO UPDATE SET
                 plan_id = EXCLUDED.plan_id,
                 start_date = EXCLUDED.start_date,
                 next_billing_date = EXCLUDED.next_billing_date,
                 discount_percentage = EXCLUDED.discount_percentage,
                 discount_amount = EXCLUDED.discount_amount,
                 discount_applied_to_next_billing = EXCLUDED.discount_applied_to_next_billing,
                 auto_renew = EXCLUDED.auto_renew,
                 updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [adminId, plan_id, start_date, nextBillingDate, discount_percentage, discount_amount, discount_applied_to_next_billing, auto_renew]
        );

        return result.rows[0];
    }

    // Find subscription by admin ID
    static async findByAdminId(adminId) {
        const result = await query(
            `SELECT asub.*, sp.name as plan_name, sp.description as plan_description, 
                    sp.price_per_month, sp.billing_cycle
             FROM admin_subscriptions asub
             JOIN subscription_plans sp ON sp.id = asub.plan_id
             WHERE asub.admin_id = $1`,
            [adminId]
        );
        return result.rows[0] || null;
    }

    // Get all subscriptions
    static async findAll(filters = {}) {
        let sql = `SELECT asub.*, sp.name as plan_name, sp.price_per_month, sp.billing_cycle,
                          u.email, u.first_name, u.last_name
                   FROM admin_subscriptions asub
                   JOIN subscription_plans sp ON sp.id = asub.plan_id
                   JOIN users u ON u.id = asub.admin_id
                   WHERE 1=1`;
        const params = [];
        let paramCount = 1;

        if (filters.status) {
            sql += ` AND asub.status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }

        sql += ' ORDER BY asub.next_billing_date ASC';

        const result = await query(sql, params);
        return result.rows;
    }

    // Update subscription discount for next billing
    static async updateDiscount(adminId, discountData) {
        const { discount_percentage = 0, discount_amount = 0, discount_applied_to_next_billing = true } = discountData;

        const result = await query(
            `UPDATE admin_subscriptions 
             SET discount_percentage = $1, 
                 discount_amount = $2, 
                 discount_applied_to_next_billing = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE admin_id = $4
             RETURNING *`,
            [discount_percentage, discount_amount, discount_applied_to_next_billing, adminId]
        );

        return result.rows[0] || null;
    }

    // Update subscription status
    static async updateStatus(adminId, status) {
        const result = await query(
            `UPDATE admin_subscriptions 
             SET status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE admin_id = $2
             RETURNING *`,
            [status, adminId]
        );

        return result.rows[0] || null;
    }

    // Calculate invoice amount with discount
    static calculateInvoiceAmount(subscription, plan) {
        let amount = parseFloat(plan.price_per_month);
        
        // Adjust amount based on billing cycle
        switch (plan.billing_cycle) {
            case 'quarterly':
                amount = amount * 3; // 3 months
                break;
            case 'yearly':
                amount = amount * 12; // 12 months
                break;
            case 'monthly':
            default:
                // Already monthly price
                break;
        }
        
        // Apply discount if it's set for next billing
        if (subscription.discount_applied_to_next_billing) {
            if (subscription.discount_percentage > 0) {
                amount = amount * (1 - subscription.discount_percentage / 100);
            }
            if (subscription.discount_amount > 0) {
                amount = amount - subscription.discount_amount;
            }
        }

        return Math.max(0, amount); // Ensure amount is not negative
    }

    // Update next billing date after invoice generation
    static async updateNextBillingDate(adminId) {
        const subscription = await this.findByAdminId(adminId);
        if (!subscription) {
            throw new Error('Subscription not found');
        }

        const plan = await SubscriptionPlan.findById(subscription.plan_id);
        const newNextBillingDate = this.calculateNextBillingDate(subscription.next_billing_date, plan.billing_cycle);

        // Reset discount after it's been applied
        const result = await query(
            `UPDATE admin_subscriptions 
             SET next_billing_date = $1,
                 discount_applied_to_next_billing = false,
                 discount_percentage = 0,
                 discount_amount = 0,
                 updated_at = CURRENT_TIMESTAMP
             WHERE admin_id = $2
             RETURNING *`,
            [newNextBillingDate, adminId]
        );

        return result.rows[0];
    }
}

module.exports = AdminSubscription;

