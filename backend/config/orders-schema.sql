-- Inventory Orders Schema
-- Handles orders submitted from handheld devices

-- Orders table
CREATE TABLE IF NOT EXISTS inventory_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(50) UNIQUE NOT NULL, -- Human-readable order ID (e.g., ORD-2025-001)
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES users(id), -- User who submitted the order
    submitted_by_name VARCHAR(255), -- Cached name for display
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'delivered', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP
);

-- Order items table
CREATE TABLE IF NOT EXISTS inventory_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES inventory_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    product_name VARCHAR(500) NOT NULL, -- Cached product name for display
    variant VARCHAR(100), -- Cached variant
    supplier VARCHAR(255), -- Cached supplier name
    upc VARCHAR(50), -- Cached UPC for reference
    quantity INTEGER NOT NULL DEFAULT 1,
    quantity_delivered INTEGER DEFAULT 0, -- How much has been delivered
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'partially_delivered', 'delivered', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_store ON inventory_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON inventory_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_submitted_by ON inventory_orders(submitted_by);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON inventory_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON inventory_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON inventory_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON inventory_order_items(status);

-- Function to generate order ID
CREATE OR REPLACE FUNCTION generate_order_id()
RETURNS VARCHAR(50) AS $$
DECLARE
    new_order_id VARCHAR(50);
    year_str VARCHAR(4);
    seq_num INTEGER;
BEGIN
    year_str := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    -- Get the highest sequence number for this year
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_id FROM '(\d+)$') AS INTEGER)), 0) + 1
    INTO seq_num
    FROM inventory_orders
    WHERE order_id LIKE 'ORD-' || year_str || '-%';
    
    -- Format as ORD-YYYY-001, ORD-YYYY-002, etc.
    new_order_id := 'ORD-' || year_str || '-' || LPAD(seq_num::TEXT, 3, '0');
    
    RETURN new_order_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON inventory_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_updated_at();

CREATE TRIGGER update_order_items_updated_at
    BEFORE UPDATE ON inventory_order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_updated_at();

-- Comments
COMMENT ON TABLE inventory_orders IS 'Orders submitted from handheld devices for inventory replenishment';
COMMENT ON TABLE inventory_order_items IS 'Individual items in each order';
COMMENT ON COLUMN inventory_order_items.quantity_delivered IS 'How many units have been delivered (for partial deliveries)';

