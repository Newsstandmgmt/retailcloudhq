const express = require('express');
const { query } = require('../config/database');
const { authenticate, canAccessStore } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

/**
 * Profit & Loss Statement
 * GET /api/reports/store/:storeId/profit-loss?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
router.get('/store/:storeId/profit-loss', canAccessStore, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const storeId = req.params.storeId;

        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }

         // Check which columns exist
        const columnCheck = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'daily_revenue' 
            AND column_name IN ('calculated_business_cash', 'store_closed')
        `);
        const existingColumns = columnCheck.rows.map(r => r.column_name);
        const hasCalculatedBusinessCash = existingColumns.includes('calculated_business_cash');
        const hasStoreClosed = existingColumns.includes('store_closed');

        // Revenue - Use calculated_business_cash when available, otherwise calculate using proper formula
        // For combined drawer: total_cash + business_credit_card - credit_card_transaction_fees + other_cash_expense
        let revenueQuery;
        const storeClosedFilter = hasStoreClosed ? 'AND (store_closed IS NULL OR store_closed = false)' : '';
        
        if (hasCalculatedBusinessCash) {
            revenueQuery = `
                SELECT 
                    COALESCE(SUM(
                        CASE 
                            WHEN calculated_business_cash IS NOT NULL AND calculated_business_cash > 0 
                            THEN calculated_business_cash
                            ELSE (
                                COALESCE(total_cash, 0) + 
                                COALESCE(business_credit_card, 0) - 
                                COALESCE(credit_card_transaction_fees, 0) + 
                                COALESCE(other_cash_expense, 0)
                            )
                        END
                    ), 0) as total_revenue,
                    COALESCE(SUM(total_cash), 0) as total_cash_sum,
                    COALESCE(SUM(business_credit_card), 0) as total_credit_card_sum,
                    COALESCE(SUM(online_net), 0) as total_online_sum,
                    COALESCE(SUM(instant_pay), 0) as total_instant_pay_sum
                 FROM daily_revenue
                 WHERE store_id = $1 AND entry_date BETWEEN $2 AND $3
                 ${storeClosedFilter}
            `;
        } else {
            revenueQuery = `
                SELECT 
                    COALESCE(SUM(
                        COALESCE(total_cash, 0) + 
                        COALESCE(business_credit_card, 0) - 
                        COALESCE(credit_card_transaction_fees, 0) + 
                        COALESCE(other_cash_expense, 0)
                    ), 0) as total_revenue,
                    COALESCE(SUM(total_cash), 0) as total_cash_sum,
                    COALESCE(SUM(business_credit_card), 0) as total_credit_card_sum,
                    COALESCE(SUM(online_net), 0) as total_online_sum,
                    COALESCE(SUM(instant_pay), 0) as total_instant_pay_sum
                 FROM daily_revenue
                 WHERE store_id = $1 AND entry_date BETWEEN $2 AND $3
                 ${storeClosedFilter}
            `;
        }

        let revenueResult;
        try {
            revenueResult = await query(revenueQuery, [storeId, start_date, end_date]);
        } catch (error) {
            console.error('Revenue query error:', error);
            throw new Error(`Revenue query failed: ${error.message}`);
        }

        // Operating Expenses - Check if table exists first
        let expensesResult;
        try {
            const tableCheck = await query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'daily_operating_expenses'
            `);
            
            if (tableCheck.rows.length > 0) {
                expensesResult = await query(
                    `SELECT 
                        COALESCE(SUM(e.amount), 0) as total_expenses,
                        et.expense_type_name,
                        SUM(e.amount) as category_total
                     FROM daily_operating_expenses e
                     LEFT JOIN expense_types et ON e.expense_type_id = et.id
                     WHERE e.store_id = $1 AND e.entry_date BETWEEN $2 AND $3
                     GROUP BY et.expense_type_name
                     ORDER BY category_total DESC`,
                    [storeId, start_date, end_date]
                );
            } else {
                // Table doesn't exist, return empty result
                expensesResult = { rows: [] };
            }
        } catch (error) {
            console.error('Expenses query error:', error);
            // If expenses query fails, continue with empty expenses
            expensesResult = { rows: [] };
        }

        // Purchase Invoices (COGS)
        const cogsResult = await query(
            `SELECT 
                COALESCE(SUM(amount), 0) as total_cogs
             FROM purchase_invoices
             WHERE store_id = $1 
             AND purchase_date BETWEEN $2 AND $3
             AND payment_option != 'credit_memo'`,
            [storeId, start_date, end_date]
        );

        // Payments made
        const paymentsResult = await query(
            `SELECT 
                COALESCE(SUM(amount), 0) as total_payments
             FROM purchase_invoices
             WHERE store_id = $1 
             AND payment_date BETWEEN $2 AND $3
             AND status = 'paid'`,
            [storeId, start_date, end_date]
        );

        const totalRevenue = parseFloat(revenueResult.rows[0]?.total_revenue || 0);
        const totalExpenses = parseFloat(expensesResult.rows.reduce((sum, row) => sum + parseFloat(row.category_total || 0), 0));
        const totalCOGS = parseFloat(cogsResult.rows[0]?.total_cogs || 0);
        const grossProfit = totalRevenue - totalCOGS;
        const netProfit = grossProfit - totalExpenses;

        res.json({
            period: { start_date, end_date },
            revenue: {
                total: totalRevenue,
                breakdown: {
                    cash: parseFloat(revenueResult.rows[0]?.total_cash_sum || 0),
                    credit_card: parseFloat(revenueResult.rows[0]?.total_credit_card_sum || 0),
                    online: parseFloat(revenueResult.rows[0]?.total_online_sum || 0),
                    instant_pay: parseFloat(revenueResult.rows[0]?.total_instant_pay_sum || 0)
                }
            },
            cost_of_goods_sold: totalCOGS,
            gross_profit: grossProfit,
            operating_expenses: {
                total: totalExpenses,
                by_category: expensesResult.rows.map(row => ({
                    category: row.expense_type_name || 'Uncategorized',
                    amount: parseFloat(row.category_total || 0)
                }))
            },
            net_profit: netProfit,
            margin_percentage: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0
        });
    } catch (error) {
        console.error('Profit & Loss error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to generate Profit & Loss statement',
            details: error.message 
        });
    }
});

/**
 * Cash Flow Report (Detailed with daily breakdown)
 * GET /api/reports/store/:storeId/cash-flow-detailed?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
router.get('/store/:storeId/cash-flow-detailed', canAccessStore, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const storeId = req.params.storeId;

        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }

        // Get starting cash balance (business cash on hand before the period)
        // Check if business_cash_on_hand column exists
        const cashOnHandColumnCheck = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'cash_on_hand' 
            AND column_name = 'business_cash_on_hand'
        `);
        const hasBusinessCashOnHand = cashOnHandColumnCheck.rows.length > 0;
        
        let startingBalance = 0;
        try {
            const startingBalanceResult = await query(
                hasBusinessCashOnHand
                    ? `SELECT business_cash_on_hand FROM cash_on_hand WHERE store_id = $1`
                    : `SELECT current_balance FROM cash_on_hand WHERE store_id = $1`,
                [storeId]
            );
            startingBalance = parseFloat(
                hasBusinessCashOnHand 
                    ? startingBalanceResult.rows[0]?.business_cash_on_hand || 0
                    : startingBalanceResult.rows[0]?.current_balance || 0
            );
        } catch (error) {
            console.warn('Starting balance query failed, using 0:', error.message);
            startingBalance = 0;
        }

        // Check which columns exist in daily_revenue
        const revenueColumnCheck = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'daily_revenue' 
            AND column_name IN ('calculated_business_cash', 'store_closed')
        `);
        const existingRevenueColumns = revenueColumnCheck.rows.map(r => r.column_name);
        const hasCalculatedBusinessCash = existingRevenueColumns.includes('calculated_business_cash');
        const hasStoreClosed = existingRevenueColumns.includes('store_closed');

        // Cash Inflows - Revenue (business cash from daily revenue)
        let revenueQuery;
        const storeClosedFilter = hasStoreClosed ? 'AND (store_closed IS NULL OR store_closed = false)' : '';
        
        if (hasCalculatedBusinessCash) {
            revenueQuery = `
                SELECT 
                    entry_date,
                    COALESCE(
                        CASE 
                            WHEN calculated_business_cash IS NOT NULL AND calculated_business_cash > 0 
                            THEN calculated_business_cash
                            ELSE (
                                COALESCE(total_cash, 0) + 
                                COALESCE(business_credit_card, 0) - 
                                COALESCE(credit_card_transaction_fees, 0) + 
                                COALESCE(other_cash_expense, 0)
                            )
                        END,
                        0
                    ) as daily_revenue
                 FROM daily_revenue
                 WHERE store_id = $1 AND entry_date BETWEEN $2 AND $3
                 ${storeClosedFilter}
                 ORDER BY entry_date
            `;
        } else {
            revenueQuery = `
                SELECT 
                    entry_date,
                    COALESCE(
                        COALESCE(total_cash, 0) + 
                        COALESCE(business_credit_card, 0) - 
                        COALESCE(credit_card_transaction_fees, 0) + 
                        COALESCE(other_cash_expense, 0),
                        0
                    ) as daily_revenue
                 FROM daily_revenue
                 WHERE store_id = $1 AND entry_date BETWEEN $2 AND $3
                 ${storeClosedFilter}
                 ORDER BY entry_date
            `;
        }

        let revenueResult = { rows: [] };
        try {
            revenueResult = await query(revenueQuery, [storeId, start_date, end_date]);
        } catch (error) {
            console.error('Revenue query error:', error);
            throw new Error(`Revenue query failed: ${error.message}`);
        }

        // Cash Inflows - Customer Tab Payments (if table exists)
        let customerPaymentsResult = { rows: [] };
        try {
            const customerTabTableCheck = await query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'customer_tab_payments'
            `);
            if (customerTabTableCheck.rows.length > 0) {
                customerPaymentsResult = await query(
                    `SELECT 
                        payment_date as entry_date,
                        SUM(amount) as total
                     FROM customer_tab_payments
                     WHERE store_id = $1 
                     AND payment_date BETWEEN $2 AND $3
                     AND payment_method = 'cash'
                     GROUP BY payment_date
                     ORDER BY payment_date`,
                    [storeId, start_date, end_date]
                );
            }
        } catch (error) {
            console.warn('Customer tab payments query failed:', error.message);
        }

        // Cash Inflows - Bank Deposits (if from business account and table exists)
        let bankDepositsResult = { rows: [] };
        try {
            const bankDepositsTableCheck = await query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'bank_deposits'
            `);
            if (bankDepositsTableCheck.rows.length > 0) {
                bankDepositsResult = await query(
                    `SELECT 
                        deposit_date as entry_date,
                        SUM(amount) as total
                     FROM bank_deposits
                     WHERE store_id = $1 
                     AND deposit_date BETWEEN $2 AND $3
                     AND (is_lottery_deposit IS NULL OR is_lottery_deposit = false)
                     GROUP BY deposit_date
                     ORDER BY deposit_date`,
                    [storeId, start_date, end_date]
                );
            }
        } catch (error) {
            console.warn('Bank deposits query failed:', error.message);
        }

        // Cash Outflows - Operating Expenses (cash payments only)
        let expensesResult = { rows: [] };
        try {
            const expensesTableCheck = await query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'daily_operating_expenses'
            `);
            if (expensesTableCheck.rows.length > 0) {
                expensesResult = await query(
                    `SELECT 
                        entry_date,
                        SUM(amount) as total
                     FROM daily_operating_expenses
                     WHERE store_id = $1 
                     AND entry_date BETWEEN $2 AND $3
                     AND payment_method = 'cash'
                     GROUP BY entry_date
                     ORDER BY entry_date`,
                    [storeId, start_date, end_date]
                );
            }
        } catch (error) {
            console.warn('Expenses query failed:', error.message);
        }

        // Cash Outflows - Vendor Payments from Cash
        let vendorPaymentsResult = { rows: [] };
        try {
            vendorPaymentsResult = await query(
                `SELECT 
                    payment_date as entry_date,
                    SUM(amount) as total
                 FROM purchase_invoices
                 WHERE store_id = $1 
                 AND payment_date BETWEEN $2 AND $3
                 AND status = 'paid'
                 AND payment_method = 'cash'
                 GROUP BY payment_date
                 ORDER BY payment_date`,
                [storeId, start_date, end_date]
            );
        } catch (error) {
            console.warn('Vendor payments query failed:', error.message);
        }

        // Cash Outflows - Bank Withdrawals (if from business account and table exists)
        let bankWithdrawalsResult = { rows: [] };
        try {
            const bankWithdrawalsTableCheck = await query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'bank_withdrawals'
            `);
            if (bankWithdrawalsTableCheck.rows.length > 0) {
                bankWithdrawalsResult = await query(
                    `SELECT 
                        withdrawal_date as entry_date,
                        SUM(amount) as total
                     FROM bank_withdrawals
                     WHERE store_id = $1 
                     AND withdrawal_date BETWEEN $2 AND $3
                     AND (is_lottery_withdrawal IS NULL OR is_lottery_withdrawal = false)
                     GROUP BY withdrawal_date
                     ORDER BY withdrawal_date`,
                    [storeId, start_date, end_date]
                );
            }
        } catch (error) {
            console.warn('Bank withdrawals query failed:', error.message);
        }

        // Aggregate inflows by date
        const inflowsByDate = {};
        const inflowsByType = {
            revenue: 0,
            customer_payments: 0,
            bank_deposits: 0
        };

        // Helper function to normalize date to YYYY-MM-DD format
        const normalizeDate = (date) => {
            if (!date) return null;
            if (typeof date === 'string') {
                // If it's already in YYYY-MM-DD format, return it
                if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
                // If it has time component, extract just the date
                return date.split('T')[0];
            }
            // If it's a Date object, format it
            const d = new Date(date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        revenueResult.rows.forEach(row => {
            const date = normalizeDate(row.entry_date);
            if (!date) return;
            if (!inflowsByDate[date]) inflowsByDate[date] = { date, inflow: 0, outflow: 0 };
            inflowsByDate[date].inflow += parseFloat(row.daily_revenue || 0);
            inflowsByType.revenue += parseFloat(row.daily_revenue || 0);
        });

        customerPaymentsResult.rows.forEach(row => {
            const date = normalizeDate(row.entry_date);
            if (!date) return;
            if (!inflowsByDate[date]) inflowsByDate[date] = { date, inflow: 0, outflow: 0 };
            inflowsByDate[date].inflow += parseFloat(row.total || 0);
            inflowsByType.customer_payments += parseFloat(row.total || 0);
        });

        bankDepositsResult.rows.forEach(row => {
            const date = normalizeDate(row.entry_date);
            if (!date) return;
            if (!inflowsByDate[date]) inflowsByDate[date] = { date, inflow: 0, outflow: 0 };
            inflowsByDate[date].inflow += parseFloat(row.total || 0);
            inflowsByType.bank_deposits += parseFloat(row.total || 0);
        });

        // Aggregate outflows by date
        const outflowsByType = {
            expenses: 0,
            vendor_payments: 0,
            bank_withdrawals: 0
        };

        expensesResult.rows.forEach(row => {
            const date = normalizeDate(row.entry_date);
            if (!date) return;
            if (!inflowsByDate[date]) inflowsByDate[date] = { date, inflow: 0, outflow: 0 };
            inflowsByDate[date].outflow += parseFloat(row.total || 0);
            outflowsByType.expenses += parseFloat(row.total || 0);
        });

        vendorPaymentsResult.rows.forEach(row => {
            const date = normalizeDate(row.entry_date);
            if (!date) return;
            if (!inflowsByDate[date]) inflowsByDate[date] = { date, inflow: 0, outflow: 0 };
            inflowsByDate[date].outflow += parseFloat(row.total || 0);
            outflowsByType.vendor_payments += parseFloat(row.total || 0);
        });

        bankWithdrawalsResult.rows.forEach(row => {
            const date = normalizeDate(row.entry_date);
            if (!date) return;
            if (!inflowsByDate[date]) inflowsByDate[date] = { date, inflow: 0, outflow: 0 };
            inflowsByDate[date].outflow += parseFloat(row.total || 0);
            outflowsByType.bank_withdrawals += parseFloat(row.total || 0);
        });

        // Calculate daily breakdown
        const dailyBreakdown = Object.values(inflowsByDate)
            .map(day => ({
                date: day.date,
                inflow: day.inflow,
                outflow: day.outflow,
                net: day.inflow - day.outflow
            }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const totalInflows = Object.values(inflowsByType).reduce((sum, val) => sum + val, 0);
        const totalOutflows = Object.values(outflowsByType).reduce((sum, val) => sum + val, 0);
        const netCashFlow = totalInflows - totalOutflows;
        const endingBalance = startingBalance + netCashFlow;

        res.json({
            period: { start_date, end_date },
            starting_balance: startingBalance,
            inflows: {
                total: totalInflows,
                by_type: [
                    { type: 'revenue', amount: inflowsByType.revenue, count: revenueResult.rows.length },
                    { type: 'customer_payments', amount: inflowsByType.customer_payments, count: customerPaymentsResult.rows.length },
                    { type: 'bank_deposits', amount: inflowsByType.bank_deposits, count: bankDepositsResult.rows.length }
                ].filter(item => item.amount > 0)
            },
            outflows: {
                total: totalOutflows,
                by_type: [
                    { type: 'expenses', amount: outflowsByType.expenses, count: expensesResult.rows.length },
                    { type: 'vendor_payments', amount: outflowsByType.vendor_payments, count: vendorPaymentsResult.rows.length },
                    { type: 'bank_withdrawals', amount: outflowsByType.bank_withdrawals, count: bankWithdrawalsResult.rows.length }
                ].filter(item => item.amount > 0)
            },
            net_cash_flow: netCashFlow,
            ending_balance: endingBalance,
            daily_breakdown: dailyBreakdown
        });
    } catch (error) {
        console.error('Cash Flow error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to generate Cash Flow report',
            details: error.message 
        });
    }
});

/**
 * Expense Breakdown by Category
 * GET /api/reports/store/:storeId/expense-breakdown?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
router.get('/store/:storeId/expense-breakdown', canAccessStore, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const storeId = req.params.storeId;

        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }

        const result = await query(
            `SELECT 
                et.expense_type_name as category,
                COUNT(*) as count,
                SUM(e.amount) as total_amount,
                AVG(e.amount) as avg_amount,
                MIN(e.amount) as min_amount,
                MAX(e.amount) as max_amount,
                SUM(CASE WHEN e.payment_method = 'cash' THEN e.amount ELSE 0 END) as cash_total,
                SUM(CASE WHEN e.payment_method = 'bank' THEN e.amount ELSE 0 END) as bank_total,
                SUM(CASE WHEN e.payment_method = 'card' THEN e.amount ELSE 0 END) as card_total
             FROM daily_operating_expenses e
             LEFT JOIN expense_types et ON e.expense_type_id = et.id
             WHERE e.store_id = $1 AND e.entry_date BETWEEN $2 AND $3
             GROUP BY et.expense_type_name
             ORDER BY total_amount DESC`,
            [storeId, start_date, end_date]
        );

        const totalExpenses = result.rows.reduce((sum, row) => sum + parseFloat(row.total_amount || 0), 0);

        res.json({
            period: { start_date, end_date },
            total_expenses: totalExpenses,
            categories: result.rows.map(row => ({
                category: row.category || 'Uncategorized',
                count: parseInt(row.count || 0),
                total: parseFloat(row.total_amount || 0),
                average: parseFloat(row.avg_amount || 0),
                min: parseFloat(row.min_amount || 0),
                max: parseFloat(row.max_amount || 0),
                percentage: totalExpenses > 0 ? ((parseFloat(row.total_amount || 0) / totalExpenses) * 100).toFixed(2) : 0,
                payment_methods: {
                    cash: parseFloat(row.cash_total || 0),
                    bank: parseFloat(row.bank_total || 0),
                    card: parseFloat(row.card_total || 0)
                }
            }))
        });
    } catch (error) {
        console.error('Expense breakdown error:', error);
        res.status(500).json({ error: 'Failed to generate expense breakdown' });
    }
});

/**
 * Vendor Payment History
 * GET /api/reports/store/:storeId/vendor-payments?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&vendor_id=UUID
 */
router.get('/store/:storeId/vendor-payments', canAccessStore, async (req, res) => {
    try {
        const { start_date, end_date, vendor_id } = req.query;
        const storeId = req.params.storeId;

        let sql = `
            SELECT 
                pi.*,
                v.name as vendor_name,
                CASE 
                    WHEN pi.status = 'paid' THEN pi.payment_date
                    ELSE pi.due_date
                END as transaction_date
            FROM purchase_invoices pi
            JOIN vendors v ON pi.vendor_id = v.id
            WHERE pi.store_id = $1
        `;
        const params = [storeId];
        let paramCount = 1;

        if (start_date) {
            paramCount++;
            sql += ` AND (
                (pi.status = 'paid' AND pi.payment_date >= $${paramCount}) OR
                (pi.status = 'pending' AND pi.due_date >= $${paramCount})
            )`;
            params.push(start_date);
        }

        if (end_date) {
            paramCount++;
            sql += ` AND (
                (pi.status = 'paid' AND pi.payment_date <= $${paramCount}) OR
                (pi.status = 'pending' AND pi.due_date <= $${paramCount})
            )`;
            params.push(end_date);
        }

        if (vendor_id) {
            paramCount++;
            sql += ` AND pi.vendor_id = $${paramCount}`;
            params.push(vendor_id);
        }

        sql += ` ORDER BY transaction_date DESC, v.name`;

        const result = await query(sql, params);

        // Group by vendor
        const vendorSummary = {};
        result.rows.forEach(invoice => {
            const vendorId = invoice.vendor_id;
            if (!vendorSummary[vendorId]) {
                vendorSummary[vendorId] = {
                    vendor_id: vendorId,
                    vendor_name: invoice.vendor_name,
                    total_invoices: 0,
                    total_amount: 0,
                    paid_amount: 0,
                    pending_amount: 0,
                    invoices: []
                };
            }

            vendorSummary[vendorId].total_invoices++;
            vendorSummary[vendorId].total_amount += parseFloat(invoice.amount || 0);
            
            if (invoice.status === 'paid') {
                vendorSummary[vendorId].paid_amount += parseFloat(invoice.amount || 0);
            } else {
                vendorSummary[vendorId].pending_amount += parseFloat(invoice.amount || 0);
            }

            vendorSummary[vendorId].invoices.push({
                id: invoice.id,
                invoice_number: invoice.invoice_number,
                amount: parseFloat(invoice.amount || 0),
                status: invoice.status,
                purchase_date: invoice.purchase_date,
                due_date: invoice.due_date,
                payment_date: invoice.payment_date,
                payment_method: invoice.payment_method
            });
        });

        res.json({
            period: { start_date, end_date },
            vendors: Object.values(vendorSummary).map(vendor => ({
                ...vendor,
                total_amount: parseFloat(vendor.total_amount.toFixed(2)),
                paid_amount: parseFloat(vendor.paid_amount.toFixed(2)),
                pending_amount: parseFloat(vendor.pending_amount.toFixed(2))
            }))
        });
    } catch (error) {
        console.error('Vendor payment history error:', error);
        res.status(500).json({ error: 'Failed to generate vendor payment history' });
    }
});

// Duplicate endpoint removed - cash-flow-detailed is now handled above at line 185

/**
 * Daily Business Report
 * GET /api/reports/store/:storeId/daily-business?date=YYYY-MM-DD
 */
router.get('/store/:storeId/daily-business', canAccessStore, async (req, res) => {
    try {
        const { date } = req.query;
        const storeId = req.params.storeId;

        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }

        // Revenue
        const revenueResult = await query(
            `SELECT * FROM daily_revenue 
             WHERE store_id = $1 AND entry_date = $2`,
            [storeId, date]
        );

        // Expenses
        const expensesResult = await query(
            `SELECT e.*, et.expense_type_name
             FROM daily_operating_expenses e
             LEFT JOIN expense_types et ON e.expense_type_id = et.id
             WHERE e.store_id = $1 AND e.entry_date = $2
             ORDER BY e.created_at`,
            [storeId, date]
        );

        // Invoices (purchases)
        const invoicesResult = await query(
            `SELECT pi.*, v.name as vendor_name
             FROM purchase_invoices pi
             LEFT JOIN vendors v ON pi.vendor_id = v.id
             WHERE pi.store_id = $1 AND pi.purchase_date = $2
             ORDER BY pi.created_at`,
            [storeId, date]
        );

        // Payments made
        const paymentsResult = await query(
            `SELECT pi.*, v.name as vendor_name
             FROM purchase_invoices pi
             LEFT JOIN vendors v ON pi.vendor_id = v.id
             WHERE pi.store_id = $1 AND pi.payment_date = $2 AND pi.status = 'paid'
             ORDER BY pi.payment_date`,
            [storeId, date]
        );

        // Cash transactions
        const cashTransactionsResult = await query(
            `SELECT * FROM cash_transactions
             WHERE store_id = $1 AND transaction_date = $2
             ORDER BY created_at`,
            [storeId, date]
        );

        // Cash on hand
        const cashBalanceResult = await query(
            `SELECT current_balance FROM cash_on_hand WHERE store_id = $1`,
            [storeId]
        );

        const revenue = revenueResult.rows[0] || null;
        // Use calculated_business_cash when available, otherwise calculate using proper formula
        let totalRevenue = 0;
        if (revenue) {
            if (revenue.calculated_business_cash && parseFloat(revenue.calculated_business_cash) > 0) {
                totalRevenue = parseFloat(revenue.calculated_business_cash);
            } else {
                totalRevenue = (
                    parseFloat(revenue.total_cash || 0) +
                    parseFloat(revenue.business_credit_card || 0) -
                    parseFloat(revenue.credit_card_transaction_fees || 0) +
                    parseFloat(revenue.other_cash_expense || 0)
                );
            }
        }

        const totalExpenses = expensesResult.rows.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
        const totalPurchases = invoicesResult.rows.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
        const totalPayments = paymentsResult.rows.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

        res.json({
            date,
            revenue: {
                data: revenue,
                total: totalRevenue,
                breakdown: {
                    cash: parseFloat(revenue?.total_cash || 0),
                    credit_card: parseFloat(revenue?.business_credit_card || 0),
                    online: parseFloat(revenue?.online_net || 0),
                    instant_pay: parseFloat(revenue?.instant_pay || 0)
                }
            },
            expenses: {
                total: totalExpenses,
                count: expensesResult.rows.length,
                items: expensesResult.rows.map(e => ({
                    id: e.id,
                    type: e.expense_type_name || 'Uncategorized',
                    amount: parseFloat(e.amount || 0),
                    payment_method: e.payment_method,
                    notes: e.notes
                }))
            },
            purchases: {
                total: totalPurchases,
                count: invoicesResult.rows.length,
                items: invoicesResult.rows.map(i => ({
                    id: i.id,
                    vendor: i.vendor_name || 'N/A',
                    invoice_number: i.invoice_number,
                    amount: parseFloat(i.amount || 0),
                    status: i.status,
                    payment_option: i.payment_option
                }))
            },
            payments: {
                total: totalPayments,
                count: paymentsResult.rows.length,
                items: paymentsResult.rows.map(p => ({
                    id: p.id,
                    vendor: p.vendor_name || 'N/A',
                    invoice_number: p.invoice_number,
                    amount: parseFloat(p.amount || 0),
                    payment_method: p.payment_method
                }))
            },
            cash_transactions: cashTransactionsResult.rows.map(ct => ({
                type: ct.transaction_type,
                amount: parseFloat(ct.amount || 0),
                description: ct.description,
                balance_after: parseFloat(ct.balance_after || 0)
            })),
            cash_on_hand: parseFloat(cashBalanceResult.rows[0]?.current_balance || 0),
            net_income: totalRevenue - totalExpenses - totalPurchases
        });
    } catch (error) {
        console.error('Daily business report error:', error);
        res.status(500).json({ error: 'Failed to generate daily business report' });
    }
});

/**
 * Monthly Business Report
 * GET /api/reports/store/:storeId/monthly-business?year=YYYY&month=MM
 */
router.get('/store/:storeId/monthly-business', canAccessStore, async (req, res) => {
    try {
        const { year, month } = req.query;
        const storeId = req.params.storeId;

        if (!year || !month) {
            return res.status(400).json({ error: 'Year and month are required' });
        }

        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

        // Check which columns exist
        const columnCheck = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'daily_revenue' 
            AND column_name IN ('calculated_business_cash', 'store_closed')
        `);
        const existingColumns = columnCheck.rows.map(r => r.column_name);
        const hasCalculatedBusinessCash = existingColumns.includes('calculated_business_cash');
        const hasStoreClosed = existingColumns.includes('store_closed');

        // Revenue totals - Use calculated_business_cash when available
        let revenueQuery;
        const storeClosedFilter = hasStoreClosed ? 'AND (store_closed IS NULL OR store_closed = false)' : '';
        
        if (hasCalculatedBusinessCash) {
            revenueQuery = `
                SELECT 
                    COALESCE(SUM(
                        CASE 
                            WHEN calculated_business_cash IS NOT NULL AND calculated_business_cash > 0 
                            THEN calculated_business_cash
                            ELSE (
                                COALESCE(total_cash, 0) + 
                                COALESCE(business_credit_card, 0) - 
                                COALESCE(credit_card_transaction_fees, 0) + 
                                COALESCE(other_cash_expense, 0)
                            )
                        END
                    ), 0) as total_revenue,
                    SUM(total_cash) as total_cash,
                    SUM(business_credit_card) as total_credit_card,
                    SUM(online_net) as total_online,
                    SUM(instant_pay) as total_instant,
                    COUNT(*) as days_with_revenue
                 FROM daily_revenue
                 WHERE store_id = $1 AND entry_date BETWEEN $2 AND $3
                 ${storeClosedFilter}
            `;
        } else {
            revenueQuery = `
                SELECT 
                    COALESCE(SUM(
                        COALESCE(total_cash, 0) + 
                        COALESCE(business_credit_card, 0) - 
                        COALESCE(credit_card_transaction_fees, 0) + 
                        COALESCE(other_cash_expense, 0)
                    ), 0) as total_revenue,
                    SUM(total_cash) as total_cash,
                    SUM(business_credit_card) as total_credit_card,
                    SUM(online_net) as total_online,
                    SUM(instant_pay) as total_instant,
                    COUNT(*) as days_with_revenue
                 FROM daily_revenue
                 WHERE store_id = $1 AND entry_date BETWEEN $2 AND $3
                 ${storeClosedFilter}
            `;
        }

        const revenueResult = await query(revenueQuery, [storeId, startDate, endDate]);

        // Expense totals
        const expensesResult = await query(
            `SELECT 
                SUM(amount) as total_expenses,
                COUNT(*) as expense_count,
                COUNT(DISTINCT expense_type_id) as unique_categories
             FROM daily_operating_expenses
             WHERE store_id = $1 AND entry_date BETWEEN $2 AND $3`,
            [storeId, startDate, endDate]
        );

        // Purchase totals
        const purchasesResult = await query(
            `SELECT 
                SUM(amount) as total_purchases,
                COUNT(*) as purchase_count,
                COUNT(DISTINCT vendor_id) as unique_vendors
             FROM purchase_invoices
             WHERE store_id = $1 AND purchase_date BETWEEN $2 AND $3
             AND payment_option != 'credit_memo'`,
            [storeId, startDate, endDate]
        );

        // Payment totals
        const paymentsResult = await query(
            `SELECT 
                SUM(amount) as total_payments,
                COUNT(*) as payment_count
             FROM purchase_invoices
             WHERE store_id = $1 AND payment_date BETWEEN $2 AND $3
             AND status = 'paid'`,
            [storeId, startDate, endDate]
        );

        // Daily averages
        const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
        const revenue = revenueResult.rows[0];
        const expenses = expensesResult.rows[0];
        const purchases = purchasesResult.rows[0];
        const payments = paymentsResult.rows[0];

        const totalRevenue = parseFloat(revenue?.total_revenue || 0);
        const totalExpenses = parseFloat(expenses?.total_expenses || 0);
        const totalPurchases = parseFloat(purchases?.total_purchases || 0);
        const totalPayments = parseFloat(payments?.total_payments || 0);
        const netIncome = totalRevenue - totalExpenses - totalPurchases;

        res.json({
            period: { year, month, start_date: startDate, end_date: endDate },
            revenue: {
                total: totalRevenue,
                daily_average: totalRevenue / daysInMonth,
                breakdown: {
                    cash: parseFloat(revenue?.total_cash || 0),
                    credit_card: parseFloat(revenue?.total_credit_card || 0),
                    online: parseFloat(revenue?.total_online || 0),
                    instant_pay: parseFloat(revenue?.total_instant || 0)
                },
                days_with_revenue: parseInt(revenue?.days_with_revenue || 0)
            },
            expenses: {
                total: totalExpenses,
                daily_average: totalExpenses / daysInMonth,
                count: parseInt(expenses?.expense_count || 0),
                unique_categories: parseInt(expenses?.unique_categories || 0)
            },
            purchases: {
                total: totalPurchases,
                daily_average: totalPurchases / daysInMonth,
                count: parseInt(purchases?.purchase_count || 0),
                unique_vendors: parseInt(purchases?.unique_vendors || 0)
            },
            payments: {
                total: totalPayments,
                count: parseInt(payments?.payment_count || 0)
            },
            net_income: netIncome,
            days_in_month: daysInMonth
        });
    } catch (error) {
        console.error('Monthly business report error:', error);
        res.status(500).json({ error: 'Failed to generate monthly business report' });
    }
});

/**
 * Lottery Sales Report
 * GET /api/reports/store/:storeId/lottery-sales?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
router.get('/store/:storeId/lottery-sales', canAccessStore, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const storeId = req.params.storeId;

        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }

        const lotteryResult = await query(
            `SELECT 
                entry_date,
                total_lottery_cash,
                daily_lottery_cash,
                lottery_commission,
                pa_lottery_due,
                fulton_bank_lottery_deposit,
                fulton_bank_balance
             FROM daily_lottery
             WHERE store_id = $1 AND entry_date BETWEEN $2 AND $3
             ORDER BY entry_date`,
            [storeId, start_date, end_date]
        );

        const totals = lotteryResult.rows.reduce((acc, row) => {
            acc.total_cash += parseFloat(row.total_lottery_cash || 0);
            acc.daily_cash += parseFloat(row.daily_lottery_cash || 0);
            acc.commission += parseFloat(row.lottery_commission || 0);
            acc.due += parseFloat(row.pa_lottery_due || 0);
            acc.deposits += parseFloat(row.fulton_bank_lottery_deposit || 0);
            return acc;
        }, {
            total_cash: 0,
            daily_cash: 0,
            commission: 0,
            due: 0,
            deposits: 0
        });

        res.json({
            period: { start_date, end_date },
            totals,
            daily_breakdown: lotteryResult.rows.map(row => ({
                date: row.entry_date,
                total_lottery_cash: parseFloat(row.total_lottery_cash || 0),
                daily_lottery_cash: parseFloat(row.daily_lottery_cash || 0),
                commission: parseFloat(row.lottery_commission || 0),
                due: parseFloat(row.pa_lottery_due || 0),
                deposit: parseFloat(row.fulton_bank_lottery_deposit || 0),
                bank_balance: parseFloat(row.fulton_bank_balance || 0)
            }))
        });
    } catch (error) {
        console.error('Lottery sales report error:', error);
        res.status(500).json({ error: 'Failed to generate lottery sales report' });
    }
});

/**
 * Deposit Report
 * GET /api/reports/store/:storeId/deposits?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
router.get('/store/:storeId/deposits', canAccessStore, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const storeId = req.params.storeId;

        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }

        // Bank deposits from payments
        const bankDepositsResult = await query(
            `SELECT 
                payment_date,
                SUM(amount) as total_deposit,
                COUNT(*) as deposit_count,
                payment_method
             FROM purchase_invoices
             WHERE store_id = $1 
             AND payment_date BETWEEN $2 AND $3
             AND status = 'paid'
             AND payment_method IN ('bank', 'check')
             GROUP BY payment_date, payment_method
             ORDER BY payment_date`,
            [storeId, start_date, end_date]
        );

        // Cash deposits (from revenue)
        const cashDepositsResult = await query(
            `SELECT 
                entry_date,
                total_cash,
                business_credit_card
             FROM daily_revenue
             WHERE store_id = $1 AND entry_date BETWEEN $2 AND $3
             ORDER BY entry_date`,
            [storeId, start_date, end_date]
        );

        // Lottery deposits
        const lotteryDepositsResult = await query(
            `SELECT 
                entry_date,
                fulton_bank_lottery_deposit
             FROM daily_lottery
             WHERE store_id = $1 AND entry_date BETWEEN $2 AND $3
             AND fulton_bank_lottery_deposit > 0
             ORDER BY entry_date`,
            [storeId, start_date, end_date]
        );

        const totalBankDeposits = bankDepositsResult.rows.reduce((sum, row) => sum + parseFloat(row.total_deposit || 0), 0);
        const totalCashRevenue = cashDepositsResult.rows.reduce((sum, row) => sum + parseFloat(row.total_cash || 0), 0);
        const totalLotteryDeposits = lotteryDepositsResult.rows.reduce((sum, row) => sum + parseFloat(row.fulton_bank_lottery_deposit || 0), 0);

        res.json({
            period: { start_date, end_date },
            summary: {
                total_bank_deposits: totalBankDeposits,
                total_cash_revenue: totalCashRevenue,
                total_lottery_deposits: totalLotteryDeposits,
                grand_total: totalBankDeposits + totalCashRevenue + totalLotteryDeposits
            },
            bank_deposits: bankDepositsResult.rows.map(row => ({
                date: row.payment_date,
                amount: parseFloat(row.total_deposit || 0),
                count: parseInt(row.deposit_count || 0),
                method: row.payment_method
            })),
            cash_revenue: cashDepositsResult.rows.map(row => ({
                date: row.entry_date,
                cash: parseFloat(row.total_cash || 0),
                credit_card: parseFloat(row.business_credit_card || 0)
            })),
            lottery_deposits: lotteryDepositsResult.rows.map(row => ({
                date: row.entry_date,
                amount: parseFloat(row.fulton_bank_lottery_deposit || 0)
            }))
        });
    } catch (error) {
        console.error('Deposit report error:', error);
        res.status(500).json({ error: 'Failed to generate deposit report' });
    }
});

/**
 * Payroll Report
 * GET /api/reports/store/:storeId/payroll?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
router.get('/store/:storeId/payroll', canAccessStore, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const storeId = req.params.storeId;

        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }

        const payrollResult = await query(
            `SELECT 
                pr.*,
                u.first_name,
                u.last_name,
                u.email,
                epc.pay_frequency,
                epc.pay_type
             FROM payroll_runs pr
             JOIN employee_payroll_config epc ON epc.id = pr.employee_payroll_config_id
             JOIN users u ON u.id = epc.user_id
             WHERE pr.store_id = $1 
             AND pr.payroll_date BETWEEN $2 AND $3
             ORDER BY pr.payroll_date DESC, u.last_name, u.first_name`,
            [storeId, start_date, end_date]
        );

        const totals = payrollResult.rows.reduce((acc, row) => {
            acc.total_gross_pay += parseFloat(row.gross_pay || 0);
            acc.total_hours += parseFloat(row.hours_worked || 0);
            acc.total_time_off += parseFloat(row.time_off_hours || 0);
            acc.employee_count = new Set([...acc.employee_ids, row.user_id]).size;
            acc.employee_ids.add(row.user_id);
            return acc;
        }, {
            total_gross_pay: 0,
            total_hours: 0,
            total_time_off: 0,
            employee_count: 0,
            employee_ids: new Set()
        });

        res.json({
            period: { start_date, end_date },
            summary: {
                total_gross_pay: totals.total_gross_pay,
                total_hours: totals.total_hours,
                total_time_off_hours: totals.total_time_off,
                employee_count: totals.employee_count,
                payroll_runs: payrollResult.rows.length
            },
            payroll_runs: payrollResult.rows.map(row => ({
                id: row.id,
                employee_name: `${row.first_name} ${row.last_name}`,
                email: row.email,
                payroll_date: row.payroll_date,
                pay_period: `${row.from_date} to ${row.to_date}`,
                hours_worked: parseFloat(row.hours_worked || 0),
                time_off_hours: parseFloat(row.time_off_hours || 0),
                gross_pay: parseFloat(row.gross_pay || 0),
                pay_rate: parseFloat(row.pay_rate || 0),
                pay_type: row.pay_type,
                unit: row.unit,
                check_number: row.check_number,
                bank: row.bank
            }))
        });
    } catch (error) {
        console.error('Payroll report error:', error);
        res.status(500).json({ error: 'Failed to generate payroll report' });
    }
});

/**
 * Export report as CSV/Excel/PDF
 * GET /api/reports/store/:storeId/export?report_type=profit-loss&format=csv&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
router.get('/store/:storeId/export', canAccessStore, async (req, res) => {
    try {
        const { report_type, format, start_date, end_date, ...otherParams } = req.query;
        const storeId = req.params.storeId;

        if (!report_type || !format) {
            return res.status(400).json({ error: 'Report type and format are required' });
        }

        // Get the report data based on type
        let reportUrl = '';
        switch (report_type) {
            case 'profit-loss':
                reportUrl = `/api/reports/store/${storeId}/profit-loss`;
                break;
            case 'cash-flow':
                reportUrl = `/api/reports/store/${storeId}/cash-flow-detailed`;
                break;
            case 'expense-breakdown':
                reportUrl = `/api/reports/store/${storeId}/expense-breakdown`;
                break;
            case 'vendor-payments':
                reportUrl = `/api/reports/store/${storeId}/vendor-payments`;
                break;
            case 'daily-business':
                reportUrl = `/api/reports/store/${storeId}/daily-business`;
                break;
            case 'monthly-business':
                reportUrl = `/api/reports/store/${storeId}/monthly-business`;
                break;
            case 'lottery-sales':
                reportUrl = `/api/reports/store/${storeId}/lottery-sales`;
                break;
            case 'deposits':
                reportUrl = `/api/reports/store/${storeId}/deposits`;
                break;
            case 'payroll':
                reportUrl = `/api/reports/store/${storeId}/payroll`;
                break;
            default:
                return res.status(400).json({ error: 'Invalid report type' });
        }

        // For now, return the report data in the requested format
        // The frontend will handle the actual export
        const ReportExportService = require('../services/reportExportService');
        
        // Fetch the report data (simplified - in production, you'd call the actual report endpoint)
        res.json({
            message: 'Export functionality - use the report endpoint to get data and format on frontend',
            report_type,
            format,
            endpoint: reportUrl
        });
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export report' });
    }
});

/**
 * Sales Trends Report
 * GET /api/reports/store/:storeId/sales-trends?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
router.get('/store/:storeId/sales-trends', canAccessStore, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const storeId = req.params.storeId;

        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }

        // Check which columns exist
        const columnCheck = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'daily_revenue' 
            AND column_name IN ('calculated_business_cash', 'store_closed')
        `);
        const existingColumns = columnCheck.rows.map(r => r.column_name);
        const hasCalculatedBusinessCash = existingColumns.includes('calculated_business_cash');
        const hasStoreClosed = existingColumns.includes('store_closed');

        // Daily revenue trends
        let dailyTrendsQuery;
        const storeClosedFilter = hasStoreClosed ? 'AND (store_closed IS NULL OR store_closed = false)' : '';
        
        if (hasCalculatedBusinessCash) {
            dailyTrendsQuery = `
                SELECT 
                    entry_date,
                    COALESCE(
                        CASE 
                            WHEN calculated_business_cash IS NOT NULL AND calculated_business_cash > 0 
                            THEN calculated_business_cash
                            ELSE (
                                COALESCE(total_cash, 0) + 
                                COALESCE(business_credit_card, 0) - 
                                COALESCE(credit_card_transaction_fees, 0) + 
                                COALESCE(other_cash_expense, 0)
                            )
                        END,
                        0
                    ) as daily_revenue,
                    COALESCE(total_cash, 0) as cash,
                    COALESCE(business_credit_card, 0) as credit_card,
                    COALESCE(online_net, 0) as online
                 FROM daily_revenue
                 WHERE store_id = $1 AND entry_date BETWEEN $2 AND $3
                 ${storeClosedFilter}
                 ORDER BY entry_date
            `;
        } else {
            dailyTrendsQuery = `
                SELECT 
                    entry_date,
                    COALESCE(
                        COALESCE(total_cash, 0) + 
                        COALESCE(business_credit_card, 0) - 
                        COALESCE(credit_card_transaction_fees, 0) + 
                        COALESCE(other_cash_expense, 0),
                        0
                    ) as daily_revenue,
                    COALESCE(total_cash, 0) as cash,
                    COALESCE(business_credit_card, 0) as credit_card,
                    COALESCE(online_net, 0) as online
                 FROM daily_revenue
                 WHERE store_id = $1 AND entry_date BETWEEN $2 AND $3
                 ${storeClosedFilter}
                 ORDER BY entry_date
            `;
        }

        const dailyTrendsResult = await query(dailyTrendsQuery, [storeId, start_date, end_date]);

        // Weekly aggregates
        let weeklyTrendsQuery;
        if (hasCalculatedBusinessCash) {
            weeklyTrendsQuery = `
                SELECT 
                    DATE_TRUNC('week', entry_date) as week_start,
                    COUNT(*) as days_count,
                    COALESCE(SUM(
                        CASE 
                            WHEN calculated_business_cash IS NOT NULL AND calculated_business_cash > 0 
                            THEN calculated_business_cash
                            ELSE (
                                COALESCE(total_cash, 0) + 
                                COALESCE(business_credit_card, 0) - 
                                COALESCE(credit_card_transaction_fees, 0) + 
                                COALESCE(other_cash_expense, 0)
                            )
                        END
                    ), 0) as weekly_revenue,
                    COALESCE(AVG(
                        CASE 
                            WHEN calculated_business_cash IS NOT NULL AND calculated_business_cash > 0 
                            THEN calculated_business_cash
                            ELSE (
                                COALESCE(total_cash, 0) + 
                                COALESCE(business_credit_card, 0) - 
                                COALESCE(credit_card_transaction_fees, 0) + 
                                COALESCE(other_cash_expense, 0)
                            )
                        END
                    ), 0) as avg_daily_revenue
                 FROM daily_revenue
                 WHERE store_id = $1 AND entry_date BETWEEN $2 AND $3
                 ${storeClosedFilter}
                 GROUP BY DATE_TRUNC('week', entry_date)
                 ORDER BY week_start
            `;
        } else {
            weeklyTrendsQuery = `
                SELECT 
                    DATE_TRUNC('week', entry_date) as week_start,
                    COUNT(*) as days_count,
                    COALESCE(SUM(
                        COALESCE(total_cash, 0) + 
                        COALESCE(business_credit_card, 0) - 
                        COALESCE(credit_card_transaction_fees, 0) + 
                        COALESCE(other_cash_expense, 0)
                    ), 0) as weekly_revenue,
                    COALESCE(AVG(
                        COALESCE(total_cash, 0) + 
                        COALESCE(business_credit_card, 0) - 
                        COALESCE(credit_card_transaction_fees, 0) + 
                        COALESCE(other_cash_expense, 0)
                    ), 0) as avg_daily_revenue
                 FROM daily_revenue
                 WHERE store_id = $1 AND entry_date BETWEEN $2 AND $3
                 ${storeClosedFilter}
                 GROUP BY DATE_TRUNC('week', entry_date)
                 ORDER BY week_start
            `;
        }

        const weeklyTrendsResult = await query(weeklyTrendsQuery, [storeId, start_date, end_date]);

        // Monthly aggregates
        let monthlyTrendsQuery;
        if (hasCalculatedBusinessCash) {
            monthlyTrendsQuery = `
                SELECT 
                    DATE_TRUNC('month', entry_date) as month_start,
                    COUNT(*) as days_count,
                    COALESCE(SUM(
                        CASE 
                            WHEN calculated_business_cash IS NOT NULL AND calculated_business_cash > 0 
                            THEN calculated_business_cash
                            ELSE (
                                COALESCE(total_cash, 0) + 
                                COALESCE(business_credit_card, 0) - 
                                COALESCE(credit_card_transaction_fees, 0) + 
                                COALESCE(other_cash_expense, 0)
                            )
                        END
                    ), 0) as monthly_revenue,
                    COALESCE(AVG(
                        CASE 
                            WHEN calculated_business_cash IS NOT NULL AND calculated_business_cash > 0 
                            THEN calculated_business_cash
                            ELSE (
                                COALESCE(total_cash, 0) + 
                                COALESCE(business_credit_card, 0) - 
                                COALESCE(credit_card_transaction_fees, 0) + 
                                COALESCE(other_cash_expense, 0)
                            )
                        END
                    ), 0) as avg_daily_revenue
                 FROM daily_revenue
                 WHERE store_id = $1 AND entry_date BETWEEN $2 AND $3
                 ${storeClosedFilter}
                 GROUP BY DATE_TRUNC('month', entry_date)
                 ORDER BY month_start
            `;
        } else {
            monthlyTrendsQuery = `
                SELECT 
                    DATE_TRUNC('month', entry_date) as month_start,
                    COUNT(*) as days_count,
                    COALESCE(SUM(
                        COALESCE(total_cash, 0) + 
                        COALESCE(business_credit_card, 0) - 
                        COALESCE(credit_card_transaction_fees, 0) + 
                        COALESCE(other_cash_expense, 0)
                    ), 0) as monthly_revenue,
                    COALESCE(AVG(
                        COALESCE(total_cash, 0) + 
                        COALESCE(business_credit_card, 0) - 
                        COALESCE(credit_card_transaction_fees, 0) + 
                        COALESCE(other_cash_expense, 0)
                    ), 0) as avg_daily_revenue
                 FROM daily_revenue
                 WHERE store_id = $1 AND entry_date BETWEEN $2 AND $3
                 ${storeClosedFilter}
                 GROUP BY DATE_TRUNC('month', entry_date)
                 ORDER BY month_start
            `;
        }

        const monthlyTrendsResult = await query(monthlyTrendsQuery, [storeId, start_date, end_date]);

        // Calculate statistics
        const dailyRevenues = dailyTrendsResult.rows.map(r => parseFloat(r.daily_revenue || 0));
        const totalRevenue = dailyRevenues.reduce((sum, val) => sum + val, 0);
        const avgDailyRevenue = dailyRevenues.length > 0 ? totalRevenue / dailyRevenues.length : 0;
        const maxDailyRevenue = dailyRevenues.length > 0 ? Math.max(...dailyRevenues) : 0;
        const minDailyRevenue = dailyRevenues.length > 0 ? Math.min(...dailyRevenues) : 0;

        res.json({
            period: { start_date, end_date },
            summary: {
                total_revenue: totalRevenue,
                avg_daily_revenue: avgDailyRevenue,
                max_daily_revenue: maxDailyRevenue,
                min_daily_revenue: minDailyRevenue,
                days_with_data: dailyTrendsResult.rows.length
            },
            daily_trends: dailyTrendsResult.rows.map(row => ({
                date: row.entry_date,
                revenue: parseFloat(row.daily_revenue || 0),
                cash: parseFloat(row.cash || 0),
                credit_card: parseFloat(row.credit_card || 0),
                online: parseFloat(row.online || 0)
            })),
            weekly_trends: weeklyTrendsResult.rows.map(row => ({
                week_start: row.week_start,
                days_count: parseInt(row.days_count || 0),
                weekly_revenue: parseFloat(row.weekly_revenue || 0),
                avg_daily_revenue: parseFloat(row.avg_daily_revenue || 0)
            })),
            monthly_trends: monthlyTrendsResult.rows.map(row => ({
                month_start: row.month_start,
                days_count: parseInt(row.days_count || 0),
                monthly_revenue: parseFloat(row.monthly_revenue || 0),
                avg_daily_revenue: parseFloat(row.avg_daily_revenue || 0)
            }))
        });
    } catch (error) {
        console.error('Sales trends error:', error);
        res.status(500).json({ error: 'Failed to generate sales trends report' });
    }
});

/**
 * Inventory Data Report
 * GET /api/reports/store/:storeId/inventory?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
router.get('/store/:storeId/inventory', canAccessStore, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const storeId = req.params.storeId;

        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }

        // Check if inventory_movements table exists
        const tableCheck = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name = 'inventory_movements'
        `);
        const hasInventoryTable = tableCheck.rows.length > 0;

        if (!hasInventoryTable) {
            return res.json({
                summary: {
                    total_products: 0,
                    total_movements: 0,
                    total_received: 0,
                    total_sold: 0,
                    total_adjusted: 0,
                    total_transferred: 0
                },
                products: [],
                movements: [],
                vape_tax_products: []
            });
        }

        // Get inventory movements
        const movementsResult = await query(`
            SELECT 
                im.*,
                p.product_id,
                p.full_product_name,
                p.category,
                p.brand,
                p.vape_tax,
                p.last_vape_tax_paid_date,
                pi.invoice_number,
                pi.purchase_date as invoice_date
            FROM inventory_movements im
            LEFT JOIN products p ON im.product_id = p.id
            LEFT JOIN purchase_invoices pi ON im.invoice_id = pi.id
            WHERE im.store_id = $1 
            AND im.movement_date >= $2::date 
            AND im.movement_date <= $3::date
            AND p.deleted_at IS NULL
            ORDER BY im.movement_date DESC, p.full_product_name
        `, [storeId, start_date, end_date]);

        // Get product summary
        const productsResult = await query(`
            SELECT 
                p.id,
                p.product_id,
                p.full_product_name,
                p.category,
                p.brand,
                p.vape_tax,
                p.last_vape_tax_paid_date,
                COALESCE(SUM(CASE WHEN im.movement_type = 'received' THEN im.quantity ELSE 0 END), 0) as total_received,
                COALESCE(SUM(CASE WHEN im.movement_type = 'sold' THEN im.quantity ELSE 0 END), 0) as total_sold,
                COALESCE(SUM(CASE WHEN im.movement_type = 'adjusted' THEN im.quantity ELSE 0 END), 0) as total_adjusted,
                COALESCE(SUM(CASE WHEN im.movement_type = 'transferred' THEN im.quantity ELSE 0 END), 0) as total_transferred
            FROM products p
            LEFT JOIN inventory_movements im ON p.id = im.product_id 
                AND im.movement_date >= $2::date 
                AND im.movement_date <= $3::date
            WHERE p.store_id = $1 
            AND p.deleted_at IS NULL
            GROUP BY p.id, p.product_id, p.full_product_name, p.category, p.brand, p.vape_tax, p.last_vape_tax_paid_date
            HAVING COALESCE(SUM(im.quantity), 0) != 0
            ORDER BY p.full_product_name
        `, [storeId, start_date, end_date]);

        // Get vape tax products
        const vapeTaxCheck = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'products' 
            AND column_name = 'vape_tax'
        `);
        const hasVapeTax = vapeTaxCheck.rows.length > 0;

        let vapeTaxProducts = [];
        if (hasVapeTax) {
            const vapeTaxResult = await query(`
                SELECT 
                    p.id,
                    p.product_id,
                    p.full_product_name,
                    p.category,
                    p.brand,
                    p.vape_tax,
                    p.last_vape_tax_paid_date,
                    COUNT(im.id) as times_purchased_with_tax
                FROM products p
                LEFT JOIN inventory_movements im ON p.id = im.product_id
                LEFT JOIN purchase_invoices pi ON im.invoice_id = pi.id
                LEFT JOIN LATERAL (
                    SELECT invoice_items::jsonb as items
                    FROM purchase_invoices 
                    WHERE id = pi.id
                ) items ON true
                WHERE p.store_id = $1 
                AND p.vape_tax = true
                AND p.deleted_at IS NULL
                AND (
                    items.items IS NULL OR
                    EXISTS (
                        SELECT 1 
                        FROM jsonb_array_elements(items.items) item
                        WHERE (item->>'product_id')::uuid = p.id 
                        AND (item->>'vape_tax_paid')::boolean = true
                    )
                )
                GROUP BY p.id, p.product_id, p.full_product_name, p.category, p.brand, p.vape_tax, p.last_vape_tax_paid_date
                ORDER BY p.last_vape_tax_paid_date DESC NULLS LAST, p.full_product_name
            `, [storeId]);
            vapeTaxProducts = vapeTaxResult.rows;
        }

        // Calculate summary
        const summary = {
            total_products: productsResult.rows.length,
            total_movements: movementsResult.rows.length,
            total_received: movementsResult.rows
                .filter(m => m.movement_type === 'received')
                .reduce((sum, m) => sum + (parseInt(m.quantity) || 0), 0),
            total_sold: movementsResult.rows
                .filter(m => m.movement_type === 'sold')
                .reduce((sum, m) => sum + (parseInt(m.quantity) || 0), 0),
            total_adjusted: movementsResult.rows
                .filter(m => m.movement_type === 'adjusted')
                .reduce((sum, m) => sum + (parseInt(m.quantity) || 0), 0),
            total_transferred: movementsResult.rows
                .filter(m => m.movement_type === 'transferred')
                .reduce((sum, m) => sum + (parseInt(m.quantity) || 0), 0),
            vape_tax_products_count: vapeTaxProducts.length
        };

        res.json({
            summary,
            products: productsResult.rows,
            movements: movementsResult.rows,
            vape_tax_products: vapeTaxProducts
        });
    } catch (error) {
        console.error('Inventory report error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate inventory report' });
    }
});

module.exports = router;

