# Data Pipeline

Fetches food facility inspection data from the Santa Clara County Open Data Portal and upserts it into a local SQLite database (`scc_food.db`) with full change history.

## Data Source

[SCC DEH Food Facility Inspections Data](https://data.sccgov.org/stories/s/SCC-DEH-Food-Facility-Inspections-Data/8ptb-6646/) — published by the County of Santa Clara on the official [Open Data Portal](https://data.sccgov.org/) via the [Socrata](https://dev.socrata.com/) API. No authentication required.

| Dataset | Description | Socrata ID |
|---|---|---|
| [BUSINESS](https://data.sccgov.org/Environment/SCC_DEH_Food_Data_BUSINESS/vuw7-jmjk) | Facility name, address, coordinates, phone | `vuw7-jmjk` |
| [INSPECTIONS](https://data.sccgov.org/Health/SCC_DEH_Food_Data_INSPECTIONS/2u2d-8jej) | Inspection date, score, result, type | `2u2d-8jej` |
| [VIOLATIONS](https://data.sccgov.org/Health/SCC_DEH_Food_Data_VIOLATIONS/wkaa-4ccv) | Per-inspection violation details | `wkaa-4ccv` |

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

## Setup

```bash
python -m venv venv
source venv/bin/activate
pip install requests
```

## Usage

```bash
python data/download.py /path/to/scc_food.db
```

### Query recent changes

```sql
SELECT detected_at, table_name, record_id, field, old_value, new_value
FROM changes
ORDER BY detected_at DESC
LIMIT 50;
```
