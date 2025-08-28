import { z } from 'zod';

// API Response Schema
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

// Cache Entry Schema
export const CacheEntrySchema = z.object({
  data: z.unknown(),
  expires: z.number(),
});

// Guild Data Response Schema
export const GuildDataResponseSchema = z.object({
  guildInfo: z.object({
    id: z.string(),
    name: z.string(),
    icon: z.string().nullable(),
    owner: z.boolean(),
    permissions: z.string(),
    features: z.array(z.string()).optional(),
  }),
  roles: z.array(z.object({
    id: z.string(),
    name: z.string(),
    color: z.number(),
    hoist: z.boolean(),
    position: z.number(),
    permissions: z.string(),
    managed: z.boolean(),
    mentionable: z.boolean(),
  })),
  channels: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.number(),
    position: z.number(),
    parent_id: z.string().nullable(),
    permission_overwrites: z.array(z.unknown()),
  })),
});

// Message Send Request Schema
export const MessageSendRequestSchema = z.object({
  channelId: z.string(),
  content: z.string().optional(),
  embeds: z.array(z.unknown()).optional(),
  components: z.array(z.unknown()).optional(),
});

// Message Send Response Schema
export const MessageSendResponseSchema = z.object({
  success: z.boolean(),
  messageId: z.string().optional(),
  error: z.string().optional(),
});

// Health Check Response Schema
export const HealthCheckResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  timestamp: z.string(),
});

// Export types
export type ApiResponse<T = unknown> = z.infer<typeof ApiResponseSchema> & { data?: T };
export type CacheEntry<T = unknown> = z.infer<typeof CacheEntrySchema> & { data: T };
export type GuildDataResponse = z.infer<typeof GuildDataResponseSchema>;
export type MessageSendRequest = z.infer<typeof MessageSendRequestSchema>;
export type MessageSendResponse = z.infer<typeof MessageSendResponseSchema>;
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
