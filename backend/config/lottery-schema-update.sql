-- Update daily_lottery table to include all Google Sheets fields
-- Run this to add new columns for detailed lottery tracking

ALTER TABLE daily_lottery 
ADD COLUMN IF NOT EXISTS retailer_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS location_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS balance_forward DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS draw_sales DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS draw_cancels DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS draw_promos DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS draw_comm DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS draw_pays DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS vch_iss DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS vch_rd DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS webcash_iss DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS draw_adj DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS draw_due DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS scratch_offs_sales DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS scratch_offs_rtrns DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS scratch_offs_comm DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS scratch_offs_prms DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS scratch_offs_pays DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS scratch_offs_adj DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS scratch_offs_due DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS card_trans DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gift_cards DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS prepaid DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_due DECIMAL(10, 2) DEFAULT 0;

-- Update existing fields to match Google Sheets data
-- Map existing fields to new structure if needed
COMMENT ON COLUMN daily_lottery.total_lottery_cash IS 'Total lottery cash (can be calculated from Draw Sales + Scratch-Offs Sales)';
COMMENT ON COLUMN daily_lottery.daily_lottery_cash IS 'Daily lottery cash (Draw Sales)';
COMMENT ON COLUMN daily_lottery.lottery_commission IS 'Total commission (Draw Comm + Scratch-Offs Comm)';
COMMENT ON COLUMN daily_lottery.pa_lottery_due IS 'Total Due from Google Sheet';

