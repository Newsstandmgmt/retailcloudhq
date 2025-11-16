-- Minimal age check logs (idempotent)
CREATE TABLE IF NOT EXISTS age_check_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NULL,
  device_id VARCHAR(128) NOT NULL,
  user_id UUID NULL,
  dob DATE NULL,
  expiry DATE NULL,
  age SMALLINT NULL,
  result VARCHAR(10) NOT NULL, -- 'pass' | 'fail'
  id_hash VARCHAR(128) NULL, -- optional hashed identifier fragment
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_age_checks_store_time ON age_check_logs (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_age_checks_device_time ON age_check_logs (device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_age_checks_result_time ON age_check_logs (result, created_at DESC);


