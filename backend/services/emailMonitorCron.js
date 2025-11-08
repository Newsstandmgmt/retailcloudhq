const cron = require('node-cron');
const LotteryEmailAccount = require('../models/LotteryEmailAccount');
const GmailService = require('../services/gmailService');
const { query } = require('../config/database');

/**
 * Email monitoring cron job
 * Checks for new lottery emails every 15 minutes
 */
class EmailMonitorCron {
    static start() {
        // Run every 15 minutes
        cron.schedule('*/15 * * * *', async () => {
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
        });

        console.log('[Email Monitor] Started - checking emails every 15 minutes');
    }
}

module.exports = EmailMonitorCron;

