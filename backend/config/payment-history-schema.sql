-- Payment History Schema for Store Subscriptions
-- Track all payments made for subscriptions

CREATE TABLE IF NOT EXISTS subscription_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_subscription_id UUID NOT NULL REFERENCES store_subscriptions(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    
    -- Payment details
    payment_date DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    
    -- Payment method
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'check', 'card', 'bank_transfer', 'other')),
    check_number VARCHAR(50),
    transaction_id VARCHAR(255),
    notes TEXT,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'failed', 'refunded')),
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription ON subscription_payments(store_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_store ON subscription_payments(store_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_date ON subscription_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON subscription_payments(status);

-- Trigger for updated_at
CREATE TRIGGER update_subscription_payments_updated_at 
    BEFORE UPDATE ON subscription_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

