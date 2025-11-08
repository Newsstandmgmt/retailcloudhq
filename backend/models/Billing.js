const { query } = require('../config/database');

class Billing {
    constructor(data) {
        Object.assign(this, data);
    }

    // Create invoice
    static async createInvoice(invoiceData) {
        const { admin_id, amount, billing_period_start, billing_period_end, due_date } = invoiceData;
        
        // Generate invoice number
        const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
        const result = await query(
            `INSERT INTO billing_invoices (admin_id, invoice_number, amount, billing_period_start, billing_period_end, due_date, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending')
             RETURNING *`,
            [admin_id, invoiceNumber, amount, billing_period_start, billing_period_end, due_date]
        );
        
        return result.rows[0];
    }

    // Get invoice by ID
    static async findById(id) {
        const result = await query(
            `SELECT bi.*, u.email, u.first_name, u.last_name 
             FROM billing_invoices bi
             JOIN users u ON u.id = bi.admin_id
             WHERE bi.id = $1`,
            [id]
        );
        return result.rows[0] || null;
    }

    // Get invoices by admin
    static async findByAdmin(adminId) {
        const result = await query(
            `SELECT * FROM billing_invoices 
             WHERE admin_id = $1 
             ORDER BY created_at DESC`,
            [adminId]
        );
        return result.rows;
    }

    // Get all invoices
    static async findAll(filters = {}) {
        let sql = `SELECT bi.*, u.email, u.first_name, u.last_name 
                   FROM billing_invoices bi
                   JOIN users u ON u.id = bi.admin_id
                   WHERE 1=1`;
        const params = [];
        let paramCount = 1;

        if (filters.status) {
            sql += ` AND bi.status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }

        if (filters.admin_id) {
            sql += ` AND bi.admin_id = $${paramCount}`;
            params.push(filters.admin_id);
            paramCount++;
        }

        sql += ' ORDER BY bi.created_at DESC';

        const result = await query(sql, params);
        return result.rows;
    }

    // Update invoice status
    static async updateStatus(id, status, paidAt = null) {
        const result = await query(
            `UPDATE billing_invoices 
             SET status = $1, paid_at = $2, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $3 
             RETURNING *`,
            [status, paidAt, id]
        );
        return result.rows[0] || null;
    }

    // Get billing statistics
    static async getStatistics() {
        const stats = await query(`
            SELECT 
                COUNT(*) as total_invoices,
                COUNT(*) FILTER (WHERE status = 'paid') as paid_invoices,
                COUNT(*) FILTER (WHERE status = 'pending') as pending_invoices,
                COUNT(*) FILTER (WHERE status = 'overdue') as overdue_invoices,
                COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) as total_revenue,
                COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as pending_amount,
                COALESCE(SUM(amount) FILTER (WHERE status = 'overdue'), 0) as overdue_amount
            FROM billing_invoices
        `);
        
        return stats.rows[0];
    }
}

module.exports = Billing;

