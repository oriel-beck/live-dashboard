import { Elysia } from "elysia";
import { DiscordService } from "../services/discord";
import { SessionService } from "../services/session";
import { logger } from "@discord-bot/services";

// Auth middleware for bot authentication
export const botAuth = new Elysia({ name: "botAuth" }).derive(
  async ({ headers, set }) => {
    const authHeader = headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      set.status = 401;
      return {
        error: "Authorization header required",
        isBot: false,
        token: null,
      };
    }

    try {
      const token = authHeader.substring(7);

      // Check if token is the bot token
      if (token === process.env.BOT_TOKEN) {
        return {
          isBot: true,
          token,
          error: null,
        };
      }

      set.status = 401;
      return {
        error: "Invalid bot token",
        isBot: false,
        token: null,
      };
    } catch (error) {
      logger.error("[Auth] Bot authentication failed:", error);
      set.status = 401;
      return {
        error: "Invalid bot token",
        isBot: false,
        token: null,
      };
    }
  }
);

// Combined authentication middleware - supports both session and Bearer token
export const combinedAuth = new Elysia({ name: "combinedAuth" }).derive(
  async ({ headers, params, set, cookie }) => {
    const authHeader = headers.authorization;
    const guildId = (params as any).guildId;
    const sessionId = cookie.session?.value;

    // Check for Bearer token first (bot authentication)
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);

      // Bot token passes with no checks
      if (token === process.env.BOT_TOKEN) {
        return {
          isAuthenticated: true,
          accessToken: token,
          userId: "bot",
          authMethod: "bot",
        };
      }

      // Any other Bearer token is unauthorized
      set.status = 401;
      throw new Error("Unauthorized");
    }

    // Check for session cookie (frontend authentication)
    if (!sessionId) {
      set.status = 401;
      throw new Error("Authentication required");
    }

    try {
      // Validate session
      const session = await SessionService.getUserSession(sessionId);

      if (!session) {
        set.status = 401;
        throw new Error("Invalid session");
      }

      // If guildId is provided, check if user has access to that guild
      if (guildId) {
        const userGuilds = await DiscordService.getUserGuilds(
          session.accessToken
        );
        const hasAccess = DiscordService.checkGuildAccess(guildId, userGuilds);

        if (!hasAccess) {
          set.status = 403;
          throw new Error("Access denied to this guild");
        }
      }

      return {
        isAuthenticated: true,
        accessToken: session.accessToken,
        userId: session.user.id,
        session,
        authMethod: "session",
      };
    } catch (error) {
      logger.error(
        `[Auth] Session authentication failed for guild ${guildId}:`,
        error
      );

      // Re-throw authentication errors
      if (
        error instanceof Error &&
        (error.message === "Invalid session" ||
          error.message === "Access denied to this guild")
      ) {
        throw error;
      }

      set.status = 401;
      throw new Error("Authentication failed");
    }
  }
);
