// API Types and Interfaces - Using shared types where available
import { Request } from "express";
import {
  User,
  UserGuild,
  GuildRole,
  GuildChannel,
  ApiResponse,
} from '@discord-bot/shared-types';

// Cached types for Redis storage
export interface CachedGuildRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
}

export interface CachedGuildChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
  permission_overwrites: unknown[];
}

export interface CachedGuildInfo {
  id: string;
  name: string;
  icon: string | null;
  owner_id: string;
}

// Re-export shared types for convenience
export {
  User,
  UserGuild,
  GuildRole,
  GuildChannel,
  ApiResponse,
};
