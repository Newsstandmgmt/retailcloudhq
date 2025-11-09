// Import NetInfo with error handling for native module issues
let NetInfo: any;
try {
  NetInfo = require('@react-native-community/netinfo').default;
} catch (error) {
  console.warn('[SyncService] NetInfo not available, using fallback');
  // Fallback for when native module is not linked
  NetInfo = {
    fetch: async () => ({ isConnected: true }), // Assume connected as fallback
    addEventListener: () => () => {}, // No-op unsubscribe
  };
}

import Database from './database';
import { productsAPI } from '../api/productsAPI';
import { ordersAPI } from '../api/ordersAPI';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { getApiBaseApiUrl } from '../config/api';

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  pendingOperations: number;
}

class SyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private networkListener: any = null;
  private syncStatusListeners: ((status: SyncStatus) => void)[] = [];

  // Initialize sync service
  async initialize(): Promise<void> {
    try {
      // Initialize database (with error handling)
      console.log('[SyncService] 🔄 Initializing database...');
      
      // Wait for database initialization with timeout
      const initPromise = Database.initialize();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database initialization timeout')), 10000)
      );
      
      try {
        await Promise.race([initPromise, timeoutPromise]);
      } catch (initError: any) {
        console.warn('[SyncService] Database initialization had issues:', initError?.message || initError);
        // Continue anyway - initialization might have partially succeeded
      }
      
      // Check if database is initialized
      const isInitialized = Database.isInitialized();
      console.log('[SyncService] Database initialization status:', isInitialized ? '✅ Success' : '❌ Failed');
      
      if (!isInitialized) {
        console.warn('[SyncService] ⚠️ Database not initialized, continuing without offline features');
        console.warn('[SyncService] 💡 App will work but offline features will be disabled');
        // Continue without database - app will work but without offline features
        return;
      }
      
      console.log('[SyncService] ✅ Database initialized successfully, setting up sync...');

      // Setup network listener
      this.setupNetworkListener();

      // Start periodic sync (every 30 seconds when online)
      this.startPeriodicSync();

      // Sync immediately if online and user is logged in
      const netInfo = await NetInfo.fetch();
      const authToken = await AsyncStorage.getItem('auth_token');
      if (netInfo.isConnected && authToken) {
        this.sync();
      } else {
        console.log('[SyncService] Skipping initial sync - user not logged in or offline');
      }
    } catch (error) {
      console.error('[SyncService] Error initializing sync service:', error);
      // Don't throw - allow app to continue without offline features
      console.warn('[SyncService] Continuing without offline sync. App will work but without offline features.');
    }
  }

  // Setup network status listener
  private setupNetworkListener(): void {
    this.networkListener = NetInfo.addEventListener(async (state) => {
      console.log('[SyncService] Network status:', state.isConnected);
      
      if (state.isConnected && !this.isSyncing) {
        // Network came back online, check if user is logged in before syncing
        const authToken = await AsyncStorage.getItem('auth_token');
        if (!authToken) {
          console.log('[SyncService] Network connected but user not logged in, skipping sync');
          return;
        }
        
        // Network came back online, sync immediately and update database
        console.log('[SyncService] Network connected, starting sync and database update...');
        
        // Ensure database is initialized before syncing
        if (!Database.isInitialized()) {
          console.log('[SyncService] Database not initialized, initializing now...');
          try {
            await Database.initialize();
          } catch (error) {
            console.error('[SyncService] Failed to initialize database:', error);
          }
        }
        
        // Sync and update database
        await this.sync();
      }

      await this.notifySyncStatus();
    });
  }

  // Start periodic sync
  private startPeriodicSync(): void {
    // Clear existing interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Sync every 30 seconds when online to keep database updated
    this.syncInterval = setInterval(async () => {
      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected && !this.isSyncing) {
        console.log('[SyncService] 🔄 Periodic sync triggered - updating database...');
        
        // Ensure database is initialized
        if (!Database.isInitialized()) {
          console.log('[SyncService] Database not initialized, initializing...');
          try {
            await Database.initialize();
          } catch (error) {
            console.error('[SyncService] Failed to initialize database:', error);
            return;
          }
        }
        
        // Sync and update database
        await this.sync();
      }
    }, 30000); // Every 30 seconds
  }

  // Get sync status
  async getSyncStatus(): Promise<SyncStatus> {
    const netInfo = await NetInfo.fetch();
    const pendingOps = await Database.getPendingSyncOperations();
    const lastSyncTime = await AsyncStorage.getItem('last_sync_time');
    
    return {
      isOnline: netInfo.isConnected || false,
      isSyncing: this.isSyncing,
      lastSyncTime: lastSyncTime ? parseInt(lastSyncTime) : null,
      pendingOperations: pendingOps.length,
    };
  }

  // Subscribe to sync status changes
  subscribeToSyncStatus(callback: (status: SyncStatus) => void): () => void {
    this.syncStatusListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.syncStatusListeners = this.syncStatusListeners.filter(
        (listener) => listener !== callback
      );
    };
  }

  // Notify sync status listeners
  private async notifySyncStatus(): Promise<void> {
    const status = await this.getSyncStatus();
    this.syncStatusListeners.forEach((listener) => listener(status));
  }

  // Main sync function
  async sync(): Promise<void> {
    if (this.isSyncing) {
      console.log('[SyncService] Sync already in progress, skipping...');
      return;
    }

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('[SyncService] No network connection, skipping sync');
      await this.notifySyncStatus();
      return;
    }

    // Check if user is logged in before syncing
    const authToken = await AsyncStorage.getItem('auth_token');
    if (!authToken) {
      console.log('[SyncService] User not logged in, skipping sync');
      await this.notifySyncStatus();
      return;
    }

    // Ensure database is initialized before syncing
    if (!Database.isInitialized()) {
      console.log('[SyncService] Database not initialized, initializing...');
      try {
        await Database.initialize();
        if (!Database.isInitialized()) {
          console.warn('[SyncService] Database initialization failed, cannot sync');
          return;
        }
      } catch (error) {
        console.error('[SyncService] Failed to initialize database:', error);
        return;
      }
    }

    this.isSyncing = true;
    console.log('[SyncService] Starting sync and database update...');

    try {
      // 1. Pull data from cloud (products, orders, etc.) and update database
      await this.pullDataFromCloud();

      // 2. Push pending operations to cloud
      await this.pushPendingOperations();

      // 3. Update last sync time
      await AsyncStorage.setItem('last_sync_time', Date.now().toString());

      console.log('[SyncService] ✅ Sync and database update completed successfully');
    } catch (error) {
      console.error('[SyncService] Sync error:', error);
    } finally {
      this.isSyncing = false;
      await this.notifySyncStatus();
    }
  }

  // Pull data from cloud
  private async pullDataFromCloud(): Promise<void> {
    try {
      // Ensure database is initialized
      if (!Database.isInitialized()) {
        console.log('[SyncService] Database not initialized, initializing...');
        await Database.initialize();
        
        if (!Database.isInitialized()) {
          console.warn('[SyncService] Database initialization failed, cannot update database');
          return;
        }
      }

      const storeId = await AsyncStorage.getItem('store_id');
      if (!storeId) {
        console.log('[SyncService] No store ID, skipping pull');
        return;
      }

      // Pull products
      console.log('[SyncService] Pulling products from cloud...');
      const products = await productsAPI.getProducts(storeId);
      if (products && Array.isArray(products)) {
        // Mark products with sync timestamp
        const now = Math.floor(Date.now() / 1000);
        const productsWithSync = products.map((p: any) => ({
          ...p,
          store_id: storeId,
          synced_at: now,
        }));
        
        // Save to local database
        await Database.saveProducts(productsWithSync);
        console.log(`[SyncService] ✅ Updated database with ${products.length} products`);
      }

      // Pull orders
      console.log('[SyncService] Pulling orders from cloud...');
      try {
        const ordersResponse = await ordersAPI.getByStore(storeId, { flat_list: false });
        if (ordersResponse && ordersResponse.orders && Array.isArray(ordersResponse.orders)) {
          for (const order of ordersResponse.orders) {
            await Database.saveOrder(order);
          }
          console.log(`[SyncService] ✅ Updated database with ${ordersResponse.orders.length} orders`);
        }
      } catch (orderError) {
        console.warn('[SyncService] Error pulling orders:', orderError);
        // Continue even if orders fail
      }

      console.log('[SyncService] ✅ Database update completed');
    } catch (error) {
      console.error('[SyncService] Error pulling data:', error);
      
      // Don't report 401 errors as they're expected when user is not logged in
      if (error?.response?.status === 401) {
        console.log('[SyncService] 401 error - user not authenticated, skipping pull');
        return;
      }
      
      // Report other errors
      try {
        const { errorReporter } = require('./errorReporter');
        errorReporter.reportError({
          error: error instanceof Error ? error : new Error(String(error)),
          errorType: 'network',
          severity: 'medium',
          context: { 
            stage: 'pullDataFromCloud',
            statusCode: error?.response?.status,
          },
        }).catch(() => {});
      } catch (reportError) {
        // Ignore error reporting failures
      }
      
      // Don't throw - allow push operations to continue
    }
  }

  // Push pending operations to cloud
  private async pushPendingOperations(): Promise<void> {
    // Only push if database is initialized
    if (!Database.isInitialized()) {
      console.log('[SyncService] Database not initialized, no pending operations to push');
      return;
    }

    let pendingOps: any[] = [];
    try {
      pendingOps = await Database.getPendingSyncOperations();
    } catch (error) {
      console.warn('[SyncService] Error getting pending operations:', error);
      return;
    }
    
    console.log(`[SyncService] Found ${pendingOps.length} pending operations`);

    for (const operation of pendingOps) {
      try {
        await this.executeSyncOperation(operation);
        
        // Remove from queue after successful sync
        await Database.removeSyncQueueItem(operation.id);
        console.log(`[SyncService] Successfully synced operation: ${operation.id}`);
      } catch (error: any) {
        console.error(`[SyncService] Error syncing operation ${operation.id}:`, error);
        
        // Increment retry count
        const retryCount = operation.retry_count + 1;
        
        // If retry count exceeds max (e.g., 5), mark as failed
        if (retryCount >= 5) {
          await Database.updateSyncQueueItem(operation.id, {
            status: 'failed',
            retryCount,
            errorMessage: error.message || 'Max retries exceeded',
          });
        } else {
          await Database.updateSyncQueueItem(operation.id, {
            retryCount,
            errorMessage: error.message || 'Sync failed',
          });
        }
      }
    }
  }

  // Execute a sync operation
  private async executeSyncOperation(operation: any): Promise<void> {
    const token = await AsyncStorage.getItem('auth_token');
    const baseURL = getApiBaseApiUrl();

    const config: any = {
      method: operation.method,
      url: `${baseURL}${operation.endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...(operation.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 10000,
    };

    if (operation.payload && ['POST', 'PUT', 'PATCH'].includes(operation.method)) {
      config.data = operation.payload;
    }

    try {
      const response = await axios(config);
      
      // Update local database if operation was successful
      if (operation.operationType === 'create_order' && response.data.order) {
        // Find and update the local order
        const storeId = operation.endpoint.split('/')[4]; // Extract from /inventory-orders/store/{storeId}
        const [orders] = await Database.executeSql(
          'SELECT * FROM inventory_orders WHERE store_id = ? AND synced = 0 ORDER BY created_at DESC LIMIT 1',
          [storeId]
        );
        
        if (orders.rows.length > 0) {
          const localOrder = orders.rows.item(0);
          await Database.executeSql(
            'UPDATE inventory_orders SET synced = 1, order_id = ?, id = ? WHERE id = ?',
            [response.data.order.order_id, response.data.order.id, localOrder.id]
          );
        }
      } else if (operation.operationType === 'create_product' && response.data.product) {
        // Update product sync status
        const productId = response.data.product.id;
        const now = Math.floor(Date.now() / 1000);
        await Database.executeSql(
          'UPDATE products SET synced_at = ?, id = ? WHERE id LIKE ?',
          [now, productId, `local-%`]
        );
      } else if (operation.operationType === 'update_product' && response.data.product) {
        // Update product sync status
        const productId = response.data.product.id;
        const now = Math.floor(Date.now() / 1000);
        await Database.executeSql(
          'UPDATE products SET synced_at = ? WHERE id = ?',
          [now, productId]
        );
      }
      
      return response.data;
    } catch (error: any) {
      console.error('[SyncService] Error executing sync operation:', error);
      throw error;
    }
  }

  // Add operation to sync queue (called when offline)
  async queueOperation(operation: {
    operationType: string;
    endpoint: string;
    method: string;
    payload?: any;
    headers?: any;
  }): Promise<string> {
    return await Database.addToSyncQueue(operation);
  }

  // Force sync now
  async forceSync(): Promise<void> {
    await this.sync();
  }

  // Cleanup
  cleanup(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.networkListener) {
      this.networkListener();
      this.networkListener = null;
    }

    this.syncStatusListeners = [];
  }
}

export default new SyncService();

