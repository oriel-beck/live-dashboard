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
  CommandConfigUpdate,
} from '@discord-bot/shared-types';

export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionId?: string;
  sessionData?: SessionData;
  isBotRequest?: boolean;
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
  CommandConfigUpdate,
};
