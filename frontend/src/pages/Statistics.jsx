import { useState, useEffect } from 'react';
import { statisticsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { UsersIcon, StoreIcon, CurrencyDollarIcon, CheckCircleIcon, ChartIcon } from '../components/Icons';

const Statistics = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('all'); // all, 30d, 90d, 1y
  const [activeTab, setActiveTab] = useState('overview'); // overview, revenue, growth, subscriptions

  useEffect(() => {
    if (user?.role === 'super_admin') {
      loadStatistics();
    }
  }, [user]);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const response = await statisticsAPI.getAll();
      console.log('Statistics API response:', response);
      console.log('Response data:', response.data);
      
      // Handle different response structures
      if (response.data?.statistics) {
        setStats(response.data.statistics);
      } else if (response.data?.data?.statistics) {
        setStats(response.data.data.statistics);
      } else if (response.statistics) {
        setStats(response.statistics);
      } else {
        console.error('Unexpected response structure:', response);
        setStats(null);
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
      console.error('Error response:', error.response?.data);
      alert('Failed to load statistics: ' + (error.response?.data?.error || error.message));
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const getMaxValue = (data, key) => {
    return Math.max(...data.map(item => parseFloat(item[key] || 0)), 1);
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

  if (loading) {
    return <div className="text-center py-8">Loading advanced statistics...</div>;
  }

  if (!stats) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
          <p className="font-semibold">No statistics available</p>
          <p className="text-sm mt-1">Please check the browser console for error details.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Advanced Statistics & Analytics</h1>
          <p className="text-gray-600">Comprehensive insights into your retail management system</p>
        </div>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Time</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
          <option value="1y">Last Year</option>
        </select>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'overview', name: 'Overview', icon: ChartIcon },
              { id: 'revenue', name: 'Revenue Analytics', icon: CurrencyDollarIcon },
              { id: 'growth', name: 'Growth Trends', icon: UsersIcon },
              { id: 'subscriptions', name: 'Subscriptions', icon: CheckCircleIcon }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-[#2d8659] text-[#2d8659]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon && <tab.icon className="w-4 h-4" />}
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Active Admin Users</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.users?.total_users || 0}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {stats.users?.new_users_last_30_days || 0} new admin in last 30 days
                  </p>
                </div>
                <UsersIcon className="w-12 h-12 text-blue-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-indigo-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Stores</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.stores?.total_stores || 0}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {stats.stores?.active_stores || 0} active
                  </p>
                </div>
                <StoreIcon className="w-12 h-12 text-indigo-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                  <p className="text-3xl font-bold text-green-600">
                    {formatCurrency(stats.billing?.total_revenue || 0)}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {formatCurrency(stats.billing?.pending_revenue || 0)} pending
                  </p>
                </div>
                <CurrencyDollarIcon className="w-12 h-12 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Monthly Recurring Revenue</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {formatCurrency(stats.subscriptions?.monthly_recurring_revenue || 0)}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {stats.subscriptions?.active_subscriptions || 0} active subscriptions
                  </p>
                </div>
                <CurrencyDollarIcon className="w-12 h-12 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Top Admins */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Top Performing Admins</h2>
              </div>
              <div className="p-6">
                {stats.top_admins?.length === 0 ? (
                  <p className="text-gray-500">No admins found</p>
                ) : (
                  <div className="space-y-3">
                    {stats.top_admins?.map((admin) => (
                      <div key={admin.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{admin.first_name} {admin.last_name}</p>
                          <p className="text-sm text-gray-600">{admin.email}</p>
                          <div className="flex gap-4 mt-1 text-xs text-gray-500">
                            <span>{admin.active_store_count || 0} active</span>
                            <span>{admin.store_count || 0} total</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">{admin.store_count || 0}</div>
                          <div className="text-xs text-gray-500">stores</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Subscription Plan Distribution */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Subscription Plans Distribution</h2>
              </div>
              <div className="p-6">
                {stats.plan_distribution?.length === 0 ? (
                  <p className="text-gray-500">No active subscriptions</p>
                ) : (
                  <div className="space-y-4">
                    {stats.plan_distribution?.map((plan, index) => (
                      <div key={index}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            {plan.plan_name || 'Unknown Plan'}
                          </span>
                          <span className="text-sm text-gray-600">
                            {plan.subscription_count} subscriptions
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${(plan.subscription_count / Math.max(...stats.plan_distribution.map(p => p.subscription_count))) * 100}%`
                            }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          MRR: {formatCurrency(plan.total_mrr || 0)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* System Activity */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">System Activity (Last 30 Days)</h2>
            </div>
            <div className="p-6">
              {stats.recent_activity?.length === 0 ? (
                <p className="text-gray-500">No activity data available</p>
              ) : (
                <div className="space-y-2">
                  {stats.recent_activity?.map((day, index) => {
                    const maxActivity = getMaxValue(stats.recent_activity || [], 'activity_count');
                    return (
                      <div key={index} className="flex items-center">
                        <div className="w-32 text-sm text-gray-600">
                          {new Date(day.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <div
                                className="bg-green-600 h-6 rounded"
                                style={{ width: `${(day.activity_count / maxActivity) * 100}%` }}
                              ></div>
                              <span className="ml-2 text-sm font-medium">{day.activity_count} actions</span>
                            </div>
                          </div>
                          <div className="text-sm text-gray-500 w-24 text-right">
                            {day.unique_users} users
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Revenue Analytics Tab */}
      {activeTab === 'revenue' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(stats.billing?.total_revenue || 0)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
              <p className="text-sm text-gray-600 mb-1">Pending Revenue</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(stats.billing?.pending_revenue || 0)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
              <p className="text-sm text-gray-600 mb-1">Overdue Revenue</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(stats.billing?.overdue_revenue || 0)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Revenue Trends (Last 12 Months)</h2>
            </div>
            <div className="p-6">
              {stats.revenue_trends?.length === 0 ? (
                <p className="text-gray-500">No revenue data available</p>
              ) : (
                <div className="space-y-3">
                  {stats.revenue_trends?.map((month, index) => {
                    const maxRevenue = getMaxValue(stats.revenue_trends || [], 'revenue');
                    return (
                      <div key={index} className="flex items-center">
                        <div className="w-32 text-sm text-gray-600">
                          {formatDate(month.month)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{formatCurrency(month.revenue || 0)}</span>
                            <span className="text-xs text-gray-500">{month.paid_count || 0} invoices</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="bg-green-600 h-3 rounded-full"
                              style={{ width: `${(month.revenue / maxRevenue) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Growth Trends Tab */}
      {activeTab === 'growth' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Users by Store</h2>
              </div>
              <div className="p-6">
                {stats.store_user_breakdown?.length === 0 ? (
                  <p className="text-gray-500">No store user data</p>
                ) : (
                  <div className="space-y-4">
                    {stats.store_user_breakdown?.map((store, index) => (
                      <div key={store.store_id || index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">{store.store_name}</h3>
                            {store.store_is_active === false && (
                              <span className="text-xs text-gray-500">(Inactive)</span>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{store.admin_users || 0}</div>
                            <div className="text-xs text-gray-500 mt-1">Admin Users</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{store.managers || 0}</div>
                            <div className="text-xs text-gray-500 mt-1">Managers</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">{store.payroll_employees || 0}</div>
                            <div className="text-xs text-gray-500 mt-1">Payroll Employees</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Store Growth (Last 12 Months)</h2>
              </div>
              <div className="p-6">
                {stats.store_growth?.length === 0 ? (
                  <p className="text-gray-500">No store growth data</p>
                ) : (
                  <div className="space-y-2">
                    {stats.store_growth?.map((month, index) => {
                      const maxStores = getMaxValue(stats.store_growth || [], 'store_count');
                      return (
                        <div key={index} className="flex items-center">
                          <div className="w-32 text-sm text-gray-600">
                            {formatDate(month.month)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center">
                              <div
                                className="bg-indigo-600 h-6 rounded"
                                style={{ width: `${(month.store_count / maxStores) * 100}%` }}
                              ></div>
                              <span className="ml-2 text-sm font-medium">{month.store_count} stores</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stores per Admin */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Stores per Admin</h2>
            </div>
            <div className="p-6">
              {stats.stores_per_admin?.length === 0 ? (
                <p className="text-gray-500">No admins found</p>
              ) : (
                <div className="space-y-3">
                  {stats.stores_per_admin?.map((admin) => (
                    <div key={admin.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div>
                        <p className="font-medium">{admin.first_name} {admin.last_name}</p>
                        <p className="text-sm text-gray-600">{admin.email}</p>
                      </div>
                      <div className="text-2xl font-bold text-blue-600">{admin.store_count || 0}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
              <p className="text-sm text-gray-600 mb-1">Total Subscriptions</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.subscriptions?.total_subscriptions || 0}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
              <p className="text-sm text-gray-600 mb-1">Active Subscriptions</p>
              <p className="text-3xl font-bold text-green-600">
                {stats.subscriptions?.active_subscriptions || 0}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
              <p className="text-sm text-gray-600 mb-1">Monthly Recurring Revenue</p>
              <p className="text-3xl font-bold text-purple-600">
                {formatCurrency(stats.subscriptions?.monthly_recurring_revenue || 0)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
              <p className="text-sm text-gray-600 mb-1">Due for Billing</p>
              <p className="text-3xl font-bold text-yellow-600">
                {stats.subscriptions?.due_for_billing || 0}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Plan Distribution</h2>
            </div>
            <div className="p-6">
              {stats.plan_distribution?.length === 0 ? (
                <p className="text-gray-500">No subscription plans in use</p>
              ) : (
                <div className="space-y-4">
                  {stats.plan_distribution?.map((plan, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-lg">{plan.plan_name || 'Unknown Plan'}</h3>
                        <span className="text-sm text-gray-600">
                          {plan.subscription_count} active subscriptions
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                        <div
                          className="bg-purple-600 h-3 rounded-full"
                          style={{
                            width: `${(plan.subscription_count / Math.max(...stats.plan_distribution.map(p => p.subscription_count))) * 100}%`
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>MRR: {formatCurrency(plan.total_mrr || 0)}</span>
                        <span>
                          Avg: {formatCurrency((plan.total_mrr || 0) / Math.max(plan.subscription_count, 1))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Statistics;
