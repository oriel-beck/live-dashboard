import { cookie } from "@elysiajs/cookie";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { config } from "./config";
import { DatabaseService } from "./services/database";
import { RedisService } from "./services/redis";
import { logger } from "./utils/logger";

// Import route plugins
import { authPlugin } from "./routes/auth";
import { botConfigPlugin } from "./routes/bot-config";
import { commandPlugin } from "./routes/commands";
import { eventRoutes } from "./routes/events";
import { guildPlugin } from "./routes/guilds";

// Create the main Elysia app
export const app = new Elysia()
  // Add CORS middleware
  .use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Request-ID",
        "X-Client-ID",
      ],
    })
  )

  // Add cookie support
  .use(
    cookie({
      secret: config.session.secret,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: config.session.maxAge,
      path: "/",
    })
  )

  // Add request logging middleware
  .onRequest(({ request, set }) => {
    const requestId = crypto.randomUUID();
    logger.info(
      `[API] ${request.method} ${request.url} - Request ID: ${requestId}`
    );
    set.headers["X-Request-ID"] = requestId;
  })


  // Health check endpoint - returns empty 204 for monitoring
  .get("/health", ({ set }) => {
    set.status = 204;
    return "";
  })

  // Register all route plugins
  .use(authPlugin)
  .use(botConfigPlugin)
  .use(guildPlugin)
  .use(commandPlugin)
  .use(eventRoutes)

  // Global error handler
  .onError(({ error, set }) => {
    logger.error("[API] Unhandled error:", error);

    if (error instanceof Error && error.name === "ZodError") {
      set.status = 400;
      return {
        success: false,
        error: "Validation failed",
        details: error.message,
      };
    }

    set.status = 500;
    return {
      success: false,
      error: "Internal server error",
    };
  });

// Initialize services and start server
export async function startServer() {
  try {
    logger.info("[API] Starting server...");

    // Initialize services
    await DatabaseService.initialize();
    await RedisService.initialize();

    // Start the server
    app.listen(config.port);

    logger.info(`[API] Server listening on port ${config.port}`);
    logger.info(`[API] Environment: ${config.nodeEnv}`);
    logger.debug(`[API] CORS Origin: ${config.corsOrigin}`);

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      logger.info(`[API] Received ${signal}, shutting down gracefully...`);

      // Close database connections
      await DatabaseService.close();
      logger.info("[API] Database connections closed");

      // Close Redis connections
      await RedisService.close();
      logger.info("[API] Redis connections closed");

      process.exit(0);
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

    // Handle uncaught exceptions and unhandled rejections
    process.on("uncaughtException", (error) => {
      logger.error("[API] Uncaught Exception:", error);
      gracefulShutdown("UNCAUGHT_EXCEPTION");
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error(
        `[API] Unhandled Rejection at: ${promise}, reason: ${reason}`
      );
      gracefulShutdown("UNHANDLED_REJECTION");
    });

    return app;
  } catch (error) {
    logger.error("[API] Failed to start server:", error);
    process.exit(1);
  }
}
