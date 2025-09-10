import { z } from 'zod';

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

// Discord Permission Type Constants
export const DISCORD_PERMISSION_TYPES = {
  ROLE: 1,
  USER: 2,
  CHANNEL: 3,
} as const;

// Export types
export type ApplicationCommandPermission = z.infer<typeof ApplicationCommandPermissionSchema>;
export type GuildApplicationCommandPermissions = z.infer<typeof GuildApplicationCommandPermissionsSchema>;
