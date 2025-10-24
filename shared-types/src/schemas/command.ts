import { z } from 'zod';

// Base Command Data Schema - reusable across different contexts  
const BaseCommandDataSchema = z.object({
  id: z.number(),
  discordId: z.bigint().nullable(),
  name: z.string(),
  description: z.string(),
  cooldown: z.number(),
  permissions: z.string(),
  enabled: z.boolean(),
  parentId: z.number().nullable(),
  categoryId: z.number().nullable(),
  filePath: z.string().nullable(),
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
  filePath: z.string().nullable().default(null),
});


// Default Command Registration Response Schema
export const DefaultCommandRegistrationResponseSchema = z.object({
  success: z.boolean(),
  data: BaseCommandDataSchema,
});

// Export types
export type CommandConfigResult = z.infer<typeof BaseCommandDataSchema>;
export type CommandPermissionsUpdate = z.infer<typeof CommandPermissionsUpdateSchema>;
export type DefaultCommandRegistration = z.infer<typeof DefaultCommandRegistrationSchema>;
export type DefaultCommandRegistrationResponse = z.infer<typeof DefaultCommandRegistrationResponseSchema>;

// Extended type for command results with category information
export type CommandConfigResultWithCategory = CommandConfigResult & {
  category?: {
    id: number;
    name: string;
    description: string;
  };
  subcommands?: CommandConfigResult[];
};

// Add command category type  
export type CommandCategory = {
  id: number;
  name: string;
  description: string;
  commands?: CommandConfigResultWithCategory[];
};

// Command permissions response type
export type CommandPermissionsResponse = {
  success: boolean;
  data?: any;
  error?: string;
};