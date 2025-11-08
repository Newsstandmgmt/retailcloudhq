-- State Lottery Configuration Schema
-- This allows the system to support lottery systems from any state

-- State Lottery Configurations
CREATE TABLE IF NOT EXISTS state_lottery_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state_code VARCHAR(2) NOT NULL UNIQUE, -- e.g., 'PA', 'NY', 'CA'
    state_name VARCHAR(100) NOT NULL, -- e.g., 'Pennsylvania', 'New York', 'California'
    
    -- Lottery System Information
    lottery_name VARCHAR(255) NOT NULL, -- e.g., 'PA Lottery', 'New York Lottery'
    official_email_domain VARCHAR(255), -- e.g., 'palottery.com', 'nylottery.org'
    retailer_id_label VARCHAR(100) DEFAULT 'Retailer Number', -- How this state labels retailer IDs
    
    -- CSV Format Configuration (JSONB for flexibility)
    csv_format JSONB DEFAULT '{}'::jsonb, -- Stores state-specific CSV column mappings and formats
    
    -- Report Types Supported
    supports_daily_reports BOOLEAN DEFAULT true,
    supports_weekly_reports BOOLEAN DEFAULT true,
    supports_settlement_reports BOOLEAN DEFAULT true,
    supports_13week_average BOOLEAN DEFAULT false,
    
    -- Email Processing Configuration
    email_parser_type VARCHAR(50) DEFAULT 'combined_settlement', -- 'combined_settlement', 'standard', 'custom'
    date_format VARCHAR(50) DEFAULT 'MM/DD/YYYY', -- Date format used in reports
    
    -- Column Name Variations (JSONB for flexible mapping)
    column_mappings JSONB DEFAULT '{}'::jsonb, -- Maps standard fields to state-specific column names
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_state_lottery_configs_state ON state_lottery_configs(state_code);
CREATE INDEX IF NOT EXISTS idx_state_lottery_configs_active ON state_lottery_configs(is_active);

-- Trigger for updated_at
CREATE TRIGGER update_state_lottery_configs_updated_at BEFORE UPDATE ON state_lottery_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add state_code to stores table if it doesn't exist (use existing state field or add new)
-- We'll use the existing 'state' field in stores table, but ensure it's properly used

-- Update stores table to ensure state field is properly indexed
CREATE INDEX IF NOT EXISTS idx_stores_state ON stores(state);

-- Insert default PA Lottery configuration (for backward compatibility)
INSERT INTO state_lottery_configs (
    state_code, state_name, lottery_name, official_email_domain,
    retailer_id_label, csv_format, column_mappings
) VALUES (
    'PA', 'Pennsylvania', 'PA Lottery', 'palottery.com',
    'Retailer Number',
    '{"format": "combined_settlement", "header_row": 1, "data_start_row": 4}'::jsonb,
    '{
        "retailer_number": "Retailer Number",
        "location_name": "Location Name",
        "balance_forward": "Balance Forward",
        "draw_sales": "Draw Sales",
        "draw_cancels": "Draw Cancels",
        "draw_promos": "Draw Promos",
        "draw_comm": ["Draw  Comm", "Draw Comm"],
        "draw_pays": "Draw Pays",
        "vch_iss": "VCH ISS",
        "vch_rd": "VCH RD",
        "webcash_iss": "WebCash ISS",
        "draw_adj": "Draw Adj",
        "draw_due": "Draw Due",
        "scratch_offs_sales": ["Scratch- Offs Sales", "Scratch-Offs Sales"],
        "scratch_offs_rtrns": ["Scratch- Offs Rtrns", "Scratch-Offs Rtrns"],
        "scratch_offs_comm": ["Scratch- Offs Comm", "Scratch-Offs Comm"],
        "scratch_offs_prms": ["Scratch- Offs Prms", "Scratch-Offs Prms"],
        "scratch_offs_pays": ["Scratch- Offs Pays", "Scratch-Offs Pays"],
        "scratch_offs_adj": ["Scratch- Offs Adj", "Scratch-Offs Adj"],
        "scratch_offs_due": ["Scratch- Offs Due", "Scratch-Offs Due"],
        "card_trans": "Card Trans",
        "gift_cards": "Gift Cards",
        "prepaid": ["Prepaid ", "Prepaid"],
        "total_due": "Total Due"
    }'::jsonb
) ON CONFLICT (state_code) DO NOTHING;

