-- Add newspaper sales settings to stores table

ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS enable_newspaper_sales BOOLEAN DEFAULT false;

COMMENT ON COLUMN stores.enable_newspaper_sales IS 'Whether this store sells newspapers';

CREATE INDEX IF NOT EXISTS idx_stores_newspaper_sales ON stores(enable_newspaper_sales);

