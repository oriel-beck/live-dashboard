import {
  ChatInputCommandInteraction,
  Client,
  Collection,
  Events,
} from "discord.js";
import {
  BaseCommand,
} from "../types/command";

// Local type definition for command info
interface CommandInfo {
  name: string;
  description: string;
}
import { ApiClient } from "./api-client";
import { PermissionChecker } from "./permission-checker";
import logger from "./logger";
import { recordCommandExecution, recordCommandError, updateShardMetrics } from "./metrics";

export class CommandManager {
  private client: Client;
  private commands: Collection<string, BaseCommand> = new Collection();
  private cooldowns: Collection<string, Collection<string, number>> =
    new Collection();
  private apiClient: ApiClient;

  constructor(client: Client) {
    this.client = client;
    this.apiClient = new ApiClient();
    this.setupEventListeners();
  }

  /**
   * Register a command with the manager
   */
  registerCommand(command: BaseCommand) {
    this.commands.set(command.name, command);
    logger.debug(`[CommandManager] Registered command: ${command.name}`);
  }

  /**
   * Get all registered commands
   */
  getCommands(): Collection<string, BaseCommand> {
    return this.commands;
  }

  /**
   * Deploy global commands to Discord
   */
  async deployGlobalCommands() {
    try {
      if (!this.client.application) {
        logger.error(`[CommandManager] Client application not available`);
        return;
      }

      // Deploy all registered commands globally
      const commandsData = Array.from(this.commands.values()).map((cmd) => {
        const baseData = cmd.data.toJSON();
        
        // Add default permission requirements for the applications.commands.permissions.update scope
        return {
          ...baseData,
          default_member_permissions: "0", // Allow all members by default, server admins can restrict
          dm_permission: false, // Commands only work in servers
        };
      });

      await this.client.application.commands.set(commandsData);
      logger.debug(
        `[CommandManager] Deployed ${commandsData.length} global commands`
      );
      logger.debug("[CommandManager] Commands now use Discord's application command permissions system.");
    } catch (error) {
      logger.error(
        `[CommandManager] Failed to deploy global commands:`,
        error
      );
    }
  }

  /**
   * Check cooldown for a command locally
   */
  private checkCooldown(
    userId: string,
    command: BaseCommand,
    cooldownSeconds: number
  ): { allowed: boolean; remainingTime?: number } {
    const commandKey = command.name;
    if (!this.cooldowns.has(commandKey)) {
      this.cooldowns.set(commandKey, new Collection());
    }

    const now = Date.now();
    const timestamps = this.cooldowns.get(commandKey)!;
    const cooldownAmount = cooldownSeconds * 1000;

    if (timestamps.has(userId)) {
      const expirationTime = timestamps.get(userId)! + cooldownAmount;
      if (now < expirationTime) {
        const remainingTime = (expirationTime - now) / 1000;
        return {
          allowed: false,
          remainingTime,
        };
      }
    }

    timestamps.set(userId, now);
    setTimeout(() => timestamps.delete(userId), cooldownAmount);
    return { allowed: true };
  }

  /**
   * Setup event listeners for command interactions
   */
  private setupEventListeners() {
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      await this.handleCommandInteraction(interaction);
    });
  }

  /**
   * Handle command interaction execution
   */
  private async handleCommandInteraction(
    interaction: ChatInputCommandInteraction
  ) {
    const { commandName } = interaction;
    const command = this.commands.get(commandName);

    if (!command) return;

    // Record command attempt immediately (lightweight)
    const clusterId = (this.client as any).cluster?.id ?? 0;
    const shardId = (this.client as any).cluster?.shardList?.[0] ?? 0;
    const guildId = interaction.guild?.id;
    const subcommandName = interaction.options.getSubcommand(false);
    const startTime = Date.now();

    try {
      // Check if command is enabled via API
      const commandConfig = await this.apiClient.getCommandConfig(
        interaction.guildId!,
        interaction.commandId
      );

      if (!commandConfig || !commandConfig.enabled) {
        await interaction.reply({
          content: "This command is currently disabled.",
          flags: ['Ephemeral'],
        });
        return;
      }

      // Check permissions - only need to verify command is enabled
      // Discord handles all role and channel permissions via application command permissions
      const permissionResult = await PermissionChecker.checkPermissions(
        interaction,
        commandConfig.enabled
      );

      if (!permissionResult.allowed) {
        const errorMessage = PermissionChecker.formatPermissionError(
          permissionResult,
          commandName
        );
        await interaction.reply({
          content: errorMessage,
          flags: ["Ephemeral"],
        });
        return;
      }

      // Get cooldown from the command class itself (fallback to API config for compatibility)
      const cooldownTime = command.cooldown || commandConfig.cooldown || 0;

      if (cooldownTime > 0) {
        const cooldownResult = this.checkCooldown(
          interaction.user.id,
          command,
          cooldownTime
        );

        if (!cooldownResult.allowed) {
          const remainingTime = cooldownResult.remainingTime || cooldownTime;
          await interaction.reply({
            content: `Please wait ${Math.ceil(
              remainingTime
            )} seconds before using the \`${commandName}\` command again.`,
            flags: ["Ephemeral"],
          });
          return;
        }
      }

      try {
        await command.execute(interaction);
        
        // Calculate execution duration
        const duration = (Date.now() - startTime) / 1000; // Convert to seconds
        
        // Record successful command execution with subcommand support (async - don't wait)
        setImmediate(() => {
          recordCommandExecution(commandName, subcommandName || undefined, clusterId, shardId, guildId, duration);
          updateShardMetrics(this.client);
        });
        
        // Log command usage
        logger.debug(
          `[CommandManager] ${interaction.user.tag} used ${commandName} in ${interaction.guild?.name || 'DM'} (${duration.toFixed(3)}s)`
        );
      } catch (error) {
        logger.error(`[CommandManager] Error executing ${commandName}:`, error);
        
        // Record command error (async - don't wait)
        const errorType = error instanceof Error ? error.name : 'UnknownError';
        setImmediate(() => recordCommandError(commandName, subcommandName || undefined, clusterId, shardId, guildId, errorType));
        
        throw error; // Re-throw to be handled by outer catch
      }
    } catch (error) {
      logger.error(`[CommandManager] Error executing ${commandName}:`, error);

      // Record the outer catch error too (for cases where the command execution itself fails) (async - don't wait)
      const errorType = error instanceof Error ? error.name : 'CommandExecutionError';
      setImmediate(() => recordCommandError(commandName, subcommandName || undefined, clusterId, shardId, guildId, errorType));

      const errorContent = "There was an error while executing this command!";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: errorContent,
          flags: ["Ephemeral"],
        });
      } else {
        await interaction.reply({
          content: errorContent,
          flags: ["Ephemeral"],
        });
      }
    }
  }

  /**
   * Get command information for API/Dashboard
   */
  getCommandInfo(commandName: string): CommandInfo | null {
    const command = this.commands.get(commandName);
    if (!command) return null;

    return {
      name: command.data.name,
      description: command.data.description,
    };
  }

  /**
   * Get all command information for API/Dashboard
   */
  getAllCommandInfo(): Record<string, CommandInfo> {
    const result: Record<string, CommandInfo> = {};
    for (const [commandName] of this.commands) {
      const info = this.getCommandInfo(commandName);
      if (info) {
        result[commandName] = info;
      }
    }
    return result;
  }
}
