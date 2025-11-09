import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseApiUrl } from '../config/api';

const getAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem('auth_token');
    return token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

const api = axios.create({
  baseURL: getApiBaseApiUrl(),
  timeout: 10000,
});

api.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle network errors and 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle network errors
    if (!error.response) {
      error.code = 'NETWORK_ERROR';
      error.message = 'Network Error';
    }
    // Handle 401 - don't auto-logout, let the component handle it
    if (error.response?.status === 401) {
      console.warn('Unauthorized - session may have expired');
    }
    return Promise.reject(error);
  }
);

export const ordersAPI = {
  // Create a new order
  createOrder: async (storeId: string, items: Array<{ product_id: string; quantity: number; variant?: string | null }>, notes?: string) => {
    const response = await api.post(`/inventory-orders/store/${storeId}`, {
      items,
      notes,
    });
    return response.data;
  },

  // Get orders by store
  getByStore: async (storeId: string, filters?: { flat_list?: boolean; status?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filters?.flat_list) params.append('flat_list', filters.flat_list.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    
    const response = await api.get(`/inventory-orders/store/${storeId}?${params.toString()}`);
    return response.data;
  },

  // Check pending orders for a product (optionally filter by variant)
  getPendingOrdersForProduct: async (storeId: string, productId: string, variant?: string | null) => {
    try {
      const params = new URLSearchParams();
      if (variant !== undefined && variant !== null && variant !== '') {
        params.append('variant', variant);
      }
      const queryString = params.toString();
      const url = `/inventory-orders/store/${storeId}/product/${productId}/pending${queryString ? `?${queryString}` : ''}`;
      const response = await api.get(url);
      return response.data.pending_orders || [];
    } catch (error: any) {
      // Use console.warn to avoid ErrorReporter catching non-critical errors
      console.warn('[ordersAPI] Pending orders check failed (non-critical):', {
        storeId,
        productId,
        variant,
        // Only log details in dev mode
        ...(__DEV__ && {
          error: error?.message || error,
          statusCode: error?.response?.status
        })
      });
      // Return empty array on error instead of throwing
      // This allows the app to continue working even if pending check fails
      return [];
    }
  },
};

