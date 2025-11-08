/**
 * Error Reporting Service
 * Captures and sends errors to the backend for logging and monitoring
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';

const API_BASE_URL = __DEV__ 
  ? 'http://10.1.10.120:3000' // Update this to your actual IP address
  : 'https://your-production-url.com';

interface ErrorReport {
  timestamp: string;
  platform: 'android' | 'ios';
  appVersion: string;
  deviceId: string;
  deviceModel: string;
  osVersion: string;
  errorType: 'javascript' | 'react' | 'network' | 'database' | 'other';
  errorMessage: string;
  errorStack?: string;
  componentStack?: string;
  userAgent?: string;
  url?: string;
  userId?: string;
  storeId?: string;
  context?: any; // Additional context about the error
  severity: 'low' | 'medium' | 'high' | 'critical';
}

class ErrorReporter {
  private isInitialized = false;
  private errorQueue: ErrorReport[] = [];
  private maxQueueSize = 50;
  private flushInterval: NodeJS.Timeout | null = null;

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      this.isInitialized = true;
      
      // Set up global error handlers
      this.setupGlobalErrorHandlers();
      
      // Flush queued errors periodically
      this.flushInterval = setInterval(() => {
        this.flushQueue().catch((error) => {
          console.warn('[ErrorReporter] Error flushing queue:', error);
        });
      }, 30000); // Every 30 seconds
      
      // Try to flush any queued errors from previous session
      this.flushQueue().catch((error) => {
        console.warn('[ErrorReporter] Error flushing initial queue:', error);
      });
      
      console.log('[ErrorReporter] ✅ Error reporting initialized');
    } catch (error) {
      console.error('[ErrorReporter] Failed to initialize:', error);
      // Don't throw - allow app to continue even if error reporting fails
      this.isInitialized = false;
    }
  }

  private setupGlobalErrorHandlers() {
    // Handle unhandled promise rejections
    const originalHandler = global.ErrorUtils?.getGlobalHandler?.();
    
    if (global.ErrorUtils) {
      global.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        console.error('[ErrorReporter] Unhandled error:', error);
        
        this.reportError({
          error,
          errorType: 'javascript',
          severity: isFatal ? 'critical' : 'high',
          context: { isFatal },
        }).catch(console.error);
        
        // Call original handler if it exists
        if (originalHandler) {
          originalHandler(error, isFatal);
        }
      });
    }

    // Handle console errors - but skip non-critical logs
    const originalError = console.error;
    console.error = (...args: any[]) => {
      // Call original
      originalError.apply(console, args);
      
      // Skip error reporting for known non-critical errors
      const errorString = args.map(a => String(a)).join(' ');
      const skipPatterns = [
        'non-critical',
        'Pending check failed',
        'ErrorReporter',
        'Error getting device info',
        'Failed to get device ID',
        'Pending orders check failed'
      ];
      
      if (skipPatterns.some(pattern => errorString.includes(pattern))) {
        return; // Don't report these errors
      }
      
      // Capture error if it looks like an error object
      const errorArg = args.find(arg => arg instanceof Error || (typeof arg === 'object' && arg?.stack));
      if (errorArg) {
        this.reportError({
          error: errorArg instanceof Error ? errorArg : new Error(String(errorArg)),
          errorType: 'javascript',
          severity: 'medium',
          context: { consoleArgs: args },
        }).catch(() => {
          // Silently fail - don't create error loops
        });
      }
    };
  }

  async reportError({
    error,
    errorType = 'javascript',
    severity = 'medium',
    context = {},
    componentStack,
  }: {
    error: Error | string;
    errorType?: ErrorReport['errorType'];
    severity?: ErrorReport['severity'];
    context?: any;
    componentStack?: string;
  }) {
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Get device info - handle all failures gracefully
      let deviceId, deviceModel, osVersion, appVersion, userId, storeId;
      
      try {
        [deviceId, deviceModel, osVersion, appVersion, userId, storeId] = await Promise.all([
          this.getDeviceId().catch(() => 'unknown-device'),
          DeviceInfo.getModel().catch(() => 'Unknown'),
          DeviceInfo.getSystemVersion().catch(() => 'Unknown'),
          DeviceInfo.getVersion().catch(() => 'Unknown'),
          AsyncStorage.getItem('user_id').catch(() => null),
          AsyncStorage.getItem('store_id').catch(() => null),
        ]);
      } catch (deviceInfoError: any) {
        // Don't log here to avoid error loops - just use fallback values
        // The individual .catch() handlers above already handle errors
        deviceId = deviceId || 'unknown-device';
        deviceModel = deviceModel || 'Unknown';
        osVersion = osVersion || 'Unknown';
        appVersion = appVersion || 'Unknown';
        userId = userId || null;
        storeId = storeId || null;
      }

      // Safely get platform
      let platform: 'android' | 'ios' = 'android';
      try {
        // DeviceInfo.getSystemName() may be sync or async depending on version
        // Try sync first, then async
        let systemName: string = 'Android';
        try {
          if (typeof DeviceInfo.getSystemName === 'function') {
            const result = DeviceInfo.getSystemName();
            if (result instanceof Promise) {
              systemName = await result;
            } else {
              systemName = result;
            }
          }
        } catch (syncError) {
          // If sync call fails, try as async
          try {
            systemName = await (DeviceInfo.getSystemName as any)();
          } catch (asyncError) {
            systemName = 'Android'; // Default fallback
          }
        }
        platform = systemName?.toLowerCase().includes('ios') ? 'ios' : 'android';
      } catch (platformError) {
        // Default to android if we can't determine
        platform = 'android';
      }

      const errorReport: ErrorReport = {
        timestamp: new Date().toISOString(),
        platform,
        appVersion: appVersion || 'Unknown',
        deviceId: deviceId || 'Unknown',
        deviceModel: deviceModel || 'Unknown',
        osVersion: osVersion || 'Unknown',
        errorType,
        errorMessage,
        errorStack,
        componentStack,
        userId: userId || undefined,
        storeId: storeId || undefined,
        context: this.sanitizeContext(context),
        severity,
      };

      // Try to send immediately, but queue if it fails
      try {
        await this.sendErrorReport(errorReport);
      } catch (sendError) {
        console.warn('[ErrorReporter] Failed to send error report, queuing:', sendError);
        this.queueErrorReport(errorReport);
      }
    } catch (reportError) {
      console.error('[ErrorReporter] Error while reporting error:', reportError);
      // Don't throw - error reporting should never break the app
    }
  }

  private async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) {
        try {
          deviceId = await DeviceInfo.getUniqueId();
          if (deviceId) {
            await AsyncStorage.setItem('device_id', deviceId);
          }
        } catch (deviceInfoError) {
          console.warn('[ErrorReporter] Failed to get device ID from DeviceInfo:', deviceInfoError);
          // Generate a temporary device ID
          deviceId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          await AsyncStorage.setItem('device_id', deviceId);
        }
      }
      return deviceId || 'unknown-device';
    } catch (error) {
      console.warn('[ErrorReporter] Error getting device ID:', error);
      return `unknown-device-${Date.now()}`;
    }
  }

  private sanitizeContext(context: any): any {
    try {
      // Remove circular references and limit depth
      const seen = new WeakSet();
      const sanitize = (obj: any, depth = 0): any => {
        if (depth > 3) return '[Max Depth]';
        if (obj === null || obj === undefined) return obj;
        if (typeof obj !== 'object') return obj;
        if (seen.has(obj)) return '[Circular]';
        
        seen.add(obj);
        
        if (Array.isArray(obj)) {
          return obj.slice(0, 10).map(item => sanitize(item, depth + 1));
        }
        
        const sanitized: any = {};
        let count = 0;
        for (const key in obj) {
          if (count++ > 20) {
            sanitized['...'] = '[Truncated]';
            break;
          }
          sanitized[key] = sanitize(obj[key], depth + 1);
        }
        
        seen.delete(obj);
        return sanitized;
      };
      
      return sanitize(context);
    } catch (error) {
      return { error: 'Failed to sanitize context' };
    }
  }

  private queueErrorReport(errorReport: ErrorReport) {
    this.errorQueue.push(errorReport);
    
    // Limit queue size
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift(); // Remove oldest
    }
    
    // Store in AsyncStorage as backup
    AsyncStorage.setItem('error_queue', JSON.stringify(this.errorQueue)).catch(console.error);
  }

  private async flushQueue() {
    if (this.errorQueue.length === 0) {
      // Try to load from AsyncStorage
      try {
        const stored = await AsyncStorage.getItem('error_queue');
        if (stored) {
          this.errorQueue = JSON.parse(stored);
          await AsyncStorage.removeItem('error_queue');
        }
      } catch (error) {
        console.warn('[ErrorReporter] Error loading queued errors:', error);
      }
    }

    if (this.errorQueue.length === 0) return;

    const errorsToSend = [...this.errorQueue];
    this.errorQueue = [];

    for (const errorReport of errorsToSend) {
      try {
        await this.sendErrorReport(errorReport);
      } catch (error) {
        // Re-queue if send fails
        this.queueErrorReport(errorReport);
        break; // Stop on first failure to avoid spam
      }
    }
  }

  private async sendErrorReport(errorReport: ErrorReport) {
    try {
      await axios.post(`${API_BASE_URL}/api/errors/report`, errorReport, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('[ErrorReporter] ✅ Error report sent:', errorReport.errorMessage.substring(0, 50));
    } catch (error: any) {
      // Don't throw - just log and queue
      console.warn('[ErrorReporter] Failed to send error report:', error?.message);
      throw error; // Re-throw to trigger queueing
    }
  }

  // React Error Boundary helper
  captureReactError(error: Error, errorInfo: { componentStack?: string }) {
    this.reportError({
      error,
      errorType: 'react',
      severity: 'high',
      componentStack: errorInfo.componentStack,
      context: { errorInfo },
    }).catch(console.error);
  }

  cleanup() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
}

export const errorReporter = new ErrorReporter();
export default errorReporter;
