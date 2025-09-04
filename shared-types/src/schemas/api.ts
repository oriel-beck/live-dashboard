import { z } from 'zod';
import { GuildApplicationCommandPermissionsSchema } from './discord';

// Generic API Response Schema
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

// Export types
export type ApiResponse<T = unknown> = z.infer<typeof ApiResponseSchema> & { data?: T };
export type CommandPermissionsResponse = z.infer<typeof GuildApplicationCommandPermissionsSchema>;


