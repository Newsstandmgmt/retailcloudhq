const { query } = require('../config/database');

class LotteryGame {
    constructor(data) {
        Object.assign(this, data);
    }

    static async create(gameData) {
        const { game_id, name, ticket_price, tickets_per_pack, commission_rate, is_active = true } = gameData;
        
        const result = await query(
            `INSERT INTO lottery_games (game_id, name, ticket_price, tickets_per_pack, commission_rate, is_active)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [game_id, name, ticket_price, tickets_per_pack, commission_rate, is_active]
        );
        return result.rows[0];
    }

    static async findById(id) {
        const result = await query('SELECT * FROM lottery_games WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    static async findByGameId(gameId) {
        const result = await query('SELECT * FROM lottery_games WHERE game_id = $1', [gameId]);
        return result.rows[0] || null;
    }

    static async findAll(filters = {}) {
        let sql = 'SELECT * FROM lottery_games WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (filters.is_active !== undefined) {
            sql += ` AND is_active = $${paramCount}`;
            params.push(filters.is_active);
            paramCount++;
        }

        sql += ' ORDER BY game_id';

        const result = await query(sql, params);
        return result.rows;
    }

    static async update(id, updateData) {
        const { name, ticket_price, tickets_per_pack, commission_rate, is_active } = updateData;
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (name !== undefined) { updates.push(`name = $${paramCount++}`); values.push(name); }
        if (ticket_price !== undefined) { updates.push(`ticket_price = $${paramCount++}`); values.push(ticket_price); }
        if (tickets_per_pack !== undefined) { updates.push(`tickets_per_pack = $${paramCount++}`); values.push(tickets_per_pack); }
        if (commission_rate !== undefined) { updates.push(`commission_rate = $${paramCount++}`); values.push(commission_rate); }
        if (is_active !== undefined) { updates.push(`is_active = $${paramCount++}`); values.push(is_active); }

        if (updates.length === 0) {
            return await this.findById(id);
        }

        values.push(id);
        const result = await query(
            `UPDATE lottery_games SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`,
            values
        );
        return result.rows[0] || null;
    }

    static async delete(id) {
        const result = await query('DELETE FROM lottery_games WHERE id = $1 RETURNING *', [id]);
        return result.rows[0] || null;
    }
}

module.exports = LotteryGame;

