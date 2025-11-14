const LotteryReportMapping = require('../models/LotteryReportMapping');
const LotteryRawReport = require('../models/LotteryRawReport');
const DailyRevenue = require('../models/DailyRevenue');

class LotteryMappingService {
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
            const sourceValue = this.extractValue(rawData, mapping.source_column);
            if (sourceValue === null || sourceValue === undefined) {
                return;
            }

            let value = sourceValue;
            if (!mapping.data_type || mapping.data_type === 'number') {
                value = this.normalizeNumeric(sourceValue);
            }

            if (value === null || value === undefined) {
                return;
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
}

module.exports = LotteryMappingService;

