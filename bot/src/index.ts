// Load environment variables first
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../.env') });

import {
  Client,
  GatewayIntentBits,
  Options,
  Partials,
} from "discord.js";
import { startDataSync } from "./utils/sync-data";
import { CommandManager } from "./utils/command-manager";
import { CommandLoader } from "./utils/command-loader";

// Limit collections so process RAM stays low. We rely on Redis as the real cache.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // include only if you truly need live perms
    GatewayIntentBits.GuildMessages, // TODO: use interactions only
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
    console.log('[Bot] Loading commands...');
    const commands = await CommandLoader.loadAllCommands();
    
    // Validate and register each command
    for (const command of commands) {
      if (CommandLoader.validateCommand(command)) {
        commandManager.registerCommand(command);
      } else {
        console.error(`[Bot] Failed to validate command: ${command.name || 'unknown'}`);
      }
    }
    
    console.log(`[Bot] Registered ${commandManager.getCommands().size} commands`);
    return true;
  } catch (error) {
    console.error('[Bot] Error loading commands:', error);
    return false;
  }
}

// Start data sync and command system
startDataSync(client);

// Setup command system when bot is ready
client.once('ready', async () => {
  console.log(`Bot ready as ${client.user?.tag}`);
  
  // Load and register commands
  const commandsLoaded = await initializeCommands();
  if (!commandsLoaded) {
    console.error('[Bot] Failed to load commands, exiting...');
    process.exit(1);
  }

  console.log('Command framework initialized successfully!');
  console.log('Note: Global commands need to be deployed manually via Discord Developer Portal or a deployment script');
});

client.login(process.env.BOT_TOKEN!);
