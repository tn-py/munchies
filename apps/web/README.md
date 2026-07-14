# @apps/web

Astro 5 SSR storefront running as a standalone Node server.

## Tech Stack

- Astro 5.16 + @astrojs/node
- React 19 + Tailwind CSS 4
- Sanity v5 (visual editing, embedded studio at /cms)
- Medusa JS SDK
- Authorize.net payments (Accept.js tokenization)
- Dynamic OG images (Satori)

## Env Vars

```bash
# Sanity
PUBLIC_SANITY_STUDIO_DATASET=
PUBLIC_SANITY_STUDIO_PROJECT_ID=
SANITY_TOKEN=

# Medusa
MEDUSA_BACKEND_URL=
MEDUSA_PUBLISHABLE_KEY=

# Authorize.net Accept.js (public client credentials)
PUBLIC_AUTHNET_CLIENT_KEY=
PUBLIC_AUTHNET_API_LOGIN_ID=
PUBLIC_AUTHNET_ENVIRONMENT=sandbox

# Railway
SEARCH_URL=http://localhost:3001
SITE_URL=http://localhost:3000
```

## Project Structure

```
src/
├── actions/medusa/  # Server actions
├── components/      # React + Astro
├── lib/             # Utilities
├── pages/           # Routes
├── sanity/          # CMS config + schema
└── stores/          # State (nanostores)
```

## Scripts

| Command        | Description           |
| -------------- | --------------------- |
| `pnpm dev`     | Dev server on :3000   |
| `pnpm build`   | Build for production  |
| `pnpm start`   | Start production SSR  |
| `pnpm typegen` | Generate Sanity types |

trigger deploy
