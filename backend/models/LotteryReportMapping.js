const { query } = require('../config/database');

class LotteryReportMapping {
    static async listByStore(storeId, { reportType = null } = {}) {
        const params = [storeId];
        let condition = 'store_id = $1';

        if (reportType) {
            params.push(reportType);
            condition += ` AND report_type = $${params.length}`;
        }

        const result = await query(
            `SELECT *
             FROM lottery_report_mappings
             WHERE ${condition}
             ORDER BY report_type, source_column`,
            params
        );

        return result.rows;
    }

    static async findById(id) {
        const result = await query(
            'SELECT * FROM lottery_report_mappings WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }

    static async create({
        storeId,
        reportType,
        sourceColumn,
        targetType,
        targetField,
        dataType = 'number',
        formulaExpression = null,
        notes = null,
    }) {
        const result = await query(
            `INSERT INTO lottery_report_mappings (
                store_id, report_type, source_column, target_type,
                target_field, data_type, formula_expression, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [storeId, reportType, sourceColumn, targetType, targetField, dataType, formulaExpression, notes]
        );

        return result.rows[0];
    }

    static async update(id, updates) {
        const fields = [];
        const values = [];
        let paramIndex = 1;

        const allowedFields = ['source_column', 'target_type', 'target_field', 'data_type', 'formula_expression', 'notes', 'report_type'];
        allowedFields.forEach((field) => {
            if (updates[field] !== undefined) {
                fields.push(`${field} = $${paramIndex}`);
                values.push(updates[field]);
                paramIndex += 1;
            }
        });

        if (fields.length === 0) {
            return this.findById(id);
        }

        values.push(id);

        const result = await query(
            `UPDATE lottery_report_mappings
             SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${values.length}
             RETURNING *`,
            values
        );

        return result.rows[0] || null;
    }

    static async delete(id) {
        const result = await query(
            'DELETE FROM lottery_report_mappings WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0] || null;
    }
}

module.exports = LotteryReportMapping;

