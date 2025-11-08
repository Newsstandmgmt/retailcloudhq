-- Add cash drawer settings to stores table
ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS cash_drawer_type VARCHAR(20) CHECK (cash_drawer_type IN ('separate', 'same')),
ADD COLUMN IF NOT EXISTS register_starting_cash JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN stores.cash_drawer_type IS 'Cash drawer configuration: separate (lottery and business have separate drawers) or same (shared drawer)';
COMMENT ON COLUMN stores.register_starting_cash IS 'Starting cash amounts for each register as JSON array: [{"register_id": "register_1", "name": "Register 1", "starting_cash": 100.00}, ...]';

CREATE INDEX IF NOT EXISTS idx_stores_cash_drawer_type ON stores(cash_drawer_type);

