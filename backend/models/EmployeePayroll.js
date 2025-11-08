const { query } = require('../config/database');

class EmployeePayroll {
    constructor(data) {
        Object.assign(this, data);
    }

    // Create or update employee payroll configuration
    static async upsert(userId, storeId, payrollData) {
        const { pay_rate, pay_schedule, pay_type, payroll_type, default_hours_per_week, hire_date, employment_status, pay_schedule_start_day, pay_schedule_end_day, pay_day } = payrollData;
        
        // For custom payroll, set defaults
        let finalPaySchedule = pay_schedule;
        let finalPayScheduleStartDay = pay_schedule_start_day;
        let finalPayScheduleEndDay = pay_schedule_end_day;
        let finalPayDay = pay_day;
        
        if (payroll_type === 'custom') {
            finalPaySchedule = 'weekly';
            finalPayScheduleStartDay = 'Monday';
            finalPayScheduleEndDay = 'Sunday';
            finalPayDay = 'Friday';
        }
        
        // Get existing config to track pay rate changes
        const existing = await query(
            'SELECT id, pay_rate FROM employee_payroll_config WHERE user_id = $1 AND store_id = $2',
            [userId, storeId]
        );

        let configId;
        let oldPayRate = null;

        if (existing.rows.length > 0) {
            configId = existing.rows[0].id;
            oldPayRate = parseFloat(existing.rows[0].pay_rate);
            
            // Update existing config
            const updates = [];
            const values = [];
            let paramCount = 1;

            if (pay_rate !== undefined) {
                updates.push(`pay_rate = $${paramCount}`);
                values.push(pay_rate);
                paramCount++;
            }
            if (pay_schedule !== undefined) {
                updates.push(`pay_schedule = $${paramCount}`);
                values.push(pay_schedule);
                paramCount++;
            }
            if (pay_type !== undefined) {
                updates.push(`pay_type = $${paramCount}`);
                values.push(pay_type);
                paramCount++;
            }
            if (default_hours_per_week !== undefined) {
                updates.push(`default_hours_per_week = $${paramCount}`);
                values.push(default_hours_per_week);
                paramCount++;
            }
            if (hire_date !== undefined) {
                updates.push(`hire_date = $${paramCount}`);
                values.push(hire_date);
                paramCount++;
            }
            if (employment_status !== undefined) {
                updates.push(`employment_status = $${paramCount}`);
                values.push(employment_status);
                paramCount++;
            }
            if (pay_schedule_start_day !== undefined) {
                updates.push(`pay_schedule_start_day = $${paramCount}`);
                values.push(pay_schedule_start_day);
                paramCount++;
            }
            if (pay_schedule_end_day !== undefined) {
                updates.push(`pay_schedule_end_day = $${paramCount}`);
                values.push(pay_schedule_end_day);
                paramCount++;
            }
            if (pay_day !== undefined) {
                updates.push(`pay_day = $${paramCount}`);
                values.push(finalPayDay);
                paramCount++;
            }
            if (payroll_type !== undefined) {
                updates.push(`payroll_type = $${paramCount}`);
                values.push(payroll_type);
                paramCount++;
            }
            if (pay_schedule !== undefined && payroll_type === 'custom') {
                updates.push(`pay_schedule = $${paramCount}`);
                values.push('weekly');
                paramCount++;
                updates.push(`pay_schedule_start_day = $${paramCount}`);
                values.push('Monday');
                paramCount++;
                updates.push(`pay_schedule_end_day = $${paramCount}`);
                values.push('Sunday');
                paramCount++;
            } else {
                if (pay_schedule !== undefined) {
                    updates.push(`pay_schedule = $${paramCount}`);
                    values.push(finalPaySchedule);
                    paramCount++;
                }
                if (pay_schedule_start_day !== undefined) {
                    updates.push(`pay_schedule_start_day = $${paramCount}`);
                    values.push(finalPayScheduleStartDay);
                    paramCount++;
                }
                if (pay_schedule_end_day !== undefined) {
                    updates.push(`pay_schedule_end_day = $${paramCount}`);
                    values.push(finalPayScheduleEndDay);
                    paramCount++;
                }
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(configId);
            
            const result = await query(
                `UPDATE employee_payroll_config 
                 SET ${updates.join(', ')}
                 WHERE id = $${paramCount}
                 RETURNING *`,
                values
            );
            
            // Track pay rate change if it changed
            if (pay_rate !== undefined && oldPayRate !== parseFloat(pay_rate)) {
                await query(
                    `INSERT INTO pay_rate_history (employee_payroll_config_id, old_pay_rate, new_pay_rate, changed_by, reason)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [configId, oldPayRate, pay_rate, payrollData.changed_by || null, payrollData.reason || null]
                );
            }
            
            return result.rows[0];
        } else {
            // Create new config
            const result = await query(
                `INSERT INTO employee_payroll_config (user_id, store_id, pay_rate, pay_schedule, pay_type, payroll_type, default_hours_per_week, hire_date, employment_status, pay_schedule_start_day, pay_schedule_end_day, pay_day)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 RETURNING *`,
                [userId, storeId, pay_rate, finalPaySchedule, pay_type, payroll_type || 'standard', default_hours_per_week || 40, hire_date || null, employment_status || 'active', finalPayScheduleStartDay || null, finalPayScheduleEndDay || null, finalPayDay || null]
            );
            
            configId = result.rows[0].id;
            
            // Record initial pay rate in history
            await query(
                `INSERT INTO pay_rate_history (employee_payroll_config_id, old_pay_rate, new_pay_rate, changed_by, reason)
                 VALUES ($1, NULL, $2, $3, $4)`,
                [configId, pay_rate, payrollData.changed_by || null, 'Initial pay rate' || null]
            );
            
            return result.rows[0];
        }
    }

    // Get payroll config for an employee at a store
    static async findByEmployeeAndStore(userId, storeId) {
        const result = await query(
            `SELECT epc.*, u.first_name, u.last_name, u.email, u.phone
             FROM employee_payroll_config epc
             JOIN users u ON u.id = epc.user_id
             WHERE epc.user_id = $1 AND epc.store_id = $2`,
            [userId, storeId]
        );
        return result.rows[0] || null;
    }

    // Get all payroll configs for a store
    static async findByStore(storeId, includeFired = false) {
        let sql = `SELECT epc.*, u.first_name, u.last_name, u.email, u.phone
                          FROM employee_payroll_config epc
                          JOIN users u ON u.id = epc.user_id
                          WHERE epc.store_id = $1 
                          AND epc.is_active = true
                          AND epc.deleted_at IS NULL`;
        
        if (!includeFired) {
            sql += ` AND epc.employment_status != 'fired'`;
        }
        
        sql += ` ORDER BY u.last_name, u.first_name`;
        
        const result = await query(sql, [storeId]);
        return result.rows;
    }

    // Fire employee
    static async fireEmployee(configId, fireDate, firedBy) {
        const result = await query(
            `UPDATE employee_payroll_config 
             SET employment_status = 'fired', fire_date = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [fireDate, configId]
        );
        return result.rows[0] || null;
    }

    // Rehire employee
    static async rehireEmployee(configId, rehireDate, rehiredBy) {
        const result = await query(
            `UPDATE employee_payroll_config 
             SET employment_status = 'rehired', rehire_date = $1, fire_date = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [rehireDate, configId]
        );
        return result.rows[0] || null;
    }

    // Soft delete employee payroll config (set deleted_at timestamp)
    static async delete(configId) {
        const result = await query(
            'UPDATE employee_payroll_config SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
            [configId]
        );
        return result.rows[0] || null;
    }
    
    // Restore deleted employee payroll config (clear deleted_at)
    static async restore(configId) {
        const result = await query(
            'UPDATE employee_payroll_config SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
            [configId]
        );
        return result.rows[0] || null;
    }
    
    // Get deleted employees (for super admin - within 14 days)
    static async findDeletedByStore(storeId) {
        const result = await query(
            `SELECT epc.*, u.first_name, u.last_name, u.email, u.phone
             FROM employee_payroll_config epc
             JOIN users u ON u.id = epc.user_id
             WHERE epc.store_id = $1 
             AND epc.deleted_at IS NOT NULL
             AND epc.deleted_at >= CURRENT_DATE - INTERVAL '14 days'
             ORDER BY epc.deleted_at DESC`,
            [storeId]
        );
        return result.rows;
    }

    // Update pay rate with effective date
    static async updatePayRateWithEffectiveDate(configId, newPayRate, effectiveDate, changedBy, reason = null) {
        // Get current pay rate
        const current = await query(
            'SELECT pay_rate FROM employee_payroll_config WHERE id = $1',
            [configId]
        );
        
        if (current.rows.length === 0) {
            throw new Error('Payroll configuration not found');
        }
        
        const oldPayRate = parseFloat(current.rows[0].pay_rate);
        
        // Update pay rate
        const result = await query(
            `UPDATE employee_payroll_config 
             SET pay_rate = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [newPayRate, configId]
        );
        
        // Record change in history with effective date
        await query(
            `INSERT INTO pay_rate_history (employee_payroll_config_id, old_pay_rate, new_pay_rate, changed_by, reason, changed_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [configId, oldPayRate, newPayRate, changedBy, reason || 'Pay rate change', effectiveDate]
        );
        
        return result.rows[0];
    }

    // Get pay rate history for an employee
    static async getPayRateHistory(configId) {
        const result = await query(
            `SELECT prh.*, u.first_name, u.last_name as changed_by_name
             FROM pay_rate_history prh
             LEFT JOIN users u ON u.id = prh.changed_by
             WHERE prh.employee_payroll_config_id = $1
             ORDER BY prh.changed_at DESC`,
            [configId]
        );
        return result.rows;
    }

    // Update pay rate (with history tracking)
    static async updatePayRate(configId, newPayRate, changedBy, reason = null) {
        // Get current pay rate
        const current = await query(
            'SELECT pay_rate FROM employee_payroll_config WHERE id = $1',
            [configId]
        );
        
        if (current.rows.length === 0) {
            throw new Error('Payroll configuration not found');
        }
        
        const oldPayRate = parseFloat(current.rows[0].pay_rate);
        
        // Update pay rate
        const result = await query(
            `UPDATE employee_payroll_config 
             SET pay_rate = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [newPayRate, configId]
        );
        
        // Record change in history
        await query(
            `INSERT INTO pay_rate_history (employee_payroll_config_id, old_pay_rate, new_pay_rate, changed_by, reason)
             VALUES ($1, $2, $3, $4, $5)`,
            [configId, oldPayRate, newPayRate, changedBy, reason]
        );
        
        return result.rows[0];
    }

    // Add time off record
    static async addTimeOff(configId, timeOffData) {
        const { date, time_off_type, hours_off, reason, entered_by } = timeOffData;
        
        const result = await query(
            `INSERT INTO time_off_records (employee_payroll_config_id, date, time_off_type, hours_off, reason, entered_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (employee_payroll_config_id, date) DO UPDATE SET
                 time_off_type = EXCLUDED.time_off_type,
                 hours_off = EXCLUDED.hours_off,
                 reason = EXCLUDED.reason
             RETURNING *`,
            [configId, date, time_off_type, hours_off || null, reason || null, entered_by || null]
        );
        
        return result.rows[0];
    }

    // Get time off records for date range
    static async getTimeOffRecords(configId, startDate, endDate) {
        const result = await query(
            `SELECT * FROM time_off_records
             WHERE employee_payroll_config_id = $1
             AND date >= $2 AND date <= $3
             ORDER BY date`,
            [configId, startDate, endDate]
        );
        return result.rows;
    }

    // Calculate payroll for a date range
    static async calculatePayroll(configId, fromDate, toDate) {
        const config = await query(
            'SELECT * FROM employee_payroll_config WHERE id = $1',
            [configId]
        );
        
        if (config.rows.length === 0) {
            throw new Error('Payroll configuration not found');
        }
        
        const payroll = config.rows[0];
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        
        let totalHours = 0;
        let timeOffHours = 0;
        
        // Get time off records for this period
        const timeOffRecords = await this.getTimeOffRecords(configId, fromDate, toDate);
        
        // Calculate expected hours based on pay schedule
        if (payroll.pay_type === 'hourly') {
            const hoursPerDay = payroll.default_hours_per_week / 5; // Assuming 5-day work week
            totalHours = hoursPerDay * daysDiff;
            
            // Subtract time off
            timeOffRecords.forEach(record => {
                if (record.time_off_type === 'full_day') {
                    timeOffHours += hoursPerDay;
                } else if (record.time_off_type === 'hours' && record.hours_off) {
                    timeOffHours += parseFloat(record.hours_off);
                }
            });
        } else {
            // Salary - calculate based on pay schedule
            const weeks = daysDiff / 7;
            if (payroll.pay_schedule === 'weekly') {
                totalHours = payroll.default_hours_per_week * weeks;
            } else if (payroll.pay_schedule === 'biweekly') {
                totalHours = payroll.default_hours_per_week * (weeks / 2);
            } else if (payroll.pay_schedule === 'semimonthly') {
                totalHours = payroll.default_hours_per_week * (weeks / 2.17);
            } else if (payroll.pay_schedule === 'monthly') {
                totalHours = payroll.default_hours_per_week * (weeks / 4.33);
            }
        }
        
        const actualHours = totalHours - timeOffHours;
        
        // Calculate gross pay
        let grossPay = 0;
        if (payroll.pay_type === 'hourly') {
            grossPay = actualHours * parseFloat(payroll.pay_rate);
        } else {
            // Salary - prorate if needed
            grossPay = parseFloat(payroll.pay_rate);
            // Adjust for time off if salary
            if (timeOffHours > 0) {
                const hourlyRate = parseFloat(payroll.pay_rate) / (payroll.default_hours_per_week * 4.33); // Approximate monthly
                grossPay = grossPay - (timeOffHours * hourlyRate);
            }
        }
        
        return {
            config: payroll,
            from_date: fromDate,
            to_date: toDate,
            total_hours: totalHours,
            time_off_hours: timeOffHours,
            actual_hours: actualHours,
            gross_pay: grossPay,
            time_off_records: timeOffRecords
        };
    }

    // Create payroll run
    static async createPayrollRun(payrollData) {
        const {
            store_id, employee_payroll_config_id, from_date, to_date, payroll_date,
            pay_rate, hours_worked, time_off_hours, gross_pay, unit, check_number,
            bank, notes, created_by
        } = payrollData;
        
        const result = await query(
            `INSERT INTO payroll_runs (
                store_id, employee_payroll_config_id, from_date, to_date, payroll_date,
                pay_rate, hours_worked, time_off_hours, gross_pay, unit, check_number,
                bank, notes, created_by
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             RETURNING *`,
            [
                store_id, employee_payroll_config_id, from_date, to_date, payroll_date,
                pay_rate, hours_worked || null, time_off_hours || 0, gross_pay, unit || null,
                check_number || null, bank || null, notes || null, created_by
            ]
        );
        
        return result.rows[0];
    }

    // Get payroll history for a store
    static async getPayrollHistory(storeId, filters = {}) {
        let sql = `SELECT pr.*, epc.user_id, u.first_name, u.last_name, u.email
                   FROM payroll_runs pr
                   JOIN employee_payroll_config epc ON epc.id = pr.employee_payroll_config_id
                   JOIN users u ON u.id = epc.user_id
                   WHERE pr.store_id = $1`;
        const params = [storeId];
        let paramCount = 2;

        if (filters.employee_id) {
            sql += ` AND epc.user_id = $${paramCount}`;
            params.push(filters.employee_id);
            paramCount++;
        }

        if (filters.start_date) {
            sql += ` AND pr.payroll_date >= $${paramCount}`;
            params.push(filters.start_date);
            paramCount++;
        }

        if (filters.end_date) {
            sql += ` AND pr.payroll_date <= $${paramCount}`;
            params.push(filters.end_date);
            paramCount++;
        }

        sql += ' ORDER BY pr.payroll_date DESC, pr.created_at DESC';

        const result = await query(sql, params);
        return result.rows;
    }
}

module.exports = EmployeePayroll;

