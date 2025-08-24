import { createApp } from './app';
import { initializeDatabase, closeDatabase } from './database';
import { config } from './config';

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    console.log("[API] Database initialized successfully");

    // Create Express app
    const app = createApp();

    // Start server
    const server = app.listen(config.port, () => {
      console.log(`[API] Server listening on port ${config.port}`);
      console.log(`[API] Environment: ${config.nodeEnv}`);
      console.log(`[API] CORS Origin: ${config.corsOrigin}`);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      console.log(`[API] Received ${signal}, shutting down gracefully...`);
      server.close(async () => {
        console.log("[API] HTTP server closed");
        await closeDatabase();
        console.log("[API] Database connections closed");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

    return server;
  } catch (error) {
    console.error("[API] Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer();
