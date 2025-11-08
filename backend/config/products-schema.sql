-- Products Inventory Database Schema
-- This table stores product information for inventory management and revenue calculation

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id VARCHAR(100), -- User-defined product ID/SKU
    category VARCHAR(100),
    brand VARCHAR(100),
    product_name VARCHAR(255) NOT NULL,
    variant VARCHAR(100), -- e.g., "12oz", "24-pack", "Regular"
    full_product_name VARCHAR(500) GENERATED ALWAYS AS (
        CASE 
            WHEN brand IS NOT NULL AND brand != '' AND variant IS NOT NULL AND variant != '' 
            THEN brand || ' ' || product_name || ' ' || variant
            WHEN brand IS NOT NULL AND brand != '' 
            THEN brand || ' ' || product_name
            WHEN variant IS NOT NULL AND variant != '' 
            THEN product_name || ' ' || variant
            ELSE product_name
        END
    ) STORED,
    cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0, -- Cost per pack/case
    quantity_per_pack INTEGER NOT NULL DEFAULT 1, -- How many units in a pack
    sell_price_per_piece DECIMAL(10, 2) NOT NULL DEFAULT 0, -- Selling price per individual unit
    cost_per_unit DECIMAL(10, 2) GENERATED ALWAYS AS (
        CASE 
            WHEN quantity_per_pack > 0 THEN cost_price / quantity_per_pack
            ELSE 0
        END
    ) STORED,
    profit_per_unit DECIMAL(10, 2) GENERATED ALWAYS AS (
        sell_price_per_piece - (CASE WHEN quantity_per_pack > 0 THEN cost_price / quantity_per_pack ELSE 0 END)
    ) STORED,
    profit_margin DECIMAL(5, 2) GENERATED ALWAYS AS (
        CASE 
            WHEN sell_price_per_piece > 0 
            THEN ((sell_price_per_piece - (CASE WHEN quantity_per_pack > 0 THEN cost_price / quantity_per_pack ELSE 0 END)) / sell_price_per_piece) * 100
            ELSE 0
        END
    ) STORED,
    supplier VARCHAR(255), -- Supplier/Vendor name
    upc VARCHAR(50), -- Universal Product Code / Barcode
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier);
CREATE INDEX IF NOT EXISTS idx_products_upc ON products(upc);
CREATE INDEX IF NOT EXISTS idx_products_product_id ON products(product_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(store_id, is_active) WHERE deleted_at IS NULL;

-- Add columns to purchase_invoices for revenue calculation
ALTER TABLE purchase_invoices 
ADD COLUMN IF NOT EXISTS expected_revenue DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS revenue_calculation_method VARCHAR(50), -- 'manual', 'product_selection', 'auto_calculate'
ADD COLUMN IF NOT EXISTS invoice_items JSONB; -- Stores selected products with quantities for revenue calculation

-- Create index for invoice_items
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_items ON purchase_invoices USING GIN (invoice_items);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_products_timestamp
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_products_updated_at();

-- Comments for documentation
COMMENT ON TABLE products IS 'Product inventory database for tracking products, costs, and expected revenue';
COMMENT ON COLUMN products.full_product_name IS 'Auto-generated full product name combining brand, product name, and variant';
COMMENT ON COLUMN products.cost_per_unit IS 'Auto-calculated cost per unit (cost_price / quantity_per_pack)';
COMMENT ON COLUMN products.profit_per_unit IS 'Auto-calculated profit per unit (sell_price_per_piece - cost_per_unit)';
COMMENT ON COLUMN products.profit_margin IS 'Auto-calculated profit margin percentage';
COMMENT ON COLUMN purchase_invoices.expected_revenue IS 'Expected revenue from this invoice based on product sales';
COMMENT ON COLUMN purchase_invoices.revenue_calculation_method IS 'Method used to calculate revenue: manual, product_selection, or auto_calculate';
COMMENT ON COLUMN purchase_invoices.invoice_items IS 'JSON array of products with quantities for revenue calculation';

