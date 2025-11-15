-- Store-specific product pricing overrides

CREATE TABLE IF NOT EXISTS store_product_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    override_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    custom_sell_price NUMERIC(10, 2),
    note TEXT,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, product_id)
);

CREATE INDEX IF NOT EXISTS store_product_overrides_store_idx
    ON store_product_overrides(store_id);

CREATE INDEX IF NOT EXISTS store_product_overrides_product_idx
    ON store_product_overrides(product_id);

DROP TRIGGER IF EXISTS update_store_product_overrides_updated_at ON store_product_overrides;
CREATE TRIGGER update_store_product_overrides_updated_at
    BEFORE UPDATE ON store_product_overrides
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

