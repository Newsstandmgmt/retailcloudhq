-- Store Licenses Management Table
-- Tracks all licenses for stores with expiration dates, costs, and reminders

CREATE TABLE IF NOT EXISTS store_licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    
    license_type VARCHAR(255) NOT NULL,
    license_number VARCHAR(255) NOT NULL,
    expiration_date DATE NOT NULL,
    
    -- File upload
    file_path TEXT, -- Path to uploaded license document
    file_name VARCHAR(255), -- Original filename
    
    -- Cost and renewal
    renewal_cost DECIMAL(10, 2) DEFAULT 0,
    renewal_date DATE, -- Date when license was renewed
    
    -- Reminder settings
    reminder_days_before INTEGER DEFAULT 30, -- Days before expiration to send reminder
    last_reminder_sent DATE, -- Last date reminder was sent
    reminder_sent BOOLEAN DEFAULT false, -- Whether reminder has been sent
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_expired BOOLEAN DEFAULT false,
    
    -- Metadata
    entered_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_store_licenses_store ON store_licenses(store_id);
CREATE INDEX IF NOT EXISTS idx_store_licenses_expiration ON store_licenses(expiration_date);
CREATE INDEX IF NOT EXISTS idx_store_licenses_active ON store_licenses(is_active, is_expired);

-- Trigger for updated_at
CREATE TRIGGER update_store_licenses_updated_at BEFORE UPDATE ON store_licenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

