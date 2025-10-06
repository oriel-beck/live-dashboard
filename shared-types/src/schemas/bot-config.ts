import { z } from 'zod';


// Bot Configuration Update Request Schema
export const BotConfigUpdateRequestSchema = z.object({
  avatar: z.string().optional().nullable(),
  banner: z.string().optional().nullable(),
  nickname: z.string().max(32).optional().nullable(),
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
