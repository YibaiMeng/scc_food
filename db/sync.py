#!/usr/bin/env python3
"""Sync local SQLite database to Cloudflare D1 via REST API.

Required environment variables:
  CLOUDFLARE_ACCOUNT_ID    — from Cloudflare dashboard
  CLOUDFLARE_D1_DATABASE_ID — from `wrangler d1 list` or dashboard
  CLOUDFLARE_API_TOKEN      — API token with D1 Edit permission
"""

import argparse
import os
import sqlite3
import sys
from pathlib import Path

import requests

TABLES = ["business", "inspection", "violation"]
BATCH_SIZE = 100  # statements per API request


def get_env(name):
    val = os.environ.get(name)
    if not val:
        print(f"ERROR: missing environment variable {name}", file=sys.stderr)
        sys.exit(1)
    return val


def quote_sql(value):
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def export_table_as_sql(conn, table):
    cur = conn.execute(f"SELECT * FROM {table}")
    cols = [d[0] for d in cur.description]
    col_list = ", ".join(cols)
    statements = []
    for row in cur.fetchall():
        vals = ", ".join(quote_sql(v) for v in row)
        statements.append(f"INSERT OR REPLACE INTO {table} ({col_list}) VALUES ({vals})")
    return statements


def execute_batch(url, token, statements):
    """Send a batch of SQL statements joined by semicolons in a single request."""
    payload = {"sql": ";\n".join(statements) + ";"}
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=payload,
        timeout=60,
    )
    if not resp.ok:
        print(f"ERROR {resp.status_code}: {resp.text}", file=sys.stderr)
        sys.exit(1)
    data = resp.json()
    if not data.get("success"):
        print(f"ERROR: {data}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Sync local SQLite to Cloudflare D1")
    parser.add_argument("db", type=Path, help="path to SQLite database (e.g. /data/scc_food.db)")
    args = parser.parse_args()

    if not args.db.exists():
        print(f"ERROR: Database not found at {args.db}", file=sys.stderr)
        sys.exit(1)

    account_id = get_env("CLOUDFLARE_ACCOUNT_ID")
    database_id = get_env("CLOUDFLARE_D1_DATABASE_ID")
    token = get_env("CLOUDFLARE_API_TOKEN")
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query"

    print(f"Connecting to {args.db}...")
    conn = sqlite3.connect(args.db)

    for table in TABLES:
        print(f"Syncing {table}...")
        statements = export_table_as_sql(conn, table)
        total = len(statements)
        print(f"  {total} rows to push...")

        for i in range(0, total, BATCH_SIZE):
            batch = statements[i:i + BATCH_SIZE]
            execute_batch(url, token, batch)
            done = min(i + BATCH_SIZE, total)
            print(f"  {done}/{total}", end="\r")

        print(f"  {total}/{total} rows pushed.  ")

    conn.close()
    print("\nSync complete.")


if __name__ == "__main__":
    main()
