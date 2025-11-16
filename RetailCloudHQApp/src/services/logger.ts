export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export type LogEntry = {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, any>;
};

// Lightweight event emitter compatible with React Native (no 'events' dependency)
class TinyEmitter {
  private listeners: Array<(entry: LogEntry) => void> = [];
  on(_event: 'log', cb: (entry: LogEntry) => void) {
    this.listeners.push(cb);
  }
  off(_event: 'log', cb: (entry: LogEntry) => void) {
    this.listeners = this.listeners.filter(l => l !== cb);
  }
  emit(_event: 'log', entry: LogEntry) {
    for (const l of this.listeners) {
      try { l(entry); } catch {}
    }
  }
}

class InAppLogger {
  private emitter = new TinyEmitter();
  private buffer: LogEntry[] = [];
  private max = 500;
  private queue: LogEntry[] = [];
  private flushing = false;

  subscribe(listener: (entry: LogEntry) => void) {
    this.emitter.on('log', listener);
    return () => this.emitter.off('log', listener);
  }

  getBuffer(): LogEntry[] {
    return this.buffer.slice(-this.max);
  }

  log(level: LogLevel, message: string, context?: Record<string, any>) {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      level,
      message,
      timestamp: Date.now(),
      context,
    };
    this.buffer.push(entry);
    if (this.buffer.length > this.max) {
      this.buffer.splice(0, this.buffer.length - this.max);
    }
    this.emitter.emit('log', entry);
    // enqueue for backend
    this.queue.push(entry);
    if (this.queue.length >= 25) {
      this.flushSoon();
    } else {
      // debounce flush
      this.flushSoon(1500);
    }
  }

  info(msg: string, ctx?: Record<string, any>) { this.log('info', msg, ctx); }
  warn(msg: string, ctx?: Record<string, any>) { this.log('warn', msg, ctx); }
  error(msg: string, ctx?: Record<string, any>) { this.log('error', msg, ctx); }
  debug(msg: string, ctx?: Record<string, any>) { this.log('debug', msg, ctx); }

  private flushTimer?: any;
  private flushSoon(delay = 0) {
    if (this.flushing) return;
    clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush().catch(() => {}), delay);
  }

  private async flush() {
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;
    try {
      const batch = this.queue.splice(0, Math.min(this.queue.length, 50));
      // import inline to avoid circular deps
      const { default: axios } = await import('axios');
      const { getApiBaseUrl } = await import('../config/api');
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      const deviceId = await AsyncStorage.getItem('device_id');
      const token = await AsyncStorage.getItem('auth_token');
      await axios.post(`${getApiBaseUrl()}/api/mobile-logs`, {
        device_id: deviceId,
        entries: batch
      }, {
        timeout: 5000,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      }).catch(() => {});
    } finally {
      this.flushing = false;
    }
  }
}

export const logger = new InAppLogger();

// Optional: mirror console to logger without breaking dev tools
const original = { log: console.log, warn: console.warn, error: console.error, debug: console.debug };
console.log = (...args: any[]) => { logger.info(args.map(String).join(' ')); original.log.apply(console, args as any); };
console.warn = (...args: any[]) => { logger.warn(args.map(String).join(' ')); original.warn.apply(console, args as any); };
console.error = (...args: any[]) => { logger.error(args.map(String).join(' ')); original.error.apply(console, args as any); };
console.debug = (...args: any[]) => { logger.debug(args.map(String).join(' ')); original.debug.apply(console, args as any); };

export default logger;


