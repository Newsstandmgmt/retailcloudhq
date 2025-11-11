-- Payroll Management Schema
-- Provides tables for employee payroll configuration, history, time-off and payroll runs

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Employee Payroll Configuration
-- ============================================================

CREATE TABLE IF NOT EXISTS employee_payroll_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    pay_rate NUMERIC(10, 2) DEFAULT 0,
    pay_schedule VARCHAR(50) DEFAULT 'biweekly',
    pay_type VARCHAR(20) DEFAULT 'hourly', -- hourly or salary
    payroll_type VARCHAR(20) DEFAULT 'standard', -- standard or custom
    default_hours_per_week NUMERIC(6, 2) DEFAULT 40,
    hire_date DATE,
    employment_status VARCHAR(50) DEFAULT 'active',
    fire_date DATE,
    rehire_date DATE,
    pay_schedule_start_day VARCHAR(20),
    pay_schedule_end_day VARCHAR(20),
    pay_day VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_payroll_config_store ON employee_payroll_config(store_id);
CREATE INDEX IF NOT EXISTS idx_employee_payroll_config_user ON employee_payroll_config(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_payroll_config_status ON employee_payroll_config(store_id, employment_status);

DROP TRIGGER IF EXISTS update_employee_payroll_config_updated_at ON employee_payroll_config;
CREATE TRIGGER update_employee_payroll_config_updated_at
    BEFORE UPDATE ON employee_payroll_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Pay Rate History
-- ============================================================

CREATE TABLE IF NOT EXISTS pay_rate_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_payroll_config_id UUID NOT NULL REFERENCES employee_payroll_config(id) ON DELETE CASCADE,
    old_pay_rate NUMERIC(10, 2),
    new_pay_rate NUMERIC(10, 2) NOT NULL,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pay_rate_history_config ON pay_rate_history(employee_payroll_config_id);
CREATE INDEX IF NOT EXISTS idx_pay_rate_history_changed_at ON pay_rate_history(changed_at DESC);

-- ============================================================
-- Time Off Records
-- ============================================================

CREATE TABLE IF NOT EXISTS time_off_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_payroll_config_id UUID NOT NULL REFERENCES employee_payroll_config(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time_off_type VARCHAR(50) NOT NULL, -- e.g., full_day, hours
    hours_off NUMERIC(6, 2),
    reason TEXT,
    entered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (employee_payroll_config_id, date)
);

CREATE INDEX IF NOT EXISTS idx_time_off_records_config ON time_off_records(employee_payroll_config_id);
CREATE INDEX IF NOT EXISTS idx_time_off_records_date ON time_off_records(date);

DROP TRIGGER IF EXISTS update_time_off_records_updated_at ON time_off_records;
CREATE TRIGGER update_time_off_records_updated_at
    BEFORE UPDATE ON time_off_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Payroll Runs
-- ============================================================

CREATE TABLE IF NOT EXISTS payroll_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    employee_payroll_config_id UUID NOT NULL REFERENCES employee_payroll_config(id) ON DELETE CASCADE,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    payroll_date DATE NOT NULL,
    pay_rate NUMERIC(10, 2) NOT NULL,
    hours_worked NUMERIC(10, 2),
    time_off_hours NUMERIC(10, 2) DEFAULT 0,
    gross_pay NUMERIC(12, 2) NOT NULL,
    unit VARCHAR(20), -- hourly, salary, etc.
    check_number VARCHAR(50),
    bank VARCHAR(100),
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_store ON payroll_runs(store_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_employee ON payroll_runs(employee_payroll_config_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_date ON payroll_runs(payroll_date DESC);

DROP TRIGGER IF EXISTS update_payroll_runs_updated_at ON payroll_runs;
CREATE TRIGGER update_payroll_runs_updated_at
    BEFORE UPDATE ON payroll_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

