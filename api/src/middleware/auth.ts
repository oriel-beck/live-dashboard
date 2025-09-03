import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../types";
import { SessionService } from "../services/session";

// Middleware to check if user is authenticated OR if it's a bot request
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  
  // Check if it's a bot request first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const expectedToken = process.env.BOT_TOKEN;
    
    if (expectedToken && token === expectedToken) {
      // Mark request as bot-authenticated
      authReq.isBotRequest = true;
      return next();
    }
  }
  
  // If not a bot request, check for user authentication
  if (!authReq.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
    });
  }
  
  next();
}

// Middleware to check if user has access to a specific guild
export async function requireGuildAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authReq = req as AuthenticatedRequest;
  
  // Allow bot requests to bypass user authentication
  if (authReq.isBotRequest) {
    return next();
  }
  
  if (!authReq.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
    });
  }

  const guildId = req.params.guildId || req.params.serverId;
  if (!guildId) {
    return res.status(400).json({
      success: false,
      error: "Guild ID is required",
    });
  }

  const hasAccess = await SessionService.hasGuildAccess(
    guildId,
    authReq.sessionId || ""
  );

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      error: "You do not have access to this server",
    });
  }

  next();
}

// Middleware to check if request is from the bot (internal API call)
export function requireBotAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: "Bot token required",
    });
  }
  
  const token = authHeader.substring(7);
  const expectedToken = process.env.BOT_TOKEN;
  
  if (!expectedToken || token !== expectedToken) {
    return res.status(401).json({
      success: false,
      error: "Invalid bot token",
    });
  }
  
  // Mark request as bot-authenticated
  const authReq = req as AuthenticatedRequest;
  authReq.isBotRequest = true;
  next();
}

// Middleware to attach user to request from session
export async function attachUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authReq = req as AuthenticatedRequest;
  const { SessionService } = await import("../services/session");
  await SessionService.attachUser(authReq, res, next);
}
