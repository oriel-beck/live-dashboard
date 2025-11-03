import { z } from 'zod';

// Guild Role Schema
export const GuildRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number(),
  permissions: z.string(),
  managed: z.boolean(),
});

// Guild Channel Schema
export const GuildChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number(),
  botPermissions: z.string(),
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

// Bot Profile Schema
export const BotProfileSchema = z.object({
  nickname: z.string().nullable(),
  globalName: z.string().nullable(),
  username: z.string(),
  avatar: z.string().nullable(),
  banner: z.string().nullable(),
  permissions: z.string(), // Bot's permissions in the guild as a string
});

// Export types
export type GuildRole = z.infer<typeof GuildRoleSchema>;
export type GuildChannel = z.infer<typeof GuildChannelSchema>;
export type GuildInfo = z.infer<typeof GuildInfoSchema>;
export type Guild = z.infer<typeof GuildSchema>;
export type BotProfile = z.infer<typeof BotProfileSchema>;