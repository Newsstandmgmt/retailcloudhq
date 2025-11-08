/**
 * License Reminder Service
 * 
 * Checks for expiring licenses and sends reminders based on reminder_days_before settings.
 * This should be called daily via a cron job or scheduled task.
 */

const License = require('../models/License');
const { query } = require('../config/database');

class LicenseReminderService {
    /**
     * Check and send reminders for expiring licenses
     * This should be run daily
     */
    static async checkAndSendReminders() {
        try {
            // Update expired status first
            await License.updateExpiredStatus();

            // Get all licenses that need reminders
            const licenses = await License.getExpiringSoon(365); // Check all licenses
            
            const reminders = [];
            
            for (const license of licenses) {
                const expirationDate = new Date(license.expiration_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const daysUntilExpiration = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
                
                // Check if we should send reminder based on reminder_days_before
                if (daysUntilExpiration <= license.reminder_days_before && daysUntilExpiration >= 0) {
                    // Check if reminder was already sent recently (within last 7 days)
                    const lastReminder = license.last_reminder_sent 
                        ? new Date(license.last_reminder_sent)
                        : null;
                    
                    const daysSinceLastReminder = lastReminder 
                        ? Math.ceil((today - lastReminder) / (1000 * 60 * 60 * 24))
                        : 999;
                    
                    // Send reminder if not sent in last 7 days
                    if (daysSinceLastReminder >= 7 || !lastReminder) {
                        reminders.push({
                            license,
                            daysUntilExpiration
                        });
                        
                        // Mark reminder as sent
                        await License.markReminderSent(license.id);
                    }
                }
            }

            return {
                remindersSent: reminders.length,
                reminders: reminders.map(r => ({
                    license_id: r.license.id,
                    license_type: r.license.license_type,
                    license_number: r.license.license_number,
                    store_id: r.license.store_id,
                    expiration_date: r.license.expiration_date,
                    days_until_expiration: r.daysUntilExpiration
                }))
            };
        } catch (error) {
            console.error('Error checking license reminders:', error);
            throw error;
        }
    }

    /**
     * Get all licenses expiring soon for a specific store
     */
    static async getExpiringLicensesForStore(storeId, days = 30) {
        const licenses = await License.findByStore(storeId, { expiring_soon: days });
        return licenses.filter(license => {
            const expirationDate = new Date(license.expiration_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const daysUntil = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
            return daysUntil <= days && daysUntil >= 0;
        });
    }
}

module.exports = LicenseReminderService;

