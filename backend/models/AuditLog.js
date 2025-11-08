const { query } = require('../config/database');

class AuditLog {
    constructor(data) {
        this.id = data.id;
        this.user_id = data.user_id;
        this.user_email = data.user_email;
        this.user_name = data.user_name;
        this.action_type = data.action_type;
        this.entity_type = data.entity_type;
        this.entity_id = data.entity_id;
        this.action_description = data.action_description;
        this.resource_path = data.resource_path;
        this.http_method = data.http_method;
        this.ip_address = data.ip_address;
        this.user_agent = data.user_agent;
        this.old_values = data.old_values;
        this.new_values = data.new_values;
        this.status = data.status;
        this.error_message = data.error_message;
        this.store_id = data.store_id;
        this.metadata = data.metadata;
        this.created_at = data.created_at;
    }

    // Create a new audit log entry
    static async create(logData) {
        const {
            user_id,
            user_email,
            user_name,
            action_type,
            entity_type,
            entity_id,
            action_description,
            resource_path,
            http_method,
            ip_address,
            user_agent,
            old_values,
            new_values,
            status,
            error_message,
            store_id,
            metadata
        } = logData;

        const result = await query(
            `INSERT INTO audit_logs (
                user_id, user_email, user_name, action_type, entity_type, entity_id,
                action_description, resource_path, http_method, ip_address, user_agent,
                old_values, new_values, status, error_message, store_id, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING *`,
            [
                user_id || null,
                user_email || null,
                user_name || null,
                action_type,
                entity_type || null,
                entity_id || null,
                action_description || null,
                resource_path || null,
                http_method || null,
                ip_address || null,
                user_agent || null,
                old_values ? JSON.stringify(old_values) : null,
                new_values ? JSON.stringify(new_values) : null,
                status || 'success',
                error_message || null,
                store_id || null,
                metadata ? JSON.stringify(metadata) : null
            ]
        );

        return new AuditLog(result.rows[0]);
    }

    // Get audit logs with filters
    static async findAll(filters = {}) {
        const {
            user_id,
            user_email,
            action_type,
            entity_type,
            entity_id,
            status,
            store_id,
            start_date,
            end_date,
            search,
            limit = 100,
            offset = 0
        } = filters;

        let conditions = [];
        let params = [];
        let paramCount = 0;

        if (user_id) {
            paramCount++;
            conditions.push(`al.user_id = $${paramCount}`);
            params.push(user_id);
        }

        if (user_email) {
            paramCount++;
            conditions.push(`al.user_email ILIKE $${paramCount}`);
            params.push(`%${user_email}%`);
        }

        if (action_type) {
            paramCount++;
            conditions.push(`al.action_type = $${paramCount}`);
            params.push(action_type);
        }

        if (entity_type) {
            paramCount++;
            conditions.push(`al.entity_type = $${paramCount}`);
            params.push(entity_type);
        }

        if (entity_id) {
            paramCount++;
            conditions.push(`al.entity_id = $${paramCount}`);
            params.push(entity_id);
        }

        if (status) {
            paramCount++;
            conditions.push(`al.status = $${paramCount}`);
            params.push(status);
        }

        if (store_id) {
            paramCount++;
            conditions.push(`al.store_id = $${paramCount}`);
            params.push(store_id);
        }

        if (start_date) {
            paramCount++;
            // Include the entire start date (start of day)
            conditions.push(`al.created_at >= $${paramCount}`);
            params.push(start_date);
        }

        if (end_date) {
            paramCount++;
            // Include the entire end date (end of day) - add 1 day and use < to include entire end date
            const endDatePlusOne = new Date(end_date);
            endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
            conditions.push(`al.created_at < $${paramCount}`);
            params.push(endDatePlusOne.toISOString().split('T')[0]);
        }

        if (search) {
            paramCount++;
            conditions.push(`(
                al.action_description ILIKE $${paramCount} OR
                al.user_email ILIKE $${paramCount} OR
                al.user_name ILIKE $${paramCount}
            )`);
            params.push(`%${search}%`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        paramCount++;
        params.push(limit);
        paramCount++;
        params.push(offset);

        const result = await query(
            `SELECT 
                al.*,
                u.first_name || ' ' || u.last_name as user_full_name,
                s.name as store_name
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            LEFT JOIN stores s ON al.store_id = s.id
            ${whereClause}
            ORDER BY al.created_at DESC
            LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
            params
        );

        // Get total count (remove limit and offset from params)
        const countParams = params.slice(0, -2);
        const countResult = await query(
            `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`,
            countParams.length > 0 ? countParams : []
        );

        // Map rows to AuditLog instances, handling JSONB fields
        const logs = result.rows.map(row => {
            const logData = {
                ...row,
                old_values: typeof row.old_values === 'string' ? JSON.parse(row.old_values || '{}') : (row.old_values || null),
                new_values: typeof row.new_values === 'string' ? JSON.parse(row.new_values || '{}') : (row.new_values || null),
                metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : (row.metadata || null)
            };
            return new AuditLog(logData);
        });

        return {
            logs: logs,
            total: parseInt(countResult.rows[0].total),
            limit,
            offset
        };
    }

    // Get login history
    static async getLoginHistory(filters = {}) {
        const { user_id, start_date, end_date, limit = 100, offset = 0 } = filters;
        
        let conditions = ["lh.action_type IN ('login', 'logout', 'failed_login')"];
        let params = [];
        let paramCount = 0;

        if (user_id) {
            paramCount++;
            conditions.push(`lh.user_id = $${paramCount}`);
            params.push(user_id);
        }

        if (start_date) {
            paramCount++;
            conditions.push(`lh.created_at >= $${paramCount}`);
            params.push(start_date);
        }

        if (end_date) {
            paramCount++;
            // Include the entire end date
            const endDatePlusOne = new Date(end_date);
            endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
            conditions.push(`lh.created_at < $${paramCount}`);
            params.push(endDatePlusOne.toISOString().split('T')[0]);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        paramCount++;
        params.push(limit);
        paramCount++;
        params.push(offset);

        const result = await query(
            `SELECT * FROM login_history lh
            ${whereClause}
            ORDER BY lh.created_at DESC
            LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
            params
        );

        const countParams = params.slice(0, -2);
        const countResult = await query(
            `SELECT COUNT(*) as total FROM login_history lh ${whereClause}`,
            countParams.length > 0 ? countParams : []
        );

        return {
            logs: result.rows,
            total: parseInt(countResult.rows[0].total),
            limit,
            offset
        };
    }

    // Get critical actions
    static async getCriticalActions(filters = {}) {
        const { entity_type, start_date, end_date, limit = 100, offset = 0 } = filters;
        
        let conditions = [];
        let params = [];
        let paramCount = 0;

        if (entity_type) {
            paramCount++;
            conditions.push(`ca.entity_type = $${paramCount}`);
            params.push(entity_type);
        }

        if (start_date) {
            paramCount++;
            conditions.push(`ca.created_at >= $${paramCount}`);
            params.push(start_date);
        }

        if (end_date) {
            paramCount++;
            // Include the entire end date
            const endDatePlusOne = new Date(end_date);
            endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
            conditions.push(`ca.created_at < $${paramCount}`);
            params.push(endDatePlusOne.toISOString().split('T')[0]);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        paramCount++;
        params.push(limit);
        paramCount++;
        params.push(offset);

        const result = await query(
            `SELECT * FROM critical_actions ca
            ${whereClause}
            ORDER BY ca.created_at DESC
            LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
            params
        );

        const countParams = params.slice(0, -2);
        const countResult = await query(
            `SELECT COUNT(*) as total FROM critical_actions ca ${whereClause}`,
            countParams.length > 0 ? countParams : []
        );

        return {
            logs: result.rows,
            total: parseInt(countResult.rows[0].total),
            limit,
            offset
        };
    }

    // Get statistics
    static async getStatistics(startDate, endDate) {
        const result = await query(
            `SELECT 
                COUNT(*) as total_actions,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(CASE WHEN action_type = 'login' THEN 1 END) as login_count,
                COUNT(CASE WHEN action_type = 'failed_login' THEN 1 END) as failed_login_count,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_actions,
                COUNT(CASE WHEN action_type IN ('create', 'update', 'delete') THEN 1 END) as data_changes
            FROM audit_logs
            WHERE created_at >= $1 AND created_at <= $2`,
            [startDate, endDate]
        );

        const actionTypeResult = await query(
            `SELECT 
                action_type,
                COUNT(*) as count
            FROM audit_logs
            WHERE created_at >= $1 AND created_at <= $2
            GROUP BY action_type
            ORDER BY count DESC`,
            [startDate, endDate]
        );

        return {
            summary: result.rows[0],
            by_action_type: actionTypeResult.rows
        };
    }
}

module.exports = AuditLog;

