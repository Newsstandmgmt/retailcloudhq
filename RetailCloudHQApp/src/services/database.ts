// Import SQLite with error handling
let SQLite: any = null;
let SQLiteAvailable = false;

try {
  const sqliteModule = require('react-native-sqlite-storage');
  
  // Check if it's the default export or named export
  if (sqliteModule && sqliteModule.default) {
    SQLite = sqliteModule.default;
  } else if (sqliteModule) {
    SQLite = sqliteModule;
  }
  
  // Verify SQLite is actually available and has openDatabase
  if (SQLite && typeof SQLite.openDatabase === 'function') {
    // Don't enable promise - use callback API directly (more reliable)
    SQLiteAvailable = true;
    console.log('[Database] ✅ SQLite module loaded successfully, using callback API');
  } else {
    console.warn('[Database] ⚠️ SQLite.openDatabase is not a function');
    SQLite = null;
    SQLiteAvailable = false;
  }
} catch (error: any) {
  console.warn('[Database] ⚠️ SQLite module not available:', error?.message || 'Module not found');
  SQLite = null;
  SQLiteAvailable = false;
}

interface DatabaseResult {
  rows: {
    length: number;
    item: (index: number) => any;
    _array: any[];
  };
  rowsAffected: number;
  insertId?: number;
}

class Database {
  private db: SQLite.SQLiteDatabase | null = null;
  private dbName = 'RetailCloudHQ.db';
  private dbVersion = '1.0';
  private dbDisplayName = 'RetailCloudHQ Database';
  private dbSize = 200000;

  // Initialize database
  async initialize(): Promise<void> {
    // If already initialized, return
    if (this.db) {
      console.log('[Database] Database already initialized');
      return;
    }

    try {
      console.log('[Database] Opening database...');
      
      // Check if SQLite is available
      if (!SQLiteAvailable || !SQLite) {
        throw new Error('SQLite module not available - native module may not be linked. Rebuild app with: npx react-native run-android');
      }

      if (typeof SQLite.openDatabase !== 'function') {
        throw new Error('SQLite.openDatabase is not a function - module may not be properly initialized');
      }

      console.log('[Database] SQLite module available, opening database...');

      // Open database with error handling
      // Try 'default' location first, fallback to 'Documents' if needed
      let db: any = null;
      let lastError: any = null;
      
      // Helper function to open database - simplified approach
      const openDatabasePromise = (location: string): Promise<any> => {
        return new Promise((resolve, reject) => {
          // Check if SQLite is actually available
          if (!SQLite || typeof SQLite.openDatabase !== 'function') {
            reject(new Error('SQLite.openDatabase is not available'));
            return;
          }

          const dbConfig = {
            name: this.dbName,
            location: location,
            version: this.dbVersion,
            displayName: this.dbDisplayName,
            size: this.dbSize,
          };
          
          console.log(`[Database] Opening database with location: ${location}`);
          
          // Use callback-based API (more reliable in React Native)
          try {
            const successCallback = (db: any) => {
              if (db && db !== null && db !== undefined) {
                console.log(`[Database] ✅ Database opened successfully with ${location} location`);
                resolve(db);
              } else {
                reject(new Error(`openDatabase callback returned null/undefined for ${location}`));
              }
            };
            
            const errorCallback = (error: any) => {
              const errorMsg = error?.message || String(error) || 'Unknown error';
              reject(new Error(`Failed to open database with ${location}: ${errorMsg}`));
            };
            
            // Use callback API directly (more reliable)
            SQLite.openDatabase(
              dbConfig.name,
              dbConfig.version,
              dbConfig.displayName,
              dbConfig.size,
              successCallback,
              errorCallback
            );
          } catch (err: any) {
            reject(new Error(`Exception opening database: ${err?.message || String(err)}`));
          }
        });
      };
      
      // Try default location first with timeout
      try {
        console.log('[Database] Attempting to open database with location: default');
        db = await Promise.race([
          openDatabasePromise('default'),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database open timeout (5s)')), 5000)
          )
        ]) as any;
      } catch (error: any) {
        console.warn('[Database] Failed to open with default location:', error?.message || error);
        lastError = error;
        
        // Try Documents location as fallback with timeout
        try {
          console.log('[Database] Attempting to open database with location: Documents');
          db = await Promise.race([
            openDatabasePromise('Documents'),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Database open timeout (5s)')), 5000)
            )
          ]) as any;
        } catch (error2: any) {
          console.error('[Database] Failed to open with Documents location:', error2?.message || error2);
          lastError = error2;
          throw new Error(`Failed to open database. SQLite native module may not be linked. Please rebuild the app: npx react-native run-android`);
        }
      }

      if (!db || db === null || db === undefined) {
        throw new Error('Failed to open database: openDatabase returned null or undefined after all attempts');
      }

      this.db = db;
      console.log('[Database] ✅ Database opened successfully');

      // Create tables
      await this.createTables();
      console.log('[Database] ✅ Database initialized successfully');
    } catch (error: any) {
      // Safely extract error information
      let errorMessage = 'Unknown error';
      let errorStack = 'No stack trace';
      let errorName = 'Unknown';
      
      try {
        if (error) {
          errorMessage = error.message || String(error) || 'Unknown error';
          errorStack = error.stack || 'No stack trace';
          errorName = error.name || 'Unknown';
        }
      } catch (extractError) {
        // If we can't extract error details, use defaults
        errorMessage = 'Error extracting error details';
      }
      
      console.error('[Database] ❌ Error initializing database:', errorMessage);
      console.error('[Database] Error details:', {
        message: errorMessage,
        stack: errorStack,
        name: errorName,
        type: typeof error,
      });
      
      // Log the error object separately if it's safe to do so
      if (error && typeof error === 'object') {
        try {
          // Try to stringify to check for circular references
          JSON.stringify(error);
          console.error('[Database] Full error object:', error);
        } catch (stringifyError) {
          // Circular reference or non-serializable, just log the message
          console.error('[Database] Error object contains circular references or is not serializable');
        }
      }
      
      // Reset db to null on error
      this.db = null;
      
      // Don't throw - allow app to continue with fallback behavior
      // The app can work without offline database, just won't have offline features
      console.warn('[Database] ⚠️ Continuing without offline database. Some features may be limited.');
      console.warn('[Database] 💡 To fix SQLite:');
      console.warn('[Database]   1. Rebuild app: npx react-native run-android');
      console.warn('[Database]   2. Check native module linking');
      console.warn('[Database]   3. Verify SQLite package is installed');
      
      // Return without throwing to allow app to continue
      return;
    }
  }

  // Create all tables
  private async createTables(): Promise<void> {
    if (!this.db) {
      console.warn('[Database] Cannot create tables: database not initialized');
      return;
    }

    try {
      // Products table
    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        store_id TEXT,
        product_id TEXT,
        product_name TEXT NOT NULL,
        variant TEXT,
        full_product_name TEXT,
        category TEXT,
        brand TEXT,
        supplier TEXT,
        upc TEXT,
        cost_price REAL,
        sell_price_per_piece REAL,
        quantity_per_pack INTEGER,
        cost_per_unit REAL,
        profit_per_unit REAL,
        profit_margin REAL,
        variants_enabled INTEGER DEFAULT 0,
        variants TEXT,
        is_active INTEGER DEFAULT 1,
        synced_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Inventory Orders table
    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS inventory_orders (
        id TEXT PRIMARY KEY,
        order_id TEXT UNIQUE,
        store_id TEXT NOT NULL,
        submitted_by TEXT,
        submitted_by_name TEXT,
        notes TEXT,
        status TEXT DEFAULT 'pending',
        synced INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Inventory Order Items table
    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS inventory_order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT,
        variant TEXT,
        supplier TEXT,
        upc TEXT,
        quantity INTEGER NOT NULL,
        quantity_delivered INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        synced INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (order_id) REFERENCES inventory_orders(id) ON DELETE CASCADE
      )
    `);

    // Sync Queue table (for offline operations)
    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        operation_type TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        payload TEXT,
        headers TEXT,
        retry_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        error_message TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Create indexes
    await this.db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
      CREATE INDEX IF NOT EXISTS idx_products_synced ON products(synced_at);
      CREATE INDEX IF NOT EXISTS idx_orders_store ON inventory_orders(store_id);
      CREATE INDEX IF NOT EXISTS idx_orders_synced ON inventory_orders(synced);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    `);

      console.log('[Database] Tables created successfully');
    } catch (error: any) {
      console.error('[Database] Error creating tables:', error);
      throw error; // Re-throw to be caught by initialize()
    }
  }

  // Get database instance
  getDatabase(): SQLite.SQLiteDatabase | null {
    return this.db;
  }

  // Check if database is initialized
  isInitialized(): boolean {
    return this.db !== null;
  }

  // Close database
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      console.log('[Database] Database closed');
    }
  }

  // Execute SQL query
  async executeSql(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.db) {
      throw new Error('Database not initialized. Please wait for database to initialize.');
    }
    try {
      const result = await this.db.executeSql(sql, params);
      // Ensure we always return an array
      if (Array.isArray(result)) {
        return result;
      }
      // If result is not an array, wrap it
      return [result];
    } catch (error) {
      console.error('[Database] SQL Error:', error, 'SQL:', sql);
      throw error;
    }
  }

  // Get all products for a store
  async getProducts(storeId: string): Promise<any[]> {
    if (!this.isInitialized()) {
      console.warn('[Database] Database not initialized, returning empty array');
      return [];
    }
    
    try {
      const resultsArray = await this.executeSql(
        'SELECT * FROM products WHERE store_id = ? AND is_active = 1 ORDER BY created_at DESC',
        [storeId]
      );
      
      // Safely extract results - handle both array and object returns
      const results = Array.isArray(resultsArray) ? resultsArray[0] : resultsArray;
      
      // If results is null/undefined or not an object, return empty array
      if (!results || typeof results !== 'object') {
        return [];
      }
      
      const products = [];
      
      // Safely check if results and results.rows exist
      if (results.rows && typeof results.rows.length === 'number') {
        for (let i = 0; i < results.rows.length; i++) {
          try {
            const row = results.rows.item(i);
            if (row) {
              products.push({
                ...row,
                variants_enabled: row.variants_enabled === 1,
                variants: row.variants ? JSON.parse(row.variants) : null,
              });
            }
          } catch (rowError) {
            console.warn(`[Database] Error processing product row ${i}:`, rowError);
            // Continue with next row
          }
        }
      }
      
      return products;
    } catch (error) {
      console.error('[Database] Error getting products:', error);
      return [];
    }
  }

    // Save product locally
  async saveProduct(product: any): Promise<void> {
    if (!this.isInitialized()) {
      console.warn('[Database] Database not initialized, cannot save product');
      return;
    }
    
    try {
      const now = Math.floor(Date.now() / 1000);
      await this.executeSql(
        `INSERT OR REPLACE INTO products (
          id, store_id, product_id, product_name, variant, full_product_name,
          category, brand, supplier, upc, cost_price, sell_price_per_piece,
          quantity_per_pack, cost_per_unit, profit_per_unit, profit_margin,
          variants_enabled, variants, is_active, synced_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product.id,
          product.store_id || null,
          product.product_id,
          product.product_name,
          product.variant || null,
          product.full_product_name,
          product.category || null,
          product.brand || null,
          product.supplier || null,
          product.upc || null,
          product.cost_price || 0,
          product.sell_price_per_piece || 0,
          product.quantity_per_pack || 1,
          product.cost_per_unit || 0,
          product.profit_per_unit || 0,
          product.profit_margin || 0,
          product.variants_enabled ? 1 : 0,
          product.variants ? JSON.stringify(product.variants) : null,
          product.is_active !== false ? 1 : 0,
          product.synced_at || null,
          now,
        ]
      );
    } catch (error) {
      console.error('[Database] Error saving product:', error);
      throw error;
    }
  }

  // Save multiple products
  async saveProducts(products: any[]): Promise<void> {
    for (const product of products) {
      await this.saveProduct(product);
    }
  }

  // Get pending sync operations
  async getPendingSyncOperations(): Promise<any[]> {
    if (!this.isInitialized()) {
      console.warn('[Database] Database not initialized, returning empty array for pending sync operations');
      return [];
    }

    try {
      const resultsArray = await this.executeSql(
        'SELECT * FROM sync_queue WHERE status = ? ORDER BY created_at ASC',
        ['pending']
      );
      
      // Safely extract results - handle both array and object returns
      const results = Array.isArray(resultsArray) ? resultsArray[0] : resultsArray;
      
      // If results is null/undefined or not an object, return empty array
      if (!results || typeof results !== 'object') {
        return [];
      }
      
      const operations = [];
      
      // Safely check if results and results.rows exist
      if (results.rows && typeof results.rows.length === 'number') {
        for (let i = 0; i < results.rows.length; i++) {
          try {
            const row = results.rows.item(i);
            if (row) {
              operations.push({
                ...row,
                payload: row.payload ? JSON.parse(row.payload) : null,
                headers: row.headers ? JSON.parse(row.headers) : null,
              });
            }
          } catch (rowError) {
            console.warn(`[Database] Error processing sync queue row ${i}:`, rowError);
            // Continue with next row
          }
        }
      }
      
      return operations;
    } catch (error) {
      console.error('[Database] Error getting pending sync operations:', error);
      
      // Report error
      try {
        const { errorReporter } = require('./errorReporter');
        errorReporter.reportError({
          error: error instanceof Error ? error : new Error(String(error)),
          errorType: 'database',
          severity: 'medium',
          context: { method: 'getPendingSyncOperations' },
        }).catch(() => {});
      } catch (reportError) {
        // Ignore error reporting failures
      }
      
      // Return empty array instead of throwing - allow app to continue
      return [];
    }
  }

  // Add operation to sync queue
  async addToSyncQueue(operation: {
    operationType: string;
    endpoint: string;
    method: string;
    payload?: any;
    headers?: any;
  }): Promise<string> {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await this.executeSql(
      `INSERT INTO sync_queue (id, operation_type, endpoint, method, payload, headers, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        operation.operationType,
        operation.endpoint,
        operation.method,
        operation.payload ? JSON.stringify(operation.payload) : null,
        operation.headers ? JSON.stringify(operation.headers) : null,
        'pending',
      ]
    );
    return id;
  }

  // Update sync queue item
  async updateSyncQueueItem(id: string, updates: {
    status?: string;
    retryCount?: number;
    errorMessage?: string;
  }): Promise<void> {
    const setClause = [];
    const params: any[] = [];

    if (updates.status !== undefined) {
      setClause.push('status = ?');
      params.push(updates.status);
    }
    if (updates.retryCount !== undefined) {
      setClause.push('retry_count = ?');
      params.push(updates.retryCount);
    }
    if (updates.errorMessage !== undefined) {
      setClause.push('error_message = ?');
      params.push(updates.errorMessage);
    }

    setClause.push('updated_at = ?');
    params.push(Math.floor(Date.now() / 1000));
    params.push(id);

    await this.executeSql(
      `UPDATE sync_queue SET ${setClause.join(', ')} WHERE id = ?`,
      params
    );
  }

  // Remove sync queue item
  async removeSyncQueueItem(id: string): Promise<void> {
    await this.executeSql('DELETE FROM sync_queue WHERE id = ?', [id]);
  }

  // Save order locally
  async saveOrder(order: any): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.executeSql(
      `INSERT OR REPLACE INTO inventory_orders (
        id, order_id, store_id, submitted_by, submitted_by_name,
        notes, status, synced, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order.id,
        order.order_id,
        order.store_id,
        order.submitted_by,
        order.submitted_by_name,
        order.notes || null,
        order.status || 'pending',
        order.synced ? 1 : 0,
        order.created_at || now,
        now,
      ]
    );

    // Save order items
    if (order.items && Array.isArray(order.items)) {
      for (const item of order.items) {
        await this.executeSql(
          `INSERT OR REPLACE INTO inventory_order_items (
            id, order_id, product_id, product_name, variant,
            supplier, upc, quantity, quantity_delivered, status, synced, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            order.id,
            item.product_id,
            item.product_name,
            item.variant || null,
            item.supplier || null,
            item.upc || null,
            item.quantity,
            item.quantity_delivered || 0,
            item.status || 'pending',
            item.synced ? 1 : 0,
            item.created_at || now,
            now,
          ]
        );
      }
    }
  }

  // Get orders for a store
  async getOrders(storeId: string): Promise<any[]> {
    if (!this.isInitialized()) {
      console.warn('[Database] Database not initialized, returning empty array for orders');
      return [];
    }

    try {
      const resultsArray = await this.executeSql(
        'SELECT * FROM inventory_orders WHERE store_id = ? ORDER BY created_at DESC',
        [storeId]
      );
      
      // Safely extract results - handle both array and object returns
      const results = Array.isArray(resultsArray) ? resultsArray[0] : resultsArray;
      
      // If results is null/undefined or not an object, return empty array
      if (!results || typeof results !== 'object') {
        return [];
      }
      
      const orders = [];
      
      // Safely check if results and results.rows exist
      if (results.rows && typeof results.rows.length === 'number') {
        for (let i = 0; i < results.rows.length; i++) {
          try {
            const order = results.rows.item(i);
            if (!order) continue;
            
            // Get order items
            const itemResultsArray = await this.executeSql(
              'SELECT * FROM inventory_order_items WHERE order_id = ?',
              [order.id]
            );
            
            // Safely extract itemResults
            const itemResults = Array.isArray(itemResultsArray) ? itemResultsArray[0] : itemResultsArray;
            const items = [];
            
            // Safely check itemResults
            if (itemResults && itemResults.rows && typeof itemResults.rows.length === 'number') {
              for (let j = 0; j < itemResults.rows.length; j++) {
                try {
                  const item = itemResults.rows.item(j);
                  if (item) {
                    items.push(item);
                  }
                } catch (itemError) {
                  console.warn(`[Database] Error processing order item ${j}:`, itemError);
                  // Continue with next item
                }
              }
            }
            
            orders.push({
              ...order,
              synced: order.synced === 1,
              items,
            });
          } catch (orderError) {
            console.warn(`[Database] Error processing order row ${i}:`, orderError);
            // Continue with next order
          }
        }
      }
      
      return orders;
    } catch (error) {
      console.error('[Database] Error getting orders:', error);
      return [];
    }
  }
}

export default new Database();

