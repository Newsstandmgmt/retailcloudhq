const { query } = require('../config/database');

class LotteryInstantDay {
    constructor(data) {
        Object.assign(this, data);
    }

    static async computeDay(storeId, date) {
        // Get all readings for this date
        const readingsResult = await query(
            `SELECT r.pack_id, r.ticket_number, r.reading_ts,
                    p.game_id, g.game_id as game_code, g.ticket_price, g.commission_rate, g.tickets_per_pack,
                    LAG(r.ticket_number) OVER (PARTITION BY r.pack_id ORDER BY r.reading_ts) as prev_ticket
             FROM lottery_readings r
             JOIN lottery_packs p ON p.id = r.pack_id
             JOIN lottery_games g ON g.id = p.game_id
             WHERE r.store_id = $1 AND DATE(r.reading_ts) = $2
             ORDER BY r.pack_id, r.reading_ts`,
            [storeId, date]
        );

        // Calculate sold by game
        const gameTotals = {};
        for (const reading of readingsResult.rows) {
            const gameId = reading.game_id;
            if (!gameTotals[gameId]) {
                gameTotals[gameId] = {
                    game_id: gameId,
                    game_code: reading.game_code,
                    ticket_price: reading.ticket_price,
                    commission_rate: reading.commission_rate,
                    tickets_sold: 0
                };
            }

            if (reading.prev_ticket !== null) {
                const sold = Math.max(0, reading.ticket_number - reading.prev_ticket);
                gameTotals[gameId].tickets_sold += sold;
            }
        }

        // Calculate totals
        let instantFaceSales = 0;
        let instantCommission = 0;

        for (const gameId in gameTotals) {
            const game = gameTotals[gameId];
            const gameSales = game.tickets_sold * game.ticket_price;
            const gameCommission = game.tickets_sold * game.ticket_price * game.commission_rate;
            instantFaceSales += gameSales;
            instantCommission += gameCommission;
        }

        return {
            by_game: Object.values(gameTotals).map(game => ({
                ...game,
                commission_amount: game.tickets_sold * game.ticket_price * game.commission_rate
            })),
            totals: {
                instant_face_sales: instantFaceSales,
                instant_payouts: 0, // Will be entered separately
                instant_returns: 0, // Will be entered separately
                instant_net_sale_ops: instantFaceSales, // Will be updated when payouts/returns are entered
                instant_commission: instantCommission
            }
        };
    }

    static async createOrUpdate(instantData) {
        const { date, store_id, instant_face_sales = 0, instant_payouts = 0, instant_returns = 0,
                instant_net_sale_ops = 0, instant_commission = 0 } = instantData;
        
        const result = await query(
            `INSERT INTO lottery_instant_days (date, store_id, instant_face_sales, instant_payouts, instant_returns,
                                              instant_net_sale_ops, instant_commission)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (store_id, date) DO UPDATE SET
                 instant_face_sales = EXCLUDED.instant_face_sales,
                 instant_payouts = EXCLUDED.instant_payouts,
                 instant_returns = EXCLUDED.instant_returns,
                 instant_net_sale_ops = EXCLUDED.instant_net_sale_ops,
                 instant_commission = EXCLUDED.instant_commission,
                 updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [date, store_id, instant_face_sales, instant_payouts, instant_returns, instant_net_sale_ops, instant_commission]
        );

        const instantDay = result.rows[0];

        // Update game-level breakdown
        if (instantData.games) {
            // Delete existing game records
            await query('DELETE FROM lottery_instant_day_games WHERE instant_day_id = $1', [instantDay.id]);

            // Insert new game records
            for (const game of instantData.games) {
                await query(
                    `INSERT INTO lottery_instant_day_games (instant_day_id, game_id, tickets_sold, ticket_price, commission_rate, commission_amount)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [instantDay.id, game.game_id, game.tickets_sold, game.ticket_price, game.commission_rate, game.commission_amount]
                );
            }
        }

        return instantDay;
    }

    static async findByStoreAndDate(storeId, date) {
        const result = await query(
            `SELECT d.*, 
                    (SELECT json_agg(json_build_object(
                        'game_id', g.id,
                        'game_code', g.game_id,
                        'game_name', g.name,
                        'tickets_sold', ig.tickets_sold,
                        'ticket_price', ig.ticket_price,
                        'commission_rate', ig.commission_rate,
                        'commission_amount', ig.commission_amount
                    ))
                     FROM lottery_instant_day_games ig
                     JOIN lottery_games g ON g.id = ig.game_id
                     WHERE ig.instant_day_id = d.id) as games
             FROM lottery_instant_days d
             WHERE d.store_id = $1 AND d.date = $2`,
            [storeId, date]
        );
        return result.rows[0] || null;
    }

    static async findByStore(storeId, dateFrom = null, dateTo = null) {
        let sql = `SELECT * FROM lottery_instant_days WHERE store_id = $1`;
        const params = [storeId];
        let paramCount = 2;

        if (dateFrom) {
            sql += ` AND date >= $${paramCount}`;
            params.push(dateFrom);
            paramCount++;
        }

        if (dateTo) {
            sql += ` AND date <= $${paramCount}`;
            params.push(dateTo);
            paramCount++;
        }

        sql += ' ORDER BY date DESC';

        const result = await query(sql, params);
        return result.rows;
    }

    static async lockDay(storeId, date, lockedBy) {
        const result = await query(
            `UPDATE lottery_instant_days 
             SET is_locked = true, locked_at = CURRENT_TIMESTAMP, locked_by = $1, updated_at = CURRENT_TIMESTAMP
             WHERE store_id = $2 AND date = $3
             RETURNING *`,
            [lockedBy, storeId, date]
        );
        return result.rows[0] || null;
    }
}

module.exports = LotteryInstantDay;

