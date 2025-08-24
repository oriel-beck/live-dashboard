// API Types and Interfaces

export interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
  guilds?: UserGuild[];
}

export interface UserGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
  botHasAccess?: boolean; // Whether the bot has access to this guild
}

import { Request } from "express";

export interface SessionData {
  userId?: string;
  accessToken?: string;
  refreshToken?: string; // Add refresh token support
  expiresAt?: number; // Token expiration timestamp
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionId?: string;
  sessionData?: SessionData;
}

export interface GuildRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
}

export interface GuildChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
  permission_overwrites: any[];
}

export interface CommandPermissions {
  whitelistedRoles: string[];
  blacklistedRoles: string[];
  whitelistedChannels: string[];
  blacklistedChannels: string[];
  bypassRoles: string[];
}

export interface CommandConfig {
  id: string;
  commandId: string;
  guildId: string;
  enabled: boolean;
  permissions: CommandPermissions;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
