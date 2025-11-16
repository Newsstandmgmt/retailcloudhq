import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { getApiBaseUrl } from '../config/api';
import logger from '../services/logger';

// Get stored device ID - with better persistence
const getDeviceId = async (): Promise<string> => {
  try {
    // First, try to get from AsyncStorage
    let deviceId = await AsyncStorage.getItem('device_id');
    
    if (!deviceId) {
      // If not in storage, get from DeviceInfo and store it
      console.log('[DeviceAuth] Device ID not found in storage, generating new one...');
      deviceId = await DeviceInfo.getUniqueId();
      await AsyncStorage.setItem('device_id', deviceId);
      console.log('[DeviceAuth] Stored device ID:', deviceId);
    } else {
      console.log('[DeviceAuth] Using stored device ID:', deviceId);
    }
    
    return deviceId;
  } catch (error) {
    console.error('[DeviceAuth] Error getting device ID:', error);
    // Fallback: generate a new ID and try to store it
    try {
      const fallbackId = await DeviceInfo.getUniqueId();
      await AsyncStorage.setItem('device_id', fallbackId);
      return fallbackId;
    } catch (fallbackError) {
      console.error('[DeviceAuth] Error in fallback device ID generation:', fallbackError);
      // Last resort: use a temporary ID (this should rarely happen)
      return `temp-${Date.now()}`;
    }
  }
};

const deviceAuthAPI = {
  // Check latest app info (APK URL and version)
  getLatestApp: async () => {
    logger.info('[API] GET /api/mobile/latest-app');
    const response = await axios.get(`${getApiBaseUrl()}/api/mobile/latest-app`, {
      timeout: 8000,
    });
    logger.info('[API] latest-app ok', { status: response.status });
    return response.data as { platform: string; version: string; apkUrl: string; releaseNotes: string; updatedAt: string };
  },
  // Verify device is registered
  verifyDevice: async () => {
    try {
      const deviceId = await getDeviceId();
      logger.info('[API] GET /api/device-auth/verify/:id', { deviceId });
      const response = await axios.get(`${getApiBaseUrl()}/api/device-auth/verify/${deviceId}`, {
        timeout: 5000, // 5 second timeout
      });
      logger.info('[API] verify ok', { status: response.status });
      return response.data;
    } catch (error: any) {
      logger.error('[API] verify failed', { hasResponse: !!error?.response, status: error?.response?.status, message: error?.message });
      // Re-throw with more context
      if (!error.response) {
        // Network error
        error.isNetworkError = true;
      }
      throw error;
    }
  },

  // Login with PIN
  login: async (pin: string) => {
    try {
      const deviceId = await getDeviceId();
      logger.info('[API] POST /api/device-auth/login', { deviceId });
      const exec = async () => {
        return await axios.post(`${getApiBaseUrl()}/api/device-auth/login`, {
          device_id: deviceId,
          pin,
        }, {
          timeout: 15000, // give more time on cold start
        });
      };
      let response;
      try {
        response = await exec();
      } catch (err: any) {
        // Retry once on transient network failure
        if (!err.response) {
          logger.warn('[API] login transient failure, retrying', { message: err?.message });
          await new Promise(r => setTimeout(r, 700));
          response = await exec();
        } else {
          logger.error('[API] login failed (no retry)', { status: err?.response?.status, data: err?.response?.data });
          throw err;
        }
      }
      logger.info('[API] login ok', { status: response.status });

      const { token, user, device, permissions } = response.data;

      // Store token and user info
      await AsyncStorage.setItem('auth_token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('user_id', user.id);
      await AsyncStorage.setItem('user_role', user.role);
      await AsyncStorage.setItem('device_id', device.device_id);
      await AsyncStorage.setItem('store_id', device.store_id);
      if (permissions !== undefined && permissions !== null) {
        await AsyncStorage.setItem('permissions', JSON.stringify(permissions));
      } else {
        // Ensure we don't store "null"/"undefined" – clear any previous value
        await AsyncStorage.removeItem('permissions');
      }

      return { token, user, device, permissions };
    } catch (error: any) {
      logger.error('[API] login exception', { hasResponse: !!error?.response, status: error?.response?.status, message: error?.message, data: error?.response?.data });
      // Handle network errors
      if (!error.response) {
        error.isNetworkError = true;
      }
      throw error;
    }
  },

  // Logout
  logout: async () => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('user_id');
    await AsyncStorage.removeItem('user_role');
    await AsyncStorage.removeItem('permissions');
    // Keep device_id and store_id - device stays registered
  },

  // Check if user is logged in
  isLoggedIn: async (): Promise<boolean> => {
    const token = await AsyncStorage.getItem('auth_token');
    return !!token;
  },

  // Get current user
  getCurrentUser: async () => {
    const userStr = await AsyncStorage.getItem('user');
    if (!userStr) return null;
    return JSON.parse(userStr);
  },
};

export { deviceAuthAPI };
export default deviceAuthAPI;

