const { query } = require('../config/database');
const LotteryAnomaly = require('./LotteryAnomaly');

class LotteryReading {
    constructor(data) {
        Object.assign(this, data);
    }

    static async create(readingData) {
        const { store_id, pack_id, box_label, ticket_number, user_id, source = 'manual', note = null, photo_url = null } = readingData;
        
        const result = await query(
            `INSERT INTO lottery_readings (store_id, pack_id, box_label, ticket_number, reading_ts, user_id, source, note, photo_url)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7, $8)
             RETURNING *`,
            [store_id, pack_id, box_label, ticket_number, user_id, source, note, photo_url]
        );
        
        const reading = result.rows[0];
        
        // Calculate sold delta and detect anomalies
        const { sold_delta, anomalies } = await this.calculateDeltaAndAnomalies(store_id, pack_id, ticket_number);
        
        // Create anomaly records if any
        const createdAnomalies = [];
        const date = new Date(reading.reading_ts).toISOString().split('T')[0];
        
        for (const anomaly of anomalies) {
            const anomalyRecord = await LotteryAnomaly.create({
                store_id,
                pack_id,
                box_label,
                reading_id: reading.id,
                date,
                type: anomaly.type,
                severity: anomaly.severity,
                detail: anomaly.detail
            });
            createdAnomalies.push(anomalyRecord);
        }
        
        // Update pack's current_ticket
        const LotteryPack = require('./LotteryPack');
        const pack = await LotteryPack.findById(pack_id);
        if (pack) {
            await LotteryPack.updateCurrentTicket(pack.pack_id, store_id, ticket_number);
        }
        
        return { reading, sold_delta, anomalies: createdAnomalies };
    }

    static async calculateDeltaAndAnomalies(storeId, packId, ticketNumber) {
        const anomalies = [];
        let soldDelta = 0;

        // Get previous reading for this pack
        const prevResult = await query(
            `SELECT ticket_number, reading_ts 
             FROM lottery_readings 
             WHERE pack_id = $1 AND store_id = $2
             ORDER BY reading_ts DESC 
             LIMIT 1 OFFSET 1`,
            [packId, storeId]
        );

        if (prevResult.rows.length > 0) {
            const prevReading = prevResult.rows[0];
            const prevTicket = prevReading.ticket_number;
            
            // Calculate sold delta
            soldDelta = Math.max(0, ticketNumber - prevTicket);

            // Detect anomalies
            if (ticketNumber === prevTicket) {
                // STALL
                anomalies.push({
                    type: 'stall',
                    severity: 'low',
                    detail: `Ticket number unchanged from previous reading (${prevTicket})`
                });
            } else if (ticketNumber < prevTicket) {
                // REGRESSION
                anomalies.push({
                    type: 'regression',
                    severity: 'high',
                    detail: `Ticket number decreased from ${prevTicket} to ${ticketNumber}`
                });
            }

            // Check for swap (different pack in same box)
            const packResult = await query(
                `SELECT p1.pack_id as new_pack, p2.pack_id as old_pack
                 FROM lottery_packs p1
                 JOIN lottery_packs p2 ON p2.store_id = p1.store_id AND p2.box_label = p1.box_label
                 WHERE p1.id = $1 AND p2.id != $1 AND p2.status = 'active' AND p2.sold_out_at IS NULL`,
                [packId]
            );

            if (packResult.rows.length > 0) {
                anomalies.push({
                    type: 'swap',
                    severity: 'high',
                    detail: `Pack swap detected in box. Previous pack not marked as sold_out.`
                });
            }

            // Check for outlier (spike vs historical average)
            const avgResult = await query(
                `SELECT AVG(CAST(ticket_number - LAG(ticket_number) OVER (ORDER BY reading_ts) AS INTEGER)) as avg_delta
                 FROM lottery_readings 
                 WHERE pack_id = $1 AND store_id = $2
                 ORDER BY reading_ts DESC
                 LIMIT 10`,
                [packId, storeId]
            );

            if (avgResult.rows[0]?.avg_delta) {
                const avgDelta = parseFloat(avgResult.rows[0].avg_delta) || 0;
                const threshold = avgDelta * 2; // 2x average is considered outlier
                if (soldDelta > threshold && soldDelta > 10) { // Only flag significant outliers
                    anomalies.push({
                        type: 'outlier',
                        severity: 'medium',
                        detail: `Unusual spike detected: ${soldDelta} tickets sold (average: ${avgDelta.toFixed(1)})`
                    });
                }
            }
        }

        return { sold_delta: soldDelta, anomalies };
    }

    static async findByPack(packId, limit = 50) {
        const result = await query(
            `SELECT r.*, u.first_name, u.last_name
             FROM lottery_readings r
             JOIN users u ON u.id = r.user_id
             WHERE r.pack_id = $1
             ORDER BY r.reading_ts DESC
             LIMIT $2`,
            [packId, limit]
        );
        return result.rows;
    }

    static async findByStore(storeId, date = null) {
        let sql = `SELECT r.*, u.first_name, u.last_name, p.pack_id, g.game_id as game_code
                   FROM lottery_readings r
                   JOIN users u ON u.id = r.user_id
                   JOIN lottery_packs p ON p.id = r.pack_id
                   JOIN lottery_games g ON g.id = p.game_id
                   WHERE r.store_id = $1`;
        const params = [storeId];
        
        if (date) {
            sql += ` AND DATE(r.reading_ts) = $2`;
            params.push(date);
        }

        sql += ' ORDER BY r.reading_ts DESC LIMIT 100';

        const result = await query(sql, params);
        return result.rows;
    }
}

module.exports = LotteryReading;

