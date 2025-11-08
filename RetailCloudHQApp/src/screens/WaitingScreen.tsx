import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { mobileDevicesAPI } from '../api/mobileDevicesAPI';

export default function WaitingScreen({ navigation, onUserAssigned }: any) {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkUserAssignment();
    // Check every 10 seconds
    const interval = setInterval(checkUserAssignment, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkUserAssignment = async () => {
    try {
      const deviceInfo = await mobileDevicesAPI.getDeviceInfo();
      if (deviceInfo.device?.user_id && deviceInfo.permissions) {
        // User assigned
        if (onUserAssigned) {
          onUserAssigned();
        }
      }
    } catch (error) {
      console.error('Error checking user assignment:', error);
      setChecking(false);
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2d8659" />
      <Text style={styles.title}>Waiting for Admin Assignment</Text>
      <Text style={styles.subtitle}>
        Your device has been registered. Please wait for an administrator to assign a user to this device.
      </Text>
      {checking && (
        <Text style={styles.checking}>Checking status...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  checking: {
    fontSize: 12,
    color: '#999',
    marginTop: 10,
  },
});

