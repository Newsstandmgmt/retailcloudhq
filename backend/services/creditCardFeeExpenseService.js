const { query } = require('../config/database');
const DailyOperatingExpenses = require('../models/DailyOperatingExpenses');

const CREDIT_CARD_FEE_EXPENSE_NAME = 'Credit Card Fees';
const CREDIT_CARD_FEE_NOTES = 'Auto-generated credit card processing fees';

async function ensureCreditCardFeeExpenseType(storeId, userId = null) {
    const existing = await query(
        `SELECT id FROM expense_types
         WHERE store_id = $1 AND LOWER(expense_type_name) = LOWER($2)
         LIMIT 1`,
        [storeId, CREDIT_CARD_FEE_EXPENSE_NAME]
    );

    if (existing.rows.length > 0) {
        return existing.rows[0].id;
    }

    const insert = await query(
        `INSERT INTO expense_types (store_id, expense_type_name, description, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [storeId, CREDIT_CARD_FEE_EXPENSE_NAME, 'Automatically created for daily revenue credit card fees.', userId]
    );

    return insert.rows[0].id;
}

async function syncCreditCardFeeExpense(storeId, entryDate, feeAmount, userId = null) {
    const amount = parseFloat(feeAmount || 0);
    const expenseTypeId = await ensureCreditCardFeeExpenseType(storeId, userId);

    const existing = await query(
        `SELECT id FROM daily_operating_expenses
         WHERE store_id = $1 AND entry_date = $2 AND expense_type_id = $3 AND notes ILIKE $4
         LIMIT 1`,
        [storeId, entryDate, expenseTypeId, `${CREDIT_CARD_FEE_NOTES}%`]
    );

    if (amount <= 0) {
        if (existing.rows.length > 0) {
            await DailyOperatingExpenses.delete(existing.rows[0].id);
        }
        return null;
    }

    if (existing.rows.length > 0) {
        await DailyOperatingExpenses.update(existing.rows[0].id, {
            amount,
            payment_method: 'bank',
            is_autopay: true,
            notes: CREDIT_CARD_FEE_NOTES,
            entered_by: userId
        });
        return existing.rows[0].id;
    }

    const created = await DailyOperatingExpenses.create({
        store_id: storeId,
        entry_date: entryDate,
        expense_type_id: expenseTypeId,
        amount,
        payment_method: 'bank',
        is_autopay: true,
        notes: CREDIT_CARD_FEE_NOTES,
        entered_by: userId
    });

    return created?.id || null;
}

module.exports = {
    CREDIT_CARD_FEE_EXPENSE_NAME,
    CREDIT_CARD_FEE_NOTES,
    ensureCreditCardFeeExpenseType,
    syncCreditCardFeeExpense
};

