import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  SafeAreaView,
} from 'react-native';
import { deviceAuthAPI } from '../api/deviceAuthAPI';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SyncService from '../services/syncService';
import Database from '../services/database';

// Import NetInfo with error handling
let NetInfo: any;
try {
  NetInfo = require('@react-native-community/netinfo').default;
} catch (error) {
  console.warn('[Dashboard] NetInfo not available, using fallback');
  NetInfo = {
    fetch: async () => ({ isConnected: true }),
    addEventListener: () => () => {},
  };
}

interface Navigation {
  navigate: (screen: string) => void;
  goBack: () => void;
}

interface DashboardScreenProps {
  onLogout: () => void;
  navigation?: Navigation;
}

export default function DashboardScreen({ onLogout, navigation }: DashboardScreenProps) {
  const [user, setUser] = React.useState<any>(null);
  const [isOnline, setIsOnline] = React.useState(true);
  const [syncStatus, setSyncStatus] = React.useState<any>(null);
  const [dbInitialized, setDbInitialized] = React.useState(false);

  React.useEffect(() => {
    loadUser();
    const networkUnsubscribe = setupNetworkListener();
    const syncUnsubscribe = setupSyncStatusListener();
    checkDatabaseStatus();
    
    // Cleanup on unmount
    return () => {
      if (networkUnsubscribe) networkUnsubscribe();
      if (syncUnsubscribe) syncUnsubscribe();
    };
  }, []);

  const setupNetworkListener = () => {
    // Initial check
    NetInfo.fetch().then((state: any) => {
      const connected = state.isConnected || false;
      setIsOnline(connected);
      console.log('[Dashboard] Initial network status:', connected);
    });
    
    // Listen for changes
    const unsubscribe = NetInfo.addEventListener((state: any) => {
      const connected = state.isConnected || false;
      setIsOnline(connected);
      console.log('[Dashboard] Network status changed:', connected);
    });
    
    // Cleanup function
    return unsubscribe;
  };

  const setupSyncStatusListener = () => {
    const unsubscribe = SyncService.subscribeToSyncStatus((status) => {
      setSyncStatus(status);
    });
    return unsubscribe;
  };

  const checkDatabaseStatus = async () => {
    const initialized = Database.isInitialized();
    setDbInitialized(initialized);
    console.log('[Dashboard] Database initialized:', initialized);
  };

  const loadUser = async () => {
    try {
      const userData = await deviceAuthAPI.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await deviceAuthAPI.logout();
            if (onLogout) {
              onLogout();
            }
          },
        },
      ]
    );
  };

  const handleFeaturePress = (feature: string) => {
    Alert.alert(
      feature,
      `${feature} feature will be available soon!`,
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>RetailCloudHQ</Text>
            {user && (
              <Text style={styles.headerSubtitle}>
                Welcome, {user.first_name} {user.last_name}
              </Text>
            )}
          </View>
          <View style={styles.headerRight}>
            {/* Network Status Indicator */}
            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusIndicator,
                  isOnline ? styles.statusOnline : styles.statusOffline,
                ]}
              />
              {syncStatus && syncStatus.pendingOperations > 0 && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingText}>{syncStatus.pendingOperations}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Dashboard Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dashboardGrid}>
          {/* Instant Tracker */}
          <TouchableOpacity
            style={styles.featureCard}
            onPress={() => handleFeaturePress('Instant Tracker')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, styles.trackerIcon]}>
              <Text style={styles.iconEmoji}>📊</Text>
            </View>
            <Text style={styles.featureTitle}>Instant Tracker</Text>
            <Text style={styles.featureDescription}>
              Track inventory in real-time
            </Text>
          </TouchableOpacity>

          {/* Inventory Ordering */}
          <TouchableOpacity
            style={styles.featureCard}
            onPress={() => {
              if (navigation && navigation.navigate) {
                navigation.navigate('inventory-ordering');
              } else {
                console.warn('Navigation not available, using fallback');
                handleFeaturePress('Inventory Ordering');
              }
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, styles.orderingIcon]}>
              <Text style={styles.iconEmoji}>📦</Text>
            </View>
            <Text style={styles.featureTitle}>Inventory Ordering</Text>
            <Text style={styles.featureDescription}>
              Create and manage orders
            </Text>
          </TouchableOpacity>

          {/* POS */}
          <TouchableOpacity
            style={styles.featureCard}
            onPress={() => handleFeaturePress('POS')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, styles.posIcon]}>
              <Text style={styles.iconEmoji}>💳</Text>
            </View>
            <Text style={styles.featureTitle}>POS</Text>
            <Text style={styles.featureDescription}>
              Point of Sale system
            </Text>
          </TouchableOpacity>

              {/* Product Management - Only show for admins/managers */}
              {(user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'manager') && (
                <TouchableOpacity
                  style={styles.featureCard}
                  onPress={() => {
                    if (navigation && navigation.navigate) {
                      navigation.navigate('product-management');
                    } else {
                      console.warn('Navigation not available, using fallback');
                      handleFeaturePress('Product Management');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconContainer, styles.productIcon]}>
                    <Text style={styles.iconEmoji}>📋</Text>
                  </View>
                  <Text style={styles.featureTitle}>Product Management</Text>
                  <Text style={styles.featureDescription}>
                    Add and edit products
                  </Text>
                </TouchableOpacity>
              )}

          {/* Age Checker - available to all roles */}
          <TouchableOpacity
            style={styles.featureCard}
            onPress={() => {
              if (navigation && navigation.navigate) {
                navigation.navigate('age-check');
              } else {
                handleFeaturePress('Age Checker');
              }
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, styles.ageIcon]}>
              <Text style={styles.iconEmoji}>🆔</Text>
            </View>
            <Text style={styles.featureTitle}>Age Checker</Text>
            <Text style={styles.featureDescription}>
              Verify customer age
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2d8659',
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  statusOnline: {
    backgroundColor: '#4CAF50',
  },
  statusOffline: {
    backgroundColor: '#F44336',
  },
  pendingBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF9800',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  pendingText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#e0e0e0',
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  trackerIcon: {
    backgroundColor: '#E3F2FD',
  },
  orderingIcon: {
    backgroundColor: '#FFF3E0',
  },
  posIcon: {
    backgroundColor: '#E8F5E9',
  },
  productIcon: {
    backgroundColor: '#E1F5FE',
  },
  ageIcon: {
    backgroundColor: '#FCE4EC',
  },
  iconEmoji: {
    fontSize: 40,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
});
