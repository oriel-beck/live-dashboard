// Load environment variables first
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../.env') });

// @ts-expect-error Add BigInt JSON serialization support
BigInt.prototype.toJSON = function() {
  return this.toString();
};

import { ClusterManager } from './clustering/cluster-manager';
import logger from './utils/logger';

// Handle process signals for graceful shutdown
const clusterManager = new ClusterManager();

async function start() {
  try {
    logger.info('[ClusterManager] Starting Discord bot with clustering...');
    await clusterManager.start();
    
    logger.info('[ClusterManager] Cluster manager started successfully');
  } catch (error) {
    logger.error('[ClusterManager] Failed to start cluster manager:', error);
    process.exit(1);
  }
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  logger.info('[ClusterManager] Received SIGINT, shutting down gracefully...');
  await clusterManager.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('[ClusterManager] Received SIGTERM, shutting down gracefully...');
  await clusterManager.stop();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('[ClusterManager] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[ClusterManager] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the cluster manager
start();
