# SCC Food Facility Inspection Map

Interactive Leaflet map showing Santa Clara County food facility inspection data. Public health inspection scores, violations, and closure status on an OpenStreetMap-based map.

## Rules

- **On every commit**: Review this file and update any sections that are affected by the changes being committed (new files, changed UI, new patterns, etc.).

## Architecture

```
Socrata API → download.py → local SQLite (scc_food.db) → sync.py → Cloudflare D1
                                                                         ↓
                                                          Cloudflare Worker (TS)
                                                           ├─ /api/stats
                                                           ├─ /api/facilities
                                                           └─ /api/facilities/:id
                                                                         ↓
                                                          Static frontend (Leaflet + vanilla JS)
```

Data pipeline (Python) is completely separate from the web app (Worker + frontend).

## Directory Layout

- `data/download.py` — Fetches from Socrata API, upserts into local SQLite with full audit trail
- `db/schema.sql` — D1 table definitions with indexes
- `db/sync.py` — Pushes local SQLite → Cloudflare D1 via REST API (batched INSERT OR REPLACE)
- `worker/src/index.ts` — HTTP routing + CORS (entry point)
- `worker/src/routes/stats.ts` — GET /api/stats (cached 6h)
- `worker/src/routes/facilities.ts` — GET /api/facilities — all markers with latest inspection (cached 1h)
- `worker/src/routes/facility.ts` — GET /api/facilities/:id — full detail with all inspections + violations
- `worker/src/types.ts` — TypeScript interfaces
- `frontend/public/index.html` — Single page HTML
- `frontend/public/js/app.js` — Orchestrator: loads stats + facilities in parallel, inits map
- `frontend/public/js/api.js` — Fetch wrappers for the 3 API endpoints
- `frontend/public/js/map.js` — Leaflet map with dual-layer zoom strategy (canvas circles at overview, CSS div icons at detail zoom >=17)
- `frontend/public/js/sidebar.js` — Right slide-in panel: business info, inspection history, violations
- `frontend/public/js/stats.js` — Header stats bar: total/yellow/red/closures badges with clickable dropdown lists, period selector
- `frontend/public/css/app.css` — All styling (CSS vars for colors, flexbox layout)
- `biome.json` — Biome config for JS/TS/CSS formatting + linting
- `pyproject.toml` — Ruff config for Python formatting + linting
- `.pre-commit-config.yaml` — Git pre-commit hook orchestration (runs Biome + Ruff)
- `Makefile` — Convenience commands (`make setup`, `make check`)

## Database Schema

```
business: business_id (PK), name, address, city, state, postal_code, latitude, longitude, phone_number, first_seen, last_updated
inspection: inspection_id (PK), business_id (FK), date (YYYYMMDD), score (0-100), result ('G'/'Y'/'R'/NULL), type, inspection_comment, first_seen, last_updated
violation: inspection_id + code (composite PK), description, critical (0/1), violation_comment, first_seen, last_updated
changes: id (PK), table_name, record_id, field, old_value, new_value, detected_at — audit log for every field change
```

~8,500 facilities, ~22k inspections, ~64k violations.

## UI Layout

Full-viewport app, no scrolling. Three regions stacked vertically/overlapping:

```
┌──────────────────────────────────────────────────────────┐
│ HEADER (dark slate, 52px)                                │
│ "SCC Food Safety Map"  [— facilities] [Y badge] [R badge] [closures badge] [1w 1m 6m 1y] │
├────────┬─────────────────────────────────────────────────┤
│SIDEBAR │                                                 │
│(360px) │              MAP (Leaflet, fills rest)          │
│overlays│         colored dot markers per facility        │
│on top  │                                                 │
│of map  │                                                 │
│        │                                                 │
└────────┴─────────────────────────────────────────────────┘
```

**Header**: Dark background (#1e293b). Title left, stats bar right. Stats bar has:
- Plain text "N facilities" count
- Yellow pill badge — clickable, opens dropdown listing yellow-status facilities
- Red pill badge ("closed") — clickable, opens dropdown listing red-status facilities
- Red pill badge ("closures") — clickable dropdown + period chip buttons (1w/1m/6m/1y) to filter by time window

**Map**: Full remaining viewport. OpenStreetMap tiles. Centered on Santa Clara County.
- At overview zoom (<17): small canvas-rendered colored circles (green/yellow/red/gray)
- At detail zoom (>=17): larger CSS div markers with permanent name labels, red dot on recent closures, pulse animation on red markers
- Hover tooltip: card with facility name, score, "Recent closure" badge if applicable
- Click marker: opens sidebar + pans map to facility

**Sidebar**: 360px wide, slides in from LEFT over the map (position absolute). Has close button (x top-right). Content:
- Facility name (bold), address, phone
- "Last inspected N days ago" text
- "INSPECTION HISTORY" section title
- Inspection cards (newest first): large color-coded score number, result chip (G/Y/R pill), date, type, comment
- Under each inspection: violation list — code (bold), description, red dot for critical violations

**Dropdowns**: Absolute-positioned white cards below badges, max-height 280px scrollable, click item flies to facility on map and opens sidebar.

**Loading overlay**: Dark semi-transparent fullscreen overlay with "Loading..." text, removed after initial data fetch.

### UI Interactions

**Page load**: Shows loading overlay → fetches /api/stats and /api/facilities in parallel → renders stats bar + all map markers → removes overlay.

**Map marker hover**: Shows tooltip card (facility name, score, "Recent closure" red badge if applicable). Tooltip disappears on mouseout.

**Map marker click**: Pans/zooms map to center on facility → fetches /api/facilities/:id → opens sidebar with full detail. If sidebar was already open for another facility, replaces content.

**Map zoom**: Crossing zoom 17 threshold swaps layers — below 17 shows fast canvas circles, at/above 17 switches to CSS div markers with permanent text labels showing facility name. Detail layer only renders markers in current viewport (culled on move/zoom).

**Badge click (yellow/red/closures)**: Toggles a dropdown list below the badge. Clicking the same badge again (or clicking elsewhere on the page) closes it. Only one dropdown open at a time.

**Dropdown item click**: Pans+zooms map to that facility's location → fetches detail → opens sidebar. Dropdown closes.

**Closures period chips (1w/1m/6m/1y)**: Clicking a chip re-queries /api/stats with that time window, updates the closures count number and dropdown list. Active chip gets highlighted styling. Does NOT affect map markers (markers always show all data).

**Sidebar close**: Click X button → sidebar slides out left (CSS transform transition). Map remains in current position.

## Key Patterns

- **Inspection colors**: Green (#22c55e) score 85+, Yellow/Orange (#eab308) 70-85, Red (#ef4444) <70
- **Result codes**: 'G' = pass, 'Y' = conditional pass, 'R' = closure
- **Map rendering**: Canvas layer for speed at low zoom, CSS div markers with labels at zoom >= 17. Viewport culling on detail layer.
- **Marker pulsing**: Red dot + CSS pulse animation for recent closures
- **Caching**: Worker caches stats 6h, facilities 1h, detail views uncached
- **SQL safety**: All D1 queries use prepared statements with parameter binding
- **Date format**: YYYYMMDD strings throughout (sortable, no timezone issues)
- **Socrata API quirk**: Raw data has typo "inpsection_id" — normalized to "inspection_id" in download.py

## Dev Commands

```bash
# Local dev (Worker + D1 simulator)
cd worker && npm run dev

# Deploy to Cloudflare
cd worker && npm run deploy

# Refresh data
python data/download.py scc_food.db
python db/sync.py scc_food.db   # needs CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN

# Frontend is served as static assets via worker (configured in wrangler.toml)

# Linting & formatting (auto-runs on commit via pre-commit hooks)
make check              # Run all checks on all files
make setup              # First-time setup after cloning (install pre-commit hooks)
```

## Setup (New Clone)

```bash
git clone <repo>
cd scc_food
pip install pre-commit   # or: pip install -r requirements-dev.txt
pre-commit install       # installs git hooks — checks run automatically on every commit
```

## Conventions

- **Files**: snake_case
- **JS functions/vars**: camelCase
- **TS interfaces**: PascalCase
- **CSS classes**: kebab-case
- **Frontend**: Vanilla JS with ES6 modules, no build step, no framework
- **Worker routes**: Each in own file under `worker/src/routes/`
- **Python**: Functional scripts, section headers with `# ---` comments
- **Formatting**: Biome (JS/TS/CSS), Ruff (Python) — enforced by pre-commit hooks
- **Line width**: 120 characters (all languages)
- **Quotes**: Double quotes (all languages)

## External Services

- **Socrata Open Data API** (public, no auth): business `vuw7-jmjk`, inspections `2u2d-8jej`, violations `wkaa-4ccv`
- **Cloudflare D1/Workers/Pages**: Hosting + database (API token needed for sync)
- **OpenStreetMap tiles**: Map background (CDN, free)
- **Leaflet 1.9.4**: Map library (CDN)
