"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CachedGuildInfoSchema = exports.CachedGuildChannelSchema = exports.CachedGuildRoleSchema = exports.GuildInfoSchema = exports.GuildChannelSchema = exports.GuildRoleSchema = void 0;
const zod_1 = require("zod");
// Guild Role Schema
exports.GuildRoleSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    color: zod_1.z.number(),
    hoist: zod_1.z.boolean(),
    position: zod_1.z.number(),
    permissions: zod_1.z.string(),
    managed: zod_1.z.boolean(),
    mentionable: zod_1.z.boolean(),
});
// Guild Channel Schema
exports.GuildChannelSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    type: zod_1.z.number(),
    position: zod_1.z.number(),
    parent_id: zod_1.z.string().nullable(),
    permission_overwrites: zod_1.z.array(zod_1.z.unknown()),
});
// Guild Info Schema
exports.GuildInfoSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    icon: zod_1.z.string().nullable(),
    owner_id: zod_1.z.string(),
});
// Cached Guild Role Schema
exports.CachedGuildRoleSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    position: zod_1.z.number(),
    color: zod_1.z.number(),
    permissions: zod_1.z.string(),
    managed: zod_1.z.boolean(),
    lastUpdated: zod_1.z.number(),
});
// Cached Guild Channel Schema
exports.CachedGuildChannelSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    type: zod_1.z.number(),
    parentId: zod_1.z.string().nullable(),
    position: zod_1.z.number(),
    lastUpdated: zod_1.z.number(),
});
// Cached Guild Info Schema
exports.CachedGuildInfoSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    icon: zod_1.z.string().nullable(),
    owner: zod_1.z.boolean(),
    lastUpdated: zod_1.z.number(),
});
//# sourceMappingURL=guild.js.map