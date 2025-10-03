// Redis keys
export const REDIS_KEYS = {
  GUILD_SET: "bot:guilds:list",
  GUILD_INFO: (guildId: string) => `guild:${guildId}`,
  GUILD_ROLES: (guildId: string) => `guild:${guildId}:roles`,
  GUILD_CHANNELS: (guildId: string) => `guild:${guildId}:channels`,
  GUILD_EVENTS: (guildId: string) => `events:guild:${guildId}`,
  GUILD_COMMAND_PERMISSIONS: (guildId: string) => `guild:${guildId}:command_permissions`,
  BOT_PROFILE: (guildId: string) => `bot_profile:${guildId}`,
  USER_EVENTS: (userId: string) => `events:user:${userId}`,
} as const;

// Cache TTL values (in seconds)
export const CACHE_TTL = {
  GUILD_BASICS: 24 * 60 * 60, // 24 hours
  GUILD_ROLES: 60 * 60, // 1 hour
  GUILD_CHANNELS: 60 * 60, // 1 hour
  COMMAND_PERMISSIONS: 5 * 60, // 5 minutes
  BOT_PROFILE: 10 * 60, // 10 minutes
} as const;
