import { Request, Response, NextFunction } from 'express';
import { 
  httpRequestDuration, 
  httpRequestTotal, 
  httpRequestErrors,
  sseActiveConnections,
  sseConnectionErrors,
  redisPubSubMessagesPublished,
  redisPubSubMessagesDelivered,
  guildDataCacheHits,
  guildDataCacheMisses,
  commandPermissionUpdates,
  authenticationAttempts,
  rateLimitHits
} from '../utils/metrics';
import logger from '../utils/logger';

// HTTP request metrics middleware
export const httpMetrics = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const route = req.route?.path || req.path;
  
  // Increment request counter
  httpRequestTotal.inc({
    method: req.method,
    route: route,
    status_code: res.statusCode.toString(),
  });

  // Record request duration
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    
    httpRequestDuration.observe(
      {
        method: req.method,
        route: route,
        status_code: res.statusCode.toString(),
      },
      duration
    );

    // Record errors
    if (res.statusCode >= 400) {
      httpRequestErrors.inc({
        method: req.method,
        route: route,
        error_type: res.statusCode >= 500 ? 'server_error' : 'client_error',
      });
    }
  });

  next();
};

// SSE metrics helpers
export const sseMetrics = {
  incrementActiveConnections: (guildId: string) => {
    sseActiveConnections.inc({ guild_id: guildId });
  },

  decrementActiveConnections: (guildId: string) => {
    sseActiveConnections.dec({ guild_id: guildId });
  },

  recordConnectionError: (guildId: string, errorType: string) => {
    sseConnectionErrors.inc({ guild_id: guildId, error_type: errorType });
  },
};

// Redis pub/sub metrics helpers
export const redisPubSubMetrics = {
  recordMessagePublished: (guildId: string, eventType: string) => {
    redisPubSubMessagesPublished.inc({ guild_id: guildId, event_type: eventType });
  },

  recordMessageDelivered: (guildId: string, eventType: string) => {
    redisPubSubMessagesDelivered.inc({ guild_id: guildId, event_type: eventType });
  },
};

// Cache metrics helpers
export const cacheMetrics = {
  recordCacheHit: (guildId: string, dataType: string) => {
    guildDataCacheHits.inc({ guild_id: guildId, data_type: dataType });
  },

  recordCacheMiss: (guildId: string, dataType: string) => {
    guildDataCacheMisses.inc({ guild_id: guildId, data_type: dataType });
  },
};

// Command permission metrics
export const commandPermissionMetrics = {
  recordUpdate: (guildId: string, commandId: string, status: 'success' | 'failure') => {
    commandPermissionUpdates.inc({ 
      guild_id: guildId, 
      command_id: commandId, 
      status: status 
    });
  },
};

// Authentication metrics
export const authMetrics = {
  recordAttempt: (provider: string, status: 'success' | 'failure') => {
    authenticationAttempts.inc({ provider, status });
  },
};

// Rate limiting metrics
export const rateLimitMetrics = {
  recordHit: (endpoint: string, ip: string) => {
    rateLimitHits.inc({ endpoint, ip });
  },
};

// Performance monitoring decorator
export const performanceMonitor = (operation: string) => {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const req = args[0] as Request;
      const guildId = req.params?.guildId || 'unknown';
      
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        
        logger.info(`Performance: ${operation}`, {
          operation,
          duration,
          guildId,
          success: true,
        });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        logger.error(`Performance: ${operation} failed`, {
          operation,
          duration,
          guildId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        throw error;
      }
    };
  };
};

// Metrics endpoint
export const metricsHandler = (req: Request, res: Response) => {
  res.set('Content-Type', 'text/plain');
  res.send(require('prom-client').register.metrics());
};
