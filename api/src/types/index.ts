// API Types and Interfaces - Now using shared types
import { Request } from "express";
import {
  User,
  UserGuild,
  SessionData,
  GuildRole,
  GuildChannel,
  CommandPermissions,
  ApiResponse,
  CachedGuildRole,
  CachedGuildChannel,
  CachedGuildInfo,
  CommandConfigData,
  CommandConfigUpdate,
} from '@discord-bot/shared-types';

export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionId?: string;
  sessionData?: SessionData;
}

// Re-export shared types for convenience
export {
  User,
  UserGuild,
  SessionData,
  GuildRole,
  GuildChannel,
  CommandPermissions,
  ApiResponse,
  CachedGuildRole,
  CachedGuildChannel,
  CachedGuildInfo,
  CommandConfigData,
  CommandConfigUpdate,
};
