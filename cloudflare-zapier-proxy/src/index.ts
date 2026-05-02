// Cloudflare Worker - Balkan Conflict Rules Backend
// Handles Discord OAuth, D1 DB, Appeals, Verdicts

interface Env {
  DB: D1Database;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_REDIRECT_URI: string;
  ZAP_URL: string;
}

// CORS headers
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// JSON response helper
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
  });
}

// Error response
function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

// Handle Discord OAuth login
async function handleDiscordAuth(env: Env): Promise<Response> {
  const url = new URL('https://discord.com/api/oauth2/authorize');
  url.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.DISCORD_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'identify email');
  
  return Response.redirect(url.toString(), 302);
}

// Handle Discord OAuth callback
async function handleDiscordCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  
  if (!code) {
    return errorResponse('No code provided', 400);
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
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

    if (!tokenResponse.ok) {
      return errorResponse('Failed to exchange code', 500);
    }

    const tokenData = await tokenResponse.json() as { access_token: string };
    
    // Get user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      return errorResponse('Failed to get user info', 500);
    }

    const discordUser = await userResponse.json() as {
      id: string;
      username: string;
      discriminator: string;
      avatar: string;
      email?: string;
    };

    // Upsert user in D1
    const existing = await env.DB.prepare('SELECT * FROM users WHERE discord_id = ?')
      .bind(discordUser.id)
      .first();

    let userId;
    if (existing) {
      await env.DB.prepare(
        'UPDATE users SET username = ?, discriminator = ?, avatar = ?, email = ?, updated_at = datetime(\'now\') WHERE discord_id = ?'
      ).bind(discordUser.username, discordUser.discriminator, discordUser.avatar, discordUser.email || null, discordUser.id).run();
      userId = existing.id;
    } else {
      const result = await env.DB.prepare(
        'INSERT INTO users (discord_id, username, discriminator, avatar, email) VALUES (?, ?, ?, ?, ?)'
      ).bind(discordUser.id, discordUser.username, discordUser.discriminator, discordUser.avatar, discordUser.email || null).run();
      userId = result.meta.last_row_id;
    }

    // Create session cookie
    const session = btoa(JSON.stringify({ userId, discordId: discordUser.id }));
    
    return new Response(JSON.stringify({
      success: true,
      user: { 
        id: userId, 
        discordId: discordUser.id, 
        username: discordUser.username, 
        avatar: discordUser.avatar,
        isAdmin: false 
      }
    }), {
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json',
        'Set-Cookie': `session=${session}; Path=/; HttpOnly; SameSite=Lax`,
      },
    });

  } catch (err: any) {
    return errorResponse(`OAuth error: ${err.message}`, 500);
  }
}

// Get current user from session
async function handleGetMe(request: Request, env: Env): Promise<Response> {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return errorResponse('Not authenticated', 401);

  const sessionCookie = cookie.split(';').find(c => c.trim().startsWith('session='));
  if (!sessionCookie) return errorResponse('Not authenticated', 401);

  try {
    const session = JSON.parse(atob(sessionCookie.split('=')[1]));
    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(session.userId)
      .first();

    if (!user) return errorResponse('User not found', 401);

    return jsonResponse({
      id: user.id,
      discordId: user.discord_id,
      username: user.username,
      avatar: user.avatar,
      isAdmin: user.is_admin === 1
    });
  } catch {
    return errorResponse('Invalid session', 401);
  }
}

// Logout
function handleLogout(): Response {
  return new Response(JSON.stringify({ success: true }), {
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json',
      'Set-Cookie': 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    },
  });
}

// Submit appeal
async function handleSubmitAppeal(request: Request, env: Env): Promise<Response> {
  if (!env.ZAP_URL) return errorResponse('Zapier URL not configured', 503);

  try {
    const body = await request.json() as any;
    const { chatId, title, nickname, faction, contact, category, message } = body;

    if (!title || !nickname || !category || !message) {
      return errorResponse('Missing required fields', 400);
    }

    // If "Аппеляция на наказание", send directly to admin
    if (category === 'Аппеляция на наказание') {
      await fetch(env.ZAP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'balkan-rules-admin',
          chatId, title, nickname, faction, contact, category, message,
          priority: 'high',
          forwardedAt: new Date().toISOString(),
        }),
      });
      return jsonResponse({ ok: true, sentTo: 'admin' });
    }

    // Save to DB
    const result = await env.DB.prepare(
      'INSERT INTO appeals (chat_id, title, nickname, faction, contact, category, message, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(chatId, title, nickname, faction || null, contact || null, category, message, 'pending').run();

    return jsonResponse({ ok: true, appealId: result.meta.last_row_id, sentTo: 'review' });

  } catch (err: any) {
    return errorResponse(`Failed to submit appeal: ${err.message}`, 500);
  }
}

// Get appeals for review
async function handleGetAppeals(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'pending';

  try {
    const { results } = await env.DB.prepare('SELECT * FROM appeals WHERE status = ? ORDER BY created_at DESC')
      .bind(status)
      .all();
    return jsonResponse(results);
  } catch (err: any) {
    return errorResponse(`Failed to get appeals: ${err.message}`, 500);
  }
}

// Submit verdict
async function handleSubmitVerdict(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const match = url.pathname.match(/\/api\/appeals\/(\d+)\/verdicts/);
  if (!match) return errorResponse('Invalid appeal ID', 400);

  const appealId = match[1];

  try {
    const body = await request.json() as any;
    const { userId, verdict, reason } = body;

    if (!verdict) return errorResponse('Verdict is required', 400);

    // Insert verdict
    await env.DB.prepare(
      'INSERT INTO verdicts (appeal_id, user_id, verdict, reason) VALUES (?, ?, ?, ?)'
    ).bind(appealId, userId || 0, verdict, reason || null).run();

    // Count verdicts
    const { results: verdicts } = await env.DB.prepare('SELECT * FROM verdicts WHERE appeal_id = ?')
      .bind(appealId)
      .all();
    
    const verdictsCount = verdicts.length;

    // Update appeal verdicts count
    await env.DB.prepare('UPDATE appeals SET verdicts_count = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(verdictsCount, appealId)
      .run();

    // If 5 verdicts collected, send to Zapier
    if (verdictsCount >= 5) {
      const appeal = await env.DB.prepare('SELECT * FROM appeals WHERE id = ?')
        .bind(appealId)
        .first();

      if (appeal) {
        await fetch(env.ZAP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'balkan-rules-verdicts',
            appealId: appeal.id,
            title: appeal.title,
            nickname: appeal.nickname,
            faction: appeal.faction,
            category: appeal.category,
            message: appeal.message,
            verdicts: verdicts,
            verdictsCount,
            forwardedAt: new Date().toISOString(),
          }),
        });

        await env.DB.prepare('UPDATE appeals SET status = ?, zapier_sent = 1, zapier_sent_at = datetime(\'now\') WHERE id = ?')
          .bind('sent_to_admin', appealId)
          .run();
      }
    }

    return jsonResponse({ success: true, verdictsCount });

  } catch (err: any) {
    return errorResponse(`Failed to submit verdict: ${err.message}`, 500);
  }
}

// Get verdicts for appeal
async function handleGetVerdicts(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const match = url.pathname.match(/\/api\/appeals\/(\d+)\/verdicts/);
  if (!match) return errorResponse('Invalid appeal ID', 400);

  const appealId = match[1];

  try {
    const { results } = await env.DB.prepare('SELECT * FROM verdicts WHERE appeal_id = ?')
      .bind(appealId)
      .all();
    return jsonResponse(results);
  } catch (err: any) {
    return errorResponse(`Failed to get verdicts: ${err.message}`, 500);
  }
}

// Health check
function handleHealthCheck(): Response {
  return jsonResponse({ status: 'ok' });
}

// Main fetch handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Route handling
    if (path === '/auth/discord' && request.method === 'GET') {
      return handleDiscordAuth(env);
    }

    if (path === '/auth/discord/callback' && request.method === 'GET') {
      return handleDiscordCallback(request, env);
    }

    if (path === '/auth/me' && request.method === 'GET') {
      return handleGetMe(request, env);
    }

    if (path === '/auth/logout' && request.method === 'POST') {
      return handleLogout();
    }

    if (path === '/api/appeals' && request.method === 'POST') {
      return handleSubmitAppeal(request, env);
    }

    if (path === '/api/appeals' && request.method === 'GET') {
      return handleGetAppeals(request, env);
    }

    // Verdicts routes
    const verdictMatch = path.match(/\/api\/appeals\/(\d+)\/verdicts/);
    if (verdictMatch) {
      if (request.method === 'POST') {
        return handleSubmitVerdict(request, env);
      }
      if (request.method === 'GET') {
        return handleGetVerdicts(request, env);
      }
    }

    if (path === '/api/healthz' && request.method === 'GET') {
      return handleHealthCheck();
    }

    return errorResponse('Not found', 404);
  }
};
