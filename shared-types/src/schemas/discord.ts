import { z } from 'zod';

// Discord Application Command Permission Type Schema
export const ApplicationCommandPermissionTypeSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

// Discord Application Command Permission Schema
export const ApplicationCommandPermissionSchema = z.object({
  id: z.string(), // snowflake - ID of the role, user, or channel, or permission constant
  type: z.number().min(1).max(3), // 1 for role, 2 for user, 3 for channel
  permission: z.boolean(), // true to allow, false to disallow
});

// Discord Guild Application Command Permissions Schema
export const GuildApplicationCommandPermissionsSchema = z.object({
  id: z.string(), // snowflake - ID of the command or the application ID
  application_id: z.string(), // snowflake - ID of the application the command belongs to
  guild_id: z.string(), // snowflake - ID of the guild
  permissions: z.array(ApplicationCommandPermissionSchema).max(100), // max of 100
});

// Discord Application Command Schema
export const DiscordApplicationCommandSchema = z.object({
  id: z.string(), // snowflake - ID of the command
  application_id: z.string(), // snowflake - ID of the application
  guild_id: z.string().optional(), // snowflake - ID of the guild (for guild commands)
  name: z.string(), // name of the command
  description: z.string(), // description of the command
  version: z.string(), // version of the command
  default_member_permissions: z.string().nullable(), // default permissions for the command
  type: z.number().optional(), // type of the command (1 = slash, 2 = user, 3 = message)
  nsfw: z.boolean().optional(), // whether the command is NSFW
  options: z.array(z.unknown()).optional(), // command options/parameters
});

// Discord Permission Type Constants
export const DISCORD_PERMISSION_TYPES = {
  ROLE: 1,
  USER: 2,
  CHANNEL: 3,
} as const;

// Discord Permission Constants
// These are special values that can be used in the id field for command permissions
export const DISCORD_PERMISSION_CONSTANTS = {
  // @everyone - All members in a guild (use guild_id as the value)
  EVERYONE: 'everyone',
  // All Channels - All channels in a guild (use guild_id - 1 as the value)
  ALL_CHANNELS: 'all_channels',
} as const;

// Export types
export type ApplicationCommandPermissionType = z.infer<typeof ApplicationCommandPermissionTypeSchema>;
export type ApplicationCommandPermission = z.infer<typeof ApplicationCommandPermissionSchema>;
export type GuildApplicationCommandPermissions = z.infer<typeof GuildApplicationCommandPermissionsSchema>;
export type DiscordApplicationCommand = z.infer<typeof DiscordApplicationCommandSchema>;
