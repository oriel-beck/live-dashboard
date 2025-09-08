// Custom error classes for better error handling
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;
  public readonly requestId?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    requestId?: string
  ) {
    super(message);
    
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.requestId = requestId;
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
export class ValidationError extends AppError {
  constructor(message: string, requestId?: string) {
    super(message, 400, 'VALIDATION_ERROR', true, requestId);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', requestId?: string) {
    super(message, 401, 'UNAUTHORIZED', true, requestId);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', requestId?: string) {
    super(message, 403, 'FORBIDDEN', true, requestId);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not found', requestId?: string) {
    super(message, 404, 'NOT_FOUND', true, requestId);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', requestId?: string) {
    super(message, 409, 'CONFLICT', true, requestId);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests', requestId?: string) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true, requestId);
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, requestId?: string) {
    super(`External service error (${service}): ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', true, requestId);
    this.name = 'ExternalServiceError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, requestId?: string) {
    super(`Database error: ${message}`, 500, 'DATABASE_ERROR', true, requestId);
    this.name = 'DatabaseError';
  }
}

export class RedisError extends AppError {
  constructor(message: string, requestId?: string) {
    super(`Redis error: ${message}`, 500, 'REDIS_ERROR', true, requestId);
    this.name = 'RedisError';
  }
}

// Error handler utility
export const handleError = (error: Error, requestId?: string): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  // Handle specific error types
  if (error.name === 'ValidationError') {
    return new ValidationError(error.message, requestId);
  }

  if (error.name === 'UnauthorizedError') {
    return new UnauthorizedError(error.message, requestId);
  }

  if (error.name === 'ForbiddenError') {
    return new ForbiddenError(error.message, requestId);
  }

  if (error.name === 'NotFoundError') {
    return new NotFoundError(error.message, requestId);
  }

  if (error.name === 'ConflictError') {
    return new ConflictError(error.message, requestId);
  }

  if (error.name === 'RateLimitError') {
    return new RateLimitError(error.message, requestId);
  }

  // Handle database errors
  if (error.message.includes('database') || error.message.includes('connection')) {
    return new DatabaseError(error.message, requestId);
  }

  // Handle Redis errors
  if (error.message.includes('redis') || error.message.includes('Redis')) {
    return new RedisError(error.message, requestId);
  }

  // Handle Discord API errors
  if (error.message.includes('discord') || error.message.includes('Discord')) {
    return new ExternalServiceError('Discord', error.message, requestId);
  }

  // Default to internal server error
  return new AppError(
    error.message || 'Internal server error',
    500,
    'INTERNAL_ERROR',
    false,
    requestId
  );
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Error response formatter
export const formatErrorResponse = (error: AppError, includeStack: boolean = false) => {
  const response: any = {
    success: false,
    error: error.message,
    code: error.code,
    requestId: error.requestId,
    timestamp: new Date().toISOString(),
  };

  if (includeStack && error.stack) {
    response.stack = error.stack;
  }

  return response;
};
