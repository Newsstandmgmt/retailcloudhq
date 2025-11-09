-- RetailCloudHQ Database Schema
-- This creates all tables needed for the complete system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USER MANAGEMENT TABLES
-- ============================================

-- Users table with hierarchical roles
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'admin', 'manager', 'employee')),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backfill legacy schemas that may be missing the role column
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role VARCHAR(50);

UPDATE users
SET role = COALESCE(role, 'employee');

-- Ensure we maintain the NOT NULL guarantee for role
ALTER TABLE users
    ALTER COLUMN role SET NOT NULL;

-- Backfill legacy instances to include first_name / last_name columns
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

UPDATE users
SET first_name = COALESCE(first_name, ''),
    last_name = COALESCE(last_name, '');

ALTER TABLE users
    ALTER COLUMN first_name SET NOT NULL,
    ALTER COLUMN last_name SET NOT NULL;

-- Store table
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    store_type VARCHAR(50) CHECK (store_type IN ('galaxy', 'newsstand', 'other')),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    phone VARCHAR(20),
    admin_id UUID REFERENCES users(id), -- Admin who manages this store
    manager_id UUID REFERENCES users(id), -- Manager assigned to this store
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User-Store assignments (for employees who can work at multiple stores)
CREATE TABLE IF NOT EXISTS user_store_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, store_id)
);

-- ============================================
-- REVENUE TRACKING TABLES
-- ============================================

-- Daily revenue entries
CREATE TABLE IF NOT EXISTS daily_revenue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    
    -- Revenue Section
    total_cash DECIMAL(10, 2) DEFAULT 0,
    cash_adjustment DECIMAL(10, 2) DEFAULT 0,
    business_credit_card DECIMAL(10, 2) DEFAULT 0,
    credit_card_transaction_fees DECIMAL(10, 2) DEFAULT 0,
    online_sales DECIMAL(10, 2) DEFAULT 0,
    online_net DECIMAL(10, 2) DEFAULT 0,
    total_instant DECIMAL(10, 2) DEFAULT 0,
    total_instant_adjustment DECIMAL(10, 2) DEFAULT 0,
    instant_pay DECIMAL(10, 2) DEFAULT 0,
    lottery_credit_card DECIMAL(10, 2) DEFAULT 0,
    sales_tax_amount DECIMAL(10, 2) DEFAULT 0,
    newspaper_sold DECIMAL(10, 2) DEFAULT 0,
    elias_newspaper DECIMAL(10, 2) DEFAULT 0,
    sam_newspaper DECIMAL(10, 2) DEFAULT 0,
    other_cash_expense DECIMAL(10, 2) DEFAULT 0,
    
    -- Metadata
    entered_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, entry_date)
);

-- ============================================
-- LOTTERY TRACKING TABLES
-- ============================================

-- Daily lottery entries
CREATE TABLE IF NOT EXISTS daily_lottery (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    
    total_lottery_cash DECIMAL(10, 2) DEFAULT 0,
    daily_lottery_cash DECIMAL(10, 2) DEFAULT 0,
    lottery_commission DECIMAL(10, 2) DEFAULT 0,
    thirteen_week_average DECIMAL(10, 2) DEFAULT 0,
    pa_lottery_due DECIMAL(10, 2) DEFAULT 0,
    fulton_bank_lottery_deposit DECIMAL(10, 2) DEFAULT 0,
    fulton_bank_balance DECIMAL(10, 2) DEFAULT 0,
    
    entered_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, entry_date)
);

-- ============================================
-- CASH FLOW TRACKING TABLES
-- ============================================

-- Daily cash flow entries
CREATE TABLE IF NOT EXISTS daily_cash_flow (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    
    ending_cash_on_hand DECIMAL(10, 2) DEFAULT 0,
    beginning_cash DECIMAL(10, 2) DEFAULT 0,
    business_daily_cash DECIMAL(10, 2) DEFAULT 0,
    payroll_paid DECIMAL(10, 2) DEFAULT 0,
    
    entered_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, entry_date)
);

-- ============================================
-- COST OF GOODS SOLD (COGS) TABLES
-- ============================================

-- Daily COGS entries
CREATE TABLE IF NOT EXISTS daily_cogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    
    cost_of_goods_sold DECIMAL(10, 2) DEFAULT 0,
    total_cigarette_rebate DECIMAL(10, 2) DEFAULT 0,
    
    entered_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, entry_date)
);

-- ============================================
-- UTILITIES TRACKING TABLES
-- ============================================

-- Monthly utilities entries
CREATE TABLE IF NOT EXISTS monthly_utilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    entry_month DATE NOT NULL, -- First day of the month
    
    utilities DECIMAL(10, 2) DEFAULT 0,
    electric DECIMAL(10, 2) DEFAULT 0,
    internet DECIMAL(10, 2) DEFAULT 0,
    security_system DECIMAL(10, 2) DEFAULT 0,
    tmobile_cellphone DECIMAL(10, 2) DEFAULT 0,
    health_insurance DECIMAL(10, 2) DEFAULT 0,
    other DECIMAL(10, 2) DEFAULT 0,
    
    entered_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, entry_month)
);

-- ============================================
-- OPERATING EXPENSES TABLES
-- ============================================

-- Monthly operating expenses
CREATE TABLE IF NOT EXISTS monthly_operating_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    entry_month DATE NOT NULL, -- First day of the month
    
    operating_expense DECIMAL(10, 2) DEFAULT 0,
    payroll DECIMAL(10, 2) DEFAULT 0,
    credit_card_transaction_fees DECIMAL(10, 2) DEFAULT 0,
    meals_expense DECIMAL(10, 2) DEFAULT 0,
    instant_tracker_software DECIMAL(10, 2) DEFAULT 0,
    parking DECIMAL(10, 2) DEFAULT 0,
    sales_tax_payroll_tax DECIMAL(10, 2) DEFAULT 0,
    accounting_fees DECIMAL(10, 2) DEFAULT 0,
    ticket DECIMAL(10, 2) DEFAULT 0,
    
    entered_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, entry_month)
);

-- ============================================
-- LICENSE FEES TABLES
-- ============================================

-- Annual license fees
CREATE TABLE IF NOT EXISTS license_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    entry_year INTEGER NOT NULL,
    
    city_license_fees DECIMAL(10, 2) DEFAULT 0,
    newsstand_bond DECIMAL(10, 2) DEFAULT 0,
    cigar_permit_fees DECIMAL(10, 2) DEFAULT 0,
    food_license DECIMAL(10, 2) DEFAULT 0,
    newsstand_license DECIMAL(10, 2) DEFAULT 0,
    lottery_license DECIMAL(10, 2) DEFAULT 0,
    pa_otp_cigarette_license_fees DECIMAL(10, 2) DEFAULT 0,
    
    entered_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, entry_year)
);

-- ============================================
-- CUSTOMER MANAGEMENT TABLES
-- ============================================

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SUPPLIERS & VENDORS TABLES
-- ============================================

-- Suppliers table (managed by admins)
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_stores_admin_id ON stores(admin_id);
CREATE INDEX IF NOT EXISTS idx_stores_manager_id ON stores(manager_id);
CREATE INDEX IF NOT EXISTS idx_user_store_assignments_user_id ON user_store_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_store_assignments_store_id ON user_store_assignments(store_id);
CREATE INDEX IF NOT EXISTS idx_daily_revenue_store_date ON daily_revenue(store_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_daily_lottery_store_date ON daily_lottery(store_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_daily_cash_flow_store_date ON daily_cash_flow(store_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_daily_cogs_store_date ON daily_cogs(store_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_monthly_utilities_store_month ON monthly_utilities(store_id, entry_month);
CREATE INDEX IF NOT EXISTS idx_monthly_operating_expenses_store_month ON monthly_operating_expenses(store_id, entry_month);
CREATE INDEX IF NOT EXISTS idx_license_fees_store_year ON license_fees(store_id, entry_year);
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers(store_id);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stores_updated_at ON stores;
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_revenue_updated_at ON daily_revenue;
CREATE TRIGGER update_daily_revenue_updated_at BEFORE UPDATE ON daily_revenue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_lottery_updated_at ON daily_lottery;
CREATE TRIGGER update_daily_lottery_updated_at BEFORE UPDATE ON daily_lottery
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_cash_flow_updated_at ON daily_cash_flow;
CREATE TRIGGER update_daily_cash_flow_updated_at BEFORE UPDATE ON daily_cash_flow
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_cogs_updated_at ON daily_cogs;
CREATE TRIGGER update_daily_cogs_updated_at BEFORE UPDATE ON daily_cogs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_monthly_utilities_updated_at ON monthly_utilities;
CREATE TRIGGER update_monthly_utilities_updated_at BEFORE UPDATE ON monthly_utilities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_monthly_operating_expenses_updated_at ON monthly_operating_expenses;
CREATE TRIGGER update_monthly_operating_expenses_updated_at BEFORE UPDATE ON monthly_operating_expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_license_fees_updated_at ON license_fees;
CREATE TRIGGER update_license_fees_updated_at BEFORE UPDATE ON license_fees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit Logs Schema
-- This table tracks all user activities and system changes for compliance and security

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User information
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    user_name VARCHAR(255), -- Full name for historical reference
    
    -- Action details
    action_type VARCHAR(50) NOT NULL, -- 'login', 'logout', 'create', 'update', 'delete', 'view', 'export', 'failed_login', etc.
    entity_type VARCHAR(50), -- 'user', 'store', 'revenue', 'invoice', 'config', etc.
    entity_id UUID, -- ID of the affected entity
    
    -- Action description
    action_description TEXT, -- Human-readable description
    resource_path VARCHAR(500), -- API endpoint or page path
    http_method VARCHAR(10), -- GET, POST, PUT, DELETE, etc.
    
    -- Request details
    ip_address VARCHAR(45), -- IPv4 or IPv6
    user_agent TEXT,
    
    -- Change tracking
    old_values JSONB, -- Previous values (for updates)
    new_values JSONB, -- New values (for creates/updates)
    
    -- Status
    status VARCHAR(20) DEFAULT 'success', -- 'success', 'failed', 'error'
    error_message TEXT, -- Error message if action failed
    
    -- Metadata
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL, -- Store context if applicable
    metadata JSONB, -- Additional context data
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_store_id ON audit_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email ON audit_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_action ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date_range ON audit_logs(created_at DESC, action_type);

-- Login history view (for quick access to login/logout events)
CREATE OR REPLACE VIEW login_history AS
SELECT 
    id,
    user_id,
    user_email,
    user_name,
    action_type,
    ip_address,
    user_agent,
    status,
    error_message,
    created_at
FROM audit_logs
WHERE action_type IN ('login', 'logout', 'failed_login')
ORDER BY created_at DESC;

-- Critical actions view (for compliance monitoring)
CREATE OR REPLACE VIEW critical_actions AS
SELECT 
    id,
    user_id,
    user_email,
    user_name,
    action_type,
    entity_type,
    entity_id,
    action_description,
    old_values,
    new_values,
    ip_address,
    status,
    created_at
FROM audit_logs
WHERE action_type IN ('create', 'update', 'delete') 
  AND entity_type IN ('user', 'store', 'admin_config', 'subscription', 'billing')
ORDER BY created_at DESC;

