-- Ensure paid addon features exist in store_features
INSERT INTO store_features (feature_key, feature_name, description, category)
VALUES
    ('manager_access', 'Manager Access', 'Unlock manager-level access controls and approvals', 'operations'),
    ('handheld_devices', 'Handheld Devices', 'Register handheld devices and assign employee PINs', 'operations'),
    ('license_management', 'License Management', 'Manage store licenses, expiration dates, renewals, and reminders', 'operations')
ON CONFLICT (feature_key) DO NOTHING;


