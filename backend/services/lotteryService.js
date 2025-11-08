const LotteryReading = require('../models/LotteryReading');
const LotteryAnomaly = require('../models/LotteryAnomaly');
const LotteryInstantDay = require('../models/LotteryInstantDay');
const LotteryDrawDay = require('../models/LotteryDrawDay');
const LotteryPack = require('../models/LotteryPack');
const { query } = require('../config/database');

class LotteryService {
    /**
     * Record a lottery reading and detect anomalies
     */
    static async recordReading(readingData) {
        const { store_id, pack_id, box_label, ticket_number, user_id, source, note, photo_url } = readingData;

        // Get pack to validate (pack_id might be UUID or pack_id string)
        let pack;
        if (pack_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            pack = await LotteryPack.findById(pack_id);
        } else {
            pack = await LotteryPack.findByPackId(pack_id, store_id);
        }
        
        if (!pack) {
            throw new Error('Pack not found');
        }

        // Create reading (use pack UUID)
        const result = await LotteryReading.create({
            store_id,
            pack_id: pack.id,
            box_label,
            ticket_number,
            user_id,
            source,
            note,
            photo_url
        });

        return result;
    }

    /**
     * Compute instant lottery day summary
     */
    static async computeInstantDay(storeId, date) {
        return await LotteryInstantDay.computeDay(storeId, date);
    }

    /**
     * Preview day close (check for blocking anomalies)
     */
    static async previewDayClose(storeId, date) {
        // Get instant day computation
        const instantDay = await LotteryInstantDay.computeDay(storeId, date);
        
        // Get draw day
        const drawDay = await LotteryDrawDay.findByStoreAndDate(storeId, date);

        // Check for blocking anomalies
        const highSeverityAnomalies = await LotteryAnomaly.getOpenHighSeverity(storeId, date);
        const allAnomalies = await LotteryAnomaly.findByStore(storeId, { 
            status: 'open',
            date_from: date,
            date_to: date
        });

        // Get policies
        const policyResult = await query(
            'SELECT * FROM lottery_policies WHERE store_id = $1 OR store_id IS NULL ORDER BY store_id DESC LIMIT 1',
            [storeId]
        );
        const policy = policyResult.rows[0] || {
            block_gl_posting_on_high_severity: true,
            regression_severity: 'high'
        };

        const canPost = !(policy.block_gl_posting_on_high_severity && highSeverityAnomalies > 0);
        const warnings = [];

        if (highSeverityAnomalies > 0) {
            warnings.push(`${highSeverityAnomalies} high-severity anomaly(ies) must be resolved before posting`);
        }

        const mediumAnomalies = allAnomalies.filter(a => a.severity === 'medium' && a.status === 'open');
        if (mediumAnomalies.length > 0) {
            warnings.push(`${mediumAnomalies.length} medium-severity anomaly(ies) should be reviewed`);
        }

        return {
            instant_commission: instantDay.totals.instant_commission,
            draw_commission: drawDay?.commission_amount || 0,
            total_commission: instantDay.totals.instant_commission + (drawDay?.commission_amount || 0),
            anomalies: allAnomalies,
            warnings,
            can_post: canPost,
            instant_by_game: instantDay.by_game,
            instant_totals: instantDay.totals,
            draw_totals: drawDay ? {
                total_sales: drawDay.total_sales,
                total_cashed: drawDay.total_cashed,
                adjustments: drawDay.adjustments,
                net_sale: drawDay.net_sale,
                commission: drawDay.commission_amount
            } : null
        };
    }

    /**
     * Post GL entries for lottery commissions
     */
    static async postGL(storeId, date, postedBy) {
        const preview = await this.previewDayClose(storeId, date);

        if (!preview.can_post) {
            throw new Error('Cannot post GL: High-severity anomalies must be resolved first');
        }

        // Create journal entry
        const JournalEntry = require('../models/JournalEntry');
        const ChartOfAccounts = require('../models/ChartOfAccounts');

        // Get or create lottery accounts
        let lotteryReceivable = await ChartOfAccounts.findByStoreAndName(storeId, 'Lottery Receivable');
        if (!lotteryReceivable) {
            // Create default accounts if they don't exist
            lotteryReceivable = await ChartOfAccounts.create({
                account_name: 'Lottery Receivable',
                account_type: 'asset',
                store_id: storeId,
                is_active: true
            });
        }

        let instantCommission = await ChartOfAccounts.findByStoreAndName(storeId, 'Lottery Commissions - Instant');
        if (!instantCommission) {
            instantCommission = await ChartOfAccounts.create({
                account_name: 'Lottery Commissions - Instant',
                account_type: 'revenue',
                store_id: storeId,
                is_active: true
            });
        }

        let drawCommission = await ChartOfAccounts.findByStoreAndName(storeId, 'Lottery Commissions - Draw/Online');
        if (!drawCommission) {
            drawCommission = await ChartOfAccounts.create({
                account_name: 'Lottery Commissions - Draw/Online',
                account_type: 'revenue',
                store_id: storeId,
                is_active: true
            });
        }

        const totalCommission = preview.total_commission;

        // Create journal entry
        const journalEntry = await JournalEntry.create(storeId, {
            entry_date: date,
            description: `Lottery Commissions - ${date}`,
            entry_type: 'lottery',
            status: 'posted',
            lines: [
                {
                    account_id: lotteryReceivable.id,
                    debit_amount: totalCommission,
                    credit_amount: 0,
                    description: 'Lottery commissions receivable'
                },
                {
                    account_id: instantCommission.id,
                    debit_amount: 0,
                    credit_amount: preview.instant_commission,
                    description: 'Instant lottery commissions'
                },
                {
                    account_id: drawCommission.id,
                    debit_amount: 0,
                    credit_amount: preview.draw_commission,
                    description: 'Draw/Online lottery commissions'
                }
            ],
            entered_by: postedBy
        });

        // Record GL post
        const result = await query(
            `INSERT INTO lottery_gl_posts (gl_batch_id, store_id, date, instant_commission, draw_commission, status, posted_at, posted_by)
             VALUES ($1, $2, $3, $4, $5, 'posted', CURRENT_TIMESTAMP, $6)
             RETURNING *`,
            [journalEntry.id, storeId, date, preview.instant_commission, preview.draw_commission, postedBy]
        );

        // Lock instant day
        await LotteryInstantDay.lockDay(storeId, date, postedBy);

        return {
            gl_batch_id: journalEntry.id,
            status: 'posted',
            warnings: preview.warnings,
            post: result.rows[0]
        };
    }
}

module.exports = LotteryService;

