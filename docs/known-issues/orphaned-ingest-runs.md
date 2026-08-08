# Known issue: ingest runs orphaned by process termination

**Status:** partially handled. In-process failures are cleaned up; process death
is not, and cannot be.

## What is handled

`abortSharedContentRun` (`enhanced-rag-pipeline.ts`) deletes a failed run's
points by `run_id` and then marks the run `failed`. It fires on:

- any batch throwing inside the batch loop (the run is abandoned even when other
  batches succeeded — a partially-ingested textbook marked `active` would answer
  from the chapters that survived and silently omit the rest);
- zero chunks indexed;
- any exception escaping to `indexPDF`'s outer catch, including embedding-API
  failures.

Ordering is always **points first, status second**. If cleanup itself fails, the
row is deliberately left `running` — a `running` row pointing at real points is
recoverable, a `failed` row pointing at ghosts is invisible garbage.

## What is NOT handled

**Process termination mid-ingest** — SIGKILL, OOM, container eviction, a Coolify
redeploy landing mid-upload. No in-process handler runs, so the run stays
`running` forever and its points stay in the collection with a `run_id` that will
never activate.

This matters because supersede only ever targets the **active** run. Orphans from
a `running` run are never collected by any normal code path, and they silently
blend a half-ingested document into every future search.

A `SIGTERM` handler would cover graceful shutdown but not `SIGKILL` or OOM, which
are the realistic cases — so it is not implemented rather than implemented and
trusted.

## Reconcile query

Runs stuck `running` well past any plausible ingest duration. Ingestion of a
large textbook is minutes, not hours, so anything older than a few hours is dead:

```sql
-- Candidates for reconciliation
SELECT r.id            AS run_id,
       r.content_item_id,
       i.title,
       r.started_at,
       now() - r.started_at AS age,
       r.collection
FROM content.ingest_run r
JOIN content.content_item i ON i.id = r.content_item_id
WHERE r.status = 'running'
  AND r.started_at < now() - interval '3 hours'
ORDER BY r.started_at;
```

For each row returned, in this order:

1. Delete its points from Qdrant by `run_id`:
   `POST /collections/trio_content_v1_openai3072/points/delete`
   with `{"filter":{"must":[{"key":"run_id","match":{"value":"<run_id>"}}]}}`
2. Then mark it failed:
   `UPDATE content.ingest_run SET status='failed', error='orphaned by process termination', completed_at=now() WHERE id='<run_id>';`

Never the reverse — see the ordering note above.

Sanity check for orphans whose run row was already lost, which should return
zero:

```sql
-- point run_ids with no ingest_run row is not expressible in SQL; check from the
-- Qdrant side instead by faceting run_id and comparing against:
SELECT id FROM content.ingest_run WHERE collection = 'trio_content_v1_openai3072';
```

## Proper fix

This belongs in the Trio Content Service as a scheduled reconcile job rather than
a runbook step — the query above run on a timer, with the same points-then-status
ordering. Until TCS exists, run it by hand after any incident that killed the
backend mid-ingest.
