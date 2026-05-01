// Cloudflare Worker (modules format): forwards requests to a Zapier Webhook URL.
// ZAP_URL environment variable must be set with the Zapier Webhook URL.
// No query parameters required; the URL is configured via environment.

interface Env {
  ZAP_URL: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env);
  }
};

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const zapUrl = env.ZAP_URL;
  if (!zapUrl) {
    return new Response('Zapier URL not configured. Set ZAP_URL environment variable.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  try {
    const forwardInit: RequestInit = {
      method: request.method,
      headers: new Headers(request.headers),
      body: (request.method === 'GET' || request.method === 'HEAD') ? undefined : await request.clone().arrayBuffer()
    };

    const zapResp = await fetch(zapUrl, forwardInit);
    return zapResp;
  } catch (err: any) {
    return new Response('Error forwarding to Zapier: ' + String(err.message || err), {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}
