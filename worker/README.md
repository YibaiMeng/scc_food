# Worker

Cloudflare Worker serving both the JSON API (under `/api/`) and the static frontend from `frontend/public/`.

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
