import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { SessionService } from '../services/session';

// Middleware to check if user is authenticated
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  next();
}

// Middleware to check if user has access to a specific guild
export async function requireGuildAccess(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const guildId = req.params.guildId || req.params.serverId;
  if (!guildId) {
    return res.status(400).json({
      success: false,
      error: 'Guild ID is required'
    });
  }

  
  const hasAccess = await SessionService.hasGuildAccess(
    authReq.user.id, 
    guildId, 
    authReq.sessionId || ''
  );

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      error: 'You do not have access to this server'
    });
  }
  
  next();
}

// Middleware to attach user to request from session
export async function attachUser(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  const { SessionService } = await import('../services/session');
  await SessionService.attachUser(authReq, res, next);
}
