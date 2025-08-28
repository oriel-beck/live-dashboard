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

// Guild Info Schema
export const GuildInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  owner_id: z.string(),
});

// Cached Guild Role Schema
export const CachedGuildRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number(),
  color: z.number(),
  permissions: z.string(),
  managed: z.boolean(),
  lastUpdated: z.number(),
});

// Cached Guild Channel Schema
export const CachedGuildChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.number(),
  parentId: z.string().nullable(),
  position: z.number(),
  lastUpdated: z.number(),
});

// Cached Guild Info Schema
export const CachedGuildInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  owner: z.boolean(),
  lastUpdated: z.number(),
});

// Export types
export type GuildRole = z.infer<typeof GuildRoleSchema>;
export type GuildChannel = z.infer<typeof GuildChannelSchema>;
export type GuildInfo = z.infer<typeof GuildInfoSchema>;
export type CachedGuildRole = z.infer<typeof CachedGuildRoleSchema>;
export type CachedGuildChannel = z.infer<typeof CachedGuildChannelSchema>;
export type CachedGuildInfo = z.infer<typeof CachedGuildInfoSchema>;
