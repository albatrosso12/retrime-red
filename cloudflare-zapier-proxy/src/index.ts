// Cloudflare Worker - Balkan Conflict Rules (Simplified for CORS debugging)
// Handles CORS globally, no auth for now.

interface Env {
  DB: D1Database;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_REDIRECT_URI: string;
  ZAP_URL: string;
}

// CORS headers - set globally
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Add CORS to any Response
function withCors(response: Response): Response {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value as string);
  });
  return response;
}

// JSON helper
function json(data: any, status = 200): Response {
  return withCors(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
}

// Error helper
function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

// Main fetch handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // Debug: return something for any GET
    if (request.method === 'GET') {
      // For /auth/me - return test user without auth
      if (path === '/auth/me' || path === '/api/auth/me') {
        return json({
          id: 1,
          discordId: '714158854551765112',
          username: 'eyenosee',
          avatar: 'ed5b8d717879f0bfc6400b66b3229bc7',
          isAdmin: false
        });
      }

      // For /auth/discord - redirect to Discord
      if (path === '/auth/discord') {
        const discordUrl = new URL('https://discord.com/api/oauth2/authorize');
        discordUrl.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
        discordUrl.searchParams.set('redirect_uri', env.DISCORD_REDIRECT_URI);
        discordUrl.searchParams.set('response_type', 'code');
        discordUrl.searchParams.set('scope', 'identify email');
        return Response.redirect(discordUrl.toString(), 302);
      }

      // For /auth/discord/callback - handle OAuth
      if (path === '/auth/discord/callback') {
        const code = url.searchParams.get('code');
        if (!code) return error('No code', 400);
        
        // Exchange code for token (simplified, no DB for now)
        return withCors(new Response(null, {
          status: 302,
          headers: {
            'Location': `https://retrime.pages.dev/auth/callback#token=test_token`,
          },
        }));
      }

      // Default response
      return json({ message: 'Worker is up', path });
    }

    // For POST requests
    if (request.method === 'POST') {
      // For /auth/logout
      if (path === '/auth/logout' || path === '/api/auth/logout') {
        return json({ success: true });
      }

      // For /api/appeals
      if (path === '/api/appeals') {
        return json({ ok: true, message: 'Appeal submitted (simplified)' });
      }

      // For verdicts
      if (path.match(/\/api\/appeals\/\d+\/verdicts/)) {
        return json({ success: true, verdictsCount: 1 });
      }
    }

    return error('Not found', 404);
  }
};
