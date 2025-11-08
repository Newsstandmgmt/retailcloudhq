-- Add Customer Tab and Newspaper fields to daily_revenue table

ALTER TABLE daily_revenue 
ADD COLUMN IF NOT EXISTS customer_tab DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS elias_newspaper DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sam_newspaper DECIMAL(10, 2) DEFAULT 0;

COMMENT ON COLUMN daily_revenue.customer_tab IS 'Total customer tab amount for the day (customers buying on credit)';
COMMENT ON COLUMN daily_revenue.elias_newspaper IS 'Newspaper revenue/commission for Elias';
COMMENT ON COLUMN daily_revenue.sam_newspaper IS 'Newspaper revenue/commission for Sam';

CREATE INDEX IF NOT EXISTS idx_daily_revenue_customer_tab ON daily_revenue(store_id, entry_date, customer_tab);

