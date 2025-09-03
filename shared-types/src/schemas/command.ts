import { z } from 'zod';

// Command Permissions Schema
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
  commands: z.array(z.lazy((): z.ZodTypeAny => CommandConfigDataSchema)).optional(),
});

// Subcommand Config Schema
export const SubcommandConfigSchema = z.object({
  enabled: z.boolean(),
  cooldown: z.number(),
  permissions: CommandPermissionsSchema,
});

// Guild Command Config Schema
export const GuildCommandConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  guildId: z.string(),
  enabled: z.boolean(),
  cooldown: z.number(),
  permissions: CommandPermissionsSchema,
  subcommands: z.record(z.string(), SubcommandConfigSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CommandConfigDataSchema = z.object({
  id: z.number(),
  discordId: z.bigint().nullable(),
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
  categoryId: z.number().nullable(),
  category: CommandCategorySchema.nullable(),
  subcommands: z.record(
    z.string(),
    z.lazy((): z.ZodType<any> => CommandConfigDataSchema) // <-- annotate only here
  ).optional(),
});

// Command Config Update Schema
export const CommandConfigUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  whitelistedRoles: z.array(z.string()).optional(),
  blacklistedRoles: z.array(z.string()).optional(),
  whitelistedChannels: z.array(z.string()).optional(),
  blacklistedChannels: z.array(z.string()).optional(),
  bypassRoles: z.array(z.string()).optional(),
}).and(z.record(z.string(), z.unknown()));

// Command Info Schema
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
  subcommandConfig: SubcommandConfigSchema.optional(),
});

// Default Command Registration Schema
export const DefaultCommandRegistrationSchema = z.object({
  discordId: z.string().nullable().optional(),
  name: z.string(),
  description: z.string(),
  permissions: z.string(),
  enabled: z.boolean(),
  parentId: z.string().nullable().optional(),
  cooldown: z.number(),
});

// Default Command Registration Response Schema
export const DefaultCommandRegistrationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    id: z.string(),
    discordId: z.string().nullable(),
    name: z.string(),
    description: z.string(),
    cooldown: z.number(),
    permissions: z.string(),
    enabled: z.boolean(),
    parentId: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
});

// Command List Response Schema
export const CommandListResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.object({
    id: z.string(),
    discordId: z.string().nullable(),
    name: z.string(),
    description: z.string(),
    cooldown: z.number(),
    permissions: z.string(),
    enabled: z.boolean(),
    parentId: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })),
});

// Command Detail Response Schema
export const CommandDetailResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.string(),
    discordId: z.string().nullable(),
    name: z.string(),
    description: z.string(),
    cooldown: z.number(),
    permissions: z.string(),
    enabled: z.boolean(),
    parentId: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
});

// Export types
export type CommandPermissions = z.infer<typeof CommandPermissionsSchema>;
export type CommandCategory = z.infer<typeof CommandCategorySchema>;
export type SubcommandConfig = z.infer<typeof SubcommandConfigSchema>;
export type GuildCommandConfig = z.infer<typeof GuildCommandConfigSchema>;
export type CommandConfigData = z.infer<typeof CommandConfigDataSchema>;
export type CommandConfigUpdate = z.infer<typeof CommandConfigUpdateSchema>;
export type CommandInfo = z.infer<typeof CommandInfoSchema>;
export type PermissionCheckResult = z.infer<typeof PermissionCheckResultSchema>;
export type CommandExecutionContext = z.infer<typeof CommandExecutionContextSchema>;
export type DefaultCommandRegistration = z.infer<typeof DefaultCommandRegistrationSchema>;
export type DefaultCommandRegistrationResponse = z.infer<typeof DefaultCommandRegistrationResponseSchema>;
export type CommandListResponse = z.infer<typeof CommandListResponseSchema>;
export type CommandDetailResponse = z.infer<typeof CommandDetailResponseSchema>;
