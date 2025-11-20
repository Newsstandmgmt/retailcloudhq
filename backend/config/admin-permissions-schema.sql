-- Admin Permissions and Store Management Schema
-- This extends the existing user and store tables to support:
-- 1. Admin-specific permissions (max stores, features)
-- 2. Store assignment for managers
-- 3. Feature flags per admin

-- Admin configuration table
CREATE TABLE IF NOT EXISTS admin_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Store management limits
    max_stores INTEGER DEFAULT NULL, -- NULL = unlimited
    
    -- Feature flags (JSONB for flexibility)
    features JSONB DEFAULT '{}'::jsonb, -- e.g., {"can_create_stores": true, "can_manage_users": true, "can_view_reports": true}
    
    -- Store assignment (for managers)
    assigned_stores UUID[] DEFAULT ARRAY[]::UUID[], -- Array of store IDs this admin can manage
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_config_user ON admin_config(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_config_stores ON admin_config USING GIN(assigned_stores);

-- Trigger for updated_at
CREATE TRIGGER update_admin_config_updated_at BEFORE UPDATE ON admin_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Store-Manager relationship (many-to-many)
CREATE TABLE IF NOT EXISTS store_managers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Permissions for this specific store
    can_edit BOOLEAN DEFAULT true,
    can_view_reports BOOLEAN DEFAULT true,
    can_manage_employees BOOLEAN DEFAULT false,
    
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES users(id),
    
    UNIQUE(store_id, manager_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_store_managers_store ON store_managers(store_id);
CREATE INDEX IF NOT EXISTS idx_store_managers_manager ON store_managers(manager_id);

-- Store-Employee relationship (many-to-many)
CREATE TABLE IF NOT EXISTS store_employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES users(id),
    
    UNIQUE(store_id, employee_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_store_employees_store ON store_employees(store_id);
CREATE INDEX IF NOT EXISTS idx_store_employees_employee ON store_employees(employee_id);

-- Function to check if user can access store
CREATE OR REPLACE FUNCTION can_user_access_store(
    p_user_id UUID,
    p_store_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR(50);
    is_assigned BOOLEAN;
    store_deleted_at TIMESTAMP;
BEGIN
    -- Get user role
    SELECT role INTO user_role FROM users WHERE id = p_user_id;
    
    -- Check if store is deleted
    SELECT deleted_at INTO store_deleted_at FROM stores WHERE id = p_store_id;
    
    -- Super admin can access all stores (even deleted ones)
    IF user_role = 'super_admin' THEN
        RETURN true;
    END IF;
    
    -- If store is deleted (deleted_at IS NOT NULL), only super admin can access
    IF store_deleted_at IS NOT NULL THEN
        RETURN false;
    END IF;
    
    -- Admin can access stores they created or are assigned to (not deleted)
    IF user_role = 'admin' THEN
        -- Check if admin created this store
        SELECT EXISTS(
            SELECT 1 FROM stores 
            WHERE id = p_store_id AND created_by = p_user_id AND deleted_at IS NULL
        ) INTO is_assigned;
        
        IF is_assigned THEN
            RETURN true;
        END IF;
        
        -- Check if store is in admin's assigned_stores array
        SELECT EXISTS(
            SELECT 1 FROM admin_config 
            WHERE user_id = p_user_id 
            AND p_store_id = ANY(assigned_stores)
        ) INTO is_assigned;
        
        IF is_assigned THEN
            -- Verify store is not deleted
            SELECT EXISTS(
                SELECT 1 FROM stores WHERE id = p_store_id AND deleted_at IS NULL
            ) INTO is_assigned;
        END IF;
        
        RETURN is_assigned;
    END IF;
    
    -- Manager can access stores they're assigned to (not deleted)
    IF user_role = 'manager' THEN
        SELECT EXISTS(
            SELECT 1 FROM store_managers sm
            JOIN stores s ON s.id = sm.store_id
            WHERE sm.store_id = p_store_id 
            AND sm.manager_id = p_user_id
            AND s.deleted_at IS NULL
        ) INTO is_assigned;
        
        RETURN is_assigned;
    END IF;
    
    -- Employee can access stores they're assigned to (not deleted)
    IF user_role = 'employee' THEN
        SELECT EXISTS(
            SELECT 1 FROM store_employees se
            JOIN stores s ON s.id = se.store_id
            WHERE se.store_id = p_store_id 
            AND se.employee_id = p_user_id
            AND s.deleted_at IS NULL
        ) INTO is_assigned;
        
        RETURN is_assigned;
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql;

