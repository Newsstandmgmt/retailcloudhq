-- Store Templates and Feature Management Schema
-- This allows super admins to assign templates to stores, which control which features are enabled

-- Store templates table (e.g., "Lottery Management", "Gas Station", "Basic Retail")
CREATE TABLE IF NOT EXISTS store_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Available features that can be enabled/disabled
CREATE TABLE IF NOT EXISTS store_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feature_key VARCHAR(50) NOT NULL UNIQUE, -- e.g., 'lottery', 'gas_station', 'payroll', 'general_ledger'
    feature_name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50), -- e.g., 'revenue', 'operations', 'accounting'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Template-Feature mapping (which features are enabled for each template)
CREATE TABLE IF NOT EXISTS store_template_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES store_templates(id) ON DELETE CASCADE,
    feature_id UUID NOT NULL REFERENCES store_features(id) ON DELETE CASCADE,
    UNIQUE(template_id, feature_id)
);

-- Update stores table to reference template
-- First, we'll add the template_id column (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stores' AND column_name = 'template_id'
    ) THEN
        ALTER TABLE stores ADD COLUMN template_id UUID REFERENCES store_templates(id);
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stores_template_id ON stores(template_id);
CREATE INDEX IF NOT EXISTS idx_template_features_template ON store_template_features(template_id);
CREATE INDEX IF NOT EXISTS idx_template_features_feature ON store_template_features(feature_id);

-- Trigger for updated_at
CREATE TRIGGER update_store_templates_updated_at BEFORE UPDATE ON store_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default templates
INSERT INTO store_templates (name, description) VALUES
    ('Basic Retail', 'Standard retail store with core features'),
    ('Lottery Management', 'Retail store with lottery sales and management'),
    ('Gas Station', 'Gas station with fuel management (future enhancement)'),
    ('Convenience Store', 'Full-featured convenience store with lottery and gas')
ON CONFLICT (name) DO NOTHING;

-- Insert available features
INSERT INTO store_features (feature_key, feature_name, description, category) VALUES
    ('revenue', 'Daily Revenue', 'Track daily revenue from sales', 'revenue'),
    ('expenses', 'Operating Expenses', 'Track daily operating expenses', 'operations'),
    ('purchase_payments', 'Purchase & Payments', 'Manage vendor invoices and payments', 'operations'),
    ('payroll', 'Payroll', 'Employee payroll management', 'operations'),
    ('lottery', 'Lottery Management', 'Lottery sales tracking and commission management', 'revenue'),
    ('gas_station', 'Gas Station', 'Fuel sales and pump management', 'revenue'),
    ('general_ledger', 'General Ledger', 'Accounting and general ledger', 'accounting'),
    ('reports', 'Reports & Analytics', 'Financial reports and analytics', 'accounting'),
    ('recurring_expenses', 'Recurring Expenses', 'Automated recurring expense management', 'operations'),
    ('cash_on_hand', 'Cash on Hand', 'Cash tracking and management', 'accounting'),
    ('notifications', 'Notifications', 'System notifications and alerts', 'operations'),
    ('multi_store', 'Multi-Store Dashboard', 'View and manage multiple stores', 'operations')
ON CONFLICT (feature_key) DO NOTHING;

-- Assign features to templates
-- Basic Retail: Core features only
INSERT INTO store_template_features (template_id, feature_id)
SELECT 
    st.id as template_id,
    sf.id as feature_id
FROM store_templates st
CROSS JOIN store_features sf
WHERE st.name = 'Basic Retail'
  AND sf.feature_key IN ('revenue', 'expenses', 'purchase_payments', 'payroll', 'general_ledger', 'reports', 'cash_on_hand', 'notifications')
ON CONFLICT DO NOTHING;

-- Lottery Management: All basic features + lottery
INSERT INTO store_template_features (template_id, feature_id)
SELECT 
    st.id as template_id,
    sf.id as feature_id
FROM store_templates st
CROSS JOIN store_features sf
WHERE st.name = 'Lottery Management'
  AND sf.feature_key IN ('revenue', 'expenses', 'purchase_payments', 'payroll', 'lottery', 'general_ledger', 'reports', 'recurring_expenses', 'cash_on_hand', 'notifications')
ON CONFLICT DO NOTHING;

-- Gas Station: All basic features + gas (for future)
INSERT INTO store_template_features (template_id, feature_id)
SELECT 
    st.id as template_id,
    sf.id as feature_id
FROM store_templates st
CROSS JOIN store_features sf
WHERE st.name = 'Gas Station'
  AND sf.feature_key IN ('revenue', 'expenses', 'purchase_payments', 'payroll', 'gas_station', 'general_ledger', 'reports', 'recurring_expenses', 'cash_on_hand', 'notifications')
ON CONFLICT DO NOTHING;

-- Convenience Store: All features
INSERT INTO store_template_features (template_id, feature_id)
SELECT 
    st.id as template_id,
    sf.id as feature_id
FROM store_templates st
CROSS JOIN store_features sf
WHERE st.name = 'Convenience Store'
  AND sf.feature_key IN ('revenue', 'expenses', 'purchase_payments', 'payroll', 'lottery', 'gas_station', 'general_ledger', 'reports', 'recurring_expenses', 'cash_on_hand', 'notifications', 'multi_store')
ON CONFLICT DO NOTHING;

