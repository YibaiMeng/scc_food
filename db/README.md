# Cloudflare D1 Sync

Pushes the local SQLite database to Cloudflare D1 so the Worker API can serve it.

## Setup (first time only)

```bash
cd worker
npm install

# Create D1 database and auto-update worker/wrangler.toml
npx wrangler d1 create scc-food --binding DB --update-config

# Apply schema
npx wrangler d1 execute scc-food --remote --yes --file ../db/schema.sql
```

## Usage

Requires three environment variables (get from Cloudflare dashboard / `wrangler whoami`):

```bash
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_D1_DATABASE_ID=...
export CLOUDFLARE_API_TOKEN=...       # needs D1:Edit permission

python db/sync.py /path/to/scc_food.db
```
