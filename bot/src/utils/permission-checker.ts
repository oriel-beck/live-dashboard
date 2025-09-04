import { ChatInputCommandInteraction } from 'discord.js';

// Local type definition for permission check result
interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

export class PermissionChecker {
  /**
   * Check if a user has permission to execute a command
   * Discord handles all role and channel permissions via application command permissions
   */
  static async checkPermissions(
    interaction: ChatInputCommandInteraction,
    commandEnabled: boolean
  ): Promise<PermissionCheckResult> {
    if (!interaction.guild || !interaction.member) {
      return { allowed: false, reason: 'Command can only be used in servers' };
    }

    // Only check if command is enabled - Discord handles the rest
    if (!commandEnabled) {
      return { allowed: false, reason: 'This command is currently disabled' };
    }

    return { allowed: true };
  }

  /**
   * Format permission check result into a user-friendly error message
   */
  static formatPermissionError(
    result: PermissionCheckResult,
    commandName: string
  ): string {
    if (result.reason) {
      return `❌ **${commandName}**: ${result.reason}`;
    }
    return `❌ **${commandName}**: You don't have permission to use this command.`;
  }
}
