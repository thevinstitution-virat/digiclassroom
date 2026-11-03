# Merging `perf/hw-cost` into `main`: production runbook

Prepared 4 Nov 2026 (roadmap Phase 1, task 1.5). **Nothing here has been run on production.** Every step marked OWNER waits for the owner's
explicit go-ahead in the session that runs it. A push to `main` is a production deploy (Coolify deploys it a few minutes later).

## What is being merged

- Branch `perf/hw-cost`, 7 commits after `main` at `d558558`: `2585ebc`, `c3a3e85`, `4ce188b`, `f74ec1e`, `ccbf10b`, `1a071a2`, `2512caf` (plus the roadmap docs commit).
- `origin/main` has **no commits that the branch lacks** (checked 4 Nov by `git fetch` and `git log HEAD..origin/main`: 0), so the push is a **fast-forward**; there is nothing to merge in and no conflict to resolve. Re-check right before pushing.
- Every new behaviour is behind a flag that is **off by default**: `HW_HOMEWORK_BATCH_ENABLED`, `HW_SHARED_KEYS_ENABLED`, `HW_CODE_MARKING_ENABLED`, `HW_DEDUPE_MARKING_ENABLED`, `HW_INSTRUCTION_GUARD_ENABLED`, `HW_OPENAI_EXPLICIT_CACHE_ENABLED`; `HW_PARTIAL_CREDIT_RULE` defaults to `zero` (phase 1c's marks exactly).
- Two things change for users even with every flag off, and are worth knowing: (1) the Marking page can show a "Not an instruction" button only when the guard flag is on and a flag exists; (2) token usage detail is now recorded per call (no behaviour change).
- Migrations: **019** (`hw_ai_grade_source`, `hw_shared_key`) and **020** (`hw_instruction_flag`). Both create tables only and alter nothing (expand step). There is nothing to migrate or contract.

## Checks done before this runbook (4 Nov 2026, local)

| Check | Result |
|---|---|
| `git fetch origin main`; commits on `main` that the branch lacks | 0 |
| hw jest suite, no database | 17 suites passed, 4 skipped; 359 passed, 45 skipped |
| hw jest suite with `HW_ITEST_DATABASE_URL` pointing at a scratch Postgres 16 holding the schema plus 019 and 020 | 20 suites passed, 1 skipped; **402 passed, 2 skipped** (the 2 are the live OpenRouter tests) |
| `tsc -p scripts/tsconfig.hw.json --noEmit` | clean |
| `next build`, `apps/api` and `apps/web` | both exit 0 |
| Migrations 019 then 020 on a schema-only copy of the dev database (104 tables) | both apply; 107 tables after; rolling back 020 then 019 returns a schema identical to the start (only pg_dump's random `\restrict` token differs); re-apply works |

Limits of the rehearsal, stated plainly: the scratch schema is a dump of the **dev** database `digiclassroom` (same 104 tables as the `hw_itest` copy), not of production, and
the role `digiclassroom_app` does not exist there, so the ownership lines print `NOTICE: role digiclassroom_app not found; ownership left unchanged`. Ownership on production
is therefore checked in step 2 below. The scratch container held no rows, so "marks and answers untouched by rollback" rests on the earlier 019/020 rehearsals
(`migration-019-runbook.md`, `migration-020-runbook.md`), which counted `hw_ai_grade` and `hw_answer` rows before and after.

## Sequence

Container names are from the deploy notes: Postgres `sn7jgws05e0uq48u31u5ezr8`, database `digiclassroom`, backend app `tu8q9z107lmqjwla7btit5mu`, frontend `o14pa2cm374la6tqryjfxi5j`.

### 0. Before anything (OWNER confirms)
- No other session is deploying to `main` (this is also a deploy of everything on `main` that is not yet live: re-run `git log origin/main..HEAD --oneline` and read it).
- Migrations 016 to 018 are on `main`; check on the VPS that production has them applied if the code on `main` needs them (this branch does not).

### 1. Schema backup (on the VPS, as root)
```bash
mkdir -p /root/backups/digiclassroom
docker exec sn7jgws05e0uq48u31u5ezr8 pg_dump -U postgres -s -d digiclassroom > /root/backups/digiclassroom/schema-before-019-020-$(date +%Y%m%d-%H%M).sql
wc -l /root/backups/digiclassroom/schema-before-019-020-*.sql
```
Expected: a file of several thousand lines. Stop if it is empty.

### 2. Apply 019, then 020 (OWNER, as the Postgres superuser)
```bash
docker exec -i sn7jgws05e0uq48u31u5ezr8 psql -U postgres -d digiclassroom -v ON_ERROR_STOP=1 < 019_hw_cost_phase1.sql
docker exec -i sn7jgws05e0uq48u31u5ezr8 psql -U postgres -d digiclassroom -v ON_ERROR_STOP=1 < 020_hw_instruction_flag.sql
docker exec sn7jgws05e0uq48u31u5ezr8 psql -U postgres -d digiclassroom -Atc "select tablename||':'||tableowner from pg_tables where tablename in ('hw_ai_grade_source','hw_shared_key','hw_instruction_flag') order by 1"
```
Expected: the three tables, each owned by `digiclassroom_app`. If an owner prints as `postgres`, run `ALTER TABLE … OWNER TO digiclassroom_app` for it before going on.

### 3. Push (OWNER says go)
```bash
git push origin perf/hw-cost:main     # fast-forward; as the GitHub account thevinstitution-virat
```
Coolify deploys backend and frontend a few minutes later. **Do not set any HW_ environment variable.**

### 4. Checks after the deploy (report each result)
1. Both containers healthy, restart count 0: `docker ps --filter name=tu8q9z107lmqjwla7btit5mu --filter name=o14pa2cm374la6tqryjfxi5j --format '{{.Names}} {{.Status}}'` and `docker inspect -f '{{.RestartCount}}' <container>`.
2. Feature still off for everyone: `select count(*) from hw_tenant_quota where enabled;` must be 0, and `docker exec <backend> printenv | grep -c '^HW_'` must show no `HW_*_ENABLED` and no `HW_FEATURE_DEFAULT_ENABLED` set to true (the output names only, never values).
3. The new tables are untouched: `select relname, seq_scan, idx_scan, n_tup_ins from pg_stat_user_tables where relname in ('hw_ai_grade_source','hw_shared_key','hw_instruction_flag');` all zeros.
4. The job endpoint still refuses without the secret: `curl -s -o /dev/null -w '%{http_code}\n' -X POST https://api.dgcl.vinstitution.com/api/cron/hw-jobs` must print 401.
5. Error logs clean for 30 minutes: `docker logs --since 30m <backend> 2>&1 | grep -i -E 'error|hw' | head`.
6. Tag: `git tag hw-cost-merged-$(date +%Y%m%d) && git push origin hw-cost-merged-$(date +%Y%m%d)`.

## Rollback

Code: revert the merge on `main` (`git revert -m 1 <merge>` or, for a fast-forward, revert the seven commits in reverse) and push; Coolify redeploys. Because every flag is off the old
and new code behave the same, so a code rollback is rarely needed.

Database (only if the tables must go; switch the flags off first):
```bash
docker exec -i sn7jgws05e0uq48u31u5ezr8 psql -U postgres -d digiclassroom -v ON_ERROR_STOP=1 < 020_hw_instruction_flag.down.sql
docker exec -i sn7jgws05e0uq48u31u5ezr8 psql -U postgres -d digiclassroom -v ON_ERROR_STOP=1 < 019_hw_cost_phase1.down.sql
```
Suggestions in `hw_ai_grade` are untouched; they lose only the record of how they were produced. If something worse happens, the pre-change schema is in the step 1 backup.

## After the merge, still not switched on
Each flag, `HW_PARTIAL_CREDIT_RULE`, any quota row and `HW_FEATURE_DEFAULT_ENABLED` stay as they are until the owner decides (roadmap Phases 5 and 6).

## Executed on 4 Nov 2026 (owner approved D1 with three conditions)

| Step | Result |
|---|---|
| Fresh backup (VPS, `/root/backups/digiclassroom/`, root-only) | `schema-before-019-020-20261103T184515Z.sql` (216,082 bytes, sha256 `3a5789bd…1b1559`) and `full-before-019-020-20261103T184515Z.dump` (344,398 bytes, sha256 `5820c47c…425d3f`, custom format, 106 tables of data, readable by `pg_restore -l`) |
| Restore point | 2026-11-03 18:45 UTC (00:15 IST on 4 Nov), transaction snapshot 44302. Every `hw_` table was empty (0 rows in assignments, submissions, answers, suggestions, grades, jobs and quota) |
| Production schema rehearsal | Schema-only dump of the production `digiclassroom` (6,403 lines) restored into a scratch Postgres 16 with the same 12 roles, database owner `digiclassroom_app`. 019 and 020 applied **as `digiclassroom_app`**, rolled back, re-applied: schema after rollback identical to production (only the pg_dump version header differs) |
| Diff, production against the dev schema used in the earlier rehearsal | After normalising the owner (`postgres` in dev, `digiclassroom_app` in production): production has two tables dev lacks, `user_learning_goal` (016) and `tutor_token_usage` (018), plus an owner difference on `protect_super_admin()`. No `hw_` object, no table 019/020 reference (`hw_ai_grade`, `hw_answer`, both with a unique `(id, organization_id)`), no trigger function (`hw_forbid_update`, owned by `digiclassroom_app`) and no role differs. No STOP |
| Owner and grants (production) | Existing 24 `hw_` tables and all 106 tables: owner `digiclassroom_app`. The app connects as `digiclassroom_app` (its `DATABASE_URL` user; the password was not displayed). It owns the database (so it may create in `public`) |
| Applied on production | 019 then 020, each as `digiclassroom_app` with `ON_ERROR_STOP`, exit 0. Owner of `hw_ai_grade_source`, `hw_shared_key`, `hw_instruction_flag`: `digiclassroom_app`. `has_table_privilege` for the app role: SELECT, INSERT, UPDATE, DELETE all true on each. Sequences owned by the new tables: 0 (so no `has_sequence_privilege` to grant). Indexes 4, 2 and 2; the append-only trigger is on `hw_ai_grade_source`. Production now has 109 tables |
| **Push to `main`** | **Not done.** `git push` asked for a password: the remote is `thevinstitution-virat@github.com` and no credential for that account is available to this session (`gh` holds only `pdlms2` and `pdlmspro`). A check of those accounts' access was refused by the safety classifier as credential exploration and was not retried. `origin/main` still has no commit the branch lacks (re-checked). The deployed code does not use the new tables, so nothing is affected until the push |
| Post-deploy checks, tag | Not run (no deploy yet). Baseline before the deploy: backend, frontend and database containers all `RestartCount` 0 since 2026-11-03 13:24 UTC; `hw_tenant_quota` has 0 rows |

To finish: run `git push origin perf/hw-cost:main` as `thevinstitution-virat` (or give this session a credential helper for it), then the checks in "Checks after the deploy" above, then tag `hw-cost-merged-2026-11-04` (the IST date).
