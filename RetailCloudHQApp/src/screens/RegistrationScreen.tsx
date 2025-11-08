import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { mobileDevicesAPI } from '../api/mobileDevicesAPI';

export default function RegistrationScreen({ onRegistered }: any) {
  const [code, setCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(false);

  console.log('[RegistrationScreen] Rendering');

  const handleRegister = async () => {
    if (!code.trim()) {
      Alert.alert('Error', 'Please enter a registration code');
      return;
    }

    setLoading(true);
    try {
      const defaultDeviceName = await DeviceInfo.getDeviceName() || 'Android Device';
      const name = deviceName.trim() || defaultDeviceName;

      console.log('[Registration] Registering with code:', code.trim().toUpperCase());
      const result = await mobileDevicesAPI.register(code.trim().toUpperCase(), name);

      console.log('[Registration] Registration successful:', result);
      Alert.alert(
        'Success',
        'Device registered successfully! Please wait for admin to assign a user.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (onRegistered) {
                onRegistered();
              }
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('[Registration] Registration failed:', error);
      Alert.alert(
        'Registration Failed',
        error.response?.data?.error || error.message || 'Failed to register device'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Device Registration</Text>
      <Text style={styles.subtitle}>
        Enter the registration code provided by your administrator
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Enter Registration Code"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        maxLength={20}
        placeholderTextColor="#999"
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="Device Name (Optional)"
        value={deviceName}
        onChangeText={setDeviceName}
        placeholderTextColor="#999"
        editable={!loading}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Register Device</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
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
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#fff',
    color: '#000',
  },
  button: {
    backgroundColor: '#2d8659',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
