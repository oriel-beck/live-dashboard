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
  Events,
  GatewayIntentBits,
  Options,
  Partials,
} from "discord.js";
import { startDataSync } from "./utils/sync-data.js";
import { CommandManager } from "./utils/command-manager";
import { CommandLoader } from "./utils/command-loader";
import logger from "./utils/logger";
import { register, updateShardMetrics } from "./utils/metrics";
import { createRedisClient } from "./redis";

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

// Sharding utilities for commands
export const shardingUtils = {
  // Get total guild count across all shards
  async getTotalGuilds() {
    if (!client.shard) return client.guilds.cache.size;
    
    const results = await client.shard.fetchClientValues('guilds.cache.size');
    return results.reduce((acc: number, guildCount: unknown) => acc + (guildCount as number), 0);
  },

  // Get total member count across all shards
  async getTotalMembers() {
    if (!client.shard) {
      return client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    }
    
    const results = await client.shard.broadcastEval((c) => 
      c.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)
    );
    return results.reduce((acc: number, memberCount: unknown) => acc + (memberCount as number), 0);
  },

  // Get total user count across all shards
  async getTotalUsers() {
    if (!client.shard) return client.users.cache.size;
    
    const results = await client.shard.fetchClientValues('users.cache.size');
    return results.reduce((acc: number, userCount: unknown) => acc + (userCount as number), 0);
  },

  // Get shard info
  getShardInfo() {
    return {
      id: client.shard?.ids?.[0] ?? 0,
      totalShards: client.shard?.count ?? 1,
      guildCount: client.guilds.cache.size,
      userCount: client.users.cache.size,
      latency: client.ws.ping,
      uptime: client.uptime
    };
  }
};

// Redis client for inter-shard communication
const redis = createRedisClient();

// Load and register all commands automatically
async function initializeCommands() {
  try {
    const shardId = client.shard?.ids?.[0] ?? 0;
    logger.debug(`[Shard ${shardId}] Loading commands...`);
    const commands = await CommandLoader.loadAllCommands();
    
    // Validate and register each command
    for (const command of commands) {
      if (CommandLoader.validateCommand(command)) {
        commandManager.registerCommand(command);
      } else {
        logger.error(`[Shard ${shardId}] Failed to validate command: ${command.name || 'unknown'}`);
      }
    }
    
    logger.debug(`[Shard ${shardId}] Registered ${commandManager.getCommands().size} commands`);
    return true;
  } catch (error) {
    const shardId = client.shard?.ids?.[0] ?? 0;
    logger.error(`[Shard ${shardId}] Error loading commands:`, error);
    return false;
  }
}

// Send metrics to Redis for aggregation
function sendMetricsToRedis() {
  const shardId = client.shard?.ids?.[0] ?? 0;
  const metrics = {
    shardId: shardId,
    metrics: {
      guildCount: client.guilds.cache.size,
      userCount: client.users.cache.size,
      latency: client.ws.ping,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    }
  };

  redis.publish('shard:metrics', JSON.stringify(metrics));
}

// Send metrics to shard manager
async function sendMetricsToManager() {
  const shardId = client.shard?.ids?.[0] ?? 0;
  const managerPort = process.env.METRICS_PORT || '30000';
  
  try {
    const metrics = await register.metrics();
    const response = await fetch(`http://localhost:${managerPort}/shard-metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shardId: shardId,
        metrics: metrics
      })
    });
    
    if (response.ok) {
      logger.debug(`[Shard ${shardId}] Successfully sent metrics to manager`);
    } else {
      logger.warn(`[Shard ${shardId}] Failed to send metrics to manager: HTTP ${response.status}`);
    }
  } catch (error) {
    logger.warn(`[Shard ${shardId}] Failed to send metrics to manager:`, error);
  }
}

// Setup metrics reporting to shard manager
function setupMetricsReporting() {
  const shardId = client.shard?.ids?.[0] ?? 0;
  
  // Send metrics every 10 seconds
  setInterval(sendMetricsToManager, 10000);
  
  logger.info(`[Shard ${shardId}] Metrics reporting to manager enabled`);
}

// Start data sync and command system
startDataSync(client);

// Setup command system when bot is ready
client.once(Events.ClientReady, async () => {
  const shardId = client.shard?.ids?.[0] ?? 0;
  logger.info(`[Shard ${shardId}] Bot ready as ${client.user?.tag}`);
  
  // Update shard metrics
  updateShardMetrics(client);
  
  // Update shard metrics periodically (every 5 minutes)
  setInterval(() => {
    updateShardMetrics(client);
  }, 5 * 60 * 1000);
  
  // Send metrics to Redis periodically (every 30 seconds)
  setInterval(() => {
    sendMetricsToRedis();
  }, 30000);
  
  // Load and register commands
  const commandsLoaded = await initializeCommands();
  if (!commandsLoaded) {
    logger.error(`[Shard ${shardId}] Failed to load commands, exiting...`);
    process.exit(1);
  }

  logger.debug(`[Shard ${shardId}] Command framework initialized successfully!`);
  logger.debug(`[Shard ${shardId}] Note: Global commands need to be deployed manually via Discord Developer Portal or a deployment script`);
});

// Handle shard errors
client.on('error', (error) => {
  const shardId = client.shard?.ids?.[0] ?? 0;
  logger.error(`[Shard ${shardId}] Client error:`, error);
});

// Start metrics server
setupMetricsReporting();

// Send initial metrics after a delay
setTimeout(() => {
  sendMetricsToRedis();
}, 5000);

// Login the client
client.login(process.env.BOT_TOKEN!);
