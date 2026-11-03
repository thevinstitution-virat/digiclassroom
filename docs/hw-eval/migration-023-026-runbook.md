# Migrations 023 to 026: production sequence and rollback (Phase 5, `feat/hw-pilot-b`)

**Nothing here has been applied anywhere except scratch databases.** All four are additive (the "expand" step): the only change to an existing table is two columns with defaults, so nothing is renamed or dropped. They sit on top of 021 and 022 (`migration-021-022-runbook.md`): 021 supplies `hw_admin_audit`, which the code writes to. **Apply 021 and 022 first.**

| Migration | What it does |
|---|---|
| `023_hw_eval_runs_gates.sql` | New tables `hw_eval_run` and `hw_eval_gate_result` (imported from `hw:eval:report`'s `report.json`; append-only, UPDATE and DELETE refused). |
| `024_hw_eligibility.sql` | Adds `hw_question.scheme_source` (`NOT NULL DEFAULT 'custom'`, checked). New tables `hw_eligibility` (the registry) and `hw_eligibility_event` (append-only history; UPDATE, DELETE and TRUNCATE refused). A row can be `eligible` only with evidence (config hash, gate result, dataset versions). |
| `025_hw_tenant_control.sql` | Adds `hw_tenant_quota.monthly_budget_paise` (`NOT NULL DEFAULT 0`, never negative) and `scope_restricted` (`NOT NULL DEFAULT false`). New table `hw_tenant_scope` (allowed classes and sections; one row per entry). |
| `026_hw_monitoring.sql` | New tables `hw_monitor_group_daily` (per day, institution and group: the monitoring figures) and `hw_monitor_alert` (one open alert per group and code). The older `hw_eval_monitor_daily` is untouched. |

## Behaviour that changes when these are applied (with the code on `feat/hw-pilot-b`)

- **AI suggestions are off for every group until the owner promotes it** (024 with the code; `HW_ELIGIBILITY_ENFORCED` defaults to true). Production has no `hw_tenant_quota` row and the feature is off, so nothing visible changes today. This is the intended default: a group needs a passing gate result for the running marking setup and a typed reason.
- **The month is the Indian month** (code, no migration). Usage rows already in `hw_ai_usage_monthly` are keyed by the UTC month. Check before deploying: `select count(*) from hw_ai_usage_monthly` (should be 0 in production; if not, rows written between 00:00 and 05:30 IST on the 1st of a month would sit in the previous month's row, which only matters for that month's total).
- **A rupee budget, when set, replaces the answer-count quota for that institution** (025 with the code). With no budget (the default, 0) the old rule is unchanged, and a missing quota row is still "AI off". The old column `monthly_answer_quota` is **not** dropped: that is the "contract" step, to be done in its own migration after the owner has moved every institution to a budget.
- **A class allow-list** (025 with the code): off for every institution until the owner turns it on (`scope_restricted = false`).
- **Monitoring runs inside the job worker's 15-minute pass** (026 with the code) and emails the platform owners about alerts. **Apply 026 before deploying the code**: until then the group roll-up logs an error each pass (it is caught; the older roll-up and marking are not affected). The worker is **not scheduled in production today** (roadmap section 8, Phase 6 prerequisite), so no roll-up, alert or demotion happens until that is done.
- New settings, all optional (defaults are the author's; the owner sets the real ones): `HW_MONITOR_AUTODEMOTE` (true), `HW_MONITOR_MIN_ANSWERS` (30), `HW_MONITOR_MIN_GROUP_SIZE` (10), `HW_MONITOR_MAX_OVERRIDE_RATE` (0.5), `HW_MONITOR_MAX_LARGE_OVERRIDE_RATE` (0.1), `HW_MONITOR_MAX_TRANSCRIPT_FIX_RATE` (0.25), `HW_MONITOR_MAX_FAILED_JOB_RATE` (0.1), `HW_MONITOR_MAX_COST_RATIO` (1.5), `HW_MONITOR_PROJECTED_PAISE_JSON` (none). No production environment variable is changed by this work.

## Order (when the owner decides)

1. Backup (schema, as in `merge-hw-cost-runbook.md`, step 1). The `hw_eval_*`, `hw_eligibility*`, `hw_tenant_scope` and `hw_monitor_*` tables do not exist yet; `hw_question` and `hw_tenant_quota` are small.
2. Apply 021, 022, 023, 024, 025, 026 in this order, as the owning role `digiclassroom_app`, each with `ON_ERROR_STOP=1` (command as in `migration-021-022-runbook.md` step 2). 024 and 025 take a short exclusive lock on `hw_question` and `hw_tenant_quota` to add a column with a default; both tables are tiny and the columns are metadata-only on PostgreSQL 11 and later.
3. Check: `select tablename||':'||tableowner from pg_tables where tablename in ('hw_eval_run','hw_eval_gate_result','hw_eligibility','hw_eligibility_event','hw_tenant_scope','hw_monitor_group_daily','hw_monitor_alert')` shows `digiclassroom_app` for all seven; `select column_name, column_default from information_schema.columns where table_name in ('hw_question','hw_tenant_quota') and column_name in ('scheme_source','monthly_budget_paise','scope_restricted')` shows the three defaults.
4. Then, and only then, deploy the code (a push to `main`; the owner decides).

## Rollback

Reverse order: `026_hw_monitoring.down.sql`, `025_hw_tenant_control.down.sql`, `024_hw_eligibility.down.sql`, `023_hw_eval_runs_gates.down.sql`. Each down file drops what its up file added: 026 drops the monitoring tables (derived data, recomputed); 025 drops the two columns and the scope table (**the budgets and class lists are lost; export `hw_tenant_quota` and `hw_tenant_scope` first if they hold anything**); 024 drops the registry and its history (**export `hw_eligibility_event` first**; without the registry no group is eligible, so AI suggestions stop everywhere, which is the safe direction) and `hw_question.scheme_source`; 023 drops the imported runs and gate results (re-importable from the saved `report.json` files). Roll back the code first, or it will fail on the missing tables.

## Rehearsal (4 Nov 2026)

On a scratch PostgreSQL 16 built from a schema-only dump of the **production** database, with the same 12 roles and `digiclassroom_app` as database owner, migrations 019 to 022 applied:

| Step | Result |
|---|---|
| Apply 023 to 026 as `digiclassroom_app` | succeed; 118 tables (111 + 7); all seven new tables owned by `digiclassroom_app` |
| Constraints | 025: a duplicate scope entry and a negative budget are refused. 026: a day whose "how marked" counts do not add up to the answers, an override count above the suggestions shown, and a group key that is not lower case are refused. 023 and 024: as in their tests (append-only history, no `eligible` without evidence) |
| Roll back 026, 025, 024, 023 (in this order) | 111 tables again (the state after 022) |
| Re-apply 023 to 026 | succeed; the schema dump is identical to the first apply (the only difference is pg_dump's random `\restrict` token) |
| hw suite against it | 31 suites passed, 539 tests passed, 2 skipped (live OpenRouter); run serially, because the existing batch-mode tests leave a pending fake batch that a parallel suite can poll |
