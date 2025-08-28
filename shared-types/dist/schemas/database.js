"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandConfigWithSubcommandResultSchema = exports.CommandConfigResultSchema = exports.DbCommandConfigSchema = exports.DbDefaultCommandSchema = void 0;
const zod_1 = require("zod");
exports.DbDefaultCommandSchema = zod_1.z.object({
    id: zod_1.z.number(),
    discordId: zod_1.z.bigint().nullable(),
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    cooldown: zod_1.z.number(),
    permissions: zod_1.z.bigint(),
    enabled: zod_1.z.boolean(),
    parentId: zod_1.z.number().nullable(),
    categoryId: zod_1.z.number().nullable(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
    subcommands: zod_1.z
        .array(zod_1.z.lazy(() => exports.DbDefaultCommandSchema) // just use ZodTypeAny
    )
        .optional(),
});
// Database Command Config Schema
exports.DbCommandConfigSchema = zod_1.z.object({
    guildId: zod_1.z.string(),
    commandId: zod_1.z.number(),
    enabled: zod_1.z.boolean(),
    whitelistedRoles: zod_1.z.array(zod_1.z.string()),
    blacklistedRoles: zod_1.z.array(zod_1.z.string()),
    whitelistedChannels: zod_1.z.array(zod_1.z.string()),
    blacklistedChannels: zod_1.z.array(zod_1.z.string()),
    bypassRoles: zod_1.z.array(zod_1.z.string()),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
    defaultCommand: exports.DbDefaultCommandSchema.optional(),
});
// Command Config Result Schema
exports.CommandConfigResultSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    cooldown: zod_1.z.number(),
    permissions: zod_1.z.string(),
    enabled: zod_1.z.boolean(),
    whitelistedRoles: zod_1.z.array(zod_1.z.string()),
    blacklistedRoles: zod_1.z.array(zod_1.z.string()),
    whitelistedChannels: zod_1.z.array(zod_1.z.string()),
    blacklistedChannels: zod_1.z.array(zod_1.z.string()),
    bypassRoles: zod_1.z.array(zod_1.z.string()),
    createdAt: zod_1.z.date().nullable(),
    updatedAt: zod_1.z.date().nullable(),
    subcommands: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    parentId: zod_1.z.number().optional(),
    categoryId: zod_1.z.number().optional(),
    discordId: zod_1.z.bigint().optional(),
});
// Command Config With Subcommand Result Schema
exports.CommandConfigWithSubcommandResultSchema = exports.CommandConfigResultSchema.extend({
    subcommand: zod_1.z.object({
        id: zod_1.z.string(),
        name: zod_1.z.string(),
        description: zod_1.z.string(),
        enabled: zod_1.z.boolean(),
        cooldown: zod_1.z.number(),
        whitelistedRoles: zod_1.z.array(zod_1.z.string()),
        blacklistedRoles: zod_1.z.array(zod_1.z.string()),
        whitelistedChannels: zod_1.z.array(zod_1.z.string()),
        blacklistedChannels: zod_1.z.array(zod_1.z.string()),
        bypassRoles: zod_1.z.array(zod_1.z.string()),
    }),
});
//# sourceMappingURL=database.js.map