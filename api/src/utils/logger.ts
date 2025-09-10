export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel;
  private nodeEnv: string;

  constructor() {
    this.nodeEnv = process.env.NODE_ENV || 'development';
    this.level = this.getLogLevel(process.env.LOG_LEVEL || 'info');
  }

  private getLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug': return LogLevel.DEBUG;
      case 'info': return LogLevel.INFO;
      case 'warn': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${metaStr}`;
  }

  private log(level: LogLevel, levelName: string, message: string, meta?: any): void {
    if (level >= this.level) {
      const formattedMessage = this.formatMessage(levelName, message, meta);
      console.log(formattedMessage);
    }
  }

  debug(message: string, meta?: any): void {
    this.log(LogLevel.DEBUG, 'debug', message, meta);
  }

  info(message: string, meta?: any): void {
    this.log(LogLevel.INFO, 'info', message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log(LogLevel.WARN, 'warn', message, meta);
  }

  error(message: string, meta?: any): void {
    this.log(LogLevel.ERROR, 'error', message, meta);
  }
}

export const logger = new Logger();