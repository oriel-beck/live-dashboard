import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { config, validateConfig } from "./config";
import { swaggerSpec } from "./config/swagger";
import { attachUser } from "./middleware/auth";
import { httpMetrics, metricsHandler } from "./middleware/metrics";
import {
  corsOptions,
  createRateLimit,
  requestId,
  securityHeaders,
  securityLogger,
} from "./middleware/security";
import logger, { requestLogger } from "./utils/logger";

// Import routes
import authRoutes from "./routes/auth";
import commandRoutes from "./routes/commands";
import guildsRoutes from "./routes/guilds";

export function createApp() {
  // Validate configuration
  validateConfig();

  const app = express();

  // Security middleware (order matters!)
  app.use(requestId);
  app.use(securityHeaders);
  app.use(securityLogger);

  // CORS configuration
  app.use(cors(corsOptions));

  // Rate limiting
  if (config.features.rateLimiting) {
    app.use(createRateLimit());
  }

  // Body parsing middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cookieParser());

  // Attach user to request from session
  app.use(attachUser);

  // Enhanced request logging with correlation IDs
  app.use(requestLogger);

  // Metrics collection
  if (config.features.metrics) {
    app.use(httpMetrics);
  }

  // API Documentation
  if (config.nodeEnv !== "production") {
    app.use(
      "/api-docs",
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, {
        explorer: true,
        customCss: ".swagger-ui .topbar { display: none }",
        customSiteTitle: "Discord Bot Management Platform API",
      })
    );

    // Serve OpenAPI JSON
    app.get("/api-docs.json", (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.send(swaggerSpec);
    });
  }

  /**
   * @swagger
   * /health:
   *   get:
   *     summary: Health check
   *     description: Check the health status of the API
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service is healthy
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HealthCheck'
   *       503:
   *         description: Service is unhealthy or degraded
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HealthCheck'
   */
  app.get("/health", async (req, res) => {
    return res.status(200).json({
      success: true,
      message: "API is healthy",
    });
  });

  // Metrics endpoint
  if (config.features.metrics) {
    app.get("/metrics", metricsHandler);
  }

  // API routes
  app.use("/auth", authRoutes);
  app.use("/guilds", guildsRoutes);
  app.use("/commands", commandRoutes);

  // Error handling middleware
  app.use(
    (
      err: unknown,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      const requestId = req.id || "unknown";

      // Log error with request context
      logger.error("Unhandled error:", {
        error: err,
        requestId,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        body: req.body,
        query: req.query,
      });

      // Determine error type and status code
      let statusCode = 500;
      let message = "Internal server error";
      let errorCode = "INTERNAL_ERROR";

      if (err instanceof Error) {
        // Handle specific error types
        if (err.name === "ValidationError") {
          statusCode = 400;
          message = "Validation failed";
          errorCode = "VALIDATION_ERROR";
        } else if (err.name === "UnauthorizedError") {
          statusCode = 401;
          message = "Unauthorized";
          errorCode = "UNAUTHORIZED";
        } else if (err.name === "ForbiddenError") {
          statusCode = 403;
          message = "Forbidden";
          errorCode = "FORBIDDEN";
        } else if (err.name === "NotFoundError") {
          statusCode = 404;
          message = "Not found";
          errorCode = "NOT_FOUND";
        } else if (err.name === "ConflictError") {
          statusCode = 409;
          message = "Conflict";
          errorCode = "CONFLICT";
        } else if (err.name === "RateLimitError") {
          statusCode = 429;
          message = "Too many requests";
          errorCode = "RATE_LIMIT_EXCEEDED";
        }
      }

      const response: any = {
        success: false,
        error: message,
        code: errorCode,
        requestId,
        timestamp: new Date().toISOString(),
      };

      // Include additional details in development
      if (config.nodeEnv === "development") {
        response.details = err instanceof Error ? err.message : "Unknown error";
        response.stack = err instanceof Error ? err.stack : undefined;
      }

      res.status(statusCode).json(response);
    }
  );

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: "Endpoint not found",
      path: req.path,
    });
  });

  return app;
}
