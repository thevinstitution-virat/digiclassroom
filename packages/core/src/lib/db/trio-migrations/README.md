# trio-migrations

Migrations for the **`trio`** database — the shared cross-app content/identity
store. This is **not** DCP's own `digiclassroom` database, and these files are
**not** run by `../migrations/run_migrations.sh`.

## Why these live in this repo

DCP is the sole writer to the `content` schema (PDLMS reads it; Vidyaverse
doesn't touch it yet), so the migrations sit next to the code that depends on
them. If a Trio Content Service is later extracted into its own repo, these move
with it.

## Connection

The `trio` DB is a separate logical database on the same Postgres cluster as
`digiclassroom`, so it needs its own connection — Postgres has no cross-database
`USE`. At runtime the app reaches it via `TRIO_CONTENT_DATABASE_URL` (role
`content_app`, see `../content-connection.ts`).

Migrations must be applied as a **Postgres superuser**, not as `content_app`:
`GRANT` and constraint changes are outside what the app role can do, by design.

```bash
# from the VPS
docker cp 001_xxx.sql <postgres-container>:/tmp/001_xxx.sql
docker exec <postgres-container> psql -U postgres -d trio -f /tmp/001_xxx.sql
```

## Files

| File | What it is |
|---|---|
| `000_baseline_20260807.sql` | **Captured, not authored.** `pg_dump --schema-only` of the `identity`, `content`, `notes`, and `taxonomy` schemas as they stood on 2026-08-07. The Step 5 foundation was created with ad-hoc SQL and never recorded anywhere, so this snapshot is the baseline every later migration builds on. Do not run it against a database that already has these schemas. |
| `001_content_dedupe_run_lifecycle_grants.sql` | Content-hash dedupe, ingest-run lifecycle (`active`/`superseded` + one-active partial unique index), the `content_taxonomy_link` grant, and the missing `content_asset` columns. |

## Not captured here

Two pieces of the shared foundation are **not** SQL and so are not in this
directory. They're recorded here so they aren't rediscovered as mysteries:

- **Qdrant collection `trio_content_v1_openai3072`** on `trio-content-qdrant`:
  named dense vector `dense` (3072, Cosine, on_disk), sparse `bm25` (idf), int8
  scalar quantization, `m:16 / ef_construct:128 / payload_m:16`, and payload
  indexes on `content_item_id`, `visibility`, `grant_org_ids`,
  `taxonomy_node_ids`, `lang`, `kind`, `level`, `page_start`, `run_id`.
- **Roles** `content_app` and `identity_app`, created in Step 5.
