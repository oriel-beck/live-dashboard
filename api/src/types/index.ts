// API Types and Interfaces

export interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string; // Made optional since we exclude it from session data for privacy
  guilds?: UserGuild[];
}

export interface UserGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features?: string[]; // Made optional since we're removing it from session data
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
  permission_overwrites: unknown[];
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

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Transformed types for cached data
export interface CachedGuildRole {
  id: string;
  name: string;
  position: number;
  color: number;
  permissions: string;
  managed: boolean;
  lastUpdated: number;
  // Note: hoist and mentionable are not cached
}

export interface CachedGuildChannel {
  id: string;
  name: string;
  type: number;
  parentId: string | null; // Note: transformed from parent_id
  position: number;
  lastUpdated: number;
  // Note: permission_overwrites are not cached
}

export interface CachedGuildInfo {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  lastUpdated: number;
  // Note: permissions and features are not cached
}

// Command configuration types
export interface CommandConfigData {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  permissions: string;
  enabled: boolean;
  whitelistedRoles: string[];
  blacklistedRoles: string[];
  whitelistedChannels: string[];
  blacklistedChannels: string[];
  bypassRoles: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
  categoryId: number | null;
  category: { name: string; id: number; description: string; createdAt: Date; updatedAt: Date; } | null;
  subcommands?: Record<string, CommandConfigData>;
}

export interface CommandConfigUpdate {
  enabled?: boolean;
  whitelistedRoles?: string[];
  blacklistedRoles?: string[];
  whitelistedChannels?: string[];
  blacklistedChannels?: string[];
  bypassRoles?: string[];
  [key: string]: unknown;
}

export interface CacheEntry<T> {
  data: T;
  expires: number;
}
