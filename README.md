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

## Quick Start

```bash
# Run local data sync
python data/download.py /path/to/scc_food.db

# Push to Cloudflare D1
python db/sync.py /path/to/scc_food.db
```

See each component's README for details.

## Project Structure

```
data/        # Python pipeline: fetches from Socrata API, upserts into local SQLite
db/          # D1 schema + sync script: pushes local SQLite → Cloudflare D1
worker/      # Cloudflare Worker TypeScript API
frontend/    # Cloudflare Pages static map site
```
