"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthStateSchema = exports.SessionDataSchema = exports.UserSchema = exports.UserGuildSchema = void 0;
const zod_1 = require("zod");
// User Guild Schema
exports.UserGuildSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    icon: zod_1.z.string().nullable(),
    owner: zod_1.z.boolean(),
    permissions: zod_1.z.string(),
    features: zod_1.z.array(zod_1.z.string()).optional(),
    botHasAccess: zod_1.z.boolean().optional(),
});
// User Schema
exports.UserSchema = zod_1.z.object({
    id: zod_1.z.string(),
    username: zod_1.z.string(),
    discriminator: zod_1.z.string(),
    avatar: zod_1.z.string().nullable(),
    email: zod_1.z.string().email().optional(),
    guilds: zod_1.z.array(exports.UserGuildSchema).optional(),
});
// Session Data Schema
exports.SessionDataSchema = zod_1.z.object({
    userId: zod_1.z.string().optional(),
    accessToken: zod_1.z.string().optional(),
    refreshToken: zod_1.z.string().optional(),
    expiresAt: zod_1.z.number().optional(),
});
// Auth State Schema
exports.AuthStateSchema = zod_1.z.object({
    user: exports.UserSchema.nullable(),
    isAuthenticated: zod_1.z.boolean(),
    isLoading: zod_1.z.boolean(),
    error: zod_1.z.string().nullable(),
});
//# sourceMappingURL=user.js.map