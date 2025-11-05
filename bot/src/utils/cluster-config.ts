import { BotClusterConfig } from "@discord-bot/shared";
import { logger } from "@discord-bot/services";

/**
 * Validate and parse cluster configuration from environment variables
 * Exits process if configuration is invalid
 */
export function loadClusterConfig(): BotClusterConfig {
  const clusterId = parseInt(process.env.CLUSTER_ID || "0");
  const shardListEnv = process.env.SHARD_LIST;
  const totalShards = parseInt(process.env.TOTAL_SHARDS || "0");

  if (!shardListEnv || shardListEnv === "[]" || totalShards === 0) {
    logger.error(
      "[ClusterConfig] Invalid cluster configuration. This bot instance must run as part of a cluster."
    );
    logger.error(
      "[ClusterConfig] Required environment variables: CLUSTER_ID, SHARD_LIST (non-empty array), TOTAL_SHARDS"
    );
    process.exit(1);
  }

  const shardList = JSON.parse(shardListEnv);

  if (!Array.isArray(shardList) || shardList.length === 0) {
    logger.error(
      "[ClusterConfig] SHARD_LIST must be a non-empty array of shard IDs"
    );
    process.exit(1);
  }

  logger.info(
    `[Cluster ${clusterId}] Starting cluster with shards ${shardList.join(
      ", "
    )} (${shardList.length}/${totalShards})`
  );

  return { clusterId, shardList, totalShards };
}
