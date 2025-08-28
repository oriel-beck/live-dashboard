import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';
import logger from '../utils/logger';

// ===== BASE COMMAND CLASS =====
// Abstract base class that all commands must extend

export abstract class BaseCommand {
  abstract data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  
  // Main execution method that routes to appropriate handler
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand(false);
    
    if (subcommand) {
      // Check if subcommand method exists
      const methodName = subcommand.replace(/-/g, '_'); // Convert kebab-case to snake_case
      const method = (this as Record<string, unknown>)[methodName];
      
      if (typeof method === 'function') {
        await method.call(this, interaction);
      } else {
        logger.error(`[BaseCommand] Subcommand method '${methodName}' not found for command '${this.name}'`);
        await interaction.reply({
          content: "This subcommand is not implemented yet.",
          flags: ['Ephemeral'],
        });
      }
    } else {
      // No subcommand, call run method
      if (typeof (this as { run?: unknown }).run === 'function') {
        await ((this as unknown) as { run: (interaction: ChatInputCommandInteraction) => Promise<void> }).run.call(this, interaction);
      } else {
        logger.error(`[BaseCommand] Run method not found for command '${this.name}'`);
        await interaction.reply({
          content: "This command is not implemented yet.",
          flags: ['Ephemeral'],
        });
      }
    }
  }
  
  // Get command name from SlashCommandBuilder
  get name(): string {
    return this.data.name;
  }
  
  // Get command description from SlashCommandBuilder
  get description(): string {
    return this.data.description;
  }
}

// ===== HARDCODED COMMAND DEFINITION =====
// These values are defined in code and cannot be changed through the dashboard

export interface CommandDefinition {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// ===== GUILD-SPECIFIC CONFIGURATION =====
// These values can be configured per guild through the dashboard

export interface GuildCommandPermissions {
  whitelistedRoles: string[]; // Role IDs that can use the command
  blacklistedRoles: string[]; // Role IDs that cannot use the command
  whitelistedChannels: string[]; // Channel IDs where command can be used
  blacklistedChannels: string[]; // Channel IDs where command cannot be used
  bypassRoles: string[]; // Role IDs that bypass all restrictions
}

export interface GuildCommandConfig {
  id: string;
  commandName: string;
  guildId: string;
  enabled: boolean;
  cooldown: number;
  permissions: GuildCommandPermissions;
  subcommands?: Record<string, GuildSubcommandConfig>;
  createdAt: string;
  updatedAt: string;
}

export interface GuildSubcommandConfig {
  enabled: boolean;
  cooldown: number;
  permissions: GuildCommandPermissions;
}

// ===== RUNTIME TYPES =====
// These are used during command execution

export interface CommandExecutionContext {
  interaction: ChatInputCommandInteraction;
  definition: CommandDefinition;
  guildConfig: GuildCommandConfig;
  subcommandConfig?: GuildSubcommandConfig;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  bypassUsed?: boolean;
}

export interface CommandInfo {
  name: string;
  description: string;
}

// Legacy alias for backward compatibility during refactor
export type Command = CommandDefinition;
