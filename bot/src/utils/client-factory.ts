import { Client, GatewayIntentBits, Options } from "discord.js";
import type { ClusterConfig } from "./cluster-config";

/**
 * Create a Discord client with optimized memory settings
 * Note: Discord.js handles shard connections internally and respects max_concurrency
 * The maxConcurrency is used by Discord.js to limit concurrent gateway connections
 */
export function createDiscordClient(
  config: ClusterConfig,
  restProxyUrl: string
): Client {
  const clientId = process.env.DISCORD_CLIENT_ID!;

  const client = new Client({
    shards: config.shardList,
    shardCount: config.totalShards,
    intents: [GatewayIntentBits.Guilds],
    rest: {
      api: restProxyUrl,
    },
    // Discord.js Client with multiple shards will automatically respect
    // Discord's rate limits when connecting shards to the gateway
    makeCache: Options.cacheWithLimits({
      UserManager: {
        maxSize: 0,
        keepOverLimit: (user) => user.id === clientId,
      },
      GuildMemberManager: {
        maxSize: 0,
        keepOverLimit: (member) => member.id === clientId,
      },
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

  // Add cluster information to client
  client.cluster = {
    id: config.clusterId,
    shardList: config.shardList,
  };

  return client;
}
