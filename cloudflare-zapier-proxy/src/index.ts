// Cloudflare Worker - Balkan Conflict Rules
// Uses D1 (users + sessions) for auth, proxies to backend

interface Env {
  DB: D1Database;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_REDIRECT_URI: string;
  FRONTEND_URL: string; // frontend origin, e.g. https://retrime.korsetov2009.workers.dev
  BACKEND_URL: string; // upstream backend URL
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function withCors(response: Response): Response {
  const resp = new Response(response.body, response);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => resp.headers.set(k, v as string));
  return resp;
}

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

// Generate random token
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 48; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Upsert user into D1
async function upsertUser(db: D1Database, id: string, discordId: string, username: string, avatar: string) {
  await db.prepare(`
    INSERT INTO users (id, discord_id, username, avatar)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      discord_id = excluded.discord_id,
      username = excluded.username,
      avatar = excluded.avatar
  `).bind(id, discordId, username, avatar).run();
}

// Create or update session
async function createSession(db: D1Database, token: string, userId: string, ttlSeconds = 86400 * 7) {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  await db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
    ON CONFLICT(token) DO UPDATE SET
      user_id = excluded.user_id,
      expires_at = excluded.expires_at
  `).bind(token, userId, expiresAt).run();
}

// Get user by token
async function getUserByToken(db: D1Database, token: string): Promise<any | null> {
  const now = Math.floor(Date.now() / 1000);
  const session = await db.prepare(`
    SELECT user_id, expires_at FROM sessions WHERE token = ?
  `).bind(token).first<{ user_id: string; expires_at: number }>();

  if (!session || session.expires_at < now) return null;

  const user = await db.prepare(`
    SELECT id, discord_id, username, avatar FROM users WHERE id = ?
  `).bind(session.user_id).first<{ id: string; discord_id: string; username: string; avatar: string }>();

  return user || null;
}

// Exchange Discord code for access token
async function exchangeCodeForToken(code: string, env: Env): Promise<any> {
  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.DISCORD_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord token exchange failed: ${text}`);
  }

  return response.json();
}

// Get Discord user info
async function getDiscordUser(accessToken: string): Promise<any> {
  const response = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord user fetch failed: ${text}`);
  }

  return response.json();
}

// Proxy request to backend
async function proxyToBackend(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const backendUrl = new URL(url.pathname + url.search, env.BACKEND_URL || url.origin);

  const init: RequestInit = {
    method: request.method,
    headers: new Headers(request.headers),
    body: request.method === 'GET' || request.method === 'HEAD' ? null : request.body,
    redirect: 'follow',
  };
  (init.headers as Headers).delete('host');

  const backendResp = await fetch(backendUrl.toString(), init);
  return withCors(backendResp);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // GET /auth/discord - redirect to Discord OAuth
    if (request.method === 'GET' && (path === '/auth/discord' || path === '/api/auth/discord')) {
      const discordUrl = new URL('https://discord.com/api/oauth2/authorize');
      discordUrl.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
      discordUrl.searchParams.set('redirect_uri', env.DISCORD_REDIRECT_URI);
      discordUrl.searchParams.set('response_type', 'code');
      discordUrl.searchParams.set('scope', 'identify');
      return Response.redirect(discordUrl.toString(), 302);
    }

    // Handle /auth/callback (frontend route) - return a simple page that passes hash to frontend
    if (request.method === 'GET' && path === '/auth/callback') {
      // This route should be handled by the frontend SPA, but if the worker receives it,
      // just return a basic HTML that redirects to the frontend origin with the same hash.
      const origin = new URL(request.url).origin;
      return new Response(
        `<!DOCTYPE html>
        <html><head>
          <meta http-equiv="refresh" content="0; url=${origin}/#${new URL(request.url).hash.slice(1)}">
          <script>window.location.href = '${origin}/' + window.location.hash;</script>
        </head><body>Redirecting...</body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // GET /auth/discord/callback - handle OAuth callback
    if (request.method === 'GET' && (path === '/auth/discord/callback' || path === '/api/auth/discord/callback')) {
      const code = url.searchParams.get('code');
      if (!code) return error('No code provided', 400);

      try {
        // Exchange code for Discord access token
        const tokenData = await exchangeCodeForToken(code, env);
        const accessToken = tokenData.access_token;

        // Get Discord user info
        const discordUser = await getDiscordUser(accessToken);

        // Upsert user in D1
        const userId = discordUser.id; // Use Discord ID as user ID
        await upsertUser(env.DB, userId, discordUser.id, discordUser.username, discordUser.avatar || '');

        // Create session token
        const sessionToken = generateToken();
        await createSession(env.DB, sessionToken, userId);

        // Redirect to frontend with token in hash
        const frontendOrigin = env.FRONTEND_URL || new URL(env.DISCORD_REDIRECT_URI).origin;
        const redirectUrl = `${frontendOrigin.replace(/\/+$/, '')}/auth/callback#token=${sessionToken}`;

        return new Response(null, {
          status: 302,
          headers: { 'Location': redirectUrl },
        });
      } catch (err: any) {
        return error(`OAuth failed: ${err.message}`, 500);
      }
    }

    // GET /auth/me - get current user by Bearer token
    if (request.method === 'GET' && (path === '/auth/me' || path === '/api/auth/me')) {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

      if (!token) return error('Unauthorized', 401);

      const user = await getUserByToken(env.DB, token);
      if (!user) return error('Unauthorized', 401);

      return json({
        id: user.id,
        discordId: user.discord_id,
        username: user.username,
        avatar: user.avatar,
      });
    }

    // POST /auth/logout - invalidate session
    if (request.method === 'POST' && (path === '/auth/logout' || path === '/api/auth/logout')) {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

      if (token) {
        await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
      }

      return json({ success: true });
    }

    // Proxy all other requests to backend
    return proxyToBackend(request, env);
  },
};
