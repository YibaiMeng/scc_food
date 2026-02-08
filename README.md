# SCC Food Facility Data

Syncs Santa Clara County Department of Environmental Health food facility inspection data into a local SQLite database with full change history, and publishes a public map website via Cloudflare.

## Data Source

[SCC DEH Food Facility Inspections Data](https://data.sccgov.org/stories/s/SCC-DEH-Food-Facility-Inspections-Data/8ptb-6646/) — published by the County of Santa Clara on the official [Open Data Portal](https://data.sccgov.org/) via the [Socrata](https://dev.socrata.com/) API. No authentication required.

| Dataset | Description | Socrata ID |
|---|---|---|
| [BUSINESS](https://data.sccgov.org/Environment/SCC_DEH_Food_Data_BUSINESS/vuw7-jmjk) | Facility name, address, coordinates, phone | `vuw7-jmjk` |
| [INSPECTIONS](https://data.sccgov.org/Health/SCC_DEH_Food_Data_INSPECTIONS/2u2d-8jej) | Inspection date, score, result, type | `2u2d-8jej` |
| [VIOLATIONS](https://data.sccgov.org/Health/SCC_DEH_Food_Data_VIOLATIONS/wkaa-4ccv) | Per-inspection violation details | `wkaa-4ccv` |

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

## Database Schema

```
business ──< inspection ──< violation
```

Tables join on `business_id` (business ↔ inspection) and `inspection_id` (inspection ↔ violation).

### business
| Column | Type | Notes |
|---|---|---|
| `business_id` | TEXT PK | e.g. `PR0300002` |
| `name` | TEXT | |
| `address`, `city`, `state`, `postal_code` | TEXT | |
| `latitude`, `longitude` | REAL | |
| `phone_number` | TEXT | |
| `first_seen` | TEXT | ISO-8601 UTC timestamp of first sync |
| `last_updated` | TEXT | ISO-8601 UTC timestamp of most recent change |

### inspection
| Column | Type | Notes |
|---|---|---|
| `inspection_id` | TEXT PK | API source has typo `inpsection_id` — normalized on ingest |
| `business_id` | TEXT FK | |
| `date` | TEXT | YYYYMMDD format |
| `score` | INTEGER | 0–100 |
| `result` | TEXT | `G` (good), `Y` (yellow), `R` (red) |
| `type` | TEXT | e.g. `ROUTINE INSPECTION` |
| `inspection_comment` | TEXT | |
| `first_seen`, `last_updated` | TEXT | |

### violation
| Column | Type | Notes |
|---|---|---|
| `inspection_id` | TEXT (composite PK) | |
| `code` | TEXT (composite PK) | e.g. `K08` |
| `description` | TEXT | |
| `critical` | INTEGER | 1 = critical, 0 = not critical |
| `violation_comment` | TEXT | |
| `first_seen`, `last_updated` | TEXT | |

### changes (audit log)
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | autoincrement |
| `table_name` | TEXT | `business`, `inspection`, or `violation` |
| `record_id` | TEXT | stringified PK, e.g. `PR0300002` or `DA00BJJ04:K08` |
| `field` | TEXT | column that changed |
| `old_value` | TEXT | |
| `new_value` | TEXT | |
| `detected_at` | TEXT | ISO-8601 UTC |

## Sync Design

Each run of `download.py` performs an **upsert with change tracking**:

1. Fetch all records from each API endpoint (paginated, 1000 rows/request)
2. For each record:
   - **New** → INSERT, set `first_seen = last_updated = now`
   - **Changed** → log each changed field to `changes`, then UPDATE the row + `last_updated = now`
   - **Unchanged** → skip
3. Commit per table, print summary

The main tables always reflect the **current state**; `changes` gives the full history of every field that ever changed.

## Usage

### Update local database

```bash
python data/download.py
```

### Sync to Cloudflare D1

Requires three environment variables (get from Cloudflare dashboard / `wrangler whoami`):

```bash
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_D1_DATABASE_ID=...
export CLOUDFLARE_API_TOKEN=...       # needs D1:Edit permission

python db/sync.py
```

### Query recent changes

```sql
SELECT detected_at, table_name, record_id, field, old_value, new_value
FROM changes
ORDER BY detected_at DESC
LIMIT 50;
```

## Setup

### Local data pipeline

```bash
python -m venv venv
source venv/bin/activate
pip install requests
python data/download.py
```

### Cloudflare (first time only)

```bash
cd worker
npm install

# Create D1 database — note the database_id in the output
npx wrangler d1 create scc-food

# Fill in database_id in worker/wrangler.toml, then apply schema
npx wrangler d1 execute scc-food --remote --yes --file ../db/schema.sql
```

### Deploy Worker API

```bash
cd worker
npm run deploy
```

### Deploy frontend

```bash
npx wrangler pages deploy frontend/public --project-name scc-food-map
```

## Project Structure

```
data/
  download.py          # fetches from Socrata API, upserts into local SQLite

db/
  schema.sql           # D1 table definitions (no FK constraints — D1 is read-only)
  sync.py              # pushes local SQLite → Cloudflare D1 via REST API

worker/                # Cloudflare Worker (TypeScript)
  src/
    index.ts           # routing + CORS
    types.ts           # TypeScript interfaces
    routes/
      stats.ts         # GET /api/stats
      facilities.ts    # GET /api/facilities (map markers, cached 1h)
      facility.ts      # GET /api/facilities/:id (detail)
  wrangler.toml

frontend/public/       # Cloudflare Pages static site
  index.html
  css/app.css
  js/
    app.js             # entry point
    api.js             # API fetch wrappers (set API_BASE here)
    map.js             # Leaflet map + clustering
    sidebar.js         # facility detail panel
    stats.js           # header stats bar
```
