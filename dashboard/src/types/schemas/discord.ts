// Discord permission type constants
export const DISCORD_PERMISSION_TYPES = {
  ROLE: 1,
  USER: 2,
  CHANNEL: 3,
} as const;

// Types manually defined since we only need the types, not the schemas
export type ApplicationCommandPermission = {
  id: string;
  type: number;
  permission: boolean;
};

export type GuildApplicationCommandPermissions = {
  id: string;
  application_id: string;
  guild_id: string;
  permissions: ApplicationCommandPermission[];
};

