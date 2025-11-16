-- Device debug logs (idempotent)
CREATE TABLE IF NOT EXISTS device_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(128) NOT NULL,
  store_id UUID NULL,
  level VARCHAR(10) NOT NULL,
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_device_logs_device_time ON device_logs (device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_logs_store_time ON device_logs (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_logs_level_time ON device_logs (level, created_at DESC);


