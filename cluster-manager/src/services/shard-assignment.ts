import { ShardDistribution, ShardAssignment } from '@discord-bot/shared-types';
import logger from '../utils/logger';

export class ShardAssignmentService {
  private readonly shardsPerCluster: number;

  constructor() {
    this.shardsPerCluster = parseInt(process.env.SHARDS_PER_CLUSTER || '16');
  }

  /**
   * Calculate shard distribution across clusters
   */
  calculateShardDistribution(totalShards: number, shardsPerCluster?: number): ShardDistribution {
    let effectiveShardsPerCluster = shardsPerCluster || this.shardsPerCluster;
    
    const totalClusters = Math.ceil(totalShards / effectiveShardsPerCluster);
    const clusterShards = new Map<number, number[]>();
    const remainingShards: number[] = [];

    logger.info(`[ShardAssignmentService] Calculating distribution for ${totalShards} shards across ${totalClusters} clusters (${effectiveShardsPerCluster} shards per cluster)`);

    // Distribute shards to clusters
    for (let clusterId = 0; clusterId < totalClusters; clusterId++) {
      const startShard = clusterId * effectiveShardsPerCluster;
      const endShard = Math.min(startShard + effectiveShardsPerCluster - 1, totalShards - 1);
      
      const shards: number[] = [];
      for (let shardId = startShard; shardId <= endShard; shardId++) {
        shards.push(shardId);
      }
      
      clusterShards.set(clusterId, shards);
      logger.debug(`[ShardAssignmentService] Cluster ${clusterId}: shards [${shards.join(', ')}]`);
    }

    // Check for remaining shards (shouldn't happen with proper calculation)
    for (let shardId = totalClusters * effectiveShardsPerCluster; shardId < totalShards; shardId++) {
      remainingShards.push(shardId);
    }

    if (remainingShards.length > 0) {
      logger.warn(`[ShardAssignmentService] Found ${remainingShards.length} remaining shards: [${remainingShards.join(', ')}]`);
    }

    return {
      totalShards,
      shardsPerCluster: effectiveShardsPerCluster,
      totalClusters,
      clusterShards,
      remainingShards,
    };
  }

  /**
   * Assign shards to a specific cluster
   */
  assignShardsToCluster(clusterId: number, totalShards: number, shardsPerCluster?: number): number[] {
    if (totalShards <= 0) {
      throw new Error('Total shards must be greater than 0');
    }
    
    const distribution = this.calculateShardDistribution(totalShards, shardsPerCluster);
    return distribution.clusterShards.get(clusterId) || [];
  }

  /**
   * Get shard assignment for a specific cluster
   */
  getShardAssignment(clusterId: number, totalShards: number, shardsPerCluster?: number): ShardAssignment {
    const effectiveShardsPerCluster = shardsPerCluster || this.shardsPerCluster;
    const shards = this.assignShardsToCluster(clusterId, totalShards, shardsPerCluster);
    
    const startIndex = clusterId * effectiveShardsPerCluster;
    const endIndex = Math.min(startIndex + effectiveShardsPerCluster - 1, totalShards - 1);

    return {
      clusterId,
      shards,
      startIndex,
      endIndex,
    };
  }

  /**
   * Get all shard assignments for all clusters
   */
  getAllShardAssignments(totalShards: number, shardsPerCluster?: number): ShardAssignment[] {
    const distribution = this.calculateShardDistribution(totalShards, shardsPerCluster);
    const assignments: ShardAssignment[] = [];

    for (let clusterId = 0; clusterId < distribution.totalClusters; clusterId++) {
      const assignment = this.getShardAssignment(clusterId, totalShards, shardsPerCluster);
      assignments.push(assignment);
    }

    return assignments;
  }

  /**
   * Validate shard distribution
   */
  validateShardDistribution(distribution: ShardDistribution): boolean {
    const { totalShards, clusterShards, remainingShards } = distribution;
    
    // Check that all shards are assigned
    const assignedShards = new Set<number>();
    
    for (const shards of clusterShards.values()) {
      for (const shardId of shards) {
        if (assignedShards.has(shardId)) {
          logger.error(`[ShardAssignmentService] Duplicate shard assignment: ${shardId}`);
          return false;
        }
        assignedShards.add(shardId);
      }
    }

    // Add remaining shards
    for (const shardId of remainingShards) {
      if (assignedShards.has(shardId)) {
        logger.error(`[ShardAssignmentService] Duplicate remaining shard: ${shardId}`);
        return false;
      }
      assignedShards.add(shardId);
    }

    // Check that all shards from 0 to totalShards-1 are assigned
    for (let shardId = 0; shardId < totalShards; shardId++) {
      if (!assignedShards.has(shardId)) {
        logger.error(`[ShardAssignmentService] Missing shard assignment: ${shardId}`);
        return false;
      }
    }

    // Check that no shards beyond totalShards are assigned
    for (const shardId of assignedShards) {
      if (shardId >= totalShards) {
        logger.error(`[ShardAssignmentService] Invalid shard assignment: ${shardId} (total: ${totalShards})`);
        return false;
      }
    }

    logger.info(`[ShardAssignmentService] Shard distribution validation passed`);
    return true;
  }

  /**
   * Rebalance shards when total shard count changes
   */
  rebalanceShards(oldDistribution: ShardDistribution, newTotalShards: number): ShardDistribution {
    logger.info(`[ShardAssignmentService] Rebalancing shards from ${oldDistribution.totalShards} to ${newTotalShards}`);
    
    const newDistribution = this.calculateShardDistribution(newTotalShards, oldDistribution.shardsPerCluster);
    
    // Log changes
    for (let clusterId = 0; clusterId < Math.max(oldDistribution.totalClusters, newDistribution.totalClusters); clusterId++) {
      const oldShards = oldDistribution.clusterShards.get(clusterId) || [];
      const newShards = newDistribution.clusterShards.get(clusterId) || [];
      
      if (oldShards.length !== newShards.length || !this.arraysEqual(oldShards, newShards)) {
        logger.info(`[ShardAssignmentService] Cluster ${clusterId}: [${oldShards.join(', ')}] -> [${newShards.join(', ')}]`);
      }
    }
    
    return newDistribution;
  }

  /**
   * Get optimal shards per cluster based on Discord recommendations
   */
  getOptimalShardsPerCluster(totalShards: number, maxConcurrency: number): number {
    // Discord recommends not exceeding max_concurrency for shard connections
    // Start with the configured shards per cluster, but respect Discord's max concurrency
    const configuredShardsPerCluster = parseInt(process.env.SHARDS_PER_CLUSTER || '16');
    const optimalShardsPerCluster = Math.min(configuredShardsPerCluster, maxConcurrency);
    
    // Ensure we don't create too many clusters (reasonable limit)
    const maxClusters = Math.ceil(totalShards / optimalShardsPerCluster);
    if (maxClusters > 10) {
      const adjustedShardsPerCluster = Math.ceil(totalShards / 10);
      logger.info(`[ShardAssignmentService] Adjusted shards per cluster to ${adjustedShardsPerCluster} to limit cluster count (Discord max concurrency: ${maxConcurrency})`);
      return adjustedShardsPerCluster;
    }
    
    logger.info(`[ShardAssignmentService] Using ${optimalShardsPerCluster} shards per cluster (Discord max concurrency: ${maxConcurrency})`);
    return optimalShardsPerCluster;
  }

  /**
   * Helper method to compare arrays
   */
  private arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}
