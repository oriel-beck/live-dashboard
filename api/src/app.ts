import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config, validateConfig } from './config';
import { attachUser } from './middleware/auth';
import logger from './utils/logger';

// Import routes
import authRoutes from './routes/auth';
import guildRoutes from './routes/guilds';
import commandRoutes from './routes/commands';

export function createApp() {
  // Validate configuration
  validateConfig();

  const app = express();

  // CORS configuration
  app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
  }));

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Attach user to request from session
  app.use(attachUser);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(204).send(); // No content, just success
  });

  // API routes
  app.use('/auth', authRoutes);
  app.use('/guilds', guildRoutes);
  app.use('/commands', commandRoutes);

  // Error handling middleware
  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: config.nodeEnv === 'development' ? (err instanceof Error ? err.message : 'Unknown error') : 'Something went wrong',
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      path: req.path,
    });
  });

  return app;
}
