-- Expenses Schema
-- Defines tables for operating expenses management (expense types and daily expenses)

-- ============================================
-- Expense Types
-- ============================================

CREATE TABLE IF NOT EXISTS expense_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    expense_type_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure columns exist on legacy tables
ALTER TABLE expense_types
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_expense_types_store ON expense_types(store_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_types_store_name ON expense_types(store_id, expense_type_name);

DROP TRIGGER IF EXISTS update_expense_types_updated_at ON expense_types;
CREATE TRIGGER update_expense_types_updated_at
    BEFORE UPDATE ON expense_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE expense_types IS 'Store-scoped catalog of operating expense types';
COMMENT ON COLUMN expense_types.expense_type_name IS 'Display name for this operating expense type';

-- ============================================
-- Daily Operating Expenses
-- ============================================

CREATE TABLE IF NOT EXISTS daily_operating_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    expense_type_id UUID REFERENCES expense_types(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    is_recurring BOOLEAN DEFAULT false,
    recurring_frequency VARCHAR(50),
    is_autopay BOOLEAN DEFAULT false,
    payment_method VARCHAR(50) NOT NULL,
    bank_id UUID REFERENCES banks(id) ON DELETE SET NULL,
    bank_account_name VARCHAR(255),
    credit_card_id UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
    is_reimbursable BOOLEAN DEFAULT false,
    reimbursement_to VARCHAR(255),
    reimbursement_status VARCHAR(50) DEFAULT 'none',
    reimbursement_date DATE,
    reimbursement_amount NUMERIC(12, 2),
    reimbursement_payment_method VARCHAR(50),
    reimbursement_check_number VARCHAR(100),
    reimbursement_bank_id UUID REFERENCES banks(id) ON DELETE SET NULL,
    notes TEXT,
    entered_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backfill / ensure all columns exist for legacy databases
ALTER TABLE daily_operating_expenses
    ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS recurring_frequency VARCHAR(50),
    ADD COLUMN IF NOT EXISTS is_autopay BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS bank_id UUID REFERENCES banks(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS credit_card_id UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_reimbursable BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS reimbursement_to VARCHAR(255),
    ADD COLUMN IF NOT EXISTS reimbursement_status VARCHAR(50) DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS reimbursement_date DATE,
    ADD COLUMN IF NOT EXISTS reimbursement_amount NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS reimbursement_payment_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS reimbursement_check_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS reimbursement_bank_id UUID REFERENCES banks(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS entered_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE daily_operating_expenses
    ALTER COLUMN reimbursement_status SET DEFAULT 'none';

CREATE INDEX IF NOT EXISTS idx_daily_operating_expenses_store_date ON daily_operating_expenses(store_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_operating_expenses_store_type ON daily_operating_expenses(store_id, expense_type_id);
CREATE INDEX IF NOT EXISTS idx_daily_operating_expenses_payment_method ON daily_operating_expenses(store_id, payment_method);
CREATE INDEX IF NOT EXISTS idx_daily_operating_expenses_reimbursement_status ON daily_operating_expenses(store_id, reimbursement_status);

DROP TRIGGER IF EXISTS update_daily_operating_expenses_updated_at ON daily_operating_expenses;
CREATE TRIGGER update_daily_operating_expenses_updated_at
    BEFORE UPDATE ON daily_operating_expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE daily_operating_expenses IS 'Daily operating expenses entered by store admins/managers';
COMMENT ON COLUMN daily_operating_expenses.is_recurring IS 'Indicates if this expense recurs automatically';
COMMENT ON COLUMN daily_operating_expenses.is_autopay IS 'Marks whether vendor auto-deducts this expense';
COMMENT ON COLUMN daily_operating_expenses.reimbursement_status IS 'none, pending, reimbursed';

-- ============================================
-- Daily Revenue Bank Deposit Enhancements
-- ============================================

ALTER TABLE daily_revenue
    ADD COLUMN IF NOT EXISTS bank_deposit_bank_id UUID REFERENCES banks(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS bank_deposit_amount NUMERIC(12, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_lottery_bank_deposit BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS store_closed BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_daily_revenue_bank_deposit ON daily_revenue(store_id, entry_date, is_lottery_bank_deposit);

COMMENT ON COLUMN daily_revenue.bank_deposit_bank_id IS 'Bank account used for the cash deposit';
COMMENT ON COLUMN daily_revenue.bank_deposit_amount IS 'Amount transferred from drawer to bank';
COMMENT ON COLUMN daily_revenue.is_lottery_bank_deposit IS 'True if the deposit was made to the lottery bank account';
COMMENT ON COLUMN daily_revenue.store_closed IS 'Flag to indicate the store was closed for the entry date';


