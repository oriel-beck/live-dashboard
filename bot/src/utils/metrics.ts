import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { Client } from 'discord.js';

// Enable default metrics collection
collectDefaultMetrics({
  register,
  prefix: 'discord_bot_',
});

// Custom metrics
export const commandsExecuted = new Counter({
  name: 'commands_executed_total',
  help: 'Total number of commands executed',
  labelNames: ['command_name', 'guild_id'],
});

export const commandExecutionDuration = new Histogram({
  name: 'command_execution_duration_seconds',
  help: 'Duration of command execution in seconds',
  labelNames: ['command_name', 'guild_id'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 2, 5, 10],
});

export const commandErrors = new Counter({
  name: 'command_errors_total',
  help: 'Total number of command execution errors',
  labelNames: ['command_name', 'guild_id', 'error_type'],
});

export const botErrors = new Counter({
  name: 'bot_errors_total',
  help: 'Total number of bot errors',
  labelNames: ['error_type'],
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

export const redisConnectionStatus = new Gauge({
  name: 'redis_connection_status',
  help: 'Redis connection status (1 = connected, 0 = disconnected)',
});

export const guildCount = new Gauge({
  name: 'guild_count',
  help: 'Number of guilds the bot is in',
  labelNames: ['shard_id'],
});

// Removed user count - not useful with limited caching

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
setInterval(() => {
  const memUsage = process.memoryUsage();
  memoryUsage.set({ type: 'rss' }, memUsage.rss);
  memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
  memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
  memoryUsage.set({ type: 'external' }, memUsage.external);
}, 10000); // Update every 10 seconds

// Update Discord client metrics
export const updateDiscordMetrics = (client: Client) => {
  const shardId = client.shard?.ids?.[0] ?? 0;
  guildCount.set({ shard_id: shardId.toString() }, client.guilds.cache.size);
};

// Export the register for use in metrics endpoint
export { register };
