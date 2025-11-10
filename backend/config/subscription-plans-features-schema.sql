-- Subscription Plans with Features Schema
-- This allows subscription plans to have bundled features

-- Subscription plans table (if plans are managed separately from templates)
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    price_per_month DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_active
    ON subscription_plans(is_active);

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Subscription plan features (many-to-many relationship)
CREATE TABLE IF NOT EXISTS subscription_plan_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
    feature_key VARCHAR(50) NOT NULL REFERENCES store_features(feature_key) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(plan_id, feature_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscription_plan_features_plan ON subscription_plan_features(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscription_plan_features_feature ON subscription_plan_features(feature_key);

-- Update store_subscriptions to reference subscription_plan instead of just template
-- Add plan_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'store_subscriptions' AND column_name = 'plan_id'
    ) THEN
        ALTER TABLE store_subscriptions ADD COLUMN plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_store_subscriptions_plan ON store_subscriptions(plan_id);

