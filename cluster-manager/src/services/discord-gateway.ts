import logger from '../utils/logger';
import { GatewayInfo } from '../types/gateway';

export class DiscordGatewayService {
  private readonly botToken: string;
  private readonly apiBaseUrl = 'https://discord.com/api/v10';
  private lastCheckTime: number = 0;
  private cachedGatewayInfo: GatewayInfo | null = null;
  private readonly checkInterval: number;

  constructor() {
    this.botToken = process.env.BOT_TOKEN!;
    this.checkInterval = parseInt(process.env.DISCORD_API_CHECK_INTERVAL || '86400000'); // 24 hours default
    
    if (!this.botToken) {
      throw new Error('BOT_TOKEN environment variable is required');
    }
  }

  /**
   * Get the recommended shard count from Discord's Gateway API
   */
  async getRecommendedShardCount(): Promise<number> {
    const gatewayInfo = await this.getGatewayInfo();
    return gatewayInfo.shards;
  }

  /**
   * Get the maximum concurrency allowed by Discord
   */
  async getMaxConcurrency(): Promise<number> {
    const gatewayInfo = await this.getGatewayInfo();
    return gatewayInfo.session_start_limit.max_concurrency;
  }

  /**
   * Get complete gateway information from Discord
   */
  async getGatewayInfo(): Promise<GatewayInfo> {
    const now = Date.now();
    
    // Return cached info if it's still fresh (within check interval)
    if (this.cachedGatewayInfo && (now - this.lastCheckTime) < this.checkInterval) {
      logger.debug('[DiscordGatewayService] Using cached gateway info');
      return this.cachedGatewayInfo;
    }

    try {
      logger.info('[DiscordGatewayService] Fetching gateway info from Discord API...');
      
      const response = await fetch(`${this.apiBaseUrl}/gateway/bot`, {
        headers: {
          'Authorization': `Bot ${this.botToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Discord API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as GatewayInfo;
      
      // Validate the response structure
      if (!data.shards || !data.session_start_limit?.max_concurrency) {
        throw new Error('Invalid gateway response structure');
      }

      this.cachedGatewayInfo = {
        url: data.url,
        shards: data.shards,
        session_start_limit: {
          total: data.session_start_limit.total,
          remaining: data.session_start_limit.remaining,
          reset_after: data.session_start_limit.reset_after,
          max_concurrency: data.session_start_limit.max_concurrency,
        },
      };

      this.lastCheckTime = now;
      
      logger.info(`[DiscordGatewayService] Gateway info updated - Shards: ${data.shards}, Max Concurrency: ${data.session_start_limit.max_concurrency}`);
      
      return this.cachedGatewayInfo;
    } catch (error) {
      logger.error('[DiscordGatewayService] Failed to fetch gateway info:', error);
      
      // Return cached info if available, otherwise throw
      if (this.cachedGatewayInfo) {
        logger.warn('[DiscordGatewayService] Using stale cached gateway info due to API error');
        return this.cachedGatewayInfo;
      }
      
      throw error;
    }
  }

  /**
   * Force refresh the gateway info (bypasses cache)
   */
  async refreshGatewayInfo(): Promise<GatewayInfo> {
    this.cachedGatewayInfo = null;
    this.lastCheckTime = 0;
    return this.getGatewayInfo();
  }

  /**
   * Get session start limit information
   */
  async getSessionStartLimit() {
    const gatewayInfo = await this.getGatewayInfo();
    return gatewayInfo.session_start_limit;
  }

  /**
   * Check if we can start new sessions based on remaining limit
   */
  async canStartNewSessions(): Promise<boolean> {
    const sessionLimit = await this.getSessionStartLimit();
    return sessionLimit.remaining > 0;
  }

  /**
   * Get time until session limit resets (in milliseconds)
   */
  async getSessionResetTime(): Promise<number> {
    const sessionLimit = await this.getSessionStartLimit();
    return sessionLimit.reset_after;
  }
}
