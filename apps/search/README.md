# Search service

Internal HTTP search service backed by Orama.

## Development

```bash
pnpm sync
pnpm dev
```

The server listens on `HOST` (default `::`) and `PORT` (default `3001`).

Endpoints:

- `GET /health`
- `GET /?q=&collection_id=&category_id=&region_id=&limit=&offset=`

## Railway

- Build command: `pnpm --filter @apps/search build`
- Start command: `pnpm --filter @apps/search start`
- Healthcheck path: `/health`
- Do not create a public domain; the web service calls it over Railway private networking.

The build requires `MEDUSA_BACKEND_URL` and `MEDUSA_PUBLISHABLE_KEY` so the
committed Orama dataset can be refreshed from Medusa.
