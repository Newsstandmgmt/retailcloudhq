-- Add weekly lottery fields to daily_revenue table
-- These fields are entered on Tuesdays when the weekly lottery report is received

ALTER TABLE daily_revenue
ADD COLUMN IF NOT EXISTS weekly_lottery_commission DECIMAL(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS thirteen_week_average DECIMAL(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS weekly_lottery_due DECIMAL(10, 2) DEFAULT NULL;

-- Add comment explaining these fields
COMMENT ON COLUMN daily_revenue.weekly_lottery_commission IS 'Weekly lottery commission from Tuesday report';
COMMENT ON COLUMN daily_revenue.thirteen_week_average IS '13-week average from Tuesday report';
COMMENT ON COLUMN daily_revenue.weekly_lottery_due IS 'Weekly lottery due amount (taken from Lottery Bank Account) from Tuesday report';

