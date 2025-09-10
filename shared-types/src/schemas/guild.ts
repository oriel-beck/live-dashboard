import { z } from 'zod';

// Guild Role Schema
export const GuildRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.number(),
  hoist: z.boolean(),
  position: z.number(),
  permissions: z.string(),
  managed: z.boolean(),
  mentionable: z.boolean(),
});

// Guild Channel Schema
export const GuildChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.number(),
  position: z.number(),
  parent_id: z.string().nullable(),
  permission_overwrites: z.array(z.unknown()),
});

// Guild Info Schema (simplified for our use)
export const GuildInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  owner_id: z.string(),
});

// Minimal Guild Schema (only fields we actually use)
export const GuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  owner_id: z.string(),
  owner: z.boolean().optional(),
  permissions: z.string().optional(),
});

// Export types
export type GuildRole = z.infer<typeof GuildRoleSchema>;
export type GuildChannel = z.infer<typeof GuildChannelSchema>;
export type GuildInfo = z.infer<typeof GuildInfoSchema>;
export type Guild = z.infer<typeof GuildSchema>;
