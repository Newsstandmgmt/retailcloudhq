-- Purchase & Inventory Management Schema for RetailCloudHQ
-- Creates vendors, departments, banks, credit_cards, purchase_invoices, and inventory_movements

-- ============================================
-- Vendors
-- ============================================

CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE vendors
    ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS state VARCHAR(100),
    ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_store_name
    ON vendors(store_id, name);

CREATE INDEX IF NOT EXISTS idx_vendors_store
    ON vendors(store_id);

DROP TRIGGER IF EXISTS update_vendors_updated_at ON vendors;
CREATE TRIGGER update_vendors_updated_at
    BEFORE UPDATE ON vendors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Departments
-- ============================================

CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE departments
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_store_name
    ON departments(store_id, name);

CREATE INDEX IF NOT EXISTS idx_departments_store
    ON departments(store_id);

DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
CREATE TRIGGER update_departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Banks
-- ============================================

CREATE TABLE IF NOT EXISTS banks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    bank_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE banks
    ADD COLUMN IF NOT EXISTS bank_short_name VARCHAR(50),
    ADD COLUMN IF NOT EXISTS is_default_bank BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_default_atm_bank BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_default_lottery_bank BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_default_credit_card_bank BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_banks_store_name
    ON banks(store_id, bank_name);

CREATE INDEX IF NOT EXISTS idx_banks_store
    ON banks(store_id);

DROP TRIGGER IF EXISTS update_banks_updated_at ON banks;
CREATE TRIGGER update_banks_updated_at
    BEFORE UPDATE ON banks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Credit Cards
-- ============================================

CREATE TABLE IF NOT EXISTS credit_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    card_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE credit_cards
    ADD COLUMN IF NOT EXISTS card_short_name VARCHAR(50),
    ADD COLUMN IF NOT EXISTS last_four_digits VARCHAR(4),
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_cards_store_name
    ON credit_cards(store_id, card_name);

CREATE INDEX IF NOT EXISTS idx_credit_cards_store
    ON credit_cards(store_id);

DROP TRIGGER IF EXISTS update_credit_cards_updated_at ON credit_cards;
CREATE TRIGGER update_credit_cards_updated_at
    BEFORE UPDATE ON credit_cards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Purchase Invoices
-- ============================================

CREATE TABLE IF NOT EXISTS purchase_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100),
    purchase_date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    payment_option VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE purchase_invoices
    ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS vendor_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS department_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS due_days INTEGER,
    ADD COLUMN IF NOT EXISTS due_date DATE,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS is_cigarette_purchase BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS cigarette_cartons_purchased INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS prepaid_tax BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tax_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(7, 4),
    ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS paid_on_purchase BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS payment_method_on_purchase VARCHAR(50),
    ADD COLUMN IF NOT EXISTS bank_id_on_purchase UUID REFERENCES banks(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS bank_account_name_on_purchase VARCHAR(255),
    ADD COLUMN IF NOT EXISTS credit_card_id_on_purchase UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_reimbursable BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS reimbursement_to VARCHAR(255),
    ADD COLUMN IF NOT EXISTS reimbursement_status VARCHAR(50) DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS reimbursement_payment_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS reimbursement_check_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS reimbursement_bank_id UUID REFERENCES banks(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reimbursement_date DATE,
    ADD COLUMN IF NOT EXISTS reimbursement_amount NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS payment_date DATE,
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS check_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS expected_revenue NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS revenue_calculation_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS invoice_items JSONB,
    ADD COLUMN IF NOT EXISTS entered_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Ensure tax_amount defaults to 0 when null
UPDATE purchase_invoices
SET tax_amount = 0
WHERE tax_amount IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_invoices_store_invoice
    ON purchase_invoices(store_id, invoice_number)
    WHERE invoice_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_store_date
    ON purchase_invoices(store_id, purchase_date DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_vendor
    ON purchase_invoices(vendor_id);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_status
    ON purchase_invoices(status);

DROP TRIGGER IF EXISTS update_purchase_invoices_updated_at ON purchase_invoices;
CREATE TRIGGER update_purchase_invoices_updated_at
    BEFORE UPDATE ON purchase_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Inventory Movements
-- ============================================

CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    movement_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE inventory_movements
    ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES purchase_invoices(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS entered_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_store
    ON inventory_movements(store_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product
    ON inventory_movements(product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_store_date
    ON inventory_movements(store_id, movement_date DESC);

DROP TRIGGER IF EXISTS update_inventory_movements_updated_at ON inventory_movements;
CREATE TRIGGER update_inventory_movements_updated_at
    BEFORE UPDATE ON inventory_movements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


