import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '../config/api';

const authAPI = {
  // Login
  login: async (email: string, password: string) => {
    const response = await axios.post(`${getApiBaseUrl()}/api/auth/login`, {
      email,
      password,
    });

    const { token, user } = response.data;

    // Store token and user info
    await AsyncStorage.setItem('auth_token', token);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    await AsyncStorage.setItem('user_id', user.id);
    await AsyncStorage.setItem('user_role', user.role);

    return { token, user };
  },

  // Logout
  logout: async () => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('user_id');
    await AsyncStorage.removeItem('user_role');
  },

  // Get current user
  getCurrentUser: async () => {
    const userStr = await AsyncStorage.getItem('user');
    if (!userStr) return null;
    return JSON.parse(userStr);
  },

  // Get stored token
  getToken: async (): Promise<string | null> => {
    return await AsyncStorage.getItem('auth_token');
  },

  // Check if user is logged in
  isLoggedIn: async (): Promise<boolean> => {
    const token = await AsyncStorage.getItem('auth_token');
    return !!token;
  },
};

export { authAPI };
export default authAPI;

