# SCC Food Facility Data

Syncs Santa Clara County Department of Environmental Health food facility inspection data into a local SQLite database with full change history, and publishes a public map website via Cloudflare.

## Architecture

```
[Socrata API] → data/download.py → [scc_food.db (local SQLite)]
                                           ↓
                                    db/sync.py (Cloudflare D1 REST API)
                                           ↓
                               [Cloudflare D1 database]
                                           ↓
                             worker/ (Cloudflare Worker API)
                                           ↓
                             frontend/ (Cloudflare Pages map)
```

The data pipeline runs locally and is completely separate from the website. The website is read-only against D1.

## Setup

Prerequisites: Python 3, Node.js.

1. **Fetch data locally** — see [data/README.md](data/README.md) for schema details
   ```bash
   python -m venv venv && source venv/bin/activate && pip install requests
   python data/download.py /path/to/scc_food.db
   ```

2. **Create Cloudflare D1 and sync** — see [db/README.md](db/README.md)
   ```bash
   cd worker && npm install
   npx wrangler d1 create scc-food --binding DB --update-config
   npx wrangler d1 execute scc-food --remote --yes --file db/schema.sql
   python db/sync.py /path/to/scc_food.db
   ```

3. **Deploy** — Worker serves both API and static frontend — see [worker/README.md](worker/README.md)
   ```bash
   cd worker && npm run deploy
   ```

**Ongoing:** re-run steps 1–2 to refresh data.

## Project Structure

```
data/        # Python pipeline: fetches from Socrata API, upserts into local SQLite
db/          # D1 schema + sync script: pushes local SQLite → Cloudflare D1
worker/      # Cloudflare Worker TypeScript API
frontend/    # Cloudflare Pages static map site
```
