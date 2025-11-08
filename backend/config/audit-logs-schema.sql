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

