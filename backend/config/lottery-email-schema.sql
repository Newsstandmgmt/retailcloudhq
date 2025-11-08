-- Email Configuration for Lottery Reports
-- Each store can have multiple email addresses for different report types

CREATE TABLE IF NOT EXISTS lottery_email_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    retailer_number VARCHAR(50), -- PA Lottery retailer number for matching
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('daily', 'weekly', 'settlement', '13week')),
    email_address VARCHAR(255) NOT NULL, -- e.g., store1+lotterydaily@retailmanagement.com
    is_active BOOLEAN DEFAULT true,
    last_processed_at TIMESTAMP,
    last_processed_email_id VARCHAR(255), -- To avoid duplicate processing
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, report_type)
);

CREATE INDEX IF NOT EXISTS idx_lottery_email_configs_store ON lottery_email_configs(store_id);
CREATE INDEX IF NOT EXISTS idx_lottery_email_configs_email ON lottery_email_configs(email_address);
CREATE INDEX IF NOT EXISTS idx_lottery_email_configs_retailer ON lottery_email_configs(retailer_number);

-- Email Processing Log
CREATE TABLE IF NOT EXISTS lottery_email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_config_id UUID NOT NULL REFERENCES lottery_email_configs(id) ON DELETE CASCADE,
    email_id VARCHAR(255) NOT NULL,
    email_subject VARCHAR(500),
    email_from VARCHAR(255),
    received_at TIMESTAMP NOT NULL,
    processed_at TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'error', 'skipped')),
    error_message TEXT,
    records_processed INTEGER DEFAULT 0,
    attachment_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lottery_email_logs_config ON lottery_email_logs(email_config_id);
CREATE INDEX IF NOT EXISTS idx_lottery_email_logs_status ON lottery_email_logs(status);
CREATE INDEX IF NOT EXISTS idx_lottery_email_logs_email_id ON lottery_email_logs(email_id);

-- Trigger for updated_at
CREATE TRIGGER update_lottery_email_configs_updated_at BEFORE UPDATE ON lottery_email_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

