import {
  ChatInputCommandInteraction,
  Client,
  Collection,
  Events,
} from "discord.js";
import { BaseCommand } from "../types/command";

import { ApiClient } from "./api-client";
import { PermissionChecker } from "./permission-checker";
import { logger } from "@discord-bot/services";

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
          flags: ["Ephemeral"],
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

        // Log command usage
        logger.debug(
          `[CommandManager] ${interaction.user.tag} used ${commandName} in ${
            interaction.guild?.name || "DM"
          } (${duration.toFixed(3)}s)`
        );
      } catch (error) {
        logger.error(`[CommandManager] Error executing ${commandName}:`, error);
        throw error; // Re-throw to be handled by outer catch
      }
    } catch (error) {
      logger.error(`[CommandManager] Error executing ${commandName}:`, error);

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
}
