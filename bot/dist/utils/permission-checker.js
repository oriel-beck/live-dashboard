"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionChecker = void 0;
class PermissionChecker {
    static async checkPermissions(interaction, guildPermissions) {
        if (!interaction.guild || !interaction.member) {
            return { allowed: false, reason: 'Command can only be used in servers' };
        }
        const member = interaction.member;
        const memberRoles = member.roles.cache.map(role => role.id);
        const channelId = interaction.channelId;
        if (!guildPermissions) {
            return { allowed: true };
        }
        if (guildPermissions.bypassRoles?.length > 0) {
            const hasBypass = guildPermissions.bypassRoles.some(roleId => memberRoles.includes(roleId));
            if (hasBypass) {
                return { allowed: true, bypassUsed: true };
            }
        }
        if (guildPermissions.blacklistedRoles?.length > 0) {
            const hasBlacklistedRole = guildPermissions.blacklistedRoles.some(roleId => memberRoles.includes(roleId));
            if (hasBlacklistedRole) {
                return { allowed: false, reason: 'You have a blacklisted role' };
            }
        }
        if (guildPermissions.blacklistedChannels?.length > 0) {
            const isBlacklistedChannel = guildPermissions.blacklistedChannels.includes(channelId);
            if (isBlacklistedChannel) {
                return { allowed: false, reason: 'This command is disabled in this channel' };
            }
        }
        if (guildPermissions.whitelistedRoles?.length > 0) {
            const hasWhitelistedRole = guildPermissions.whitelistedRoles.some(roleId => memberRoles.includes(roleId));
            if (!hasWhitelistedRole) {
                return { allowed: false, reason: 'You do not have a required role' };
            }
        }
        if (guildPermissions.whitelistedChannels?.length > 0) {
            const isWhitelistedChannel = guildPermissions.whitelistedChannels.includes(channelId);
            if (!isWhitelistedChannel) {
                return { allowed: false, reason: 'This command can only be used in specific channels' };
            }
        }
        return { allowed: true };
    }
    static formatPermissionError(result, commandName) {
        if (result.allowed)
            return '';
        return `❌ **Access Denied**\nYou cannot use the \`${commandName}\` command.\n**Reason:** ${result.reason}`;
    }
}
exports.PermissionChecker = PermissionChecker;
//# sourceMappingURL=permission-checker.js.map