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

// Command Category Schema
export const CommandCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  commands: z.array(z.lazy((): z.ZodTypeAny => BaseCommandDataSchema)).optional(),
});

// Command Config Update Schema (for enabling/disabling commands only)
export const CommandConfigUpdateSchema = z.object({
  enabled: z.boolean().optional(),
}).and(z.record(z.string(), z.unknown()));

// Removed unused schemas: CommandInfoSchema, PermissionCheckResultSchema, CommandExecutionContextSchema

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

// Command Config Result With Category Schema (extends BaseCommandData with category)
export const CommandConfigResultWithCategorySchema = BaseCommandDataSchema.extend({
  category: CommandCategorySchema.optional(),
});

export const DefaultCommandRegistrationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: BaseCommandDataSchema,
});

// Export types
export type BaseCommandData = z.infer<typeof BaseCommandDataSchema>;
export type CommandCategory = z.infer<typeof CommandCategorySchema>;
export type CommandConfigUpdate = z.infer<typeof CommandConfigUpdateSchema>;
export type DefaultCommandRegistration = z.infer<typeof DefaultCommandRegistrationSchema>;
export type CommandConfigResult = z.infer<typeof BaseCommandDataSchema>;
export type CommandConfigResultWithCategory = z.infer<typeof CommandConfigResultWithCategorySchema>;
export type DefaultCommandRegistrationResponse = z.infer<typeof DefaultCommandRegistrationResponseSchema>;
