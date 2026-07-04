# Best Vapes

An e-commerce storefront for Best Vapes — premium vapes, pods, and e-liquids. Built on the [Munchies](https://github.com/tinloof/munchies) open-source template by Tinloof.

## Stack

| Layer | Technology |
|---|---|
| Storefront | [Astro 5](https://astro.build) (SSR) + [Cloudflare Workers](https://workers.cloudflare.com) |
| Commerce backend | [Medusa v2](https://medusajs.com) (Node.js) |
| CMS | [Sanity v5](https://sanity.io) (project `no3xl4jw`, dataset `production`) |
| Search | Orama on Cloudflare Workers |
| Payments | Authorize.net (custom Medusa v2 provider + Accept.js) |
| Styling | Tailwind CSS v4, React 19 |
| Package manager | pnpm 9 (workspace monorepo) |
| Build orchestration | Turborepo |

```
apps/
├── web/             # Astro storefront → Cloudflare Pages
├── medusa-backend/  # Medusa API + admin → Node server
└── search/          # Orama search → Cloudflare Workers
```

---

## Local Development

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- [Node.js](https://nodejs.org) >= 18
- [pnpm](https://pnpm.io) 9+ (`npm i -g pnpm`)

### 1 — Clone and install

```bash
git clone https://github.com/tn-py/vape-munchies.git
cd vape-munchies
pnpm install
```

### 2 — Set up environment variables

**Medusa backend** (`apps/medusa-backend/.env`):

```bash
cp apps/medusa-backend/.env.template apps/medusa-backend/.env
```

Fill in the values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string — Docker default: `postgres://medusa:medusa@localhost:5433/medusa_munchies` |
| `REDIS_URL` | Redis URL — Docker default: `redis://redis:6379` (leave blank to use in-memory) |
| `JWT_SECRET` / `COOKIE_SECRET` | Random secret strings — use anything strong in prod |
| `STORE_CORS` | Storefront origin — `http://localhost:3000` for local dev |
| `ADMIN_CORS` / `AUTH_CORS` | Admin origin — `http://localhost:9000` for local dev |
| `AUTHNET_API_LOGIN_ID` | Authorize.net API Login ID (Merchant Interface → Account → API Credentials & Keys) |
| `AUTHNET_TRANSACTION_KEY` | Authorize.net Transaction Key — **server secret**, authorizes/captures charges |
| `AUTHNET_SIGNATURE_KEY` | Authorize.net Signature Key (128-char hex) for verifying webhook HMAC |
| `AUTHNET_ENVIRONMENT` | `sandbox` or `production` — selects the gateway API endpoint |
| `SANITY_API_TOKEN` | Sanity **editor** token with write access to the `production` dataset |
| `SANITY_PROJECT_ID` | `no3xl4jw` |
| `MEDUSA_PUBLISHABLE_KEY` | Filled in automatically after running `pnpm seed` |

**Web storefront** (`apps/web/.env`):

```bash
cp apps/web/.env.example apps/web/.env
```

| Variable | Description |
|---|---|
| `PUBLIC_SANITY_STUDIO_PROJECT_ID` | `no3xl4jw` |
| `PUBLIC_SANITY_STUDIO_DATASET` | `production` |
| `SANITY_TOKEN` | Same Sanity editor token as above (server-only, never exposed to browser) |
| `MEDUSA_BACKEND_URL` | `http://localhost:9000` for local dev |
| `MEDUSA_PUBLISHABLE_KEY` | Copy from Medusa admin → Settings → API Keys after seeding |
| `PUBLIC_AUTHNET_CLIENT_KEY` | Authorize.net public Client Key (used by Accept.js to tokenize cards in-browser) |
| `PUBLIC_AUTHNET_API_LOGIN_ID` | Authorize.net API Login ID (public; paired with the Client Key for Accept.js) |
| `PUBLIC_AUTHNET_ENVIRONMENT` | `sandbox` or `production` — selects the Accept.js script URL |
| `CF_ZONE_ID` / `CF_TOKEN` | Cloudflare cache purge credentials (production only, leave blank for local) |

#### Authorize.net one-time setup

Payments need a (sandbox) Authorize.net account — sign up at [developer.authorize.net](https://developer.authorize.net/hello_world/sandbox.html). Then, in the Merchant Interface:

1. **API credentials** — Account → Settings → API Credentials & Keys: copy the **API Login ID** into `AUTHNET_API_LOGIN_ID` (backend) and `PUBLIC_AUTHNET_API_LOGIN_ID` (web), and generate a **Transaction Key** for `AUTHNET_TRANSACTION_KEY` (backend only — never expose it to the browser).
2. **Signature Key** — same page: generate a Signature Key (128-char hex) for `AUTHNET_SIGNATURE_KEY`; it verifies webhook signatures.
3. **Client Key** — Account → Settings → Manage Public Client Key: copy into `PUBLIC_AUTHNET_CLIENT_KEY`; Accept.js uses it to tokenize cards in-browser.
4. **Webhooks** — Account → Settings → Webhooks: add an endpoint pointing at `https://<your-medusa-host>/hooks/payment/authorizenet_authorizenet` and subscribe to the payment events (authorization, capture, void, refund, fraud). Skip this for local dev unless you tunnel (e.g. ngrok) — checkout works without webhooks; they reconcile asynchronous status changes.
5. Keep `AUTHNET_ENVIRONMENT` / `PUBLIC_AUTHNET_ENVIRONMENT` at `sandbox` until you switch to production credentials.

> **Sandbox test card**: `4111 1111 1111 1111`, any future expiry, any CVC, any ZIP.

### 3 — Start the stack

```bash
docker compose up -d
```

This starts four containers:

| Container | Port | Description |
|---|---|---|
| `munchies-postgres` | 5433 | PostgreSQL 15 |
| `munchies-redis` | 6379 | Redis 7 |
| `munchies-medusa` | 9000 | Medusa backend (runs `db:migrate` then `pnpm dev`) |
| `munchies-web` | 3000 | Astro storefront (Cloudflare Workers via wrangler) |

> **First boot takes ~60 s** — Medusa runs all migrations before starting.

### 4 — Seed the database

```bash
docker exec munchies-medusa sh -c "cd /app/apps/medusa-backend && pnpm seed"
```

This creates:
- Sales channels, regions (US/Canada + Europe), shipping options
- 4 product categories: Disposables, Pod Kits, E-Liquids, Accessories
- 7 sample vape products with variants and pricing
- A publishable API key (copy the "Webshop" key into both `.env` files)

### 5 — Create an admin user

```bash
docker exec munchies-medusa sh -c "cd /app/apps/medusa-backend && pnpm add-user"
```

Default credentials: `admin@medusa.com` / `supersecret`

### 6 — Sync products to Sanity

After seeding, touch each product in the admin to fire the sync event:

```bash
TOKEN=$(curl -s -X POST http://localhost:9000/auth/user/emailpass \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@medusa.com","password":"supersecret"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -s "http://localhost:9000/admin/products?limit=50" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys,json,subprocess,time
for p in json.load(sys.stdin)['products']:
    subprocess.run(['curl','-s','-X','POST',
      f'http://localhost:9000/admin/products/{p[\"id\"]}',
      '-H',f'Authorization: Bearer $TOKEN',
      '-H','Content-Type: application/json',
      '-d','{\"status\":\"published\"}'], capture_output=True)
    print('Synced:', p['title'])
    time.sleep(0.3)
"
```

> **Why**: `SANITY_API_TOKEN` must be an editor token with write access to the `production` dataset. The sync plugin fires on `product.created` / `product.updated` events.

### 7 — Verify

| URL | What you should see |
|---|---|
| `http://localhost:3000` | Storefront homepage with marquee, featured products, assurance sections |
| `http://localhost:9000/app` | Medusa admin login |
| `http://localhost:3000/cms` | Sanity Studio (requires Sanity login) |

---

## Useful Commands

```bash
# Rebuild containers after Dockerfile changes
docker compose build

# Force-reload .env changes into a running container
docker compose up -d --force-recreate medusa
docker compose up -d --force-recreate web

# View logs
docker compose logs -f medusa
docker compose logs -f web

# Lint and format
pnpm check   # report issues
pnpm fix     # auto-fix

# Generate Sanity + Medusa TypeScript types
pnpm typegen
```

---

## Product Images

Product cards render at **1:1 square**, displayed at up to **450 px** (900 px on retina).

**Generate images at 1000×1000 px minimum**, then upload via:
Medusa admin → Products → select product → Media tab

---

## CMS (Sanity)

Homepage and other pages are fully driven by Sanity. Available section types:

| Section | Description |
|---|---|
| `section.hero` | Full-width hero with image/video and CTA |
| `section.marquee` | Scrolling text banner |
| `section.centeredText` | Large centred text block |
| `section.featuredProducts` | Product carousel — set a **Collection** to pull dynamically, or list products manually |
| `section.assurance` | 3-card trust block (quality, shipping, support) |
| `section.collectionList` | 3-image collection grid |
| `section.mediaText` | Side-by-side media + text |
| `section.testimonials` | Customer testimonials |
| `section.shopTheLook` | Shop-the-look image with spots |

Edit content at `http://localhost:3000/cms` (local) or the production Studio URL.

---

## Production Deployment

### Medusa backend

Medusa is a standard Node.js app. Recommended hosts: [Railway](https://railway.app), [Render](https://render.com), or a VPS.

1. Provision a PostgreSQL database and Redis instance.
2. Set all env vars from `.env.template` (use strong `JWT_SECRET` / `COOKIE_SECRET`).
3. Update CORS vars to your production domains.
4. Build and start:
   ```bash
   cd apps/medusa-backend
   pnpm build
   pnpm start   # or: node .medusa/server/index.js
   ```
5. Run migrations on first deploy:
   ```bash
   pnpm exec medusa db:migrate
   ```

### Web storefront (Cloudflare Pages)

The storefront deploys to Cloudflare Pages via the `@astrojs/cloudflare` adapter.

1. Connect the repo in the [Cloudflare Pages dashboard](https://dash.cloudflare.com).
2. Set the build configuration:
   - **Framework preset**: None (custom)
   - **Build command**: `cd apps/web && pnpm build`
   - **Build output directory**: `apps/web/dist`
3. Add environment variables in Pages → Settings → Environment variables (all vars from `apps/web/.env`, **except** `CF_ZONE_ID` / `CF_TOKEN` which are set at the account level).
4. Point `MEDUSA_BACKEND_URL` to your deployed Medusa URL.
5. Deploy — Cloudflare will build and route traffic through Workers automatically.

### Sanity Studio

The Studio is embedded in the storefront at `/cms`. It deploys automatically with the web app. To deploy a standalone Studio:

```bash
cd apps/web
pnpm exec sanity deploy
```

---

## Architecture Notes

- **`workerd` requires `libc++1`** — the `Dockerfile.dev` uses `node:20-slim` + `apt-get install libc++1`. Alpine Linux (`node:20-alpine`) will silently fail.
- **Web container uses `network_mode: host`** — `wrangler` (which powers the dev server) reads `MEDUSA_BACKEND_URL` from the `.env` file directly, not from the container's process env. `host` networking lets `http://localhost:9000` resolve correctly.
- **Prices are in whole display units** — `amount: 15` renders as `$15.00`. The `convertToLocale` utility in `apps/web/src/lib/utils/medusa/money.ts` passes amounts directly to `Intl.NumberFormat` without dividing by 100.
- **Sanity sync dataset** — `@tinloof/medusa-sanity-sync` is configured with `dataset: "production"`. The `SANITY_API_TOKEN` must be an editor token (not a viewer token) or syncs will silently fail.
- **`docker restart` does not reload `.env`** — use `docker compose up -d --force-recreate <service>` instead.
