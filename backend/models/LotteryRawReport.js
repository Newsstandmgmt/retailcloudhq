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
        reportType = 'daily',
        mappedValues = {},
    }) {
        const safeData = data || {};
        const safeReceivedAt = receivedAt ? new Date(receivedAt) : new Date();
        const safeReportType = reportType || 'daily';
        const safeMappedValues = mappedValues || {};

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
                     report_type = COALESCE($8, report_type),
                     mapped_values = COALESCE($9, mapped_values),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $10
                 RETURNING *`,
                [
                    JSON.stringify(safeData),
                    retailerNumber,
                    locationName,
                    sourceEmailId,
                    sourceEmailSubject,
                    filename,
                    safeReceivedAt,
                    safeReportType,
                    JSON.stringify(safeMappedValues),
                    existing.id,
                ]
            );
            return result.rows[0];
        }

        const insertResult = await query(
            `INSERT INTO lottery_daily_reports (
                store_id, report_date, retailer_number, location_name,
                data, source_email_id, source_email_subject, filename, received_at,
                report_type, mapped_values
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
                safeReportType,
                JSON.stringify(safeMappedValues),
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

    static async updateMappedValues(reportId, mappedValues = {}) {
        const result = await query(
            `UPDATE lottery_daily_reports
             SET mapped_values = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [JSON.stringify(mappedValues || {}), reportId]
        );
        return result.rows[0] || null;
    }
}

module.exports = LotteryRawReport;
