const cron = require('node-cron');
const LotteryEmailAccount = require('../models/LotteryEmailAccount');
const GmailService = require('../services/gmailService');
const { query } = require('../config/database');

const EMAIL_MONITOR_CRON = process.env.EMAIL_MONITOR_CRON || '*/5 * * * *';
const EMAIL_MONITOR_TIMEZONE = process.env.EMAIL_MONITOR_TIMEZONE || 'America/New_York';

/**
 * Email monitoring cron job
 * Default: run every 5 minutes (configurable via EMAIL_MONITOR_CRON)
 */
class EmailMonitorCron {
    static start() {
        cron.schedule(
            EMAIL_MONITOR_CRON,
            async () => {
                console.log('[Email Monitor] Checking for new emails...');
                
                try {
                    // Get all active email accounts
                    const accounts = await query(
                        'SELECT id FROM lottery_email_accounts WHERE is_active = true AND provider = $1',
                        ['gmail']
                    );

                    for (const accountRow of accounts.rows) {
                        try {
                            await GmailService.checkEmails(accountRow.id);
                            console.log(`[Email Monitor] Checked account ${accountRow.id}`);
                        } catch (error) {
                            console.error(`[Email Monitor] Error checking account ${accountRow.id}:`, error);
                        }
                    }

                    console.log('[Email Monitor] Email check completed');
                } catch (error) {
                    console.error('[Email Monitor] Fatal error:', error);
                }
            },
            {
                scheduled: true,
                timezone: EMAIL_MONITOR_TIMEZONE,
            }
        );

        console.log(`[Email Monitor] Started - schedule ${EMAIL_MONITOR_CRON} (${EMAIL_MONITOR_TIMEZONE})`);
    }
}

module.exports = EmailMonitorCron;

