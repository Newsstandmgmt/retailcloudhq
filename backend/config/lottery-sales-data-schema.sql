-- Lottery Sales Data Tables
-- These tables store reports received from state lottery systems or manually entered

-- 13 Week Average Report
CREATE TABLE IF NOT EXISTS lottery_13week_average (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    report_date DATE NOT NULL, -- Date of the report
    retailer_number VARCHAR(50),
    location_name VARCHAR(255),
    
    -- 13 Week Average Data
    thirteen_week_average DECIMAL(10, 2) DEFAULT 0,
    total_sales DECIMAL(10, 2) DEFAULT 0,
    total_commissions DECIMAL(10, 2) DEFAULT 0,
    
    -- Additional fields from PA Lottery report
    balance_forward DECIMAL(10, 2) DEFAULT 0,
    draw_sales DECIMAL(10, 2) DEFAULT 0,
    draw_cancels DECIMAL(10, 2) DEFAULT 0,
    draw_promos DECIMAL(10, 2) DEFAULT 0,
    draw_comm DECIMAL(10, 2) DEFAULT 0,
    draw_pays DECIMAL(10, 2) DEFAULT 0,
    vch_iss DECIMAL(10, 2) DEFAULT 0,
    vch_rd DECIMAL(10, 2) DEFAULT 0,
    webcash_iss DECIMAL(10, 2) DEFAULT 0,
    draw_adj DECIMAL(10, 2) DEFAULT 0,
    draw_due DECIMAL(10, 2) DEFAULT 0,
    scratch_offs_sales DECIMAL(10, 2) DEFAULT 0,
    scratch_offs_rtrns DECIMAL(10, 2) DEFAULT 0,
    scratch_offs_comm DECIMAL(10, 2) DEFAULT 0,
    scratch_offs_prms DECIMAL(10, 2) DEFAULT 0,
    scratch_offs_pays DECIMAL(10, 2) DEFAULT 0,
    scratch_offs_adj DECIMAL(10, 2) DEFAULT 0,
    scratch_offs_due DECIMAL(10, 2) DEFAULT 0,
    card_trans DECIMAL(10, 2) DEFAULT 0,
    gift_cards DECIMAL(10, 2) DEFAULT 0,
    prepaid DECIMAL(10, 2) DEFAULT 0,
    total_due DECIMAL(10, 2) DEFAULT 0,
    
    entered_by UUID REFERENCES users(id),
    source VARCHAR(50) DEFAULT 'manual' CHECK (source IN ('manual', 'email', 'portal', 'csv')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_lottery_13week_store_date ON lottery_13week_average(store_id, report_date);

-- Weekly Settlement Report
CREATE TABLE IF NOT EXISTS lottery_weekly_settlement (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    settlement_date DATE NOT NULL, -- End date of the settlement period
    period_start_date DATE NOT NULL, -- Start date of the settlement period
    period_end_date DATE NOT NULL, -- End date of the settlement period
    retailer_number VARCHAR(50),
    location_name VARCHAR(255),
    
    -- Settlement Data
    balance_forward DECIMAL(10, 2) DEFAULT 0,
    total_sales DECIMAL(10, 2) DEFAULT 0,
    total_commissions DECIMAL(10, 2) DEFAULT 0,
    total_adjustments DECIMAL(10, 2) DEFAULT 0,
    total_payments DECIMAL(10, 2) DEFAULT 0,
    balance_due DECIMAL(10, 2) DEFAULT 0,
    
    -- Draw/Online Lottery Settlement
    draw_sales DECIMAL(10, 2) DEFAULT 0,
    draw_cancels DECIMAL(10, 2) DEFAULT 0,
    draw_promos DECIMAL(10, 2) DEFAULT 0,
    draw_comm DECIMAL(10, 2) DEFAULT 0,
    draw_pays DECIMAL(10, 2) DEFAULT 0,
    vch_iss DECIMAL(10, 2) DEFAULT 0,
    vch_rd DECIMAL(10, 2) DEFAULT 0,
    webcash_iss DECIMAL(10, 2) DEFAULT 0,
    draw_adj DECIMAL(10, 2) DEFAULT 0,
    draw_due DECIMAL(10, 2) DEFAULT 0,
    
    -- Scratch-Offs Settlement
    scratch_offs_sales DECIMAL(10, 2) DEFAULT 0,
    scratch_offs_rtrns DECIMAL(10, 2) DEFAULT 0,
    scratch_offs_comm DECIMAL(10, 2) DEFAULT 0,
    scratch_offs_prms DECIMAL(10, 2) DEFAULT 0,
    scratch_offs_pays DECIMAL(10, 2) DEFAULT 0,
    scratch_offs_adj DECIMAL(10, 2) DEFAULT 0,
    scratch_offs_due DECIMAL(10, 2) DEFAULT 0,
    
    -- Other Transactions
    card_trans DECIMAL(10, 2) DEFAULT 0,
    gift_cards DECIMAL(10, 2) DEFAULT 0,
    prepaid DECIMAL(10, 2) DEFAULT 0,
    total_due DECIMAL(10, 2) DEFAULT 0,
    
    -- Reconciliation
    reconciled BOOLEAN DEFAULT false,
    reconciled_at TIMESTAMP,
    reconciled_by UUID REFERENCES users(id),
    reconciliation_notes TEXT,
    
    entered_by UUID REFERENCES users(id),
    source VARCHAR(50) DEFAULT 'manual' CHECK (source IN ('manual', 'email', 'portal', 'csv')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, settlement_date)
);

CREATE INDEX IF NOT EXISTS idx_lottery_settlement_store_date ON lottery_weekly_settlement(store_id, settlement_date);
CREATE INDEX IF NOT EXISTS idx_lottery_settlement_period ON lottery_weekly_settlement(store_id, period_start_date, period_end_date);

-- Triggers for updated_at
CREATE TRIGGER update_lottery_13week_updated_at BEFORE UPDATE ON lottery_13week_average
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lottery_settlement_updated_at BEFORE UPDATE ON lottery_weekly_settlement
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

