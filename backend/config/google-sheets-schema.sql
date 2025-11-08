-- Google Sheets Integration Schema
-- Add this to your database for Google Sheets support

-- Store Google Sheets configuration
CREATE TABLE IF NOT EXISTS store_google_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    
    -- Google Sheets connection info
    spreadsheet_id VARCHAR(255) NOT NULL,
    sheet_name VARCHAR(255) NOT NULL,
    
    -- Authentication (service account JSON stored encrypted or as file path)
    service_account_key TEXT, -- JSON string or file path
    
    -- Sync configuration
    auto_sync_enabled BOOLEAN DEFAULT false,
    sync_frequency VARCHAR(50) DEFAULT 'daily', -- 'hourly', 'daily', 'weekly'
    data_type VARCHAR(50) DEFAULT 'lottery', -- 'lottery', 'revenue', 'cashflow', 'lottery_weekly'
    last_sync_at TIMESTAMP,
    last_sync_status VARCHAR(50), -- 'success', 'failed', 'pending'
    last_sync_error TEXT,
    
    -- Column mapping configuration (JSON)
    column_mapping JSONB, -- Maps Google Sheet columns to database fields
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(store_id, spreadsheet_id, sheet_name)
);

-- Google Sheets sync logs
CREATE TABLE IF NOT EXISTS google_sheets_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    store_google_sheet_id UUID REFERENCES store_google_sheets(id) ON DELETE CASCADE,
    
    sync_type VARCHAR(50) NOT NULL, -- 'lottery', 'revenue', 'cashflow', etc.
    status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'partial'
    records_processed INTEGER DEFAULT 0,
    records_added INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    error_message TEXT,
    
    sync_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sync_completed_at TIMESTAMP,
    
    details JSONB -- Additional sync details
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_store_google_sheets_store_id ON store_google_sheets(store_id);
CREATE INDEX IF NOT EXISTS idx_store_google_sheets_sync_enabled ON store_google_sheets(auto_sync_enabled);
CREATE INDEX IF NOT EXISTS idx_google_sheets_sync_logs_store_id ON google_sheets_sync_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_google_sheets_sync_logs_sync_type ON google_sheets_sync_logs(sync_type);
CREATE INDEX IF NOT EXISTS idx_google_sheets_sync_logs_status ON google_sheets_sync_logs(status);

-- Trigger for updated_at
CREATE TRIGGER update_store_google_sheets_updated_at BEFORE UPDATE ON store_google_sheets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

