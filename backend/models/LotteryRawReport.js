const { query } = require('../config/database');

class LotteryRawReport {
    static async findExisting(storeId, reportDate, sourceEmailId, filename) {
        if (sourceEmailId) {
            const existingByEmail = await query(
                `SELECT * FROM lottery_daily_reports 
                 WHERE store_id = $1 AND source_email_id = $2
                 LIMIT 1`,
                [storeId, sourceEmailId]
            );
            if (existingByEmail.rows.length > 0) {
                return existingByEmail.rows[0];
            }
        }

        if (filename) {
            const existingByFilename = await query(
                `SELECT * FROM lottery_daily_reports 
                 WHERE store_id = $1 AND report_date = $2 AND filename = $3
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [storeId, reportDate, filename]
            );
            if (existingByFilename.rows.length > 0) {
                return existingByFilename.rows[0];
            }
        }

        const existingByDate = await query(
            `SELECT * FROM lottery_daily_reports 
             WHERE store_id = $1 AND report_date = $2 AND source_email_id IS NULL
             ORDER BY created_at DESC
             LIMIT 1`,
            [storeId, reportDate]
        );
        return existingByDate.rows[0] || null;
    }

    static async upsert({
        storeId,
        reportDate,
        retailerNumber,
        locationName,
        data,
        sourceEmailId = null,
        sourceEmailSubject = null,
        filename = null,
        receivedAt = null,
    }) {
        const safeData = data || {};
        const safeReceivedAt = receivedAt ? new Date(receivedAt) : new Date();

        const existing = await this.findExisting(storeId, reportDate, sourceEmailId, filename);

        if (existing) {
            const result = await query(
                `UPDATE lottery_daily_reports
                 SET data = $1,
                     retailer_number = COALESCE($2, retailer_number),
                     location_name = COALESCE($3, location_name),
                     source_email_id = COALESCE($4, source_email_id),
                     source_email_subject = COALESCE($5, source_email_subject),
                     filename = COALESCE($6, filename),
                     received_at = COALESCE($7, received_at),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $8
                 RETURNING *`,
                [
                    JSON.stringify(safeData),
                    retailerNumber,
                    locationName,
                    sourceEmailId,
                    sourceEmailSubject,
                    filename,
                    safeReceivedAt,
                    existing.id,
                ]
            );
            return result.rows[0];
        }

        const insertResult = await query(
            `INSERT INTO lottery_daily_reports (
                store_id, report_date, retailer_number, location_name,
                data, source_email_id, source_email_subject, filename, received_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [
                storeId,
                reportDate,
                retailerNumber,
                locationName,
                JSON.stringify(safeData),
                sourceEmailId,
                sourceEmailSubject,
                filename,
                safeReceivedAt,
            ]
        );

        return insertResult.rows[0];
    }

    static async listByStore(storeId, { startDate = null, endDate = null, limit = 50 } = {}) {
        const params = [storeId];
        let paramIndex = 2;
        let conditions = 'store_id = $1';

        if (startDate) {
            conditions += ` AND report_date >= $${paramIndex}`;
            params.push(startDate);
            paramIndex += 1;
        }

        if (endDate) {
            conditions += ` AND report_date <= $${paramIndex}`;
            params.push(endDate);
            paramIndex += 1;
        }

        params.push(limit);

        const result = await query(
            `SELECT *
             FROM lottery_daily_reports
             WHERE ${conditions}
             ORDER BY report_date DESC, created_at DESC
             LIMIT $${paramIndex}`,
            params
        );

        return result.rows;
    }
}

module.exports = LotteryRawReport;
