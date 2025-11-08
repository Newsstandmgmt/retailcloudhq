-- Lottery Analytics Tables
-- These tables store structured analytics data for lottery reports

-- Sales / PaidOut Report Table
CREATE TABLE IF NOT EXISTS lottery_sales_paidout_report (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    
    -- Sales Data
    sales_online DECIMAL(10, 2) DEFAULT 0,        -- Draw/Online lottery sales
    sales_instant DECIMAL(10, 2) DEFAULT 0,         -- Scratch-off/Instant sales
    total_sales DECIMAL(10, 2) DEFAULT 0,           -- Total sales (online + instant)
    
    -- PaidOut Data
    paidouts_online DECIMAL(10, 2) DEFAULT 0,       -- Online/Draw paidouts
    paidouts_instant DECIMAL(10, 2) DEFAULT 0,     -- Instant/Scratch-off paidouts
    total_paidout DECIMAL(10, 2) DEFAULT 0,        -- Total paidouts
    
    -- Commission
    commission DECIMAL(10, 2) DEFAULT 0,           -- Total commission earned
    
    -- Metadata
    employee_id UUID REFERENCES users(id),          -- Employee who processed (optional)
    source VARCHAR(50) DEFAULT 'manual',           -- 'manual', 'google_sheets', 'gmail', 'api'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    UNIQUE(store_id, report_date, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_lottery_sales_paidout_store_date ON lottery_sales_paidout_report(store_id, report_date);
CREATE INDEX IF NOT EXISTS idx_lottery_sales_paidout_employee ON lottery_sales_paidout_report(employee_id);

-- Lottery Daily Report Table
CREATE TABLE IF NOT EXISTS lottery_daily_report (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    
    -- Payment Methods
    debit_credit_card DECIMAL(10, 2) DEFAULT 0,     -- Card sales/transactions
    
    -- Sale Types
    credits_sale DECIMAL(10, 2) DEFAULT 0,          -- Credit sales
    debits_sale DECIMAL(10, 2) DEFAULT 0,            -- Debit sales
    
    -- Balances
    online_balance DECIMAL(10, 2) DEFAULT 0,         -- Draw/Online lottery balance
    instant_balance DECIMAL(10, 2) DEFAULT 0,       -- Instant/Scratch-off balance
    total_balance DECIMAL(10, 2) DEFAULT 0,         -- Total balance
    
    -- Cash Tracking
    register_cash DECIMAL(10, 2) DEFAULT 0,         -- Cash in register
    over_short DECIMAL(10, 2) DEFAULT 0,            -- Over/Short amount
    
    -- Metadata
    employee_id UUID REFERENCES users(id),          -- Employee who processed (optional)
    source VARCHAR(50) DEFAULT 'manual',           -- 'manual', 'google_sheets', 'gmail', 'api'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    UNIQUE(store_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_lottery_daily_report_store_date ON lottery_daily_report(store_id, report_date);
CREATE INDEX IF NOT EXISTS idx_lottery_daily_report_employee ON lottery_daily_report(employee_id);

-- Function to calculate totals for reports
CREATE OR REPLACE FUNCTION calculate_lottery_totals(
    p_store_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_employee_id UUID DEFAULT NULL
)
RETURNS TABLE (
    total_sales_online DECIMAL,
    total_sales_instant DECIMAL,
    total_sales DECIMAL,
    total_paidouts_online DECIMAL,
    total_paidouts_instant DECIMAL,
    total_paidout DECIMAL,
    total_commission DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(sales_online), 0) as total_sales_online,
        COALESCE(SUM(sales_instant), 0) as total_sales_instant,
        COALESCE(SUM(total_sales), 0) as total_sales,
        COALESCE(SUM(paidouts_online), 0) as total_paidouts_online,
        COALESCE(SUM(paidouts_instant), 0) as total_paidouts_instant,
        COALESCE(SUM(total_paidout), 0) as total_paidout,
        COALESCE(SUM(commission), 0) as total_commission
    FROM lottery_sales_paidout_report
    WHERE store_id = p_store_id
        AND report_date BETWEEN p_start_date AND p_end_date
        AND (p_employee_id IS NULL OR employee_id = p_employee_id);
END;
$$ LANGUAGE plpgsql;

