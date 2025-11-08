# Android App Setup Guide

## 📱 Overview

This guide will help you set up the Android handheld app that integrates with RetailCloudHQ.

## 🎯 Prerequisites

- Node.js 18+ installed
- Android Studio installed
- Java Development Kit (JDK) 17+
- Android SDK (API level 21+)
- Physical Android device or emulator

## 🚀 Step 1: Choose Your Technology Stack

### Option A: React Native (Recommended)
- **Pros**: Code sharing with web frontend, faster development, cross-platform
- **Cons**: Slightly larger app size

### Option B: Native Android (Kotlin/Java)
- **Pros**: Best performance, full Android features
- **Cons**: No code sharing, longer development time

**We'll proceed with React Native for this guide.**

## 📦 Step 2: Initialize React Native Project

```bash
# Install React Native CLI globally
npm install -g react-native-cli

# Create new React Native project
npx react-native init RetailCloudHQApp --template react-native-template-typescript

# Navigate to project
cd RetailCloudHQApp

# Install dependencies
npm install
```

## 🔧 Step 3: Install Required Dependencies

```bash
# Core dependencies
npm install axios react-native-async-storage/async-storage
npm install @react-navigation/native @react-navigation/stack
npm install react-native-gesture-handler react-native-reanimated
npm install react-native-screens react-native-safe-area-context

# Barcode scanning
npm install react-native-vision-camera react-native-vision-camera-code-scanner

# Device info
npm install react-native-device-info

# Permissions
npm install react-native-permissions

# For Android
cd android && ./gradlew clean && cd ..
```

## 📁 Step 4: Project Structure

```
RetailCloudHQApp/
├── src/
│   ├── api/
│   │   └── mobileDevicesAPI.ts      # API service
│   ├── screens/
│   │   ├── RegistrationScreen.tsx   # Code entry screen
│   │   ├── LoginScreen.tsx          # User login (if needed)
│   │   ├── DashboardScreen.tsx      # Main app screen
│   │   ├── InventoryScreen.tsx      # Inventory tracking
│   │   └── OrdersScreen.tsx         # Order management
│   ├── components/
│   │   ├── BarcodeScanner.tsx       # Barcode scanner component
│   │   └── PermissionGate.tsx       # Permission checker
│   ├── storage/
│   │   └── deviceStorage.ts         # Local storage utilities
│   ├── context/
│   │   └── DeviceContext.tsx        # Device state management
│   └── utils/
│       └── permissions.ts            # Permission utilities
├── android/
└── package.json
```

## 🔐 Step 5: Create API Service

Create `src/api/mobileDevicesAPI.ts`:

```typescript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';

const API_BASE_URL = 'http://your-backend-url:3000'; // Update with your backend URL

// Get stored device ID
const getDeviceId = async (): Promise<string> => {
  let deviceId = await AsyncStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = await DeviceInfo.getUniqueId();
    await AsyncStorage.setItem('device_id', deviceId);
  }
  return deviceId;
};

export const mobileDevicesAPI = {
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
    
    const response = await axios.get(
      `${API_BASE_URL}/api/mobile-devices/device/${deviceId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
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
```

## 📱 Step 6: Create Registration Screen

Create `src/screens/RegistrationScreen.tsx`:

```typescript
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
import { mobileDevicesAPI } from '../api/mobileDevicesAPI';
import DeviceInfo from 'react-native-device-info';

export default function RegistrationScreen({ navigation }: any) {
  const [code, setCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!code.trim()) {
      Alert.alert('Error', 'Please enter a registration code');
      return;
    }

    setLoading(true);
    try {
      const defaultDeviceName = await DeviceInfo.getDeviceName() || 'Android Device';
      const name = deviceName.trim() || defaultDeviceName;

      const result = await mobileDevicesAPI.register(code.trim().toUpperCase(), name);

      Alert.alert(
        'Success',
        'Device registered successfully! Please wait for admin to assign a user.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to waiting screen or check status
              navigation.replace('WaitingScreen');
            },
          },
        ]
      );
    } catch (error: any) {
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
      />

      <TextInput
        style={styles.input}
        placeholder="Device Name (Optional)"
        value={deviceName}
        onChangeText={setDeviceName}
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
  },
  button: {
    backgroundColor: '#2d8659',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
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
```

## 🔒 Step 7: Create Permission Gate Component

Create `src/components/PermissionGate.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { mobileDevicesAPI } from '../api/mobileDevicesAPI';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PermissionGateProps {
  children: React.ReactNode;
  requiredPermission: string;
  fallback?: React.ReactNode;
}

export default function PermissionGate({
  children,
  requiredPermission,
  fallback,
}: PermissionGateProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    checkPermissions();
    // Check lock status periodically
    const interval = setInterval(checkLockStatus, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const checkLockStatus = async () => {
    try {
      const locked = await mobileDevicesAPI.checkLockStatus();
      setIsLocked(locked);
      if (locked) {
        // Handle locked state - maybe show lock screen
      }
    } catch (error) {
      console.error('Error checking lock status:', error);
    }
  };

  const checkPermissions = async () => {
    try {
      const deviceInfo = await mobileDevicesAPI.getDeviceInfo();
      const permissions = deviceInfo.permissions;

      if (!permissions) {
        setHasPermission(false);
        return;
      }

      // Check if user is assigned
      if (!deviceInfo.device?.user_id) {
        setHasPermission(false);
        return;
      }

      // Check specific permission
      const hasAccess = permissions[requiredPermission] === true;
      setHasPermission(hasAccess);
    } catch (error) {
      console.error('Error checking permissions:', error);
      setHasPermission(false);
    }
  };

  if (isLocked) {
    return (
      <View style={styles.container}>
        <Text style={styles.lockedText}>Device is locked by administrator</Text>
      </View>
    );
  }

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text>Checking permissions...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      fallback || (
        <View style={styles.container}>
          <Text style={styles.errorText}>
            You don't have permission to access this feature
          </Text>
        </View>
      )
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lockedText: {
    fontSize: 18,
    color: '#d32f2f',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
```

## 📷 Step 8: Setup Barcode Scanner

Create `src/components/BarcodeScanner.tsx`:

```typescript
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

export default function BarcodeScanner({ onScan }: { onScan: (code: string) => void }) {
  const [hasPermission, setHasPermission] = useState(false);
  const device = useCameraDevice('back');

  React.useEffect(() => {
    requestCameraPermission();
  }, []);

  const requestCameraPermission = async () => {
    const result = await request(PERMISSIONS.ANDROID.CAMERA);
    setHasPermission(result === RESULTS.GRANTED);
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'ean-8', 'upc-a', 'upc-e', 'code-128', 'qr'],
    onCodeScanned: (codes) => {
      if (codes.length > 0) {
        onScan(codes[0].value);
      }
    },
  });

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text>Camera permission is required for barcode scanning</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text>No camera device found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        codeScanner={codeScanner}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
```

## ⚙️ Step 9: Android Configuration

### Update `android/app/src/main/AndroidManifest.xml`:

```xml
<manifest>
  <!-- Camera permission -->
  <uses-permission android:name="android.permission.CAMERA" />
  <uses-feature android:name="android.hardware.camera" android:required="false" />
  
  <!-- Internet permission -->
  <uses-permission android:name="android.permission.INTERNET" />
  
  <!-- Network security config for HTTP (development only) -->
  <application
    android:usesCleartextTraffic="true"
    ...>
  </application>
</manifest>
```

### Update `android/app/build.gradle`:

```gradle
android {
  defaultConfig {
    minSdkVersion 21
    targetSdkVersion 33
  }
}
```

## 🔄 Step 10: Setup Navigation

Create `src/navigation/AppNavigator.tsx`:

```typescript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import RegistrationScreen from '../screens/RegistrationScreen';
import DashboardScreen from '../screens/DashboardScreen';
import WaitingScreen from '../screens/WaitingScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  const [isRegistered, setIsRegistered] = React.useState<boolean | null>(null);
  const [hasUser, setHasUser] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    checkRegistration();
  }, []);

  const checkRegistration = async () => {
    const registered = await AsyncStorage.getItem('registered');
    setIsRegistered(registered === 'true');
    
    if (registered) {
      // Check if user is assigned
      const deviceInfo = await mobileDevicesAPI.getDeviceInfo();
      setHasUser(!!deviceInfo.device?.user_id);
    }
  };

  if (isRegistered === null) {
    return null; // Or loading screen
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isRegistered ? (
          <Stack.Screen name="Registration" component={RegistrationScreen} />
        ) : !hasUser ? (
          <Stack.Screen name="Waiting" component={WaitingScreen} />
        ) : (
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

## 🚀 Step 11: Run the App

```bash
# Start Metro bundler
npm start

# Run on Android device/emulator
npm run android

# Or use Android Studio
# Open android/ folder in Android Studio and run
```

## 🔗 Step 12: Connect to Backend

1. **Update API URL**: Change `API_BASE_URL` in `src/api/mobileDevicesAPI.ts` to your backend URL
2. **For Development**: Use your computer's IP address (e.g., `http://192.168.1.100:3000`)
3. **For Production**: Use your production backend URL

## 📝 Next Steps

1. Implement inventory tracking screens
2. Add order management features
3. Implement offline sync
4. Add push notifications
5. Test on physical devices

## 🐛 Troubleshooting

### Camera not working
- Check permissions in AndroidManifest.xml
- Verify camera permissions at runtime
- Test on physical device (emulator may have issues)

### Network errors
- Check API_BASE_URL is correct
- Verify backend is running
- Check network security config for HTTP

### Build errors
- Run `cd android && ./gradlew clean`
- Delete `node_modules` and reinstall
- Clear Metro bundler cache: `npm start -- --reset-cache`

