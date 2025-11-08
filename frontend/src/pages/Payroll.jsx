import { useState, useEffect } from 'react';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { payrollAPI, usersAPI } from '../services/api';

const Payroll = () => {
  const { selectedStore } = useStore();
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [payrollHistory, setPayrollHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showPaySalaryModal, setShowPaySalaryModal] = useState(false);
  const [showEditPayRateModal, setShowEditPayRateModal] = useState(false);
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [payrollType, setPayrollType] = useState('standard'); // 'standard' or 'custom'
  const [customPayrollWarning, setCustomPayrollWarning] = useState(null);
  const [entriesPerPage, setEntriesPerPage] = useState(100);
  const [deletedEmployees, setDeletedEmployees] = useState([]);
  const [showDeletedEmployees, setShowDeletedEmployees] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filter states for history
  const [historyFilters, setHistoryFilters] = useState({
    employee: 'All Employees',
    period: 'This Month',
    dateRange: { start: '', end: '' }
  });

  // Form states
  const [employeeForm, setEmployeeForm] = useState({
    user_id: '',
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    hire_date: new Date().toISOString().split('T')[0],
    pay_rate: '',
    pay_schedule: 'weekly',
    pay_type: 'hourly',
    payroll_type: 'standard', // 'standard' or 'custom'
    default_hours_per_week: 40,
    pay_schedule_start_day: '',
    pay_schedule_end_day: '',
    pay_day: ''
  });

  const [showManageEmployeeModal, setShowManageEmployeeModal] = useState(false);
  const [showFireModal, setShowFireModal] = useState(false);
  const [showRehireModal, setShowRehireModal] = useState(false);
  const [showChangePayRateModal, setShowChangePayRateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fireForm, setFireForm] = useState({ fire_date: new Date().toISOString().split('T')[0] });
  const [rehireForm, setRehireForm] = useState({ rehire_date: new Date().toISOString().split('T')[0] });
  const [changePayRateForm, setChangePayRateForm] = useState({
    new_pay_rate: '',
    effective_date: new Date().toISOString().split('T')[0],
    reason: ''
  });

  const [payrollForm, setPayrollForm] = useState({
    from_date: '',
    to_date: '',
    payroll_date: new Date().toISOString().split('T')[0],
    check_number: '',
    bank: '',
    notes: ''
  });

  const [payRateForm, setPayRateForm] = useState({
    new_pay_rate: '',
    reason: ''
  });

  const [timeOffForm, setTimeOffForm] = useState({
    date: '',
    time_off_type: 'full_day',
    hours_off: '',
    reason: ''
  });

  useEffect(() => {
    if (selectedStore) {
      loadEmployees();
      loadPayrollHistory();
      loadAvailableEmployees();
      if (user?.role === 'super_admin') {
        loadDeletedEmployees();
      }
    }
  }, [selectedStore]);

  useEffect(() => {
    if (selectedStore) {
      loadPayrollHistory();
    }
  }, [historyFilters]);

  const loadEmployees = async () => {
    if (!selectedStore) return;
    try {
      const response = await payrollAPI.getEmployees(selectedStore.id);
      setEmployees(response.data.employees || []);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableEmployees = async () => {
    if (!selectedStore) return;
    try {
      const response = await payrollAPI.getAvailableEmployees(selectedStore.id);
      setAvailableEmployees(response.data.employees || []);
    } catch (error) {
      console.error('Error loading available employees:', error);
    }
  };

  const loadDeletedEmployees = async () => {
    if (!selectedStore) return;
    try {
      const response = await payrollAPI.getDeletedEmployees(selectedStore.id);
      setDeletedEmployees(response.data.employees || []);
    } catch (error) {
      console.error('Error loading deleted employees:', error);
    }
  };

  const loadCustomPayrollNotifications = async () => {
    if (!selectedStore) return;
    try {
      const response = await payrollAPI.getCustomPayrollNotifications(selectedStore.id);
      const notifications = response.data.notifications || [];
      if (notifications.length > 0) {
        // Show notification alert
        const messages = notifications.map(n => n.message).join('\n\n');
        setCustomPayrollWarning({
          title: 'Custom Payroll Alert',
          messages: notifications,
          fullMessage: messages
        });
      } else {
        setCustomPayrollWarning(null);
      }
    } catch (error) {
      console.error('Error loading custom payroll notifications:', error);
    }
  };

  const handleRestoreEmployee = async (configId) => {
    if (!window.confirm('Are you sure you want to restore this employee? They will be added back to the payroll list.')) {
      return;
    }
    
    try {
      await payrollAPI.restoreEmployee(configId);
      alert('Employee restored successfully!');
      loadEmployees();
      loadDeletedEmployees();
    } catch (error) {
      alert('Error restoring employee: ' + (error.response?.data?.error || error.message));
    }
  };

  const loadPayrollHistory = async () => {
    if (!selectedStore) return;
    try {
      const filters = {
        employee_id: historyFilters.employee !== 'All Employees' ? historyFilters.employee : undefined,
      };
      
      // Set date range based on period
      if (historyFilters.period === 'This Month') {
        const now = new Date();
        filters.start_date = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        filters.end_date = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      } else if (historyFilters.dateRange.start && historyFilters.dateRange.end) {
        filters.start_date = historyFilters.dateRange.start;
        filters.end_date = historyFilters.dateRange.end;
      }
      
      const response = await payrollAPI.getPayrollHistory(selectedStore.id, filters);
      setPayrollHistory(response.data.history || []);
    } catch (error) {
      console.error('Error loading payroll history:', error);
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!selectedStore) return;
    
    // Validate required fields
    if (!employeeForm.first_name || !employeeForm.last_name || !employeeForm.pay_rate || !employeeForm.pay_schedule || !employeeForm.pay_type) {
      alert('Please fill in all required fields');
      return;
    }
    
    try {
      await payrollAPI.addEmployee(selectedStore.id, employeeForm);
      alert('Employee added to payroll successfully!');
      setShowAddEmployeeModal(false);
      setEmployeeForm({
        user_id: '',
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        hire_date: new Date().toISOString().split('T')[0],
        pay_rate: '',
        pay_schedule: 'weekly',
        pay_type: 'hourly',
        payroll_type: 'standard',
        default_hours_per_week: 40,
        pay_schedule_start_day: '',
        pay_schedule_end_day: '',
        pay_day: ''
      });
      loadEmployees();
      loadAvailableEmployees();
    } catch (error) {
      alert('Error adding employee: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleManageEmployee = (employee) => {
    setSelectedEmployee(employee);
    setShowManageEmployeeModal(true);
  };

  const handleFireEmployee = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    
    try {
      await payrollAPI.fireEmployee(selectedEmployee.id, fireForm.fire_date);
      alert('Employee fired successfully!');
      setShowFireModal(false);
      setShowManageEmployeeModal(false);
      setSelectedEmployee(null);
      loadEmployees();
    } catch (error) {
      alert('Error firing employee: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleRehireEmployee = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    
    try {
      await payrollAPI.rehireEmployee(selectedEmployee.id, rehireForm.rehire_date);
      alert('Employee rehired successfully!');
      setShowRehireModal(false);
      setShowManageEmployeeModal(false);
      setSelectedEmployee(null);
      loadEmployees();
    } catch (error) {
      alert('Error rehiring employee: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleChangePayRate = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    
    try {
      await payrollAPI.updatePayRate(
        selectedEmployee.id,
        changePayRateForm.new_pay_rate,
        changePayRateForm.effective_date,
        changePayRateForm.reason
      );
      alert('Pay rate updated successfully!');
      setShowChangePayRateModal(false);
      setShowManageEmployeeModal(false);
      setSelectedEmployee(null);
      setChangePayRateForm({
        new_pay_rate: '',
        effective_date: new Date().toISOString().split('T')[0],
        reason: ''
      });
      loadEmployees();
    } catch (error) {
      alert('Error updating pay rate: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;
    
    const confirmMessage = user?.role === 'super_admin' 
      ? `Are you sure you want to delete ${selectedEmployee.first_name} ${selectedEmployee.last_name} from payroll? This employee can be restored within 14 days.`
      : `Are you sure you want to delete ${selectedEmployee.first_name} ${selectedEmployee.last_name} from payroll? Super Admin can restore them within 14 days if needed.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      await payrollAPI.deleteEmployee(selectedEmployee.id);
      alert('Employee deleted successfully!');
      setShowDeleteModal(false);
      setShowManageEmployeeModal(false);
      setSelectedEmployee(null);
      loadEmployees();
      if (user?.role === 'super_admin') {
        loadDeletedEmployees();
      }
    } catch (error) {
      alert('Error deleting employee: ' + (error.response?.data?.error || error.message));
    }
  };

  // Calculate Monday to Sunday dates
  const getMondayToSunday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(d);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    return { monday, sunday };
  };

  // Get Friday before Sunday
  const getFridayBeforeSunday = (sunday) => {
    const friday = new Date(sunday);
    friday.setDate(sunday.getDate() - 2); // 2 days before Sunday
    friday.setHours(0, 0, 0, 0);
    return friday;
  };

  const handleRunPayroll = async (employeeId) => {
    const employee = employees.find(e => e.user_id === employeeId);
    setSelectedEmployee(employee);
    
    if (payrollType === 'custom' && employee) {
      // Auto-calculate Monday to Sunday for current week
      const today = new Date();
      const { monday, sunday } = getMondayToSunday(today);
      const friday = getFridayBeforeSunday(sunday);
      
      // Check if we're running payroll before the period ends
      const isBeforePeriodEnd = today < sunday;
      
      // Check for time off on Saturday or Sunday
      let timeOffWarning = null;
      if (isBeforePeriodEnd) {
        try {
          const saturday = new Date(sunday);
          saturday.setDate(sunday.getDate() - 1);
          
          // Check for time off on Saturday or Sunday
          const timeOffRes = await payrollAPI.getTimeOffRecords(employee.id, saturday.toISOString().split('T')[0], sunday.toISOString().split('T')[0]);
          
          if (timeOffRes.data?.timeOffRecords && timeOffRes.data.timeOffRecords.length > 0) {
            timeOffWarning = 'Change Salary: Employee has time off logged for Saturday or Sunday. Please review the payroll calculation.';
            setCustomPayrollWarning(timeOffWarning);
          } else {
            setCustomPayrollWarning(null);
          }
        } catch (error) {
          console.error('Error checking time off:', error);
        }
      }
      
      setPayrollForm({
        from_date: monday.toISOString().split('T')[0],
        to_date: sunday.toISOString().split('T')[0],
        payroll_date: friday.toISOString().split('T')[0],
        check_number: '',
        bank: '',
        notes: ''
      });
    } else {
      setPayrollForm({
        from_date: '',
        to_date: '',
        payroll_date: new Date().toISOString().split('T')[0],
        check_number: '',
        bank: '',
        notes: ''
      });
      setCustomPayrollWarning(null);
    }
    
    setShowPaySalaryModal(true);
  };

  const handleCalculateAndRunPayroll = async (e) => {
    e.preventDefault();
    if (!selectedStore || !selectedEmployee) return;
    
    try {
      // Calculate payroll first
      const calcResponse = await payrollAPI.calculatePayroll(
        selectedEmployee.id,
        payrollForm.from_date,
        payrollForm.to_date
      );
      
      const calculation = calcResponse.data.calculation;
      
      // Show calculation summary and confirm
      const confirmMessage = `Payroll Calculation:\n` +
        `Period: ${calculation.from_date} to ${calculation.to_date}\n` +
        `Total Hours: ${calculation.total_hours.toFixed(2)}\n` +
        `Time Off Hours: ${calculation.time_off_hours.toFixed(2)}\n` +
        `Actual Hours: ${calculation.actual_hours.toFixed(2)}\n` +
        `Gross Pay: $${calculation.gross_pay.toFixed(2)}\n\n` +
        `Proceed with payroll run?`;
      
      if (!window.confirm(confirmMessage)) {
        return;
      }
      
      // Run payroll
      await payrollAPI.runPayroll(selectedStore.id, {
        employee_ids: [selectedEmployee.user_id],
        ...payrollForm
      });
      
      alert('Payroll run completed successfully!');
      setShowPaySalaryModal(false);
      setSelectedEmployee(null);
      loadPayrollHistory();
    } catch (error) {
      alert('Error running payroll: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleUpdatePayRate = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    
    try {
      await payrollAPI.updatePayRate(
        selectedEmployee.id,
        payRateForm.new_pay_rate,
        payRateForm.reason
      );
      alert('Pay rate updated successfully!');
      setShowEditPayRateModal(false);
      setSelectedEmployee(null);
      setPayRateForm({ new_pay_rate: '', reason: '' });
      loadEmployees();
    } catch (error) {
      alert('Error updating pay rate: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAddTimeOff = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    
    try {
      await payrollAPI.addTimeOff(selectedEmployee.id, timeOffForm);
      alert('Time off recorded successfully!');
      setShowTimeOffModal(false);
      setSelectedEmployee(null);
      setTimeOffForm({
        date: '',
        time_off_type: 'full_day',
        hours_off: '',
        reason: ''
      });
    } catch (error) {
      alert('Error recording time off: ' + (error.response?.data?.error || error.message));
    }
  };

  // Show message if no store selected
  if (!selectedStore && (user?.role === 'admin' || user?.role === 'manager')) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-gray-500 mb-4">Please select a store from the header dropdown.</p>
      </div>
    );
  }

  const filteredEmployees = employees.filter(emp => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      emp.first_name?.toLowerCase().includes(searchLower) ||
      emp.last_name?.toLowerCase().includes(searchLower) ||
      emp.email?.toLowerCase().includes(searchLower) ||
      emp.phone?.toLowerCase().includes(searchLower)
    );
  });

  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * entriesPerPage,
    currentPage * entriesPerPage
  );

  const totalPages = Math.ceil(filteredEmployees.length / entriesPerPage);

  return (
    <div>
      {/* Manage Payroll Section */}
      <div className="mb-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">Manage Payroll</h1>
            {user?.role === 'super_admin' && deletedEmployees.length > 0 && (
              <button
                onClick={() => setShowDeletedEmployees(!showDeletedEmployees)}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                View Deleted Employees ({deletedEmployees.length})
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Payroll Type Selector */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setPayrollType('standard')}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  payrollType === 'standard' 
                    ? 'bg-white text-[#2d8659] shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Standard Payroll
              </button>
              <button
                onClick={() => setPayrollType('custom')}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  payrollType === 'custom' 
                    ? 'bg-white text-[#2d8659] shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Custom Payroll
              </button>
            </div>
            <button
              onClick={() => setShowAddEmployeeModal(true)}
              className="px-4 py-2 bg-[#2d8659] text-white rounded-lg hover:bg-[#256b49] transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Employee
            </button>
          </div>
        </div>
        
        {payrollType === 'custom' && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Custom Payroll Mode:</strong> Pay period automatically set to Monday-Sunday. Payroll runs on Friday before Sunday. 
              If time off is logged for Saturday/Sunday before pay period ends, you'll be notified to review the salary.
            </p>
          </div>
        )}

        {/* Custom Payroll Notifications */}
        {customPayrollWarning && customPayrollWarning.messages && customPayrollWarning.messages.length > 0 && (
          <div className="mb-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                  ⚠️ Custom Payroll Alert: Weekend Time Off
                </h3>
                {customPayrollWarning.messages.map((notification, index) => (
                  <div key={index} className="mb-3 p-3 bg-yellow-100 rounded border border-yellow-300">
                    <p className="text-sm font-medium text-yellow-900 mb-1">
                      {notification.title}
                    </p>
                    <p className="text-sm text-yellow-800">
                      {notification.message}
                    </p>
                    {notification.time_off_records && notification.time_off_records.length > 0 && (
                      <div className="mt-2 text-xs text-yellow-700">
                        <strong>Time Off Dates:</strong>{' '}
                        {notification.time_off_records.map(tor => 
                          new Date(tor.date).toLocaleDateString()
                        ).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setCustomPayrollWarning(null)}
                className="text-yellow-700 hover:text-yellow-900 ml-4"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Search and Entries */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Show</span>
              <select
                value={entriesPerPage}
                onChange={(e) => {
                  setEntriesPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-600">entries</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                {currentPage} of {totalPages || 1}
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659] focus:border-transparent"
                />
                <svg
                  className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Employees Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pay Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pay Schedule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pay Salary
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : paginatedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No employees found. Add an employee to get started.
                    </td>
                  </tr>
                ) : (
                  paginatedEmployees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {employee.first_name} {employee.last_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${parseFloat(employee.pay_rate).toFixed(2)}/{employee.pay_type === 'hourly' ? 'hr' : employee.pay_schedule}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        {employee.pay_schedule}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleRunPayroll(employee.user_id)}
                          className="px-3 py-1 bg-[#2d8659] text-white rounded hover:bg-[#256b49] text-sm"
                        >
                          Pay Salary
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleManageEmployee(employee)}
                            className="text-purple-600 hover:text-purple-900"
                            title="Manage Employee"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedEmployee(employee);
                              setPayRateForm({
                                new_pay_rate: employee.pay_rate,
                                reason: ''
                              });
                              setShowEditPayRateModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit Pay Rate"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedEmployee(employee);
                              setTimeOffForm({
                                date: new Date().toISOString().split('T')[0],
                                time_off_type: 'full_day',
                                hours_off: '',
                                reason: ''
                              });
                              setShowTimeOffModal(true);
                            }}
                            className="text-green-600 hover:text-green-900"
                            title="Add Time Off"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Deleted Employees Section (Super Admin Only) */}
      {user?.role === 'super_admin' && showDeletedEmployees && deletedEmployees.length > 0 && (
        <div className="mb-8 bg-orange-50 border border-orange-200 rounded-lg shadow">
          <div className="p-4 border-b border-orange-200">
            <h2 className="text-lg font-semibold text-orange-900">Deleted Employees (Restore within 14 days)</h2>
            <p className="text-sm text-orange-700 mt-1">
              These employees were deleted and can be restored within 14 days of deletion.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-orange-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-orange-700 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-orange-700 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-orange-700 uppercase tracking-wider">
                    Deleted On
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-orange-700 uppercase tracking-wider">
                    Days Remaining
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-orange-700 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {deletedEmployees.map((employee) => {
                  const deletedDate = new Date(employee.deleted_at);
                  const daysSinceDeletion = Math.floor((Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24));
                  const daysRemaining = 14 - daysSinceDeletion;
                  
                  return (
                    <tr key={employee.id} className="hover:bg-orange-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {employee.first_name} {employee.last_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {deletedDate.toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-medium ${daysRemaining <= 3 ? 'text-red-600' : daysRemaining <= 7 ? 'text-orange-600' : 'text-green-600'}`}>
                          {daysRemaining > 0 ? `${daysRemaining} days` : 'Expired'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {daysRemaining > 0 ? (
                          <button
                            onClick={() => handleRestoreEmployee(employee.id)}
                            className="text-green-600 hover:text-green-900 font-medium"
                          >
                            Restore
                          </button>
                        ) : (
                          <span className="text-gray-400">Cannot restore</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Salary History Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Salary History</h2>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <select
              value={historyFilters.employee}
              onChange={(e) => setHistoryFilters({ ...historyFilters, employee: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
            >
              <option value="All Employees">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.user_id} value={emp.user_id}>
                  {emp.first_name} {emp.last_name}
                </option>
              ))}
            </select>

            <select
              value={historyFilters.period}
              onChange={(e) => setHistoryFilters({ ...historyFilters, period: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
            >
              <option value="This Month">This Month</option>
              <option value="Last Month">Last Month</option>
              <option value="This Quarter">This Quarter</option>
              <option value="Custom Range">Custom Range</option>
            </select>

            {historyFilters.period === 'Custom Range' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={historyFilters.dateRange.start}
                  onChange={(e) => setHistoryFilters({
                    ...historyFilters,
                    dateRange: { ...historyFilters.dateRange, start: e.target.value }
                  })}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="Start Date"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={historyFilters.dateRange.end}
                  onChange={(e) => setHistoryFilters({
                    ...historyFilters,
                    dateRange: { ...historyFilters.dateRange, end: e.target.value }
                  })}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="End Date"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Show</span>
              <select
                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                defaultValue={100}
              >
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-600">entries</span>
            </div>
            <div className="text-sm text-gray-600">1 of 1</div>
          </div>
        </div>

        {/* Salary History Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date Added
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    From Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    To Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payroll Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Check Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payrollHistory.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-8 text-center text-gray-500">
                      No payroll history found.
                    </td>
                  </tr>
                ) : (
                  payrollHistory.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(record.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.first_name} {record.last_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(record.from_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(record.to_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(record.payroll_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        {record.unit || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.check_number || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.bank || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {record.notes || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${parseFloat(record.gross_pay).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="text-blue-600 hover:text-blue-900">Edit</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAddEmployeeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-lg p-6 max-w-5xl w-full mx-4 my-8">
            <h2 className="text-xl font-bold mb-4">Add Employee to Payroll</h2>
            <form onSubmit={handleAddEmployee}>
              <div className="grid grid-cols-2 gap-4 max-h-[80vh] overflow-y-auto pr-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={employeeForm.first_name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, first_name: e.target.value })}
                    placeholder="First Name"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={employeeForm.last_name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, last_name: e.target.value })}
                    placeholder="Last Name"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone #
                  </label>
                  <input
                    type="tel"
                    value={employeeForm.phone}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                    placeholder="Phone Number"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={employeeForm.hire_date}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, hire_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pay Type *
                  </label>
                  <select
                    value={employeeForm.pay_type}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, pay_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  >
                    <option value="hourly">Hourly</option>
                    <option value="salary">Salary</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pay Rate ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={employeeForm.pay_rate}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, pay_rate: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    placeholder={employeeForm.pay_type === 'hourly' ? 'e.g., 15.00' : 'e.g., 3000.00'}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payroll Type *
                  </label>
                  <select
                    value={employeeForm.payroll_type}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, payroll_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  >
                    <option value="standard">Standard Payroll</option>
                    <option value="custom">Custom Payroll (Mon-Sun, Paid Friday)</option>
                  </select>
                  {employeeForm.payroll_type === 'custom' && (
                    <p className="mt-2 text-sm text-blue-600">
                      Custom payroll runs Monday to Sunday, with payment on Friday before the week ends.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pay Schedule *
                  </label>
                  <select
                    value={employeeForm.pay_schedule}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, pay_schedule: e.target.value, pay_schedule_start_day: '', pay_schedule_end_day: '', pay_day: '' })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                    disabled={employeeForm.payroll_type === 'custom'}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="semimonthly">Semi-Monthly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                {/* Pay Schedule Details */}
                {employeeForm.pay_schedule === 'weekly' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pay Period Start Day *
                      </label>
                      <select
                        value={employeeForm.pay_schedule_start_day}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, pay_schedule_start_day: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                        required
                      >
                        <option value="">Select Start Day</option>
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                        <option value="Saturday">Saturday</option>
                        <option value="Sunday">Sunday</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pay Period End Day *
                      </label>
                      <select
                        value={employeeForm.pay_schedule_end_day}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, pay_schedule_end_day: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                        required
                      >
                        <option value="">Select End Day</option>
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                        <option value="Saturday">Saturday</option>
                        <option value="Sunday">Sunday</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pay Day *
                      </label>
                      <select
                        value={employeeForm.pay_day}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, pay_day: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                        required
                      >
                        <option value="">Select Pay Day</option>
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                        <option value="Saturday">Saturday</option>
                        <option value="Sunday">Sunday</option>
                      </select>
                    </div>
                  </>
                )}

                {employeeForm.pay_schedule === 'biweekly' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pay Period Start Day *
                      </label>
                      <select
                        value={employeeForm.pay_schedule_start_day}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, pay_schedule_start_day: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                        required
                      >
                        <option value="">Select Start Day</option>
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                        <option value="Saturday">Saturday</option>
                        <option value="Sunday">Sunday</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pay Day *
                      </label>
                      <select
                        value={employeeForm.pay_day}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, pay_day: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                        required
                      >
                        <option value="">Select Pay Day</option>
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                        <option value="Saturday">Saturday</option>
                        <option value="Sunday">Sunday</option>
                      </select>
                    </div>
                  </>
                )}

                {(employeeForm.pay_schedule === 'semimonthly' || employeeForm.pay_schedule === 'monthly') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pay Period Start Date *
                      </label>
                      <select
                        value={employeeForm.pay_schedule_start_day}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, pay_schedule_start_day: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                        required
                      >
                        <option value="">Select Start Date</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <option key={day} value={day}>
                            {day === 1 ? '1st' : day === 2 ? '2nd' : day === 3 ? '3rd' : `${day}th`}
                          </option>
                        ))}
                      </select>
                    </div>
                    {employeeForm.pay_schedule === 'semimonthly' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Pay Period End Date *
                        </label>
                        <select
                          value={employeeForm.pay_schedule_end_day}
                          onChange={(e) => setEmployeeForm({ ...employeeForm, pay_schedule_end_day: e.target.value })}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                          required
                        >
                          <option value="">Select End Date</option>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                            <option key={day} value={day}>
                              {day === 1 ? '1st' : day === 2 ? '2nd' : day === 3 ? '3rd' : `${day}th`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pay Day *
                      </label>
                      <select
                        value={employeeForm.pay_day}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, pay_day: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                        required
                      >
                        <option value="">Select Pay Day</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <option key={day} value={day}>
                            {day === 1 ? '1st' : day === 2 ? '2nd' : day === 3 ? '3rd' : `${day}th`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {employeeForm.pay_type === 'hourly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Hours per Week
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="168"
                      value={employeeForm.default_hours_per_week}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, default_hours_per_week: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                      placeholder="40"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddEmployeeModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2d8659] text-white rounded hover:bg-[#256b49]"
                >
                  Add Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Salary Modal */}
      {showPaySalaryModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Pay Salary - {selectedEmployee.first_name} {selectedEmployee.last_name}</h2>
            
            {customPayrollWarning && (
              <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 font-semibold">{customPayrollWarning}</p>
              </div>
            )}
            
            <form onSubmit={handleCalculateAndRunPayroll}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Date *
                  </label>
                  <input
                    type="date"
                    value={payrollForm.from_date}
                    onChange={(e) => setPayrollForm({ ...payrollForm, from_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    To Date *
                  </label>
                  <input
                    type="date"
                    value={payrollForm.to_date}
                    onChange={(e) => setPayrollForm({ ...payrollForm, to_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payroll Date *
                  </label>
                  <input
                    type="date"
                    value={payrollForm.payroll_date}
                    onChange={(e) => setPayrollForm({ ...payrollForm, payroll_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Check Number
                  </label>
                  <input
                    type="text"
                    value={payrollForm.check_number}
                    onChange={(e) => setPayrollForm({ ...payrollForm, check_number: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bank
                  </label>
                  <input
                    type="text"
                    value={payrollForm.bank}
                    onChange={(e) => setPayrollForm({ ...payrollForm, bank: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={payrollForm.notes}
                    onChange={(e) => setPayrollForm({ ...payrollForm, notes: e.target.value })}
                    rows="3"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowPaySalaryModal(false);
                    setSelectedEmployee(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2d8659] text-white rounded hover:bg-[#256b49]"
                >
                  Calculate & Run Payroll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Employee Modal */}
      {showManageEmployeeModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Manage Employee</h2>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{selectedEmployee.first_name} {selectedEmployee.last_name}</strong><br />
              Current Status: <span className="capitalize">{selectedEmployee.employment_status || 'active'}</span><br />
              Current Pay Rate: <strong>${parseFloat(selectedEmployee.pay_rate).toFixed(2)}/{selectedEmployee.pay_type === 'hourly' ? 'hr' : selectedEmployee.pay_schedule}</strong>
            </p>
            
            <div className="space-y-3">
              {selectedEmployee.employment_status !== 'fired' && (
                <button
                  onClick={() => {
                    setFireForm({ fire_date: new Date().toISOString().split('T')[0] });
                    setShowFireModal(true);
                  }}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Fire Employee
                </button>
              )}
              
              {selectedEmployee.employment_status === 'fired' && (
                <button
                  onClick={() => {
                    setRehireForm({ rehire_date: new Date().toISOString().split('T')[0] });
                    setShowRehireModal(true);
                  }}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Rehire Employee
                </button>
              )}

              <button
                onClick={() => {
                  setShowDeleteModal(true);
                }}
                className="w-full px-4 py-2 bg-red-800 text-white rounded hover:bg-red-900"
              >
                Delete Employee
              </button>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setShowManageEmployeeModal(false);
                  setSelectedEmployee(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fire Employee Modal */}
      {showFireModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Fire Employee</h2>
            <p className="text-sm text-gray-600 mb-4">
              Employee: <strong>{selectedEmployee.first_name} {selectedEmployee.last_name}</strong>
            </p>
            <form onSubmit={handleFireEmployee}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fire Date *
                </label>
                <input
                  type="date"
                  value={fireForm.fire_date}
                  onChange={(e) => setFireForm({ fire_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFireModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Fire Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rehire Employee Modal */}
      {showRehireModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Rehire Employee</h2>
            <p className="text-sm text-gray-600 mb-4">
              Employee: <strong>{selectedEmployee.first_name} {selectedEmployee.last_name}</strong>
            </p>
            <form onSubmit={handleRehireEmployee}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rehire Date *
                </label>
                <input
                  type="date"
                  value={rehireForm.rehire_date}
                  onChange={(e) => setRehireForm({ rehire_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRehireModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Rehire Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Employee Modal */}
      {showDeleteModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4 text-red-600">Delete Employee</h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete <strong>{selectedEmployee.first_name} {selectedEmployee.last_name}</strong> from payroll?
            </p>
            {user?.role === 'super_admin' ? (
              <p className="text-sm text-orange-600 mb-6 font-semibold">
                This employee will be deleted and can be restored by Super Admin within 14 days. After 14 days, the deletion becomes permanent.
              </p>
            ) : (
              <p className="text-sm text-orange-600 mb-6 font-semibold">
                This employee will be deleted. Super Admin can restore them within 14 days if needed.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEmployee}
                className="px-4 py-2 bg-red-800 text-white rounded hover:bg-red-900"
              >
                Delete Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Pay Rate Modal */}
      {showChangePayRateModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Change Pay Rate</h2>
            <p className="text-sm text-gray-600 mb-4">
              Employee: <strong>{selectedEmployee.first_name} {selectedEmployee.last_name}</strong><br />
              Current Rate: <strong>${parseFloat(selectedEmployee.pay_rate).toFixed(2)}/{selectedEmployee.pay_type === 'hourly' ? 'hr' : selectedEmployee.pay_schedule}</strong>
            </p>
            <form onSubmit={handleChangePayRate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Pay Rate ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={changePayRateForm.new_pay_rate}
                    onChange={(e) => setChangePayRateForm({ ...changePayRateForm, new_pay_rate: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Effective Date *
                  </label>
                  <input
                    type="date"
                    value={changePayRateForm.effective_date}
                    onChange={(e) => setChangePayRateForm({ ...changePayRateForm, effective_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Change
                  </label>
                  <textarea
                    value={changePayRateForm.reason}
                    onChange={(e) => setChangePayRateForm({ ...changePayRateForm, reason: e.target.value })}
                    rows="3"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    placeholder="Optional: Reason for pay rate change"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePayRateModal(false);
                    setChangePayRateForm({
                      new_pay_rate: '',
                      effective_date: new Date().toISOString().split('T')[0],
                      reason: ''
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2d8659] text-white rounded hover:bg-[#256b49]"
                >
                  Update Pay Rate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Pay Rate Modal */}
      {showEditPayRateModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Change Pay Rate</h2>
            <p className="text-sm text-gray-600 mb-4">
              Employee: <strong>{selectedEmployee.first_name} {selectedEmployee.last_name}</strong><br />
              Current Rate: <strong>${parseFloat(selectedEmployee.pay_rate).toFixed(2)}/{selectedEmployee.pay_type === 'hourly' ? 'hr' : selectedEmployee.pay_schedule}</strong>
            </p>
            <form onSubmit={handleUpdatePayRate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Pay Rate ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={payRateForm.new_pay_rate}
                    onChange={(e) => setPayRateForm({ ...payRateForm, new_pay_rate: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Change
                  </label>
                  <textarea
                    value={payRateForm.reason}
                    onChange={(e) => setPayRateForm({ ...payRateForm, reason: e.target.value })}
                    rows="3"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    placeholder="Optional: Reason for pay rate change"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditPayRateModal(false);
                    setSelectedEmployee(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2d8659] text-white rounded hover:bg-[#256b49]"
                >
                  Update Pay Rate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Time Off Modal */}
      {showTimeOffModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Add Time Off</h2>
            <p className="text-sm text-gray-600 mb-4">
              Employee: <strong>{selectedEmployee.first_name} {selectedEmployee.last_name}</strong>
            </p>
            <form onSubmit={handleAddTimeOff}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={timeOffForm.date}
                    onChange={(e) => setTimeOffForm({ ...timeOffForm, date: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time Off Type *
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="time_off_type"
                        value="full_day"
                        checked={timeOffForm.time_off_type === 'full_day'}
                        onChange={(e) => setTimeOffForm({ ...timeOffForm, time_off_type: e.target.value, hours_off: '' })}
                        className="mr-2"
                        required
                      />
                      <span className="text-sm text-gray-700">Full Day</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="time_off_type"
                        value="hours"
                        checked={timeOffForm.time_off_type === 'hours'}
                        onChange={(e) => setTimeOffForm({ ...timeOffForm, time_off_type: e.target.value })}
                        className="mr-2"
                        required
                      />
                      <span className="text-sm text-gray-700">Hours</span>
                    </label>
                  </div>
                </div>

                {timeOffForm.time_off_type === 'hours' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hours Off *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={timeOffForm.hours_off}
                      onChange={(e) => setTimeOffForm({ ...timeOffForm, hours_off: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                      required={timeOffForm.time_off_type === 'hours'}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason
                  </label>
                  <textarea
                    value={timeOffForm.reason}
                    onChange={(e) => setTimeOffForm({ ...timeOffForm, reason: e.target.value })}
                    rows="3"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
                    placeholder="Optional: Reason for time off"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowTimeOffModal(false);
                    setSelectedEmployee(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2d8659] text-white rounded hover:bg-[#256b49]"
                >
                  Add Time Off
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payroll;

