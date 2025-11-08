-- Migration: Add lottery_retailer_id to stores table
-- This stores the State Lottery assigned Retailer ID for each location

ALTER TABLE stores 
    ADD COLUMN IF NOT EXISTS lottery_retailer_id VARCHAR(50);

COMMENT ON COLUMN stores.lottery_retailer_id IS 'State Lottery assigned Retailer ID for this location. Used for validating lottery reports and email processing.';

CREATE INDEX IF NOT EXISTS idx_stores_lottery_retailer_id ON stores(lottery_retailer_id);

