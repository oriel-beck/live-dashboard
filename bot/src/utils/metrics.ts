import { register, collectDefaultMetrics, Counter, Gauge } from 'prom-client';
import { Client } from 'discord.js';

// Enable default metrics collection
collectDefaultMetrics({
  register,
  prefix: 'bot_',
});

// Bot Command Metrics with subcommand support
export const commandsExecuted = new Counter({
  name: 'commands_executed_total',
  help: 'Total number of commands executed (5m intervals)',
  labelNames: ['command_name', 'shard_id', 'guild_id'],
});

// Shard metrics
export const shardCpuUsage = new Gauge({
  name: 'shard_cpu_usage_percent',
  help: 'CPU usage percentage per shard',
  labelNames: ['shard_id'],
});

export const shardMemoryUsage = new Gauge({
  name: 'shard_memory_usage_bytes',
  help: 'Memory usage in bytes per shard',
  labelNames: ['shard_id'],
});

export const shardGuildCount = new Gauge({
  name: 'shard_guild_count',
  help: 'Number of guilds per shard',
  labelNames: ['shard_id'],
});

// Update shard metrics
export const updateShardMetrics = (client: Client) => {
  const shardId = client.shard?.ids?.[0] ?? 0;
  const shardIdStr = shardId.toString();
  
  // Update guild count
  shardGuildCount.set({ shard_id: shardIdStr }, client.guilds.cache.size);
  
  // Update memory usage
  const memUsage = process.memoryUsage();
  shardMemoryUsage.set({ shard_id: shardIdStr }, memUsage.rss);
  
  // Update CPU usage (simplified - in production you'd want more sophisticated CPU tracking)
  const cpuUsage = process.cpuUsage();
  const totalCpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
  shardCpuUsage.set({ shard_id: shardIdStr }, totalCpuUsage);
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

// Export the register for use in metrics endpoint
export { register };
