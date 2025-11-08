-- Store-Based Subscription and Feature Pricing Schema
-- This replaces admin-based subscriptions with store-based subscriptions
-- Each store has its own subscription based on its template and features

-- Feature pricing table (pricing for each feature)
CREATE TABLE IF NOT EXISTS feature_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feature_key VARCHAR(50) NOT NULL UNIQUE REFERENCES store_features(feature_key) ON DELETE CASCADE,
    price_per_month DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Base subscription pricing (base price per store)
CREATE TABLE IF NOT EXISTS base_subscription_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    base_price_per_month DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store subscriptions (each store has its own subscription)
CREATE TABLE IF NOT EXISTS store_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
    base_price_id UUID REFERENCES base_subscription_pricing(id),
    
    -- Calculated pricing
    base_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    feature_addons_total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_monthly_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    
    -- Billing cycle
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
    start_date DATE NOT NULL,
    next_billing_date DATE NOT NULL,
    
    -- Discounts
    discount_percentage DECIMAL(5, 2) DEFAULT 0.00,
    discount_amount DECIMAL(10, 2) DEFAULT 0.00,
    discount_applied_to_next_billing BOOLEAN DEFAULT false,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
    auto_renew BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store subscription features (track which features are included in pricing)
CREATE TABLE IF NOT EXISTS store_subscription_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_subscription_id UUID NOT NULL REFERENCES store_subscriptions(id) ON DELETE CASCADE,
    feature_key VARCHAR(50) NOT NULL REFERENCES store_features(feature_key) ON DELETE CASCADE,
    feature_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_subscription_id, feature_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_store_subscriptions_store ON store_subscriptions(store_id);
CREATE INDEX IF NOT EXISTS idx_store_subscriptions_status ON store_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_store_subscriptions_next_billing ON store_subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_store_subscription_features_subscription ON store_subscription_features(store_subscription_id);
CREATE INDEX IF NOT EXISTS idx_feature_pricing_feature_key ON feature_pricing(feature_key);

-- Trigger for updated_at
CREATE TRIGGER update_feature_pricing_updated_at BEFORE UPDATE ON feature_pricing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_base_subscription_pricing_updated_at BEFORE UPDATE ON base_subscription_pricing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_subscriptions_updated_at BEFORE UPDATE ON store_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Remove store_type column from stores table (if exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stores' AND column_name = 'store_type'
    ) THEN
        ALTER TABLE stores DROP COLUMN store_type;
    END IF;
END $$;

-- Insert default base subscription pricing
INSERT INTO base_subscription_pricing (name, description, base_price_per_month) VALUES
    ('Standard', 'Base subscription for one store', 29.99)
ON CONFLICT (name) DO NOTHING;

-- Insert default feature pricing (will be managed by super admin)
-- These will be populated from existing store_features table
INSERT INTO feature_pricing (feature_key, price_per_month)
SELECT feature_key, 
    CASE feature_key
        WHEN 'lottery' THEN 19.99
        WHEN 'gas_station' THEN 24.99
        WHEN 'payroll' THEN 14.99
        WHEN 'general_ledger' THEN 9.99
        WHEN 'reports' THEN 4.99
        WHEN 'recurring_expenses' THEN 4.99
        WHEN 'cash_on_hand' THEN 4.99
        WHEN 'notifications' THEN 2.99
        WHEN 'multi_store' THEN 9.99
        ELSE 0.00
    END
FROM store_features
WHERE is_active = true
ON CONFLICT (feature_key) DO NOTHING;

