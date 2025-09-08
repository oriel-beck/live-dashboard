import winston from 'winston';
import { config } from '../config';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which level to log based on environment
const level = () => {
  return config.logging.level;
};

// Custom format for structured logging with correlation IDs
const structuredFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, requestId, userId, guildId, ...meta } = info;
    
    const logEntry = {
      timestamp,
      level,
      message,
      service: 'discord-bot-api',
      version: process.env.npm_package_version || '1.0.0',
      environment: config.nodeEnv,
      ...(requestId ? { requestId } : {}),
      ...(userId ? { userId } : {}),
      ...(guildId ? { guildId } : {}),
      ...meta,
    };
    
    return JSON.stringify(logEntry);
  }),
);

// Define different log formats
const format = winston.format.combine(
  // Add timestamp
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  // Add colors to the logs
  winston.format.colorize({ all: true }),
  // Define the format of the message showing the timestamp, the level and the message
  winston.format.printf(
    (info) => {
      const { timestamp, level, message, requestId, userId, guildId, ...meta } = info;
      let logMessage = `${timestamp} ${level}: ${message}`;
      
      // Add correlation IDs to console output
      if (requestId) logMessage += ` [req:${requestId}]`;
      if (userId) logMessage += ` [user:${userId}]`;
      if (guildId) logMessage += ` [guild:${guildId}]`;
      
      // Add additional metadata if present
      if (Object.keys(meta).length > 0) {
        logMessage += ` ${JSON.stringify(meta)}`;
      }
      
      return logMessage;
    },
  ),
);

// Define which transports the logger must use to print out messages
const transports = [
  // Allow the use the console to print the messages
  new winston.transports.Console(),
  // Allow to print all the error level messages inside the error.log file
  new winston.transports.File({
    filename: `${config.logging.filePath}/error.log`,
    level: 'error',
    maxsize: parseInt(config.logging.maxSize),
    maxFiles: config.logging.maxFiles,
  }),
  // Allow to print all the messages inside the all.log file
  new winston.transports.File({ 
    filename: `${config.logging.filePath}/all.log`,
    maxsize: parseInt(config.logging.maxSize),
    maxFiles: config.logging.maxFiles,
  }),
];

// Create the logger instance
const logger = winston.createLogger({
  level: level(),
  levels,
  format: config.nodeEnv === 'production' ? structuredFormat : format,
  transports,
  // Handle uncaught exceptions and unhandled rejections
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: `${config.logging.filePath}/exceptions.log`,
      maxsize: parseInt(config.logging.maxSize),
      maxFiles: config.logging.maxFiles,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: `${config.logging.filePath}/rejections.log`,
      maxsize: parseInt(config.logging.maxSize),
      maxFiles: config.logging.maxFiles,
    }),
  ],
});

// Enhanced logger with correlation ID support
export class StructuredLogger {
  private requestId?: string;
  private userId?: string;
  private guildId?: string;

  constructor(requestId?: string, userId?: string, guildId?: string) {
    this.requestId = requestId;
    this.userId = userId;
    this.guildId = guildId;
  }

  private createLogEntry(level: string, message: string, meta?: any) {
    const entry: any = {
      level,
      message,
      ...(this.requestId && { requestId: this.requestId }),
      ...(this.userId && { userId: this.userId }),
      ...(this.guildId && { guildId: this.guildId }),
      ...meta,
    };
    return entry;
  }

  error(message: string, meta?: any) {
    logger.error(this.createLogEntry('error', message, meta));
  }

  warn(message: string, meta?: any) {
    logger.warn(this.createLogEntry('warn', message, meta));
  }

  info(message: string, meta?: any) {
    logger.info(this.createLogEntry('info', message, meta));
  }

  http(message: string, meta?: any) {
    logger.http(this.createLogEntry('http', message, meta));
  }

  debug(message: string, meta?: any) {
    logger.debug(this.createLogEntry('debug', message, meta));
  }

  // Performance logging
  performance(operation: string, duration: number, meta?: any) {
    this.info(`Performance: ${operation}`, {
      operation,
      duration,
      durationMs: duration,
      ...meta,
    });
  }

  // Security logging
  security(event: string, meta?: any) {
    this.warn(`Security: ${event}`, {
      securityEvent: event,
      ...meta,
    });
  }

  // Business logic logging
  business(event: string, meta?: any) {
    this.info(`Business: ${event}`, {
      businessEvent: event,
      ...meta,
    });
  }
}

// Create a stream object with a 'write' function that will be used by `morgan`
export const stream = {
  write: (message: string) => {
    logger.debug(message.trim());
  },
};

// Request logging middleware
export const requestLogger = (req: any, res: any, next: any) => {
  const startTime = Date.now();
  const requestId = req.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Create structured logger for this request
  req.logger = new StructuredLogger(requestId, req.user?.id, req.params?.guildId);
  
  // Log request start
  req.logger.info('Request started', {
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    req.logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      durationMs: duration,
    });
  });

  next();
};

// Error logging utility
export const logError = (error: Error, context?: any, requestId?: string) => {
  const structuredLogger = new StructuredLogger(requestId);
  structuredLogger.error('Unhandled error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  });
};

// Performance monitoring utility
export const performanceTimer = (operation: string, requestId?: string) => {
  const startTime = Date.now();
  const structuredLogger = new StructuredLogger(requestId);
  
  return {
    end: (meta?: any) => {
      const duration = Date.now() - startTime;
      structuredLogger.performance(operation, duration, meta);
      return duration;
    },
  };
};

export default logger;
