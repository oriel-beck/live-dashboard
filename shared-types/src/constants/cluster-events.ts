/**
 * Cluster lifecycle event types
 * These constants ensure consistency across the cluster management system
 */
export const CLUSTER_EVENTS = {
  START: 'cluster_start',
  STOP: 'cluster_stop',
} as const;

/**
 * Cluster event data interfaces
 */
export interface ClusterStartEventData {
  clusterId: number;
  shardList: number[];
  timestamp: string;
}

export interface ClusterStopEventData {
  clusterId: number;
  shardList: number[];
  timestamp: string;
  reason?: string;
}
