const { query } = require('../config/database');

class LotteryPack {
    constructor(data) {
        Object.assign(this, data);
    }

    static async create(packData) {
        const { pack_id, game_id, store_id, box_label, start_ticket, current_ticket = null, status = 'inactive' } = packData;
        
        const result = await query(
            `INSERT INTO lottery_packs (pack_id, game_id, store_id, box_label, start_ticket, current_ticket, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (pack_id, store_id) DO UPDATE SET
                 game_id = EXCLUDED.game_id,
                 box_label = EXCLUDED.box_label,
                 start_ticket = EXCLUDED.start_ticket,
                 current_ticket = COALESCE(EXCLUDED.current_ticket, lottery_packs.current_ticket),
                 status = EXCLUDED.status,
                 updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [pack_id, game_id, store_id, box_label, start_ticket, current_ticket, status]
        );
        return result.rows[0];
    }

    static async activate(packId, storeId, activationData) {
        const { game_id, box_label, start_ticket, activated_by } = activationData;
        
        const result = await query(
            `UPDATE lottery_packs 
             SET game_id = $1, box_label = $2, start_ticket = $3, current_ticket = $3, 
                 status = 'active', activated_at = CURRENT_TIMESTAMP, activated_by = $4,
                 updated_at = CURRENT_TIMESTAMP
             WHERE pack_id = $5 AND store_id = $6
             RETURNING *`,
            [game_id, box_label, start_ticket, activated_by, packId, storeId]
        );
        return result.rows[0] || null;
    }

    static async findById(id) {
        const result = await query(
            `SELECT p.*, g.game_id as game_code, g.name as game_name, g.ticket_price, g.tickets_per_pack
             FROM lottery_packs p
             JOIN lottery_games g ON g.id = p.game_id
             WHERE p.id = $1`,
            [id]
        );
        return result.rows[0] || null;
    }

    static async findByPackId(packId, storeId) {
        const result = await query(
            `SELECT p.*, g.game_id as game_code, g.name as game_name, g.ticket_price, g.tickets_per_pack
             FROM lottery_packs p
             JOIN lottery_games g ON g.id = p.game_id
             WHERE p.pack_id = $1 AND p.store_id = $2`,
            [packId, storeId]
        );
        return result.rows[0] || null;
    }

    static async findByStore(storeId, filters = {}) {
        let sql = `SELECT p.*, g.game_id as game_code, g.name as game_name, g.ticket_price, g.tickets_per_pack
                   FROM lottery_packs p
                   JOIN lottery_games g ON g.id = p.game_id
                   WHERE p.store_id = $1`;
        const params = [storeId];
        let paramCount = 2;

        if (filters.status) {
            sql += ` AND p.status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }

        if (filters.box_label) {
            sql += ` AND p.box_label = $${paramCount}`;
            params.push(filters.box_label);
            paramCount++;
        }

        sql += ' ORDER BY p.box_label, p.activated_at DESC';

        const result = await query(sql, params);
        return result.rows;
    }

    static async updateCurrentTicket(packId, storeId, ticketNumber) {
        // Check if pack should be marked as sold_out
        const pack = await this.findByPackId(packId, storeId);
        if (!pack) return null;

        const ticketsPerPack = pack.tickets_per_pack;
        const isSoldOut = ticketNumber >= ticketsPerPack - 1;

        const result = await query(
            `UPDATE lottery_packs 
             SET current_ticket = $1, 
                 status = CASE WHEN $2 THEN 'sold_out' ELSE status END,
                 sold_out_at = CASE WHEN $2 THEN CURRENT_TIMESTAMP ELSE sold_out_at END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE pack_id = $3 AND store_id = $4
             RETURNING *`,
            [ticketNumber, isSoldOut, packId, storeId]
        );
        return result.rows[0] || null;
    }
}

module.exports = LotteryPack;

