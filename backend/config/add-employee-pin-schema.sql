-- Adds a reusable handheld PIN hash directly on users (for employee access)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS employee_pin_hash VARCHAR(255);

COMMENT ON COLUMN users.employee_pin_hash IS 'BCrypt hashed 4-6 digit PIN for employee handheld access';

