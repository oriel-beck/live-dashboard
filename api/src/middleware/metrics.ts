import { Counter, Histogram, register } from 'prom-client';

// API-specific metrics
export const apiRequestDuration = new Histogram({
  name: 'api_request_duration_seconds',
  help: 'API request duration in seconds by endpoint type',
  labelNames: ['endpoint_type', 'method', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const apiErrors = new Counter({
  name: 'api_errors_total',
  help: 'Total API errors by endpoint and error type',
  labelNames: ['endpoint_type', 'method', 'status_code', 'error_type'],
});

export const sseConnections = new Counter({
  name: 'api_sse_connections_total',
  help: 'Total SSE connections by guild',
  labelNames: ['guild_id', 'connection_type'],
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
  sseConnections.inc({
    guild_id: guildId,
    connection_type: type,
  });
}
