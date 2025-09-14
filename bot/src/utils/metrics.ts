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
});

// Cluster metrics
export const clusterGuildCount = new Gauge({
  name: 'bot_cluster_guilds_total',
  help: 'Total number of guilds per cluster',
  labelNames: ['cluster_id']
});

export const clusterShardCount = new Gauge({
  name: 'bot_cluster_shards_total',
  help: 'Total number of shards per cluster',
  labelNames: ['cluster_id']
});

export const clusterMemoryUsage = new Gauge({
  name: 'bot_cluster_memory_usage_bytes',
  help: 'Memory usage per cluster',
  labelNames: ['cluster_id', 'type']
});

export const clusterCpuUsage = new Gauge({
  name: 'bot_cluster_cpu_usage_percent',
  help: 'CPU usage percentage per cluster',
  labelNames: ['cluster_id'],
});

export const clusterUptime = new Gauge({
  name: 'bot_cluster_uptime_seconds',
  help: 'Uptime in seconds per cluster',
  labelNames: ['cluster_id'],
});

// Shard metrics (enhanced with cluster_id)
export const shardCpuUsage = new Gauge({
  name: 'bot_shard_cpu_usage_percent',
  help: 'CPU usage percentage per shard',
  labelNames: ['cluster_id', 'shard_id'],
});

export const shardMemoryUsage = new Gauge({
  name: 'bot_shard_memory_usage_bytes',
  help: 'Memory usage in bytes per shard',
  labelNames: ['cluster_id', 'shard_id'],
});

export const shardGuildCount = new Gauge({
  name: 'bot_shard_guild_count',
  help: 'Number of guilds per shard',
  labelNames: ['cluster_id', 'shard_id'],
});

// Additional shard metrics
export const shardLatency = new Gauge({
  name: 'bot_shard_latency_ms',
  help: 'WebSocket latency in milliseconds per shard',
  labelNames: ['cluster_id', 'shard_id'],
});

export const shardUptime = new Gauge({
  name: 'bot_shard_uptime_seconds',
  help: 'Uptime in seconds per shard',
  labelNames: ['cluster_id', 'shard_id'],
});

export const shardUserCount = new Gauge({
  name: 'bot_shard_user_count',
  help: 'Number of users per shard',
  labelNames: ['cluster_id', 'shard_id'],
});

// Command execution duration
export const commandDuration = new Histogram({
  name: 'bot_command_duration_seconds',
  help: 'Duration of command execution in seconds',
  labelNames: ['command_name', 'cluster_id', 'shard_id', 'guild_id'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// Update cluster metrics
export const updateClusterMetrics = (clusterId: number, shardCount: number, guilds: number, memory: NodeJS.MemoryUsage, uptime: number) => {
  const clusterIdStr = clusterId.toString();
  
  clusterGuildCount.set({ cluster_id: clusterIdStr }, guilds);
  clusterShardCount.set({ cluster_id: clusterIdStr }, shardCount);
  clusterMemoryUsage.set({ cluster_id: clusterIdStr, type: 'rss' }, memory.rss);
  clusterMemoryUsage.set({ cluster_id: clusterIdStr, type: 'heapUsed' }, memory.heapUsed);
  clusterMemoryUsage.set({ cluster_id: clusterIdStr, type: 'heapTotal' }, memory.heapTotal);
  clusterUptime.set({ cluster_id: clusterIdStr }, uptime);
};

// Update cluster-level metrics (data is already aggregated across shards in this cluster)
export const updateShardMetrics = (client: Client) => {
  const clusterId = client.cluster?.id ?? 0;
  const clusterIdStr = clusterId.toString();
  
  // The client data represents ALL shards in this cluster, so update cluster metrics
  updateClusterMetrics(
    clusterId,
    client.cluster?.shardList?.length ?? 1,
    client.guilds.cache.size,
    process.memoryUsage(),
    process.uptime()
  );
  
  // For individual shard metrics, we need to evaluate each shard separately
  if (client.cluster?.shardList) {
    client.cluster.shardList.forEach(async (shardId) => {
      try {
        // Get per-shard data by evaluating on specific shard
        const shardGuilds = await client.cluster.broadcastEval(
          (c, { shardId }) => c.ws.shards.get(shardId)?.status === Status.Ready ? 
            c.guilds.cache.filter(g => (BigInt(g.id) >> 22n) % BigInt(c.cluster.shardList.length) === BigInt(shardId)).size : 0,
          { context: { shardId } }
        );
        
        const shardIdStr = shardId.toString();
        const guildCount = Array.isArray(shardGuilds) ? shardGuilds[0] || 0 : 0;
        
        // Update individual shard metrics
        shardGuildCount.set({ cluster_id: clusterIdStr, shard_id: shardIdStr }, guildCount);
        shardLatency.set({ cluster_id: clusterIdStr, shard_id: shardIdStr }, client.ws.shards.get(shardId)?.ping ?? -1);
        shardUptime.set({ cluster_id: clusterIdStr, shard_id: shardIdStr }, client.uptime || 0);
        
        // Memory and CPU are cluster-level, not per-shard
        const memUsage = process.memoryUsage();
        shardMemoryUsage.set({ cluster_id: clusterIdStr, shard_id: shardIdStr }, memUsage.rss / client.cluster.shardList.length);
      } catch (error) {
        // If we can't get individual shard data, skip this shard
        console.warn(`Failed to get metrics for shard ${shardId}:`, error);
      }
    });
  }
};


// Record command execution (enhanced for clustering)
export const recordCommandExecution = (commandName: string, subcommandName?: string, clusterId?: number, shardId?: number, guildId?: string) => {
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
};

// Record command execution with timing (enhanced for clustering)
export const recordCommandExecutionWithTiming = (commandName: string, duration: number, clusterId?: number, shardId?: number, guildId?: string) => {
  const clusterIdStr = (clusterId ?? 0).toString();
  const shardIdStr = (shardId ?? 0).toString();
  const guildIdStr = guildId || 'dm';
  
  commandDuration.observe(
    { command_name: commandName, cluster_id: clusterIdStr, shard_id: shardIdStr, guild_id: guildIdStr },
    duration
  );
};

// Export the register for use in metrics endpoint
export { register };
