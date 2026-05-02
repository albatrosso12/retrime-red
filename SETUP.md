# Balkan Conflict Rules - Setup Guide

## Architecture

```
┌─────────────────────────────────────────────────┐
│               Cloudflare Pages                   │
│           (Frontend - React/Vite)                │
│         retrime.pages.dev                        │
│                                                  │
│  Token: localStorage + Bearer header             │
│  Auth flow: URL hash fragment (#token=xxx)       │
└───────────────────┬─────────────────────────────┘
                    │ fetch('/api/*')
                    │ Authorization: Bearer <token>
                    ▼
┌─────────────────────────────────────────────────┐
│            Cloudflare Worker                     │
│     retrime.korsetov2009.workers.dev             │
│                                                  │
│  Auth routes:                                    │
│    GET  /auth/discord          → Discord OAuth   │
│    GET  /auth/discord/callback → Create session  │
│    GET  /api/auth/me           → Get user        │
│    POST /api/auth/logout       → Delete session  │
│                                                  │
│  API routes (require Bearer token):              │
│    GET  /api/healthz                             │
│    POST /api/appeals          → Save to D1       │
│    GET  /api/appeals          → List appeals     │
│    GET  /api/appeals/:id/verdicts                │
│    POST /api/appeals/:id/verdicts                │
│                                                  │
│  Zapier forwarding:                              │
│    - Ban appeals → immediately                   │
│    - Other appeals → after 5 verdicts            │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│              Cloudflare D1                       │
│              (SQLite Database)                   │
│                                                  │
│  Tables:                                         │
│    users          → Discord users               │
│    sessions       → Auth tokens (7d TTL)         │
│    appeals        → Player appeals               │
│    verdicts       → Review verdicts              │
│    banned_users   → Banned from review           │
└─────────────────────────────────────────────────┘
                    │ (conditional)
                    ▼
┌─────────────────────────────────────────────────┐
│                  Zapier                          │
│   → AI analysis → Telegram/Discord → RCON        │
└─────────────────────────────────────────────────┘
```

## Auth Flow

1. User clicks "Login with Discord" → `GET /auth/discord` on Worker
2. Worker redirects to Discord OAuth authorization page
3. After authorization, Discord redirects to `GET /auth/discord/callback` on Worker
4. Worker exchanges code for Discord user info, creates user in D1, creates session token
5. Worker redirects to frontend: `frontend/auth/callback#token=<48-char-token>`
6. Frontend (`AuthCallback.tsx`) extracts token from hash, saves to localStorage + cookie
7. Frontend dispatches `auth:token-changed` event
8. All subsequent API calls include `Authorization: Bearer <token>` header
9. Token TTL: 7 days (stored in `sessions.expires_at`)

### Token Persistence

- **Primary**: `localStorage.getItem('auth_token')`
- **Fallback**: `document.cookie` (auth_token cookie)
- **On page load**: `main.tsx` processes hash tokens and sets up auth token getter
- **API client**: `custom-fetch.ts` automatically attaches Bearer header via `setAuthTokenGetter`

## Environment Variables

### Worker (`cloudflare-zapier-proxy/wrangler.toml`)

Set via `wrangler secret put` for production:
```bash
cd cloudflare-zapier-proxy
wrangler secret put DISCORD_CLIENT_ID
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put DISCORD_REDIRECT_URI
wrangler secret put ZAP_URL
```

Variables in `wrangler.toml`:
| Variable | Description | Example |
|----------|-------------|---------|
| `DISCORD_CLIENT_ID` | Discord app client ID | `1499936916127088793` |
| `DISCORD_REDIRECT_URI` | OAuth callback URL | `https://retrime.korsetov2009.workers.dev/auth/discord/callback` |
| `FRONTEND_URL` | Frontend origin for redirect after OAuth | `https://retrime.pages.dev` |

### Frontend (`artifacts/rules/.env`)

```bash
VITE_API_URL=https://retrime.korsetov2009.workers.dev
```

## Discord OAuth Setup

1. Go to https://discord.com/developers/applications
2. Create a new application
3. Go to "OAuth2" → "General"
4. Add Redirect URI: `https://retrime.korsetov2009.workers.dev/auth/discord/callback`
5. Copy Client ID and Client Secret to Worker secrets

## Database Setup (Cloudflare D1)

1. Create D1 database:
   ```bash
   cd cloudflare-zapier-proxy
   wrangler d1 create retrime
   ```

2. Copy the `database_id` from output and update `wrangler.toml`

3. Run schema:
   ```bash
   wrangler d1 execute retrime --remote --file=./schema.sql
   ```

### Database Schema

| Table | Description | Key Fields |
|-------|-------------|------------|
| `users` | Discord authenticated users | id, discord_id, username, avatar, is_admin |
| `sessions` | Auth session tokens (7d TTL) | token (PK), user_id, expires_at |
| `appeals` | Player appeals/complaints | id, chat_id, title, nickname, category, message, status, verdicts_count, zapier_sent |
| `verdicts` | Review verdicts on appeals | id, appeal_id, user_id, verdict, reason |
| `banned_users` | Users banned from review | id, discord_id, reason |

## API Endpoints

### Auth
| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/auth/discord` | Start Discord OAuth | No |
| GET | `/auth/discord/callback` | OAuth callback handler | No |
| GET | `/api/auth/me` | Get current user info | Bearer token |
| POST | `/api/auth/logout` | Invalidate session | Bearer token |

### Appeals
| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | `/api/appeals` | Submit a new appeal | No (optional) |
| GET | `/api/appeals?status=pending` | List appeals for review | Bearer token |

### Verdicts
| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/api/appeals/:id/verdicts` | Get verdicts for appeal | Bearer token |
| POST | `/api/appeals/:id/verdicts` | Submit a verdict | Bearer token |

### Other
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/healthz` | Health check |

## Appeal Flow

1. **Submission**: User submits appeal via `/chat/:id` form
   - Saved to D1 with `status: 'pending'`
   - If category = "Апелляция на наказание" → immediately sent to Zapier, status = 'forwarded'

2. **Review**: Authenticated users visit `/review` page
   - Fetches pending appeals from `GET /api/appeals?status=pending`
   - Each user can submit ONE verdict per appeal
   - Verdicts: `guilty`, `not_guilty`, `insufficient_evidence`

3. **Forwarding**: When 5 verdicts collected
   - Worker automatically sends appeal + all verdicts to Zapier
   - Status changes to 'forwarded', `zapier_sent = 1`

4. **Banned users**: Users in `banned_users` table get 403 on review endpoints

## Deployment

### Worker
```bash
cd cloudflare-zapier-proxy
wrangler publish
```

### Frontend (Cloudflare Pages)
- Build command: `cd ../.. && pnpm --filter rules build`
- Build output: `artifacts/rules/dist/public`
- Environment variable: `VITE_API_URL=https://retrime.korsetov2009.workers.dev`

### Regenerate API Client
After changing `openapi.yaml`:
```bash
cd lib/api-spec
pnpm run codegen
```

## Features

- Discord OAuth with 7-day session tokens
- Appeal submission with categories
- Ban appeals bypass verdict system → direct to admins
- 5-verdict threshold for forwarding to Zapier
- User ban system (prevent specific Discord users from reviewing)
- Auto-generated React Query hooks from OpenAPI spec
- Dark mode Gemini-inspired UI
