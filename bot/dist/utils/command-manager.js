"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandManager = void 0;
const discord_js_1 = require("discord.js");
const api_client_1 = require("./api-client");
const permission_checker_1 = require("./permission-checker");
class CommandManager {
    constructor(client) {
        this.commands = new discord_js_1.Collection();
        this.cooldowns = new discord_js_1.Collection();
        this.client = client;
        this.apiClient = new api_client_1.ApiClient();
        this.setupEventListeners();
    }
    registerCommand(command) {
        this.commands.set(command.name, command);
        console.log(`[CommandManager] Registered command: ${command.name}`);
    }
    getCommands() {
        return this.commands;
    }
    async deployGlobalCommands() {
        try {
            if (!this.client.application) {
                console.error(`[CommandManager] Client application not available`);
                return;
            }
            const commandsData = Array.from(this.commands.values()).map((cmd) => cmd.data.toJSON());
            await this.client.application.commands.set(commandsData);
            console.log(`[CommandManager] Deployed ${commandsData.length} global commands`);
        }
        catch (error) {
            console.error(`[CommandManager] Failed to deploy global commands:`, error);
        }
    }
    async isCommandEnabled(guildId, commandName) {
        try {
            const config = await this.getGuildCommandConfig(guildId, commandName);
            return config?.enabled ?? false;
        }
        catch (error) {
            console.error(`[CommandManager] Error checking if command ${commandName} is enabled in guild ${guildId}:`, error);
            return false;
        }
    }
    async getGuildCommandConfig(guildId, commandName) {
        try {
            const config = await this.apiClient.getCommandConfig(guildId, commandName);
            if (config) {
                return {
                    commandName: config.commandName,
                    guildId: config.guildId,
                    enabled: config.enabled,
                    cooldown: config.cooldown,
                    permissions: config.permissions,
                    subcommands: config.subcommands || {},
                    createdAt: config.createdAt,
                    updatedAt: config.updatedAt,
                };
            }
            console.warn(`[CommandManager] No default config found for ${commandName} in ${guildId} - command disabled`);
            return null;
        }
        catch (error) {
            console.error(`[CommandManager] Error getting config for ${commandName} in ${guildId}:`, error);
            return null;
        }
    }
    checkCooldown(userId, commandKey, cooldownSeconds) {
        if (!this.cooldowns.has(commandKey)) {
            this.cooldowns.set(commandKey, new discord_js_1.Collection());
        }
        const now = Date.now();
        const timestamps = this.cooldowns.get(commandKey);
        const cooldownAmount = cooldownSeconds * 1000;
        if (timestamps.has(userId)) {
            const expirationTime = timestamps.get(userId) + cooldownAmount;
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
    setupEventListeners() {
        this.client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
            if (!interaction.isChatInputCommand())
                return;
            await this.handleCommandInteraction(interaction);
        });
    }
    handleConfigUpdate(guildId, commandName) {
        console.log(`[CommandManager] Config updated for ${commandName} in guild ${guildId} (no cache to invalidate)`);
    }
    async handleCommandInteraction(interaction) {
        const { commandName } = interaction;
        const command = this.commands.get(commandName);
        if (!command)
            return;
        try {
            const isEnabled = await this.isCommandEnabled(interaction.guildId, commandName);
            if (!isEnabled) {
                await interaction.reply({
                    content: "This command is currently disabled.",
                    ephemeral: true,
                });
                return;
            }
            const guildConfig = await this.getGuildCommandConfig(interaction.guildId, commandName);
            if (!guildConfig) {
                await interaction.reply({
                    content: "This command is not configured and cannot be used.",
                    flags: ["Ephemeral"],
                });
                return;
            }
            const subcommandName = interaction.options.getSubcommand(false);
            let subcommandConfig;
            if (subcommandName) {
                subcommandConfig = guildConfig.subcommands?.[subcommandName];
                if (!subcommandConfig || !subcommandConfig.enabled) {
                    await interaction.reply({
                        content: "This subcommand is currently disabled.",
                        ephemeral: true,
                    });
                    return;
                }
            }
            const guildPermissions = subcommandConfig?.permissions || guildConfig.permissions;
            const permissionResult = await permission_checker_1.PermissionChecker.checkPermissions(interaction, guildPermissions);
            if (!permissionResult.allowed) {
                const errorMessage = permission_checker_1.PermissionChecker.formatPermissionError(permissionResult, commandName);
                await interaction.reply({
                    content: errorMessage,
                    flags: ["Ephemeral"],
                });
                return;
            }
            const cooldownTime = subcommandName
                ? guildConfig.subcommands?.[subcommandName]?.cooldown || 0
                : guildConfig.cooldown || 0;
            if (cooldownTime > 0) {
                const cooldownKey = commandName;
                const cooldownResult = this.checkCooldown(interaction.user.id, cooldownKey, cooldownTime);
                if (!cooldownResult.allowed) {
                    const remainingTime = cooldownResult.remainingTime || cooldownTime;
                    const subcommandText = subcommandName ? ` ${subcommandName}` : "";
                    await interaction.reply({
                        content: `Please wait ${Math.ceil(remainingTime)} seconds before using the \`${commandName}${subcommandText}\` command again.`,
                        flags: ["Ephemeral"],
                    });
                    return;
                }
            }
            await command.execute(interaction);
            console.log(`[CommandManager] ${interaction.user.tag} used ${commandName}${subcommandName ? ` ${subcommandName}` : ""} in ${interaction.guild?.name}`);
        }
        catch (error) {
            console.error(`[CommandManager] Error executing ${commandName}:`, error);
            const errorContent = "There was an error while executing this command!";
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: errorContent,
                    flags: ["Ephemeral"],
                });
            }
            else {
                await interaction.reply({
                    content: errorContent,
                    flags: ["Ephemeral"],
                });
            }
        }
    }
    async getAllGuildCommandConfigs(guildId) {
        try {
            const configs = await this.apiClient.getGuildCommandConfigs(guildId);
            const result = {};
            for (const [commandName, config] of Object.entries(configs)) {
                const guildConfig = {
                    commandName: config.commandName,
                    guildId: config.guildId,
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
        }
        catch (error) {
            console.error(`[CommandManager] Error getting all configs for guild ${guildId}:`, error);
            return {};
        }
    }
    getCommandInfo(commandName) {
        const command = this.commands.get(commandName);
        if (!command)
            return null;
        return {
            name: command.data.name,
            description: command.data.description,
        };
    }
    getAllCommandInfo() {
        const result = {};
        for (const [commandName] of this.commands) {
            const info = this.getCommandInfo(commandName);
            if (info) {
                result[commandName] = info;
            }
        }
        return result;
    }
}
exports.CommandManager = CommandManager;
//# sourceMappingURL=command-manager.js.map