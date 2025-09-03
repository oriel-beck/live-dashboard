import { z } from "zod";
import { BaseCommandDataSchema, CommandCategorySchema } from "./command";

// Database-specific command schema (for Prisma operations)
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

// Database Command Config Schema (for guild-specific overrides)
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

// Command Config Result Schema (API response format)
export const CommandConfigResultSchema = z.intersection(BaseCommandDataSchema, z.object({
  whitelistedRoles: z.array(z.string()),
  blacklistedRoles: z.array(z.string()),
  whitelistedChannels: z.array(z.string()),
  blacklistedChannels: z.array(z.string()),
  bypassRoles: z.array(z.string()),
  subcommands: z.record(z.string(), z.lazy((): z.ZodTypeAny => CommandConfigResultSchema)),
}));

export const CommandConfigResultWithCategorySchema = z.intersection(CommandConfigResultSchema, z.object({
  categoryId: z.number().nullable(),
  category: CommandCategorySchema.optional(),
}));

// Export types
export type DbDefaultCommand = z.infer<typeof DbDefaultCommandSchema>;
export type DbCommandConfig = z.infer<typeof DbCommandConfigSchema>;
export type CommandConfigResult = z.infer<typeof CommandConfigResultSchema>;
export type CommandConfigResultWithCategory = z.infer<typeof CommandConfigResultWithCategorySchema>;