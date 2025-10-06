import { z } from 'zod';
import { BotProfileSchema } from './guild';

// Bot Configuration Update Request Schema
export const BotConfigUpdateRequestSchema = z.object({
  avatar: z.string().optional().nullable(),
  banner: z.string().optional().nullable(),
  nickname: z.string().max(32).optional().nullable(),
});

// Bot Configuration Response Schema (includes both guild and global profiles)
export const BotConfigResponseSchema = z.object({
  guildProfile: BotProfileSchema,
  globalProfile: BotProfileSchema,
});

// BotConfig type manually defined since we only need the type, not the schema
export type BotConfig = {
  guildId: string;
  avatar?: string;
  banner?: string;
  nickname?: string;
};

// Export types
export type BotConfigUpdateRequest = z.infer<typeof BotConfigUpdateRequestSchema>;
export type BotConfigResponse = z.infer<typeof BotConfigResponseSchema>;
