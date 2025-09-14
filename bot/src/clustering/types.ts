export interface ClusterInfo {
  id: number;
  shardStart: number;
  shardEnd: number;
  totalShards: number;
  guilds: number;
  users: number;
  memory: number;
  uptime: number;
}

export interface ClusterMetrics {
  clusterId: number;
  shards: ShardMetrics[];
  totalGuilds: number;
  totalUsers: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
}

export interface ShardMetrics {
  id: number;
  status: string;
  ping: number;
  guilds: number;
  users: number;
}

export interface ClusterHealth {
  clusterId: number;
  healthy: boolean;
  lastCheck: Date;
  responseTime?: number;
  error?: string;
}
