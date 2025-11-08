-- Add accounting-specific fields for daily lottery tracking
-- These fields are needed for proper accounting calculations

ALTER TABLE daily_lottery 
ADD COLUMN IF NOT EXISTS daily_draw_sales DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_draw_net DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_instant_sales DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_instant_adjustment DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_instant_pay DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_lottery_card_transaction DECIMAL(10, 2) DEFAULT 0;

-- Comments for documentation
COMMENT ON COLUMN daily_lottery.daily_draw_sales IS 'Daily Draw Sales - total draw game sales';
COMMENT ON COLUMN daily_lottery.daily_draw_net IS 'Daily Draw Net - draw sales minus cancellations, adjustments';
COMMENT ON COLUMN daily_lottery.daily_instant_sales IS 'Daily Instant Sales - scratch-off ticket sales';
COMMENT ON COLUMN daily_lottery.daily_instant_adjustment IS 'Daily Instant Adjustment - adjustments to instant sales';
COMMENT ON COLUMN daily_lottery.daily_instant_pay IS 'Daily Instant Pay - payments for instant tickets';
COMMENT ON COLUMN daily_lottery.daily_lottery_card_transaction IS 'Daily Lottery Card Transaction - card transactions for lottery';

-- Index for reporting queries
CREATE INDEX IF NOT EXISTS idx_daily_lottery_accounting ON daily_lottery(store_id, entry_date, daily_draw_sales, daily_instant_sales);

