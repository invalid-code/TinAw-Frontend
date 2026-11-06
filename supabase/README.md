# Connecting TinAw to Supabase

The frontend loads station data from Supabase when credentials are present.
Without credentials (or if a request fails), it automatically falls back to the
bundled demo data in `src/data/stations.ts`, so the dashboard always renders.

## 1. Apply the database schema

The schema is a versioned migration:

```text
supabase/migrations/20261106000000_tinaw_schema.sql
```

### Option A — Dashboard SQL Editor (fastest)

1. Open your project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor → New query**.
3. Paste the entire contents of
   `supabase/migrations/20261106000000_tinaw_schema.sql` and click **Run**.
4. Create another query, paste `supabase/seed.sql`, and click **Run**.
   This loads the three demo stations. Skip it if you want an empty database.
5. Verify with the queries in [Verify the schema](#5-verify-the-schema).

The migration is safe to re-run: tables use `create table if not exists`, and
policies are dropped/recreated.

### Option B — Supabase CLI (version-controlled)

`supabase/config.toml` is already initialized in this repo. You need your
**project ref** (the random ID in the dashboard URL / project URL) and your
**database password** (Settings → Database).

```bash
npx --yes supabase@latest login
npx --yes supabase@latest link --project-ref YOUR_PROJECT_REF
npx --yes supabase@latest db push --dry-run
npx --yes supabase@latest db push --include-seed
```

- `db push` applies every file in `supabase/migrations` in timestamp order.
- `--include-seed` runs `supabase/seed.sql` after the migrations.
- Omit `--include-seed` if you don't want demo data.

To confirm what the remote has:

```bash
npx --yes supabase@latest migration list
npx --yes supabase@latest db push --dry-run
```

### If the project already has these tables

- If you ran this SQL manually before, the definitions are idempotent. Re-running
  through the dashboard is safe.
- If the CLI reports a migration history mismatch because the SQL was applied by
  hand, mark the migration as applied and re-check:

  ```bash
  npx --yes supabase@latest migration repair --status applied 20261106000000
  npx --yes supabase@latest db push --dry-run
  ```

- If you have existing tables with different columns, **do not drop them**.
  Compare them with the migration and use `alter table` to add/rename columns so
  they match the names the frontend reads in
  `src/data/stationRepository.ts`.

## 2. Add the credentials

Copy the template and fill in your project values:

```bash
cp .env.example .env.local
```

Get both values from the Supabase Dashboard. Open your project and click
**Connect** in the top bar, or go to **Settings → API Keys**. Copy:

- **Project URL** → `VITE_SUPABASE_URL`
- **Publishable key** (`sb_publishable_...`) → `VITE_SUPABASE_ANON_KEY`
  - Older projects may show a legacy **anon** key (`eyJ...`) instead; it works too.

Example `.env.local`:

```dotenv
VITE_SUPABASE_URL="https://abcdefghijklmno.supabase.co"
VITE_SUPABASE_ANON_KEY="sb_publishable_..."
```

`.env.local` is gitignored. Use only the publishable/anon key in the frontend —
never the secret or legacy `service_role` key.

## 3. Restart the dev server

```bash
npm run dev
```

Vite only reads env vars at startup, so restart if the server was already running.

## 4. Check the browser console

On success you'll see:

```text
[TinAw] Loaded 3 stations from Supabase.
```

If something is wrong you'll see a warning and the UI keeps working with the
bundled data:

```text
[TinAw] Supabase request failed: <reason>. Falling back to bundled demo data.
```

## 5. Verify the schema

Run this in the SQL Editor after applying the migration:

```sql
-- Expect 3 rows
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('stations', 'station_parameters', 'station_history')
order by table_name;

-- If you ran seed.sql: expect 3 stations, 12 parameters, 42 history rows
select
  (select count(*) from public.stations) as stations,
  (select count(*) from public.station_parameters) as parameters,
  (select count(*) from public.station_history) as history_rows;

-- Expect one select policy per table
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('stations', 'station_parameters', 'station_history')
order by tablename, policyname;
```

You can also test the public API directly (replace the placeholders):

```bash
curl "https://YOUR_PROJECT_REF.supabase.co/rest/v1/stations?select=id,name" \
  -H "apikey: YOUR_PUBLISHABLE_OR_ANON_KEY"
```

## Schema overview

| Table | Purpose |
| --- | --- |
| `public.stations` | One row per monitoring station (location, status, score, recirculation). |
| `public.station_parameters` | Current pH / turbidity / TDS / temperature readings per station. |
| `public.station_history` | Chart points for the `24h`, `7d`, and `30d` ranges. |

RLS is enabled with `select`-only policies for `anon` and `authenticated`.
Writes require the `service_role` key (server-side) or a future admin policy.

## Updating the demo data

Edit `src/data/stations.ts`, then regenerate the seed file:

```bash
npm run generate:seed
```

The frontend does not need the seed file at runtime — it only reads from Supabase.
