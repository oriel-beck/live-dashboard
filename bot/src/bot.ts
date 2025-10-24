// Load environment variables first
import { config } from "dotenv";
import { default as proxy } from "node-global-proxy";
import { ProxyAgent } from "undici";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../.env") });

// @ts-expect-error Add BigInt JSON serialization support
BigInt.prototype.toJSON = function () {
  return this.toString();
};

const restProxyUrl = `http://${process.env.NIRN_HOST}:${process.env.NIRN_PORT}/api`;
// proxy.setConfig({
//   http: restProxyUrl,
//   https: restProxyUrl,
// });

// proxy.start();

import { ClusterClient, getInfo } from "discord-hybrid-sharding";
import { Client, Events, GatewayIntentBits, Options } from "discord.js";

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

// Initialize logger with cluster info
const clusterInfo = getInfo();
logger.info(
  `[Cluster ${Math.floor(
    clusterInfo.FIRST_SHARD_ID / 16
  )}] Starting cluster with shards ${clusterInfo.SHARD_LIST.join(", ")} (${
    clusterInfo.SHARD_LIST.length
  }/${clusterInfo.TOTAL_SHARDS})`
);

const clientId = process.env.CLIENT_ID!;

// Limit collections so process RAM stays low. We rely on Redis as the real cache.
const client = new Client({
  shards: getInfo().SHARD_LIST,
  shardCount: getInfo().TOTAL_SHARDS,
  intents: [GatewayIntentBits.Guilds],
  rest: {
    api: restProxyUrl,
  },
  // Remove partials for memory optimization
  makeCache: Options.cacheWithLimits({
    // Essential managers - only keep the bot user/member
    UserManager: {
      maxSize: 0,
      keepOverLimit: (user) => user.id === clientId,
    }, // Keep minimal users
    GuildMemberManager: {
      maxSize: 0,
      keepOverLimit: (member) => member.id === clientId,
    }, // Keep minimal members

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
});

// Add cluster client support
client.cluster = new ClusterClient(client);

// Initialize command manager
const commandManager = new CommandManager(client);

// Export command manager for API access
export { commandManager };

// Redis client for inter-shard communication
const redis = createRedisClient();

// Load and register all commands automatically from API
async function initializeCommands() {
  try {
    const clusterId = Math.floor(clusterInfo.FIRST_SHARD_ID / 16);
    const shardId = client.cluster.shardList[0] || 0;
    logger.debug(
      `[Cluster ${clusterId}, Shard ${shardId}] Loading commands from API...`
    );

    // Try to load commands from API first
    let commands = await CommandLoader.loadCommandsFromAPI();

    // Fallback to filesystem loading if API fails
    if (commands.length === 0) {
      logger.warn(
        `[Cluster ${clusterId}, Shard ${shardId}] No commands loaded from API, falling back to filesystem loading...`
      );
      commands = await CommandLoader.loadAllCommands();
    }

    // Validate and register each command
    for (const command of commands) {
      if (CommandLoader.validateCommand(command)) {
        commandManager.registerCommand(command);
      } else {
        logger.error(
          `[Cluster ${clusterId}, Shard ${shardId}] Failed to validate command: ${
            command.name || "unknown"
          }`
        );
      }
    }

    logger.debug(
      `[Cluster ${clusterId}, Shard ${shardId}] Registered ${
        commandManager.getCommands().size
      } commands`
    );
    return true;
  } catch (error) {
    const clusterId = Math.floor(clusterInfo.FIRST_SHARD_ID / 16);
    const shardId = client.cluster.shardList[0] || 0;
    logger.error(
      `[Cluster ${clusterId}, Shard ${shardId}] Error loading commands:`,
      error
    );
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
    },
  };

  redis.publish("cluster:metrics", JSON.stringify(metrics));
}

// Send metrics to cluster manager
async function sendMetricsToManager() {
  const clusterId = client.cluster.id;
  const managerPort = process.env.METRICS_PORT || "3001";

  try {
    const metrics = await register.metrics();
    const response = await fetch(
      `http://localhost:${managerPort}/cluster-metrics`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clusterId: clusterId,
          metrics: metrics,
        }),
      }
    );

    if (response.ok) {
      logger.debug(
        `[Cluster ${clusterId}] Successfully sent metrics to manager`
      );
    } else {
      logger.warn(
        `[Cluster ${clusterId}] Failed to send metrics to manager: HTTP ${response.status}`
      );
    }
  } catch (error) {
    logger.warn(
      `[Cluster ${clusterId}] Failed to send metrics to manager:`,
      error
    );
  }
}

// Setup metrics reporting to cluster manager
function setupMetricsReporting() {
  const clusterId = client.cluster.id;

  // Add small delay based on cluster ID to prevent timestamp conflicts
  const delay = clusterId * 500; // 500ms delay per cluster for manager reports
  setTimeout(() => {
    setInterval(sendMetricsToManager, 10000);
    logger.info(
      `[Cluster ${clusterId}] Metrics reporting to manager enabled (delayed ${delay}ms)`
    );
  }, delay);
}

// Start data sync and command system
startDataSync(client);

// Setup command system when bot is ready
client.once(Events.ClientReady, async () => {
  const clusterId = client.cluster.id;
  const shardIds = client.cluster.shardList;
  logger.info(
    `[Cluster ${clusterId}] Bot ready as ${
      client.user?.tag
    } (Shards: ${shardIds.join(", ")})`
  );

  // Update shard metrics
  updateShardMetrics(client);

  // Update shard metrics periodically (every 5 minutes)
  setInterval(() => {
    updateShardMetrics(client);
  }, 5 * 60 * 1000);

  // Send metrics to Redis periodically (every 30 seconds)
  // Add small delay based on cluster ID to prevent timestamp conflicts
  const redisDelay = clusterId * 1000; // 1 second delay per cluster
  setTimeout(() => {
    setInterval(() => {
      sendMetricsToRedis();
    }, 30000);
  }, redisDelay);

  // Load and register commands
  const commandsLoaded = await initializeCommands();
  if (!commandsLoaded) {
    logger.error(`[Cluster ${clusterId}] Failed to load commands, exiting...`);
    process.exit(1);
  }

  logger.debug(
    `[Cluster ${clusterId}] Command framework initialized successfully!`
  );
  logger.debug(
    `[Cluster ${clusterId}] Note: Global commands need to be deployed manually via Discord Developer Portal or a deployment script`
  );
});

// Handle client errors
client.on("error", (error) => {
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
