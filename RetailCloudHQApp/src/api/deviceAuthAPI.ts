import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';

// Update this to your backend URL
// Get your machine's IP: ifconfig (Mac/Linux) or ipconfig (Windows)
// For Android Emulator: use 10.0.2.2 instead of localhost
// For physical device: use your computer's actual IP (e.g., 172.20.10.3)
const API_BASE_URL = __DEV__ 
  ? 'http://10.1.10.120:3000' // Update this to your actual IP address
  : 'https://your-production-url.com';

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
  // Verify device is registered
  verifyDevice: async () => {
    try {
      const deviceId = await getDeviceId();
      const response = await axios.get(`${API_BASE_URL}/api/device-auth/verify/${deviceId}`, {
        timeout: 5000, // 5 second timeout
      });
      return response.data;
    } catch (error: any) {
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
      const response = await axios.post(`${API_BASE_URL}/api/device-auth/login`, {
        device_id: deviceId,
        pin,
      }, {
        timeout: 10000, // 10 second timeout for login
      });

      const { token, user, device, permissions } = response.data;

      // Store token and user info
      await AsyncStorage.setItem('auth_token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('user_id', user.id);
      await AsyncStorage.setItem('user_role', user.role);
      await AsyncStorage.setItem('device_id', device.device_id);
      await AsyncStorage.setItem('store_id', device.store_id);
      await AsyncStorage.setItem('permissions', JSON.stringify(permissions));

      return { token, user, device, permissions };
    } catch (error: any) {
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

