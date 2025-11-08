const express = require('express');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(authorize('super_admin')); // Only super admin can access statistics

// Helper function to safely query with error handling
const safeQuery = async (sql, defaultValue = null) => {
    try {
        const result = await query(sql);
        return result.rows[0] || defaultValue;
    } catch (error) {
        // If table doesn't exist or column doesn't exist, return default
        if (error.code === '42P01' || error.code === '42703') {
            console.warn(`Table or column not found for query: ${sql.substring(0, 50)}...`);
            return defaultValue;
        }
        throw error;
    }
};

// Get overall statistics
router.get('/', async (req, res) => {
    try {
        // Get user statistics - total_users now only counts active admin users
        let userStats = { total_users: 0, super_admins: 0, admins: 0, managers: 0, employees: 0, active_users: 0, new_users_last_30_days: 0, new_users_last_7_days: 0 };
        try {
            // Query for all active users (for other stats)
            // total_users now counts only active admin users
            const result = await query(`
                SELECT 
                    COUNT(*) FILTER (WHERE role = 'admin' AND is_active = true) as total_users,
                    COUNT(*) FILTER (WHERE role = 'super_admin' AND is_active = true) as super_admins,
                    COUNT(*) FILTER (WHERE role = 'admin' AND is_active = true) as admins,
                    COUNT(*) FILTER (WHERE role = 'manager' AND is_active = true) as managers,
                    COUNT(*) FILTER (WHERE role = 'employee' AND is_active = true) as employees,
                    COUNT(*) FILTER (WHERE is_active = true) as active_users,
                    COUNT(*) FILTER (WHERE role = 'admin' AND created_at >= CURRENT_DATE - INTERVAL '30 days' AND is_active = true) as new_users_last_30_days,
                    COUNT(*) FILTER (WHERE role = 'admin' AND created_at >= CURRENT_DATE - INTERVAL '7 days' AND is_active = true) as new_users_last_7_days
                FROM users
            `);
            if (result.rows.length > 0) {
                const row = result.rows[0];
                userStats = {
                    total_users: parseInt(row.total_users) || 0, // Only active admin users
                    super_admins: parseInt(row.super_admins) || 0,
                    admins: parseInt(row.admins) || 0,
                    managers: parseInt(row.managers) || 0,
                    employees: parseInt(row.employees) || 0,
                    active_users: parseInt(row.active_users) || 0,
                    new_users_last_30_days: parseInt(row.new_users_last_30_days) || 0,
                    new_users_last_7_days: parseInt(row.new_users_last_7_days) || 0
                };
            }
        } catch (error) {
            console.error('Error fetching user statistics:', error);
            // Keep default values
        }

        // Get store statistics - only count active, non-deleted stores as total
        let storeStats = { total_stores: 0, active_stores: 0, deactivated_stores: 0, deleted_stores: 0, new_stores_last_30_days: 0 };
        try {
            const result = await query(`
                SELECT 
                    COUNT(*) FILTER (WHERE is_active = true AND deleted_at IS NULL) as total_stores,
                    COUNT(*) FILTER (WHERE is_active = true AND deleted_at IS NULL) as active_stores,
                    COUNT(*) FILTER (WHERE is_active = false AND deleted_at IS NULL) as deactivated_stores,
                    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted_stores,
                    COUNT(*) FILTER (WHERE is_active = true AND deleted_at IS NULL AND created_at >= CURRENT_DATE - INTERVAL '30 days') as new_stores_last_30_days
                FROM stores
            `);
            if (result.rows.length > 0) {
                storeStats = {
                    total_stores: parseInt(result.rows[0].total_stores) || 0,
                    active_stores: parseInt(result.rows[0].active_stores) || 0,
                    deactivated_stores: parseInt(result.rows[0].deactivated_stores) || 0,
                    deleted_stores: parseInt(result.rows[0].deleted_stores) || 0,
                    new_stores_last_30_days: parseInt(result.rows[0].new_stores_last_30_days) || 0
                };
            }
        } catch (error) {
            console.error('Error fetching store statistics:', error);
            // Keep default values
        }

        // Get billing revenue - Note: billing_invoices table is deprecated/not used, return zeros
        const billingStats = { total_revenue: 0, pending_revenue: 0, overdue_revenue: 0, total_invoices: 0, paid_invoices: 0 };

        // Get stores per admin
        let storesPerAdmin = [];
        try {
            const result = await query(`
                SELECT 
                    u.id,
                    u.email,
                    u.first_name,
                    u.last_name,
                    COUNT(s.id) FILTER (WHERE s.deleted_at IS NULL AND s.is_active = true) as store_count
                FROM users u
                LEFT JOIN stores s ON s.created_by = u.id
                WHERE u.role = 'admin' AND u.is_active = true
                GROUP BY u.id, u.email, u.first_name, u.last_name
                HAVING COUNT(s.id) FILTER (WHERE s.deleted_at IS NULL AND s.is_active = true) > 0
                ORDER BY store_count DESC
            `);
            storesPerAdmin = result.rows;
        } catch (error) {
            if (error.code !== '42P01' && error.code !== '42703') throw error;
        }

        // Get per-store user breakdown (admin users, managers, payroll employees)
        let storeUserBreakdown = [];
        try {
            const result = await query(`
                SELECT 
                    s.id as store_id,
                    s.name as store_name,
                    s.is_active as store_is_active,
                    COUNT(DISTINCT CASE WHEN u_admin.id IS NOT NULL AND u_admin.is_active = true THEN u_admin.id END) as admin_users,
                    COUNT(DISTINCT CASE WHEN sm.manager_id IS NOT NULL AND u_manager.is_active = true THEN sm.manager_id END) as managers,
                    COUNT(DISTINCT CASE WHEN epc.user_id IS NOT NULL AND u_employee.is_active = true THEN epc.user_id END) as payroll_employees
                FROM stores s
                LEFT JOIN users u_admin ON u_admin.id = s.created_by AND u_admin.role = 'admin'
                LEFT JOIN store_managers sm ON sm.store_id = s.id
                LEFT JOIN users u_manager ON u_manager.id = sm.manager_id
                LEFT JOIN employee_payroll_config epc ON epc.store_id = s.id
                LEFT JOIN users u_employee ON u_employee.id = epc.user_id
                WHERE s.deleted_at IS NULL
                GROUP BY s.id, s.name, s.is_active
                ORDER BY s.name ASC
            `);
            storeUserBreakdown = result.rows.map(row => ({
                store_id: row.store_id,
                store_name: row.store_name || 'Unnamed Store',
                store_is_active: row.store_is_active,
                admin_users: parseInt(row.admin_users) || 0,
                managers: parseInt(row.managers) || 0,
                payroll_employees: parseInt(row.payroll_employees) || 0
            }));
        } catch (error) {
            if (error.code !== '42P01' && error.code !== '42703') {
                console.error('Error fetching store user breakdown:', error);
            }
        }

        // Get store growth over time - only count active, non-deleted stores
        let storeGrowth = [];
        try {
            const result = await query(`
                SELECT 
                    DATE_TRUNC('month', created_at) as month,
                    COUNT(*) FILTER (WHERE is_active = true AND deleted_at IS NULL) as store_count
                FROM stores
                WHERE created_at >= CURRENT_DATE - INTERVAL '12 months' 
                  AND is_active = true 
                  AND deleted_at IS NULL
                GROUP BY DATE_TRUNC('month', created_at)
                ORDER BY month ASC
            `);
            storeGrowth = result.rows;
        } catch (error) {
            if (error.code !== '42P01' && error.code !== '42703') throw error;
        }

        // Get revenue trends - Note: billing_invoices table is deprecated/not used, return empty array
        let revenueTrends = [];
        // billing_invoices table is no longer used, so return empty array

        // Get subscription statistics - use store_subscriptions (new model) - only count active subscriptions for active stores
        let subscriptionStats = { total_subscriptions: 0, active_subscriptions: 0, cancelled_subscriptions: 0, monthly_recurring_revenue: 0, due_for_billing: 0 };
        
        try {
            // Try new model first (store_subscriptions) - only count subscriptions for active, non-deleted stores
            const storeSubResult = await query(`
                SELECT 
                    COUNT(*) FILTER (WHERE ss.status = 'active' AND s.is_active = true AND s.deleted_at IS NULL) as active_subscriptions,
                    COUNT(*) FILTER (WHERE ss.status = 'cancelled' AND s.is_active = true AND s.deleted_at IS NULL) as cancelled_subscriptions,
                    COUNT(*) FILTER (WHERE s.is_active = true AND s.deleted_at IS NULL) as total_subscriptions,
                    COALESCE(SUM(ss.total_monthly_price) FILTER (WHERE ss.status = 'active' AND s.is_active = true AND s.deleted_at IS NULL), 0) as monthly_recurring_revenue
                FROM store_subscriptions ss
                INNER JOIN stores s ON ss.store_id = s.id
            `);
            
            if (storeSubResult.rows.length > 0) {
                const row = storeSubResult.rows[0];
                subscriptionStats = {
                    total_subscriptions: parseInt(row.total_subscriptions) || 0,
                    active_subscriptions: parseInt(row.active_subscriptions) || 0,
                    cancelled_subscriptions: parseInt(row.cancelled_subscriptions) || 0,
                    monthly_recurring_revenue: parseFloat(row.monthly_recurring_revenue || 0),
                    due_for_billing: 0
                };
            }
        } catch (error) {
            if (error.code === '42P01' || error.code === '42703') {
                // Table doesn't exist, try old model (admin_subscriptions)
                try {
                    const adminSubResult = await query(`
                        SELECT 
                            COUNT(*) as total_subscriptions,
                            COUNT(*) FILTER (WHERE asub.status = 'active') as active_subscriptions,
                            COUNT(*) FILTER (WHERE asub.status = 'cancelled') as cancelled_subscriptions,
                            COALESCE(SUM(sp.price_per_month) FILTER (WHERE asub.status = 'active'), 0) as monthly_recurring_revenue
                        FROM admin_subscriptions asub
                        LEFT JOIN subscription_plans sp ON asub.plan_id = sp.id
                    `);
                    
                    if (adminSubResult.rows.length > 0) {
                        const row = adminSubResult.rows[0];
                        subscriptionStats = {
                            total_subscriptions: parseInt(row.total_subscriptions) || 0,
                            active_subscriptions: parseInt(row.active_subscriptions) || 0,
                            cancelled_subscriptions: parseInt(row.cancelled_subscriptions) || 0,
                            monthly_recurring_revenue: parseFloat(row.monthly_recurring_revenue || 0),
                            due_for_billing: 0
                        };
                    }
                } catch (oldError) {
                    // Both tables don't exist, use defaults
                    console.warn('Neither store_subscriptions nor admin_subscriptions table found');
                }
            } else {
                throw error;
            }
        }

        // Get top performing stores (by store count per admin) - only count active admins and active stores
        let topAdmins = [];
        try {
            const result = await query(`
                SELECT 
                    u.id,
                    u.email,
                    u.first_name,
                    u.last_name,
                    COUNT(s.id) FILTER (WHERE s.deleted_at IS NULL AND s.is_active = true) as store_count,
                    COUNT(s.id) FILTER (WHERE s.is_active = true AND s.deleted_at IS NULL) as active_store_count
                FROM users u
                LEFT JOIN stores s ON s.created_by = u.id
                WHERE u.role = 'admin' AND u.is_active = true
                GROUP BY u.id, u.email, u.first_name, u.last_name
                HAVING COUNT(s.id) FILTER (WHERE s.deleted_at IS NULL AND s.is_active = true) > 0
                ORDER BY store_count DESC
                LIMIT 10
            `);
            topAdmins = result.rows;
        } catch (error) {
            if (error.code !== '42P01' && error.code !== '42703') throw error;
        }

        // Get system activity (recent activity summary)
        let recentActivity = [];
        try {
            const result = await query(`
                SELECT 
                    DATE_TRUNC('day', created_at) as day,
                    COUNT(*) as activity_count,
                    COUNT(DISTINCT user_id) as unique_users
                FROM audit_logs
                WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY DATE_TRUNC('day', created_at)
                ORDER BY day DESC
                LIMIT 30
            `);
            recentActivity = result.rows;
        } catch (error) {
            if (error.code !== '42P01' && error.code !== '42703') throw error;
        }

        // Get subscription plan distribution - use store_subscriptions (new model) - only count active subscriptions for active stores
        let planDistribution = [];
        try {
            // Try new model first (store_subscriptions - join through stores to get template) - only count active stores
            const result = await query(`
                SELECT 
                    COALESCE(st.name, 'No Template') as plan_name,
                    COUNT(ss.id) FILTER (WHERE ss.status = 'active' AND s.is_active = true AND s.deleted_at IS NULL) as subscription_count,
                    COALESCE(SUM(ss.total_monthly_price) FILTER (WHERE ss.status = 'active' AND s.is_active = true AND s.deleted_at IS NULL), 0) as total_mrr
                FROM store_subscriptions ss
                INNER JOIN stores s ON ss.store_id = s.id
                LEFT JOIN store_templates st ON s.template_id = st.id
                WHERE ss.status = 'active' AND s.is_active = true AND s.deleted_at IS NULL
                GROUP BY st.name, st.id
                HAVING COUNT(ss.id) FILTER (WHERE ss.status = 'active' AND s.is_active = true AND s.deleted_at IS NULL) > 0
                ORDER BY subscription_count DESC
            `);
            planDistribution = result.rows.map(row => ({
                plan_name: row.plan_name || 'No Template',
                subscription_count: parseInt(row.subscription_count) || 0,
                total_mrr: parseFloat(row.total_mrr) || 0
            }));
        } catch (error) {
            if (error.code === '42P01' || error.code === '42703') {
                // Table doesn't exist, try old model (admin_subscriptions)
                try {
                    const oldResult = await query(`
                        SELECT 
                            sp.name as plan_name,
                            COUNT(asub.id) as subscription_count,
                            COALESCE(SUM(sp.price_per_month), 0) as total_mrr
                        FROM admin_subscriptions asub
                        LEFT JOIN subscription_plans sp ON asub.plan_id = sp.id
                        WHERE asub.status = 'active'
                        GROUP BY sp.name, sp.id
                        ORDER BY subscription_count DESC
                    `);
                    planDistribution = oldResult.rows.map(row => ({
                        plan_name: row.plan_name || 'Unknown Plan',
                        subscription_count: parseInt(row.subscription_count) || 0,
                        total_mrr: parseFloat(row.total_mrr) || 0
                    }));
                } catch (oldError) {
                    // Both tables don't exist, use empty array
                    console.warn('Neither store_subscriptions nor admin_subscriptions table found for plan distribution');
                }
            } else {
                throw error;
            }
        }

        res.json({
            statistics: {
                users: userStats,
                stores: storeStats,
                billing: billingStats,
                subscriptions: subscriptionStats,
                stores_per_admin: storesPerAdmin,
                top_admins: topAdmins,
                store_user_breakdown: storeUserBreakdown,
                store_growth: storeGrowth,
                revenue_trends: revenueTrends,
                recent_activity: recentActivity,
                plan_distribution: planDistribution
            }
        });
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Get statistics for a specific store
router.get('/stores/:storeId', async (req, res) => {
    try {
        const { storeId } = req.params;

        // Verify store exists
        const storeCheck = await query('SELECT id, name FROM stores WHERE id = $1', [storeId]);
        if (storeCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Store not found' });
        }

        // Helper function to safely query with error handling
        const safeQuery = async (sql, params, defaultValue = {}) => {
            try {
                const result = await query(sql, params);
                return result.rows[0] || defaultValue;
            } catch (error) {
                // If table doesn't exist or column doesn't exist, return default
                if (error.code === '42P01' || error.code === '42703') {
                    console.warn(`Table or column not found for query: ${sql.substring(0, 50)}...`);
                    return defaultValue;
                }
                throw error;
            }
        };

        // Get revenue statistics for this store
        const revenueStats = await safeQuery(`
            SELECT 
                COUNT(*) as total_entries,
                COALESCE(SUM(total_cash), 0) as total_cash,
                COALESCE(SUM(business_credit_card), 0) as total_credit_card,
                COALESCE(SUM(online_sales), 0) as total_online_sales,
                COALESCE(SUM(total_instant), 0) as total_instant_lottery,
                MAX(entry_date) as last_entry_date,
                MIN(entry_date) as first_entry_date
            FROM daily_revenue
            WHERE store_id = $1
        `, [storeId], { total_entries: 0, total_cash: 0, total_credit_card: 0, total_online_sales: 0, total_instant_lottery: 0 });

        // Get purchase invoice statistics
        const invoiceStats = await safeQuery(`
            SELECT 
                COUNT(*) as total_invoices,
                COUNT(*) FILTER (WHERE status = 'unpaid') as unpaid_invoices,
                COUNT(*) FILTER (WHERE status = 'paid') as paid_invoices,
                COALESCE(SUM(total_amount) FILTER (WHERE status = 'unpaid'), 0) as unpaid_amount,
                COALESCE(SUM(total_amount) FILTER (WHERE status = 'paid'), 0) as paid_amount,
                COALESCE(SUM(total_amount), 0) as total_amount
            FROM purchase_invoices
            WHERE store_id = $1 AND deleted_at IS NULL
        `, [storeId], { total_invoices: 0, unpaid_invoices: 0, paid_invoices: 0, unpaid_amount: 0, paid_amount: 0, total_amount: 0 });

        // Get expense statistics
        const expenseStats = await safeQuery(`
            SELECT 
                COUNT(*) as total_expenses,
                COALESCE(SUM(amount), 0) as total_amount,
                COUNT(*) FILTER (WHERE reimbursement_status = 'pending') as pending_reimbursements,
                COALESCE(SUM(amount) FILTER (WHERE reimbursement_status = 'pending'), 0) as pending_reimbursement_amount
            FROM daily_operating_expenses
            WHERE store_id = $1 AND deleted_at IS NULL
        `, [storeId], { total_expenses: 0, total_amount: 0, pending_reimbursements: 0, pending_reimbursement_amount: 0 });

        // Get employee count
        const employeeStats = await safeQuery(`
            SELECT COUNT(DISTINCT usa.user_id) as total_employees
            FROM user_store_assignments usa
            JOIN users u ON u.id = usa.user_id
            WHERE usa.store_id = $1 AND u.role = 'employee' AND u.is_active = true
        `, [storeId], { total_employees: 0 });

        // Get manager count
        const managerStats = await safeQuery(`
            SELECT COUNT(*) as total_managers
            FROM store_managers
            WHERE store_id = $1
        `, [storeId], { total_managers: 0 });

        // Get lottery sales data count (if exists)
        const lotteryStats = await safeQuery(`
            SELECT 
                COUNT(*) as total_daily_sales,
                MAX(entry_date) as last_daily_sale_date
            FROM lottery_daily_sales
            WHERE store_id = $1
        `, [storeId], { total_daily_sales: 0 });

        res.json({
            statistics: {
                store: storeCheck.rows[0],
                revenue: revenueStats,
                invoices: invoiceStats,
                expenses: expenseStats,
                employees: employeeStats,
                managers: managerStats,
                lottery: lotteryStats
            }
        });
    } catch (error) {
        console.error('Get store statistics error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to fetch store statistics', details: error.message });
    }
});

module.exports = router;

