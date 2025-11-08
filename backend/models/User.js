const { query } = require('../config/database');
const bcrypt = require('bcrypt');

class User {
    constructor(data) {
        this.id = data.id;
        this.email = data.email;
        this.password_hash = data.password_hash;
        this.first_name = data.first_name;
        this.last_name = data.last_name;
        this.role = data.role;
        this.phone = data.phone;
        this.is_active = data.is_active;
        this.created_by = data.created_by;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }
    
    // Create a new user
    static async create(userData) {
        const { email, password, first_name, last_name, role, phone, created_by, must_change_password } = userData;
        
        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);
        
        const result = await query(
            `INSERT INTO users (email, password_hash, first_name, last_name, role, phone, created_by, must_change_password)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, email, first_name, last_name, role, phone, is_active, must_change_password, created_at`,
            [email, password_hash, first_name, last_name, role, phone || null, created_by || null, must_change_password || false]
        );
        
        return result.rows[0];
    }
    
    // Find user by ID
    static async findById(id) {
        const result = await query(
            'SELECT id, email, first_name, last_name, role, phone, is_active, must_change_password, created_at, updated_at FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }
    
    // Find user by email
    static async findByEmail(email) {
        const result = await query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        return result.rows[0] || null;
    }
    
    // Verify password
    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
    
    // Update user
    static async update(id, updateData) {
        const allowedFields = ['first_name', 'last_name', 'phone', 'role', 'is_active'];
        const updates = [];
        const values = [];
        let paramCount = 1;
        
        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                updates.push(`${field} = $${paramCount}`);
                values.push(updateData[field]);
                paramCount++;
            }
        }
        
        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }
        
        values.push(id);
        const result = await query(
            `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${paramCount}
             RETURNING id, email, first_name, last_name, role, phone, is_active, updated_at`,
            values
        );
        
        return result.rows[0] || null;
    }
    
    // Change password
    static async changePassword(id, newPassword, clearMustChangeFlag = false) {
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(newPassword, saltRounds);
        
        let sql = 'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP';
        const params = [password_hash];
        
        if (clearMustChangeFlag) {
            sql += ', must_change_password = false';
        }
        
        sql += ' WHERE id = $' + (params.length + 1) + ' RETURNING id';
        params.push(id);
        
        const result = await query(sql, params);
        
        return result.rows[0] || null;
    }
    
    // Change own password (for first login)
    static async changeOwnPassword(id, oldPassword, newPassword) {
        // First verify old password
        const user = await this.findById(id);
        if (!user) {
            throw new Error('User not found');
        }
        
        // Get full user with password hash
        const fullUser = await query('SELECT password_hash FROM users WHERE id = $1', [id]);
        if (fullUser.rows.length === 0) {
            throw new Error('User not found');
        }
        
        const isValidPassword = await this.verifyPassword(oldPassword, fullUser.rows[0].password_hash);
        if (!isValidPassword) {
            throw new Error('Current password is incorrect');
        }
        
        // Change password and clear must_change_password flag
        return await this.changePassword(id, newPassword, true);
    }
    
    // Get all users (with filtering)
    static async findAll(filters = {}) {
        let sql = 'SELECT id, email, first_name, last_name, role, phone, is_active, created_by, created_at FROM users WHERE 1=1';
        const params = [];
        let paramCount = 1;
        
        if (filters.role) {
            sql += ` AND role = $${paramCount}`;
            params.push(filters.role);
            paramCount++;
        }
        
        if (filters.is_active !== undefined) {
            sql += ` AND is_active = $${paramCount}`;
            params.push(filters.is_active);
            paramCount++;
        }
        
        sql += ' ORDER BY created_at DESC';
        
        const result = await query(sql, params);
        return result.rows;
    }
    
    // Get users by store (employees and managers)
    static async findByStore(storeId) {
        const result = await query(
            `SELECT DISTINCT u.id, u.email, u.first_name, u.last_name, u.role, u.phone, u.is_active
             FROM users u
             LEFT JOIN stores s ON s.manager_id = u.id OR s.admin_id = u.id
             LEFT JOIN user_store_assignments usa ON usa.user_id = u.id
             WHERE (s.id = $1 OR usa.store_id = $1)
             ORDER BY u.role, u.last_name`,
            [storeId]
        );
        return result.rows;
    }
    
    // Delete user (soft delete by setting is_active to false)
    static async delete(id) {
        const result = await query(
            'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
            [id]
        );
        return result.rows[0] || null;
    }
}

module.exports = User;

