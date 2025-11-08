-- Add deleted_at column to stores table for soft delete functionality
-- This migration is idempotent - safe to run multiple times

-- Add deleted_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'stores' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE stores ADD COLUMN deleted_at TIMESTAMP;
        CREATE INDEX IF NOT EXISTS idx_stores_deleted_at ON stores(deleted_at);
        RAISE NOTICE 'Added deleted_at column to stores table';
    ELSE
        RAISE NOTICE 'deleted_at column already exists in stores table';
    END IF;
END $$;

