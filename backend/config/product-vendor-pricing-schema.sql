-- Product vendor pricing schema

CREATE TABLE IF NOT EXISTS product_vendor_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    cost_price NUMERIC(12, 4) NOT NULL,
    effective_from DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS product_vendor_prices_product_idx
    ON product_vendor_prices(product_id);

CREATE INDEX IF NOT EXISTS product_vendor_prices_vendor_idx
    ON product_vendor_prices(vendor_id);

DROP TRIGGER IF EXISTS update_product_vendor_prices_updated_at ON product_vendor_prices;
CREATE TRIGGER update_product_vendor_prices_updated_at
    BEFORE UPDATE ON product_vendor_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS product_vendor_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_vendor_price_id UUID REFERENCES product_vendor_prices(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    previous_cost_price NUMERIC(12, 4),
    new_cost_price NUMERIC(12, 4) NOT NULL,
    change_reason TEXT,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS product_vendor_price_history_product_idx
    ON product_vendor_price_history(product_id);

CREATE INDEX IF NOT EXISTS product_vendor_price_history_vendor_idx
    ON product_vendor_price_history(vendor_id);

