-- Lottery Management System Schema
-- This schema supports both Instant Lottery (scratchers) and Draw/Online Lottery

-- ============================================
-- MASTER DATA TABLES
-- ============================================

-- Store Boxes (Physical boxes where instant lottery packs are stored)
CREATE TABLE IF NOT EXISTS lottery_boxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    box_label VARCHAR(50) NOT NULL, -- e.g., "A1", "B3", "D4"
    qr_code VARCHAR(255), -- QR code for scanning
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, box_label)
);

CREATE INDEX IF NOT EXISTS idx_lottery_boxes_store ON lottery_boxes(store_id);
CREATE INDEX IF NOT EXISTS idx_lottery_boxes_label ON lottery_boxes(store_id, box_label);

-- Instant Lottery Games
CREATE TABLE IF NOT EXISTS lottery_games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id VARCHAR(50) NOT NULL UNIQUE, -- e.g., "G5", "G10"
    name VARCHAR(255) NOT NULL,
    ticket_price DECIMAL(10, 2) NOT NULL,
    tickets_per_pack INTEGER NOT NULL,
    commission_rate DECIMAL(5, 4) NOT NULL, -- e.g., 0.0600 for 6%
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lottery_games_active ON lottery_games(is_active);

-- Draw/Online Lottery Programs
CREATE TABLE IF NOT EXISTS lottery_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id VARCHAR(50) NOT NULL UNIQUE, -- e.g., "POWERBALL", "MEGA", "PICK3"
    name VARCHAR(255) NOT NULL,
    commission_type VARCHAR(50) NOT NULL CHECK (commission_type IN ('rate', 'fixed', 'statement')),
    commission_rate DECIMAL(5, 4), -- If rate-based
    commission_fixed_amount DECIMAL(10, 2), -- If fixed
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lottery_programs_active ON lottery_programs(is_active);

-- Lottery Operators (Settlement Sources)
CREATE TABLE IF NOT EXISTS lottery_operators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    statement_source VARCHAR(50) NOT NULL CHECK (statement_source IN ('portal', 'email', 'sftp', 'csv', 'pdf')),
    portal_url VARCHAR(500),
    email_address VARCHAR(255),
    sftp_config JSONB, -- Store SFTP connection details
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lottery Policies (per store or global)
CREATE TABLE IF NOT EXISTS lottery_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE, -- NULL for global policy
    reading_cadence VARCHAR(50) DEFAULT 'shift_end' CHECK (reading_cadence IN ('shift_end', 'daily', 'real_time')),
    regression_severity VARCHAR(50) DEFAULT 'high' CHECK (regression_severity IN ('low', 'medium', 'high')),
    grace_window_hours INTEGER DEFAULT 24, -- Hours allowed for corrections
    block_gl_posting_on_high_severity BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lottery_policies_store ON lottery_policies(store_id);

-- ============================================
-- INSTANT LOTTERY TABLES
-- ============================================

-- Instant Lottery Packs
CREATE TABLE IF NOT EXISTS lottery_packs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pack_id VARCHAR(100) NOT NULL, -- Barcode/UPC
    game_id UUID NOT NULL REFERENCES lottery_games(id),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    box_label VARCHAR(50) NOT NULL,
    start_ticket INTEGER NOT NULL, -- First ticket number in pack
    current_ticket INTEGER, -- Last read ticket number
    status VARCHAR(50) NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'sold_out')),
    activated_at TIMESTAMP,
    activated_by UUID REFERENCES users(id),
    sold_out_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pack_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_lottery_packs_store ON lottery_packs(store_id);
CREATE INDEX IF NOT EXISTS idx_lottery_packs_game ON lottery_packs(game_id);
CREATE INDEX IF NOT EXISTS idx_lottery_packs_box ON lottery_packs(store_id, box_label);
CREATE INDEX IF NOT EXISTS idx_lottery_packs_status ON lottery_packs(status);

-- Instant Lottery Readings
CREATE TABLE IF NOT EXISTS lottery_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    pack_id UUID NOT NULL REFERENCES lottery_packs(id) ON DELETE CASCADE,
    box_label VARCHAR(50) NOT NULL,
    ticket_number INTEGER NOT NULL,
    reading_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL REFERENCES users(id),
    source VARCHAR(50) NOT NULL DEFAULT 'manual' CHECK (source IN ('scan', 'manual', 'ocr', 'automated')),
    note TEXT,
    photo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lottery_readings_store ON lottery_readings(store_id);
CREATE INDEX IF NOT EXISTS idx_lottery_readings_pack ON lottery_readings(pack_id);
CREATE INDEX IF NOT EXISTS idx_lottery_readings_date ON lottery_readings(store_id, reading_ts);
CREATE INDEX IF NOT EXISTS idx_lottery_readings_pack_date ON lottery_readings(pack_id, reading_ts);

-- Instant Lottery Daily Summary (per store, per date)
CREATE TABLE IF NOT EXISTS lottery_instant_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    instant_face_sales DECIMAL(10, 2) DEFAULT 0.00, -- Total face value sold
    instant_payouts DECIMAL(10, 2) DEFAULT 0.00, -- Total cash paid out
    instant_returns DECIMAL(10, 2) DEFAULT 0.00, -- Returns/voids/adjustments
    instant_net_sale_ops DECIMAL(10, 2) DEFAULT 0.00, -- Face sales - payouts - returns
    instant_commission DECIMAL(10, 2) DEFAULT 0.00, -- Total commission for instant
    is_locked BOOLEAN DEFAULT false,
    locked_at TIMESTAMP,
    locked_by UUID REFERENCES users(id),
    needs_review BOOLEAN DEFAULT false,
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, date)
);

CREATE INDEX IF NOT EXISTS idx_lottery_instant_days_store_date ON lottery_instant_days(store_id, date);

-- Instant Lottery Daily Summary by Game (detailed breakdown)
CREATE TABLE IF NOT EXISTS lottery_instant_day_games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instant_day_id UUID NOT NULL REFERENCES lottery_instant_days(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES lottery_games(id),
    tickets_sold INTEGER DEFAULT 0,
    ticket_price DECIMAL(10, 2) NOT NULL,
    commission_rate DECIMAL(5, 4) NOT NULL,
    commission_amount DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(instant_day_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_lottery_instant_day_games_day ON lottery_instant_day_games(instant_day_id);
CREATE INDEX IF NOT EXISTS idx_lottery_instant_day_games_game ON lottery_instant_day_games(game_id);

-- ============================================
-- DRAW/ONLINE LOTTERY TABLES
-- ============================================

-- Draw/Online Lottery Daily Summary
CREATE TABLE IF NOT EXISTS lottery_draw_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    total_sales DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_cashed DECIMAL(10, 2) DEFAULT 0.00,
    adjustments DECIMAL(10, 2) DEFAULT 0.00,
    net_sale DECIMAL(10, 2) DEFAULT 0.00, -- sales - cashed - adjustments
    commission_source VARCHAR(50) CHECK (commission_source IN ('statement', 'manual', 'rate')),
    commission_amount DECIMAL(10, 2),
    notes TEXT,
    attachment_url VARCHAR(500), -- For terminal tape/portal CSV/PDF
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, date)
);

CREATE INDEX IF NOT EXISTS idx_lottery_draw_days_store_date ON lottery_draw_days(store_id, date);

-- ============================================
-- SETTLEMENT & RECONCILIATION
-- ============================================

-- Lottery Settlements (from operators)
CREATE TABLE IF NOT EXISTS lottery_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    operator_id UUID REFERENCES lottery_operators(id),
    period_from DATE NOT NULL,
    period_to DATE NOT NULL,
    instant_commission_reported DECIMAL(10, 2),
    draw_commission_reported DECIMAL(10, 2),
    withholdings DECIMAL(10, 2) DEFAULT 0.00,
    fees DECIMAL(10, 2) DEFAULT 0.00,
    net_amount DECIMAL(10, 2) NOT NULL,
    source_ref VARCHAR(255), -- Reference number from operator
    source_file_url VARCHAR(500), -- Original statement file
    import_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    imported_by UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'reconciled', 'disputed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lottery_settlements_store ON lottery_settlements(store_id);
CREATE INDEX IF NOT EXISTS idx_lottery_settlements_period ON lottery_settlements(store_id, period_from, period_to);

-- ============================================
-- ANOMALY DETECTION
-- ============================================

-- Lottery Anomalies
CREATE TABLE IF NOT EXISTS lottery_anomalies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    pack_id UUID REFERENCES lottery_packs(id),
    box_label VARCHAR(50),
    reading_id UUID REFERENCES lottery_readings(id),
    date DATE NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('regression', 'swap', 'stall', 'outlier')),
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    detail TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'acknowledged')),
    resolved_by UUID REFERENCES users(id),
    resolved_note TEXT,
    resolved_ts TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lottery_anomalies_store ON lottery_anomalies(store_id);
CREATE INDEX IF NOT EXISTS idx_lottery_anomalies_status ON lottery_anomalies(status);
CREATE INDEX IF NOT EXISTS idx_lottery_anomalies_date ON lottery_anomalies(store_id, date);
CREATE INDEX IF NOT EXISTS idx_lottery_anomalies_pack ON lottery_anomalies(pack_id);

-- ============================================
-- GL POSTING
-- ============================================

-- Lottery GL Posting Batches
CREATE TABLE IF NOT EXISTS lottery_gl_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gl_batch_id UUID REFERENCES journal_entries(id), -- Link to GL batch
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    instant_commission DECIMAL(10, 2) DEFAULT 0.00,
    draw_commission DECIMAL(10, 2) DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'blocked', 'warning')),
    warnings JSONB, -- Array of warning messages
    posted_at TIMESTAMP,
    posted_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, date)
);

CREATE INDEX IF NOT EXISTS idx_lottery_gl_posts_store_date ON lottery_gl_posts(store_id, date);
CREATE INDEX IF NOT EXISTS idx_lottery_gl_posts_status ON lottery_gl_posts(status);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamps
CREATE TRIGGER update_lottery_boxes_updated_at BEFORE UPDATE ON lottery_boxes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lottery_games_updated_at BEFORE UPDATE ON lottery_games
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lottery_programs_updated_at BEFORE UPDATE ON lottery_programs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lottery_operators_updated_at BEFORE UPDATE ON lottery_operators
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lottery_policies_updated_at BEFORE UPDATE ON lottery_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lottery_packs_updated_at BEFORE UPDATE ON lottery_packs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lottery_instant_days_updated_at BEFORE UPDATE ON lottery_instant_days
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lottery_draw_days_updated_at BEFORE UPDATE ON lottery_draw_days
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lottery_settlements_updated_at BEFORE UPDATE ON lottery_settlements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lottery_anomalies_updated_at BEFORE UPDATE ON lottery_anomalies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lottery_gl_posts_updated_at BEFORE UPDATE ON lottery_gl_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

