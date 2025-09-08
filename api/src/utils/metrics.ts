import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { config } from '../config';

// Enable default metrics collection
collectDefaultMetrics({
  register,
  prefix: 'discord_bot_api_',
});

// Custom metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestErrors = new Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP request errors',
  labelNames: ['method', 'route', 'error_type'],
});

export const sseActiveConnections = new Gauge({
  name: 'sse_active_connections',
  help: 'Number of active SSE connections',
  labelNames: ['guild_id'],
});

export const sseConnectionErrors = new Counter({
  name: 'sse_connection_errors_total',
  help: 'Total number of SSE connection errors',
  labelNames: ['guild_id', 'error_type'],
});

export const redisPubSubMessagesPublished = new Counter({
  name: 'redis_pubsub_messages_published_total',
  help: 'Total number of Redis pub/sub messages published',
  labelNames: ['guild_id', 'event_type'],
});

export const redisPubSubMessagesDelivered = new Counter({
  name: 'redis_pubsub_messages_delivered_total',
  help: 'Total number of Redis pub/sub messages delivered',
  labelNames: ['guild_id', 'event_type'],
});

export const redisConnectionStatus = new Gauge({
  name: 'redis_connection_status',
  help: 'Redis connection status (1 = connected, 0 = disconnected)',
  labelNames: ['connection_type'], // main, publisher, subscriber
});

export const databaseConnectionStatus = new Gauge({
  name: 'database_connection_status',
  help: 'Database connection status (1 = connected, 0 = disconnected)',
});

export const guildDataCacheHits = new Counter({
  name: 'guild_data_cache_hits_total',
  help: 'Total number of guild data cache hits',
  labelNames: ['guild_id', 'data_type'], // roles, channels, info
});

export const guildDataCacheMisses = new Counter({
  name: 'guild_data_cache_misses_total',
  help: 'Total number of guild data cache misses',
  labelNames: ['guild_id', 'data_type'],
});

export const discordApiRequests = new Counter({
  name: 'discord_api_requests_total',
  help: 'Total number of Discord API requests',
  labelNames: ['endpoint', 'status_code'],
});

export const discordApiRequestDuration = new Histogram({
  name: 'discord_api_request_duration_seconds',
  help: 'Duration of Discord API requests in seconds',
  labelNames: ['endpoint'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 2, 5],
});

export const commandPermissionUpdates = new Counter({
  name: 'command_permission_updates_total',
  help: 'Total number of command permission updates',
  labelNames: ['guild_id', 'command_id', 'status'],
});

export const authenticationAttempts = new Counter({
  name: 'authentication_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['provider', 'status'], // discord, success/failure
});

export const rateLimitHits = new Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['endpoint', 'ip'],
});

// Business metrics
export const activeGuilds = new Gauge({
  name: 'active_guilds',
  help: 'Number of active guilds',
});

export const activeUsers = new Gauge({
  name: 'active_users',
  help: 'Number of active users',
});

export const commandsExecuted = new Counter({
  name: 'commands_executed_total',
  help: 'Total number of commands executed',
  labelNames: ['command_name', 'guild_id'],
});

// Performance metrics
export const memoryUsage = new Gauge({
  name: 'memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type'], // rss, heapTotal, heapUsed, external
});

export const cpuUsage = new Gauge({
  name: 'cpu_usage_percent',
  help: 'CPU usage percentage',
});

// Update system metrics periodically
if (config.features.metrics) {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    memoryUsage.set({ type: 'rss' }, memUsage.rss);
    memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
    memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
    memoryUsage.set({ type: 'external' }, memUsage.external);
  }, 10000); // Update every 10 seconds
}

// Export the register for use in health checks
export { register };
