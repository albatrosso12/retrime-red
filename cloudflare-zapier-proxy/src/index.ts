// Cloudflare Worker: receives appeals from frontend and forwards to Zapier.
// Handles CORS for direct browser-to-worker communication.

interface Env {
  ZAP_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight (OPTIONS) requests
    if (request.method === 'OPTIONS') {
      return handleCors();
    }

    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Handle the appeal submission
    return handleAppeal(request, env);
  }
};

function handleCors(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

async function handleAppeal(request: Request, env: Env): Promise<Response> {
  const zapUrl = env.ZAP_URL;
  if (!zapUrl) {
    return new Response('Zapier URL not configured', { status: 500 });
  }

  try {
    // Read the body from the incoming request
    const body = await request.json() as Record<string, unknown>;

    // Add fields that the original API server was adding
    const zapierBody = {
      source: 'balkan-rules',
      ...body,
      forwardedAt: new Date().toISOString(),
    };

    // Forward to Zapier
    const zapResp = await fetch(zapUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zapierBody),
    });

    // CORS headers for the actual response
    const headers = new Headers(zapResp.headers);
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(zapResp.body, {
      status: zapResp.status,
      statusText: zapResp.statusText,
      headers: headers,
    });
  } catch (err: any) {
    return new Response('Error: ' + String(err.message || err), {
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
