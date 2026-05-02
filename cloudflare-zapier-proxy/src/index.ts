// Cloudflare Worker - Balkan Conflict Rules Backend
// Handles: Auth, Appeals, Verdicts, Zapier forwarding

interface Env {
  DB: D1Database;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_REDIRECT_URI: string;
  FRONTEND_URL: string;
  ZAP_URL: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withCors(response: Response): Response {
  const resp = new Response(response.body, response);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => resp.headers.set(k, v));
  return resp;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function jsonError(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

function randomToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  const buf = new Uint8Array(48);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 48; i++) {
    out += chars.charAt(buf[i] % chars.length);
  }
  return out;
}

function extractToken(request: Request): string | null {
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.substring(7);
  return null;
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function getUserByToken(db: D1Database, token: string) {
  const now = Math.floor(Date.now() / 1000);
  const session = await db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?')
    .bind(token)
    .first<{ user_id: number; expires_at: number }>();

  if (!session || session.expires_at < now) return null;

  return db
    .prepare('SELECT id, discord_id, username, avatar, is_admin FROM users WHERE id = ?')
    .bind(session.user_id)
    .first<{ id: number; discord_id: string; username: string; avatar: string; is_admin: number }>();
}

async function isBanned(db: D1Database, discordId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM banned_users WHERE discord_id = ?')
    .bind(discordId)
    .first();
  return !!row;
}

async function upsertUser(
  db: D1Database,
  discordId: string,
  username: string,
  avatar: string,
) {
  await db
    .prepare(
      `INSERT INTO users (discord_id, username, avatar)
       VALUES (?, ?, ?)
       ON CONFLICT(discord_id) DO UPDATE SET
         username = excluded.username,
         avatar = excluded.avatar`,
    )
    .bind(discordId, username, avatar)
    .run();
}

async function getUserIdByDiscordId(db: D1Database, discordId: string): Promise<number | null> {
  const row = await db
    .prepare('SELECT id FROM users WHERE discord_id = ?')
    .bind(discordId)
    .first<{ id: number }>();
  return row?.id ?? null;
}

// ---------------------------------------------------------------------------
// Discord OAuth
// ---------------------------------------------------------------------------

async function exchangeDiscordCode(code: string, env: Env) {
  const res = await fetch('https://discord.com/api/oauth2/token', {
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
  if (!res.ok) throw new Error(`Discord token exchange failed: ${await res.text()}`);
  return res.json();
}

async function fetchDiscordUser(accessToken: string) {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Discord user fetch failed: ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Zapier forwarding
// ---------------------------------------------------------------------------

async function sendToZapier(env: Env, appeal: Record<string, unknown>) {
  if (!env.ZAP_URL) return { ok: false, reason: 'ZAP_URL not configured' };

  const res = await fetch(env.ZAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(appeal),
  });
  return { ok: res.ok, status: res.status };
}

async function checkAndForwardToZapier(env: Env, appealId: number) {
  const appealRow = await env.DB
    .prepare('SELECT * FROM appeals WHERE id = ?')
    .bind(appealId)
    .first<Record<string, unknown>>();

  if (!appealRow) return;

  const verdictsCount = (appealRow.verdicts_count as number) ?? 0;
  const alreadySent = (appealRow.zapier_sent as number) === 1;

  // Auto-forward ban appeals immediately
  const category = appealRow.category as string;
  const isBanAppeal = category === 'Апелляция на наказание';

  if (isBanAppeal && !alreadySent) {
    const result = await sendToZapier(env, {
      ...appealRow,
      type: 'ban_appeal_direct',
    });
    if (result.ok) {
      await env.DB
        .prepare(
          `UPDATE appeals SET zapier_sent = 1, zapier_sent_at = datetime('now'), status = 'forwarded'
           WHERE id = ?`,
        )
        .bind(appealId)
        .run();
    }
    return;
  }

  // Forward when 5 verdicts collected
  if (verdictsCount >= 5 && !alreadySent) {
    // Fetch all verdicts for this appeal
    const verdicts = await env.DB
      .prepare('SELECT verdict, reason FROM verdicts WHERE appeal_id = ? ORDER BY created_at')
      .bind(appealId)
      .all<{ verdict: string; reason: string | null }>();

    const result = await sendToZapier(env, {
      ...appealRow,
      type: 'verdict_threshold',
      verdicts: verdicts.results,
    });

    if (result.ok) {
      await env.DB
        .prepare(
          `UPDATE appeals SET zapier_sent = 1, zapier_sent_at = datetime('now'), status = 'forwarded'
           WHERE id = ?`,
        )
        .bind(appealId)
        .run();
    }
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

type RouteHandler = (request: Request, env: Env) => Promise<Response>;

interface RouteDef {
  method: string;
  pattern: RegExp;
  handler: RouteHandler;
}

function matchRoute(path: string, method: string, routes: RouteDef[]): { handler: RouteHandler; params: string[] } | null {
  for (const route of routes) {
    if (route.method !== method && route.method !== '*') continue;
    const m = path.match(route.pattern);
    if (m) return { handler: route.handler, params: m.slice(1) };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

const routes: RouteDef[] = [
  // Health
  {
    method: 'GET',
    pattern: /^\/api\/healthz$/,
    handler: () => jsonResponse({ status: 'ok' }),
  },

  // --- Auth ----------------------------------------------------------------

  {
    method: 'GET',
    pattern: /^\/auth\/discord$/,
    handler: (_req, env) => {
      const url = new URL('https://discord.com/api/oauth2/authorize');
      url.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
      url.searchParams.set('redirect_uri', env.DISCORD_REDIRECT_URI);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'identify');
      return new Response(null, { status: 302, headers: { Location: url.toString() } });
    },
  },

  {
    method: 'GET',
    pattern: /^\/api\/auth\/discord$/,
    handler: (_req, env) => {
      const url = new URL('https://discord.com/api/oauth2/authorize');
      url.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
      url.searchParams.set('redirect_uri', env.DISCORD_REDIRECT_URI);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'identify');
      return new Response(null, { status: 302, headers: { Location: url.toString() } });
    },
  },

  {
    method: 'GET',
    pattern: /^\/auth\/discord\/callback$/,
    handler: async (req, env) => {
      const url = new URL(req.url);
      const code = url.searchParams.get('code');
      if (!code) return jsonError('No code provided', 400);

      try {
        const tokenData = await exchangeDiscordCode(code, env);
        const discordUser = await fetchDiscordUser(tokenData.access_token);

        await upsertUser(env.DB, discordUser.id, discordUser.username, discordUser.avatar || '');

        const sessionToken = randomToken();
        const userId = await getUserIdByDiscordId(env.DB, discordUser.id);
        if (!userId) return jsonError('Failed to create user', 500);

        const expiresAt = Math.floor(Date.now() / 1000) + 86400 * 7; // 7 days
        await env.DB
          .prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
          .bind(sessionToken, userId, expiresAt)
          .run();

        const frontendUrl = env.FRONTEND_URL || new URL(env.DISCORD_REDIRECT_URI).origin;
        const redirectUrl = `${frontendUrl.replace(/\/+$/, '')}/auth/callback#token=${sessionToken}`;
        return new Response(null, { status: 302, headers: { Location: redirectUrl } });
      } catch (err: any) {
        return jsonError(`OAuth failed: ${err.message}`, 500);
      }
    },
  },

  {
    method: 'GET',
    pattern: /^\/api\/auth\/discord\/callback$/,
    handler: async (req, env) => {
      const url = new URL(req.url);
      const code = url.searchParams.get('code');
      if (!code) return jsonError('No code provided', 400);

      try {
        const tokenData = await exchangeDiscordCode(code, env);
        const discordUser = await fetchDiscordUser(tokenData.access_token);

        await upsertUser(env.DB, discordUser.id, discordUser.username, discordUser.avatar || '');

        const sessionToken = randomToken();
        const userId = await getUserIdByDiscordId(env.DB, discordUser.id);
        if (!userId) return jsonError('Failed to create user', 500);

        const expiresAt = Math.floor(Date.now() / 1000) + 86400 * 7;
        await env.DB
          .prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
          .bind(sessionToken, userId, expiresAt)
          .run();

        const frontendUrl = env.FRONTEND_URL || new URL(env.DISCORD_REDIRECT_URI).origin;
        const redirectUrl = `${frontendUrl.replace(/\/+$/, '')}/auth/callback#token=${sessionToken}`;
        return new Response(null, { status: 302, headers: { Location: redirectUrl } });
      } catch (err: any) {
        return jsonError(`OAuth failed: ${err.message}`, 500);
      }
    },
  },

  {
    method: 'GET',
    pattern: /^\/api\/auth\/me$/,
    handler: async (req, env) => {
      const token = extractToken(req);
      if (!token) return jsonError('Unauthorized', 401);

      const user = await getUserByToken(env.DB, token);
      if (!user) return jsonError('Unauthorized', 401);

      if (await isBanned(env.DB, user.discord_id)) {
        return jsonError('Your account has been banned from review', 403);
      }

      return jsonResponse({
        id: user.id,
        discordId: user.discord_id,
        username: user.username,
        avatar: user.avatar,
        isAdmin: !!user.is_admin,
      });
    },
  },

  {
    method: 'POST',
    pattern: /^\/api\/auth\/logout$/,
    handler: async (req, env) => {
      const token = extractToken(req);
      if (token) {
        await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
      }
      return jsonResponse({ success: true });
    },
  },

  // --- Appeals -------------------------------------------------------------

  {
    method: 'POST',
    pattern: /^\/api\/appeals$/,
    handler: async (req, env) => {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return jsonError('Invalid JSON body', 400);
      }

      const { chatId, title, nickname, faction, contact, category, message } = body;

      if (!chatId || !title || !nickname || !category || !message) {
        return jsonError('Missing required fields: chatId, title, nickname, category, message', 400);
      }

      // Determine user_id if authenticated
      let userId: number | null = null;
      const token = extractToken(req);
      if (token) {
        const user = await getUserByToken(env.DB, token);
        userId = user?.id ?? null;
      }

      const isBanAppeal = category === 'Апелляция на наказание';

      const result = await env.DB
        .prepare(
          `INSERT INTO appeals (chat_id, title, nickname, faction, contact, category, message, user_id, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          chatId,
          title,
          nickname,
          faction || null,
          contact || null,
          category,
          message,
          userId,
          isBanAppeal ? 'forwarded' : 'pending',
        )
        .run();

      const appealId = result.meta?.last_row_id ?? 0;

      // If ban appeal, forward immediately
      if (isBanAppeal) {
        await sendToZapier(env, {
          id: appealId,
          chat_id: chatId,
          title,
          nickname,
          faction,
          contact,
          category,
          message,
          user_id: userId,
          type: 'ban_appeal_direct',
        });
      }

      return jsonResponse({
        ok: true,
        chatId,
        forwardedAt: isBanAppeal ? new Date().toISOString() : null,
        id: appealId,
      });
    },
  },

  {
    method: 'GET',
    pattern: /^\/api\/appeals$/,
    handler: async (req, env) => {
      const token = extractToken(req);
      if (!token) return jsonError('Unauthorized', 401);

      const user = await getUserByToken(env.DB, token);
      if (!user) return jsonError('Unauthorized', 401);

      if (await isBanned(env.DB, user.discord_id)) {
        return jsonError('Your account has been banned from review', 403);
      }

      const url = new URL(req.url);
      const status = url.searchParams.get('status') || 'pending';
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

      const appeals = await env.DB
        .prepare(
          `SELECT id, chat_id as chatId, title, nickname, faction, contact, category, message,
                  status, verdicts_count as verdictsCount, created_at as createdAt
           FROM appeals
           WHERE status = ?
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .bind(status, limit)
        .all<any>();

      return jsonResponse(appeals.results);
    },
  },

  // --- Verdicts ------------------------------------------------------------

  {
    method: 'GET',
    pattern: /^\/api\/appeals\/(\d+)\/verdicts$/,
    handler: async (req, env, params) => {
      const token = extractToken(req);
      if (!token) return jsonError('Unauthorized', 401);

      const user = await getUserByToken(env.DB, token);
      if (!user) return jsonError('Unauthorized', 401);

      const appealId = parseInt(params[0]);

      const verdicts = await env.DB
        .prepare(
          `SELECT v.id, v.verdict, v.reason, v.created_at as createdAt,
                  u.username as username, u.avatar as userAvatar
           FROM verdicts v
           JOIN users u ON v.user_id = u.id
           WHERE v.appeal_id = ?
           ORDER BY v.created_at ASC`,
        )
        .bind(appealId)
        .all<any>();

      return jsonResponse(verdicts.results);
    },
  },

  {
    method: 'POST',
    pattern: /^\/api\/appeals\/(\d+)\/verdicts$/,
    handler: async (req, env, params) => {
      const token = extractToken(req);
      if (!token) return jsonError('Unauthorized', 401);

      const user = await getUserByToken(env.DB, token);
      if (!user) return jsonError('Unauthorized', 401);

      if (await isBanned(env.DB, user.discord_id)) {
        return jsonError('Your account has been banned from review', 403);
      }

      const appealId = parseInt(params[0]);

      // Check appeal exists and is still pending
      const appeal = await env.DB
        .prepare('SELECT id, status, verdicts_count FROM appeals WHERE id = ?')
        .bind(appealId)
        .first<{ id: number; status: string; verdicts_count: number }>();

      if (!appeal) return jsonError('Appeal not found', 404);
      if (appeal.status !== 'pending') return jsonError('Appeal is no longer pending', 400);

      let body: any;
      try {
        body = await req.json();
      } catch {
        return jsonError('Invalid JSON body', 400);
      }

      const { verdict, reason } = body;
      if (!['guilty', 'not_guilty', 'insufficient_evidence'].includes(verdict)) {
        return jsonError('Invalid verdict. Must be: guilty, not_guilty, insufficient_evidence', 400);
      }

      // Check if user already voted
      const existing = await env.DB
        .prepare('SELECT 1 FROM verdicts WHERE appeal_id = ? AND user_id = ?')
        .bind(appealId, user.id)
        .first();

      if (existing) return jsonError('You have already submitted a verdict for this appeal', 400);

      await env.DB
        .prepare('INSERT INTO verdicts (appeal_id, user_id, verdict, reason) VALUES (?, ?, ?, ?)')
        .bind(appealId, user.id, verdict, reason || null)
        .run();

      // Update verdicts count
      const newCount = (appeal.verdicts_count || 0) + 1;
      await env.DB
        .prepare('UPDATE appeals SET verdicts_count = ? WHERE id = ?')
        .bind(newCount, appealId)
        .run();

      // Check if we should forward to Zapier
      await checkAndForwardToZapier(env, appealId);

      return jsonResponse({
        success: true,
        verdictsCount: newCount,
        forwarded: newCount >= 5,
      });
    },
  },
];

// ---------------------------------------------------------------------------
// Main fetch handler
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Try to match a route
    const matched = matchRoute(path, method, routes);
    if (matched) {
      return withCors(await matched.handler(request, env, matched.params));
    }

    // Fallback: 404
    return withCors(jsonError('Not found', 404));
  },
};
