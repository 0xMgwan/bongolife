# 👑 Bongo Life

A multiplayer life-sim set in **Dar es Salaam**, built for phones. It's inspired by Lagos Life, with Bongo slang, places and culture.

You sign up, design your Mbongo, then live in the city with real people. You work shifts (machinga, bodaboda, DJ, developer and more), eat chipsi mayai, go clubbing in Sinza, swim at Coco Beach, and watch the Simba vs Yanga derby. You can buy a bodaboda or a V8, buy plots in Kigamboni or Masaki and build a villa, own businesses that earn income, put up billboard ads, chat with people, and top up your wallet with M-Pesa.

**Languages:** Kiswahili and English. Players switch with the 🇹🇿/🇬🇧 button on the landing and sign-up screens, or in Phone → Settings. Server errors and results arrive in the player's language.

**Admin panel:** at `/admin`. It covers:
- **Overview:** KPIs, revenue and sign-up charts.
- **Live:** players online right now.
- **Users:** search and filters. Each user page lets you ban/unban, mute, adjust balance, force logout, reset password, restore needs, teleport, edit profile, purge chat and grant/revoke admin, and shows their transactions, top-ups, ads, chat and history.
- **Economy:** money flowing in (faucets) and out (sinks), wealth distribution, top spenders, and a searchable transaction log.
- **Top-ups:** re-check a payment, or mark it paid/failed manually with a required note.
- **Ads:** the reported queue, remove with or without refund, restore.
- **Chat:** moderation of public chat. Private DMs are never exposed.
- **Property:** revoke plots or businesses, with or without refund.
- **Settings:** switches for maintenance, sign-ups, top-ups, chat and ads; a bilingual announcement banner; an event override; broadcasts; gifting money.
- **Audit log:** every admin action is recorded.

Admins are bootstrapped with `ADMIN_USERNAMES` (comma-separated). Those accounts become admins when they sign up or log in, and they can promote others from the panel.

## Run it

```bash
npm install
npm run dev          # API on :8787, game on http://localhost:5173
```

The game opens on your phone over the same Wi-Fi at `http://<your-computer-ip>:5173`.

Production:

```bash
npm run build
JWT_SECRET=... npm start   # serves the API + built client on $PORT (default 8787)
```

### Deploy on Railway (recommended)
1. New Project → Deploy from GitHub repo → pick this repo. Railway builds it from the `Dockerfile` (`railway.json`).
2. Service → **Volumes** → add a volume mounted at **`/data`**. The SQLite database and ad images live there.
3. Service → **Variables**:
   - `JWT_SECRET` = a long random string (`openssl rand -hex 48`)
   - `ADMIN_USERNAMES` = your username
   - `NTZS_API_KEY`, `NTZS_WEBHOOK_SECRET` (and optionally `TOPUP_RATE`)
   - `RESEND_API_KEY`, `MAIL_FROM` — emails "Forgot password" reset codes (optional; without them codes only appear in the logs)
   - In the nTZS dashboard, set the webhook URL to `https://<your-domain>/api/webhooks/ntzs`
4. Settings → Networking → Generate Domain (or add your own). Health check: `/healthz`.

Keep it to **one replica**: SQLite and Socket.IO presence live on a single instance.

Or use Docker: `docker build -t bongo-life . && docker run -p 8080:8080 -v bongo:/data -e JWT_SECRET=... bongo-life`.
Deploy it on a host that supports WebSockets and a persistent disk (Render, Fly.io, Railway, a VPS). Vercel serverless won't work.

## How it fits together

| Part | Stack |
|---|---|
| `shared/world.js` | The whole world catalog: map, roads, places, activities, jobs, prices, vehicles, plots, billboards, events. Edit this to rebalance the game. |
| `server/` | Express + Socket.IO + SQLite (better-sqlite3). The server is authoritative for money, needs, timers, ownership and proximity. Passwords use bcrypt, sessions use JWT. |
| `client/` | React + three.js (react-three-fiber). A low-poly procedural city, instanced filler buildings and trees, canvas-sprite labels and LOD for remote players. |

**Wallet:** `server/src/payments/index.js`. When `NTZS_API_KEY` is set, top-ups go through nTZS mobile money (push/STK or Lipa Namba) into your nTZS **platform wallet**. No `userId` is sent; each deposit is tagged with `endUser.reference = bl_<playerId>`. Players are credited as soon as the signed `deposit.completed` webhook arrives (HMAC-SHA256 over `timestamp.body`). A background poller is the fallback. Either way, a top-up is credited exactly once (compare-and-set). Without keys, dev runs a clearly labelled **demo** provider. Demo is disabled in production.

**Cheating guards:** the server checks every purchase, shift and activity: you must be near the place, have the money, the job's requirements and enough energy, and the timer must have finished. Movement packets that jump too far are rejected.

## Testing headless
In a hidden or background tab, browsers pause `requestAnimationFrame`. Add `?raf-shim` (dev builds only) to drive frames with timers.
