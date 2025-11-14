const cron = require('node-cron');
const SquareConnection = require('../models/SquareConnection');
const SquareDailySales = require('../models/SquareDailySales');
const SquareService = require('./squareService');

const DEFAULT_START_DATE = process.env.SQUARE_SYNC_START_DATE || '2025-11-01';
const DEFAULT_TIMEZONE = process.env.SQUARE_SYNC_TIMEZONE || 'America/New_York';
const CRON_EXPRESSION = process.env.SQUARE_SYNC_CRON || '*/5 * * * *'; // every 5 minutes
const MAX_DAYS_PER_RUN = parseInt(process.env.SQUARE_SYNC_MAX_DAYS || '3', 10);

function getTodayString() {
    const now = new Date();
    return now.toISOString().slice(0, 10);
}

function getNextDay(dateString) {
    const date = new Date(`${dateString}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
}

class SquareSyncCron {
    constructor() {
        this.job = null;
        this.isRunning = false;
    }

    start() {
        if (this.job) {
            return;
        }

        console.log(`🕐 Scheduling Square sync cron (${CRON_EXPRESSION}, tz=${DEFAULT_TIMEZONE})`);
        this.job = cron.schedule(
            CRON_EXPRESSION,
            () => {
                this.run().catch((error) => {
                    console.error('❌ Square sync cron run failed:', error);
                });
            },
            {
                scheduled: true,
                timezone: DEFAULT_TIMEZONE,
            }
        );

        // Kick off an initial run at startup
        this.run().catch((error) => {
            console.error('❌ Initial Square sync run failed:', error);
        });
    }

    stop() {
        if (this.job) {
            this.job.stop();
            this.job = null;
            console.log('⏹️  Square sync cron stopped');
        }
    }

    async run() {
        if (this.isRunning) {
            console.log('⏳ Square sync skipped (previous run still in progress)');
            return;
        }

        this.isRunning = true;

        try {
            const today = getTodayString();
            const connections = await SquareConnection.findActiveConnections();

            if (!connections || connections.length === 0) {
                console.log('ℹ️  Square sync: no active connections to process');
                return;
            }

            console.log(`🔄 Square sync: processing ${connections.length} store(s) up to ${today}`);

            for (const connection of connections) {
                const storeId = connection.store_id;
                try {
                    let nextDate = await SquareDailySales.getNextSyncDate(storeId, DEFAULT_START_DATE);
                    let processedDays = 0;

                    while (nextDate && nextDate <= today && processedDays < MAX_DAYS_PER_RUN) {
                        try {
                            console.log(`   ↳ syncing store ${storeId} for ${nextDate}`);
                            await SquareService.syncDailySales(storeId, nextDate, { enteredBy: 'square-cron' });
                        } catch (error) {
                            console.error(`   ⚠️  Square sync failed for store ${storeId} on ${nextDate}:`, error.message || error);
                            // If Square says unauthorized or connection invalid, break out for this store
                            if (error.status === 401 || error.status === 403) {
                                break;
                            }
                        }

                        processedDays += 1;
                        nextDate = getNextDay(nextDate);
                    }
                } catch (error) {
                    console.error(`❌ Square sync cron error for store ${connection.store_id}:`, error);
                }
            }
        } finally {
            this.isRunning = false;
        }
    }
}

module.exports = new SquareSyncCron();

