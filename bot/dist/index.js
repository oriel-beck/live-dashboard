"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commandManager = void 0;
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.resolve)(__dirname, '../../.env') });
const discord_js_1 = require("discord.js");
const sync_data_1 = require("./utils/sync-data");
const command_manager_1 = require("./utils/command-manager");
const command_loader_1 = require("./utils/command-loader");
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMembers,
        discord_js_1.GatewayIntentBits.GuildMessages,
    ],
    partials: [discord_js_1.Partials.GuildMember],
    makeCache: discord_js_1.Options.cacheWithLimits({
        UserManager: 1,
        GuildMemberManager: 1,
        ApplicationCommandManager: 0,
        ApplicationEmojiManager: 0,
        AutoModerationRuleManager: 0,
        BaseGuildEmojiManager: 0,
        DMMessageManager: 0,
        EntitlementManager: 0,
        GuildBanManager: 0,
        GuildEmojiManager: 0,
        GuildForumThreadManager: 0,
        GuildInviteManager: 0,
        GuildMessageManager: 0,
        GuildScheduledEventManager: 0,
        GuildStickerManager: 0,
        GuildTextThreadManager: 0,
        MessageManager: 0,
        PresenceManager: 0,
        ReactionManager: 0,
        ReactionUserManager: 0,
        StageInstanceManager: 0,
        ThreadManager: 0,
        ThreadMemberManager: 0,
        VoiceStateManager: 0,
    }),
    sweepers: {
        users: {
            interval: 1000,
            filter: () => (user) => user.id === "",
        },
        guildMembers: {
            interval: 1000,
            filter: () => (member) => member.id === "",
        },
    },
});
const commandManager = new command_manager_1.CommandManager(client);
exports.commandManager = commandManager;
async function initializeCommands() {
    try {
        console.log('[Bot] Loading commands...');
        const commands = await command_loader_1.CommandLoader.loadAllCommands();
        for (const command of commands) {
            if (command_loader_1.CommandLoader.validateCommand(command)) {
                commandManager.registerCommand(command);
            }
            else {
                console.error(`[Bot] Failed to validate command: ${command.name || 'unknown'}`);
            }
        }
        console.log(`[Bot] Registered ${commandManager.getCommands().size} commands`);
        return true;
    }
    catch (error) {
        console.error('[Bot] Error loading commands:', error);
        return false;
    }
}
(0, sync_data_1.startDataSync)(client);
client.once('ready', async () => {
    console.log(`Bot ready as ${client.user?.tag}`);
    const commandsLoaded = await initializeCommands();
    if (!commandsLoaded) {
        console.error('[Bot] Failed to load commands, exiting...');
        process.exit(1);
    }
    console.log('Command framework initialized successfully!');
    console.log('Note: Global commands need to be deployed manually via Discord Developer Portal or a deployment script');
});
client.login(process.env.BOT_TOKEN);
//# sourceMappingURL=index.js.map