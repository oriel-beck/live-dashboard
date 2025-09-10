import { Elysia } from 'elysia';
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
import { logger } from '../utils/logger';

// Elysia HTTP metrics middleware
export const httpMetrics = new Elysia({ name: 'httpMetrics' })
  .onRequest(({ request, set }) => {
    const startTime = Date.now();
    const url = new URL(request.url);
    const route = url.pathname;
    const method = request.method;
    
    // Store start time for duration calculation
    (request as any).__metricsStartTime = startTime;
    (request as any).__metricsRoute = route;
    (request as any).__metricsMethod = method;
  })
  .onAfterHandle(({ request, set }) => {
    const startTime = (request as any).__metricsStartTime;
    const route = (request as any).__metricsRoute;
    const method = (request as any).__metricsMethod;
    const statusCode = set.status || 200;
    
    if (startTime && route && method) {
      const duration = (Date.now() - startTime) / 1000;
      
      // Increment request counter
      httpRequestTotal.inc({
        method: method,
        route: route,
        status_code: statusCode.toString(),
      });

      // Record request duration
      httpRequestDuration.observe(
        {
          method: method,
          route: route,
          status_code: statusCode.toString(),
        },
        duration
      );

      // Record errors
      if (Number(statusCode) >= 400) {
        httpRequestErrors.inc({
          method: method,
          route: route,
          error_type: Number(statusCode) >= 500 ? 'server_error' : 'client_error',
        });
      }
    }
  });

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
