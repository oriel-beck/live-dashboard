import { register, collectDefaultMetrics, Counter, Gauge, Histogram } from 'prom-client';
import { Client, Status } from 'discord.js';
import { ClusterClient } from 'discord-hybrid-sharding';

// Extend Client type to include cluster property
declare module "discord.js" {
  interface Client {
    cluster: ClusterClient;
  }
}

// Enable default metrics collection
collectDefaultMetrics({
  register,
  prefix: 'bot_',
});

// Bot Command Metrics with subcommand support
export const commandsExecuted = new Counter({
  name: 'bot_commands_executed_total',
  help: 'Total number of commands executed',
  labelNames: ['command_name', 'cluster_id', 'shard_id', 'guild_id'],
  registers: [register],
});

export const commandErrors = new Counter({
  name: 'bot_command_errors_total',
  help: 'Total number of command errors',
  labelNames: ['command_name', 'cluster_id', 'shard_id', 'guild_id', 'error_type'],
  registers: [register],
});

export const commandDuration = new Histogram({
  name: 'bot_command_execution_duration_seconds',
  help: 'Command execution duration in seconds',
  labelNames: ['command_name', 'cluster_id', 'shard_id'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], // Match API buckets
  registers: [register],
});

// Cluster metrics
export const clusterGuildCount = new Gauge({
  name: 'bot_cluster_guilds_total',
  help: 'Total number of guilds per cluster',
  labelNames: ['cluster_id'],
  registers: [register],
});

export const clusterShardCount = new Gauge({
  name: 'bot_cluster_shards_total',
  help: 'Total number of shards per cluster',
  labelNames: ['cluster_id'],
  registers: [register],
});

export const clusterMemoryUsage = new Gauge({
  name: 'bot_cluster_memory_usage_bytes',
  help: 'Memory usage per cluster',
  labelNames: ['cluster_id', 'type'],
  registers: [register],
});

export const clusterCpuUsage = new Gauge({
  name: 'bot_cluster_cpu_usage_percent',
  help: 'CPU usage percentage per cluster',
  labelNames: ['cluster_id'],
  registers: [register],
});

export const clusterUptime = new Gauge({
  name: 'bot_cluster_uptime_seconds',
  help: 'Uptime in seconds per cluster',
  labelNames: ['cluster_id'],
  registers: [register],
});

// Note: Total metrics removed - let Prometheus aggregate with sum() queries

// Shard metrics (enhanced with cluster_id)
// Cluster-level metrics only - no per-shard metrics needed
export const clusterLatency = new Gauge({
  name: 'bot_cluster_latency_ms',
  help: 'Average WebSocket latency in milliseconds per cluster',
  labelNames: ['cluster_id'],
  registers: [register],
});

// Track CPU usage for each cluster
const clusterCpuTracking = new Map<string, { lastCpuTime: number; lastTimestamp: number }>();

// Update cluster metrics
export const updateClusterMetrics = (clusterId: number, shardCount: number, guilds: number, memory: NodeJS.MemoryUsage, uptime: number, cpuUsage?: number) => {
  const clusterIdStr = clusterId.toString();
  
  clusterGuildCount.set({ cluster_id: clusterIdStr }, guilds);
  clusterShardCount.set({ cluster_id: clusterIdStr }, shardCount);
  clusterMemoryUsage.set({ cluster_id: clusterIdStr, type: 'rss' }, memory.rss);
  clusterMemoryUsage.set({ cluster_id: clusterIdStr, type: 'heapUsed' }, memory.heapUsed);
  clusterMemoryUsage.set({ cluster_id: clusterIdStr, type: 'heapTotal' }, memory.heapTotal);
  clusterUptime.set({ cluster_id: clusterIdStr }, uptime);
  
  // Set CPU usage if provided
  if (cpuUsage !== undefined) {
    clusterCpuUsage.set({ cluster_id: clusterIdStr }, cpuUsage);
  }
};

// Calculate CPU usage percentage for a cluster
export const calculateCpuUsage = (clusterId: number): number => {
  const clusterIdStr = clusterId.toString();
  const now = Date.now();
  const cpuUsage = process.cpuUsage();
  const currentCpuTime = (cpuUsage.user + cpuUsage.system) / 1000; // Convert microseconds to milliseconds
  
  const tracking = clusterCpuTracking.get(clusterIdStr);
  
  if (!tracking) {
    // First measurement, store baseline
    clusterCpuTracking.set(clusterIdStr, {
      lastCpuTime: currentCpuTime,
      lastTimestamp: now
    });
    return 0; // Return 0 for first measurement
  }
  
  const timeDiff = now - tracking.lastTimestamp;
  const cpuDiff = currentCpuTime - tracking.lastCpuTime;
  
  // Update tracking for next calculation
  clusterCpuTracking.set(clusterIdStr, {
    lastCpuTime: currentCpuTime,
    lastTimestamp: now
  });
  
  // Calculate CPU usage percentage
  if (timeDiff > 0) {
    const cpuPercent = (cpuDiff / timeDiff) * 100;
    return Math.min(Math.max(cpuPercent, 0), 100); // Clamp between 0-100%
  }
  
  return 0;
};

// Update cluster-level metrics only
export const updateShardMetrics = (client: Client) => {
  const clusterId = client.cluster?.id ?? 0;
  const clusterIdStr = clusterId.toString();
  
  // Calculate CPU usage for this cluster
  const cpuUsage = calculateCpuUsage(clusterId);
  
  // Update cluster-level metrics
  updateClusterMetrics(
    clusterId,
    client.cluster?.shardList?.length ?? 1,
    client.guilds.cache.size,
    process.memoryUsage(),
    process.uptime(),
    cpuUsage
  );
  
  // Calculate average latency across all shards in this cluster
  if (client.cluster?.shardList) {
    const validShards = client.cluster.shardList
      .map(shardId => client.ws.shards.get(shardId))
      .filter(shard => shard && shard.ping !== -1);
    
    if (validShards.length > 0) {
      const avgLatency = validShards.reduce((sum, shard) => sum + (shard!.ping ?? 0), 0) / validShards.length;
      clusterLatency.set({ cluster_id: clusterIdStr }, avgLatency);
    }
  }
};


// Record command execution (enhanced for clustering)
export const recordCommandExecution = (commandName: string, subcommandName?: string, clusterId?: number, shardId?: number, guildId?: string, duration?: number) => {
  const fullCommandName = subcommandName ? `${commandName}__${subcommandName}` : commandName;
  const clusterIdStr = (clusterId ?? 0).toString();
  const shardIdStr = (shardId ?? 0).toString();
  const guildIdStr = guildId || 'dm'; // Use 'dm' for direct messages
  
  commandsExecuted.inc({
    command_name: fullCommandName,
    cluster_id: clusterIdStr,
    shard_id: shardIdStr,
    guild_id: guildIdStr,
  });

  // Record command duration if provided
  if (duration !== undefined) {
    commandDuration.observe({
      command_name: fullCommandName,
      cluster_id: clusterIdStr,
      shard_id: shardIdStr,
    }, duration);
  }
};

// Record command error
export const recordCommandError = (commandName: string, subcommandName?: string, clusterId?: number, shardId?: number, guildId?: string, errorType?: string) => {
  const fullCommandName = subcommandName ? `${commandName}__${subcommandName}` : commandName;
  const clusterIdStr = (clusterId ?? 0).toString();
  const shardIdStr = (shardId ?? 0).toString();
  const guildIdStr = guildId || 'dm';
  
  commandErrors.inc({
    command_name: fullCommandName,
    cluster_id: clusterIdStr,
    shard_id: shardIdStr,
    guild_id: guildIdStr,
    error_type: errorType || 'unknown',
  });
};

// Export the register for use in metrics endpoint
export { register };
