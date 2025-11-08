import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = __DEV__ 
  ? 'http://10.1.10.120:3000/api' // Update this to your actual IP address
  : 'https://your-production-url.com/api';

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
  baseURL: API_BASE_URL,
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

export const productsAPI = {
  // Get all active products for a store
  getProducts: async (storeId: string, filters?: {
    category?: string;
    brand?: string;
    supplier?: string;
    search?: string;
    is_active?: boolean;
  }) => {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.brand) params.append('brand', filters.brand);
    if (filters?.supplier) params.append('supplier', filters.supplier);
    if (filters?.search) params.append('search', filters.search);
    // Only filter by is_active if explicitly provided, otherwise get all active products
    // (Backend defaults to active if not specified, but we want to be explicit)
    if (filters?.is_active !== undefined) {
      params.append('is_active', filters.is_active.toString());
    } else {
      params.append('is_active', 'true'); // Default to active products
    }

    const response = await api.get(`/products/store/${storeId}?${params.toString()}`);
    return response.data.products;
  },

  // Get product by UPC
  getProductByUPC: async (storeId: string, upc: string) => {
    const products = await productsAPI.getProducts(storeId, { search: upc });
    return products.find((p: any) => p.upc === upc) || null;
  },

  // Get categories
  getCategories: async (storeId: string) => {
    const products = await productsAPI.getProducts(storeId);
    const categories = [...new Set(products.map((p: any) => p.category).filter(Boolean))];
    return categories.sort();
  },

  // Get brands
  getBrands: async (storeId: string) => {
    const products = await productsAPI.getProducts(storeId);
    const brands = [...new Set(products.map((p: any) => p.brand).filter(Boolean))];
    return brands.sort();
  },

  // Get suppliers
  getSuppliers: async (storeId: string) => {
    const products = await productsAPI.getProducts(storeId);
    const suppliers = [...new Set(products.map((p: any) => p.supplier).filter(Boolean))];
    return suppliers.sort();
  },
  // Update product
  update: async (productId: string, data: any) => {
    const response = await api.put(`/products/${productId}`, data);
    return response.data.product;
  },
  
  // Create product
  create: async (storeId: string, data: any) => {
    const response = await api.post(`/products/store/${storeId}`, data);
    return response.data.product;
  },
  
  // Generate product ID
  generateProductId: async (storeId: string, category: string) => {
    const response = await api.get(`/products/store/${storeId}/generate-id?category=${encodeURIComponent(category)}`);
    return response.data;
  },
  
  // Get product by ID
  getById: async (productId: string) => {
    const response = await api.get(`/products/${productId}`);
    return response.data.product;
  },
};

