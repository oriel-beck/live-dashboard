// Export all schemas and types
export * from './schemas/user';
export * from './schemas/guild';
export * from './schemas/command';
export * from './schemas/discord';
export * from './schemas/api';
export * from './schemas/auth';
export * from './schemas/bot-config';
export * from './schemas/sse-events';

// Export all constants
export * from './constants/redis-contstants';

// Re-export Discord API types for convenience
export {
  APIUser,
  APIGuildMember,
  APIGuild,
  APIGuildChannel,
  APIRole,
  APIChannel,
  APIApplicationCommandPermission,
  APIGuildApplicationCommandPermissions,
  ChannelType,
  ApplicationCommandPermissionType,
  UserFlags,
  UserPremiumType,
} from 'discord-api-types/v10';

