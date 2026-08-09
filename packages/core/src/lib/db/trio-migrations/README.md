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

There is no `__migrations` ledger in this database — these are applied by hand,
so **this table is the ledger**. Update the Applied column in the same commit
that applies the file, or the next person has to read `\d` output to find out.

| File | What it is | Applied to prod |
|---|---|---|
| `000_baseline_20260807.sql` | **Captured, not authored.** `pg_dump --schema-only` of the `identity`, `content`, `notes`, and `taxonomy` schemas as they stood on 2026-08-07. The Step 5 foundation was created with ad-hoc SQL and never recorded anywhere, so this snapshot is the baseline every later migration builds on. Do not run it against a database that already has these schemas. | n/a — snapshot |
| `001_content_dedupe_run_lifecycle_grants.sql` | Content-hash dedupe, ingest-run lifecycle (`active`/`superseded` + one-active partial unique index), the `content_taxonomy_link` grant, and the missing `content_asset` columns. | ✅ |
| `002_content_asset_kind_to_role.sql` | `content_asset.kind` → `role`. `kind` means "what sort of thing is this work" on `content_item`; an asset answers "what is this file FOR". | ✅ |
| `003_seed_class9_subjects.sql` | Seeds the missing Class 9 SUBJECT nodes — the school tree had class nodes for all 12 classes but subjects only under 10 and 12, so no Class 9 book could be tagged at all. | ✅ |
| `004_work_key_renditions_per_asset_runs.sql` | An ingest run is per **asset**, not per work; an asset states which rendition it is; a work gets an identity (`isbn`/`edition`) that survives having no file. | ✅ |
| `005_multi_format_asset_model.sql` | `content_asset` can describe a whole multi-format work — source PDF, per-chapter markdown, per-variant narration, cover, thumbnail. | ✅ |
| `006_asset_slots_and_versions.sql` | The MIGRATE step for slot identity: a chapter is a **slot** that different files occupy over time, so the key is `(content_item_id, role, part_index, variant)` and file history moves to `content_asset_version`. Fixes 005's file-as-identity key, which left two runs active for one chapter. Expand step shipped first in `7bc64d9`. | ✅ |
| `007_chunk_index_per_asset.sql` | **Phase 1 of 3** — adds `content_chunk.content_asset_id` + `UNIQUE (content_asset_id, chunk_index)`, additively. Phase 2 is the code deploy that writes them; phase 3 is `008`. | ✅ |
| `008_drop_chunk_item_index_uq.sql` | **Phase 3 of 3** — drops the old `UNIQUE (content_item_id, chunk_index)`. Run only after phase 2 is live (it was: commit `518a403`, deployed 2026-08-08). `content_item_id` stays as a plain indexed column; only the uniqueness moved. | ✅ |
| `009_chunk_retrieval_class.sql` | `content_chunk.retrieval_class` — `reference` (prose) vs `practice` (question/prompt/activity), per chunk, so retrieval can stop answering a student with the textbook's own question. In Postgres and not only in the payload, because a model swap is a replay of `content_chunk`. | ✅ |
| `010_ingest_run_forced.sql` | `ingest_run.forced` + `force_reason` — an ingest that overrode the linter or the APPROVED gate must leave a trace, or forced content is indistinguishable from validated content the moment it is indexed. On the RUN, because force is a property of one ingestion event. | ✅ |

## Not captured here

Two pieces of the shared foundation are **not** SQL and so are not in this
directory. They're recorded here so they aren't rediscovered as mysteries:

- **Qdrant collection `trio_content_v1_openai3072`** on `trio-content-qdrant`:
  named dense vector `dense` (3072, Cosine, on_disk), sparse `bm25` (idf), int8
  scalar quantization, `m:16 / ef_construct:128 / payload_m:16`, and payload
  indexes on `content_item_id`, `visibility`, `grant_org_ids`,
  `taxonomy_node_ids`, `lang`, `kind`, `level`, `page_start`, `run_id`.
- **Roles** `content_app` and `identity_app`, created in Step 5.
