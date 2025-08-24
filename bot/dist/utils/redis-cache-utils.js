"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hsetJson = hsetJson;
exports.hdel = hdel;
exports.publishGuildEvent = publishGuildEvent;
exports.publishUserEvent = publishUserEvent;
const redis_1 = __importDefault(require("../redis"));
async function hsetJson(key, field, value) {
    await redis_1.default.hset(key, field, JSON.stringify(value));
}
async function hdel(key, field) {
    await redis_1.default.hdel(key, field);
}
async function publishGuildEvent(guildId, evt) {
    await redis_1.default.publish(`events:guild:${guildId}`, JSON.stringify(evt));
}
async function publishUserEvent(userId, evt) {
    await redis_1.default.publish(`events:user:${userId}`, JSON.stringify(evt));
}
//# sourceMappingURL=redis-cache-utils.js.map