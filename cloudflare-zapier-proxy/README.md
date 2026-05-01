# Zapier proxy Cloudflare Worker

- Purpose: intercepts requests from your site and forwards them to a Zapier API URL.
- Usage: deploy as a Cloudflare Worker (wrangler). The Zapier URL is configured via the `ZAP_URL` environment variable.
- Security: the Zapier URL is stored as an environment variable, not exposed in query strings.

Minimal notes:
- This forwards all request properties (method, headers, and body for non-GET/HEAD) to the Zapier URL.
- It returns Zapier's response directly to the client.

How to configure:
- For local development: uncomment the `[vars]` section in `wrangler.toml` and set `ZAP_URL`, or use `wrangler dev --var ZAP_URL=your_url`.
- For production: set the secret using `wrangler secret put ZAP_URL` (do not commit secrets to `wrangler.toml`).

How to run locally (optional):
- Install wrangler and login to Cloudflare.
- In this folder, run `wrangler dev` to test locally.

How to deploy:
- Run `wrangler publish` in this folder.
- Ensure `ZAP_URL` is set via secret for production.
