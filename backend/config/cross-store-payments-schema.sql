-- Cross-Store Payments Schema
-- Allows admins to record payments made from one store that are allocated to other stores

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS cross_store_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_reference VARCHAR(100),
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    paid_to VARCHAR(255),
    notes TEXT,
    metadata JSONB,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cross_store_payments_source_store ON cross_store_payments(source_store_id);
CREATE INDEX IF NOT EXISTS idx_cross_store_payments_payment_date ON cross_store_payments(payment_date DESC);

DROP TRIGGER IF EXISTS update_cross_store_payments_updated_at ON cross_store_payments;
CREATE TRIGGER update_cross_store_payments_updated_at
    BEFORE UPDATE ON cross_store_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS cross_store_payment_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES cross_store_payments(id) ON DELETE CASCADE,
    target_store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    allocated_amount NUMERIC(12, 2) NOT NULL,
    target_type VARCHAR(50), -- e.g., invoice, expense, manual
    target_id UUID,
    memo TEXT,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cross_store_alloc_payment ON cross_store_payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_cross_store_alloc_target_store ON cross_store_payment_allocations(target_store_id);

DROP TRIGGER IF EXISTS update_cross_store_payment_allocations_updated_at ON cross_store_payment_allocations;
CREATE TRIGGER update_cross_store_payment_allocations_updated_at
    BEFORE UPDATE ON cross_store_payment_allocations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE cross_store_payment_allocations
    ADD COLUMN IF NOT EXISTS reimbursement_required BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS reimbursement_status VARCHAR(20) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS reimbursed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS reimbursed_amount NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS reimbursed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reimbursement_note TEXT,
    ADD COLUMN IF NOT EXISTS allocation_percentage NUMERIC(6, 3);

UPDATE cross_store_payment_allocations
SET reimbursement_status = CASE
    WHEN reimbursement_required = false THEN 'not_required'
    ELSE COALESCE(reimbursement_status, 'pending')
END
WHERE reimbursement_status IS NULL OR reimbursement_status NOT IN ('pending', 'completed', 'not_required');

