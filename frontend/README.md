# Frontend

Static Cloudflare Pages site — a Leaflet map showing all food facility inspection results.

## Deploy

```bash
npx wrangler pages deploy frontend/public --project-name scc-food-map
```

Set `API_BASE` in `public/js/api.js` to point at the deployed Worker URL.
