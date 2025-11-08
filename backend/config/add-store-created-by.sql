-- Add created_by column to stores table for tracking store ownership
-- This migration is idempotent - safe to run multiple times

-- Add created_by column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'stores' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE stores ADD COLUMN created_by UUID REFERENCES users(id);
        CREATE INDEX IF NOT EXISTS idx_stores_created_by ON stores(created_by);
        RAISE NOTICE 'Added created_by column to stores table';
    ELSE
        RAISE NOTICE 'created_by column already exists in stores table';
    END IF;
END $$;

