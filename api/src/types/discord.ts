// Discord API response types
export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner_id: string;
  features?: string[];
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
  permission_overwrites: unknown[];
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
  verified?: boolean;
  locale?: string;
  mfa_enabled?: boolean;
}

export interface DiscordUserGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features?: string[];
}

export interface DiscordCommandPermission {
  id: string;
  type: number;
  permission: boolean;
}

export interface DiscordGuildApplicationCommandPermissions {
  id: string;
  application_id: string;
  guild_id: string;
  permissions: DiscordCommandPermission[];
}
