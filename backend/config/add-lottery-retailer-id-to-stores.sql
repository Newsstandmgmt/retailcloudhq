-- Add lottery_retailer_id column to stores table
-- This migration is idempotent - safe to run multiple times

-- Add lottery_retailer_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'stores' AND column_name = 'lottery_retailer_id'
    ) THEN
        ALTER TABLE stores ADD COLUMN lottery_retailer_id VARCHAR(50);
        CREATE INDEX IF NOT EXISTS idx_stores_lottery_retailer_id ON stores(lottery_retailer_id);
        RAISE NOTICE 'Added lottery_retailer_id column to stores table';
    ELSE
        RAISE NOTICE 'lottery_retailer_id column already exists in stores table';
    END IF;
END $$;

