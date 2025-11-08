const { query } = require('../config/database');

class Customer {
    constructor(data) {
        Object.assign(this, data);
    }
    
    // Create a new customer
    static async create(storeId, customerData) {
        const { first_name, last_name, email, phone, address, notes } = customerData;
        
        const result = await query(
            `INSERT INTO customers (store_id, first_name, last_name, email, phone, address, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [storeId, first_name || null, last_name || null, email || null, phone || null, address || null, notes || null]
        );
        
        return result.rows[0];
    }
    
    // Find customer by ID
    static async findById(id) {
        const result = await query(
            'SELECT * FROM customers WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }
    
    // Get all customers for a store
    static async findAllByStore(storeId) {
        const result = await query(
            'SELECT * FROM customers WHERE store_id = $1 ORDER BY last_name, first_name',
            [storeId]
        );
        return result.rows;
    }
    
    // Update customer
    static async update(id, updateData) {
        const allowedFields = ['first_name', 'last_name', 'email', 'phone', 'address', 'notes'];
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
            `UPDATE customers SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${paramCount}
             RETURNING *`,
            values
        );
        
        return result.rows[0] || null;
    }
    
    // Delete customer
    static async delete(id) {
        const result = await query(
            'DELETE FROM customers WHERE id = $1 RETURNING id',
            [id]
        );
        return result.rows[0] || null;
    }
}

module.exports = Customer;

