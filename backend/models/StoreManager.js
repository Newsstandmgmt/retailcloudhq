const { query } = require('../config/database');

class StoreManager {
    constructor(data) {
        Object.assign(this, data);
    }
    
    // Assign manager to store
    static async assign(storeId, managerId, permissions = {}, assignedBy) {
        const {
            can_edit = true,
            can_view_reports = true,
            can_manage_employees = false
        } = permissions;
        
        const result = await query(
            `INSERT INTO store_managers (store_id, manager_id, can_edit, can_view_reports, can_manage_employees, assigned_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (store_id, manager_id)
             DO UPDATE SET
                 can_edit = EXCLUDED.can_edit,
                 can_view_reports = EXCLUDED.can_view_reports,
                 can_manage_employees = EXCLUDED.can_manage_employees,
                 assigned_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [storeId, managerId, can_edit, can_view_reports, can_manage_employees, assignedBy || null]
        );
        
        return result.rows[0];
    }
    
    // Remove manager from store
    static async unassign(storeId, managerId) {
        const result = await query(
            'DELETE FROM store_managers WHERE store_id = $1 AND manager_id = $2 RETURNING *',
            [storeId, managerId]
        );
        return result.rows[0];
    }
    
    // Get all managers for a store
    static async findByStore(storeId) {
        const result = await query(
            `SELECT sm.*, u.email, u.first_name, u.last_name, u.role
             FROM store_managers sm
             JOIN users u ON u.id = sm.manager_id
             WHERE sm.store_id = $1
             ORDER BY sm.assigned_at DESC`,
            [storeId]
        );
        return result.rows;
    }
    
    // Get all stores for a manager
    static async findByManager(managerId) {
        const result = await query(
            `SELECT sm.*, s.name as store_name, s.address, s.city, s.state
             FROM store_managers sm
             JOIN stores s ON s.id = sm.store_id
             WHERE sm.manager_id = $1
             ORDER BY s.name`,
            [managerId]
        );
        return result.rows;
    }
    
    // Check if manager has permission
    static async hasPermission(storeId, managerId, permission) {
        const result = await query(
            'SELECT * FROM store_managers WHERE store_id = $1 AND manager_id = $2',
            [storeId, managerId]
        );
        
        if (result.rows.length === 0) {
            return false;
        }
        
        const manager = result.rows[0];
        return manager[permission] === true;
    }
}

module.exports = StoreManager;

