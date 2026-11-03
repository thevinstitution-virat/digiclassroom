# Migration 019: production sequence and rollback

`packages/core/src/lib/db/migrations/019_hw_cost_phase1.sql` creates two new tables, `hw_ai_grade_source` and `hw_shared_key`, and alters nothing.
It is the **expand** step. There is no data to migrate and nothing to contract, so the expand → deploy → migrate → contract sequence
is: expand (019), deploy, then switch the three flags that use the tables on later. **Nothing here has been applied to production.**

Every command below was rehearsed on a scratch Postgres 16 holding the 014 + 015 schema with the tables owned by a role
`digiclassroom_app`, as in production. The rehearsal results are at the end.

## Order

| # | Step | Who/what | Check |
|---|---|---|---|
| 0 | Branch merged to `main` is **not** needed to apply 019 | – | – |
| 1 | **Schema backup** | on the VPS, as root | file exists, is non-empty |
| 2 | **Apply 019** (expand) | on the VPS, as the Postgres superuser | two tables, owner `digiclassroom_app`, 6 indexes, 1 trigger |
| 3 | **Deploy the branch with every flag off** (push to `main`: Coolify deploys it) | the owner | the hw and library suites pass in CI/locally; no hw errors in the backend logs |
| 4 | Leave it running; confirm nothing touches the new tables | SQL below | scans and inserts on both tables are 0 |
| 5 | Later, one at a time: `HW_CODE_MARKING_ENABLED`, `HW_DEDUPE_MARKING_ENABLED`, `HW_SHARED_KEYS_ENABLED` | the owner, per tenant rollout | step 4's query starts counting, and the overview shows the source |
| – | `HW_HOMEWORK_BATCH_ENABLED` and `HW_OPENAI_EXPLICIT_CACHE_ENABLED` do **not** need 019 | – | – |

Why 019 goes first: the code that uses the tables is behind flags, so deploying before applying would be harmless while the flags
stay off, but a flag switched on before 019 exists fails loudly (`relation "hw_ai_grade_source" does not exist`, rehearsed). Apply
first so the order cannot be got wrong later.

## Commands (production; run only when you decide to)

The database container is `sn7jgws05e0uq48u31u5ezr8`, database `digiclassroom` (from the deploy notes). Backups go to
`/root/backups/digiclassroom/`.

```bash
# 1. schema backup (hw_ tables only; a full schema backup is also fine)
mkdir -p /root/backups/digiclassroom
docker exec sn7jgws05e0uq48u31u5ezr8 pg_dump -U postgres -s -t 'hw_*' digiclassroom > /root/backups/digiclassroom/hw-schema-before-019-$(date +%Y%m%d-%H%M).sql
wc -l /root/backups/digiclassroom/hw-schema-before-019-*.sql

# 2. apply (the file has its own BEGIN/COMMIT; ON_ERROR_STOP makes any error abort)
docker exec -i sn7jgws05e0uq48u31u5ezr8 psql -U postgres -d digiclassroom -v ON_ERROR_STOP=1 < 019_hw_cost_phase1.sql

# verify
docker exec sn7jgws05e0uq48u31u5ezr8 psql -U postgres -d digiclassroom -Atc "select tablename||':'||tableowner from pg_tables where tablename in ('hw_ai_grade_source','hw_shared_key') order by 1"
```

Expected: `hw_ai_grade_source:digiclassroom_app` and `hw_shared_key:digiclassroom_app`.

Step 4, after the deploy, with the flags off:

```sql
select relname, seq_scan, idx_scan, n_tup_ins from pg_stat_user_tables where relname in ('hw_ai_grade_source','hw_shared_key');
-- all zeros while the flags are off
```

## Rollback

`019_hw_cost_phase1.down.sql` drops exactly the two tables (`DROP TABLE IF EXISTS hw_ai_grade_source, hw_shared_key`). Suggestions in
`hw_ai_grade` are untouched; they lose only the record of how they were produced. Shared keys are rebuilt (and paid for again) on demand.

1. Switch the three flags off first (a flag left on after the tables are gone fails loudly).
2. `docker exec -i sn7jgws05e0uq48u31u5ezr8 psql -U postgres -d digiclassroom -v ON_ERROR_STOP=1 < 019_hw_cost_phase1.down.sql`
3. The deployed code needs no change: with the flags off it never touches the tables.

## Rehearsal on the scratch database

| Step | Result |
|---|---|
| Before | 24 hw tables, 0 of the 019 tables; 1,800-line schema backup written |
| Apply 019 | `DO`, `COMMIT`; both tables owned by `digiclassroom_app`; 6 indexes; append-only trigger present |
| Deploy, every flag off: the existing 11-test integration suite | passes; **0 scans, 0 inserts** on the new tables |
| Flags on (code marking, dedupe, batch): the 13-test cost suite (before the 3 added since) | passes; 16 source rows written |
| Rollback | `COMMIT`; 0 of the 019 tables left; `hw_ai_grade` 58 rows before and after; `hw_answer` 62 before and after |
| Flags-off suite after rollback | passes (11 tests) |
| A flag switched on after rollback | fails loudly: `relation "hw_ai_grade_source" does not exist` |
| Re-apply after rollback | `COMMIT`; both tables back |

Migration numbers 016–018 were taken on `main` on 3 Nov; renumber this file if another branch takes 019 first.
