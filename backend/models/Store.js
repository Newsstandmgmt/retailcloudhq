const { query } = require('../config/database');

class Store {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.address = data.address;
        this.city = data.city;
        this.state = data.state;
        this.zip_code = data.zip_code;
        this.phone = data.phone;
        this.admin_id = data.admin_id;
        this.manager_id = data.manager_id;
        this.template_id = data.template_id;
        this.lottery_retailer_id = data.lottery_retailer_id;
        this.is_active = data.is_active;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }
    
    // Create a new store
    static async create(storeData) {
        const { name, address, city, state, zip_code, phone, admin_id, manager_id, template_id, lottery_retailer_id, created_by } = storeData;
        
        if (!name) {
            throw new Error('Store name is required');
        }
        
        // Clean up empty strings to null for database compatibility
        const cleanValue = (val) => (val === '' || val === undefined) ? null : val;
        
        // Check which columns exist in the database
        const columnCheck = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'stores' 
            AND column_name IN ('created_by', 'lottery_retailer_id', 'template_id')
        `);
        
        const existingColumns = columnCheck.rows.map(row => row.column_name);
        const hasCreatedBy = existingColumns.includes('created_by');
        const hasLotteryRetailerId = existingColumns.includes('lottery_retailer_id');
        const hasTemplateId = existingColumns.includes('template_id');
        
        console.log('Available columns:', { hasCreatedBy, hasLotteryRetailerId, hasTemplateId });
        
        // Build dynamic INSERT statement based on available columns
        const columns = ['name', 'address', 'city', 'state', 'zip_code', 'phone', 'admin_id', 'manager_id'];
        const values = [
            name,
            cleanValue(address),
            cleanValue(city),
            cleanValue(state),
            cleanValue(zip_code),
            cleanValue(phone),
            cleanValue(admin_id),
            cleanValue(manager_id)
        ];
        
        if (hasTemplateId) {
            columns.push('template_id');
            values.push(cleanValue(template_id));
        }
        
        if (hasLotteryRetailerId) {
            columns.push('lottery_retailer_id');
            values.push(cleanValue(lottery_retailer_id));
        }
        
        if (hasCreatedBy) {
            columns.push('created_by');
            values.push(cleanValue(created_by));
        }
        
        // Build parameterized query
        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
        const columnsList = columns.join(', ');
        
        console.log('Attempting to insert store with columns:', columns);
        console.log('Values:', values);
        
        try {
            const result = await query(
                `INSERT INTO stores (${columnsList})
                 VALUES (${placeholders})
                 RETURNING *`,
                values
            );
            return result.rows[0];
        } catch (error) {
            console.error('Store creation error:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('Error detail:', error.detail);
            console.error('Error constraint:', error.constraint);
            
            // If it's a foreign key constraint error, provide better error message
            if (error.code === '23503') {
                const constraintName = error.constraint || 'unknown';
                const detail = error.detail || error.message;
                throw new Error(`Foreign key constraint violation (${constraintName}): ${detail}`);
            }
            throw error;
        }
    }
    
    // Find store by ID
    static async findById(id) {
        const result = await query(
            'SELECT * FROM stores WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }
    
    // Get all stores
    static async findAll(filters = {}) {
        let sql = 'SELECT * FROM stores WHERE 1=1';
        const params = [];
        let paramCount = 1;
        
        if (filters.admin_id) {
            sql += ` AND admin_id = $${paramCount}`;
            params.push(filters.admin_id);
            paramCount++;
        }
        
        if (filters.manager_id) {
            sql += ` AND manager_id = $${paramCount}`;
            params.push(filters.manager_id);
            paramCount++;
        }
        
        if (filters.is_active !== undefined) {
            sql += ` AND is_active = $${paramCount}`;
            params.push(filters.is_active);
            paramCount++;
        }
        
        sql += ' ORDER BY name';
        
        const result = await query(sql, params);
        return result.rows;
    }
    
    // Update store
    static async update(id, updateData) {
        const allowedFields = ['name', 'address', 'city', 'state', 'zip_code', 'phone', 'admin_id', 'manager_id', 'template_id', 'lottery_retailer_id', 'is_active', 'created_by', 'cash_drawer_type', 'register_starting_cash', 'enable_newspaper_sales'];
        const updates = [];
        const values = [];
        let paramCount = 1;
        
        // Check which columns actually exist in the database
        try {
            const columnCheck = await query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'stores' AND column_name = ANY($1::text[])
            `, [allowedFields]);
            
            const existingColumns = columnCheck.rows.map(row => row.column_name);
            
            for (const field of allowedFields) {
                // Only include fields that exist in the database and are in updateData
                if (existingColumns.includes(field) && updateData[field] !== undefined) {
                    updates.push(`${field} = $${paramCount}`);
                    // Handle JSONB fields specially
                    if (field === 'register_starting_cash' && typeof updateData[field] === 'object') {
                        values.push(JSON.stringify(updateData[field]));
                    } else {
                        values.push(updateData[field] === '' ? null : updateData[field]);
                    }
                    paramCount++;
                }
            }
        } catch (error) {
            console.warn('Column check failed, using basic fields:', error.message);
            // If column check fails, fall back to basic fields that should always exist
            const basicFields = ['name', 'address', 'city', 'state', 'zip_code', 'phone', 'admin_id', 'manager_id', 'template_id', 'lottery_retailer_id', 'is_active'];
            for (const field of basicFields) {
                if (updateData[field] !== undefined) {
                    updates.push(`${field} = $${paramCount}`);
                    values.push(updateData[field] === '' ? null : updateData[field]);
                    paramCount++;
                }
            }
        }
        
        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }
        
        values.push(id);
        const result = await query(
            `UPDATE stores SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${paramCount}
             RETURNING *`,
            values
        );
        
        return result.rows[0] || null;
    }
    
    // Get store with template info
    static async findByIdWithTemplate(id) {
        const result = await query(
            `SELECT s.*, st.name as template_name, st.description as template_description
             FROM stores s
             LEFT JOIN store_templates st ON s.template_id = st.id
             WHERE s.id = $1`,
            [id]
        );
        return result.rows[0] || null;
    }
    
    // Assign employee to store
    static async assignEmployee(storeId, userId) {
        const result = await query(
            `INSERT INTO user_store_assignments (user_id, store_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, store_id) DO NOTHING
             RETURNING *`,
            [userId, storeId]
        );
        return result.rows[0] || null;
    }
    
    // Remove employee from store
    static async removeEmployee(storeId, userId) {
        const result = await query(
            'DELETE FROM user_store_assignments WHERE user_id = $1 AND store_id = $2 RETURNING *',
            [userId, storeId]
        );
        return result.rows[0] || null;
    }
    
    // Get store employees
    static async getEmployees(storeId) {
        const result = await query(
            `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.phone, u.is_active
             FROM users u
             JOIN user_store_assignments usa ON usa.user_id = u.id
             WHERE usa.store_id = $1
             ORDER BY u.last_name`,
            [storeId]
        );
        return result.rows;
    }
    
    // Soft delete store (set is_active to false and deleted_at timestamp)
    static async delete(id) {
        try {
            // Check if deleted_at column exists
            const columnCheck = await query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'stores' AND column_name = 'deleted_at'
            `);
            
            const hasDeletedAtColumn = columnCheck.rows.length > 0;
            
            if (hasDeletedAtColumn) {
                const result = await query(
                    'UPDATE stores SET is_active = false, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
                    [id]
                );
                return result.rows[0] || null;
            } else {
                // If deleted_at column doesn't exist, just set is_active to false
                const result = await query(
                    'UPDATE stores SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
                    [id]
                );
                return result.rows[0] || null;
            }
        } catch (error) {
            console.error('Error deleting store:', error);
            throw error;
        }
    }
    
    // Restore deleted store (set is_active to true and clear deleted_at)
    static async restore(id) {
        try {
            // Check if deleted_at column exists
            const columnCheck = await query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'stores' AND column_name = 'deleted_at'
            `);
            
            const hasDeletedAtColumn = columnCheck.rows.length > 0;
            
            if (hasDeletedAtColumn) {
                const result = await query(
                    'UPDATE stores SET is_active = true, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
                    [id]
                );
                return result.rows[0] || null;
            } else {
                // If deleted_at column doesn't exist, just set is_active to true
                const result = await query(
                    'UPDATE stores SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
                    [id]
                );
                return result.rows[0] || null;
            }
        } catch (error) {
            console.error('Error restoring store:', error);
            throw error;
        }
    }
    
    // Toggle store active status (does NOT set deleted_at - only for activate/deactivate)
    static async toggleActive(id) {
        const result = await query(
            `UPDATE stores 
             SET is_active = NOT is_active, 
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1 AND deleted_at IS NULL
             RETURNING *`,
            [id]
        );
        return result.rows[0] || null;
    }
    
    // Get all stores including deleted (for super admin)
    static async findAllIncludingDeleted() {
        const result = await query(
            'SELECT * FROM stores ORDER BY created_at DESC'
        );
        return result.rows;
    }
}

module.exports = Store;

