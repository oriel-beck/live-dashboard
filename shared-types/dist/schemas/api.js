"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthCheckResponseSchema = exports.MessageSendResponseSchema = exports.MessageSendRequestSchema = exports.GuildDataResponseSchema = exports.CacheEntrySchema = exports.ApiResponseSchema = void 0;
const zod_1 = require("zod");
// API Response Schema
exports.ApiResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.unknown().optional(),
    error: zod_1.z.string().optional(),
    message: zod_1.z.string().optional(),
});
// Cache Entry Schema
exports.CacheEntrySchema = zod_1.z.object({
    data: zod_1.z.unknown(),
    expires: zod_1.z.number(),
});
// Guild Data Response Schema
exports.GuildDataResponseSchema = zod_1.z.object({
    guildInfo: zod_1.z.object({
        id: zod_1.z.string(),
        name: zod_1.z.string(),
        icon: zod_1.z.string().nullable(),
        owner: zod_1.z.boolean(),
        permissions: zod_1.z.string(),
        features: zod_1.z.array(zod_1.z.string()).optional(),
    }),
    roles: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        name: zod_1.z.string(),
        color: zod_1.z.number(),
        hoist: zod_1.z.boolean(),
        position: zod_1.z.number(),
        permissions: zod_1.z.string(),
        managed: zod_1.z.boolean(),
        mentionable: zod_1.z.boolean(),
    })),
    channels: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        name: zod_1.z.string(),
        type: zod_1.z.number(),
        position: zod_1.z.number(),
        parent_id: zod_1.z.string().nullable(),
        permission_overwrites: zod_1.z.array(zod_1.z.unknown()),
    })),
});
// Message Send Request Schema
exports.MessageSendRequestSchema = zod_1.z.object({
    channelId: zod_1.z.string(),
    content: zod_1.z.string().optional(),
    embeds: zod_1.z.array(zod_1.z.unknown()).optional(),
    components: zod_1.z.array(zod_1.z.unknown()).optional(),
});
// Message Send Response Schema
exports.MessageSendResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    messageId: zod_1.z.string().optional(),
    error: zod_1.z.string().optional(),
});
// Health Check Response Schema
exports.HealthCheckResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    message: zod_1.z.string(),
    timestamp: zod_1.z.string(),
});
//# sourceMappingURL=api.js.map