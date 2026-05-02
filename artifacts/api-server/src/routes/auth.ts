import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { usersTable, type User } from "@workspace/db";

const router: IRouter = Router();

// Discord OAuth configuration - these should be in environment variables
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || "http://localhost:3000/api/auth/discord/callback";

// Discord OAuth URLs
const DISCORD_AUTH_URL = "https://discord.com/api/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_USER_URL = "https://discord.com/api/users/@me";

// Scopes needed
const SCOPES = ["identify", "email"].join(" ");

// Start OAuth flow
router.get("/discord", (req, res) => {
  const authUrl = new URL(DISCORD_AUTH_URL);
  authUrl.searchParams.set("client_id", DISCORD_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", DISCORD_REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);

  res.redirect(authUrl.toString());
});

// OAuth callback
router.get("/discord/callback", async (req, res) => {
  const code = req.query.code as string;

  if (!code) {
    res.status(400).json({ error: "No code provided" });
    return;
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch(DISCORD_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      req.log.error({ status: tokenResponse.status }, "Failed to exchange code for token");
      res.status(500).json({ error: "Failed to authenticate with Discord" });
      return;
    }

    const tokenData = await tokenResponse.json() as { access_token: string };
    const { access_token } = tokenData;

    // Get user info from Discord
    const userResponse = await fetch(DISCORD_USER_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userResponse.ok) {
      req.log.error({ status: userResponse.status }, "Failed to get user info");
      res.status(500).json({ error: "Failed to get user info" });
      return;
    }

    const discordUser = await userResponse.json() as {
      id: string;
      username: string;
      discriminator: string;
      avatar: string;
      email?: string;
    };

    // Here you would typically:
    // 1. Check if user exists in DB
    // 2. Create or update user
    // 3. Create a session (JWT or session cookie)
    // For now, we'll just return the user info

    // TODO: Implement actual session management
    // For simplicity, we'll use a simple approach with a session cookie

    res.json({
      success: true,
      user: {
        id: discordUser.id,
        username: discordUser.username,
        discriminator: discordUser.discriminator,
        avatar: discordUser.avatar,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error in Discord callback");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get current user
router.get("/me", async (req, res) => {
  // TODO: Implement session validation
  // For now, return not authenticated
  res.status(401).json({ error: "Not authenticated" });
});

// Logout
router.post("/logout", (req, res) => {
  // TODO: Clear session
  res.json({ success: true });
});

export default router;
