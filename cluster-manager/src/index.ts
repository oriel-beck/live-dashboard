import { ClusterManager } from './cluster-manager';
import logger from './utils/logger';

// Create and start cluster manager
const manager = new ClusterManager();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('[ClusterManager] Received SIGINT, shutting down gracefully...');
  await manager.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('[ClusterManager] Received SIGTERM, shutting down gracefully...');
  await manager.stop();
  process.exit(0);
});

// Start the cluster manager
manager.start().catch((error) => {
  logger.error('[ClusterManager] Fatal error:', error);
  process.exit(1);
});

