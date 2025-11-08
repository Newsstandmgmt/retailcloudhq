const cron = require('node-cron');
const syncService = require('./syncService');
const RecurringExpensesService = require('./recurringExpensesService');

class SchedulerService {
    constructor() {
        this.jobs = [];
    }
    
    /**
     * Start the scheduler for automatic syncing
     */
    start() {
        console.log('🕐 Starting Google Sheets sync scheduler...');
        
        // Daily sync at 2 AM
        const dailyJob = cron.schedule('0 2 * * *', async () => {
            console.log('🔄 Running daily Google Sheets sync...');
            try {
                await syncService.syncAllStores('revenue');
                await syncService.syncAllStores('lottery');
                await syncService.syncAllStores('cashflow');
                console.log('✅ Daily sync completed');
            } catch (error) {
                console.error('❌ Daily sync failed:', error);
            }
        }, {
            scheduled: true,
            timezone: 'America/New_York', // Adjust to your timezone
        });
        
        this.jobs.push(dailyJob);
        
        // Hourly sync for stores that need it
        const hourlyJob = cron.schedule('0 * * * *', async () => {
            console.log('🔄 Running hourly Google Sheets sync...');
            try {
                const StoreGoogleSheet = require('../models/StoreGoogleSheet');
                const stores = await StoreGoogleSheet.findAutoSyncEnabled();
                
                for (const storeConfig of stores) {
                    if (storeConfig.sync_frequency === 'hourly') {
                        try {
                            await syncService.syncStoreData(storeConfig.store_id, 'revenue');
                        } catch (error) {
                            console.error(`Error syncing store ${storeConfig.store_id}:`, error);
                        }
                    }
                }
            } catch (error) {
                console.error('❌ Hourly sync failed:', error);
            }
        }, {
            scheduled: true,
            timezone: 'America/New_York',
        });
        
        this.jobs.push(hourlyJob);
        
        // Daily recurring expenses processing at 3 AM
        const recurringExpensesJob = cron.schedule('0 3 * * *', async () => {
            console.log('💰 Processing recurring expenses...');
            try {
                const result = await RecurringExpensesService.processRecurringExpenses();
                console.log(`✅ Recurring expenses processed: ${result.created.length} created, ${result.errors.length} errors`);
            } catch (error) {
                console.error('❌ Recurring expenses processing failed:', error);
            }
        }, {
            scheduled: true,
            timezone: 'America/New_York',
        });
        
        this.jobs.push(recurringExpensesJob);

        // Daily notification processing at 4 AM
        const notificationJob = cron.schedule('0 4 * * *', async () => {
            console.log('🔔 Processing notifications...');
            try {
                const NotificationService = require('./notificationService');
                
                // Create overdue invoice notifications
                const overdue = await NotificationService.createOverdueInvoiceNotifications();
                console.log(`✅ Created ${overdue.length} overdue invoice notifications`);
                
                // Create upcoming payment notifications (7 days ahead)
                const upcoming = await NotificationService.createUpcomingPaymentNotifications(7);
                console.log(`✅ Created ${upcoming.length} upcoming payment notifications`);
            } catch (error) {
                console.error('❌ Notification processing failed:', error);
            }
        }, {
            scheduled: true,
            timezone: 'America/New_York',
        });
        
        this.jobs.push(notificationJob);
        
        console.log('✅ Scheduler started successfully');
    }
    
    /**
     * Stop the scheduler
     */
    stop() {
        this.jobs.forEach(job => job.stop());
        this.jobs = [];
        console.log('⏹️  Scheduler stopped');
    }
}

module.exports = new SchedulerService();

