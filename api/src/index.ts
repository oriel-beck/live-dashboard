import { createApp } from './app';
import { initializeDatabase, closeDatabase } from './database';
import { config } from './config';
import logger from './utils/logger';

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info("[API] Database initialized successfully");

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
        await closeDatabase();
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
