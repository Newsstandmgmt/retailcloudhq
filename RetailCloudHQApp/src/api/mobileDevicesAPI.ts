import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { getApiBaseUrl } from '../config/api';

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

    const response = await axios.post(`${getApiBaseUrl()}/api/mobile-devices/register`, {
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
      `${getApiBaseUrl()}/api/mobile-devices/device/${deviceId}`,
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
      `${getApiBaseUrl()}/api/mobile-devices/device/${deviceId}`,
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
