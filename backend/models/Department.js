const { query } = require('../config/database');

class Department {
    constructor(data) {
        Object.assign(this, data);
    }

    // Create department
    static async create(storeId, departmentData) {
        const { name, description } = departmentData;
        
        const result = await query(
            `INSERT INTO departments (store_id, name, description)
             VALUES ($1, $2, $3)
             ON CONFLICT (store_id, name) DO UPDATE SET
                 description = EXCLUDED.description,
                 updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [storeId, name, description || null]
        );
        
        return result.rows[0];
    }

    // Get all departments for a store
    static async findByStore(storeId) {
        const result = await query(
            'SELECT * FROM departments WHERE store_id = $1 AND is_active = true ORDER BY name',
            [storeId]
        );
        return result.rows;
    }

    // Get department by ID
    static async findById(id) {
        const result = await query(
            'SELECT * FROM departments WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }

    // Update department
    static async update(id, departmentData) {
        const allowedFields = ['name', 'description', 'is_active'];
        const updates = [];
        const values = [];
        let paramCount = 1;

        for (const field of allowedFields) {
            if (departmentData[field] !== undefined) {
                updates.push(`${field} = $${paramCount}`);
                values.push(departmentData[field]);
                paramCount++;
            }
        }

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        values.push(id);
        const result = await query(
            `UPDATE departments SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${paramCount}
             RETURNING *`,
            values
        );

        return result.rows[0] || null;
    }

    // Delete department (soft delete)
    static async delete(id) {
        const result = await query(
            'UPDATE departments SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0] || null;
    }
}

module.exports = Department;

