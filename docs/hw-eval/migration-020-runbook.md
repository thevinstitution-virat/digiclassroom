# Migration 020: production sequence and rollback

`packages/core/src/lib/db/migrations/020_hw_instruction_flag.sql` creates **one** new table, `hw_instruction_flag`, and alters nothing.
It is the **expand** step; there is nothing to migrate and nothing to contract. **Nothing here has been applied to production.**

What the table is for: when `HW_INSTRUCTION_GUARD_ENABLED` is on, every answer the instruction screen flags is recorded once when it is
marked (with the ids of the patterns that fired), and a teacher's one-tap "not an instruction" is recorded on the same row. The false-positive
rate of each pattern on real writing is then a query, not an estimate.

## Order

Same as 019 (`migration-019-runbook.md`): schema backup, apply 020 as the superuser, deploy with the flag off, switch `HW_INSTRUCTION_GUARD_ENABLED` on
later. The table has a foreign key to `hw_answer (id, organization_id)` (a unique pair since 014) and stores a **hash** of the transcript and
pattern **ids**, not student words.

```bash
docker exec -i sn7jgws05e0uq48u31u5ezr8 psql -U postgres -d digiclassroom -v ON_ERROR_STOP=1 < 020_hw_instruction_flag.sql
```

Rollback (drops only this table; marks and answers are untouched; switch the flag off first):

```bash
docker exec -i sn7jgws05e0uq48u31u5ezr8 psql -U postgres -d digiclassroom -v ON_ERROR_STOP=1 < 020_hw_instruction_flag.down.sql
```

## What happens if the flag is on and 020 is missing

Rehearsed (`cost-savings-integration.test.ts`): marking is **not** blocked. The record is written in a savepoint and a failure is logged
(`could not record instruction flags (is migration 020 applied?)`); a failed read of dismissals leaves the flag showing, the safe side. The
"not an instruction" button then fails with the database's error. So 020 should still be applied before the flag is switched on.

## The false-positive measure

```sql
-- per pattern: flagged when marked, and how many a teacher said were not instructions
SELECT p.id AS pattern,
       count(*)                                        AS flagged,
       count(*) FILTER (WHERE f.dismissed_at IS NOT NULL) AS not_an_instruction,
       round(100.0 * count(*) FILTER (WHERE f.dismissed_at IS NOT NULL) / count(*), 1) AS pct
  FROM hw_instruction_flag f, jsonb_array_elements_text(f.pattern_ids) AS p(id)
 GROUP BY 1 ORDER BY flagged DESC;
```

An answer that several patterns flagged counts once under each. Answers no teacher has looked at yet are in `flagged` but not in
`not_an_instruction`, so read the rate with that in mind.

## Rehearsal on the scratch database (Postgres 16, the 014 + 015 schema, then 019, then 020)

| Step | Result |
|---|---|
| Apply 020 | `COMMIT`; table present, 2 indexes (the primary key and the organisation index) |
| Integration suite with the guard on and off (22 tests, 4 of them new) | passes |
| Rollback | `DROP TABLE`, `COMMIT`; table gone; `hw_answer` 66 rows and `hw_ai_grade` 64 rows before and after |
| Re-apply after rollback | `COMMIT`; table back with its 2 indexes |
| Guard on, table missing | marking completes; the flag still shows in the queue (test) |
