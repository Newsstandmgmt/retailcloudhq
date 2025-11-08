-- Migration to add variants support to products table
-- This adds variants_enabled flag and variants JSONB column

-- Add variants_enabled column if it doesn't exist
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS variants_enabled BOOLEAN DEFAULT false;

-- Add variants JSONB column if it doesn't exist
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS variants JSONB;

-- Add vape_tax column if it doesn't exist (for PA Vape Tax tracking)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS vape_tax BOOLEAN DEFAULT false;

-- Add last_vape_tax_paid_date column if it doesn't exist
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS last_vape_tax_paid_date DATE;

-- Create index on variants_enabled for faster queries
CREATE INDEX IF NOT EXISTS idx_products_variants_enabled ON products(store_id, variants_enabled) WHERE variants_enabled = true;

-- Create GIN index on variants JSONB for faster JSON queries
CREATE INDEX IF NOT EXISTS idx_products_variants_json ON products USING GIN (variants) WHERE variants IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN products.variants_enabled IS 'Flag indicating if this product has variants enabled';
COMMENT ON COLUMN products.variants IS 'JSON array of variant objects: [{"name": "variant_name", "upc": "barcode"}]';
COMMENT ON COLUMN products.vape_tax IS 'Flag indicating if PA Vape Tax applies to this product';
COMMENT ON COLUMN products.last_vape_tax_paid_date IS 'Date when vape tax was last paid for this product';

