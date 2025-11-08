-- Weekly Lottery Tracking Table
-- Similar structure to daily_lottery but for weekly data

CREATE TABLE IF NOT EXISTS weekly_lottery (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL, -- Start date of the week
    
    total_lottery_cash DECIMAL(10, 2) DEFAULT 0,
    weekly_lottery_cash DECIMAL(10, 2) DEFAULT 0,
    lottery_commission DECIMAL(10, 2) DEFAULT 0,
    pa_lottery_due DECIMAL(10, 2) DEFAULT 0,
    
    -- Google Sheets fields (same as daily)
    retailer_number VARCHAR(50),
    location_name VARCHAR(255),
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
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, entry_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weekly_lottery_store_date ON weekly_lottery(store_id, entry_date);

-- Trigger for updated_at
CREATE TRIGGER update_weekly_lottery_updated_at BEFORE UPDATE ON weekly_lottery
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

