import { z } from "zod";

export const DbDefaultCommandSchema = z.object({
  id: z.number(),
  discordId: z.bigint().nullable(),
  name: z.string(),
  description: z.string(),
  cooldown: z.number(),
  permissions: z.bigint(),
  enabled: z.boolean(),
  parentId: z.number().nullable(),
  categoryId: z.number().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  subcommands: z
    .array(
      z.lazy((): z.ZodTypeAny => DbDefaultCommandSchema) // just use ZodTypeAny
    )
    .optional(),
});

// Database Command Config Schema
export const DbCommandConfigSchema = z.object({
  guildId: z.string(),
  commandId: z.number(),
  enabled: z.boolean(),
  whitelistedRoles: z.array(z.string()),
  blacklistedRoles: z.array(z.string()),
  whitelistedChannels: z.array(z.string()),
  blacklistedChannels: z.array(z.string()),
  bypassRoles: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date(),
  defaultCommand: DbDefaultCommandSchema.optional(),
});

// Command Config Result Schema
export const CommandConfigResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  cooldown: z.number(),
  permissions: z.string(),
  enabled: z.boolean(),
  whitelistedRoles: z.array(z.string()),
  blacklistedRoles: z.array(z.string()),
  whitelistedChannels: z.array(z.string()),
  blacklistedChannels: z.array(z.string()),
  bypassRoles: z.array(z.string()),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
  subcommands: z.record(z.string(), z.unknown()),
  parentId: z.number().optional(),
  categoryId: z.number().optional(),
  discordId: z.bigint().optional(),
});

// Export types
export type DbDefaultCommand = z.infer<typeof DbDefaultCommandSchema>;
export type DbCommandConfig = z.infer<typeof DbCommandConfigSchema>;
export type CommandConfigResult = z.infer<typeof CommandConfigResultSchema>;
