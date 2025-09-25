// Configuration settings
export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  
  // Database
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/discord_bot',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
    database: process.env.POSTGRES_DB || 'discord_bot',
  },
  
  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0'),
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  // Discord
  discord: {
    botToken: process.env.BOT_TOKEN!,
    clientId: process.env.DISCORD_CLIENT_ID, 
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirectUri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/auth/discord/callback',
    apiUrl: 'https://discord.com/api/v10',
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  // Session
  session: {
    secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-in-production',
    maxAge: parseInt(process.env.SESSION_MAX_AGE || '604800000'), // 7 days
  },
  
  // Security
  security: {
    rateLimit: {
      windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      maxRequests: parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS || '100'),
      skipSuccessfulRequests: process.env.API_RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS === 'true',
    },
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
  },
  
  // Monitoring
  monitoring: {
    healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000'),
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
    metricsEnabled: process.env.METRICS_ENABLED === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
  },
  
  // Feature Flags
  features: {
    rateLimiting: process.env.FEATURE_RATE_LIMITING === 'true',
    metrics: process.env.FEATURE_METRICS === 'true',
  },
};

// Enhanced environment validation
export function validateConfig() {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required environment variables
  const required = [
    'BOT_TOKEN',
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    errors.push(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Security validation
  if (config.jwt.secret === 'your-super-secret-jwt-key-change-in-production') {
    warnings.push('JWT_SECRET is using default value - change for production');
  }
  
  if (config.session.secret === 'your-super-secret-session-key-change-in-production') {
    warnings.push('SESSION_SECRET is using default value - change for production');
  }
  
  // Secret strength validation
  if (config.jwt.secret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long');
  }
  
  if (config.session.secret.length < 32) {
    errors.push('SESSION_SECRET must be at least 32 characters long');
  }
  
  // Port validation
  if (config.port < 1 || config.port > 65535 || isNaN(config.port)) {
    errors.push('PORT must be between 1 and 65535');
  }
  
  // Environment-specific validation
  if (config.nodeEnv === 'production') {
    if (config.corsOrigin.includes('localhost')) {
      warnings.push('CORS_ORIGIN contains localhost in production environment');
    }
    
    if (config.logging.level === 'debug') {
      warnings.push('LOG_LEVEL is set to debug in production environment');
    }
  }
  
  // Log validation results
  if (errors.length > 0) {
    console.error('[Config] Configuration validation failed:', errors);
    throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
  }
  
  if (warnings.length > 0) {
    console.warn('[Config] Configuration warnings:', warnings);
  }
  
  console.info('[Config] Configuration validated successfully');
  console.info(`[Config] Environment: ${config.nodeEnv}`);
  console.info(`[Config] Port: ${config.port}`);
  console.info(`[Config] CORS Origin: ${config.corsOrigin}`);
  console.info(`[Config] Redis: ${config.redis.host}:${config.redis.port}`);
  console.info(`[Config] Database: ${config.database.host}:${config.database.port}/${config.database.database}`);
}
