import { z } from 'zod';

// Base Command Data Schema - reusable across different contexts
export const BaseCommandDataSchema = z.object({
  id: z.number(),
  discordId: z.bigint().nullable(),
  name: z.string(),
  description: z.string(),
  cooldown: z.number(),
  permissions: z.string(),
  enabled: z.boolean(),
  parentId: z.number().nullable(),
  categoryId: z.number().nullable(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

// Command Permissions Schema (for detailed permission objects)
export const CommandPermissionsSchema = z.object({
  whitelistedRoles: z.array(z.string()),
  blacklistedRoles: z.array(z.string()),
  whitelistedChannels: z.array(z.string()),
  blacklistedChannels: z.array(z.string()),
  bypassRoles: z.array(z.string()),
});

// Command Category Schema
export const CommandCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  commands: z.array(z.lazy((): z.ZodTypeAny => BaseCommandDataSchema)).optional(),
});

// Guild-specific command config (extends base with guild-specific fields)
export const GuildCommandConfigSchema = z.intersection(BaseCommandDataSchema, z.object({
  guildId: z.string(),
  whitelistedRoles: z.array(z.string()),
  blacklistedRoles: z.array(z.string()),
  whitelistedChannels: z.array(z.string()),
  blacklistedChannels: z.array(z.string()),
  bypassRoles: z.array(z.string()),
  subcommands: z.record(z.string(), z.lazy((): z.ZodTypeAny => GuildCommandConfigSchema)).optional(),
}));

// Command Config Update Schema
export const CommandConfigUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  whitelistedRoles: z.array(z.string()).optional(),
  blacklistedRoles: z.array(z.string()).optional(),
  whitelistedChannels: z.array(z.string()).optional(),
  blacklistedChannels: z.array(z.string()).optional(),
  bypassRoles: z.array(z.string()).optional(),
}).and(z.record(z.string(), z.unknown()));

// Command Info Schema (minimal info for lists)
export const CommandInfoSchema = z.object({
  name: z.string(),
  description: z.string(),
});

// Permission Check Result Schema
export const PermissionCheckResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
  bypassUsed: z.boolean().optional(),
});

// Command Execution Context Schema
export const CommandExecutionContextSchema = z.object({
  interaction: z.unknown(), // Discord.js interaction type
  definition: z.unknown(), // Command definition type
  guildConfig: GuildCommandConfigSchema,
  subcommandConfig: GuildCommandConfigSchema.optional(),
});

// Default Command Registration Schema
export const DefaultCommandRegistrationSchema = BaseCommandDataSchema.pick({
  discordId: true,
  name: true,
  description: true,
  permissions: true,
  enabled: true,
  parentId: true,
  cooldown: true,
});

// Generic API Response Schema
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

// Command Response Schemas (reusing BaseCommandDataSchema)
export const CommandResponseSchema = BaseCommandDataSchema;

export const DefaultCommandRegistrationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: CommandResponseSchema,
});

export const CommandListResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(CommandResponseSchema),
});

export const CommandDetailResponseSchema = z.object({
  success: z.boolean(),
  data: CommandResponseSchema,
});

// Export types
export type BaseCommandData = z.infer<typeof BaseCommandDataSchema>;
export type CommandPermissions = z.infer<typeof CommandPermissionsSchema>;
export type CommandCategory = z.infer<typeof CommandCategorySchema>;
export type GuildCommandConfig = z.infer<typeof GuildCommandConfigSchema>;
export type CommandConfigUpdate = z.infer<typeof CommandConfigUpdateSchema>;
export type CommandInfo = z.infer<typeof CommandInfoSchema>;
export type PermissionCheckResult = z.infer<typeof PermissionCheckResultSchema>;
export type CommandExecutionContext = z.infer<typeof CommandExecutionContextSchema>;
export type DefaultCommandRegistration = z.infer<typeof DefaultCommandRegistrationSchema>;
export type ApiResponse<T = unknown> = z.infer<typeof ApiResponseSchema> & { data?: T };
export type CommandResponse = z.infer<typeof CommandResponseSchema>;
export type DefaultCommandRegistrationResponse = z.infer<typeof DefaultCommandRegistrationResponseSchema>;
export type CommandListResponse = z.infer<typeof CommandListResponseSchema>;
export type CommandDetailResponse = z.infer<typeof CommandDetailResponseSchema>;
