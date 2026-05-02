# Balkan Conflict Rules - Setup Guide

## Architecture

```
Frontend (Cloudflare Pages) → API Server (Express + PostgreSQL) → Zapier → RCON
```

## Environment Variables

### API Server (`artifacts/api-server`)

Create `.env` file or set in Cloudflare/Deployment settings:

```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/c/your-webhook-url
```

### Frontend (`artifacts/rules`)

```
API_URL=http://localhost:3000
```

For production, update `API_URL` to your deployed API server URL.

## Discord OAuth Setup

1. Go to https://discord.com/developers/applications
2. Create a new application
3. Go to "OAuth2" → "General"
4. Add redirect URL: `http://localhost:3000/api/auth/discord/callback`
5. Copy Client ID and Client Secret to your environment variables

## Database Setup

1. Create a PostgreSQL database
2. Run migrations:
   ```bash
   pnpm --filter db push
   ```

## Deployment

### API Server
Deploy to a Node.js hosting provider (Railway, Render, Heroku, etc.)

### Frontend (Rules)
Deploy to Cloudflare Pages:
- Build command: `cd ../.. && pnpm --filter rules build`
- Build output directory: `artifacts/rules/dist/public`

### Worker (Optional Proxy)
If you want to keep using the Worker as a proxy:
```bash
cd cloudflare-zapier-proxy
npx wrangler publish
```

## Features Implemented

1. ✅ Discord OAuth login
2. ✅ Appeal submission with categories
3. ✅ "Аппеляция на наказание" goes directly to admins via Zapier
4. ✅ Review Appeals page (`/review`)
5. ✅ Verdict system (guilty, not_guilty, insufficient_evidence)
6. ✅ When 5 verdicts collected → send to Zapier for RCON punishment
7. ✅ User roles (admin vs regular player)

## Flow

1. User logs in via Discord
2. User submits an appeal (except "Аппеляция на наказание")
3. Appeal goes to DB with status "pending"
4. Other players review appeals at `/review`
5. Players submit verdicts
6. When 5 verdicts collected → sent to Zapier for analysis → RCON punishment
7. "Аппеляция на наказание" bypasses verdict system → sent directly to admins
