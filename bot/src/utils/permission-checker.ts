import { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { GuildCommandPermissions, PermissionCheckResult } from '../types/command';

export class PermissionChecker {
  /**
   * Check if a user has permission to execute a command based on the configured permissions
   */
  static async checkPermissions(
    interaction: ChatInputCommandInteraction,
    guildPermissions: GuildCommandPermissions | undefined | null
  ): Promise<PermissionCheckResult> {
    if (!interaction.guild || !interaction.member) {
      return { allowed: false, reason: 'Command can only be used in servers' };
    }

    const member = interaction.member as GuildMember;
    const memberRoles = member.roles.cache.map(role => role.id);
    const channelId = interaction.channelId;

    // If no guild permissions configured, allow command (permissions controlled by API config)
    if (!guildPermissions) {
      return { allowed: true };
    }

    // Check bypass roles first - if user has bypass role, allow everything
    if (guildPermissions.bypassRoles?.length > 0) {
      const hasBypass = guildPermissions.bypassRoles.some(roleId => memberRoles.includes(roleId));
      if (hasBypass) {
        return { allowed: true, bypassUsed: true };
      }
    }

    // Check blacklisted roles
    if (guildPermissions.blacklistedRoles?.length > 0) {
      const hasBlacklistedRole = guildPermissions.blacklistedRoles.some(roleId => memberRoles.includes(roleId));
      if (hasBlacklistedRole) {
        return { allowed: false, reason: 'You have a blacklisted role' };
      }
    }

    // Check blacklisted channels
    if (guildPermissions.blacklistedChannels?.length > 0) {
      const isBlacklistedChannel = guildPermissions.blacklistedChannels.includes(channelId);
      if (isBlacklistedChannel) {
        return { allowed: false, reason: 'This command is disabled in this channel' };
      }
    }

    // Check whitelisted roles (if specified, user must have at least one)
    if (guildPermissions.whitelistedRoles?.length > 0) {
      const hasWhitelistedRole = guildPermissions.whitelistedRoles.some(roleId => memberRoles.includes(roleId));
      if (!hasWhitelistedRole) {
        return { allowed: false, reason: 'You do not have a required role' };
      }
    }

    // Check whitelisted channels (if specified, command must be used in one of them)
    if (guildPermissions.whitelistedChannels?.length > 0) {
      const isWhitelistedChannel = guildPermissions.whitelistedChannels.includes(channelId);
      if (!isWhitelistedChannel) {
        return { allowed: false, reason: 'This command can only be used in specific channels' };
      }
    }

    return { allowed: true };
  }

  /**
   * Format permission check result into a user-friendly error message
   */
  static formatPermissionError(result: PermissionCheckResult, commandName: string): string {
    if (result.allowed) return '';
    
    return `❌ **Access Denied**\nYou cannot use the \`${commandName}\` command.\n**Reason:** ${result.reason}`;
  }
}
