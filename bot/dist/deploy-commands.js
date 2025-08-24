#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployCommands = deployCommands;
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.resolve)(__dirname, '../../.env') });
const discord_js_1 = require("discord.js");
const command_loader_1 = require("./utils/command-loader");
const api_client_1 = require("./utils/api-client");
async function deployGlobalCommands(commands) {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const APPLICATION_ID = Buffer.from(BOT_TOKEN.split('.')[0], 'base64').toString();
    const commandData = commands.map((command) => command.data.toJSON());
    const rest = new discord_js_1.REST({ version: '10' }).setToken(BOT_TOKEN);
    console.log('[Deploy] Started refreshing application (/) commands.');
    console.log(`[Deploy] Using application ID: ${APPLICATION_ID}`);
    const deployedCommands = (await rest.put(discord_js_1.Routes.applicationCommands(APPLICATION_ID), { body: commandData }));
    console.log(`[Deploy] Successfully deployed ${deployedCommands.length} commands globally!`);
    return deployedCommands;
}
async function registerCommandsInDatabase(localCommands, deployedCommands) {
    const apiClient = new api_client_1.ApiClient();
    for (const deployedCmd of deployedCommands) {
        const localCommand = localCommands.find(cmd => cmd.name === deployedCmd.name);
        if (!localCommand) {
            console.warn(`[Deploy] Warning: Deployed command ${deployedCmd.name} not found in local commands`);
            continue;
        }
        const mainCommandResponse = await apiClient.registerDefaultCommand({
            discordId: deployedCmd.id,
            name: deployedCmd.name,
            description: deployedCmd.description,
            cooldown: 0,
            permissions: (localCommand.requiredPermissions || [])
                .reduce((acc, perm) => acc | BigInt(perm), 0n)
                .toString(),
            enabled: true,
            parentId: null,
        });
        const mainCommandId = mainCommandResponse.command.id;
        console.log(`[Deploy] Registered command: ${deployedCmd.name} (${deployedCmd.id} -> ${mainCommandId})`);
        if (deployedCmd.options) {
            await registerSubcommands(apiClient, deployedCmd, localCommand, mainCommandId);
        }
    }
}
async function registerSubcommands(apiClient, deployedCmd, localCommand, parentId) {
    if (!deployedCmd.options)
        return;
    for (const option of deployedCmd.options) {
        if (option.type === 2) {
            const groupResponse = await apiClient.registerDefaultCommand({
                name: option.name,
                description: option.description || "Subcommand group",
                cooldown: 0,
                permissions: "0",
                enabled: true,
                parentId,
            });
            const groupId = groupResponse.command.id;
            console.log(`[Deploy] Registered subcommand group: ${option.name} (${groupId})`);
            if (option.options) {
                for (const subOption of option.options) {
                    if (subOption.type === 1) {
                        await apiClient.registerDefaultCommand({
                            name: subOption.name,
                            description: subOption.description || "Subcommand",
                            cooldown: 0,
                            permissions: "0",
                            enabled: true,
                            parentId: groupId,
                        });
                        console.log(`[Deploy] Registered nested subcommand: ${subOption.name}`);
                    }
                }
            }
        }
        else if (option.type === 1) {
            await apiClient.registerDefaultCommand({
                name: option.name,
                description: option.description || "Subcommand",
                cooldown: 0,
                permissions: "0",
                enabled: true,
                parentId,
            });
            console.log(`[Deploy] Registered subcommand: ${option.name}`);
        }
    }
}
async function deployCommands() {
    console.log("[Deploy] Starting command deployment...");
    try {
        console.log("[Deploy] Loading commands...");
        const commands = await command_loader_1.CommandLoader.loadAllCommands();
        const validCommands = [];
        for (const command of commands) {
            if (command_loader_1.CommandLoader.validateCommand(command)) {
                validCommands.push(command);
            }
            else {
                console.error(`[Deploy] Failed to validate command: ${command.name || "unknown"}`);
            }
        }
        console.log(`[Deploy] Loaded ${validCommands.length} valid commands`);
        console.log("[Deploy] Deploying global commands...");
        const deployedCommands = await deployGlobalCommands(validCommands);
        console.log("[Deploy] Registering commands in database...");
        await registerCommandsInDatabase(validCommands, deployedCommands);
        console.log("[Deploy] ✅ Commands deployed and registered successfully!");
        console.log("[Deploy] Note: It may take up to 1 hour for global commands to appear in all servers");
    }
    catch (error) {
        console.error("[Deploy] ❌ Error deploying commands:", error);
        process.exit(1);
    }
}
if (require.main === module) {
    deployCommands().catch(console.error);
}
//# sourceMappingURL=deploy-commands.js.map