# Merging Phase 3 and Phase 5 (`feat/hw-pilot-a` + `feat/hw-pilot-b`) into `main`: production runbook

Prepared 5 Nov 2026 (roadmap Phase 5, STOP point). **Nothing here has been run on production, and nothing is merged.** Every step marked OWNER waits for the owner's
explicit go-ahead in the session that runs it. A push to `main` is a production deploy (Coolify deploys it a few minutes later). Claude does not push `main`.

## What is being merged

- `feat/hw-pilot-b` is stacked on `feat/hw-pilot-a` (the audit table of migration 021 is in A), so **B contains A**: one push of B's tip merges both. 10 commits after `main` (`50a2d34`): 4 from A (consent records and gates, rater invitations, evaluator isolation, "Draft with AI" fix) and 6 from B (eligibility registry, tenant control, monitoring and the three tabs, answer keys in the product, the merge runbook and roadmap, and the screen-walkthrough fix). Run `git log --oneline origin/main..HEAD` for the exact list; the count in this sentence is the one to re-check.
- `origin/main` has **0 commits** that the branch lacks (checked 5 Nov by `git fetch` and `git log HEAD..origin/main`), so the push is a **fast-forward**. Re-check right before pushing.
- **Migrations 021 to 027**, all additive (the "expand" step). The only changes to existing tables are columns with defaults (`hw_question`, `hw_tenant_quota`, `hw_ai_usage_monthly`) and one widened check (`hw_rubric_item.source` also allows `'key'`). Nothing is dropped or renamed. The old answer-count quota column and `hw_eval_monitor_daily` stay; their "contract" steps are later migrations.
- Migrations 023, 024 and 026 were edited **before ever being applied** (the scheme-source vocabulary became `board_scheme_key`, `passage_key`, `textbook_key`, `teacher_rubric`). Any scratch or dev database built from the earlier versions must be rebuilt; production is unaffected because none of them was ever applied there.
- New settings, all optional and with safe defaults (none is set in production by this merge): `HW_MONITOR_*` (alert thresholds; the owner's provisional values are the defaults), `HW_TEACHER_RUBRIC_AI_ENABLED` (off), `HW_ELIGIBILITY_ENFORCED` (on). **`HW_JOB_ORG_PREFIX` is for tests only and must be unset in production**: if it were set, the worker would take only the jobs of institutions whose id starts with it.
- Per-migration notes: `migration-021-022-runbook.md` and `migration-023-026-runbook.md`; 027 is described in its own header.
- New behaviour with the code deployed and **nothing else changed**:
  - AI suggestions need an **eligible group** (registry) **and** a usable answer key. The default for every group is not eligible, so nothing is suggested until the owner promotes a group. Production has the feature off and no `hw_tenant_quota` rows, so nothing visible changes.
  - The month is the Indian month; a rupee budget replaces the answer count only for an institution that has one (none do).
  - The Evaluate menu and its tools stay off while `HW_EVAL_TOOLS_ENABLED` is unset.
- **The job worker stays unscheduled.** No Coolify scheduled task calls `/api/cron/hw-jobs` and `HW_CRON_SECRET` is unset in production (roadmap section 8). That means: no answer keys are built, no reading or marking runs, and no monitoring roll-up, alert or automatic demotion happens, even with the code deployed. Scheduling it is a separate production change (Phase 6 prerequisite) and needs its own go-ahead; do not do it as part of this merge.

## Checks done before this runbook (local, 5 Nov 2026)

| Check | Result |
|---|---|
| `git fetch origin`; commits on `main` that the branch lacks | 0 |
| hw jest suite against a scratch Postgres 16 holding the production schema plus 019 to 027, run **in parallel** three times | 31 suites passed each time; **558 passed, 2 skipped** (live OpenRouter); 559 passed on the last run after the final fix |
| Migrations 023 to 026 rolled back in reverse and re-applied; 027 rolled back and re-applied | schemas identical after re-apply (only pg_dump's random `\restrict` token differs) |
| Typechecks: core, web, scripts | no errors in files this work touches (existing errors in unrelated files remain: taxonomy page, generated `.next` types) |
| `next build`, `apps/web` and `apps/api` | API: exit 0 after the keys work. Web: exit 0 before the final UI commits (the web app was run in dev mode for the screen walkthrough). Both must be re-run on the tip before the merge, see step 0 |

Limits, stated plainly: the scratch database was built from a schema-only dump of the **production** database taken 4 Nov, with the same 12 roles and `digiclassroom_app` as owner; it holds no production rows, so "existing rows untouched" rests on the migrations only adding columns with defaults (checked by the constraint probes in the rehearsal). The browser screens were not exercised against production. Nothing was run on the VPS.

## Sequence

Container names are from the deploy notes: Postgres `sn7jgws05e0uq48u31u5ezr8`, database `digiclassroom`, backend app `tu8q9z107lmqjwla7btit5mu`, frontend `o14pa2cm374la6tqryjfxi5j`.

### 0. Before anything (OWNER confirms)
- No other session is deploying to `main`. Re-run `git fetch origin && git log origin/main..HEAD --oneline` and read it; expect the 10 commits above, and `git log HEAD..origin/main` empty.
- Re-run on the tip being pushed: the hw suite (`HW_ITEST_DATABASE_URL=… npx jest src/__tests__/hw`), `next build` in `apps/web` and `apps/api`, and `tsc --noEmit -p scripts/tsconfig.hw.json`.
- Migrations 016 to 020 are applied on production (019 and 020 were applied on 4 Nov); check with `select tablename from pg_tables where tablename in ('hw_ai_grade_source','hw_shared_key','hw_instruction_flag')`.

- Migration 027 drops and re-creates `hw_rubric_item_source_check` **by its default name**. On production confirm it exists under that name: `select conname from pg_constraint where conrelid = 'hw_rubric_item'::regclass and contype = 'c'` must list `hw_rubric_item_source_check`. (The rehearsal on a restore of the production schema in step 2 proves the same; this is the one-line check.)
- 021 and 022 are not partly applied: `select to_regclass('hw_admin_audit'), to_regclass('hw_eval_rater_invite')` both NULL.

### 1. Backup with a recorded restore point (on the VPS, as root)
```bash
mkdir -p /root/backups/digiclassroom
docker exec sn7jgws05e0uq48u31u5ezr8 pg_dump -U postgres -s -d digiclassroom > /root/backups/digiclassroom/schema-before-021-027-$(date +%Y%m%d-%H%M).sql
docker exec sn7jgws05e0uq48u31u5ezr8 pg_dump -U postgres -Fc -t 'hw_*' -t organization -d digiclassroom > /root/backups/digiclassroom/hw-data-before-021-027-$(date +%Y%m%d-%H%M).dump
docker exec sn7jgws05e0uq48u31u5ezr8 psql -U postgres -d digiclassroom -Atc "select now() at time zone 'utc'"
wc -l /root/backups/digiclassroom/schema-before-021-027-*.sql
```
Record the UTC time printed as the **restore point** in the roadmap log, and the file names. Stop if either file is empty. (The data dump is small: the `hw_*` tables hold no student work yet; confirm with `select count(*) from hw_answer` and write the number in the log.)

### 2. Rehearse on a schema-only copy of production (OWNER; once, immediately before applying)
Restore the schema file from step 1 into a throwaway database on the same server, with the same roles, and apply 021 to 027 in order as `digiclassroom_app` with `-v ON_ERROR_STOP=1`; then roll back 027 to 021 in reverse and re-apply; compare `pg_dump -s` before and after (ignore the `\restrict` line). Expected: 11 new tables (021: 2, 023: 2, 024: 2, 025: 1, 026: 2, 027: 2; 022 only adds columns), so production's table count plus 11 (109 + 11 = 120 on the 4 Nov rehearsal copy). Drop the throwaway database.

### 3. Apply 021 to 027 (OWNER, as the owning role, in this order, each with `ON_ERROR_STOP=1`)
Run this on the VPS from a checkout of the branch tip (or copy the seven `.sql` files there first); the paths below are relative to the repository root. Every file is one transaction (`BEGIN` … `COMMIT`), so a file that fails changes nothing; if one fails, stop, read the error, and do not skip ahead.
```bash
for f in 021_hw_eval_rater_invite 022_hw_eval_consent_pilot 023_hw_eval_runs_gates 024_hw_eligibility 025_hw_tenant_control 026_hw_monitoring 027_hw_question_keys; do
  docker exec -i sn7jgws05e0uq48u31u5ezr8 psql -U digiclassroom_app -d digiclassroom -v ON_ERROR_STOP=1 < packages/core/src/lib/db/migrations/$f.sql || break
done
```
024 and 025 and 027 take a short exclusive lock on `hw_question`, `hw_tenant_quota`, `hw_rubric_item` and `hw_ai_usage_monthly` to add columns with defaults (metadata-only on PostgreSQL 11 and later); these tables are small and idle. Apply outside school hours anyway.

### 4. Ownership and grants (the check from the cost-branch merge)
```bash
docker exec sn7jgws05e0uq48u31u5ezr8 psql -U postgres -d digiclassroom -Atc "select tablename||':'||tableowner from pg_tables where tablename in ('hw_eval_rater_invite','hw_admin_audit','hw_eval_run','hw_eval_gate_result','hw_eligibility','hw_eligibility_event','hw_tenant_scope','hw_monitor_group_daily','hw_monitor_alert','hw_question_key','hw_ai_grade_scheme') order by 1"
docker exec sn7jgws05e0uq48u31u5ezr8 psql -U postgres -d digiclassroom -Atc "select table_name||':'||string_agg(privilege_type,',' order by privilege_type) from information_schema.role_table_grants where grantee='digiclassroom_app' and table_name in ('hw_question_key','hw_ai_grade_scheme','hw_admin_audit','hw_eligibility_event') group by table_name"
docker exec sn7jgws05e0uq48u31u5ezr8 psql -U postgres -d digiclassroom -Atc "select column_name||' default '||column_default from information_schema.columns where (table_name,column_name) in (('hw_question','scheme_source'),('hw_question','rubric_mode'),('hw_question','origin'),('hw_tenant_quota','monthly_budget_paise'),('hw_tenant_quota','scope_restricted'),('hw_ai_usage_monthly','key_cost_paise')) order by 1"
```
Expected: all eleven tables owned by `digiclassroom_app`; the app role has SELECT, INSERT, UPDATE, DELETE on them (if the second query prints nothing because the app role owns the tables, that is the same result: an owner holds every privilege) (the append-only tables refuse UPDATE/DELETE by trigger, not by privilege); the six defaults present. If an owner prints as `postgres`, `ALTER TABLE … OWNER TO digiclassroom_app` before going on.

### 5. Push (OWNER says go)
```bash
git push origin feat/hw-pilot-b:main     # fast-forward; as the GitHub account thevinstitution-virat
```
Coolify deploys backend and frontend a few minutes later. **Do not set any HW_ environment variable, and do not schedule the job worker.**

### 6. Checks after the deploy (report each result)
1. Both containers healthy, restart count 0: `docker ps --filter name=tu8q9z107lmqjwla7btit5mu --filter name=o14pa2cm374la6tqryjfxi5j --format '{{.Names}} {{.Status}}'` and `docker inspect -f '{{.RestartCount}}' <container>`.
2. **Feature off for everyone, no quota rows:** `select count(*) from hw_tenant_quota;` must print 0 (and `where enabled` 0). No `hw_eligibility` rows: `select count(*) from hw_eligibility;` 0.
3. **Flags off:** `docker exec <backend> printenv | grep -E '^HW_' | cut -d= -f1` must show no `HW_*_ENABLED`, no `HW_FEATURE_DEFAULT_ENABLED`, and no `HW_CRON_SECRET` (names only, never values; if `HW_FEATURE_DEFAULT_ENABLED` is listed, read its value once, without printing anything else, and confirm it is not true). The same names output must **not** contain `HW_ELIGIBILITY_ENFORCED`, `HW_TEACHER_RUBRIC_AI_ENABLED` or `HW_JOB_ORG_PREFIX`: none of the three should be set in production.
4. The new tables are untouched except by the app's own reads: `select relname, n_tup_ins from pg_stat_user_tables where relname in ('hw_question_key','hw_ai_grade_scheme','hw_monitor_group_daily','hw_eligibility_event','hw_admin_audit');` all zero.
5. The job endpoint still refuses without the secret: `curl -s -o /dev/null -w '%{http_code}\n' -X POST https://api.dgcl.vinstitution.com/api/cron/hw-jobs` must print 401 (and so nothing is processed: expected, see above).
6. **Clean logs** for 30 minutes: `docker logs --since 30m <backend> 2>&1 | grep -i -E 'error|hw' | head`. A line about `hw_monitor_group_daily` or `hw_question_key` not existing means a migration step was missed.
7. Tag: `git tag hw-pilot-ab-merged-$(date +%Y%m%d) && git push origin hw-pilot-ab-merged-$(date +%Y%m%d)`.

## Rollback

Code: revert on `main` (for a fast-forward, `git revert` the ten commits in reverse) and push; Coolify redeploys. Because the feature is off and the worker is unscheduled, running the old code against the new tables is harmless (the old code ignores the added columns; the checks that were widened only matter once a key is written).
Database (only if needed, and **after** the code is reverted): `027`, `026`, `025`, `024`, `023`, `022`, `021` `.down.sql` in that order, as the owning role. What each down loses: 027 the keys, origin/passage/rubric mode (rubric items made from a key stay, as the teacher's); 026 the monitoring figures and alerts (recomputed); 025 budgets and class lists; 024 the registry and its history (export `hw_eligibility_event` first; without it no group is eligible, the safe direction); 023 imported runs and gate results (re-importable); 022 consent columns; 021 invitations and **the audit table with its records** (export `hw_admin_audit` first). Restore from the step 1 files only as a last resort.
