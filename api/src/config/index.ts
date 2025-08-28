import logger from '../utils/logger';

// Configuration settings
export const config = {
  // Server
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  
  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
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
};

// Validate required environment variables
export function validateConfig() {
  const required = [
    'BOT_TOKEN',
    'REDIS_HOST',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  logger.info('[Config] Configuration validated successfully');
}
