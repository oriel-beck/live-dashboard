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

// Command Config Result With Category Schema (extends BaseCommandData with category)
export const CommandConfigResultWithCategorySchema = BaseCommandDataSchema.extend({
  category: CommandCategorySchema.optional(),
});

// Command Permissions Update Request Schema
export const CommandPermissionsUpdateSchema = z.object({
  permissions: z.array(z.object({
    id: z.string(),
    type: z.number().min(1).max(3), // 1 = role, 2 = user, 3 = channel
    permission: z.boolean(),
  })),
});

// Default Command Registration Schema (for bot to register commands)
export const DefaultCommandRegistrationSchema = z.object({
  name: z.string(),
  description: z.string(),
  cooldown: z.number().default(0),
  permissions: z.string().transform((val) => BigInt(val)).default('0'),
  enabled: z.boolean().default(true),
  categoryId: z.number().nullable().default(null),
  parentId: z.number().nullable().default(null),
  discordId: z.string().transform((val) => BigInt(val)).nullable().optional(),
});

// Command Config Update Schema (for updating command configurations)
export const CommandConfigUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  cooldown: z.number().optional(),
  permissions: z.string().optional(),
});

// Default Command Registration Response Schema
export const DefaultCommandRegistrationResponseSchema = z.object({
  success: z.boolean(),
  data: BaseCommandDataSchema,
});

// Export types
export type BaseCommandData = z.infer<typeof BaseCommandDataSchema>;
export type CommandCategory = z.infer<typeof CommandCategorySchema>;
export type CommandConfigResult = z.infer<typeof BaseCommandDataSchema>;
export type CommandConfigResultWithCategory = z.infer<typeof CommandConfigResultWithCategorySchema>;
export type CommandPermissionsUpdate = z.infer<typeof CommandPermissionsUpdateSchema>;
export type DefaultCommandRegistration = z.infer<typeof DefaultCommandRegistrationSchema>;
export type CommandConfigUpdate = z.infer<typeof CommandConfigUpdateSchema>;
export type DefaultCommandRegistrationResponse = z.infer<typeof DefaultCommandRegistrationResponseSchema>;
