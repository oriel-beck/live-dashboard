import { register, collectDefaultMetrics, Counter, Gauge, Histogram } from 'prom-client';
import { Client } from 'discord.js';

// Enable default metrics collection
collectDefaultMetrics({
  register,
  prefix: 'bot_',
});

// Bot Command Metrics with subcommand support
export const commandsExecuted = new Counter({
  name: 'bot_commands_executed_total',
  help: 'Total number of commands executed',
  labelNames: ['command_name', 'shard_id', 'guild_id'],
});

// Shard metrics
export const shardCpuUsage = new Gauge({
  name: 'bot_shard_cpu_usage_percent',
  help: 'CPU usage percentage per shard',
  labelNames: ['shard_id'],
});

export const shardMemoryUsage = new Gauge({
  name: 'bot_shard_memory_usage_bytes',
  help: 'Memory usage in bytes per shard',
  labelNames: ['shard_id'],
});

export const shardGuildCount = new Gauge({
  name: 'bot_shard_guild_count',
  help: 'Number of guilds per shard',
  labelNames: ['shard_id'],
});

// Additional shard metrics
export const shardLatency = new Gauge({
  name: 'bot_shard_latency_ms',
  help: 'WebSocket latency in milliseconds per shard',
  labelNames: ['shard_id'],
});

export const shardUptime = new Gauge({
  name: 'bot_shard_uptime_seconds',
  help: 'Uptime in seconds per shard',
  labelNames: ['shard_id'],
});

export const shardUserCount = new Gauge({
  name: 'bot_shard_user_count',
  help: 'Number of users per shard',
  labelNames: ['shard_id'],
});

// Command execution duration
export const commandDuration = new Histogram({
  name: 'bot_command_duration_seconds',
  help: 'Duration of command execution in seconds',
  labelNames: ['command_name', 'shard_id', 'guild_id'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// Update shard metrics
export const updateShardMetrics = (client: Client) => {
  const shardId = client.shard?.ids?.[0] ?? 0;
  const shardIdStr = shardId.toString();
  
  // Update guild count
  shardGuildCount.set({ shard_id: shardIdStr }, client.guilds.cache.size);
  
  // Update user count
  shardUserCount.set({ shard_id: shardIdStr }, client.users.cache.size);
  
  // Update memory usage
  const memUsage = process.memoryUsage();
  shardMemoryUsage.set({ shard_id: shardIdStr }, memUsage.rss);
  
  // Update CPU usage (simplified - in production you'd want more sophisticated CPU tracking)
  const cpuUsage = process.cpuUsage();
  const totalCpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
  shardCpuUsage.set({ shard_id: shardIdStr }, totalCpuUsage);
  
  // Update latency
  shardLatency.set({ shard_id: shardIdStr }, client.ws.ping);
  
  // Update uptime
  shardUptime.set({ shard_id: shardIdStr }, client.uptime || 0);
};


// Record command execution
export const recordCommandExecution = (commandName: string, subcommandName?: string, shardId?: number, guildId?: string) => {
  const fullCommandName = subcommandName ? `${commandName}__${subcommandName}` : commandName;
  const shardIdStr = (shardId ?? 0).toString();
  const guildIdStr = guildId || 'dm'; // Use 'dm' for direct messages
  
  commandsExecuted.inc({
    command_name: fullCommandName,
    shard_id: shardIdStr,
    guild_id: guildIdStr,
  });
};

// Record command execution with timing
export const recordCommandExecutionWithTiming = (commandName: string, duration: number, shardId?: number, guildId?: string) => {
  const shardIdStr = (shardId ?? 0).toString();
  const guildIdStr = guildId || 'dm';
  
  commandDuration.observe(
    { command_name: commandName, shard_id: shardIdStr, guild_id: guildIdStr },
    duration
  );
};

// Export the register for use in metrics endpoint
export { register };
