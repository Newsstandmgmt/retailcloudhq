-- Add store_closed field to daily_revenue table
-- This allows marking days when the store was closed, automatically setting all values to 0

ALTER TABLE daily_revenue
ADD COLUMN IF NOT EXISTS store_closed BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN daily_revenue.store_closed IS 'Indicates if the store was closed on this day. When true, all revenue fields should be 0.';

CREATE INDEX IF NOT EXISTS idx_daily_revenue_store_closed ON daily_revenue(store_id, store_closed, entry_date);

