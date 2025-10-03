import { Counter, Histogram, Gauge, register } from 'prom-client';

// API-specific metrics
export const apiRequestDuration = new Histogram({
  name: 'api_request_duration_seconds',
  help: 'API request duration in seconds by endpoint type',
  labelNames: ['endpoint_type', 'method', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register], // Explicitly register with default registry
});

export const apiErrors = new Counter({
  name: 'api_errors_total',
  help: 'Total API errors by endpoint and error type',
  labelNames: ['endpoint_type', 'method', 'status_code', 'error_type'],
  registers: [register], // Explicitly register with default registry
});

// Active SSE connections (current count)
export const sseActiveConnections = new Gauge({
  name: 'api_sse_active_connections',
  help: 'Current number of active SSE connections by guild',
  labelNames: ['guild_id'],
  registers: [register], // Explicitly register with default registry
});

// Total SSE connections (historical counter)
export const sseTotalConnections = new Counter({
  name: 'api_sse_connections_total',
  help: 'Total SSE connections established by guild',
  labelNames: ['guild_id'],
  registers: [register], // Explicitly register with default registry
});

// Helper to categorize endpoints
export function categorizeEndpoint(path: string): string {
  if (path === '/health') return 'health';
  if (path === '/metrics') return 'metrics';
  if (path.includes('/events')) return 'events';
  if (path.includes('/auth')) return 'auth';
  if (path.includes('/guilds')) return 'guilds';
  if (path.includes('/commands')) return 'commands';
  return 'other';
}

// Record API request metrics
export function recordApiRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  error?: Error
) {
  const endpointType = categorizeEndpoint(path);
  
  apiRequestDuration.observe(
    {
      endpoint_type: endpointType,
      method: method,
      status_code: statusCode.toString(),
    },
    duration
  );

  if (error || statusCode >= 400) {
    apiErrors.inc({
      endpoint_type: endpointType,
      method: method,
      status_code: statusCode.toString(),
      error_type: error?.name || 'HttpError',
    });
  }
}

// Record SSE connection
export function recordSseConnection(guildId: string, type: 'connect' | 'disconnect') {
  if (type === 'connect') {
    // Increment active connections gauge
    sseActiveConnections.inc({
      guild_id: guildId,
    });
    
    // Increment total connections counter
    sseTotalConnections.inc({
      guild_id: guildId,
    });
  } else if (type === 'disconnect') {
    // Decrement active connections gauge
    sseActiveConnections.dec({
      guild_id: guildId,
    });
  }
}

// Export the registry for potential use by other parts of the application
export { register };
