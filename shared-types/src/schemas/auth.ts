import { z } from 'zod';

// Discord OAuth Login Request Schema
export const DiscordLoginRequestSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
});

// Discord User Schema (from Discord API)
export const DiscordUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  discriminator: z.string(),
  avatar: z.string().nullable(),
  email: z.string().nullable(),
  verified: z.boolean().optional(),
  locale: z.string().optional(),
  mfa_enabled: z.boolean().optional(),
});

// Discord OAuth Token Response Schema
export const DiscordTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  refresh_token: z.string(),
  scope: z.string(),
});

// Export types
export type DiscordUser = z.infer<typeof DiscordUserSchema>;
export type DiscordTokenResponse = z.infer<typeof DiscordTokenResponseSchema>;
