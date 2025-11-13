const { query } = require('../config/database');

class DailyRevenue {
    constructor(data) {
        Object.assign(this, data);
    }
    
    // Create or update daily revenue entry
    static async upsert(storeId, entryDate, revenueData) {
        // Helper function to sanitize numeric values (convert empty strings to null/0)
        const sanitizeNumeric = (value, defaultValue = 0) => {
            if (value === null || value === undefined) return defaultValue;
            if (value === '' || value === ' ') return defaultValue;
            const parsed = parseFloat(value);
            return isNaN(parsed) ? defaultValue : parsed;
        };
        
        const sanitizeOptionalNumeric = (value) => {
            if (value === null || value === undefined) return null;
            if (value === '' || value === ' ') return null;
            const parsed = parseFloat(value);
            return isNaN(parsed) ? null : parsed;
        };
        
        const {
            total_cash,
            cash_adjustment,
            business_credit_card,
            credit_card_transaction_fees,
            online_sales,
            online_net,
            total_instant,
            total_instant_adjustment,
            instant_pay,
            lottery_credit_card,
            sales_tax_amount,
            newspaper_sold,
            elias_newspaper,
            sam_newspaper,
            customer_tab,
            other_cash_expense,
            cigarette_cartons_sold,
            weekly_lottery_commission,
            thirteen_week_average,
            weekly_lottery_due,
            square_gross_card_sales,
            square_card_fees,
            square_net_card_sales,
            square_synced_at,
            entered_by,
            notes,
            store_closed = false
        } = revenueData;
        
        // If store is closed, set all numeric fields to 0
        const isStoreClosed = store_closed === true || store_closed === 'true';
        
        // Sanitize all numeric fields - if store is closed, set all to 0
        const sanitizedTotalCash = isStoreClosed ? 0 : sanitizeNumeric(total_cash, 0);
        const sanitizedCashAdjustment = isStoreClosed ? 0 : sanitizeNumeric(cash_adjustment, 0);
        const sanitizedBusinessCreditCard = isStoreClosed ? 0 : sanitizeNumeric(business_credit_card, 0);
        const sanitizedCreditCardFees = isStoreClosed ? 0 : sanitizeNumeric(credit_card_transaction_fees, 0);
        const sanitizedOnlineSales = isStoreClosed ? 0 : sanitizeNumeric(online_sales, 0);
        const sanitizedOnlineNet = isStoreClosed ? 0 : sanitizeNumeric(online_net, 0);
        const sanitizedTotalInstant = isStoreClosed ? 0 : sanitizeNumeric(total_instant, 0);
        const sanitizedInstantAdjustment = isStoreClosed ? 0 : sanitizeNumeric(total_instant_adjustment, 0);
        const sanitizedInstantPay = isStoreClosed ? 0 : sanitizeNumeric(instant_pay, 0);
        const sanitizedLotteryCreditCard = isStoreClosed ? 0 : sanitizeNumeric(lottery_credit_card, 0);
        const sanitizedSalesTax = isStoreClosed ? 0 : sanitizeNumeric(sales_tax_amount, 0);
        const sanitizedNewspaperSold = isStoreClosed ? 0 : sanitizeNumeric(newspaper_sold, 0);
        const sanitizedEliasNewspaper = isStoreClosed ? 0 : sanitizeNumeric(elias_newspaper, 0);
        const sanitizedSamNewspaper = isStoreClosed ? 0 : sanitizeNumeric(sam_newspaper, 0);
        const sanitizedCustomerTab = isStoreClosed ? 0 : sanitizeNumeric(customer_tab, 0);
        const sanitizedOtherCashExpense = isStoreClosed ? 0 : sanitizeNumeric(other_cash_expense, 0);
        const sanitizedWeeklyLotteryCommission = isStoreClosed ? null : sanitizeOptionalNumeric(weekly_lottery_commission);
        const sanitizedThirteenWeekAverage = isStoreClosed ? null : sanitizeOptionalNumeric(thirteen_week_average);
        const sanitizedWeeklyLotteryDue = isStoreClosed ? null : sanitizeOptionalNumeric(weekly_lottery_due);
        const sanitizedSquareGross = isStoreClosed ? 0 : sanitizeNumeric(square_gross_card_sales, 0);
        const sanitizedSquareFees = isStoreClosed ? 0 : sanitizeNumeric(square_card_fees, 0);
        const sanitizedSquareNet = isStoreClosed ? 0 : sanitizeNumeric(square_net_card_sales, 0);
        const sanitizedSquareSyncedAt = isStoreClosed ? null : (square_synced_at ? new Date(square_synced_at) : null);
        const sanitizedCigaretteCartonsSold = isStoreClosed ? 0 : sanitizeNumeric(cigarette_cartons_sold, 0);
        
        // Build update clause - only update fields that are explicitly provided in revenueData
        // This allows POS/CC data to update only credit card fields without overwriting other data
        const updateFields = [];
        const numericFields = [
            'total_cash', 'cash_adjustment', 'business_credit_card', 'credit_card_transaction_fees',
            'online_sales', 'online_net', 'total_instant', 'total_instant_adjustment', 'instant_pay',
            'lottery_credit_card', 'sales_tax_amount', 'newspaper_sold', 'elias_newspaper',
            'sam_newspaper', 'customer_tab', 'other_cash_expense', 'square_gross_card_sales',
            'square_card_fees', 'square_net_card_sales',
            'calculated_business_cash', 'calculated_lottery_owed',
            'weekly_lottery_commission', 'thirteen_week_average', 'weekly_lottery_due'
        ];
        // Note: bank_deposit_amount, bank_deposit_bank_id, and is_lottery_bank_deposit 
        // are handled separately below to avoid duplicate assignments
        
        // Handle bank deposit fields separately (they're not numeric)
        const bankDepositBankId = revenueData.bank_deposit_bank_id || null;
        const isLotteryBankDeposit = revenueData.is_lottery_bank_deposit || false;
        
        // Only update fields that were explicitly provided (check if key exists in revenueData)
        if (revenueData.hasOwnProperty('notes')) {
            updateFields.push(`notes = EXCLUDED.notes`);
        }
        
        // Handle bank deposit fields in update
        if (revenueData.hasOwnProperty('bank_deposit_bank_id')) {
            updateFields.push(`bank_deposit_bank_id = EXCLUDED.bank_deposit_bank_id`);
        }
        if (revenueData.hasOwnProperty('bank_deposit_amount')) {
            updateFields.push(`bank_deposit_amount = EXCLUDED.bank_deposit_amount`);
        }
        if (revenueData.hasOwnProperty('is_lottery_bank_deposit')) {
            updateFields.push(`is_lottery_bank_deposit = EXCLUDED.is_lottery_bank_deposit`);
        }
        if (revenueData.hasOwnProperty('square_synced_at')) {
            updateFields.push(`square_synced_at = EXCLUDED.square_synced_at`);
        }
        
        // Handle store_closed field
        if (revenueData.hasOwnProperty('store_closed')) {
            updateFields.push(`store_closed = EXCLUDED.store_closed`);
        }
        
        // Check which optional columns exist
        const columnCheck = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'daily_revenue' 
            AND column_name IN ('customer_tab', 'calculated_business_cash', 'calculated_lottery_owed', 'cigarette_cartons_sold')
        `);
        const hasCustomerTab = columnCheck.rows.some(r => r.column_name === 'customer_tab');
        const hasCalculatedBusinessCash = columnCheck.rows.some(r => r.column_name === 'calculated_business_cash');
        const hasCalculatedLotteryOwed = columnCheck.rows.some(r => r.column_name === 'calculated_lottery_owed');
        const hasCigaretteCartonsSold = columnCheck.rows.some(r => r.column_name === 'cigarette_cartons_sold');

        if (hasCigaretteCartonsSold) {
            numericFields.push('cigarette_cartons_sold');
        }

        numericFields.forEach(field => {
            if (revenueData.hasOwnProperty(field)) {
                updateFields.push(`${field} = EXCLUDED.${field}`);
            }
        });

        // If no fields to update, just update timestamp
        if (updateFields.length === 0) {
            updateFields.push('updated_at = CURRENT_TIMESTAMP');
        } else {
            updateFields.push('updated_at = CURRENT_TIMESTAMP');
        }
        
        const calculatedBusinessCash = sanitizeOptionalNumeric(revenueData.calculated_business_cash);
        const calculatedLotteryOwed = sanitizeOptionalNumeric(revenueData.calculated_lottery_owed);
        
        if (hasCustomerTab) {
            // Build dynamic INSERT based on which calculated columns exist
            const insertFields = [
                'store_id', 'entry_date', 'total_cash', 'cash_adjustment', 'business_credit_card',
                'credit_card_transaction_fees', 'online_sales', 'online_net', 'total_instant',
                'total_instant_adjustment', 'instant_pay', 'lottery_credit_card', 'sales_tax_amount',
                'newspaper_sold', 'elias_newspaper', 'sam_newspaper', 'customer_tab', 'other_cash_expense',
                'square_gross_card_sales', 'square_card_fees', 'square_net_card_sales'
            ];
            const insertValues = [
                storeId, entryDate, sanitizedTotalCash, sanitizedCashAdjustment, sanitizedBusinessCreditCard,
                sanitizedCreditCardFees, sanitizedOnlineSales, sanitizedOnlineNet, sanitizedTotalInstant,
                sanitizedInstantAdjustment, sanitizedInstantPay, sanitizedLotteryCreditCard, sanitizedSalesTax,
                sanitizedNewspaperSold, sanitizedEliasNewspaper, sanitizedSamNewspaper, sanitizedCustomerTab,
                sanitizedOtherCashExpense, sanitizedSquareGross, sanitizedSquareFees, sanitizedSquareNet
            ];
            
            if (hasCalculatedBusinessCash) {
                insertFields.push('calculated_business_cash');
                insertValues.push(calculatedBusinessCash);
            }
            if (hasCalculatedLotteryOwed) {
                insertFields.push('calculated_lottery_owed');
                insertValues.push(calculatedLotteryOwed);
            }

            if (hasCigaretteCartonsSold) {
                insertFields.push('cigarette_cartons_sold');
                insertValues.push(sanitizedCigaretteCartonsSold);
            }
            
            // Check if bank deposit columns exist
            const bankDepositCheck = await query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'daily_revenue' 
                AND column_name IN ('bank_deposit_bank_id', 'bank_deposit_amount', 'is_lottery_bank_deposit')
            `);
            const hasBankDepositBankId = bankDepositCheck.rows.some(r => r.column_name === 'bank_deposit_bank_id');
            const hasBankDepositAmount = bankDepositCheck.rows.some(r => r.column_name === 'bank_deposit_amount');
            const hasIsLotteryBankDeposit = bankDepositCheck.rows.some(r => r.column_name === 'is_lottery_bank_deposit');
            
            if (hasBankDepositBankId) {
                insertFields.push('bank_deposit_bank_id');
                insertValues.push(bankDepositBankId);
            }
            if (hasBankDepositAmount) {
                insertFields.push('bank_deposit_amount');
                insertValues.push(sanitizeNumeric(revenueData.bank_deposit_amount, 0));
            }
            if (hasIsLotteryBankDeposit) {
                insertFields.push('is_lottery_bank_deposit');
                insertValues.push(isLotteryBankDeposit);
            }
            
            // Check if weekly lottery columns exist
            const weeklyLotteryCheck = await query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'daily_revenue' 
                AND column_name IN ('weekly_lottery_commission', 'thirteen_week_average', 'weekly_lottery_due')
            `);
            const hasWeeklyLotteryCommission = weeklyLotteryCheck.rows.some(r => r.column_name === 'weekly_lottery_commission');
            const hasThirteenWeekAverage = weeklyLotteryCheck.rows.some(r => r.column_name === 'thirteen_week_average');
            const hasWeeklyLotteryDue = weeklyLotteryCheck.rows.some(r => r.column_name === 'weekly_lottery_due');
            
            if (hasWeeklyLotteryCommission && revenueData.hasOwnProperty('weekly_lottery_commission')) {
                insertFields.push('weekly_lottery_commission');
                insertValues.push(sanitizedWeeklyLotteryCommission);
            }
            if (hasThirteenWeekAverage && revenueData.hasOwnProperty('thirteen_week_average')) {
                insertFields.push('thirteen_week_average');
                insertValues.push(sanitizedThirteenWeekAverage);
            }
            if (hasWeeklyLotteryDue && revenueData.hasOwnProperty('weekly_lottery_due')) {
                insertFields.push('weekly_lottery_due');
                insertValues.push(sanitizedWeeklyLotteryDue);
            }
            
            const squareSyncedCheck = await query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'daily_revenue' 
                AND column_name = 'square_synced_at'
            `);
            const hasSquareSyncedAt = squareSyncedCheck.rows.some(r => r.column_name === 'square_synced_at');
            
            if (hasSquareSyncedAt) {
                insertFields.push('square_synced_at');
                insertValues.push(sanitizedSquareSyncedAt);
            }
            
            // Check if store_closed column exists
            const storeClosedCheck = await query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'daily_revenue' 
                AND column_name = 'store_closed'
            `);
            const hasStoreClosed = storeClosedCheck.rows.some(r => r.column_name === 'store_closed');
            
            if (hasStoreClosed) {
                insertFields.push('store_closed');
                insertValues.push(isStoreClosed);
            }
            
            insertFields.push('entered_by', 'notes');
            insertValues.push(entered_by || null, notes || null);
            
            const placeholders = insertValues.map((_, i) => `$${i + 1}`).join(', ');
            
            const result = await query(
                `INSERT INTO daily_revenue (${insertFields.join(', ')})
                VALUES (${placeholders})
                ON CONFLICT (store_id, entry_date)
                DO UPDATE SET ${updateFields.join(', ')}
                RETURNING *`,
                insertValues
            );
            return result.rows[0];
        } else {
            // Fallback to original query if columns don't exist yet
            const result = await query(
                `INSERT INTO daily_revenue (
                    store_id, entry_date, total_cash, cash_adjustment, business_credit_card,
                    credit_card_transaction_fees, online_sales, online_net, total_instant,
                    total_instant_adjustment, instant_pay, lottery_credit_card, sales_tax_amount,
                    newspaper_sold, elias_newspaper, sam_newspaper, other_cash_expense,
                    entered_by, notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                ON CONFLICT (store_id, entry_date)
                DO UPDATE SET ${updateFields.join(', ')}
                RETURNING *`,
                [
                    storeId, entryDate, sanitizedTotalCash, sanitizedCashAdjustment, sanitizedBusinessCreditCard,
                    sanitizedCreditCardFees, sanitizedOnlineSales, sanitizedOnlineNet, sanitizedTotalInstant,
                    sanitizedInstantAdjustment, sanitizedInstantPay, sanitizedLotteryCreditCard, sanitizedSalesTax,
                    sanitizedNewspaperSold, sanitizedEliasNewspaper, sanitizedSamNewspaper, sanitizedOtherCashExpense,
                    entered_by || null, notes || null
                ]
            );
            return result.rows[0];
        }
    }
    
    // Get revenue entry for specific date
    static async findByDate(storeId, entryDate) {
        const result = await query(
            'SELECT * FROM daily_revenue WHERE store_id = $1 AND entry_date = $2',
            [storeId, entryDate]
        );
        return result.rows[0] || null;
    }
    
    // Get revenue entries for date range
    static async findByDateRange(storeId, startDate, endDate) {
         // Ensure dates are in YYYY-MM-DD format and use inclusive range
         // PostgreSQL BETWEEN is inclusive, but we want to make sure we include the full end date
         const result = await query(
            `SELECT 
                dr.*,
                CASE
                    WHEN dr.calculated_business_cash IS NOT NULL AND dr.calculated_business_cash > 0
                         THEN dr.calculated_business_cash
                     ELSE (
                         COALESCE(dr.total_cash, 0) +
                         COALESCE(dr.business_credit_card, 0) +
                         GREATEST(COALESCE(dr.other_cash_expense, 0), 0) -
                         COALESCE(dr.online_net, 0) -
                         COALESCE(dr.total_instant, 0) +
                         COALESCE(dr.total_instant_adjustment, 0) +
                         COALESCE(dr.instant_pay, 0) +
                         COALESCE(dr.lottery_credit_card, 0)
                     )
                END AS daily_business_total
            FROM daily_revenue dr
            WHERE dr.store_id = $1 
              AND dr.entry_date >= $2::date 
              AND dr.entry_date <= $3::date
            ORDER BY dr.entry_date ASC`,
            [storeId, startDate, endDate]
        );
        return result.rows;
    }
    
    // Get all revenue entries for a store
    static async findAllByStore(storeId, limit = 100) {
        const result = await query(
            'SELECT * FROM daily_revenue WHERE store_id = $1 ORDER BY entry_date DESC LIMIT $2',
            [storeId, limit]
        );
        return result.rows;
    }
    
    // Calculate totals for a date range
    static async calculateTotals(storeId, startDate, endDate) {
        const columnCheck = await query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'daily_revenue'
            AND column_name = 'cigarette_cartons_sold'
        `);
        const hasCigaretteCartonsSold = columnCheck.rows.length > 0;

        const selectFields = [
            'SUM(total_cash) as total_cash_sum',
            'SUM(cash_adjustment) as cash_adjustment_sum',
            'SUM(business_credit_card) as business_credit_card_sum',
            'SUM(credit_card_transaction_fees) as credit_card_transaction_fees_sum',
            'SUM(online_sales) as online_sales_sum',
            'SUM(online_net) as online_net_sum',
            'SUM(total_instant) as total_instant_sum',
            'SUM(total_instant_adjustment) as total_instant_adjustment_sum',
            'SUM(instant_pay) as instant_pay_sum',
            'SUM(lottery_credit_card) as lottery_credit_card_sum',
            'SUM(sales_tax_amount) as sales_tax_amount_sum',
            'SUM(newspaper_sold) as newspaper_sold_sum',
            'SUM(elias_newspaper) as elias_newspaper_sum',
            'SUM(sam_newspaper) as sam_newspaper_sum',
            'SUM(other_cash_expense) as other_cash_expense_sum'
        ];

        if (hasCigaretteCartonsSold) {
            selectFields.push('SUM(cigarette_cartons_sold) as cigarette_cartons_sold_sum');
        }

        const result = await query(
            `SELECT ${selectFields.join(',\n                ')}
            FROM daily_revenue
            WHERE store_id = $1 AND entry_date BETWEEN $2 AND $3`,
            [storeId, startDate, endDate]
        );
        return result.rows[0];
    }
}

module.exports = DailyRevenue;

