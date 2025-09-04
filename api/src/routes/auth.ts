import { Request, Response, Router } from "express";
import { config } from "../config";
import { DiscordService } from "../services/discord";
import { SessionService } from "../services/session";
import { AuthenticatedRequest, User } from "../types";
import { clearCookie, setCookie } from "../utils/cookies";
import logger from "../utils/logger";

const router = Router();

// Redirect to Discord OAuth2
router.get("/discord", (req: Request, res: Response) => {
  const discordAuthUrl = new URL("https://discord.com/api/oauth2/authorize");

  discordAuthUrl.searchParams.set("client_id", config.discord.clientId || "");
  discordAuthUrl.searchParams.set("redirect_uri", config.discord.redirectUri);
  discordAuthUrl.searchParams.set("response_type", "code");
  discordAuthUrl.searchParams.set("scope", "identify guilds applications.commands.permissions.update");

  res.redirect(discordAuthUrl.toString());
});

// Handle Discord OAuth2 callback
router.get("/discord/callback", async (req: Request, res: Response) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({
      success: false,
      error: "No authorization code provided",
    });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.discord.clientId || "",
        client_secret: config.discord.clientSecret || "",
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: config.discord.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to exchange code for token");
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // Get user info
    const userInfo = await DiscordService.getUserInfo(tokenData.access_token);

    // Store user session (guilds are cached separately in Redis)
    const sessionId = SessionService.generateSessionId();
    await SessionService.storeUserSession(sessionId, {
      user: userInfo as User,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
    });

    // Set session cookie
    setCookie(res, "sessionId", sessionId, {
      httpOnly: true,
      secure: config.nodeEnv === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "lax",
      path: "/",
    });

    res.redirect(`${config.corsOrigin}/servers?auth=success`);
  } catch (error) {
    logger.error("OAuth callback error:", error);
    res.redirect(`${config.corsOrigin}?auth=error`);
  }
});

// Get current user info
router.get("/user", (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    return res.status(401).json({
      success: false,
      error: "Not authenticated",
    });
  }

  res.json({
    success: true,
    data: authReq.user,
  });
});

// Get user's accessible guilds
router.get("/user/guilds", (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    return res.status(401).json({
      success: false,
      error: "Not authenticated",
    });
  }

  // Guilds are already filtered in attachUser middleware
  res.json({
    success: true,
    data: authReq.user.guilds || [],
  });
});

// Logout
router.post("/logout", async (req: Request, res: Response) => {
  const sessionId = req.cookies?.sessionId;

  if (sessionId) {
    await SessionService.clearUserSession(sessionId);
  }

  // Clear session cookie
  clearCookie(res, "sessionId", "/");

  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

export default router;
