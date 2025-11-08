const { query } = require('../config/database');

class LotteryAnomaly {
    constructor(data) {
        Object.assign(this, data);
    }

    static async create(anomalyData) {
        const { store_id, pack_id, box_label, reading_id, date, type, severity, detail } = anomalyData;
        
        const result = await query(
            `INSERT INTO lottery_anomalies (store_id, pack_id, box_label, reading_id, date, type, severity, detail)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [store_id, pack_id || null, box_label || null, reading_id || null, date, type, severity, detail]
        );
        return result.rows[0];
    }

    static async findByStore(storeId, filters = {}) {
        let sql = `SELECT a.*, p.pack_id, g.game_id as game_code
                   FROM lottery_anomalies a
                   LEFT JOIN lottery_packs p ON p.id = a.pack_id
                   LEFT JOIN lottery_games g ON g.id = p.game_id
                   WHERE a.store_id = $1`;
        const params = [storeId];
        let paramCount = 2;

        if (filters.status) {
            sql += ` AND a.status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }

        if (filters.type) {
            sql += ` AND a.type = $${paramCount}`;
            params.push(filters.type);
            paramCount++;
        }

        if (filters.severity) {
            sql += ` AND a.severity = $${paramCount}`;
            params.push(filters.severity);
            paramCount++;
        }

        if (filters.date_from) {
            sql += ` AND a.date >= $${paramCount}`;
            params.push(filters.date_from);
            paramCount++;
        }

        if (filters.date_to) {
            sql += ` AND a.date <= $${paramCount}`;
            params.push(filters.date_to);
            paramCount++;
        }

        sql += ' ORDER BY a.date DESC, a.severity DESC, a.created_at DESC';

        const result = await query(sql, params);
        return result.rows;
    }

    static async resolve(id, resolvedBy, resolvedNote) {
        const result = await query(
            `UPDATE lottery_anomalies 
             SET status = 'resolved', resolved_by = $1, resolved_note = $2, resolved_ts = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [resolvedBy, resolvedNote, id]
        );
        return result.rows[0] || null;
    }

    static async acknowledge(id, acknowledgedBy) {
        const result = await query(
            `UPDATE lottery_anomalies 
             SET status = 'acknowledged', resolved_by = $1, resolved_ts = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [acknowledgedBy, id]
        );
        return result.rows[0] || null;
    }

    static async getOpenHighSeverity(storeId, date = null) {
        let sql = `SELECT COUNT(*) as count
                   FROM lottery_anomalies
                   WHERE store_id = $1 AND status = 'open' AND severity = 'high'`;
        const params = [storeId];
        
        if (date) {
            sql += ` AND date = $2`;
            params.push(date);
        }

        const result = await query(sql, params);
        return parseInt(result.rows[0].count) || 0;
    }
}

module.exports = LotteryAnomaly;

