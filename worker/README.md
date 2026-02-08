# Worker API

Cloudflare Worker serving the JSON API backed by D1.

## Endpoints

- `GET /api/stats` — aggregate counts
- `GET /api/facilities` — all facilities as map markers (cached 1h)
- `GET /api/facilities/:id` — single facility detail

## Deploy

```bash
cd worker
npm install
npm run deploy
```
