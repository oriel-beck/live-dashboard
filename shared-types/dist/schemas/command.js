"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultCommandRegistrationSchema = exports.CommandExecutionContextSchema = exports.PermissionCheckResultSchema = exports.CommandInfoSchema = exports.CommandConfigUpdateSchema = exports.CommandConfigDataSchema = exports.GuildCommandConfigSchema = exports.SubcommandConfigSchema = exports.CommandCategorySchema = exports.CommandPermissionsSchema = void 0;
const zod_1 = require("zod");
// Command Permissions Schema
exports.CommandPermissionsSchema = zod_1.z.object({
    whitelistedRoles: zod_1.z.array(zod_1.z.string()),
    blacklistedRoles: zod_1.z.array(zod_1.z.string()),
    whitelistedChannels: zod_1.z.array(zod_1.z.string()),
    blacklistedChannels: zod_1.z.array(zod_1.z.string()),
    bypassRoles: zod_1.z.array(zod_1.z.string()),
});
// Command Category Schema
exports.CommandCategorySchema = zod_1.z.object({
    id: zod_1.z.number(),
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
    commands: zod_1.z.array(zod_1.z.lazy(() => exports.CommandConfigDataSchema)).optional(),
});
// Subcommand Config Schema
exports.SubcommandConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean(),
    cooldown: zod_1.z.number(),
    permissions: exports.CommandPermissionsSchema,
});
// Guild Command Config Schema
exports.GuildCommandConfigSchema = zod_1.z.object({
    id: zod_1.z.string(),
    commandName: zod_1.z.string(),
    guildId: zod_1.z.string(),
    enabled: zod_1.z.boolean(),
    cooldown: zod_1.z.number(),
    permissions: exports.CommandPermissionsSchema,
    subcommands: zod_1.z.record(zod_1.z.string(), exports.SubcommandConfigSchema).optional(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
});
exports.CommandConfigDataSchema = zod_1.z.object({
    id: zod_1.z.number(),
    discordId: zod_1.z.bigint().nullable(),
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
    categoryId: zod_1.z.number().nullable(),
    category: exports.CommandCategorySchema.nullable(),
    subcommands: zod_1.z.record(zod_1.z.string(), zod_1.z.lazy(() => exports.CommandConfigDataSchema) // <-- annotate only here
    ).optional(),
});
// Command Config Update Schema
exports.CommandConfigUpdateSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().optional(),
    whitelistedRoles: zod_1.z.array(zod_1.z.string()).optional(),
    blacklistedRoles: zod_1.z.array(zod_1.z.string()).optional(),
    whitelistedChannels: zod_1.z.array(zod_1.z.string()).optional(),
    blacklistedChannels: zod_1.z.array(zod_1.z.string()).optional(),
    bypassRoles: zod_1.z.array(zod_1.z.string()).optional(),
}).and(zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()));
// Command Info Schema
exports.CommandInfoSchema = zod_1.z.object({
    name: zod_1.z.string(),
    description: zod_1.z.string(),
});
// Permission Check Result Schema
exports.PermissionCheckResultSchema = zod_1.z.object({
    allowed: zod_1.z.boolean(),
    reason: zod_1.z.string().optional(),
    bypassUsed: zod_1.z.boolean().optional(),
});
// Command Execution Context Schema
exports.CommandExecutionContextSchema = zod_1.z.object({
    interaction: zod_1.z.unknown(), // Discord.js interaction type
    definition: zod_1.z.unknown(), // Command definition type
    guildConfig: exports.GuildCommandConfigSchema,
    subcommandConfig: exports.SubcommandConfigSchema.optional(),
});
// Default Command Registration Schema
exports.DefaultCommandRegistrationSchema = zod_1.z.object({
    discordId: zod_1.z.string().nullable().optional(),
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    permissions: zod_1.z.string(),
    enabled: zod_1.z.boolean(),
    parentId: zod_1.z.string().nullable().optional(),
    cooldown: zod_1.z.number(),
});
//# sourceMappingURL=command.js.map