-- Add void columns to customer_tab_transactions table
ALTER TABLE customer_tab_transactions
ADD COLUMN IF NOT EXISTS is_voided BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP;

COMMENT ON COLUMN customer_tab_transactions.is_voided IS 'Indicates if this charge transaction has been voided';
COMMENT ON COLUMN customer_tab_transactions.voided_at IS 'Timestamp when the transaction was voided';

CREATE INDEX IF NOT EXISTS idx_customer_tab_transactions_is_voided ON customer_tab_transactions(is_voided);

