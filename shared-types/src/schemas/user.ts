import { z } from 'zod';

// User Guild Schema
export const UserGuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  owner: z.boolean(),
  permissions: z.string(),
  features: z.array(z.string()).optional(),
  botHasAccess: z.boolean().optional(),
});

// User Schema
export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  discriminator: z.string(),
  avatar: z.string().nullable(),
  email: z.string().email().optional(),
  guilds: z.array(UserGuildSchema).optional(),
});

// Session Data Schema
export const SessionDataSchema = z.object({
  userId: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.number().optional(),
});

// Auth State Schema
export const AuthStateSchema = z.object({
  user: UserSchema.nullable(),
  isAuthenticated: z.boolean(),
  isLoading: z.boolean(),
  error: z.string().nullable(),
});

// Export types
export type UserGuild = z.infer<typeof UserGuildSchema>;
export type User = z.infer<typeof UserSchema>;
export type SessionData = z.infer<typeof SessionDataSchema>;
export type AuthState = z.infer<typeof AuthStateSchema>;
