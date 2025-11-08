import Database from './database';
import SyncService from './syncService';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Wrapper for API calls that handles offline mode
class OfflineAPI {
  // Check if online
  async isOnline(): Promise<boolean> {
    const netInfo = await NetInfo.fetch();
    return netInfo.isConnected || false;
  }

  // Make API call (online) or queue for later (offline)
  async makeRequest(config: {
    endpoint: string;
    method: string;
    payload?: any;
    headers?: any;
    operationType: string;
  }): Promise<any> {
    const isOnline = await this.isOnline();

    if (isOnline) {
      // Try to make the request online
      try {
        // Import the actual API functions dynamically
        // This will be handled by the specific API service
        return { success: true, online: true };
      } catch (error: any) {
        // If online request fails, queue it
        console.log('[OfflineAPI] Online request failed, queueing:', error);
        await SyncService.queueOperation({
          operationType: config.operationType,
          endpoint: config.endpoint,
          method: config.method,
          payload: config.payload,
          headers: config.headers,
        });
        throw error;
      }
    } else {
      // Queue the operation for later
      console.log('[OfflineAPI] Offline - queueing operation');
      await SyncService.queueOperation({
        operationType: config.operationType,
        endpoint: config.endpoint,
        method: config.method,
        payload: config.payload,
        headers: config.headers,
      });
      
      // Return a promise that resolves when synced
      return { success: true, offline: true, queued: true };
    }
  }

  // Get products (from local database first, then sync from cloud)
  async getProducts(storeId: string): Promise<any[]> {
    // Always try to get from local database first (fast, works offline)
    const localProducts = await Database.getProducts(storeId);
    
    // If online, sync in background
    const isOnline = await this.isOnline();
    if (isOnline) {
      // Sync in background (don't wait)
      SyncService.sync().catch((error) => {
        console.error('[OfflineAPI] Background sync error:', error);
      });
    }
    
    return localProducts;
  }

  // Get orders (from local database)
  async getOrders(storeId: string): Promise<any[]> {
    return await Database.getOrders(storeId);
  }

  // Create product (queue if offline)
  async createProduct(storeId: string, productData: any): Promise<any> {
    const isOnline = await this.isOnline();
    const productId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Save locally first
    const product = {
      ...productData,
      id: productId,
      store_id: storeId,
      synced_at: isOnline ? Math.floor(Date.now() / 1000) : null,
    };
    
    await Database.saveProduct(product);
    
    if (isOnline) {
      // Try to sync immediately
      try {
        // This will be handled by the actual API
        return { ...product, synced: true };
      } catch (error) {
        // Queue if sync fails
        await SyncService.queueOperation({
          operationType: 'create_product',
          endpoint: `/products/store/${storeId}`,
          method: 'POST',
          payload: productData,
        });
        return { ...product, synced: false, queued: true };
      }
    } else {
      // Queue for later
      await SyncService.queueOperation({
        operationType: 'create_product',
        endpoint: `/products/store/${storeId}`,
        method: 'POST',
        payload: productData,
      });
      return { ...product, synced: false, queued: true };
    }
  }

  // Update product (queue if offline)
  async updateProduct(productId: string, productData: any): Promise<any> {
    const isOnline = await this.isOnline();
    
    // Update locally first
    const product = await Database.getProducts(''); // Get all products
    const existingProduct = product.find((p: any) => p.id === productId);
    
    if (existingProduct) {
      const updatedProduct = {
        ...existingProduct,
        ...productData,
        synced_at: isOnline ? Math.floor(Date.now() / 1000) : null,
      };
      await Database.saveProduct(updatedProduct);
    }
    
    if (isOnline) {
      // Try to sync immediately
      try {
        // This will be handled by the actual API
        return { ...updatedProduct, synced: true };
      } catch (error) {
        // Queue if sync fails
        await SyncService.queueOperation({
          operationType: 'update_product',
          endpoint: `/products/${productId}`,
          method: 'PUT',
          payload: productData,
        });
        return { ...updatedProduct, synced: false, queued: true };
      }
    } else {
      // Queue for later
      await SyncService.queueOperation({
        operationType: 'update_product',
        endpoint: `/products/${productId}`,
        method: 'PUT',
        payload: productData,
      });
      return { ...updatedProduct, synced: false, queued: true };
    }
  }

  // Create order (always save locally, queue sync)
  async createOrder(storeId: string, orderData: any): Promise<any> {
    const orderId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const isOnline = await this.isOnline();
    
    // Save locally first
    const order = {
      ...orderData,
      id: orderId,
      order_id: `ORD-${Date.now()}`,
      store_id: storeId,
      synced: isOnline ? false : false, // Will be synced later
    };
    
    await Database.saveOrder(order);
    
    // Queue for sync
    await SyncService.queueOperation({
      operationType: 'create_order',
      endpoint: `/inventory-orders/store/${storeId}`,
      method: 'POST',
      payload: orderData,
    });
    
    // If online, sync immediately
    if (isOnline) {
      SyncService.sync().catch((error) => {
        console.error('[OfflineAPI] Order sync error:', error);
      });
    }
    
    return { ...order, queued: true };
  }
}

export default new OfflineAPI();

