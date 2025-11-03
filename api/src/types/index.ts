// API Types and Interfaces - Using shared types where available
import {
  User,
  UserGuild,
  GuildRole,
  GuildChannel,
  ApiResponse,
} from "@discord-bot/shared-types";

// Cached types for Redis storage
export interface CachedGuildRole {
  id: string;
  name: string;
  position: number;
  permissions: string;
  managed: boolean;
}

export interface CachedGuildChannel {
  id: string;
  name: string;
  position: number;
  botPermissions: string;
}

// Re-export shared types for convenience
export { User, UserGuild, GuildRole, GuildChannel, ApiResponse };
