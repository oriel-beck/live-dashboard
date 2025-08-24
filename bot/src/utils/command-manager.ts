import {
  ChatInputCommandInteraction,
  Client,
  Collection,
  Events,
} from "discord.js";
import {
  BaseCommand,
  CommandInfo,
  GuildCommandConfig
} from "../types/command";
import { ApiClient } from "./api-client";
import { PermissionChecker } from "./permission-checker";

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
    console.log(`[CommandManager] Registered command: ${command.name}`);
  }

  /**
   * Get all registered commands
   */
  getCommands(): Collection<string, BaseCommand> {
    return this.commands;
  }

  /**
   * Deploy global commands to Discord (no longer per-guild)
   */
  async deployGlobalCommands() {
    try {
      if (!this.client.application) {
        console.error(`[CommandManager] Client application not available`);
        return;
      }

      // Deploy all registered commands globally
      const commandsData = Array.from(this.commands.values()).map((cmd) =>
        cmd.data.toJSON()
      );

      await this.client.application.commands.set(commandsData);
      console.log(
        `[CommandManager] Deployed ${commandsData.length} global commands`
      );
    } catch (error) {
      console.error(
        `[CommandManager] Failed to deploy global commands:`,
        error
      );
    }
  }

  /**
   * Get guild command configuration by ID, requiring API default config to exist
   */
  async getGuildCommandConfig(
    guildId: string,
    commandId: string
  ): Promise<GuildCommandConfig | null> {
    try {
      // Fetch from API using command ID
      const config = await this.apiClient.getCommandConfig(
        guildId,
        commandId
      );
      if (config) {
        // Transform API response to internal format
        return {
          id: config.id,
          commandName: config.name,
          guildId: guildId,
          enabled: config.enabled,
          cooldown: config.cooldown,
          permissions: config.permissions,
          subcommands: config.subcommands || {},
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
        };
      }

      // No config exists - command cannot be used
      console.warn(
        `[CommandManager] No default config found for command ID ${commandId} in ${guildId} - command disabled`
      );
      return null;
    } catch (error) {
      console.error(
        `[CommandManager] Error getting config for command ID ${commandId} in ${guildId}:`,
        error
      );
      // No fallback - command cannot be used without API config
      return null;
    }
  }

  async getGuildSubcommandConfig(
    guildId: string,
    commandId: string,
    subcommandName: string
  ): Promise<{ command: GuildCommandConfig; subcommand: GuildCommandConfig } | null> {
    try {
      // Fetch both main and subcommand config in one API call
      const config = await this.apiClient.getCommandConfig(
        guildId,
        commandId,
        false, // Don't need all subcommands, just the specific one
        subcommandName
      );
      if (config && config.command && config.subcommand) {
        // Transform API response to internal format
        return {
          command: {
            id: config.command.id,
            commandName: config.command.name,
            guildId: guildId,
            enabled: config.command.enabled,
            cooldown: config.command.cooldown,
            permissions: config.command.permissions,
            subcommands: config.command.subcommands || {},
            createdAt: config.command.createdAt,
            updatedAt: config.command.updatedAt,
          },
          subcommand: {
            id: config.subcommand.id,
            commandName: config.subcommand.name,
            guildId: guildId,
            enabled: config.subcommand.enabled,
            cooldown: config.subcommand.cooldown,
            permissions: config.subcommand.permissions,
            subcommands: {},
            createdAt: config.subcommand.createdAt,
            updatedAt: config.subcommand.updatedAt,
          }
        };
      }

      // No config exists - subcommand cannot be used
      console.warn(
        `[CommandManager] No config found for subcommand ${subcommandName} of command ${commandId} in ${guildId} - subcommand disabled`
      );
      return null;
    } catch (error) {
      console.error(
        `[CommandManager] Error getting subcommand config for ${subcommandName} in ${guildId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Note: Command configurations are now managed entirely through the API.
   * The bot only reads configurations when needed during command execution.
   */

  /**
   * Check cooldown for a command locally
   */
  private checkCooldown(
    userId: string,
    commandKey: string,
    cooldownSeconds: number
  ): { allowed: boolean; remainingTime?: number } {
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
   * Setup event listeners for command interactions and cache invalidation
   */
  private setupEventListeners() {
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      await this.handleCommandInteraction(interaction);
    });

    // No longer need guild-specific setup since we use global commands
    // Command configs are created on-demand when first used
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

    try {
      // Check if this is a subcommand execution
      const subcommandName = interaction.options.getSubcommand(false);
      let activeConfig: GuildCommandConfig;
      let mainConfig: GuildCommandConfig | null = null;

      if (subcommandName) {
        // Fetch specific subcommand config from API (includes main command config)
        const subcommandResponse = await this.getGuildSubcommandConfig(
          interaction.guildId!,
          interaction.commandId,
          subcommandName
        );

        if (!subcommandResponse || !subcommandResponse.command || !subcommandResponse.subcommand) {
          await interaction.reply({
            content: "This command is not configured and cannot be used.",
            flags: ["Ephemeral"],
          });
          return;
        }

        mainConfig = subcommandResponse.command;
        const subcommandConfig = subcommandResponse.subcommand;

        if (!mainConfig.enabled) {
          await interaction.reply({
            content: "This command is currently disabled.",
            flags: ['Ephemeral'],
          });
          return;
        }

        if (!subcommandConfig || !subcommandConfig.enabled) {
          await interaction.reply({
            content: "This subcommand is currently disabled.",
            flags: ['Ephemeral'],
          });
          return;
        }

        activeConfig = subcommandConfig;
      } else {
        // Regular command execution - fetch main command config by ID
        const mainCommandConfig = await this.getGuildCommandConfig(
          interaction.guildId!,
          interaction.commandId
        );

        if (!mainCommandConfig) {
          await interaction.reply({
            content: "This command is not configured and cannot be used.",
            flags: ["Ephemeral"],
          });
          return;
        }

        if (!mainCommandConfig.enabled) {
          await interaction.reply({
            content: "This command is currently disabled.",
            flags: ['Ephemeral'],
          });
          return;
        }

        activeConfig = mainCommandConfig;
        mainConfig = mainCommandConfig;
      }

      // Check permissions using the active config
      const guildPermissions = activeConfig.permissions;

      const permissionResult = await PermissionChecker.checkPermissions(
        interaction,
        guildPermissions
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

      // Get cooldown from the active config (main command or subcommand)
      const cooldownTime = activeConfig.cooldown || 0;

      if (cooldownTime > 0) {
        // Use main command name for cooldown key - subcommands share cooldown with main command
        const cooldownKey = commandName;

        const cooldownResult = this.checkCooldown(
          interaction.user.id,
          cooldownKey,
          cooldownTime
        );

        if (!cooldownResult.allowed) {
          const remainingTime = cooldownResult.remainingTime || cooldownTime;
          const subcommandText = subcommandName ? ` ${subcommandName}` : "";
          await interaction.reply({
            content: `Please wait ${Math.ceil(
              remainingTime
            )} seconds before using the \`${commandName}${subcommandText}\` command again.`,
            flags: ["Ephemeral"],
          });
          return;
        }
      }

      // Execute the command (handles both main commands and subcommands)
      await command.execute(interaction);

      // Log command usage
      console.log(
        `[CommandManager] ${interaction.user.tag} used ${commandName}${
          subcommandName ? ` ${subcommandName}` : ""
        } in ${interaction.guild?.name}`
      );
    } catch (error) {
      console.error(`[CommandManager] Error executing ${commandName}:`, error);

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
   * Get all guild command configurations for a guild via API (no caching)
   */
  async getAllGuildCommandConfigs(
    guildId: string
  ): Promise<Record<string, GuildCommandConfig>> {
    try {
      const configs = await this.apiClient.getGuildCommandConfigs(guildId);

      // Transform API response to internal format
      const result: Record<string, GuildCommandConfig> = {};
      for (const [commandName, config] of Object.entries(configs)) {
        const guildConfig: GuildCommandConfig = {
          id: config.id,
          commandName: config.name,
          guildId: guildId,
          enabled: config.enabled,
          cooldown: config.cooldown,
          permissions: config.permissions,
          subcommands: config.subcommands || {},
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
        };

        result[commandName] = guildConfig;
      }

      return result;
    } catch (error) {
      console.error(
        `[CommandManager] Error getting all configs for guild ${guildId}:`,
        error
      );
      return {};
    }
  }

  /**
   * Get command information (hardcoded definition details) for API/Dashboard
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
