import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';

// Update this to your backend URL
// For development, use your computer's IP address (e.g., http://192.168.1.100:3000)
const API_BASE_URL = __DEV__
  ? 'http://10.1.10.120:3000' // Update this to your actual IP address
  : 'https://your-production-url.com';

// Get stored device ID
const getDeviceId = async (): Promise<string> => {
  let deviceId = await AsyncStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = await DeviceInfo.getUniqueId();
    await AsyncStorage.setItem('device_id', deviceId);
  }
  return deviceId;
};

const mobileDevicesAPI = {
  // Register device with code
  register: async (code: string, deviceName: string) => {
    const deviceId = await getDeviceId();
    const metadata = {
      os_version: DeviceInfo.getSystemVersion(),
      app_version: DeviceInfo.getVersion(),
      manufacturer: DeviceInfo.getManufacturer(),
      model: DeviceInfo.getModel(),
    };

    const response = await axios.post(`${API_BASE_URL}/api/mobile-devices/register`, {
      code,
      device_id: deviceId,
      device_name: deviceName,
      metadata,
    });

    // Store registration info
    await AsyncStorage.setItem('store_id', response.data.store.id);
    await AsyncStorage.setItem('device_id', deviceId);
    await AsyncStorage.setItem('registered', 'true');

    return response.data;
  },

  // Get device info and permissions
  getDeviceInfo: async () => {
    const deviceId = await getDeviceId();
    const token = await AsyncStorage.getItem('auth_token');
    
    const headers: any = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await axios.get(
      `${API_BASE_URL}/api/mobile-devices/device/${deviceId}`,
      { headers }
    );

    return response.data;
  },

  // Check if device is locked
  checkLockStatus: async () => {
    const deviceInfo = await mobileDevicesAPI.getDeviceInfo();
    return deviceInfo.device?.is_locked || false;
  },

  // Update device info (last seen, etc.)
  updateDevice: async (data: any) => {
    const deviceId = await getDeviceId();
    const token = await AsyncStorage.getItem('auth_token');

    await axios.put(
      `${API_BASE_URL}/api/mobile-devices/device/${deviceId}`,
      {
        ...data,
        last_seen_at: new Date().toISOString(),
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  },
};

export { mobileDevicesAPI };
export default mobileDevicesAPI;
