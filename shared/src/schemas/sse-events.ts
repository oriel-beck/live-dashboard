import { CommandConfigResultWithCategory } from './command';
import { ApplicationCommandPermission, GuildApplicationCommandPermissions } from './discord';
import { BotProfile, GuildChannel, GuildInfo, GuildRole } from './guild';

// SSE Event Type Constants
export const SSE_EVENT_TYPES = {
  // Initial data loading events (sent by API)
  GUILD_INFO_LOADED: 'guild.load',
  GUILD_INFO_FAILED: 'guild.load.failed',
  ROLES_LOADED: 'roles.load',
  ROLES_FAILED: 'roles.load.failed',
  CHANNELS_LOADED: 'channels.load',
  CHANNELS_FAILED: 'channels.load.failed',
  COMMANDS_LOADED: 'commands.load',
  COMMANDS_FAILED: 'commands.load.failed',
  COMMAND_PERMISSIONS_LOADED: 'command.permissions.load',
  COMMAND_PERMISSIONS_FAILED: 'command.permissions.load.failed',
  BOT_PROFILE_LOADED: 'bot.profile.load',
  BOT_PROFILE_FAILED: 'bot.profile.load.failed',
  
  // Error events
  GUILD_FETCH_FAILED: 'guild.fetch.failed',
  
  // Real-time update events (sent by bot)
  GUILD_UPDATE: 'guild.update',
  GUILD_DELETE: 'guild.delete',
  ROLE_CREATE: 'role.create',
  ROLE_UPDATE: 'role.update',
  ROLE_DELETE: 'role.delete',
  CHANNEL_CREATE: 'channel.create',
  CHANNEL_UPDATE: 'channel.update',
  CHANNEL_DELETE: 'channel.delete',
  COMMAND_PERMISSIONS_UPDATE: 'command.permissions.update',
  MEMBER_PERMS_UPDATE: 'member.perms.update',
  BOT_PROFILE_UPDATE: 'bot.profile.update',
} as const;

export type SSEEventType = typeof SSE_EVENT_TYPES[keyof typeof SSE_EVENT_TYPES];

// Base SSE Event interface
export interface BaseSSEEvent {
  type: SSEEventType;
  guildId?: string;
  error?: string;
}

// Initial data loading events
export interface GuildInfoLoadedEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.GUILD_INFO_LOADED;
  data: GuildInfo;
}

export interface GuildInfoFailedEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.GUILD_INFO_FAILED;
  data: string; // error message
}

export interface RolesLoadedEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.ROLES_LOADED;
  data: GuildRole[];
}

export interface RolesFailedEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.ROLES_FAILED;
  data: string; // error message
}

export interface ChannelsLoadedEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.CHANNELS_LOADED;
  data: GuildChannel[];
}

export interface ChannelsFailedEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.CHANNELS_FAILED;
  data: string; // error message
}

export interface CommandsLoadedEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.COMMANDS_LOADED;
  data: CommandConfigResultWithCategory[];
}

export interface CommandsFailedEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.COMMANDS_FAILED;
  data: string; // error message
}

export interface CommandPermissionsLoadedEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.COMMAND_PERMISSIONS_LOADED;
  data: GuildApplicationCommandPermissions[];
}

export interface CommandPermissionsFailedEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.COMMAND_PERMISSIONS_FAILED;
  data: string; // error message
}

export interface BotProfileLoadedEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.BOT_PROFILE_LOADED;
  data: {
    guildProfile: BotProfile;
    globalProfile: BotProfile;
  };
}

export interface BotProfileFailedEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.BOT_PROFILE_FAILED;
  data: string; // error message
}

// Error events
export interface GuildFetchFailedEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.GUILD_FETCH_FAILED;
  data: {
    guildId: string;
    error: string;
  };
}

// Real-time update events
export interface GuildUpdateEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.GUILD_UPDATE;
  guildId: string;
  data: GuildInfo;
}

export interface GuildDeleteEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.GUILD_DELETE;
  guildId: string;
}

export interface RoleCreateEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.ROLE_CREATE;
  roleId: string;
  data: GuildRole;
}

export interface RoleUpdateEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.ROLE_UPDATE;
  roleId: string;
  data: GuildRole;
}

export interface RoleDeleteEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.ROLE_DELETE;
  roleId: string;
}

export interface ChannelCreateEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.CHANNEL_CREATE;
  channelId: string;
  data: GuildChannel;
}

export interface ChannelUpdateEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.CHANNEL_UPDATE;
  channelId: string;
  data: GuildChannel;
}

export interface ChannelDeleteEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.CHANNEL_DELETE;
  channelId: string;
}

export interface CommandPermissionsUpdateEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.COMMAND_PERMISSIONS_UPDATE;
  guildId: string;
  commandId: string;
  permissions: ApplicationCommandPermission[];
}

export interface MemberPermsUpdateEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.MEMBER_PERMS_UPDATE;
  guildId: string;
  perms: string;
}

export interface BotProfileUpdateEvent extends BaseSSEEvent {
  type: typeof SSE_EVENT_TYPES.BOT_PROFILE_UPDATE;
  data: BotProfile;
}

// Union type for all SSE events
export type SSEEvent =
  | GuildInfoLoadedEvent
  | GuildInfoFailedEvent
  | RolesLoadedEvent
  | RolesFailedEvent
  | ChannelsLoadedEvent
  | ChannelsFailedEvent
  | CommandsLoadedEvent
  | CommandsFailedEvent
  | CommandPermissionsLoadedEvent
  | CommandPermissionsFailedEvent
  | BotProfileLoadedEvent
  | BotProfileFailedEvent
  | GuildFetchFailedEvent
  | GuildUpdateEvent
  | GuildDeleteEvent
  | RoleCreateEvent
  | RoleUpdateEvent
  | RoleDeleteEvent
  | ChannelCreateEvent
  | ChannelUpdateEvent
  | ChannelDeleteEvent
  | CommandPermissionsUpdateEvent
  | MemberPermsUpdateEvent
  | BotProfileUpdateEvent;
