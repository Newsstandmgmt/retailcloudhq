const express = require('express');
const EmployeePayroll = require('../models/EmployeePayroll');
const User = require('../models/User');
const { authenticate, canAccessStore, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Check payroll access for current user (returns boolean, doesn't block)
router.get('/store/:storeId/check-access', canAccessStore, async (req, res) => {
    try {
        const storeId = req.params.storeId;
        
        // Super admin and admin always have access
        if (req.user.role === 'super_admin' || req.user.role === 'admin') {
            return res.json({ hasAccess: true });
        }
        
        // Check manager access
        if (req.user.role === 'manager') {
            const { query } = require('../config/database');
            
            // Find which admin created/manages this store
            const adminResult = await query(
                `SELECT created_by FROM stores WHERE id = $1`,
                [storeId]
            );
            
            if (adminResult.rows.length === 0) {
                return res.json({ hasAccess: false });
            }
            
            const adminId = adminResult.rows[0].created_by;
            
            // Check if manager is assigned to this store and admin has given payroll permission
            const result = await query(
                `SELECT ac.features->>'can_manage_payroll' as can_manage_payroll
                 FROM admin_config ac
                 JOIN store_managers sm ON sm.store_id = $1
                 WHERE ac.user_id = $2
                 AND sm.manager_id = $3
                 AND (ac.features->>'can_manage_payroll')::boolean = true`,
                [storeId, adminId, req.user.id]
            );
            
            return res.json({ hasAccess: result.rows.length > 0 && result.rows[0].can_manage_payroll === true });
        }
        
        // Employees and other roles don't have access
        return res.json({ hasAccess: false });
    } catch (error) {
        console.error('Check payroll access error:', error);
        res.status(500).json({ error: 'Error checking payroll access' });
    }
});

// Check if manager can manage payroll (admin permission)
const canManagePayroll = async (req, res, next) => {
    try {
        const storeId = req.params.storeId || req.body.store_id || req.query.store_id;
        
        if (req.user.role === 'super_admin' || req.user.role === 'admin') {
            return next();
        }
        
        if (req.user.role === 'manager') {
            // Check if manager has payroll permission via admin_config
            // First, find which admin created/manages this store
            const { query } = require('../config/database');
            const adminResult = await query(
                `SELECT created_by FROM stores WHERE id = $1`,
                [storeId]
            );
            
            if (adminResult.rows.length === 0) {
                return res.status(404).json({ error: 'Store not found' });
            }
            
            const adminId = adminResult.rows[0].created_by;
            
            // Check if manager is assigned to this store and admin has given payroll permission
            const result = await query(
                `SELECT ac.features->>'can_manage_payroll' as can_manage_payroll
                 FROM admin_config ac
                 JOIN store_managers sm ON sm.store_id = $1
                 WHERE ac.user_id = $2
                 AND sm.manager_id = $3
                 AND (ac.features->>'can_manage_payroll')::boolean = true`,
                [storeId, adminId, req.user.id]
            );
            
            if (result.rows.length === 0 || !result.rows[0].can_manage_payroll) {
                return res.status(403).json({ error: 'You do not have permission to manage payroll for this store.' });
            }
        }
        
        return next();
    } catch (error) {
        console.error('Payroll permission check error:', error);
        res.status(500).json({ error: 'Error checking payroll permissions' });
    }
};

// Get all employees with payroll config for a store
router.get('/store/:storeId/employees', canAccessStore, canManagePayroll, async (req, res) => {
    try {
        const employees = await EmployeePayroll.findByStore(req.params.storeId);
        res.json({ employees });
    } catch (error) {
        console.error('Get employees error:', error);
        res.status(500).json({ error: 'Failed to fetch employees' });
    }
});

// Add employee to payroll (create payroll config)
router.post('/store/:storeId/employees', canAccessStore, canManagePayroll, async (req, res) => {
    try {
        const { user_id, first_name, last_name, phone, email, hire_date, pay_rate, pay_schedule, pay_type, default_hours_per_week } = req.body;
        
        let userId = user_id;
        
        // If creating new employee (no user_id provided)
        if (!user_id && first_name && last_name) {
            const User = require('../models/User');
            // Create new user as employee
            const newUser = await User.create({
                email: email || `${first_name.toLowerCase()}.${last_name.toLowerCase()}@employee.com`,
                password: 'Temp123!', // Temporary password, should be changed
                first_name,
                last_name,
                phone: phone || null,
                role: 'employee',
                created_by: req.user.id
            });
            userId = newUser.id;
        }
        
        if (!userId || !pay_rate || !pay_schedule || !pay_type) {
            return res.status(400).json({ error: 'Employee information, pay rate, pay schedule, and pay type are required' });
        }

        const { pay_schedule_start_day, pay_schedule_end_day, pay_day, payroll_type } = req.body;
        
        const payroll = await EmployeePayroll.upsert(userId, req.params.storeId, {
            pay_rate,
            pay_schedule,
            pay_type,
            payroll_type: payroll_type || 'standard',
            default_hours_per_week: default_hours_per_week || 40,
            hire_date: hire_date || new Date().toISOString().split('T')[0],
            employment_status: 'active',
            pay_schedule_start_day: pay_schedule_start_day || null,
            pay_schedule_end_day: pay_schedule_end_day || null,
            pay_day: pay_day || null,
            changed_by: req.user.id
        });

        res.status(201).json({
            message: 'Employee added to payroll successfully',
            payroll
        });
    } catch (error) {
        console.error('Add employee error:', error);
        res.status(500).json({ error: error.message || 'Failed to add employee to payroll' });
    }
});

// Fire employee
router.post('/config/:configId/fire', canManagePayroll, async (req, res) => {
    try {
        const { fire_date } = req.body;
        
        if (!fire_date) {
            return res.status(400).json({ error: 'Fire date is required' });
        }

        const payroll = await EmployeePayroll.fireEmployee(
            req.params.configId,
            fire_date,
            req.user.id
        );

        res.json({
            message: 'Employee fired successfully',
            payroll
        });
    } catch (error) {
        console.error('Fire employee error:', error);
        res.status(500).json({ error: error.message || 'Failed to fire employee' });
    }
});

// Rehire employee
router.post('/config/:configId/rehire', canManagePayroll, async (req, res) => {
    try {
        const { rehire_date } = req.body;
        
        if (!rehire_date) {
            return res.status(400).json({ error: 'Rehire date is required' });
        }

        const payroll = await EmployeePayroll.rehireEmployee(
            req.params.configId,
            rehire_date,
            req.user.id
        );

        res.json({
            message: 'Employee rehired successfully',
            payroll
        });
    } catch (error) {
        console.error('Rehire employee error:', error);
        res.status(500).json({ error: error.message || 'Failed to rehire employee' });
    }
});

// Delete employee (soft delete - sets deleted_at)
router.delete('/config/:configId', canManagePayroll, async (req, res) => {
    try {
        const deleted = await EmployeePayroll.delete(req.params.configId);
        
        if (!deleted) {
            return res.status(404).json({ error: 'Employee payroll configuration not found' });
        }

        res.json({
            message: 'Employee deleted successfully',
            payroll: deleted
        });
    } catch (error) {
        console.error('Delete employee error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete employee' });
    }
});

// Restore deleted employee (super admin only - within 14 days)
router.post('/config/:configId/restore', authorize('super_admin'), async (req, res) => {
    try {
        // Check if employee was deleted within 14 days
        const { query } = require('../config/database');
        const checkResult = await query(
            `SELECT deleted_at FROM employee_payroll_config 
             WHERE id = $1 AND deleted_at IS NOT NULL 
             AND deleted_at >= CURRENT_DATE - INTERVAL '14 days'`,
            [req.params.configId]
        );
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Deleted employee not found or deletion is older than 14 days' });
        }
        
        const payroll = await EmployeePayroll.restore(req.params.configId);

        res.json({
            message: 'Employee restored successfully',
            payroll
        });
    } catch (error) {
        console.error('Restore employee error:', error);
        res.status(500).json({ error: error.message || 'Failed to restore employee' });
    }
});

// Get deleted employees for a store (super admin only)
router.get('/store/:storeId/deleted-employees', authorize('super_admin'), canAccessStore, async (req, res) => {
    try {
        const deletedEmployees = await EmployeePayroll.findDeletedByStore(req.params.storeId);
        res.json({ employees: deletedEmployees });
    } catch (error) {
        console.error('Get deleted employees error:', error);
        res.status(500).json({ error: 'Failed to fetch deleted employees' });
    }
});

// Update pay rate
router.patch('/config/:configId/pay-rate', canManagePayroll, async (req, res) => {
    try {
        const { new_pay_rate, effective_date, reason } = req.body;
        
        if (!new_pay_rate) {
            return res.status(400).json({ error: 'New pay rate is required' });
        }

        let payroll;
        if (effective_date) {
            payroll = await EmployeePayroll.updatePayRateWithEffectiveDate(
                req.params.configId,
                new_pay_rate,
                effective_date,
                req.user.id,
                reason || null
            );
        } else {
            payroll = await EmployeePayroll.updatePayRate(
                req.params.configId,
                new_pay_rate,
                req.user.id,
                reason || null
            );
        }

        res.json({
            message: 'Pay rate updated successfully',
            payroll
        });
    } catch (error) {
        console.error('Update pay rate error:', error);
        res.status(500).json({ error: error.message || 'Failed to update pay rate' });
    }
});

// Get pay rate history
router.get('/config/:configId/pay-rate-history', async (req, res) => {
    try {
        const history = await EmployeePayroll.getPayRateHistory(req.params.configId);
        res.json({ history });
    } catch (error) {
        console.error('Get pay rate history error:', error);
        res.status(500).json({ error: 'Failed to fetch pay rate history' });
    }
});

// Get custom payroll notifications (weekend time off alerts)
router.get('/store/:storeId/custom-payroll-notifications', canAccessStore, canManagePayroll, async (req, res) => {
    try {
        const CustomPayrollService = require('../services/customPayrollService');
        const notifications = await CustomPayrollService.getEmployeesNeedingNotification(req.params.storeId);
        
        const formattedNotifications = notifications.map(notif => {
            const message = CustomPayrollService.getNotificationMessage(
                notif.employee,
                notif.time_off_records,
                notif.pay_period
            );
            return message;
        });
        
        res.json({ notifications: formattedNotifications });
    } catch (error) {
        console.error('Get custom payroll notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch custom payroll notifications' });
    }
});

// Add time off
router.post('/config/:configId/time-off', canManagePayroll, async (req, res) => {
    try {
        const { date, time_off_type, hours_off, reason } = req.body;
        
        if (!date || !time_off_type) {
            return res.status(400).json({ error: 'Date and time off type are required' });
        }

        if (time_off_type === 'hours' && !hours_off) {
            return res.status(400).json({ error: 'Hours off is required for partial day time off' });
        }

        const timeOff = await EmployeePayroll.addTimeOff(req.params.configId, {
            date,
            time_off_type,
            hours_off: hours_off || null,
            reason: reason || null,
            entered_by: req.user.id
        });

        // Check for custom payroll weekend time off notification
        try {
            const CustomPayrollService = require('../services/customPayrollService');
            const employeeConfig = await EmployeePayroll.findById(req.params.configId);
            if (employeeConfig && employeeConfig.payroll_type === 'custom') {
                const timeOffDate = new Date(date);
                const dayOfWeek = timeOffDate.getDay();
                // Check if time off is on Saturday (6) or Sunday (0) before Friday payday
                if ((dayOfWeek === 0 || dayOfWeek === 6)) {
                    const today = new Date();
                    const currentDayOfWeek = today.getDay();
                    // If we're before Friday, this needs review
                    if (currentDayOfWeek < 5) {
                        // This will be checked when payroll notifications are fetched
                    }
                }
            }
        } catch (notificationError) {
            console.error('Error checking custom payroll notification:', notificationError);
            // Don't fail the time off creation
        }

        res.status(201).json({
            message: 'Time off recorded successfully',
            time_off: timeOff
        });
    } catch (error) {
        console.error('Add time off error:', error);
        res.status(500).json({ error: error.message || 'Failed to record time off' });
    }
});

// Get time off records
router.get('/config/:configId/time-off', canManagePayroll, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }

        const timeOffRecords = await EmployeePayroll.getTimeOffRecords(
            req.params.configId,
            start_date,
            end_date
        );

        res.json({
            timeOffRecords
        });
    } catch (error) {
        console.error('Get time off records error:', error);
        res.status(500).json({ error: 'Failed to fetch time off records' });
    }
});

// Calculate payroll for date range
router.post('/config/:configId/calculate', canManagePayroll, async (req, res) => {
    try {
        const { from_date, to_date } = req.body;
        
        if (!from_date || !to_date) {
            return res.status(400).json({ error: 'From date and to date are required' });
        }

        const calculation = await EmployeePayroll.calculatePayroll(
            req.params.configId,
            from_date,
            to_date
        );

        res.json({ calculation });
    } catch (error) {
        console.error('Calculate payroll error:', error);
        res.status(500).json({ error: error.message || 'Failed to calculate payroll' });
    }
});

// Run payroll (create payroll run)
router.post('/store/:storeId/run', canAccessStore, canManagePayroll, async (req, res) => {
    try {
        const { employee_ids, from_date, to_date, payroll_date, check_number, bank, notes } = req.body;
        
        if (!employee_ids || !Array.isArray(employee_ids) || employee_ids.length === 0) {
            return res.status(400).json({ error: 'At least one employee is required' });
        }
        
        if (!from_date || !to_date || !payroll_date) {
            return res.status(400).json({ error: 'From date, to date, and payroll date are required' });
        }

        const payrollRuns = [];
        
        for (const employeeId of employee_ids) {
            // Get payroll config
            const config = await EmployeePayroll.findByEmployeeAndStore(employeeId, req.params.storeId);
            if (!config) {
                continue; // Skip if no config found
            }

            // Calculate payroll
            const calculation = await EmployeePayroll.calculatePayroll(
                config.id,
                from_date,
                to_date
            );

            // Create payroll run
            const payrollRun = await EmployeePayroll.createPayrollRun({
                store_id: req.params.storeId,
                employee_payroll_config_id: config.id,
                from_date,
                to_date,
                payroll_date,
                pay_rate: calculation.config.pay_rate,
                hours_worked: calculation.actual_hours,
                time_off_hours: calculation.time_off_hours,
                gross_pay: calculation.gross_pay,
                unit: calculation.config.pay_type === 'hourly' ? 'hours' : 'salary',
                check_number: check_number || null,
                bank: bank || null,
                notes: notes || null,
                created_by: req.user.id
            });

            payrollRuns.push(payrollRun);
        }

        res.status(201).json({
            message: `Payroll run completed for ${payrollRuns.length} employee(s)`,
            payroll_runs: payrollRuns
        });
    } catch (error) {
        console.error('Run payroll error:', error);
        res.status(500).json({ error: error.message || 'Failed to run payroll' });
    }
});

// Get payroll history
router.get('/store/:storeId/history', canAccessStore, async (req, res) => {
    try {
        const { employee_id, start_date, end_date } = req.query;
        const history = await EmployeePayroll.getPayrollHistory(req.params.storeId, {
            employee_id,
            start_date,
            end_date
        });
        res.json({ history });
    } catch (error) {
        console.error('Get payroll history error:', error);
        res.status(500).json({ error: 'Failed to fetch payroll history' });
    }
});

// Get available employees (not yet in payroll) for a store
router.get('/store/:storeId/available-employees', canAccessStore, canManagePayroll, async (req, res) => {
    try {
        const { query } = require('../config/database');
        const result = await query(
            `SELECT u.id, u.first_name, u.last_name, u.email, u.phone
             FROM users u
             JOIN user_store_assignments usa ON usa.user_id = u.id
             WHERE usa.store_id = $1
             AND u.role = 'employee'
             AND u.is_active = true
             AND u.id NOT IN (
                 SELECT user_id FROM employee_payroll_config WHERE store_id = $1 AND is_active = true
             )
             ORDER BY u.last_name, u.first_name`,
            [req.params.storeId]
        );
        res.json({ employees: result.rows });
    } catch (error) {
        console.error('Get available employees error:', error);
        res.status(500).json({ error: 'Failed to fetch available employees' });
    }
});

module.exports = router;

