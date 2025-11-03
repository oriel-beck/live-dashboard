export interface ShardDistribution {
  totalShards: number;
  shardsPerCluster: number;
  totalClusters: number;
  clusterShards: Map<number, number[]>;
  remainingShards: number[];
}

export interface ShardAssignment {
  clusterId: number;
  shards: number[];
  startIndex: number;
  endIndex: number;
}

export interface ClusterStartupConfig {
  clusterId: number;
  shards: number[];
  maxConcurrency: number;
  startupDelay: number;
  readyTimeout: number;
}

/**
 * Runtime cluster configuration used by bot instances
 * This represents the configuration of a running bot cluster instance
 */
export interface BotClusterConfig {
  clusterId: number;
  shardList: number[];
  totalShards: number;
}