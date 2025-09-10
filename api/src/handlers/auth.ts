import { DiscordService } from "../services/discord";
import {
  DiscordLoginRequestSchema,
  UserSchema,
  UserGuildSchema,
} from "@discord-bot/shared-types";
import { z } from "zod";
import { RequestHandler, ResponseHandler } from "@nex-app/bun-server";

export async function handleAuthLogin(
  req: RequestHandler,
  res: ResponseHandler
) {
  try {
    const rawBody = await req.request.json();
    const body = DiscordLoginRequestSchema.parse(rawBody);

    // Exchange code for token
    const tokenData = await DiscordService.exchangeCodeForToken(body.code);

    // Get user info
    const userData = await DiscordService.getUserInfo(tokenData.access_token);

    return res.send({
      success: true,
      data: {
        user: userData,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
      },
    });
  } catch (error) {
    req.state.logger.error("[Auth] Login error:", error);

    if (error instanceof z.ZodError) {
      res.setStatus(400);
      return res.send({
        success: false,
        error: "Validation failed",
        details: error.message,
      });
    }

    res.setStatus(401);
    return res.send({
      success: false,
      error: "Authentication failed",
    });
  }
}

// Dashboard expects /auth/user endpoint
export async function handleAuthUser(req: RequestHandler, res: ResponseHandler) {
  const authHeader = req.request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.setStatus(401);
    return res.send({
      success: false,
      error: "Authorization header required",
    });
  }

  try {
    const token = authHeader.substring(7);
    const userData = await DiscordService.getUserInfo(token);

    // Get user guilds
    const userGuilds = await DiscordService.getUserGuilds(token);

    // Format user data according to UserSchema
    const user = UserSchema.parse({
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      avatar: userData.avatar,
      email: userData.email,
      guilds: userGuilds.map((guild) => UserGuildSchema.parse(guild)),
    });

    return res.send({
      success: true,
      data: user,
    });
  } catch (error) {
    req.state.logger.error("[Auth] User error:", error);

    if (error instanceof z.ZodError) {
      res.setStatus(400);
      return res.send({
        success: false,
        error: "Validation failed",
        details: error.message,
      });
    }

    res.setStatus(401);
    return res.send({
      success: false,
      error: "Failed to get user info",
    });
  }
}

// OAuth redirect endpoint
export async function handleAuthDiscord(
  req: RequestHandler,
  res: ResponseHandler
) {
  try {
    const discordAuthUrl = DiscordService.getDiscordAuthUrl();
    res.setStatus(302);
    res.setHeader("Location", discordAuthUrl);
    return res.send({});
  } catch (error) {
    req.state.logger.error("[Auth] Discord redirect error:", error);
    res.setStatus(500);
    return res.send({
      success: false,
      error: "Failed to generate Discord auth URL",
    });
  }
}

// Logout endpoint
export async function handleAuthLogout(
  req: RequestHandler,
  res: ResponseHandler
) {
  try {
    // Clear any session data if needed
    // For now, just return success
    return res.send({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    req.state.logger.error("[Auth] Logout error:", error);
    res.setStatus(500);
    return res.send({
      success: false,
      error: "Failed to logout",
    });
  }
}

// Get user guilds endpoint
export async function handleAuthUserGuilds(
  req: RequestHandler,
  res: ResponseHandler
) {
  const authHeader = req.request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.setStatus(401);
    return res.send({
      success: false,
      error: "Authorization header required",
    });
  }

  try {
    const token = authHeader.substring(7);
    const userGuilds = await DiscordService.getUserGuilds(token);

    const guilds = userGuilds.map((guild) => UserGuildSchema.parse(guild));

    return res.send({
      success: true,
      data: guilds,
    });
  } catch (error) {
    req.state.logger.error("[Auth] User guilds error:", error);

    if (error instanceof z.ZodError) {
      res.setStatus(400);
      return res.send({
        success: false,
        error: "Validation failed",
        details: error.message,
      });
    }

    res.setStatus(401);
    return res.send({
      success: false,
      error: "Failed to get user guilds",
    });
  }
}
