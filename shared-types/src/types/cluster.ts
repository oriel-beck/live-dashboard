export interface ClusterInstance {
  id: number;
  shards: number[];
  status: ClusterStatus;
  processId?: number; // For process-based clusters
  containerId?: string; // For Docker-based clusters
  serviceId?: string; // For Docker Swarm services
  startTime: Date;
  lastHealthCheck: Date;
}

export interface ClusterStatus {
  id: number;
  isRunning: boolean;
  isReady: boolean;
  health: 'healthy' | 'unhealthy' | 'unknown';
  uptime: number;
  memoryUsage?: number;
  cpuUsage?: number;
  shardStatus: ShardStatus[];
  lastError?: string;
}

export interface ShardStatus {
  shardId: number;
  isConnected: boolean;
  latency: number;
  guildCount: number;
  userCount: number;
  lastHeartbeat: Date;
}

export interface ClusterInfo {
  id: number;
  shards: number[];
  status: ClusterStatus;
  runtime: 'process' | 'docker' | 'swarm';
  config: ClusterConfig;
}

export interface ClusterConfig {
  shards: number[];
  environment: Record<string, string>;
  resources?: {
    memory?: string;
    cpu?: string;
  };
  restartPolicy?: {
    maxRetries: number;
    delay: number;
  };
}

export interface ClusterRuntimeManager {
  createCluster(clusterId: number, shards: number[]): Promise<ClusterInstance>;
  stopCluster(clusterId: number): Promise<void>;
  getClusterStatus(clusterId: number): Promise<ClusterStatus>;
  listClusters(): Promise<ClusterInfo[]>;
  restartCluster(clusterId: number): Promise<void>;
  isClusterHealthy(clusterId: number): Promise<boolean>;
}
