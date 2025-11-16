import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deviceAuthAPI } from './src/api/deviceAuthAPI';
import SyncService from './src/services/syncService';
import { errorReporter } from './src/services/errorReporter';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { PermissionsProvider, RequirePermission } from './src/contexts/PermissionsContext';

import RegistrationScreen from './src/screens/RegistrationScreen';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import InventoryOrderingScreen from './src/screens/InventoryOrderingScreen';
import ProductManagementScreen from './src/screens/ProductManagementScreen';
import AgeCheckScreen from './src/screens/AgeCheckScreen';

// Debug: Verify components are imported correctly
if (__DEV__) {
  console.log('[App] Component imports:', {
    RegistrationScreen: typeof RegistrationScreen,
    LoginScreen: typeof LoginScreen,
    DashboardScreen: typeof DashboardScreen,
    InventoryOrderingScreen: typeof InventoryOrderingScreen,
    ProductManagementScreen: typeof ProductManagementScreen,
  });
}

type Screen = 'dashboard' | 'inventory-ordering' | 'product-management' | 'age-check';

interface Navigation {
  navigate: (screen: Screen) => void;
  goBack: () => void;
}

export default function App() {
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    // Initialize error reporter first - wrap in try-catch to prevent blocking
    try {
      await errorReporter.initialize();
      console.log('[App] ✅ Error reporter initialized');
    } catch (error: any) {
      console.warn('[App] Error reporter initialization failed:', error);
      // Report the initialization error itself (if possible)
      try {
        await errorReporter.reportError({
          error: error instanceof Error ? error : new Error(String(error)),
          errorType: 'other',
          severity: 'medium',
          context: { stage: 'error_reporter_initialization' },
        });
      } catch (reportError) {
        // Ignore if we can't even report the error
        console.warn('[App] Could not report error reporter initialization failure');
      }
    }
    
    // Initialize database/sync in background (non-blocking)
    // Don't await - let it happen in background
    SyncService.initialize().catch((error) => {
      // Silently fail - database is optional
      console.warn('[App] Database initialization failed (optional):', error);
      // Report database initialization errors
      errorReporter.reportError({
        error: error instanceof Error ? error : new Error(String(error)),
        errorType: 'database',
        severity: 'medium',
        context: { stage: 'initialization' },
      }).catch(() => {});
    });
    
    // Check app state immediately (don't wait for database)
    checkAppState();
  };

  const checkAppState = async () => {
    try {
      console.log('[App] Checking app state...');
      
      // Check if device is registered (device stays registered once registered)
      const registered = await AsyncStorage.getItem('registered');
      let isReg = registered === 'true';
      console.log('[App] Device registered:', isReg);
      setIsRegistered(isReg);

      // If local flag says not registered, try server verify to auto-restore provisioning after reinstall
      if (!isReg) {
        try {
          const verify = await deviceAuthAPI.verifyDevice();
          if (verify?.device?.store_id && verify?.device?.is_active) {
            console.log('[App] Auto-restored provisioning from server for store:', verify.device.store_id);
            await AsyncStorage.setItem('registered', 'true');
            await AsyncStorage.setItem('store_id', verify.device.store_id);
            isReg = true;
            setIsRegistered(true);
          }
        } catch (e) {
          // If verify fails here, we will fall back to registration screen below
          console.log('[App] Server verify failed while attempting auto-restore:', (e as any)?.message);
        }
        if (!isReg) {
          setIsLoggedIn(false);
          return;
        }
      }

      // Verify device is still registered
      try {
        await deviceAuthAPI.verifyDevice();
      } catch (error: any) {
        console.log('[App] Device verification failed:', error.message);
        // Only clear registration if it's a 404 (device not found) or 403 (device inactive/locked)
        // Network errors should not unregister the device
        if (error.response?.status === 404 || error.response?.status === 403) {
          await AsyncStorage.removeItem('registered');
          setIsRegistered(false);
          setIsLoggedIn(false);
          return;
        }
        // For network errors, keep device registered but show login
        console.log('[App] Network error during verification, keeping device registered');
        setIsLoggedIn(false);
        return;
      }

      // Check if user is logged in
      const loggedIn = await deviceAuthAPI.isLoggedIn();
      console.log('[App] User logged in:', loggedIn);
      setIsLoggedIn(loggedIn);
    } catch (error) {
      console.error('[App] Error checking app state:', error);
      setIsRegistered(false);
      setIsLoggedIn(false);
    }
  };

  const handleRegistrationSuccess = () => {
    console.log('[App] Registration successful');
    setIsRegistered(true);
    setIsLoggedIn(false); // Always show login after registration
  };

  const handleLoginSuccess = () => {
    console.log('[App] Login successful');
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    console.log('[App] Logout');
    setIsLoggedIn(false);
  };

  // Show loading screen while checking
  if (isRegistered === null || isLoggedIn === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2d8659" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  console.log('[App] Rendering - isRegistered:', isRegistered, 'isLoggedIn:', isLoggedIn);

  // Flow:
  // 1. Not registered -> Registration Screen
  // 2. Registered -> Always show Login Screen (device stays registered)
  // 3. Logged in -> Dashboard

  // Simple navigation handler
  const navigation: Navigation = {
    navigate: (screen: Screen) => {
      console.log('[App] Navigating to:', screen);
      setCurrentScreen(screen);
    },
    goBack: () => {
      console.log('[App] Going back to dashboard');
      setCurrentScreen('dashboard');
    },
  };

  return (
    <ErrorBoundary>
      {!isRegistered ? (
        <RegistrationScreen onRegistered={handleRegistrationSuccess} />
      ) : !isLoggedIn ? (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      ) : (
        <PermissionsProvider>
          <>
            {currentScreen === 'inventory-ordering' && (
              <RequirePermission anyOf={['can_create_orders','can_receive_inventory']} roleIn={['admin','super_admin','manager']} fallback={null}>
                <InventoryOrderingScreen navigation={navigation} route={undefined} />
              </RequirePermission>
            )}
            {currentScreen === 'product-management' && (
              <RequirePermission anyOf={['can_edit_products']} roleIn={['admin','super_admin']} fallback={null}>
                <ProductManagementScreen navigation={navigation} />
              </RequirePermission>
            )}
            {currentScreen === 'dashboard' && (
              <DashboardScreen onLogout={handleLogout} navigation={navigation} />
            )}
            {currentScreen === 'age-check' && (
              <AgeCheckScreen navigation={navigation} />
            )}
          </>
        </PermissionsProvider>
      )}
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
});
