-- Add License Management feature to store_features table
-- This allows License Management to be priced and added as an addon feature

INSERT INTO store_features (feature_key, feature_name, description, category) VALUES
    ('license_management', 'License Management', 'Manage store licenses, expiration dates, renewals, and reminders', 'operations')
ON CONFLICT (feature_key) DO NOTHING;

