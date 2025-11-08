-- Script to deactivate test users, keeping only the user with stores
-- This will:
-- 1. Find the user who has active stores
-- 2. Deactivate all other users

-- First, let's see all active users and their store counts
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.role,
    COUNT(s.id) FILTER (WHERE s.is_active = true AND s.deleted_at IS NULL) as store_count
FROM users u
LEFT JOIN stores s ON s.created_by = u.id OR s.admin_id = u.id
WHERE u.is_active = true
GROUP BY u.id, u.email, u.first_name, u.last_name, u.role
ORDER BY store_count DESC, u.created_at ASC;

-- After reviewing the results above, identify the user ID you want to keep active
-- Then run this command (replace 'YOUR_USER_ID_HERE' with the actual UUID):
-- 
-- UPDATE users 
-- SET is_active = false, updated_at = CURRENT_TIMESTAMP
-- WHERE id != 'YOUR_USER_ID_HERE' AND is_active = true;
--
-- Or, to keep only the user with stores (automatically):
-- 
-- UPDATE users 
-- SET is_active = false, updated_at = CURRENT_TIMESTAMP
-- WHERE id NOT IN (
--     SELECT DISTINCT COALESCE(s.created_by, s.admin_id)
--     FROM stores s
--     WHERE s.is_active = true AND s.deleted_at IS NULL
--     AND COALESCE(s.created_by, s.admin_id) IS NOT NULL
-- ) AND is_active = true;

-- Automated version: Deactivate all users except those who have active stores
UPDATE users 
SET is_active = false, updated_at = CURRENT_TIMESTAMP
WHERE id NOT IN (
    SELECT DISTINCT COALESCE(s.created_by, s.admin_id)
    FROM stores s
    WHERE s.is_active = true AND s.deleted_at IS NULL
    AND COALESCE(s.created_by, s.admin_id) IS NOT NULL
) AND is_active = true;

-- Verify the results
SELECT 
    COUNT(*) as total_active_users,
    COUNT(*) FILTER (WHERE role = 'super_admin') as super_admins,
    COUNT(*) FILTER (WHERE role = 'admin') as admins
FROM users
WHERE is_active = true;

