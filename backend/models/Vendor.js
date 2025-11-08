const { query } = require('../config/database');

class Vendor {
    constructor(data) {
        Object.assign(this, data);
    }

    // Create vendor
    static async create(storeId, vendorData) {
        const { name, contact_name, email, phone, address, city, state, zip_code, notes } = vendorData;
        
        const result = await query(
            `INSERT INTO vendors (store_id, name, contact_name, email, phone, address, city, state, zip_code, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [storeId, name, contact_name || null, email || null, phone || null, address || null, city || null, state || null, zip_code || null, notes || null]
        );
        
        return result.rows[0];
    }

    // Get all vendors for a store
    static async findByStore(storeId) {
        const result = await query(
            'SELECT * FROM vendors WHERE store_id = $1 AND is_active = true ORDER BY name',
            [storeId]
        );
        return result.rows;
    }

    // Get vendor by ID
    static async findById(id) {
        const result = await query(
            'SELECT * FROM vendors WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }

    // Update vendor
    static async update(id, vendorData) {
        const allowedFields = ['name', 'contact_name', 'email', 'phone', 'address', 'city', 'state', 'zip_code', 'notes', 'is_active'];
        const updates = [];
        const values = [];
        let paramCount = 1;

        for (const field of allowedFields) {
            if (vendorData[field] !== undefined) {
                updates.push(`${field} = $${paramCount}`);
                values.push(vendorData[field]);
                paramCount++;
            }
        }

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        values.push(id);
        const result = await query(
            `UPDATE vendors SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${paramCount}
             RETURNING *`,
            values
        );

        return result.rows[0] || null;
    }

    // Delete vendor (soft delete)
    static async delete(id) {
        const result = await query(
            'UPDATE vendors SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0] || null;
    }
}

module.exports = Vendor;

