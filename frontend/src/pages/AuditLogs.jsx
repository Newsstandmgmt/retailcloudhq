import { useState, useEffect } from 'react';
import { auditLogsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const AuditLogs = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 100, offset: 0, has_more: false });
  const [viewMode, setViewMode] = useState('all'); // 'all', 'login', 'critical'
  
  // Filters
  const [filters, setFilters] = useState({
    user_email: '',
    action_type: '',
    entity_type: '',
    status: '',
    start_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 90 days
    end_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Include today and tomorrow to catch all of today
    search: '',
  });

  // Statistics
  const [statistics, setStatistics] = useState(null);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      loadLogs();
      loadStatistics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, filters.start_date, filters.end_date, filters.user_email, filters.action_type, filters.entity_type, filters.status, filters.search, user]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      let response;
      
      const params = {
        ...filters,
        limit: pagination.limit,
        offset: pagination.offset,
      };

      if (viewMode === 'login') {
        response = await auditLogsAPI.getLoginHistory(params);
      } else if (viewMode === 'critical') {
        response = await auditLogsAPI.getCriticalActions(params);
      } else {
        response = await auditLogsAPI.getAll(params);
      }

      // Handle different response structures
      // Response structure from backend: { success: true, data: { logs: [], pagination: {} } }
      // After axios: response.data = { success: true, data: { logs: [], pagination: {} } }
      let logsData = [];
      let paginationData = pagination;
      
      if (response.data?.data?.logs) {
        // Standard response structure: { success: true, data: { logs: [], pagination: {} } }
        logsData = response.data.data.logs || [];
        paginationData = response.data.data.pagination || pagination;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        // Alternative: { data: [...] }
        logsData = response.data.data;
      } else if (response.data?.logs) {
        // Direct logs: { logs: [], pagination: {} }
        logsData = response.data.logs || [];
        paginationData = response.data.pagination || pagination;
      } else if (Array.isArray(response.data)) {
        // Direct array
        logsData = response.data;
      }
      
      setLogs(logsData);
      setPagination(paginationData);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      alert('Failed to load audit logs: ' + (error.response?.data?.error || error.message));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const params = {
        start_date: filters.start_date,
        end_date: filters.end_date,
      };
      const response = await auditLogsAPI.getStatistics(params);
      // Handle different response structures
      setStatistics(response.data?.data || response.data || null);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPagination({ ...pagination, offset: 0 });
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams(filters);
      const response = await auditLogsAPI.export(params);
      
      // Create blob and download
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      alert('Failed to export audit logs');
    }
  };

  const handlePageChange = (newOffset) => {
    setPagination({ ...pagination, offset: newOffset });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'error': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionTypeColor = (actionType) => {
    if (['create', 'login'].includes(actionType)) return 'bg-blue-100 text-blue-800';
    if (['update'].includes(actionType)) return 'bg-yellow-100 text-yellow-800';
    if (['delete', 'failed_login'].includes(actionType)) return 'bg-red-100 text-red-800';
    if (['logout', 'view'].includes(actionType)) return 'bg-gray-100 text-gray-800';
    return 'bg-purple-100 text-purple-800';
  };

  if (user?.role !== 'super_admin') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Access denied. Only Super Admin can access this page.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs & Activity Monitoring</h1>
        <p className="text-gray-600 mt-1">Track all user activities and system changes for compliance</p>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600 mb-1">Total Actions</p>
            <p className="text-2xl font-bold text-gray-900">{statistics.summary?.total_actions || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-600 mb-1">Unique Users</p>
            <p className="text-2xl font-bold text-gray-900">{statistics.summary?.unique_users || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <p className="text-sm text-gray-600 mb-1">Logins</p>
            <p className="text-2xl font-bold text-gray-900">{statistics.summary?.login_count || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <p className="text-sm text-gray-600 mb-1">Failed Logins</p>
            <p className="text-2xl font-bold text-gray-900">{statistics.summary?.failed_login_count || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <p className="text-sm text-gray-600 mb-1">Data Changes</p>
            <p className="text-2xl font-bold text-gray-900">{statistics.summary?.data_changes || 0}</p>
          </div>
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => { setViewMode('all'); setPagination({ ...pagination, offset: 0 }); }}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                viewMode === 'all'
                  ? 'border-[#2d8659] text-[#2d8659]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All Activities
            </button>
            <button
              onClick={() => { setViewMode('login'); setPagination({ ...pagination, offset: 0 }); }}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                viewMode === 'login'
                  ? 'border-[#2d8659] text-[#2d8659]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Login History
            </button>
            <button
              onClick={() => { setViewMode('critical'); setPagination({ ...pagination, offset: 0 }); }}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                viewMode === 'critical'
                  ? 'border-[#2d8659] text-[#2d8659]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Critical Actions
            </button>
          </nav>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search by user, description..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Action Type</label>
              <select
                value={filters.action_type}
                onChange={(e) => handleFilterChange('action_type', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">All Types</option>
                <option value="login">Login</option>
                <option value="logout">Logout</option>
                <option value="failed_login">Failed Login</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="view">View</option>
                <option value="export">Export</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Entity Type</label>
              <select
                value={filters.entity_type}
                onChange={(e) => handleFilterChange('entity_type', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">All Entities</option>
                <option value="user">User</option>
                <option value="store">Store</option>
                <option value="admin_config">Admin Config</option>
                <option value="subscription">Subscription</option>
                <option value="billing">Billing</option>
                <option value="revenue">Revenue</option>
                <option value="invoice">Invoice</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">All Status</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">User Email</label>
              <input
                type="text"
                value={filters.user_email}
                onChange={(e) => handleFilterChange('user_email', e.target.value)}
                placeholder="Filter by user email..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-between items-center mt-4">
            <button
              onClick={() => {
                setFilters({
                  user_email: '',
                  action_type: '',
                  entity_type: '',
                  status: '',
                  start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  end_date: new Date().toISOString().split('T')[0],
                  search: '',
                });
                setPagination({ ...pagination, offset: 0 });
              }}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Clear Filters
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export to CSV
            </button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No audit logs found</div>
          ) : (
            <>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    {viewMode === 'critical' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Old Values</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Values</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div>
                          <div className="font-medium text-gray-900">{log.user_name || log.user_full_name || log.user_email || 'N/A'}</div>
                          <div className="text-gray-500 text-xs">{log.user_email || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getActionTypeColor(log.action_type)}`}>
                          {log.action_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.entity_type ? `${log.entity_type}${log.entity_id ? ` (${log.entity_id.substring(0, 8)}...)` : ''}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">
                        {log.action_description || log.resource_path || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.ip_address || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(log.status)}`}>
                          {log.status}
                        </span>
                      </td>
                      {viewMode === 'critical' && (
                        <>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                            {log.old_values ? (
                              <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32">
                                {JSON.stringify(log.old_values, null, 2)}
                              </pre>
                            ) : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                            {log.new_values ? (
                              <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32">
                                {JSON.stringify(log.new_values, null, 2)}
                              </pre>
                            ) : '-'}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total} results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))}
                    disabled={pagination.offset === 0}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.offset + pagination.limit)}
                    disabled={!pagination.has_more}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;

