"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDataSync = startDataSync;
const discord_js_1 = require("discord.js");
const redis_1 = __importDefault(require("../redis"));
const redis_cache_utils_1 = require("./redis-cache-utils");
let initiated = false;
function startDataSync(client) {
    if (initiated)
        throw new Error("[SyncData]: Listeners are already set up");
    initiated = true;
    client.once(discord_js_1.Events.ClientReady, async () => {
        console.log(`Ready as ${client.user?.tag}`);
        for (const [, guild] of client.guilds.cache) {
            await syncGuildBasics(guild);
            await syncGuildRoles(guild);
            await syncGuildChannels(guild);
        }
    });
    async function syncGuildBasics(guild) {
        const base = {
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            ownerId: guild.ownerId,
            shardId: guild.shardId,
        };
        await redis_1.default.hset(`guild:${guild.id}`, Object.entries(base).flat());
        await (0, redis_cache_utils_1.publishGuildEvent)(guild.id, {
            type: "guild.upsert",
            guildId: guild.id,
        });
    }
    async function syncGuildRoles(guild) {
        const roles = await guild.roles.fetch();
        const key = `guild:${guild.id}:roles`;
        const pipeline = redis_1.default.pipeline().del(key);
        roles.forEach((role) => {
            pipeline.hset(key, role.id, JSON.stringify({
                id: role.id,
                name: role.name,
                position: role.position,
                color: role.color,
                permissions: role.permissions.bitfield.toString(),
                managed: role.managed,
            }));
        });
        await pipeline.exec();
        await (0, redis_cache_utils_1.publishGuildEvent)(guild.id, {
            type: "role.refresh",
            guildId: guild.id,
        });
    }
    async function syncGuildChannels(guild) {
        const channels = await guild.channels.fetch();
        const key = `guild:${guild.id}:channels`;
        const pipeline = redis_1.default.pipeline().del(key);
        channels.forEach((ch) => {
            if (!ch)
                return;
            pipeline.hset(key, ch.id, JSON.stringify({
                id: ch.id,
                name: ch.name,
                type: ch.type,
                parentId: ch.parentId ?? null,
                position: ch.rawPosition ?? 0,
            }));
        });
        await pipeline.exec();
        await (0, redis_cache_utils_1.publishGuildEvent)(guild.id, {
            type: "channel.refresh",
            guildId: guild.id,
        });
    }
    client.on(discord_js_1.Events.GuildCreate, async (guild) => {
        await syncGuildBasics(guild);
        await syncGuildRoles(guild);
        await syncGuildChannels(guild);
    });
    client.on(discord_js_1.Events.GuildDelete, async (guild) => {
        const pipeline = redis_1.default
            .pipeline()
            .del(`guild:${guild.id}`, `guild:${guild.id}:roles`, `guild:${guild.id}:channels`);
        await pipeline.exec();
        await (0, redis_cache_utils_1.publishGuildEvent)(guild.id, {
            type: "guild.delete",
            guildId: guild.id,
        });
    });
    client.on(discord_js_1.Events.GuildRoleCreate, async (role) => {
        const key = `guild:${role.guild.id}:roles`;
        const data = {
            id: role.id,
            name: role.name,
            position: role.position,
            color: role.color,
            permissions: role.permissions.bitfield.toString(),
            managed: role.managed,
        };
        await (0, redis_cache_utils_1.hsetJson)(key, role.id, data);
        await (0, redis_cache_utils_1.publishGuildEvent)(role.guild.id, {
            type: "role.create",
            roleId: role.id,
            data,
        });
    });
    client.on(discord_js_1.Events.GuildRoleUpdate, async (_oldRole, role) => {
        const key = `guild:${role.guild.id}:roles`;
        const data = {
            id: role.id,
            name: role.name,
            position: role.position,
            color: role.color,
            permissions: role.permissions.bitfield.toString(),
            managed: role.managed,
        };
        await (0, redis_cache_utils_1.hsetJson)(key, role.id, data);
        await (0, redis_cache_utils_1.publishGuildEvent)(role.guild.id, {
            type: "role.update",
            roleId: role.id,
            data,
        });
    });
    client.on(discord_js_1.Events.GuildRoleDelete, async (role) => {
        const key = `guild:${role.guild.id}:roles`;
        await (0, redis_cache_utils_1.hdel)(key, role.id);
        await (0, redis_cache_utils_1.publishGuildEvent)(role.guild.id, {
            type: "role.delete",
            roleId: role.id,
        });
    });
    client.on(discord_js_1.Events.ChannelCreate, async (ch) => {
        const key = `guild:${ch.guild.id}:channels`;
        const data = {
            id: ch.id,
            name: ch.name,
            type: ch.type,
            parentId: ch.parentId ?? null,
            position: ch.rawPosition ?? 0,
        };
        await (0, redis_cache_utils_1.hsetJson)(key, ch.id, data);
        await (0, redis_cache_utils_1.publishGuildEvent)(ch.guild.id, {
            type: "channel.create",
            channelId: ch.id,
            data,
        });
    });
    client.on(discord_js_1.Events.ChannelUpdate, async (_oldCh, ch) => {
        if (ch.isDMBased())
            return;
        const key = `guild:${ch.guild.id}:channels`;
        const data = {
            id: ch.id,
            name: ch.name,
            type: ch.type,
            parentId: ch.parentId ?? null,
            position: ch.rawPosition ?? 0,
        };
        await (0, redis_cache_utils_1.hsetJson)(key, ch.id, data);
        await (0, redis_cache_utils_1.publishGuildEvent)(ch.guild.id, {
            type: "channel.update",
            channelId: ch.id,
            data,
        });
    });
    client.on(discord_js_1.Events.ChannelDelete, async (ch) => {
        if (ch.isDMBased())
            return;
        const key = `guild:${ch.guild.id}:channels`;
        await (0, redis_cache_utils_1.hdel)(key, ch.id);
        await (0, redis_cache_utils_1.publishGuildEvent)(ch.guild.id, {
            type: "channel.delete",
            channelId: ch.id,
        });
    });
    client.on(discord_js_1.Events.GuildMemberUpdate, async (_oldM, newM) => {
        const perms = newM.permissions?.bitfield?.toString() ?? "0";
        await redis_1.default.set(`member:${newM.guild.id}:${newM.id}:perms`, perms, "EX", 60 * 30);
        await (0, redis_cache_utils_1.publishUserEvent)(newM.id, {
            type: "member.perms",
            guildId: newM.guild.id,
            perms,
        });
    });
}
//# sourceMappingURL=sync-data.js.map