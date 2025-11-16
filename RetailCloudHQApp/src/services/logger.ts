import { EventEmitter } from 'events';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export type LogEntry = {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, any>;
};

class InAppLogger {
  private emitter = new EventEmitter();
  private buffer: LogEntry[] = [];
  private max = 500;

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
  }

  info(msg: string, ctx?: Record<string, any>) { this.log('info', msg, ctx); }
  warn(msg: string, ctx?: Record<string, any>) { this.log('warn', msg, ctx); }
  error(msg: string, ctx?: Record<string, any>) { this.log('error', msg, ctx); }
  debug(msg: string, ctx?: Record<string, any>) { this.log('debug', msg, ctx); }
}

export const logger = new InAppLogger();

// Optional: mirror console to logger without breaking dev tools
const original = { log: console.log, warn: console.warn, error: console.error, debug: console.debug };
console.log = (...args: any[]) => { logger.info(args.map(String).join(' ')); original.log.apply(console, args as any); };
console.warn = (...args: any[]) => { logger.warn(args.map(String).join(' ')); original.warn.apply(console, args as any); };
console.error = (...args: any[]) => { logger.error(args.map(String).join(' ')); original.error.apply(console, args as any); };
console.debug = (...args: any[]) => { logger.debug(args.map(String).join(' ')); original.debug.apply(console, args as any); };

export default logger;


