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
