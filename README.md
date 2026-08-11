<p align="center">
  <img src="apps/web/public/logo.png" alt="BriefBox" width="80" height="80" />
</p>

<h1 align="center">BriefBox</h1>

<p align="center">
  <em>Disposable temporary email for instant privacy.</em>
</p>

<p align="center">
  One address. One hour. Zero accounts.
</p>


BriefBox gives every visitor a throwaway inbox that self-destructs automatically. Incoming mail is scanned for phishing and scam signals before it appears in the UI.

<p align="center">
  <img src="assets/home.png" alt="BriefBox" />
</p>

---

## Features

| Feature | Description |
|--------|-------------|
| **No signup** | Cookie-based session only — no accounts, passwords, or database users |
| **1-hour inbox** | Session, address, and messages expire via Redis TTL |
| **Real email** | Receives real messages on your domain via Cloudflare Email Routing |
| **Safety scoring** | Local rule-based scanner → Safe / Warning / Dangerous badges |
| **HTML + text** | Parses MIME with `mailparser`; HTML is sanitized in the UI |
| **Live inbox** | Poll / revalidate to pick up new mail without manual spam-refresh |
| **Copy address** | One-click copy of the temporary address |
| **Countdown** | Live timer until the session self-destructs |
| **Rate limiting** | Per-IP limits on API and webhook routes |
| **Monorepo** | `pnpm` workspaces + Turborepo (`web` + `backend`) |

### Safety scoring (local, no LLM)

Emails are scored from content, links, structure, and sender patterns:

- Strong phishing / scam phrases  
- Suspicious TLDs, IP links, shorteners  
- Brand mismatch on credential-style links  
- Urgent subject + shady link combinations  
- HTML-only bait with almost no text  

| Score | Level |
|------:|-------|
| 0–20 | **Safe** |
| 21–50 | **Warning** |
| 51+ | **Dangerous** |

---

## Architecture

```text
Browser
  └─ apps/web  (React Router)
        │
        ▼
  apps/backend  (Fastify)
        │
        ├─ Redis  (sessions + emails, TTL = session lifetime)
        │
        └─ POST /api/webhook/email
                ▲
                │
        Cloudflare Email Worker
                ▲
                │
        Cloudflare Email Routing (catch-all @yourdomain)
                ▲
        Anyone sends mail to random@yourdomain
```

### Redis key design

```text
session:{sessionId}                  → SessionData
email-to-session:{address}           → sessionId
email:{sessionId}:{emailId}          → IncomingEmail
```

Everything is deleted automatically when TTLs expire, or immediately on session destroy.

---

## Monorepo layout

```text
briefbox/
├── apps/
│   ├── web/                 # React Router frontend
│   └── backend/             # Fastify API
├── packages/                # shared packages (if any)
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── .env                     # root env (loaded by dotenv-cli)
```

Package names:

- `@workspace/web`
- `@workspace/backend`

---

## Requirements

- Node.js 22+ (v24 Preffered)
- pnpm 11+
- Redis (local or hosted, e.g. Upstash)
- A domain on Cloudflare (for real inbound email)
- Optional: Docker

---

## Environment variables

Create a root `.env` copying `.env.example`:

```env
NODE_ENV=development
VITE_ENV=development

BACKEND_PORT=4000

WEB_URL=http://localhost:5170
API_BASE_URL=http://localhost:4000

SESSION_COOKIE_NAME=briefbox_session
SESSION_TTL=1h          # supports: 30m, 1h, 2h, 1d, etc.

REDIS_URL=rediss://default:xxxxxxxx@yyyy

EMAIL_DOMAIN=briefbox.dev

WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Notes

| Variable | Used by | Notes |
|----------|---------|--------|
| `API_BASE_URL` | Web loaders / server | Use `host.docker.internal` or Compose service name in Docker |
| `WEB_URL` | Backend CORS | Must match the site origin |
| `EMAIL_DOMAIN` | Backend | Domain used in generated addresses |
| `WEBHOOK_SECRET` | Backend + CF Worker | Shared secret header |

---

## Local development

### 1. Install

```bash
pnpm install
```

### 2. Start Redis

Local example:

```bash
docker run --rm -p 6379:6379 redis:7-alpine
```

Or point `REDIS_URL` at a hosted instance.

### 3. Run apps

From repo root:

```bash
# both
pnpm dev

# or separately
pnpm web:dev
pnpm backend:dev
```

Typical local URLs:

- Web: `http://localhost:5170`
- API: `http://localhost:4000`

### 4. Useful scripts

```bash
pnpm web:build
pnpm web:start

pnpm backend:build
pnpm backend:start
```

Backend production build rewrites path aliases (`~/...`) and ESM `.js` extensions before `node dist/index.js`.

---

## Cloudflare Email Routing setup

BriefBox receives real mail by routing **all addresses** on your domain through Cloudflare into a Worker, which POSTs to your backend webhook.

### A. Point the domain at Cloudflare

1. Add the domain in the Cloudflare dashboard.  
2. At your registrar (e.g. Namecheap), set Cloudflare nameservers.  
3. Wait until the domain status is **Active**.

> DNS management moves to Cloudflare after nameserver update.

### B. Enable Email Routing

1. Open **Email** → **Email Routing** → your domain.  
2. Enable Email Routing and allow Cloudflare to add MX / TXT records.  
3. Add and **verify** at least one destination address (required once by Cloudflare).  

### C. Enable Catch-all

1. Go to **Routing rules** / **Routes**.  
2. Enable **Catch-all address**.  
3. For the first test you may **Send to an email**.  
4. Later switch the action to **Send to a Worker** (below).

Catch-all is required because BriefBox addresses are random (`x7k9p2m@yourdomain.com`).

### D. Create the Email Worker

1. **Workers & Pages** → **Create Worker**.  
2. Name it e.g. `briefbox-email-worker`.  
3. Deploy, then paste a worker that forwards to your API:

```js
export default {
  async email(message, env, ctx) {
    try {
      const from = message.from;
      const to = message.to;
      const subject = message.headers.get("subject") || "(no subject)";

      // Read the raw email content
      const rawEmail = await new Response(message.raw).text();

      const payload = {
        from,
        to,
        subject,
        raw: rawEmail,               // full raw email (headers + body)
        headers: Object.fromEntries(message.headers),
        receivedAt: new Date().toISOString(),
      };

      const webhookUrl = env.WEBHOOK_URL; // e.g. https://api.yourdomain.com/api/webhook/email
      const secret = env.WEBHOOK_SECRET;

      if (!webhookUrl) {
        console.error("WEBHOOK_URL is not set");
        message.setReject("Webhook not configured");
        return;
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "X-Webhook-Secret": secret } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error("Webhook failed:", response.status, await response.text());
        // You can choose to reject or just log
        // message.setReject("Failed to process email");
      }
    } catch (err) {
      console.error("Email Worker error:", err);
      // message.setReject("Internal error");
    }
  },
};
```

4. In the Worker **Settings → Variables**, set:

| Variable | Example |
|----------|---------|
| `WEBHOOK_URL` | `https://api.yourdomain.com/api/webhook/email` |
| `WEBHOOK_SECRET` | same value as backend `WEBHOOK_SECRET` |

For local testing, expose the backend with a tunnel (Cloudflare Tunnel, ngrok, etc.) and put that URL in `WEBHOOK_URL`.

### E. Point Catch-all at the Worker

1. Email Routing → Catch-all  
2. Action: **Send to a Worker**  
3. Select `briefbox-email-worker`  
4. Save  

### F. Backend must know the domain

```env
EMAIL_DOMAIN=yourdomain.com
```

Generated addresses become:

```text
{random}@yourdomain.com
```

### G. End-to-end test

1. Open BriefBox and copy the temp address.  
2. Send mail from Gmail to that address.  
3. Confirm Worker logs show a delivery.  
4. Confirm backend logs show `POST /api/webhook/email`.  
5. Refresh / wait for revalidate — message appears with a risk badge.

---

## Docker

Build from the **monorepo root** so workspace packages resolve.

### Web

```bash
docker build -f apps/web/Dockerfile -t briefbox-web .
docker run --rm -p 3000:3000 --env-file .env briefbox-web
```

### Backend

```bash
docker build -f apps/backend/Dockerfile -t briefbox-backend .
docker run --rm -p 4000:4000 --env-file .env briefbox-backend
```

### Docker networking tip

Inside a container, `localhost` is the container itself.

For SSR/loaders calling the API:

```env
# server-side and browser
API_BASE_URL=http://localhost:4000
```

Or use Docker Compose service DNS (`http://backend:4000`).

Ensure the backend listens on `0.0.0.0`, not only `127.0.0.1`.

---

## Production checklist

- [ ] `NODE_ENV=production`
- [ ] Strong `WEBHOOK_SECRET`
- [ ] Redis with persistence appropriate for your host
- [ ] `EMAIL_DOMAIN` matches Cloudflare-routed domain
- [ ] `WEB_URL` / CORS origins set to real frontend URL
- [ ] Cookie `Secure` in production  
- [ ] Rate limits enabled  
- [ ] Health check monitored (`/api/health`)
- [ ] Worker `WEBHOOK_URL` points at public API  
- [ ] MX records active for Email Routing  

---

## Security notes

- Sessions are anonymous and short-lived by design.  
- Safety scoring is heuristic, not antivirus.  
- Sanitize HTML before rendering (`DOMPurify`).  
- Webhook is protected by shared secret header.  
- Do not store attachment bytes in Redis for MVP (metadata-only is optional).  

---

## Tech stack

| Layer | Stack |
|-------|--------|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | React Router (framework mode) |
| Backend | Fastify |
| Storage | Redis (ioredis) |
| Mail parse | mailparser |
| Inbound | Cloudflare Email Routing + Worker |
| Language | TypeScript |

---

## License

MIT

---

## Summary

BriefBox is a full temporary-email loop:

1. Visit the site → get a disposable address  
2. Receive real mail on your domain  
3. Scan → store in Redis → show in inbox  
4. After the timer, everything disappears  

No accounts. No permanent data. Built for privacy testing and throwaway signups.