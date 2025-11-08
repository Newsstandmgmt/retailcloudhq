const { query } = require('../config/database');

class CustomPayrollService {
    /**
     * Get current pay period for custom payroll (Monday to Sunday)
     */
    static getCurrentPayPeriod(today = new Date()) {
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday = 0
        
        const monday = new Date(today);
        monday.setDate(today.getDate() - daysFromMonday);
        monday.setHours(0, 0, 0, 0);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        
        return {
            start_date: monday.toISOString().split('T')[0],
            end_date: sunday.toISOString().split('T')[0],
            monday,
            sunday
        };
    }

    /**
     * Get next Friday (payday) for custom payroll
     * If today is Friday, return today. Otherwise, return next Friday.
     */
    static getNextPayDay(today = new Date()) {
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const daysUntilFriday = dayOfWeek === 0 ? 5 : (5 - dayOfWeek + 7) % 7 || 7;
        
        const friday = new Date(today);
        friday.setDate(today.getDate() + daysUntilFriday);
        friday.setHours(0, 0, 0, 0);
        
        return friday.toISOString().split('T')[0];
    }

    /**
     * Check if time off is logged for Saturday/Sunday in current pay period
     * Returns array of time off records that need review
     */
    static async checkWeekendTimeOff(storeId, employeeConfigId) {
        const period = this.getCurrentPayPeriod();
        const today = new Date();
        const dayOfWeek = today.getDay();
        
        // Only check if we're before Friday (payday)
        // Friday = 5, Saturday = 6, Sunday = 0
        if (dayOfWeek >= 5) {
            return []; // Already past payday for this week
        }
        
        // Check for time off on Saturday or Sunday of current pay period
        const saturday = new Date(period.monday);
        saturday.setDate(period.monday.getDate() + 5);
        
        const sunday = new Date(period.monday);
        sunday.setDate(period.monday.getDate() + 6);
        
        const result = await query(
            `SELECT * FROM time_off_records 
             WHERE employee_payroll_config_id = $1 
             AND date IN ($2, $3)
             AND (time_off_type = 'full_day' OR hours_off > 0)
             ORDER BY date`,
            [employeeConfigId, saturday.toISOString().split('T')[0], sunday.toISOString().split('T')[0]]
        );
        
        return result.rows;
    }

    /**
     * Get all employees with custom payroll that need notification
     * Returns array of { employee, time_off_records }
     */
    static async getEmployeesNeedingNotification(storeId) {
        const today = new Date();
        const dayOfWeek = today.getDay();
        
        // Only run check Monday through Thursday (before Friday payday)
        if (dayOfWeek >= 5) {
            return [];
        }
        
        // Get all active employees with custom payroll
        const employeesResult = await query(
            `SELECT epc.*, u.first_name, u.last_name, u.email
             FROM employee_payroll_config epc
             JOIN users u ON u.id = epc.user_id
             WHERE epc.store_id = $1 
             AND epc.is_active = true
             AND epc.employment_status = 'active'
             AND epc.payroll_type = 'custom'`,
            [storeId]
        );
        
        const notifications = [];
        
        for (const employee of employeesResult.rows) {
            const timeOffRecords = await this.checkWeekendTimeOff(storeId, employee.id);
            if (timeOffRecords.length > 0) {
                notifications.push({
                    employee,
                    time_off_records: timeOffRecords,
                    pay_period: this.getCurrentPayPeriod(),
                    pay_day: this.getNextPayDay()
                });
            }
        }
        
        return notifications;
    }

    /**
     * Calculate pay period for custom payroll
     * Returns the Monday-Sunday period that should be paid on the given Friday
     */
    static getPayPeriodForPayDay(payDay) {
        const payDate = new Date(payDay);
        const dayOfWeek = payDate.getDay();
        
        if (dayOfWeek !== 5) {
            throw new Error('Pay day for custom payroll must be a Friday');
        }
        
        // Go back to Monday (5 days before Friday)
        const monday = new Date(payDate);
        monday.setDate(payDate.getDate() - 4);
        monday.setHours(0, 0, 0, 0);
        
        // Go to Sunday (6 days after Monday)
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        
        return {
            start_date: monday.toISOString().split('T')[0],
            end_date: sunday.toISOString().split('T')[0],
            pay_day: payDate.toISOString().split('T')[0],
            monday,
            sunday
        };
    }

    /**
     * Check if it's time to run payroll (Friday before Sunday)
     */
    static isPayrollDay(today = new Date()) {
        const dayOfWeek = today.getDay();
        return dayOfWeek === 5; // Friday
    }

    /**
     * Get notification message for weekend time off
     */
    static getNotificationMessage(employee, timeOffRecords, payPeriod) {
        const days = timeOffRecords.map(r => {
            const date = new Date(r.date);
            return date.toLocaleDateString('en-US', { weekday: 'long' });
        }).join(' and ');
        
        return {
            title: `Weekend Time Off Alert: ${employee.first_name} ${employee.last_name}`,
            message: `Time off has been logged for ${days} (${payPeriod.start_date} to ${payPeriod.end_date}). Please review salary before processing payroll on Friday (${payPeriod.pay_day}).`,
            employee_id: employee.user_id,
            employee_config_id: employee.id,
            time_off_records: timeOffRecords,
            pay_period: payPeriod,
            urgency: 'high'
        };
    }
}

module.exports = CustomPayrollService;

