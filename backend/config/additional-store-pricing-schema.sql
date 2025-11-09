-- Additional Store Pricing and Manager Access Schema
-- Each subscription includes 1 store, additional stores cost 50% of base price
-- Manager access is a per-store add-on

-- Add columns to store_subscriptions for additional store pricing
ALTER TABLE store_subscriptions
ADD COLUMN IF NOT EXISTS additional_stores_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS additional_stores_cost DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS manager_access_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS manager_access_cost DECIMAL(10, 2) DEFAULT 0.00;

-- Create manager_access_pricing table for per-store manager access pricing
CREATE TABLE IF NOT EXISTS manager_access_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    price_per_store_per_month DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE manager_access_pricing
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Insert default manager access pricing (if not exists)
INSERT INTO manager_access_pricing (price_per_store_per_month, is_active)
VALUES (9.99, true)
ON CONFLICT DO NOTHING;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_manager_access_pricing_updated_at ON manager_access_pricing;
CREATE TRIGGER update_manager_access_pricing_updated_at 
    BEFORE UPDATE ON manager_access_pricing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comment to explain pricing structure
COMMENT ON COLUMN store_subscriptions.additional_stores_count IS 'Number of additional stores beyond the first (included) store';
COMMENT ON COLUMN store_subscriptions.additional_stores_cost IS 'Cost for additional stores (50% of base_price per additional store)';
COMMENT ON COLUMN store_subscriptions.manager_access_count IS 'Number of stores with manager access enabled';
COMMENT ON COLUMN store_subscriptions.manager_access_cost IS 'Total cost for manager access across all stores';

