-- Email Monitoring Configuration (using existing email accounts)
-- This replaces the previous email config approach

-- Ensure legacy lottery_email_configs table exists for logs/backwards compatibility
CREATE TABLE IF NOT EXISTS lottery_email_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    retailer_number VARCHAR(50),
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('daily', 'weekly', 'settlement', '13week')),
    email_address VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_processed_at TIMESTAMP,
    last_processed_email_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, report_type)
);

ALTER TABLE lottery_email_configs
    ADD COLUMN IF NOT EXISTS retailer_number VARCHAR(50),
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS last_processed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_processed_email_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_lottery_email_configs_store ON lottery_email_configs(store_id);
CREATE INDEX IF NOT EXISTS idx_lottery_email_configs_email ON lottery_email_configs(email_address);
CREATE INDEX IF NOT EXISTS idx_lottery_email_configs_retailer ON lottery_email_configs(retailer_number);

-- Email Account Connection (stores OAuth tokens for Gmail/other providers)
CREATE TABLE IF NOT EXISTS lottery_email_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'gmail' CHECK (provider IN ('gmail', 'outlook', 'imap')),
    email_address VARCHAR(255) NOT NULL, -- The email address to monitor
    access_token TEXT, -- Encrypted OAuth access token
    refresh_token TEXT, -- Encrypted OAuth refresh token
    token_expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    last_checked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, email_address)
);

CREATE INDEX IF NOT EXISTS idx_lottery_email_accounts_store ON lottery_email_accounts(store_id);
CREATE INDEX IF NOT EXISTS idx_lottery_email_accounts_email ON lottery_email_accounts(email_address);

-- Email Monitoring Rules (which emails to process and how)
CREATE TABLE IF NOT EXISTS lottery_email_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_account_id UUID NOT NULL REFERENCES lottery_email_accounts(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('daily', 'weekly', 'settlement', '13week')),
    to_address VARCHAR(255), -- Specific inbox to monitor (e.g., newsstandmgmt+1daily@gmail.com for Gmail plus addressing)
    subject_contains VARCHAR(255), -- Match emails with subject containing this
    sender_contains VARCHAR(255) DEFAULT 'palottery.com', -- Match emails from PA Lottery
    retailer_number VARCHAR(50), -- For validation
    is_active BOOLEAN DEFAULT true,
    label_id VARCHAR(100), -- Gmail label ID to scope queries
    label_name VARCHAR(255), -- Human readable label name
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lottery_email_rules_account ON lottery_email_rules(email_account_id);
CREATE INDEX IF NOT EXISTS idx_lottery_email_rules_type ON lottery_email_rules(report_type);

ALTER TABLE lottery_email_rules
    ADD COLUMN IF NOT EXISTS label_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS label_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS include_read BOOLEAN DEFAULT false;

-- Update email logs to reference email_account_id instead
ALTER TABLE lottery_email_logs 
    DROP CONSTRAINT IF EXISTS lottery_email_logs_email_config_id_fkey,
    ADD COLUMN IF NOT EXISTS email_account_id UUID REFERENCES lottery_email_accounts(id),
    ADD COLUMN IF NOT EXISTS email_rule_id UUID;

ALTER TABLE lottery_email_logs
    DROP CONSTRAINT IF EXISTS lottery_email_logs_email_rule_id_fkey;

ALTER TABLE lottery_email_logs
    ADD CONSTRAINT lottery_email_logs_email_rule_id_fkey
        FOREIGN KEY (email_rule_id)
        REFERENCES lottery_email_rules(id)
        ON DELETE SET NULL;

ALTER TABLE lottery_daily_reports
    ADD COLUMN IF NOT EXISTS report_type VARCHAR(50) DEFAULT 'daily',
    ADD COLUMN IF NOT EXISTS mapped_values JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE lottery_daily_reports
    SET report_type = 'daily'
    WHERE report_type IS NULL;

UPDATE lottery_daily_reports
    SET mapped_values = '{}'::jsonb
    WHERE mapped_values IS NULL;

CREATE TABLE IF NOT EXISTS lottery_report_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL,
    source_column VARCHAR(255) NOT NULL,
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('daily_revenue', 'lottery_field')),
    target_field VARCHAR(255) NOT NULL,
    data_type VARCHAR(50) DEFAULT 'number',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, report_type, source_column, target_field)
);

CREATE INDEX IF NOT EXISTS idx_lottery_report_mappings_store ON lottery_report_mappings(store_id);
CREATE INDEX IF NOT EXISTS idx_lottery_report_mappings_report_type ON lottery_report_mappings(report_type);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_lottery_email_configs_updated_at ON lottery_email_configs;
CREATE TRIGGER update_lottery_email_configs_updated_at BEFORE UPDATE ON lottery_email_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lottery_email_accounts_updated_at ON lottery_email_accounts;
CREATE TRIGGER update_lottery_email_accounts_updated_at BEFORE UPDATE ON lottery_email_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lottery_email_rules_updated_at ON lottery_email_rules;
CREATE TRIGGER update_lottery_email_rules_updated_at BEFORE UPDATE ON lottery_email_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS update_lottery_report_mappings_updated_at ON lottery_report_mappings;
CREATE TRIGGER update_lottery_report_mappings_updated_at BEFORE UPDATE ON lottery_report_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

