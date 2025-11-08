const { query } = require('../config/database');

class AdminConfig {
    constructor(data) {
        Object.assign(this, data);
    }
    
    // Create or update admin configuration
    static async upsert(userId, configData) {
        const bcrypt = require('bcrypt');
        const {
            max_stores = null,
            features = {},
            assigned_stores = [],
            master_pin = null
        } = configData;
        
        // Hash master PIN if provided
        let masterPinHash = null;
        if (master_pin) {
            masterPinHash = await bcrypt.hash(master_pin, 10);
        }
        
        // If master_pin is not provided but we're updating, keep existing PIN
        const result = await query(
            `INSERT INTO admin_config (user_id, max_stores, features, assigned_stores, master_pin_hash)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id)
             DO UPDATE SET
                 max_stores = EXCLUDED.max_stores,
                 features = EXCLUDED.features,
                 assigned_stores = EXCLUDED.assigned_stores,
                 master_pin_hash = COALESCE(EXCLUDED.master_pin_hash, admin_config.master_pin_hash),
                 updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId, max_stores, JSON.stringify(features), assigned_stores, masterPinHash]
        );
        
        return result.rows[0];
    }
    
    // Get admin config by user ID
    static async findByUserId(userId) {
        const result = await query(
            'SELECT * FROM admin_config WHERE user_id = $1',
            [userId]
        );
        return result.rows[0] || null;
    }
    
    // Get all admin configs (only active admins)
    static async findAll() {
        const result = await query(
            `SELECT ac.*, u.id, u.email, u.first_name, u.last_name, u.role, u.is_active
             FROM admin_config ac
             JOIN users u ON u.id = ac.user_id
             WHERE u.is_active = true 
             AND u.role IN ('admin', 'super_admin')
             ORDER BY u.created_at DESC`
        );
        return result.rows;
    }
    
    // Check if admin can create more stores
    static async canCreateStore(userId) {
        const config = await this.findByUserId(userId);
        if (!config || config.max_stores === null) {
            return true; // No limit
        }
        
        // Count stores created by this admin
        const storeCount = await query(
            'SELECT COUNT(*) FROM stores WHERE created_by = $1',
            [userId]
        );
        
        return parseInt(storeCount.rows[0].count) < config.max_stores;
    }
    
    // Get stores accessible by user
    static async getAccessibleStores(userId, userRole, adminId = null, includeInactive = false) {
        // If super admin is viewing stores for a specific admin
        if (userRole === 'super_admin' && adminId) {
            // Super admin sees all stores for this admin (active, deactivated, and deleted)
            // Always include inactive for super admin view
            // Include template information for subscription display
            const result = await query(
                `SELECT s.*, 
                        st.name as template_name,
                        st.price_per_month as template_price,
                        st.billing_cycle as template_billing_cycle
                 FROM stores s
                 LEFT JOIN store_templates st ON st.id = s.template_id
                 WHERE s.created_by = $1 
                 ORDER BY s.deleted_at NULLS LAST, s.is_active DESC, s.created_at DESC`,
                [adminId]
            );
            return result.rows;
        }
        
        if (userRole === 'super_admin') {
            // Super admin sees all stores (active and deactivated, but NOT deleted)
            // Include admin information (created_by user) and template info
            // Check if deleted_at column exists first
            try {
                const columnCheck = await query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'stores' AND column_name = 'deleted_at'
                `);
                
                const hasDeletedAtColumn = columnCheck.rows.length > 0;
                const whereClause = hasDeletedAtColumn ? 'WHERE s.deleted_at IS NULL' : '';
                
                const result = await query(
                    `SELECT s.*, 
                            u.id as admin_id,
                            u.first_name as admin_first_name,
                            u.last_name as admin_last_name,
                            u.email as admin_email,
                            st.name as template_name,
                            st.description as template_description
                     FROM stores s
                     LEFT JOIN users u ON u.id = s.created_by
                     LEFT JOIN store_templates st ON st.id = s.template_id
                     ${whereClause}
                     ORDER BY s.is_active DESC, s.created_at DESC`
                );
                return result.rows;
            } catch (error) {
                // If column check fails, just query without deleted_at filter
                console.warn('Could not check for deleted_at column, querying all stores:', error.message);
                const result = await query(
                    `SELECT s.*, 
                            u.id as admin_id,
                            u.first_name as admin_first_name,
                            u.last_name as admin_last_name,
                            u.email as admin_email,
                            st.name as template_name,
                            st.description as template_description
                     FROM stores s
                     LEFT JOIN users u ON u.id = s.created_by
                     LEFT JOIN store_templates st ON st.id = s.template_id
                     ORDER BY s.is_active DESC, s.created_at DESC`
                );
                return result.rows;
            }
        }
        
        if (userRole === 'admin') {
            // Admin sees stores they created or are assigned to
            // Show active AND deactivated (is_active = false) but NOT deleted (deleted_at IS NOT NULL)
            // Always include inactive stores for admin - they should see deactivated stores
            // Include template information for subscription display
            const sql = `SELECT DISTINCT s.*, 
                               st.name as template_name,
                               st.price_per_month as template_price,
                               st.billing_cycle as template_billing_cycle
                      FROM stores s
                      LEFT JOIN store_templates st ON st.id = s.template_id
                      LEFT JOIN admin_config ac ON ac.user_id = $1
                      WHERE (s.created_by = $1 OR s.id = ANY(COALESCE(ac.assigned_stores, ARRAY[]::UUID[])))
                      AND s.deleted_at IS NULL
                      ORDER BY s.is_active DESC, s.created_at DESC`;
            const result = await query(sql, [userId]);
            return result.rows;
        }
        
        if (userRole === 'manager') {
            // Manager sees stores they're assigned to (active and deactivated, but NOT deleted)
            // Always include inactive stores for manager - they should see deactivated stores
            // Include template information for subscription display
            const sql = `SELECT s.*, 
                               st.name as template_name,
                               st.price_per_month as template_price,
                               st.billing_cycle as template_billing_cycle
                      FROM stores s
                      LEFT JOIN store_templates st ON st.id = s.template_id
                      JOIN store_managers sm ON sm.store_id = s.id
                      WHERE sm.manager_id = $1
                      AND s.deleted_at IS NULL
                      ORDER BY s.is_active DESC, s.created_at DESC`;
            const result = await query(sql, [userId]);
            return result.rows;
        }
        
        // Employee sees stores they're assigned to (active and deactivated, but NOT deleted)
        let sql = `SELECT s.* 
                  FROM stores s
                  JOIN store_employees se ON se.store_id = s.id
                  WHERE se.employee_id = $1
                  AND s.deleted_at IS NULL`;
        if (!includeInactive) {
            sql += ' AND s.is_active = true';
        }
        sql += ' ORDER BY s.created_at DESC';
        const result = await query(sql, [userId]);
        return result.rows;
    }
    
    // Check if user can access a specific store
    static async canAccessStore(userId, userRole, storeId) {
        try {
            // Super admin can access all stores
            if (userRole === 'super_admin') {
                return true;
            }
            
            // Use database function to check access
            const result = await query(
                'SELECT can_user_access_store($1, $2) as can_access',
                [userId, storeId]
            );
            
            return result.rows[0]?.can_access === true;
        } catch (error) {
            console.error('Error checking store access:', error);
            return false;
        }
    }
}

module.exports = AdminConfig;

