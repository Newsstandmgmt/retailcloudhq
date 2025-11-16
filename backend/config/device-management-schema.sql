-- Idempotent additions for device management enhancements

-- Add reassigned_at and require_wipe/settings to mobile_devices
ALTER TABLE mobile_devices
  ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS require_wipe BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Track who updated permissions
ALTER TABLE user_device_permissions
  ADD COLUMN IF NOT EXISTS updated_by UUID NULL;


