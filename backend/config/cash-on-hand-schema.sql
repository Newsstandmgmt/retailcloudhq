-- Cash on Hand Tracking Table
-- Tracks current cash balance per store, updated automatically by transactions

CREATE TABLE IF NOT EXISTS cash_on_hand (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    current_balance DECIMAL(10, 2) DEFAULT 0 NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_transaction_id UUID, -- Reference to transaction that updated this
    last_transaction_type VARCHAR(50), -- Type: 'revenue', 'expense', 'payment', 'reimbursement'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cash_on_hand_store ON cash_on_hand(store_id);
CREATE INDEX IF NOT EXISTS idx_cash_on_hand_last_updated ON cash_on_hand(last_updated);

-- Trigger for updated_at
CREATE TRIGGER update_cash_on_hand_updated_at
BEFORE UPDATE ON cash_on_hand
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Cash Transaction History (audit trail)
CREATE TABLE IF NOT EXISTS cash_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- 'revenue', 'expense', 'payment', 'reimbursement', 'adjustment'
    transaction_id UUID, -- Reference to the source transaction
    amount DECIMAL(10, 2) NOT NULL,
    balance_before DECIMAL(10, 2) NOT NULL,
    balance_after DECIMAL(10, 2) NOT NULL,
    description TEXT,
    entered_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cash_transactions_store_date ON cash_transactions(store_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_type ON cash_transactions(transaction_type);

