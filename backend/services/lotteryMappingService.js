const LotteryReportMapping = require('../models/LotteryReportMapping');
const LotteryRawReport = require('../models/LotteryRawReport');
const DailyRevenue = require('../models/DailyRevenue');

class LotteryMappingService {
    static evaluateFormula(expression, rawData) {
        if (!expression || typeof expression !== 'string') {
            return null;
        }

        let expr = expression;
        const placeholderRegex = /\{\{([^}]+)\}\}/g;
        expr = expr.replace(placeholderRegex, (_match, columnName) => {
            const value = this.normalizeNumeric(this.extractValue(rawData, columnName.trim()));
            return value !== null && value !== undefined ? value : 0;
        });

        const safeExpressionRegex = /^[0-9+\-*/().\s]+$/;
        if (!safeExpressionRegex.test(expr)) {
            return null;
        }

        try {
            // eslint-disable-next-line no-new-func
            const result = Function(`"use strict"; return (${expr});`)();
            return Number.isFinite(result) ? result : null;
        } catch (error) {
            console.warn('Failed to evaluate lottery mapping formula:', error.message);
            return null;
        }
    }

    static normalizeNumeric(value) {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === 'number') {
            return value;
        }

        if (typeof value === 'string') {
            const cleaned = value.replace(/[^0-9.-]/g, '');
            if (cleaned === '' || cleaned === '-' || cleaned === '.') {
                return null;
            }
            const parsed = parseFloat(cleaned);
            return Number.isNaN(parsed) ? null : parsed;
        }

        return null;
    }

    static extractValue(rawData, sourceColumn) {
        if (!rawData || !sourceColumn) {
            return null;
        }

        if (rawData.hasOwnProperty(sourceColumn)) {
            return rawData[sourceColumn];
        }

        // Attempt case-insensitive match
        const lowerKey = sourceColumn.toLowerCase();
        const matchedKey = Object.keys(rawData).find((key) => key.toLowerCase() === lowerKey);
        if (matchedKey) {
            return rawData[matchedKey];
        }

        return null;
    }

    static async applyMappings({ storeId, reportDate, reportType = 'daily', rawReport }) {
        const mappings = await LotteryReportMapping.listByStore(storeId, { reportType });
        if (!mappings.length) {
            return;
        }

        const reportRecord = rawReport || await LotteryRawReport.findExisting(storeId, reportDate, null, null);
        if (!reportRecord) {
            return;
        }

        let rawData = reportRecord.data || {};
        if (typeof rawData === 'string') {
            try {
                rawData = JSON.parse(rawData);
            } catch (error) {
                rawData = {};
            }
        }

        let mappedValues = reportRecord.mapped_values || {};
        if (typeof mappedValues === 'string') {
            try {
                mappedValues = JSON.parse(mappedValues);
            } catch (error) {
                mappedValues = {};
            }
        } else {
            mappedValues = { ...mappedValues };
        }
        const revenueUpdates = {};

        mappings.forEach((mapping) => {
            let value = null;

            if (mapping.formula_expression) {
                value = this.evaluateFormula(mapping.formula_expression, rawData);
            }

            if (value === null || value === undefined) {
                const sourceValue = this.extractValue(rawData, mapping.source_column);
                if (sourceValue === null || sourceValue === undefined) {
                    return;
                }

                value = sourceValue;
                if (!mapping.data_type || mapping.data_type === 'number') {
                    value = this.normalizeNumeric(sourceValue);
                }

                if (value === null || value === undefined) {
                    return;
                }
            }

            if (mapping.target_type === 'daily_revenue') {
                revenueUpdates[mapping.target_field] = value;
            } else if (mapping.target_type === 'lottery_field') {
                mappedValues[mapping.target_field] = value;
            }
        });

        if (Object.keys(mappedValues).length > 0) {
            await LotteryRawReport.updateMappedValues(reportRecord.id, mappedValues);
        }

        if (Object.keys(revenueUpdates).length > 0) {
            const updated = await DailyRevenue.updateFields(storeId, reportDate, revenueUpdates);
            if (!updated) {
                await DailyRevenue.upsert(storeId, reportDate, revenueUpdates);
            }
        }
    }

    static async reapplyMappingsForStore({
        storeId,
        startDate = null,
        endDate = null,
        reportType = null,
    }) {
        const reports = await LotteryRawReport.listByStore(storeId, {
            startDate,
            endDate,
            reportType,
            limit: null,
        });

        let applied = 0;
        const errors = [];

        for (const report of reports) {
            try {
                await this.applyMappings({
                    storeId,
                    reportDate: report.report_date,
                    reportType: report.report_type || reportType || 'daily',
                    rawReport: report,
                });
                applied += 1;
            } catch (error) {
                console.error('Reapply lottery mapping failed:', error);
                errors.push({
                    reportId: report.id,
                    reportDate: report.report_date,
                    message: error.message,
                });
            }
        }

        return { processed: reports.length, applied, errors };
    }
}

module.exports = LotteryMappingService;

