-- Purchase invoice allocation support

ALTER TABLE purchase_invoices
    ADD COLUMN IF NOT EXISTS parent_invoice_id UUID REFERENCES purchase_invoices(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS allocation_source_store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cross_store_payment_id UUID REFERENCES cross_store_payments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS allocation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS purchase_invoices_parent_invoice_idx
    ON purchase_invoices(parent_invoice_id);

CREATE TABLE IF NOT EXISTS purchase_invoice_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_invoice_id UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
    child_invoice_id UUID REFERENCES purchase_invoices(id) ON DELETE SET NULL,
    source_store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    target_store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    cross_store_payment_id UUID REFERENCES cross_store_payments(id) ON DELETE SET NULL,
    allocation_amount NUMERIC(12, 2),
    allocation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS purchase_invoice_allocations_parent_idx
    ON purchase_invoice_allocations(parent_invoice_id);

CREATE INDEX IF NOT EXISTS purchase_invoice_allocations_child_idx
    ON purchase_invoice_allocations(child_invoice_id);

DROP TRIGGER IF EXISTS update_purchase_invoice_allocations_updated_at ON purchase_invoice_allocations;
CREATE TRIGGER update_purchase_invoice_allocations_updated_at
    BEFORE UPDATE ON purchase_invoice_allocations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

