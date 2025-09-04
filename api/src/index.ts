// @ts-expect-error Add BigInt JSON serialization support
BigInt.prototype.toJSON = function() {
  return this.toString();
};

import { createApp } from './app';
import { config } from './config';
import logger from './utils/logger';
import { prisma } from './database';

// Start server
async function startServer() {
  try {
    logger.info("[API] Starting server...");

    // Create Express app
    const app = createApp();

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`[API] Server listening on port ${config.port}`);
      logger.info(`[API] Environment: ${config.nodeEnv}`);
      logger.debug(`[API] CORS Origin: ${config.corsOrigin}`);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      logger.info(`[API] Received ${signal}, shutting down gracefully...`);
      server.close(async () => {
        logger.info("[API] HTTP server closed");
        await prisma.$disconnect();
        logger.info("[API] Database connections closed");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

    return server;
  } catch (error) {
    logger.error("[API] Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer();
