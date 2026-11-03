# Migrations 021 and 022: production sequence and rollback (Phase 3, `feat/hw-pilot-a`)

**Nothing here has been applied anywhere except scratch databases.** Both are additive (the "expand" step); nothing is renamed or dropped.

| Migration | What it does |
|---|---|
| `021_hw_eval_rater_invite.sql` | New tables `hw_eval_rater_invite` and `hw_admin_audit` (append-only: UPDATE, DELETE and TRUNCATE are refused). Replaces the body of `hw_eval_rater_check_account()`: a bare sign-up (role `student`, no institution, no class) may be a rater; a `parent`, or a student who is a member of an institution or enrolled in a class, may not. |
| `022_hw_eval_consent_pilot.sql` | Adds columns to `hw_eval_consent` (`pseudonym`, `subject_user_id`, `collected_by`, `withdrawn_by`, `withdrawn_reason`), a scope check (known source and use tokens only; `NOT VALID`, so rows written before it are not rechecked), a withdrawal check, a unique index (one live record per pseudonym and kind), and replaces `hw_eval_consent_guard()` so withdrawal (time, who, why) may be set once and nothing else may change. |

## Behaviour that changes when these are applied (with the code on `feat/hw-pilot-a`)

- **Rater account rule relaxed** (021). Before: every `student` and `parent` account was barred from being a rater. After: only a `parent`, and a student who belongs to an institution or a class. This is what lets an invited volunteer (who signs up as `student`, the default every sign-up gets) become a rater. It is a deliberate weakening of one database rule; the tests prove both sides (`eval-invites.test.ts`, `eval-migration.test.ts`).
- **Consent gates** (022 with the code): copy tasks need the volunteer's own live consent; task creation skips items without a live covering consent; the runner refuses a dataset version that holds a withdrawn person. The first two apply only while `HW_EVAL_TOOLS_ENABLED` is on, which it is not in production. The third applies to evaluation runs of dataset files and only to items that carry a consent ref (real people's work); the existing datasets hold constructed answers and carry none (checked: `heldout-1c`, `heldout-1d`, `regression-smoke`, `smallrun-a` and `smallrun-b` have no consent refs), so they run as before. The two small `browsercheck` test sets carry two refs each; a run on them needs `--consent-unchecked` (recorded in the run).
- Production has `hw_eval_consent` empty and no raters, so nothing existing is affected.

## Order (when the owner decides)

1. Backup (schema, as in `merge-hw-cost-runbook.md`, step 1; the `hw_eval_*` tables are empty today).
2. Apply 021, then 022, as the owning role `digiclassroom_app` (it owns the database and every `hw_` table):
   ```bash
   docker exec -i sn7jgws05e0uq48u31u5ezr8 psql -U digiclassroom_app -d digiclassroom -v ON_ERROR_STOP=1 < 021_hw_eval_rater_invite.sql
   docker exec -i sn7jgws05e0uq48u31u5ezr8 psql -U digiclassroom_app -d digiclassroom -v ON_ERROR_STOP=1 < 022_hw_eval_consent_pilot.sql
   ```
3. Check: `select tablename||':'||tableowner from pg_tables where tablename in ('hw_eval_rater_invite','hw_admin_audit')` shows `digiclassroom_app`; the app role has SELECT, INSERT, UPDATE, DELETE on both (neither owns a sequence).
4. Then, and only then, deploy the code (a push to `main`; the owner decides). Code before the migrations would fail loudly on the new tables, but only where the evaluator tools are on.

## Rollback

`022_hw_eval_consent_pilot.down.sql`, then `021_hw_eval_rater_invite.down.sql` (this order). 022's down drops the added columns (export them first if wanted); 021's down drops the invitation table and **the audit table with its records** (export `hw_admin_audit` first if it holds anything worth keeping) and restores the old account rule. Raters already created stay.

## Rehearsal (4 Nov 2026)

On a scratch Postgres 16 built from a schema-only dump of the **production** database, with the same 12 roles and `digiclassroom_app` as database owner, 019 and 020 already applied:

| Step | Result |
|---|---|
| Apply 021 and 022 as `digiclassroom_app` | succeed; 111 tables (109 + 2); both new tables owned by `digiclassroom_app` |
| Behaviour | bare student account accepted as a rater, institution's student and parent refused; audit table refuses UPDATE, DELETE, TRUNCATE; unknown consent scope, a second live record for a person, a withdrawal without who and why, a second withdrawal and any other change to a withdrawn record are all refused |
| Roll back 022 | schema identical to the pre-022 schema |
| Roll back 021 | schema identical to production + 019 + 020 |
| Re-apply both | succeed |
| hw suite against it | 25 suites, 459 passed, 2 skipped (live OpenRouter) |
