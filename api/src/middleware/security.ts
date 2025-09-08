import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';
import { config } from '../config';
import logger from '../utils/logger';

// Rate limiting middleware
export const createRateLimit = (options?: {
  windowMs?: number;
  max?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) => {
  const {
    windowMs = config.security.rateLimit.windowMs,
    max = config.security.rateLimit.maxRequests,
    message = 'Too many requests from this IP, please try again later.',
    skipSuccessfulRequests = config.security.rateLimit.skipSuccessfulRequests,
  } = options || {};

  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req: Request, res: Response) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
      });
      
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
};

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://discord.com"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// Input validation middleware
export const validateInput = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.parse(req.body);
      req.body = result;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorDetails = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        logger.warn('Input validation failed', {
          errors: errorDetails,
          body: req.body,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });

        return res.status(400).json({
          error: 'Validation failed',
          details: errorDetails,
        });
      }

      // Handle unexpected errors
      logger.error('Unexpected validation error', error);
      return res.status(500).json({
        error: 'Internal validation error',
      });
    }
  };
};

// Query parameter validation middleware
export const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.parse(req.query);
      // Replace the query object properties instead of direct assignment
      Object.keys(req.query).forEach(key => delete req.query[key]);
      Object.assign(req.query, result);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorDetails = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        logger.warn('Query validation failed', {
          errors: errorDetails,
          query: req.query,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });

        return res.status(400).json({
          error: 'Query validation failed',
          details: errorDetails,
        });
      }

      // Handle unexpected errors
      logger.error('Unexpected query validation error', error);
      return res.status(500).json({
        error: 'Internal validation error',
      });
    }
  };
};

// Path parameter validation middleware
export const validateParams = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.parse(req.params);
      // Replace the params object properties instead of direct assignment
      Object.keys(req.params).forEach(key => delete req.params[key]);
      Object.assign(req.params, result);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorDetails = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        logger.warn('Parameter validation failed', {
          errors: errorDetails,
          params: req.params,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });

        return res.status(400).json({
          error: 'Parameter validation failed',
          details: errorDetails,
        });
      }

      // Handle unexpected errors
      logger.error('Unexpected parameter validation error', error);
      return res.status(500).json({
        error: 'Internal validation error',
      });
    }
  };
};

// Common validation schemas
export const validationSchemas = {
  guildId: z.object({
    guildId: z.string().regex(/^\d{17,19}$/, 'Invalid Discord guild ID format'),
  }),

  command: z.object({
    name: z.string().min(1, 'Command name is required').max(32, 'Command name too long'),
    description: z.string().min(1, 'Description is required').max(100, 'Description too long'),
    categoryId: z.string().uuid('Invalid category ID format').optional(),
    enabled: z.boolean().default(true),
    cooldown: z.number().min(0, 'Cooldown must be non-negative').max(3600, 'Cooldown too long').default(0),
    permissions: z.array(z.string()).default([]),
    channels: z.array(z.string()).default([]),
    roles: z.array(z.string()).default([]),
  }),

  category: z.object({
    name: z.string().min(1, 'Category name is required').max(50, 'Category name too long'),
    description: z.string().min(1, 'Description is required').max(200, 'Description too long').optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
    icon: z.string().min(1, 'Icon is required').max(50, 'Icon name too long').optional(),
  }),

  user: z.object({
    username: z.string().min(1, 'Username is required').max(32, 'Username too long').optional(),
    email: z.string().email('Invalid email format').optional(),
  }),

  commandPermissions: z.object({
    permissions: z.array(z.object({
      id: z.string(),
      type: z.number().min(1).max(2), // 1 = role, 2 = user
      permission: z.boolean(),
    })),
  }),

  guildUpdate: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(200).optional(),
    icon: z.string().optional(),
  }),

  // Query parameter schemas
  pagination: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('10'),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('asc'),
  }),

  // Path parameter schemas
  guildIdParam: z.object({
    guildId: z.string().regex(/^\d{17,19}$/, 'Invalid Discord guild ID format'),
  }),

  commandIdParam: z.object({
    commandId: z.string().regex(/^\d+$/, 'Invalid command ID format'),
  }),
};

// CORS configuration
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = config.corsOrigin.split(',').map(o => o.trim());
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Client-ID'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
};

// Security logging middleware
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Log security-relevant information
  const securityInfo = {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    origin: req.get('Origin'),
    method: req.method,
    path: req.path,
    query: req.query,
    timestamp: new Date().toISOString(),
  };

  // Log suspicious patterns
  const suspiciousPatterns = [
    /\.\./, // Path traversal
    /<script/i, // XSS attempts
    /union\s+select/i, // SQL injection
    /javascript:/i, // JavaScript protocol
    /on\w+\s*=/i, // Event handlers
  ];

  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(req.path) || 
    pattern.test(JSON.stringify(req.query)) ||
    pattern.test(JSON.stringify(req.body))
  );

  if (isSuspicious) {
    logger.warn('Suspicious request detected', securityInfo);
  }

  // Log response time and status
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    if (res.statusCode >= 400) {
      logger.warn('Request completed with error', {
        ...securityInfo,
        statusCode: res.statusCode,
        duration,
      });
    }
  });

  next();
};

// API key authentication middleware (for bot-to-API communication)
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
    });
  }

  // In a real implementation, you would validate the API key against a database
  // For now, we'll use a simple environment variable check
  const validApiKey = process.env.API_KEY;
  
  if (!validApiKey || apiKey !== validApiKey) {
    logger.warn('Invalid API key attempt', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      providedKey: apiKey.substring(0, 8) + '...', // Log partial key for debugging
    });
    
    return res.status(401).json({
      error: 'Invalid API key',
    });
  }

  next();
};

// Request ID middleware for correlation
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const id = req.headers['x-request-id'] as string || 
             `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  req.id = id;
  res.setHeader('X-Request-ID', id);
  
  next();
};

// Extend Request interface to include id
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}
