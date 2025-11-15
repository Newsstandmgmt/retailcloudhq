const { query } = require('../config/database');

class PurchaseInvoiceAllocation {
    static async create(data = {}) {
        const {
            parent_invoice_id,
            child_invoice_id = null,
            source_store_id,
            target_store_id,
            cross_store_payment_id = null,
            allocation_amount = null,
            allocation_metadata = {},
            created_by = null,
            updated_by = null,
        } = data;

        const result = await query(
            `INSERT INTO purchase_invoice_allocations (
                parent_invoice_id,
                child_invoice_id,
                source_store_id,
                target_store_id,
                cross_store_payment_id,
                allocation_amount,
                allocation_metadata,
                created_by,
                updated_by
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING *`,
            [
                parent_invoice_id,
                child_invoice_id,
                source_store_id,
                target_store_id,
                cross_store_payment_id,
                allocation_amount,
                allocation_metadata || {},
                created_by,
                updated_by || created_by,
            ]
        );

        return result.rows[0];
    }

    static async update(id, updates = {}) {
        const fields = [];
        const values = [];
        let idx = 1;
        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = $${idx}`);
            values.push(value);
            idx++;
        }
        if (fields.length === 0) {
            return this.findById(id);
        }
        values.push(id);
        const result = await query(
            `UPDATE purchase_invoice_allocations
             SET ${fields.join(', ')},
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $${idx}
             RETURNING *`,
            values
        );
        return result.rows[0] || null;
    }

    static async delete(id) {
        await query('DELETE FROM purchase_invoice_allocations WHERE id = $1', [id]);
    }

    static async findByParent(parentInvoiceId) {
        const result = await query(
            `SELECT * FROM purchase_invoice_allocations
             WHERE parent_invoice_id = $1
             ORDER BY created_at`,
            [parentInvoiceId]
        );
        return result.rows;
    }

    static async findById(id) {
        const result = await query(
            'SELECT * FROM purchase_invoice_allocations WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }
}

module.exports = PurchaseInvoiceAllocation;

