import { SSEEvent, logger } from "@discord-bot/shared-types";

/**
 * Interface for SSE connection that can send events
 */
export interface SSEConnection {
  connectionId: string;
  guildId: string;
  send(event: SSEEvent): void;
  isActive(): boolean;
}

/**
 * Registry for managing SSE connections per guild
 */
class SSERegistry {
  private connections = new Map<string, Set<SSEConnection>>();
  private consumerCallbacks = new Map<string, () => void>();

  /**
   * Register an SSE connection for a guild
   * Returns a cleanup function to stop consumer when no more connections
   */
  register(
    guildId: string,
    connection: SSEConnection,
    onLastConnectionRemoved?: () => void
  ): void {
    if (!this.connections.has(guildId)) {
      this.connections.set(guildId, new Set());
      logger.debug(`[SSERegistry] Started tracking guild ${guildId}`);
    }

    const guildConnections = this.connections.get(guildId)!;
    guildConnections.add(connection);

    // Store callback for cleanup when last connection is removed
    if (onLastConnectionRemoved) {
      this.consumerCallbacks.set(guildId, onLastConnectionRemoved);
    }

    logger.debug(
      `[SSERegistry] Registered connection ${connection.connectionId} for guild ${guildId} (total: ${guildConnections.size})`
    );
  }

  /**
   * Unregister an SSE connection
   */
  unregister(guildId: string, connectionId: string): void {
    const guildConnections = this.connections.get(guildId);
    if (!guildConnections) {
      logger.warn(
        `[SSERegistry] Attempted to unregister connection ${connectionId} from unknown guild ${guildId}`
      );
      return;
    }

    // Remove connection
    for (const conn of guildConnections) {
      if (conn.connectionId === connectionId) {
        guildConnections.delete(conn);
        break;
      }
    }

    // If no more connections, cleanup
    if (guildConnections.size === 0) {
      this.connections.delete(guildId);
      const cleanup = this.consumerCallbacks.get(guildId);
      if (cleanup) {
        cleanup();
        this.consumerCallbacks.delete(guildId);
      }
      logger.debug(
        `[SSERegistry] No more connections for guild ${guildId}, cleaned up`
      );
    } else {
      logger.debug(
        `[SSERegistry] Unregistered connection ${connectionId} from guild ${guildId} (remaining: ${guildConnections.size})`
      );
    }
  }

  /**
   * Broadcast an event to all SSE connections for a guild
   */
  broadcast(guildId: string, event: SSEEvent): void {
    const guildConnections = this.connections.get(guildId);
    if (!guildConnections || guildConnections.size === 0) {
      // No active connections, silently ignore
      return;
    }

    // Filter out inactive connections while broadcasting
    const activeConnections: SSEConnection[] = [];
    for (const conn of guildConnections) {
      if (conn.isActive()) {
        try {
          conn.send(event);
          activeConnections.push(conn);
        } catch (error) {
          logger.error(
            `[SSERegistry] Error sending event to connection ${conn.connectionId}:`,
            error
          );
          // Connection will be cleaned up on next check
        }
      }
    }

    // Remove inactive connections
    if (activeConnections.length < guildConnections.size) {
      for (const conn of guildConnections) {
        if (!activeConnections.includes(conn)) {
          guildConnections.delete(conn);
        }
      }
    }

    logger.debug(
      `[SSERegistry] Broadcasted ${event.type} to ${activeConnections.length} connections for guild ${guildId}`
    );

    // Cleanup if no more active connections
    if (guildConnections.size === 0) {
      this.connections.delete(guildId);
      const cleanup = this.consumerCallbacks.get(guildId);
      if (cleanup) {
        cleanup();
        this.consumerCallbacks.delete(guildId);
      }
    }
  }

  /**
   * Get number of active connections for a guild
   */
  getConnectionCount(guildId: string): number {
    return this.connections.get(guildId)?.size ?? 0;
  }

  /**
   * Check if a guild has any active connections
   */
  hasConnections(guildId: string): boolean {
    return this.getConnectionCount(guildId) > 0;
  }

  /**
   * Get all guilds with active connections
   */
  getActiveGuilds(): string[] {
    return Array.from(this.connections.keys());
  }
}

// Export singleton instance
export const sseRegistry = new SSERegistry();

