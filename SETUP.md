# Balkan Conflict Rules - Setup Guide (Final Architecture)

## Architecture (Updated)

```
Frontend (Cloudflare Pages: retrime.pages.dev)
        ↓ (API requests)
Cloudflare Worker (Full Backend: retrime.korsetov2009.workers.dev)
        ↓
Cloudflare D1 (SQLite Database)
        ↓
Zapier → RCON (Game Punishment)
```

**Worker handles everything:**
- Discord OAuth (redirects & callback)
- Database (D1) operations
- Appeal submission & verdict system
- Forwarding to Zapier

## Environment Variables

### Worker (`cloudflare-zapier-proxy/wrangler.toml`)
Set via `wrangler secret put` (production):
```bash
cd cloudflare-zapier-proxy
wrangler secret put DISCORD_CLIENT_ID
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put DISCORD_REDIRECT_URI
wrangler secret put ZAP_URL
```

Or set in `wrangler.toml` for local dev (not recommended for secrets).

### Frontend (`artifacts/rules/.env` or Cloudflare Pages environment)
```bash
# Only Worker URL needed - Discord OAuth is handled by Worker
VITE_API_URL=https://retrime.korsetov2009.workers.dev
```

## Discord OAuth Setup

1. Go to https://discord.com/developers/applications
2. Create a new application
3. Go to "OAuth2" → "General"
4. Add **Redirect URI**: `https://retrime.korsetov2009.workers.dev/auth/discord/callback`
5. Copy **Client ID** and **Client Secret** to Worker secrets

## Database Setup (Cloudflare D1)

1. Create D1 database:
   ```bash
   cd cloudflare-zapier-proxy
   wrangler d1 create balkan-rules-db
   ```

2. Copy the `database_id` from output and update `wrangler.toml`:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "balkan-rules-db"
   database_id = "paste-id-here"
   ```

3. Run schema:
   ```bash
   wrangler d1 execute balkan-rules-db --local --file=./schema.sql
   ```

4. For production:
   ```bash
   wrangler d1 execute balkan-rules-db --remote --file=./schema.sql
   ```

## Deployment

### Worker (Full Backend)
```bash
cd cloudflare-zapier-proxy
wrangler publish
```

### Frontend (Cloudflare Pages)
- Build command: `cd ../.. && pnpm --filter rules build`
- Build output directory: `artifacts/rules/dist/public`
- Add environment variable in Pages settings: `VITE_API_URL=https://retrime.korsetov2009.workers.dev`

## Features Implemented

1. ✅ Discord OAuth (handled entirely by Worker)
2. ✅ Appeal submission with categories
3. ✅ "Апелляция на наказание" goes directly to admins via Zapier
4. ✅ Review Appeals page (`/review`)
5. ✅ Verdict system (guilty, not_guilty, insufficient_evidence)
6. ✅ When 5 verdicts collected → send to Zapier for analysis → RCON punishment
7. ✅ User roles (admin vs regular player)
8. ✅ D1 Database (no external PostgreSQL needed)
9. ✅ No Express server needed - Worker is the full backend

## Flow

1. User clicks "Login with Discord" → redirects to `https://retrime.korsetov2009.workers.dev/auth/discord`
2. Worker redirects to Discord OAuth with proper parameters
3. After authorization, Discord redirects to Worker callback
4. Worker processes OAuth, creates/updates user in D1, sets session cookie
5. User submits appeal → saved to D1 with status "pending"
6. Other players review appeals at `/review` (fetch from Worker `/api/appeals`)
7. Players submit verdicts → saved to D1
8. When 5 verdicts collected → Worker sends to Zapier for analysis → RCON punishment
9. "Апелляция на наказание" bypasses verdict system → sent directly to admins via Zapier

## Removed (Cleanup Completed)

- ❌ `artifacts/api-server` (Express) - deleted
- ❌ PostgreSQL dependency - replaced with Cloudflare D1
- ❌ External API server hosting - Worker handles everything
- ❌ Frontend Discord OAuth variables - now handled by Worker
