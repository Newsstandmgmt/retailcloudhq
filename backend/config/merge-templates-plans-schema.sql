-- Merge Store Templates and Subscription Plans
-- Templates become subscription plans with pricing

-- Add pricing fields to store_templates
ALTER TABLE store_templates
ADD COLUMN IF NOT EXISTS price_per_month DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly'));

-- Update store_subscriptions to reference template_id instead of plan_id
DO $$ 
BEGIN
    -- If plan_id exists but template_id doesn't, add template_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'store_subscriptions' AND column_name = 'plan_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'store_subscriptions' AND column_name = 'template_id'
    ) THEN
        ALTER TABLE store_subscriptions ADD COLUMN template_id UUID REFERENCES store_templates(id) ON DELETE SET NULL;
        
        -- Copy plan_id to template_id if subscription_plans has a corresponding template
        -- This is a migration step - we'll handle it in the application
    END IF;
END $$;

-- Create index for template_id in store_subscriptions
CREATE INDEX IF NOT EXISTS idx_store_subscriptions_template ON store_subscriptions(template_id);

-- Feature add-ons table (individual features that can be added to any template/plan)
CREATE TABLE IF NOT EXISTS store_feature_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    feature_key VARCHAR(50) NOT NULL REFERENCES store_features(feature_key) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by UUID REFERENCES users(id),
    UNIQUE(store_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_store_feature_addons_store ON store_feature_addons(store_id);
CREATE INDEX IF NOT EXISTS idx_store_feature_addons_feature ON store_feature_addons(feature_key);

-- Update feature_pricing to indicate if it's an addon (can be added to any plan)
-- This is already set up, we just need to use it

