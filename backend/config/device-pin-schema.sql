-- Device PIN Authentication Schema
-- Adds PIN-based authentication for mobile devices

-- Add PIN to user_device_permissions (device-specific PIN for employees)
ALTER TABLE user_device_permissions 
ADD COLUMN IF NOT EXISTS device_pin_hash VARCHAR(255);

-- Add master PIN to admin_config (for admin/manager users - works across all devices)
ALTER TABLE admin_config 
ADD COLUMN IF NOT EXISTS master_pin_hash VARCHAR(255);

-- Add index for PIN lookups
CREATE INDEX IF NOT EXISTS idx_user_device_permissions_pin ON user_device_permissions(device_pin_hash) WHERE device_pin_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_config_master_pin ON admin_config(master_pin_hash) WHERE master_pin_hash IS NOT NULL;

-- Comments
COMMENT ON COLUMN user_device_permissions.device_pin_hash IS 'Hashed PIN for employee login on this specific device';
COMMENT ON COLUMN admin_config.master_pin_hash IS 'Hashed master PIN for admin/manager login (works on all devices)';

