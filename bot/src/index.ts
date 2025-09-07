// Load environment variables first
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../.env') });

// @ts-expect-error Add BigInt JSON serialization support
BigInt.prototype.toJSON = function() {
  return this.toString();
};

import {
  Client,
  GatewayIntentBits,
  Options,
  Partials,
} from "discord.js";
import { startDataSync } from "./utils/sync-data";
import { CommandManager } from "./utils/command-manager";
import { CommandLoader } from "./utils/command-loader";
import logger from "./utils/logger";

// Limit collections so process RAM stays low. We rely on Redis as the real cache.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
  partials: [Partials.GuildMember], // only if needed
  makeCache: Options.cacheWithLimits({
    UserManager: 1, // The bot
    GuildMemberManager: 1, // The bot
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

// Initialize command manager
const commandManager = new CommandManager(client);

// Export command manager for API access
export { commandManager };

// Load and register all commands automatically
async function initializeCommands() {
  try {
    logger.debug('[Bot] Loading commands...');
    const commands = await CommandLoader.loadAllCommands();
    
    // Validate and register each command
    for (const command of commands) {
      if (CommandLoader.validateCommand(command)) {
        commandManager.registerCommand(command);
      } else {
        logger.error(`[Bot] Failed to validate command: ${command.name || 'unknown'}`);
      }
    }
    
    logger.debug(`[Bot] Registered ${commandManager.getCommands().size} commands`);
    return true;
  } catch (error) {
    logger.error('[Bot] Error loading commands:', error);
    return false;
  }
}

// Start data sync and command system
startDataSync(client);

// Setup command system when bot is ready
client.once('ready', async () => {
  logger.info(`Bot ready as ${client.user?.tag}`);
  
  // Load and register commands
  const commandsLoaded = await initializeCommands();
  if (!commandsLoaded) {
    logger.error('[Bot] Failed to load commands, exiting...');
    process.exit(1);
  }

  logger.debug('Command framework initialized successfully!');
  logger.debug('Note: Global commands need to be deployed manually via Discord Developer Portal or a deployment script');
});

client.login(process.env.BOT_TOKEN!);
