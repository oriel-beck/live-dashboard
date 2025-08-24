import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config, validateConfig } from './config';
import { attachUser } from './middleware/auth';

// Import routes
import authRoutes from './routes/auth';
import guildRoutes from './routes/guilds';
import commandRoutes from './routes/commands';
import messageRoutes from './routes/messages';

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
    res.json({
      success: true,
      message: 'API is healthy',
      timestamp: new Date().toISOString(),
    });
  });

  // API routes
  app.use('/auth', authRoutes);
  app.use('/guilds', guildRoutes);
  app.use('/commands', commandRoutes);
  app.use('/messages', messageRoutes);

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: config.nodeEnv === 'development' ? err.message : 'Something went wrong',
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
