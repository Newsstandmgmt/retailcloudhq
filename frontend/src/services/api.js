import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://retailcloudhq-production.up.railway.app';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    // Don't require token for login/register endpoints
    const publicEndpoints = ['/api/auth/login', '/api/auth/register'];
    const isPublicEndpoint = publicEndpoints.some(endpoint => config.url.includes(endpoint));
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (!isPublicEndpoint) {
      // Only warn for non-public endpoints
      console.warn('API Request made without token:', config.url);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  register: (userData) => api.post('/api/auth/register', userData),
  getProfile: () => api.get('/api/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    api.post('/api/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
};

// Stores API
export const storesAPI = {
  getAll: () => api.get('/api/stores'),
  getById: (id) => api.get(`/api/stores/${id}`),
  create: (data) => api.post('/api/stores', data),
  update: (id, data) => api.put(`/api/stores/${id}`, data),
  delete: (id) => api.delete(`/api/stores/${id}`),
  restore: (id) => api.post(`/api/stores/${id}/restore`),
  toggleActive: (id) => api.patch(`/api/stores/${id}/toggle-active`),
  assignEmployee: (storeId, userId) => api.post(`/api/stores/${storeId}/employees`, { userId }),
  removeEmployee: (storeId, userId) => api.delete(`/api/stores/${storeId}/employees/${userId}`),
  getEmployees: (storeId) => api.get(`/api/stores/${storeId}/employees`),
  assignManager: (storeId, managerId, permissions) => api.post(`/api/stores/${storeId}/managers`, { manager_id: managerId, ...permissions }),
  removeManager: (storeId, managerId) => api.delete(`/api/stores/${storeId}/managers/${managerId}`),
  getManagers: (storeId) => api.get(`/api/stores/${storeId}/managers`),
};

// Users API
export const usersAPI = {
  getAll: () => api.get('/api/users'),
  getById: (id) => api.get(`/api/users/${id}`),
  create: (userData) => api.post('/api/users', userData),
  update: (id, userData) => api.put(`/api/users/${id}`, userData),
  delete: (id) => api.delete(`/api/users/${id}`),
  resetPassword: (id) => api.post(`/api/users/${id}/reset-password`),
  changePassword: (id, newPassword) => api.post(`/api/users/${id}/change-password`, { new_password: newPassword }),
};

// Revenue API
export const revenueAPI = {
  getDailyRevenue: (storeId, date) => api.get(`/api/revenue/${storeId}/daily/${date}`),
  saveDailyRevenue: (storeId, data) => api.post(`/api/revenue/${storeId}/daily`, data),
  getDailyRevenueRange: (storeId, startDate, endDate) => {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    return api.get(`/api/revenue/${storeId}/range?${params.toString()}`);
  },
  getRevenueRange: (storeId, startDate, endDate) => {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    return api.get(`/api/revenue/${storeId}/range?${params.toString()}`);
  },
  getTotals: (storeId, startDate, endDate) => {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    return api.get(`/api/revenue/${storeId}/totals?${params.toString()}`);
  },
};

// Expenses API
export const expensesAPI = {
  getByStore: (storeId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.expense_type_id) params.append('expense_type_id', filters.expense_type_id);
    if (filters.payment_method) params.append('payment_method', filters.payment_method);
    if (filters.reimbursement_status) params.append('reimbursement_status', filters.reimbursement_status);
    if (filters.is_recurring !== undefined) params.append('is_recurring', filters.is_recurring);
    if (filters.search) params.append('search', filters.search);
    return api.get(`/api/expenses/${storeId}?${params.toString()}`);
  },
  getAll: (storeId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.expense_type_id) params.append('expense_type_id', filters.expense_type_id);
    if (filters.payment_method) params.append('payment_method', filters.payment_method);
    if (filters.reimbursement_status) params.append('reimbursement_status', filters.reimbursement_status);
    if (filters.is_recurring !== undefined) params.append('is_recurring', filters.is_recurring);
    if (filters.search) params.append('search', filters.search);
    return api.get(`/api/expenses/${storeId}?${params.toString()}`);
  },
  getPendingReimbursements: (storeId) => api.get(`/api/expenses/${storeId}/reimbursements/pending`),
  create: (storeId, data) => api.post(`/api/expenses/${storeId}`, data),
  update: (storeId, expenseId, data) => api.put(`/api/expenses/${storeId}/${expenseId}`, data),
  delete: (storeId, expenseId) => api.delete(`/api/expenses/${storeId}/${expenseId}`),
  getById: (storeId, expenseId) => api.get(`/api/expenses/${storeId}/${expenseId}`),
};

// Banks API
export const banksAPI = {
  getByStore: (storeId) => api.get(`/api/banks/store/${storeId}`),
  getAll: (storeId) => api.get(`/api/banks/store/${storeId}`), // Alias for getByStore
  create: (storeId, data) => api.post(`/api/banks/store/${storeId}`, data),
  update: (id, data) => api.put(`/api/banks/${id}`, data),
  delete: (id) => api.delete(`/api/banks/${id}`),
  setDefault: (storeId, bankId, type) => api.post(`/api/banks/store/${storeId}/default/${bankId}`, { type }),
};

// Credit Cards API
export const creditCardsAPI = {
  getByStore: (storeId) => api.get(`/api/credit-cards/store/${storeId}`),
  getAll: (storeId) => api.get(`/api/credit-cards/store/${storeId}`), // Alias for getByStore
  create: (storeId, data) => api.post(`/api/credit-cards/store/${storeId}`, data),
  update: (id, data) => api.put(`/api/credit-cards/${id}`, data),
  delete: (id) => api.delete(`/api/credit-cards/${id}`),
};

// Customer Tabs API
export const customerTabsAPI = {
  getByStore: (storeId) => api.get(`/api/customer-tabs/store/${storeId}`),
  create: (storeId, data) => api.post(`/api/customer-tabs/store/${storeId}`, data),
  update: (tabId, data) => api.put(`/api/customer-tabs/${tabId}`, data),
  delete: (tabId) => api.delete(`/api/customer-tabs/${tabId}`),
  getTransactions: (tabId, params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    return api.get(`/api/customer-tabs/${tabId}/transactions?${queryParams.toString()}`);
  },
  addTransaction: (tabId, data) => api.post(`/api/customer-tabs/${tabId}/transactions`, data),
  addCharge: (tabId, data) => api.post(`/api/customer-tabs/${tabId}/charge`, data),
  getDailyTotals: (storeId, date) => api.get(`/api/customer-tabs/store/${storeId}/daily/${date}`),
  voidCharge: (transactionId) => api.post(`/api/customer-tabs/transaction/${transactionId}/void`),
  recalculateBalance: (tabId) => api.post(`/api/customer-tabs/${tabId}/recalculate-balance`),
};

// Settings API
export const settingsAPI = {
  getExpenseTypes: (storeId) => api.get(`/api/settings/expense-types/store/${storeId}`),
  createExpenseType: (storeId, data) => api.post(`/api/settings/expense-types/store/${storeId}`, data),
  updateExpenseType: (id, data) => api.put(`/api/settings/expense-types/${id}`, data),
  deleteExpenseType: (id) => api.delete(`/api/settings/expense-types/${id}`),
  getChartOfAccounts: (storeId) => api.get(`/api/settings/chart-of-accounts/store/${storeId}`),
};

// Store Licenses API
export const storeLicensesAPI = {
  getByStore: (storeId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.active_only) params.append('active_only', 'true');
    if (filters.expired_only) params.append('expired_only', 'true');
    if (filters.expiring_soon) params.append('expiring_soon', filters.expiring_soon);
    return api.get(`/api/store-licenses/store/${storeId}?${params.toString()}`);
  },
  getById: (licenseId) => api.get(`/api/store-licenses/${licenseId}`),
  create: (storeId, formData) => {
    return api.post(`/api/store-licenses/store/${storeId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  update: (licenseId, formData) => {
    return api.put(`/api/store-licenses/${licenseId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  delete: (licenseId) => api.delete(`/api/store-licenses/${licenseId}`),
  downloadFile: (licenseId) => api.get(`/api/store-licenses/${licenseId}/file`, {
    responseType: 'blob'
  }),
  getExpiringSoon: (days = 30) => api.get(`/api/store-licenses/expiring-soon/${days}`)
};

// Store Templates API
export const storeTemplatesAPI = {
  getAll: () => api.get('/api/store-templates'),
  getById: (id) => api.get(`/api/store-templates/${id}`),
  create: (data) => api.post('/api/store-templates', data),
  update: (id, data) => api.put(`/api/store-templates/${id}`, data),
  delete: (id) => api.delete(`/api/store-templates/${id}`),
  getStoreFeatures: (storeId) => api.get(`/api/store-templates/store/${storeId}/features`),
  getFeatures: () => api.get('/api/store-templates/features'),
  createFeature: (data) => api.post('/api/store-templates/features', data),
};

// Store Subscriptions API
export const storeSubscriptionsAPI = {
  getByStore: (storeId) => api.get(`/api/store-subscriptions/store/${storeId}`),
  create: (storeId, data) => api.post(`/api/store-subscriptions/store/${storeId}`, data),
  update: (id, data) => api.put(`/api/store-subscriptions/${id}`, data),
  cancel: (id) => api.post(`/api/store-subscriptions/${id}/cancel`),
  getAvailableAddons: (storeId) => api.get(`/api/store-subscriptions/store/${storeId}/available-addons`),
  addAddon: (storeId, featureKey) => api.post(`/api/store-subscriptions/store/${storeId}/addons/${featureKey}`),
  removeAddon: (storeId, featureKey) => api.delete(`/api/store-subscriptions/store/${storeId}/addons/${featureKey}`),
};

// Subscription Payments API
export const subscriptionPaymentsAPI = {
  getByStore: (storeId) => api.get(`/api/subscription-payments/store/${storeId}`),
  create: (data) => api.post('/api/subscription-payments', data),
};

// Products API
export const productsAPI = {
  getAll: (storeId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.brand) params.append('brand', filters.brand);
    if (filters.supplier) params.append('supplier', filters.supplier);
    if (filters.search) params.append('search', filters.search);
    if (filters.is_active !== undefined) params.append('is_active', filters.is_active);
    return api.get(`/api/products/store/${storeId}?${params.toString()}`);
  },
  getById: (productId) => api.get(`/api/products/${productId}`),
  create: (storeId, data) => api.post(`/api/products/store/${storeId}`, data),
  update: (productId, data) => api.put(`/api/products/${productId}`, data),
  delete: (productId) => api.delete(`/api/products/${productId}`),
  getCategories: (storeId) => api.get(`/api/products/store/${storeId}/categories`),
  getBrands: (storeId) => api.get(`/api/products/store/${storeId}/brands`),
  getSuppliers: (storeId) => api.get(`/api/products/store/${storeId}/suppliers`),
  generateProductId: (storeId, category) => api.get(`/api/products/store/${storeId}/generate-id?category=${encodeURIComponent(category)}`),
  calculateRevenue: (storeId, items) => api.post(`/api/products/store/${storeId}/calculate-revenue`, { items }),
  downloadTemplate: async (storeId) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/products/store/${storeId}/template`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) {
      throw new Error('Failed to download template');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product-upload-template.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  bulkUpload: (storeId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/api/products/store/${storeId}/bulk-upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
};

// Feature Pricing API
export const featurePricingAPI = {
  getAll: () => api.get('/api/feature-pricing'),
  getById: (id) => api.get(`/api/feature-pricing/${id}`),
  getByFeatureKey: (featureKey) => api.get(`/api/feature-pricing/${featureKey}`),
  create: (data) => api.post('/api/feature-pricing', data),
  update: (id, data) => api.put(`/api/feature-pricing/${id}`, data),
  upsert: (featureKey, data) => api.post(`/api/feature-pricing/${featureKey}`, data),
  delete: (id) => api.delete(`/api/feature-pricing/${id}`),
};

// Admin Management API
export const adminManagementAPI = {
  getAll: () => api.get('/api/admin-management'),
  getById: (userId) => api.get(`/api/admin-management/${userId}`),
  create: (data) => api.post('/api/admin-management', data),
  update: (userId, data) => api.put(`/api/admin-management/${userId}`, data),
  delete: (userId) => api.delete(`/api/admin-management/${userId}`),
  getAdmins: (includeInactive = false) => api.get('/api/admin-management/admins', { params: { includeInactive } }),
  getUsersByRole: (role, includeInactive = false) => api.get(`/api/admin-management/users/${role}`, { params: includeInactive ? { includeInactive: true } : {} }),
  getAdminConfig: (userId) => api.get(`/api/admin-management/admin/${userId}`),
  updateAdminConfig: (userId, data) => api.post(`/api/admin-management/admin/${userId}/config`, data),
  getAdminStores: (userId, includeInactive = false) => api.get(`/api/admin-management/admin/${userId}/stores`, { params: { includeInactive } }),
};

// Store Managers API
export const storeManagersAPI = {
  getByStore: (storeId) => api.get(`/api/stores/${storeId}/managers`),
  assign: (storeId, managerId, permissions) => api.post(`/api/stores/${storeId}/managers`, { manager_id: managerId, ...permissions }),
  remove: (storeId, managerId) => api.delete(`/api/stores/${storeId}/managers/${managerId}`),
};

// Lottery API
export const lotteryAPI = {
  getGames: (storeId) => api.get(`/api/lottery-advanced/games?store_id=${storeId}`),
  createGame: (data) => api.post('/api/lottery-advanced/games', data),
  updateGame: (id, data) => api.put(`/api/lottery-advanced/games/${id}`, data),
  deleteGame: (id) => api.delete(`/api/lottery-advanced/games/${id}`),
  getBoxes: (storeId) => api.get(`/api/lottery-advanced/stores/${storeId}/boxes`),
  createBox: (storeId, data) => api.post(`/api/lottery-advanced/stores/${storeId}/boxes`, data),
  updateBox: (id, data) => api.put(`/api/lottery-advanced/boxes/${id}`, data),
  deleteBox: (id) => api.delete(`/api/lottery-advanced/boxes/${id}`),
  getPacks: (storeId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.game_id) params.append('game_id', filters.game_id);
    if (filters.status) params.append('status', filters.status);
    return api.get(`/api/lottery-advanced/stores/${storeId}/packs?${params.toString()}`);
  },
  createPack: (data) => api.post('/api/lottery-advanced/packs', data),
  updatePack: (id, data) => api.put(`/api/lottery-advanced/packs/${id}`, data),
  deletePack: (id) => api.delete(`/api/lottery-advanced/packs/${id}`),
  getReadings: (storeId, packId) => {
    const params = new URLSearchParams();
    if (storeId) params.append('store_id', storeId);
    if (packId) params.append('pack_id', packId);
    return api.get(`/api/lottery-advanced/readings?${params.toString()}`);
  },
  createReading: (data) => api.post('/api/lottery-advanced/readings', data),
  getInstantDay: (storeId, date) => api.get(`/api/lottery-advanced/instant-day/${storeId}/${date}`),
  createOrUpdateInstantDay: (data) => api.post('/api/lottery-advanced/instant-day', data),
  computeInstantDay: (storeId, date) => api.post(`/api/lottery-advanced/instant-day/${storeId}/${date}/compute`),
  getDrawDay: (storeId, date) => api.get(`/api/lottery-advanced/stores/${storeId}/draw/days/${date}`),
  createOrUpdateDrawDay: (storeId, data) => api.post(`/api/lottery-advanced/stores/${storeId}/draw/days`, data),
  previewDayClose: (storeId, date) => api.get(`/api/lottery-advanced/stores/${storeId}/dayclose/preview/${date}`),
  postGL: (storeId, date) => api.post(`/api/lottery-advanced/stores/${storeId}/dayclose/post/${date}`),
  getAnomalies: (storeId, filters) => {
    const params = new URLSearchParams();
    if (storeId) params.append('store_id', storeId);
    if (filters?.pack_id) params.append('pack_id', filters.pack_id);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.severity) params.append('severity', filters.severity);
    if (filters?.resolved) params.append('resolved', filters.resolved);
    return api.get(`/api/lottery-advanced/anomalies?${params.toString()}`);
  },
  resolveAnomaly: (id, notes) => api.post(`/api/lottery-advanced/anomalies/${id}/resolve`, { notes }),
  getRange: (storeId, startDate, endDate) => {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    return api.get(`/api/lottery/${storeId}/range?${params.toString()}`);
  },
};

// Lottery Analytics API
export const lotteryAnalyticsAPI = {
  getSalesPaidoutReport: (storeId, params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.employee_id) queryParams.append('employee_id', params.employee_id);
    return api.get(`/api/lottery-analytics/sales-paidout/${storeId}?${queryParams.toString()}`);
  },
  saveSalesPaidoutReport: (storeId, data) => api.post(`/api/lottery-analytics/sales-paidout/${storeId}`, data),
  getDailyReport: (storeId, params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.employee_id) queryParams.append('employee_id', params.employee_id);
    return api.get(`/api/lottery-analytics/daily/${storeId}?${queryParams.toString()}`);
  },
  saveDailyReport: (storeId, data) => api.post(`/api/lottery-analytics/daily/${storeId}`, data),
  autoPopulate: (storeId, data) => api.post(`/api/lottery-analytics/auto-populate/${storeId}`, data),
};

// Lottery Sales Data API
export const lotterySalesDataAPI = {
  getDailySales: (storeId, date) => api.get(`/api/lottery-sales-data/stores/${storeId}/daily/${date}`),
  createOrUpdateDailySales: (storeId, data) => api.post(`/api/lottery-sales-data/stores/${storeId}/daily`, data),
  getWeeklySales: (storeId, weekStart) => api.get(`/api/lottery-sales-data/stores/${storeId}/weekly/${weekStart}`),
  createOrUpdateWeeklySales: (storeId, data) => api.post(`/api/lottery-sales-data/stores/${storeId}/weekly`, data),
  getWeeklySettlement: (storeId, weekStart) => api.get(`/api/lottery-sales-data/stores/${storeId}/weekly-settlement/${weekStart}`),
  createOrUpdateWeeklySettlement: (storeId, data) => api.post(`/api/lottery-sales-data/stores/${storeId}/weekly-settlement`, data),
  getThirteenWeekAverage: (storeId) => api.get(`/api/lottery-sales-data/stores/${storeId}/thirteen-week-average`),
  createOrUpdateThirteenWeekAverage: (storeId, data) => api.post(`/api/lottery-sales-data/stores/${storeId}/thirteen-week-average`, data),
};

// State Lottery Configs API
export const stateLotteryConfigsAPI = {
  getByStoreId: (storeId) => api.get(`/api/state-lottery-configs/store/${storeId}`),
  create: (storeId, data) => api.post(`/api/state-lottery-configs/store/${storeId}`, data),
  update: (id, data) => api.put(`/api/state-lottery-configs/${id}`, data),
  delete: (id) => api.delete(`/api/state-lottery-configs/${id}`),
};

// Lottery Email OAuth API
export const lotteryEmailOAuthAPI = {
  getConfig: (storeId) => api.get(`/api/lottery-email-oauth/stores/${storeId}`),
  create: (storeId, data) => api.post(`/api/lottery-email-oauth/stores/${storeId}`, data),
  update: (storeId, data) => api.put(`/api/lottery-email-oauth/stores/${storeId}`, data),
  delete: (storeId) => api.delete(`/api/lottery-email-oauth/stores/${storeId}`),
  getAuthUrl: (storeId) => api.get(`/api/lottery-email-oauth/stores/${storeId}/auth-url`),
  handleCallback: (storeId, code) => api.post(`/api/lottery-email-oauth/stores/${storeId}/callback`, { code }),
  getAccounts: (storeId) => api.get(`/api/lottery-email-oauth/stores/${storeId}/accounts`),
  createRule: (accountId, data) => api.post(`/api/lottery-email-oauth/accounts/${accountId}/rules`, data),
  checkEmails: (accountId) => api.post(`/api/lottery-email-oauth/accounts/${accountId}/check-emails`),
  disconnect: (accountId) => api.post(`/api/lottery-email-oauth/accounts/${accountId}/disconnect`),
};

// Google Sheets API
export const googleSheetsAPI = {
  getByStore: (storeId) => api.get(`/api/google-sheets/stores/${storeId}`),
  create: (storeId, data) => api.post(`/api/google-sheets/stores/${storeId}`, data),
  update: (id, data) => api.put(`/api/google-sheets/${id}`, data),
  delete: (id) => api.delete(`/api/google-sheets/${id}`),
  test: (id) => api.post(`/api/google-sheets/${id}/test`),
  sync: (id) => api.post(`/api/google-sheets/${id}/sync`),
};

// Purchase Invoices API
export const purchaseInvoicesAPI = {
  getByStore: (storeId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.status) params.append('status', filters.status);
    if (filters.vendor_id) params.append('vendor_id', filters.vendor_id);
    return api.get(`/api/purchase-invoices/store/${storeId}?${params.toString()}`);
  },
  getAll: (storeId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.status) params.append('status', filters.status);
    if (filters.vendor_id) params.append('vendor_id', filters.vendor_id);
    return api.get(`/api/purchase-invoices/store/${storeId}?${params.toString()}`);
  },
  getById: (invoiceId) => api.get(`/api/purchase-invoices/${invoiceId}`),
  create: (storeId, data) => api.post(`/api/purchase-invoices/store/${storeId}`, data),
  update: (invoiceId, data) => api.put(`/api/purchase-invoices/${invoiceId}`, data),
  delete: (invoiceId) => api.delete(`/api/purchase-invoices/${invoiceId}`),
  markPaid: (invoiceId, data) => api.post(`/api/purchase-invoices/${invoiceId}/mark-paid`, data),
  getVendors: (storeId) => api.get(`/api/purchase-invoices/store/${storeId}/vendors`),
  createVendor: (storeId, data) => api.post(`/api/purchase-invoices/store/${storeId}/vendors`, data),
};

// Payroll API
export const payrollAPI = {
  getByStore: (storeId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    return api.get(`/api/payroll/stores/${storeId}?${params.toString()}`);
  },
  getEmployees: (storeId) => api.get(`/api/payroll/store/${storeId}/employees`),
  getAvailableEmployees: (storeId) => api.get(`/api/payroll/store/${storeId}/available-employees`),
  getDeletedEmployees: (storeId) => api.get(`/api/payroll/store/${storeId}/deleted-employees`),
  getCustomPayrollNotifications: (storeId) => api.get(`/api/payroll/store/${storeId}/custom-payroll-notifications`),
  createEmployee: (storeId, data) => api.post(`/api/payroll/store/${storeId}/employees`, data),
  addEmployee: (storeId, data) => api.post(`/api/payroll/store/${storeId}/employees`, data),
  updateEmployee: (configId, data) => api.put(`/api/payroll/config/${configId}`, data),
  deleteEmployee: (configId) => api.delete(`/api/payroll/config/${configId}`),
  restoreEmployee: (configId) => api.post(`/api/payroll/config/${configId}/restore`),
  fireEmployee: (configId, fireDate) => api.post(`/api/payroll/config/${configId}/fire`, { fire_date: fireDate }),
  rehireEmployee: (configId, rehireDate) => api.post(`/api/payroll/config/${configId}/rehire`, { rehire_date: rehireDate }),
  updatePayRate: (configId, newPayRate, effectiveDate, reason) => {
    const data = { new_pay_rate: newPayRate };
    if (effectiveDate) data.effective_date = effectiveDate;
    if (reason) data.reason = reason;
    return api.patch(`/api/payroll/config/${configId}/pay-rate`, data);
  },
  getTimeOffRecords: (configId, startDate, endDate) => {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    return api.get(`/api/payroll/config/${configId}/time-off?${params.toString()}`);
  },
  calculatePayroll: (configId, fromDate, toDate) => api.post(`/api/payroll/config/${configId}/calculate`, { from_date: fromDate, to_date: toDate }),
  runPayroll: (storeId, data) => api.post(`/api/payroll/store/${storeId}/run`, data),
  getPayrollHistory: (storeId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.employee_id) params.append('employee_id', filters.employee_id);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    return api.get(`/api/payroll/store/${storeId}/history?${params.toString()}`);
  },
  addTimeOff: (configId, data) => api.post(`/api/payroll/config/${configId}/time-off`, data),
};

// Statistics API
export const statisticsAPI = {
  getAll: () => api.get('/api/statistics'),
  getOverall: () => api.get('/api/statistics'),
  getByStore: (storeId) => api.get(`/api/statistics/stores/${storeId}`),
};

// Cash Drawer Calculation API
export const cashDrawerCalculationAPI = {
  getConfig: (storeId) => api.get(`/api/cash-drawer-calculation/stores/${storeId}`),
  createOrUpdate: (storeId, data) => api.post(`/api/cash-drawer-calculation/stores/${storeId}`, data),
};

// Data Configuration API
export const dataConfigurationAPI = {
  getForms: (storeId) => api.get(`/api/data-configuration/stores/${storeId}/forms`),
  getForm: (formId) => api.get(`/api/data-configuration/forms/${formId}`),
  createForm: (storeId, data) => api.post(`/api/data-configuration/stores/${storeId}/forms`, data),
  updateForm: (formId, data) => api.put(`/api/data-configuration/forms/${formId}`, data),
  deleteForm: (formId) => api.delete(`/api/data-configuration/forms/${formId}`),
  getFormulas: () => api.get(`/api/data-configuration/formulas`),
  getFormula: (storeId) => {
    // Use 'default' as the storeId when null to avoid route conflict
    const effectiveStoreId = storeId || 'default';
    return api.get(`/api/data-configuration/formulas/${effectiveStoreId}`);
  },
  updateFormula: (storeId, data) => {
    // Use 'default' as the storeId when null to avoid route conflict
    const effectiveStoreId = storeId || 'default';
    return api.put(`/api/data-configuration/formulas/${effectiveStoreId}`, data);
  },
  getFieldMappings: () => api.get(`/api/data-configuration/field-mappings`),
  getFieldMappingsByStore: (storeId) => api.get(`/api/data-configuration/field-mappings/store/${storeId}`),
  updateFieldMapping: (mappingId, data) => api.put(`/api/data-configuration/field-mappings/${mappingId}`, data),
  getAvailableFields: (dataType) => api.get(`/api/data-configuration/available-fields/${dataType}`),
  getDataFlow: () => api.get(`/api/data-configuration/data-flow`),
  updateDataFlow: (mappingId, data) => api.put(`/api/data-configuration/data-flow/${mappingId}`, data),
  getIntegrationSources: () => api.get(`/api/data-configuration/integration-sources`),
  testConnection: (sourceId, sourceType) => api.post(`/api/data-configuration/integration-sources/${sourceId}/test`, { sourceType }),
  getFormTemplates: () => api.get(`/api/data-configuration/form-templates`),
  getFormTemplate: (templateId, storeId) => {
    const params = storeId ? `?store_id=${storeId}` : '';
    return api.get(`/api/data-configuration/form-templates/${templateId}${params}`);
  },
  saveFormTemplate: (data) => api.post(`/api/data-configuration/form-templates`, data),
  deleteFormTemplate: (templateId) => api.delete(`/api/data-configuration/form-templates/${templateId}`),
  getFormFields: (templateId, storeId) => {
    const params = storeId ? `?store_id=${storeId}` : '';
    return api.get(`/api/data-configuration/form-templates/${templateId}/fields${params}`);
  },
  saveFormField: (data) => api.post(`/api/data-configuration/form-fields`, data),
  bulkSaveFormFields: (templateId, fields) => api.post(`/api/data-configuration/form-templates/${templateId}/fields/bulk`, { fields }),
  deleteFormField: (fieldId) => api.delete(`/api/data-configuration/form-fields/${fieldId}`),
  getCalculatedFields: (templateId, storeId) => {
    const params = storeId ? `?store_id=${storeId}` : '';
    return api.get(`/api/data-configuration/form-templates/${templateId}/calculated-fields${params}`);
  },
  saveCalculatedField: (data) => api.post(`/api/data-configuration/calculated-fields`, data),
  deleteCalculatedField: (fieldId) => api.delete(`/api/data-configuration/calculated-fields/${fieldId}`),
  testFormula: (formula, fieldValues) => api.post(`/api/data-configuration/calculated-fields/test-formula`, { formula, fieldValues }),
};

// Database Browser API
export const databaseBrowserAPI = {
  getTables: () => api.get('/api/database-browser/tables'),
  getTableData: (tableName, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);
    return api.get(`/api/database-browser/tables/${tableName}?${params.toString()}`);
  },
};

// Reports API
export const reportsAPI = {
  getDailyReport: (storeId, date) => api.get(`/api/reports/store/${storeId}/daily/${date}`),
  getWeeklyReport: (storeId, weekStart) => api.get(`/api/reports/store/${storeId}/weekly/${weekStart}`),
  getMonthlyReport: (storeId, month) => api.get(`/api/reports/store/${storeId}/monthly/${month}`),
  getProfitLoss: (storeId, startDate, endDate) => {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    return api.get(`/api/reports/store/${storeId}/profit-loss?${params.toString()}`);
  },
  getRevenueCalculation: (storeId, startDate, endDate) => {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    return api.get(`/api/reports/store/${storeId}/revenue-calculation?${params.toString()}`);
  },
  getCashFlowDetailed: (storeId, startDate, endDate) => {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    return api.get(`/api/reports/store/${storeId}/cash-flow-detailed?${params.toString()}`);
  },
  getExpenseBreakdown: (storeId, startDate, endDate) => {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    return api.get(`/api/reports/store/${storeId}/expense-breakdown?${params.toString()}`);
  },
  getVendorPayments: (storeId, startDate, endDate, vendorId = null) => {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    if (vendorId) params.append('vendor_id', vendorId);
    return api.get(`/api/reports/store/${storeId}/vendor-payments?${params.toString()}`);
  },
  getDailyBusiness: (storeId, date) => {
    const params = new URLSearchParams();
    params.append('date', date);
    return api.get(`/api/reports/store/${storeId}/daily-business?${params.toString()}`);
  },
  getMonthlyBusiness: (storeId, year, month) => {
    const params = new URLSearchParams();
    params.append('year', year);
    params.append('month', month);
    return api.get(`/api/reports/store/${storeId}/monthly-business?${params.toString()}`);
  },
  getLotterySales: (storeId, startDate, endDate) => {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    return api.get(`/api/reports/store/${storeId}/lottery-sales?${params.toString()}`);
  },
  getDeposits: (storeId, startDate, endDate) => {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    return api.get(`/api/reports/store/${storeId}/deposits?${params.toString()}`);
  },
  getPayroll: (storeId, startDate, endDate) => {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    return api.get(`/api/reports/store/${storeId}/payroll?${params.toString()}`);
  },
  getSalesTrends: (storeId, startDate, endDate) => {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    return api.get(`/api/reports/store/${storeId}/sales-trends?${params.toString()}`);
  },
  getInventory: (storeId, startDate, endDate) => {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    return api.get(`/api/reports/store/${storeId}/inventory?${params.toString()}`);
  },
};

// Recurring Expenses API
export const recurringExpensesAPI = {
  getByStore: (storeId) => api.get(`/api/recurring-expenses/stores/${storeId}`),
  getTemplates: (storeId) => api.get(`/api/recurring-expenses/store/${storeId}/templates`),
  process: () => api.post(`/api/recurring-expenses/process`),
  create: (storeId, data) => api.post(`/api/recurring-expenses/stores/${storeId}`, data),
  update: (id, data) => api.put(`/api/recurring-expenses/${id}`, data),
  delete: (id) => api.delete(`/api/recurring-expenses/${id}`),
  generateExpenses: (id, startDate, endDate) => api.post(`/api/recurring-expenses/${id}/generate`, { start_date: startDate, end_date: endDate }),
};

// Notifications API
export const notificationsAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.is_read !== undefined) params.append('is_read', filters.is_read);
    if (filters.type) params.append('type', filters.type);
    if (filters.notification_type) params.append('type', filters.notification_type);
    if (filters.store_id) params.append('store_id', filters.store_id);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);
    return api.get(`/api/notifications?${params.toString()}`);
  },
  getUnreadCount: (storeId) => {
    const params = new URLSearchParams();
    if (storeId) params.append('store_id', storeId);
    return api.get(`/api/notifications/unread-count?${params.toString()}`);
  },
  create: (data) => api.post('/api/notifications', data),
  markAsRead: (id) => api.put(`/api/notifications/${id}/read`),
  markAllAsRead: (storeId) => {
    const body = storeId ? { store_id: storeId } : {};
    return api.put('/api/notifications/read-all', body);
  },
  delete: (id) => api.delete(`/api/notifications/${id}`),
};

// Journal Entries API
export const journalEntriesAPI = {
  getByStore: (storeId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.status) params.append('status', filters.status);
    if (filters.entry_type) params.append('entry_type', filters.entry_type);
    return api.get(`/api/journal-entries/store/${storeId}?${params.toString()}`);
  },
  getAll: (storeId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.status) params.append('status', filters.status);
    if (filters.entry_type) params.append('entry_type', filters.entry_type);
    return api.get(`/api/journal-entries/store/${storeId}?${params.toString()}`);
  },
  create: (storeId, data) => api.post(`/api/journal-entries/store/${storeId}`, data),
  update: (id, data) => api.put(`/api/journal-entries/${id}`, data),
  delete: (id) => api.delete(`/api/journal-entries/${id}`),
};

// Audit Logs API
export const auditLogsAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.user_id) params.append('user_id', filters.user_id);
    if (filters.action) params.append('action', filters.action);
    return api.get(`/api/audit-logs?${params.toString()}`);
  },
  getStatistics: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    return api.get(`/api/audit-logs/statistics?${params.toString()}`);
  },
};

// Billing API
const getInvoicesRequest = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.store_id) params.append('store_id', filters.store_id);
  const query = params.toString();
  return api.get(`/api/billing/invoices${query ? `?${query}` : ''}`);
};

export const billingAPI = {
  getAll: getInvoicesRequest,
  getInvoices: getInvoicesRequest,
  getInvoice: (invoiceId) => api.get(`/api/billing/invoices/${invoiceId}`),
  createInvoice: (data) => api.post('/api/billing/invoices', data),
  updateInvoice: (invoiceId, data) => api.put(`/api/billing/invoices/${invoiceId}`, data),
  markPaid: (invoiceId, data) => api.post(`/api/billing/invoices/${invoiceId}/mark-paid`, data),
};

// Subscriptions API
export const subscriptionsAPI = {
  getAll: () => api.get('/api/subscriptions'),
  getById: (id) => api.get(`/api/subscriptions/${id}`),
  create: (data) => api.post('/api/subscriptions', data),
  update: (id, data) => api.put(`/api/subscriptions/${id}`, data),
  delete: (id) => api.delete(`/api/subscriptions/${id}`),
};

// Export default api instance for direct use
// Mobile Devices API
// Inventory Orders API
export const inventoryOrdersAPI = {
  getByStore: (storeId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.flat_list) params.append('flat_list', filters.flat_list);
    return api.get(`/api/inventory-orders/store/${storeId}?${params.toString()}`);
  },
  getAllOrderItems: (storeId, filters = {}) => {
    const params = new URLSearchParams();
    params.append('flat_list', 'true');
    if (filters.status) params.append('status', filters.status);
    if (filters.itemStatus) params.append('item_status', filters.itemStatus);
    if (filters.search) params.append('search', filters.search);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.combineDuplicates === false) {
      params.append('combine_duplicates', 'false');
    } else {
      params.append('combine_duplicates', 'true');
    }
    return api.get(`/api/inventory-orders/store/${storeId}?${params.toString()}`);
  },
  getById: (orderId) => {
    return api.get(`/api/inventory-orders/${orderId}`);
  },
  updateItemQuantity: (itemId, quantity) => {
    return api.put(`/api/inventory-orders/items/${itemId}/quantity`, { quantity });
  },
  removeItem: (itemId) => {
    return api.delete(`/api/inventory-orders/items/${itemId}`);
  },
  markItemDelivered: (itemId, data = null) => {
    let payload = {};
    if (data === null || data === undefined) {
      payload = {};
    } else if (typeof data === 'number') {
      payload = { quantity_delivered: data };
    } else if (typeof data === 'object') {
      payload = { ...data };
    } else {
      payload = { quantity_delivered: data };
    }
    return api.post(`/api/inventory-orders/items/${itemId}/delivered`, payload);
  },
  cancelOrder: (orderId) => {
    return api.post(`/api/inventory-orders/${orderId}/cancel`);
  },
  getPendingItemsForInvoice: (storeId, params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.vendorId) searchParams.append('vendor_id', params.vendorId);
    if (params.includeAll) searchParams.append('include_all', 'true');
    const query = searchParams.toString();
    const url = query
      ? `/api/inventory-orders/store/${storeId}/pending-items?${query}`
      : `/api/inventory-orders/store/${storeId}/pending-items`;
    return api.get(url);
  },
};

export const crossStorePaymentsAPI = {
  create: (data) => api.post('/api/cross-store-payments', data),
  list: (params = {}) => api.get('/api/cross-store-payments', { params }),
  getById: (paymentId) => api.get(`/api/cross-store-payments/${paymentId}`),
  updateAllocationReimbursement: (allocationId, data) =>
    api.post(`/api/cross-store-payments/allocations/${allocationId}/reimbursement`, data),
};

export const squareAPI = {
  getConnectUrl: (storeId, locationId) => {
    const params = new URLSearchParams();
    params.append('storeId', storeId);
    if (locationId) params.append('locationId', locationId);
    return api.get(`/api/square/connect-url?${params.toString()}`);
  },
  getStatus: (storeId) => api.get(`/api/square/status/${storeId}`),
  setLocation: (storeId, locationId) =>
    api.post(`/api/square/location/${storeId}`, { location_id: locationId }),
  disconnect: (storeId) => api.post(`/api/square/disconnect/${storeId}`),
  syncDailySales: (storeId, date) =>
    api.post(`/api/square/sync-daily-sales`, { store_id: storeId, date }),
  syncDailySalesBulk: (date) =>
    api.post(`/api/square/sync-daily-sales/bulk`, { date }),
};

export const mobileDevicesAPI = {
  // Register device with code (public, no auth)
  register: (code, deviceId, deviceName, metadata) => {
    return fetch(`${API_BASE_URL}/api/mobile-devices/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code, device_id: deviceId, device_name: deviceName, metadata })
    }).then(res => res.json());
  },
  // Generate registration code (admin only) - generic, no role
  generateCode: (storeId, options = {}) => {
    return api.post(`/api/mobile-devices/store/${storeId}/codes`, options);
  },
  // Get available users for assignment
  getUsers: (storeId) => {
    return api.get(`/api/mobile-devices/store/${storeId}/users`);
  },
  // Assign user to device
  assignUser: (deviceId, userId, permissions = {}, devicePin = null) => {
    return api.post(`/api/mobile-devices/devices/${deviceId}/assign-user`, { 
      user_id: userId, 
      permissions,
      device_pin: devicePin 
    });
  },
  // Unassign user from device
  unassignUser: (deviceId) => {
    return api.post(`/api/mobile-devices/devices/${deviceId}/unassign-user`);
  },
  // Update user device permissions
  updatePermissions: (deviceId, permissions) => {
    return api.put(`/api/mobile-devices/devices/${deviceId}/permissions`, permissions);
  },
  // Get device permissions
  getPermissions: (deviceId) => {
    return api.get(`/api/mobile-devices/devices/${deviceId}/permissions`);
  },
  // Get all codes for a store
  getCodes: (storeId, includeUsed = false) => {
    return api.get(`/api/mobile-devices/store/${storeId}/codes?include_used=${includeUsed}`);
  },
  // Deactivate code
  deactivateCode: (codeId) => {
    return api.put(`/api/mobile-devices/codes/${codeId}/deactivate`);
  },
  // Reactivate code
  reactivateCode: (codeId) => {
    return api.put(`/api/mobile-devices/codes/${codeId}/reactivate`);
  },
  // Delete code
  deleteCode: (codeId) => {
    return api.delete(`/api/mobile-devices/codes/${codeId}`);
  },
  // Get all devices for a store
  getDevices: (storeId, includeInactive = false) => {
    return api.get(`/api/mobile-devices/store/${storeId}/devices?include_inactive=${includeInactive}`);
  },
  // Lock device
  lockDevice: (deviceId) => {
    return api.put(`/api/mobile-devices/devices/${deviceId}/lock`);
  },
  // Unlock device
  unlockDevice: (deviceId) => {
    return api.put(`/api/mobile-devices/devices/${deviceId}/unlock`);
  },
  // Deactivate device
  deactivateDevice: (deviceId) => {
    return api.put(`/api/mobile-devices/devices/${deviceId}/deactivate`);
  },
  // Delete/unregister device (allows re-registration)
  deleteDevice: (deviceId) => {
    return api.delete(`/api/mobile-devices/devices/${deviceId}`);
  },
  // Get device info
  getDevice: (deviceId) => {
    return api.get(`/api/mobile-devices/device/${deviceId}`);
  },
  // Update device info
  updateDevice: (deviceId, data) => {
    return api.put(`/api/mobile-devices/device/${deviceId}`, data);
  },
};

export default api;

// Also export as named export for convenience
export { api };
