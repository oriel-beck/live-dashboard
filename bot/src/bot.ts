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
import { ClusterClient } from "discord-hybrid-sharding";

// Extend Client type to include cluster property
declare module "discord.js" {
  interface Client {
    cluster: ClusterClient;
  }
}

import { createRedisClient } from "./redis";
import { CommandLoader } from "./utils/command-loader";
import { CommandManager } from "./utils/command-manager";
import logger from "./utils/logger";
import { register, updateShardMetrics } from "./utils/metrics";
import { startDataSync } from "./utils/sync-data.js";

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

// Add cluster client support
client.cluster = new ClusterClient(client);

// Initialize command manager
const commandManager = new CommandManager(client);

// Export command manager for API access
export { commandManager };

// Clustering utilities for commands (enhanced for hybrid sharding)
export const clusterUtils = {
  // Get total guild count across all clusters
  async getTotalGuilds() {
    try {
      const results = await client.cluster.fetchClientValues('guilds.cache.size');
      return results.reduce((acc: number, guildCount: unknown) => acc + (guildCount as number), 0);
    } catch (error) {
      logger.warn('[ClusterUtils] Failed to fetch total guilds, falling back to local:', error);
      return client.guilds.cache.size;
    }
  },

  // Get total member count across all clusters
  async getTotalMembers() {
    try {
      const results = await client.cluster.broadcastEval((c: any) => 
        c.guilds.cache.reduce((acc: number, guild: any) => acc + guild.memberCount, 0)
      );
      return results.reduce((acc: number, memberCount: unknown) => acc + (memberCount as number), 0);
    } catch (error) {
      logger.warn('[ClusterUtils] Failed to fetch total members, falling back to local:', error);
      return client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    }
  },

  // Get total user count across all clusters
  async getTotalUsers() {
    try {
      const results = await client.cluster.fetchClientValues('users.cache.size');
      return results.reduce((acc: number, userCount: unknown) => acc + (userCount as number), 0);
    } catch (error) {
      logger.warn('[ClusterUtils] Failed to fetch total users, falling back to local:', error);
      return client.users.cache.size;
    }
  },

  // Broadcast evaluation across all clusters
  async broadcastEval(script: string) {
    try {
      return await client.cluster.broadcastEval(script);
    } catch (error) {
      logger.error('[ClusterUtils] Failed to broadcast eval:', error);
      return [];
    }
  },

  // Get cluster and shard info
  getClusterInfo() {
    return {
      clusterId: client.cluster.id,
      clusterCount: client.cluster.count,
      shardList: client.cluster.shardList,
      totalShards: client.cluster.shardList.length,
      guildCount: client.guilds.cache.size,
      userCount: client.users.cache.size,
      latency: client.ws.ping,
      uptime: client.uptime
    };
  },

  // Get shard info (for backward compatibility)
  getShardInfo() {
    const shardId = client.cluster.shardList[0] || 0;
    return {
      id: shardId,
      totalShards: client.cluster.shardList.length,
      guildCount: client.guilds.cache.size,
      userCount: client.users.cache.size,
      latency: client.ws.ping,
      uptime: client.uptime
    };
  }
};

// Legacy sharding utilities (for backward compatibility)
export const shardingUtils = clusterUtils;

// Redis client for inter-shard communication
const redis = createRedisClient();

// Load and register all commands automatically
async function initializeCommands() {
  try {
    const clusterId = client.cluster.id;
    const shardId = client.cluster.shardList[0] || 0;
    logger.debug(`[Cluster ${clusterId}, Shard ${shardId}] Loading commands...`);
    const commands = await CommandLoader.loadAllCommands();
    
    // Validate and register each command
    for (const command of commands) {
      if (CommandLoader.validateCommand(command)) {
        commandManager.registerCommand(command);
      } else {
        logger.error(`[Cluster ${clusterId}, Shard ${shardId}] Failed to validate command: ${command.name || 'unknown'}`);
      }
    }
    
    logger.debug(`[Cluster ${clusterId}, Shard ${shardId}] Registered ${commandManager.getCommands().size} commands`);
    return true;
  } catch (error) {
    const clusterId = client.cluster.id;
    const shardId = client.cluster.shardList[0] || 0;
    logger.error(`[Cluster ${clusterId}, Shard ${shardId}] Error loading commands:`, error);
    return false;
  }
}

// Send metrics to Redis for aggregation
function sendMetricsToRedis() {
  const clusterId = client.cluster.id;
  const shardId = client.cluster.shardList[0] || 0;
  const metrics = {
    clusterId: clusterId,
    shardId: shardId,
    metrics: {
      guildCount: client.guilds.cache.size,
      userCount: client.users.cache.size,
      latency: client.ws.ping,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    }
  };

  redis.publish('cluster:metrics', JSON.stringify(metrics));
}

// Send metrics to cluster manager
async function sendMetricsToManager() {
  const clusterId = client.cluster.id;
  const managerPort = process.env.METRICS_PORT || '3001';
  
  try {
    const metrics = await register.metrics();
    const response = await fetch(`http://localhost:${managerPort}/cluster-metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clusterId: clusterId,
        metrics: metrics
      })
    });
    
    if (response.ok) {
      logger.debug(`[Cluster ${clusterId}] Successfully sent metrics to manager`);
    } else {
      logger.warn(`[Cluster ${clusterId}] Failed to send metrics to manager: HTTP ${response.status}`);
    }
  } catch (error) {
    logger.warn(`[Cluster ${clusterId}] Failed to send metrics to manager:`, error);
  }
}

// Setup metrics reporting to cluster manager
function setupMetricsReporting() {
  const clusterId = client.cluster.id;
  
  setInterval(sendMetricsToManager, 10000);
  
  logger.info(`[Cluster ${clusterId}] Metrics reporting to manager enabled`);
}

// Start data sync and command system
startDataSync(client);

// Setup command system when bot is ready
client.once(Events.ClientReady, async () => {
  const clusterId = client.cluster.id;
  const shardIds = client.cluster.shardList;
  logger.info(`[Cluster ${clusterId}] Bot ready as ${client.user?.tag} (Shards: ${shardIds.join(', ')})`);
  
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
    logger.error(`[Cluster ${clusterId}] Failed to load commands, exiting...`);
    process.exit(1);
  }

  logger.debug(`[Cluster ${clusterId}] Command framework initialized successfully!`);
  logger.debug(`[Cluster ${clusterId}] Note: Global commands need to be deployed manually via Discord Developer Portal or a deployment script`);
});

// Handle client errors
client.on('error', (error) => {
  const clusterId = client.cluster.id;
  logger.error(`[Cluster ${clusterId}] Client error:`, error);
});

// Start metrics server
setupMetricsReporting();

// Send initial metrics after a delay
setTimeout(() => {
  sendMetricsToRedis();
}, 5000);

// Login the client
client.login(process.env.BOT_TOKEN!);
