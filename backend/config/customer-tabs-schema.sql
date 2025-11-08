-- Customer Tabs Schema
-- Track individual customer tabs for lottery and products

CREATE TABLE IF NOT EXISTS customer_tabs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL, -- Store name if customer_id is null
    
    -- Current balance (unpaid amount)
    current_balance DECIMAL(10, 2) DEFAULT 0,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(store_id, customer_id, customer_name)
);

-- Customer Tab Transactions (charges and payments)
CREATE TABLE IF NOT EXISTS customer_tab_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_tab_id UUID NOT NULL REFERENCES customer_tabs(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    
    -- Transaction type: 'charge' (new tab) or 'payment' (payment on tab)
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('charge', 'payment')),
    
    -- Amount (positive for charges, positive for payments - balance is reduced)
    amount DECIMAL(10, 2) NOT NULL,
    
    -- For payments: payment method
    payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'card', 'check')),
    
    -- Description of what was purchased (for charges)
    description TEXT,
    
    -- Link to daily revenue entry if payment was recorded there
    daily_revenue_id UUID REFERENCES daily_revenue(id) ON DELETE SET NULL,
    
    -- Metadata
    entered_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_tabs_store ON customer_tabs(store_id);
CREATE INDEX IF NOT EXISTS idx_customer_tabs_customer ON customer_tabs(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_tabs_name ON customer_tabs(customer_name);
CREATE INDEX IF NOT EXISTS idx_customer_tab_transactions_tab ON customer_tab_transactions(customer_tab_id);
CREATE INDEX IF NOT EXISTS idx_customer_tab_transactions_store_date ON customer_tab_transactions(store_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_customer_tab_transactions_type ON customer_tab_transactions(transaction_type);

-- Trigger to update customer_tabs balance when transactions are added
CREATE OR REPLACE FUNCTION update_customer_tab_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.transaction_type = 'charge' THEN
            -- Add to balance
            UPDATE customer_tabs 
            SET current_balance = current_balance + NEW.amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.customer_tab_id;
        ELSIF NEW.transaction_type = 'payment' THEN
            -- Subtract from balance
            UPDATE customer_tabs 
            SET current_balance = current_balance - NEW.amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.customer_tab_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle balance updates if amount or type changed
        IF OLD.transaction_type = 'charge' AND NEW.transaction_type = 'charge' THEN
            UPDATE customer_tabs 
            SET current_balance = current_balance - OLD.amount + NEW.amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.customer_tab_id;
        ELSIF OLD.transaction_type = 'payment' AND NEW.transaction_type = 'payment' THEN
            UPDATE customer_tabs 
            SET current_balance = current_balance + OLD.amount - NEW.amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.customer_tab_id;
        ELSIF OLD.transaction_type != NEW.transaction_type THEN
            -- Type changed - need to reverse old and apply new
            IF OLD.transaction_type = 'charge' THEN
                UPDATE customer_tabs 
                SET current_balance = current_balance - OLD.amount - NEW.amount,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = NEW.customer_tab_id;
            ELSE
                UPDATE customer_tabs 
                SET current_balance = current_balance + OLD.amount + NEW.amount,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = NEW.customer_tab_id;
            END IF;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        -- Reverse the transaction
        IF OLD.transaction_type = 'charge' THEN
            UPDATE customer_tabs 
            SET current_balance = current_balance - OLD.amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = OLD.customer_tab_id;
        ELSIF OLD.transaction_type = 'payment' THEN
            UPDATE customer_tabs 
            SET current_balance = current_balance + OLD.amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = OLD.customer_tab_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_tab_balance_trigger
AFTER INSERT OR UPDATE OR DELETE ON customer_tab_transactions
FOR EACH ROW EXECUTE FUNCTION update_customer_tab_balance();

COMMENT ON TABLE customer_tabs IS 'Track customer tab balances for each customer';
COMMENT ON TABLE customer_tab_transactions IS 'Track individual tab charges and payments';
COMMENT ON COLUMN customer_tab_transactions.transaction_type IS 'charge: new tab purchase, payment: payment on existing tab';
COMMENT ON COLUMN customer_tab_transactions.payment_method IS 'For payments: cash, card, or check';

