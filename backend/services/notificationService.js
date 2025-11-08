const { query } = require('../config/database');

class NotificationService {
    /**
     * Create a notification
     */
    static async create(notificationData) {
        const {
            user_id,
            store_id = null,
            notification_type,
            title,
            message,
            entity_type = null,
            entity_id = null,
            priority = 'normal',
            action_url = null,
            metadata = null,
            expires_at = null
        } = notificationData;

        const result = await query(
            `INSERT INTO notifications (
                user_id, store_id, notification_type, title, message,
                entity_type, entity_id, priority, action_url, metadata, expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
                user_id, store_id, notification_type, title, message,
                entity_type, entity_id, priority, action_url,
                metadata ? JSON.stringify(metadata) : null, expires_at
            ]
        );

        return result.rows[0];
    }

    /**
     * Get notifications for a user
     */
    static async getUserNotifications(userId, filters = {}) {
        const {
            is_read = null,
            notification_type = null,
            store_id = null,
            limit = 50,
            offset = 0
        } = filters;

        let sql = `
            SELECT n.*, s.name as store_name
            FROM notifications n
            LEFT JOIN stores s ON n.store_id = s.id
            WHERE n.user_id = $1
        `;
        const params = [userId];
        let paramCount = 1;

        if (is_read !== null) {
            paramCount++;
            sql += ` AND n.is_read = $${paramCount}`;
            params.push(is_read);
        }

        if (notification_type) {
            paramCount++;
            sql += ` AND n.notification_type = $${paramCount}`;
            params.push(notification_type);
        }

        if (store_id) {
            paramCount++;
            sql += ` AND n.store_id = $${paramCount}`;
            params.push(store_id);
        }

        // Filter expired notifications
        sql += ` AND (n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP)`;

        sql += ` ORDER BY n.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(limit, offset);

        const result = await query(sql, params);
        return result.rows.map(row => ({
            ...row,
            metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null
        }));
    }

    /**
     * Mark notification as read
     */
    static async markAsRead(notificationId, userId) {
        const result = await query(
            `UPDATE notifications
             SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [notificationId, userId]
        );

        return result.rows[0];
    }

    /**
     * Mark all notifications as read for a user
     */
    static async markAllAsRead(userId, storeId = null) {
        let sql = `UPDATE notifications SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE user_id = $1`;
        const params = [userId];

        if (storeId) {
            sql += ` AND store_id = $2`;
            params.push(storeId);
        }

        const result = await query(sql, params);
        return result.rowCount;
    }

    /**
     * Get unread notification count
     */
    static async getUnreadCount(userId, storeId = null) {
        let sql = `
            SELECT COUNT(*) as count
            FROM notifications
            WHERE user_id = $1 AND is_read = FALSE
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        `;
        const params = [userId];

        if (storeId) {
            sql += ` AND store_id = $2`;
            params.push(storeId);
        }

        const result = await query(sql, params);
        return parseInt(result.rows[0]?.count || 0);
    }

    /**
     * Delete notification
     */
    static async delete(notificationId, userId) {
        const result = await query(
            `DELETE FROM notifications
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [notificationId, userId]
        );

        return result.rows[0];
    }

    /**
     * Create overdue invoice notifications
     */
    static async createOverdueInvoiceNotifications() {
        const result = await query(
            `SELECT pi.*, v.name as vendor_name, s.id as store_id,
             u.id as user_id, u.email as user_email, u.role
             FROM purchase_invoices pi
             JOIN vendors v ON pi.vendor_id = v.id
             JOIN stores s ON pi.store_id = s.id
             JOIN user_store_assignments usa ON s.id = usa.store_id
             JOIN users u ON usa.user_id = u.id
             WHERE pi.status = 'pending'
             AND pi.due_date < CURRENT_DATE
             AND pi.due_date IS NOT NULL
             AND (pi.payment_option = 'invoice' OR pi.payment_option = 'pay_later')
             AND u.role IN ('admin', 'manager')
             AND NOT EXISTS (
                 SELECT 1 FROM notifications n
                 WHERE n.entity_type = 'invoice'
                 AND n.entity_id = pi.id
                 AND n.notification_type = 'overdue_invoice'
                 AND n.created_at > CURRENT_DATE - INTERVAL '1 day'
             )`
        );

        const notifications = [];
        for (const invoice of result.rows) {
            const daysOverdue = Math.floor((new Date() - new Date(invoice.due_date)) / (1000 * 60 * 60 * 24));
            
            const notification = await this.create({
                user_id: invoice.user_id,
                store_id: invoice.store_id,
                notification_type: 'overdue_invoice',
                title: `Overdue Invoice: ${invoice.vendor_name}`,
                message: `Invoice #${invoice.invoice_number || 'N/A'} for $${parseFloat(invoice.amount).toFixed(2)} is ${daysOverdue} day(s) overdue. Due date: ${invoice.due_date}`,
                entity_type: 'invoice',
                entity_id: invoice.id,
                priority: daysOverdue > 30 ? 'urgent' : daysOverdue > 14 ? 'high' : 'normal',
                action_url: `/purchase-payments`,
                metadata: {
                    invoice_id: invoice.id,
                    invoice_number: invoice.invoice_number,
                    vendor_name: invoice.vendor_name,
                    amount: invoice.amount,
                    due_date: invoice.due_date,
                    days_overdue: daysOverdue
                }
            });

            notifications.push(notification);
        }

        return notifications;
    }

    /**
     * Create upcoming payment due date notifications
     */
    static async createUpcomingPaymentNotifications(daysAhead = 7) {
        const result = await query(
            `SELECT pi.*, v.name as vendor_name, s.id as store_id,
             u.id as user_id, u.email as user_email, u.role
             FROM purchase_invoices pi
             JOIN vendors v ON pi.vendor_id = v.id
             JOIN stores s ON pi.store_id = s.id
             JOIN user_store_assignments usa ON s.id = usa.store_id
             JOIN users u ON usa.user_id = u.id
             WHERE pi.status = 'pending'
             AND pi.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${daysAhead} days'
             AND pi.due_date IS NOT NULL
             AND (pi.payment_option = 'invoice' OR pi.payment_option = 'pay_later')
             AND u.role IN ('admin', 'manager')
             AND NOT EXISTS (
                 SELECT 1 FROM notifications n
                 WHERE n.entity_type = 'invoice'
                 AND n.entity_id = pi.id
                 AND n.notification_type = 'upcoming_payment'
                 AND n.created_at > CURRENT_DATE - INTERVAL '1 day'
             )`
        );

        const notifications = [];
        for (const invoice of result.rows) {
            const daysUntilDue = Math.floor((new Date(invoice.due_date) - new Date()) / (1000 * 60 * 60 * 24));
            
            const notification = await this.create({
                user_id: invoice.user_id,
                store_id: invoice.store_id,
                notification_type: 'upcoming_payment',
                title: `Payment Due Soon: ${invoice.vendor_name}`,
                message: `Invoice #${invoice.invoice_number || 'N/A'} for $${parseFloat(invoice.amount).toFixed(2)} is due in ${daysUntilDue} day(s). Due date: ${invoice.due_date}`,
                entity_type: 'invoice',
                entity_id: invoice.id,
                priority: daysUntilDue <= 3 ? 'high' : 'normal',
                action_url: `/purchase-payments`,
                metadata: {
                    invoice_id: invoice.id,
                    invoice_number: invoice.invoice_number,
                    vendor_name: invoice.vendor_name,
                    amount: invoice.amount,
                    due_date: invoice.due_date,
                    days_until_due: daysUntilDue
                },
                expires_at: new Date(invoice.due_date)
            });

            notifications.push(notification);
        }

        return notifications;
    }
}

module.exports = NotificationService;

