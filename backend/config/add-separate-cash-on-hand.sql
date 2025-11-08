-- Add separate Business and Lottery Cash On Hand tracking
-- This allows stores with separate drawers to track cash independently

ALTER TABLE cash_on_hand
ADD COLUMN IF NOT EXISTS business_cash_on_hand DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS lottery_cash_on_hand DECIMAL(10, 2) DEFAULT 0;

-- Add cash category to cash_transactions
ALTER TABLE cash_transactions
ADD COLUMN IF NOT EXISTS cash_category VARCHAR(50) DEFAULT 'business'; -- 'business' or 'lottery'

-- Add owner distribution tracking
CREATE TABLE IF NOT EXISTS owner_distributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    distribution_date DATE NOT NULL,
    business_amount DECIMAL(10, 2) DEFAULT 0,
    lottery_amount DECIMAL(10, 2) DEFAULT 0,
    description TEXT,
    entered_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_owner_distributions_store_date ON owner_distributions(store_id, distribution_date);

COMMENT ON COLUMN cash_on_hand.business_cash_on_hand IS 'Current business cash on hand (for stores with separate drawers)';
COMMENT ON COLUMN cash_on_hand.lottery_cash_on_hand IS 'Current lottery cash on hand (for stores with separate drawers)';
COMMENT ON COLUMN cash_transactions.cash_category IS 'Category of cash: business or lottery';
COMMENT ON TABLE owner_distributions IS 'Owner distributions (cash taken out by owner)';

