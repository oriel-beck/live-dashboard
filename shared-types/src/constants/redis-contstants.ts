// Redis keys
export const REDIS_KEYS = {
  GUILD_SET: "bot:guilds:list",
  GUILD_INFO: (guildId: string) => `guild:${guildId}`,
  GUILD_ROLES: (guildId: string) => `guild:${guildId}:roles`,
  GUILD_CHANNELS: (guildId: string) => `guild:${guildId}:channels`,
  MEMBER_PERMS: (guildId: string, userId: string) =>
    `member:${guildId}:${userId}:perms`,
  GUILD_EVENTS: (guildId: string) => `events:guild:${guildId}`,
  USER_EVENTS: (userId: string) => `events:user:${userId}`,
  GUILD_COMMAND_PERMISSIONS: (guildId: string) =>
    `guild:${guildId}:command_permissions`,
  USER_GUILDS: (userId: string) => `user:${userId}:guilds`,
} as const;

// Cache TTL values (in seconds)
export const CACHE_TTL = {
  GUILD_BASICS: 24 * 60 * 60, // 24 hours
  GUILD_ROLES: 60 * 60, // 1 hour
  GUILD_CHANNELS: 60 * 60, // 1 hour
  MEMBER_PERMS: 30 * 60, // 30 minutes
  COMMAND_PERMISSIONS: 5 * 60, // 5 minutes
  USER_GUILDS: 5 * 60, // 5 minutes
} as const;
