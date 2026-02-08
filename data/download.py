import argparse
import sqlite3
import requests
from datetime import datetime, timezone

BASE = "https://data.sccgov.org/resource"
LIMIT = 1000


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

SCHEMA = """
CREATE TABLE IF NOT EXISTS business (
    business_id   TEXT PRIMARY KEY,
    name          TEXT,
    address       TEXT,
    city          TEXT,
    state         TEXT,
    postal_code   TEXT,
    latitude      REAL,
    longitude     REAL,
    phone_number  TEXT,
    first_seen    TEXT NOT NULL,
    last_updated  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inspection (
    inspection_id      TEXT PRIMARY KEY,
    business_id        TEXT,
    date               TEXT,
    score              INTEGER,
    result             TEXT,
    type               TEXT,
    inspection_comment TEXT,
    first_seen         TEXT NOT NULL,
    last_updated       TEXT NOT NULL,
    FOREIGN KEY (business_id) REFERENCES business(business_id)
);

CREATE TABLE IF NOT EXISTS violation (
    inspection_id      TEXT NOT NULL,
    code               TEXT NOT NULL,
    description        TEXT,
    critical           INTEGER,
    violation_comment  TEXT,
    first_seen         TEXT NOT NULL,
    last_updated       TEXT NOT NULL,
    PRIMARY KEY (inspection_id, code),
    FOREIGN KEY (inspection_id) REFERENCES inspection(inspection_id)
);

CREATE TABLE IF NOT EXISTS changes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name   TEXT NOT NULL,
    record_id    TEXT NOT NULL,
    field        TEXT NOT NULL,
    old_value    TEXT,
    new_value    TEXT,
    detected_at  TEXT NOT NULL
);
"""


# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------

def fetch_all(url):
    rows = []
    offset = 0
    while True:
        resp = requests.get(url, params={"$limit": LIMIT, "$offset": offset})
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < LIMIT:
            break
        offset += LIMIT
    return rows


# ---------------------------------------------------------------------------
# Normalize raw API rows
# ---------------------------------------------------------------------------

def normalize_business(raw):
    return {
        "business_id": raw.get("business_id"),
        "name": raw.get("name"),
        "address": raw.get("address"),
        "city": raw.get("city"),
        "state": raw.get("state"),
        "postal_code": raw.get("postal_code"),
        "latitude": _float(raw.get("latitude")),
        "longitude": _float(raw.get("longitude")),
        "phone_number": raw.get("phone_number"),
    }


def normalize_inspection(raw):
    return {
        # API has typo "inpsection_id"
        "inspection_id": raw.get("inpsection_id") or raw.get("inspection_id"),
        "business_id": raw.get("business_id"),
        "date": raw.get("date"),
        "score": _int(raw.get("score")),
        "result": raw.get("result"),
        "type": raw.get("type"),
        "inspection_comment": raw.get("inspection_comment"),
    }


def normalize_violation(raw):
    return {
        "inspection_id": raw.get("inspection_id"),
        "code": raw.get("code"),
        "description": raw.get("description"),
        "critical": 1 if str(raw.get("critical", "")).lower() == "true" else 0,
        "violation_comment": raw.get("violation_comment"),
    }


def _float(v):
    try:
        return float(v) if v is not None else None
    except (ValueError, TypeError):
        return None


def _int(v):
    try:
        return int(v) if v is not None else None
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Upsert with change tracking
# ---------------------------------------------------------------------------

def upsert(conn, table, pk_fields, row, now):
    """
    Insert or update a row. Log any field changes to the `changes` table.
    Returns 'inserted', 'updated', or 'unchanged'.
    """
    pk_clause = " AND ".join(f"{f} = ?" for f in pk_fields)
    pk_values = tuple(row[f] for f in pk_fields)
    record_id = ":".join(str(row[f]) for f in pk_fields)

    cur = conn.execute(f"SELECT * FROM {table} WHERE {pk_clause}", pk_values)
    existing = cur.fetchone()

    if existing is None:
        cols = list(row.keys()) + ["first_seen", "last_updated"]
        vals = list(row.values()) + [now, now]
        placeholders = ", ".join("?" * len(cols))
        conn.execute(
            f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({placeholders})", vals
        )
        return "inserted"

    # Compare fields (exclude metadata columns)
    col_names = [d[0] for d in cur.description]
    existing_dict = dict(zip(col_names, existing))
    changed_fields = []
    for field, new_val in row.items():
        old_val = existing_dict.get(field)
        # Normalize to string for comparison to handle int/float/None edge cases
        if str(old_val) != str(new_val):
            changed_fields.append((field, old_val, new_val))

    if not changed_fields:
        return "unchanged"

    for field, old_val, new_val in changed_fields:
        conn.execute(
            "INSERT INTO changes (table_name, record_id, field, old_value, new_value, detected_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (table, record_id, field, str(old_val), str(new_val), now),
        )

    set_clause = ", ".join(f"{f} = ?" for f in row.keys()) + ", last_updated = ?"
    conn.execute(
        f"UPDATE {table} SET {set_clause} WHERE {pk_clause}",
        list(row.values()) + [now] + list(pk_values),
    )
    return "updated"


# ---------------------------------------------------------------------------
# Main sync
# ---------------------------------------------------------------------------

SOURCES = [
    ("business",    f"{BASE}/vuw7-jmjk.json", ["business_id"],              normalize_business),
    ("inspection",  f"{BASE}/2u2d-8jej.json", ["inspection_id"],            normalize_inspection),
    ("violation",   f"{BASE}/wkaa-4ccv.json", ["inspection_id", "code"],    normalize_violation),
]


def main():
    parser = argparse.ArgumentParser(description="Fetch SCC food data into local SQLite")
    parser.add_argument("db", help="path to SQLite database (e.g. /data/scc_food.db)")
    args = parser.parse_args()

    now = datetime.now(timezone.utc).isoformat()

    conn = sqlite3.connect(args.db)
    conn.executescript(SCHEMA)

    for table, url, pk_fields, normalize in SOURCES:
        print(f"syncing {table}...")
        raw_rows = fetch_all(url)
        counts = {"inserted": 0, "updated": 0, "unchanged": 0}
        for raw in raw_rows:
            row = normalize(raw)
            if any(row[f] is None for f in pk_fields):
                continue  # skip rows missing PK
            status = upsert(conn, table, pk_fields, row, now)
            counts[status] += 1
        conn.commit()
        print(f"  {counts['inserted']} inserted, {counts['updated']} updated, {counts['unchanged']} unchanged")

    conn.close()
    print(f"\ndone — {args.db}")


if __name__ == "__main__":
    main()
