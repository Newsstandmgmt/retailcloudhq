-- Tax configurations schema
CREATE TABLE IF NOT EXISTS tax_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    state VARCHAR(50) NOT NULL,
    tax_type VARCHAR(100) NOT NULL,
    tax_rate NUMERIC(9, 6) NOT NULL DEFAULT 0,
    tax_applicable_to VARCHAR(50) DEFAULT 'customer',
    is_inclusive BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS tax_configurations_store_state_type_idx
    ON tax_configurations(store_id, state, tax_type);

CREATE INDEX IF NOT EXISTS tax_configurations_store_active_idx
    ON tax_configurations(store_id)
    WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS update_tax_configurations_updated_at ON tax_configurations;
CREATE TRIGGER update_tax_configurations_updated_at
    BEFORE UPDATE ON tax_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

