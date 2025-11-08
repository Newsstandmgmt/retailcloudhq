import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { deviceAuthAPI } from '../api/deviceAuthAPI';

// Import error reporter
let errorReporter: any;
try {
  errorReporter = require('../services/errorReporter').errorReporter;
} catch (error) {
  console.warn('[LoginScreen] Error reporter not available');
  errorReporter = null;
}

// Import NetInfo with error handling
let NetInfo: any;
try {
  NetInfo = require('@react-native-community/netinfo').default;
} catch (error) {
  NetInfo = {
    fetch: async () => ({ isConnected: true }),
    addEventListener: () => () => {},
  };
}

export default function LoginScreen({ onLoginSuccess }: any) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [deviceCheckLoading, setDeviceCheckLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    checkDevice();
    checkNetworkStatus();
    
    // Listen for network changes
    const unsubscribe = NetInfo.addEventListener((state: any) => {
      const connected = state.isConnected || false;
      setIsOnline(connected);
      setNetworkError(!connected);
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const checkNetworkStatus = async () => {
    try {
      const state = await NetInfo.fetch();
      const connected = state.isConnected || false;
      setIsOnline(connected);
      setNetworkError(!connected);
    } catch (error) {
      console.warn('[Login] Error checking network status:', error);
      // Assume online if we can't check
      setIsOnline(true);
      setNetworkError(false);
    }
  };

  const checkDevice = async () => {
    try {
      setDeviceCheckLoading(true);
      setNetworkError(false);
      const info = await deviceAuthAPI.verifyDevice();
      setDeviceInfo(info.device);
    } catch (error: any) {
      console.error('[Login] Error verifying device:', error);
      
      // Report error
      if (errorReporter) {
        errorReporter.reportError({
          error: error instanceof Error ? error : new Error(String(error)),
          errorType: 'network',
          severity: 'medium',
          context: { 
            stage: 'device_verification',
            statusCode: error.response?.status,
            hasResponse: !!error.response,
          },
        }).catch(() => {});
      }
      
      // Check if it's a network error
      if (error.isNetworkError || !error.response) {
        setNetworkError(true);
        // Don't block login for network errors - allow user to try logging in anyway
        // The login endpoint will verify the device
        console.log('[Login] Network error during device verification, but allowing login attempt');
      } else if (error.response?.status === 404) {
        // Device not found - but allow login attempt
        // The login endpoint will handle device registration if needed
        console.warn('[Login] Device not found (404), but allowing login attempt');
        console.warn('[Login] If login succeeds, device will be registered automatically');
        // Don't show blocking alert - just log it and allow login
      } else if (error.response?.status === 403) {
        // Device locked or inactive
        const errorMsg = error.response?.data?.error || 'Device verification failed';
        Alert.alert('Device Error', errorMsg, [{ text: 'OK' }]);
      } else {
        // Other errors - still allow login attempt
        console.log('[Login] Device verification failed, but allowing login attempt');
      }
    } finally {
      setDeviceCheckLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!pin.trim() || pin.length < 4) {
      Alert.alert('Error', 'Please enter a valid PIN (4-6 digits)');
      return;
    }

    setLoading(true);
    try {
      console.log('[Login] Attempting PIN login...');
      
      const result = await deviceAuthAPI.login(pin.trim());
      console.log('[Login] Login successful, user:', result.user);

      // Refresh device info after successful login
      await checkDevice();

      Alert.alert('Success', `Welcome, ${result.user.first_name}!`, [
        {
          text: 'OK',
          onPress: () => {
            if (onLoginSuccess) {
              onLoginSuccess();
            }
          },
        },
      ]);
    } catch (error: any) {
      console.error('[Login] Login failed:', error);
      
      // Report error
      if (errorReporter) {
        errorReporter.reportError({
          error: error instanceof Error ? error : new Error(String(error)),
          errorType: error.isNetworkError ? 'network' : 'other',
          severity: error.response?.status === 401 ? 'medium' : 'high',
          context: { 
            stage: 'login',
            statusCode: error.response?.status,
            hasResponse: !!error.response,
            errorData: error.response?.data,
          },
        }).catch(() => {});
      }
      
      let errorMessage = 'Invalid PIN';
      let errorTitle = 'Login Failed';
      
      if (error.isNetworkError || !error.response) {
        // Network error - don't show alert, just show inline warning
        setNetworkError(true);
        console.warn('[Login] Network error during login - showing inline warning');
        // Don't clear PIN, allow user to retry
        return; // Don't show alert for network errors
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.status === 401) {
        errorMessage = 'Invalid PIN. Please try again.';
        setPin(''); // Clear PIN on invalid PIN
      } else if (error.response?.status === 403) {
        errorMessage = error.response.data?.error || 'Access denied. Please contact your administrator.';
      } else if (error.response?.status === 404) {
        // Device not found - but backend should auto-register during login
        // This might happen if device was deleted from backend
        errorMessage = 'Device not found. If this persists, please contact your administrator.';
        console.warn('[Login] Device not found during login - backend should handle registration');
      }
      
      // Only show alert for non-network errors
      Alert.alert(errorTitle, errorMessage);
      if (error.response?.status === 401) {
        setPin(''); // Clear PIN on invalid PIN
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>Enter PIN</Text>
          
          {deviceCheckLoading && (
            <View style={styles.infoBox}>
              <ActivityIndicator size="small" color="#2d8659" style={{ marginRight: 8 }} />
              <Text style={styles.infoText}>Verifying device...</Text>
            </View>
          )}

          {(networkError || !isOnline) && !deviceCheckLoading && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ Network connection issue. You can still try to login.
              </Text>
            </View>
          )}

          {deviceInfo && (
            <Text style={styles.subtitle}>
              Device: {deviceInfo.device_name || 'Unknown Device'}
            </Text>
          )}
          
          {deviceInfo && !deviceInfo.user_id && !networkError && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                No user assigned to this device. Please contact your administrator.
              </Text>
            </View>
          )}

          {deviceInfo && deviceInfo.is_locked && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                This device has been locked. Please contact your administrator.
              </Text>
            </View>
          )}

          {deviceInfo && !deviceInfo.is_active && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                This device has been deactivated. Please contact your administrator.
              </Text>
            </View>
          )}

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>PIN</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter PIN"
                value={pin}
                onChangeText={(text) => {
                  // Only allow digits, max 6 characters
                  const numericText = text.replace(/[^0-9]/g, '').slice(0, 6);
                  setPin(numericText);
                }}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                autoFocus
                placeholderTextColor="#999"
                editable={!loading && !deviceCheckLoading}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.button, 
                (loading || deviceCheckLoading) && styles.buttonDisabled
              ]}
              onPress={handleLogin}
              disabled={loading || deviceCheckLoading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Enter your PIN to access the app.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#000',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    backgroundColor: '#fff',
    color: '#000',
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#2d8659',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 30,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
  infoBox: {
    backgroundColor: '#e7f3ff',
    borderColor: '#2196F3',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    color: '#0d47a1',
    fontSize: 14,
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffc107',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#f8d7da',
    borderColor: '#dc3545',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#721c24',
    fontSize: 14,
    textAlign: 'center',
  },
});
