#!/usr/bin/env bash
# Applies migrations 021 to 027 to the DigiClassroom production database, following docs/hw-eval/merge-pilot-ab-runbook.md steps 0 to 4.
# RUN ON THE VPS, as root, by the owner. Nothing here has been run yet.
#
#   1. copy the 14 files packages/core/src/lib/db/migrations/02[1-7]_*.sql to /root/hw-migrate/ (or set MIG_DIR)
#   2. ./apply-migrations-021-027.sh            -> checks, backup, REHEARSAL on a throwaway copy; changes nothing in production
#   3. read the output; if every line says OK, then
#      ./apply-migrations-021-027.sh --apply    -> the same, and then applies 021 to 027 to production and checks ownership
#
# Each migration file is one transaction, so a file that fails changes nothing; the script stops at the first failure.
# Rollback (only if needed, after reverting the code): the .down.sql files, 027 down to 021, as digiclassroom_app.

set -euo pipefail
P=${PG_CONTAINER:-sn7jgws05e0uq48u31u5ezr8}
DB=digiclassroom
REH=hw_rehearsal
DIR=${MIG_DIR:-/root/hw-migrate}
BK=/root/backups/digiclassroom
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
FILES="021_hw_eval_rater_invite 022_hw_eval_consent_pilot 023_hw_eval_runs_gates 024_hw_eligibility 025_hw_tenant_control 026_hw_monitoring 027_hw_question_keys"

ok()   { echo "OK    $*"; }
fail() { echo "FAIL  $*" >&2; exit 1; }
pg()   { docker exec -i "$P" psql -U "${PGROLE:-postgres}" -d "$1" -v ON_ERROR_STOP=1 -q "${@:2}"; }
val()  { docker exec "$P" psql -U postgres -d "$1" -Atc "$2"; }
norm() { docker exec "$P" pg_dump -U postgres -s -d "$1" | grep -v -E '^\\(un)?restrict'; }

echo "== 0. checks (read only)"
for f in $FILES; do [ -s "$DIR/$f.sql" ] && [ -s "$DIR/$f.down.sql" ] || fail "missing $DIR/$f.sql or its .down.sql"; done; ok "all 14 migration files are in $DIR"
[ "$(val $DB "select count(*) from pg_tables where tablename in ('hw_ai_grade_source','hw_shared_key','hw_instruction_flag')")" = 3 ] || fail "019/020 are not applied"; ok "019 and 020 are applied"
[ "$(val $DB "select to_regclass('hw_admin_audit') is null and to_regclass('hw_eval_rater_invite') is null and to_regclass('hw_question_key') is null")" = t ] || fail "021 or 027 already (partly) applied: stop and read the database"; ok "021 to 027 are not applied yet"
[ "$(val $DB "select count(*) from pg_constraint where conrelid='hw_rubric_item'::regclass and conname='hw_rubric_item_source_check'")" = 1 ] || fail "hw_rubric_item_source_check not found: migration 027 would fail"; ok "hw_rubric_item_source_check exists (027 drops it by name)"
echo "      hw_tenant_quota rows: $(val $DB 'select count(*) from hw_tenant_quota')   hw_answer rows: $(val $DB 'select count(*) from hw_answer')   tables: $(val $DB "select count(*) from pg_tables where schemaname='public'")"
BEFORE=$(val $DB "select count(*) from pg_tables where schemaname='public'")

echo "== 1. backup"
mkdir -p "$BK"; T=$(date +%Y%m%d-%H%M)
docker exec "$P" pg_dump -U postgres -s -d $DB > "$BK/schema-before-021-027-$T.sql"
docker exec "$P" pg_dump -U postgres -Fc -t 'hw_*' -t organization -d $DB > "$BK/hw-data-before-021-027-$T.dump"
[ "$(wc -l < "$BK/schema-before-021-027-$T.sql")" -gt 1000 ] || fail "schema backup looks empty"
[ -s "$BK/hw-data-before-021-027-$T.dump" ] || fail "data backup is empty"
ok "backups in $BK (schema-before-021-027-$T.sql, hw-data-before-021-027-$T.dump)"
echo "      RESTORE POINT (UTC): $(val $DB "select now() at time zone 'utc'")   <- write this in the roadmap log"

echo "== 2. rehearsal on a throwaway copy of the production schema"
docker exec "$P" psql -U postgres -qc "drop database if exists $REH" -c "create database $REH owner digiclassroom_app template template0"
docker exec -i "$P" psql -U postgres -d $REH -q -v ON_ERROR_STOP=0 < "$BK/schema-before-021-027-$T.sql" > /dev/null 2>&1 || true
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "the rehearsal copy does not have production's $BEFORE tables"; ok "rehearsal copy restored ($BEFORE tables)"
for f in $FILES; do PGROLE=digiclassroom_app pg $REH < "$DIR/$f.sql" > /dev/null || fail "rehearsal: $f failed"; done
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$((BEFORE + 11))" ] || fail "rehearsal: expected $((BEFORE + 11)) tables (production + 11)"; ok "021 to 027 apply on the copy: $((BEFORE + 11)) tables"
norm $REH > /tmp/hw_up.sql
for f in 027_hw_question_keys 026_hw_monitoring 025_hw_tenant_control 024_hw_eligibility 023_hw_eval_runs_gates 022_hw_eval_consent_pilot 021_hw_eval_rater_invite; do PGROLE=digiclassroom_app pg $REH < "$DIR/$f.down.sql" > /dev/null || fail "rehearsal: $f down failed"; done
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "rehearsal: rollback did not return to $BEFORE tables"; ok "rollback 027 to 021 returns to $BEFORE tables"
for f in $FILES; do PGROLE=digiclassroom_app pg $REH < "$DIR/$f.sql" > /dev/null || fail "rehearsal: re-apply $f failed"; done
norm $REH > /tmp/hw_up2.sql
diff -q /tmp/hw_up.sql /tmp/hw_up2.sql > /dev/null || fail "rehearsal: schema after re-apply differs from the first apply"; ok "re-apply gives an identical schema"
docker exec "$P" psql -U postgres -qc "drop database $REH"; ok "throwaway database dropped"

if [ "$APPLY" != 1 ]; then echo; echo "Rehearsal passed. Production is UNCHANGED. Re-run with --apply to apply 021 to 027."; exit 0; fi

echo "== 3. apply to production (as digiclassroom_app)"
for f in $FILES; do PGROLE=digiclassroom_app pg $DB < "$DIR/$f.sql" > /dev/null || fail "production: $f failed (it changed nothing; stop and read the error)"; ok "applied $f"; done

echo "== 4. ownership, grants, defaults"
OWN=$(val $DB "select count(*) from pg_tables where tablename in ('hw_eval_rater_invite','hw_admin_audit','hw_eval_run','hw_eval_gate_result','hw_eligibility','hw_eligibility_event','hw_tenant_scope','hw_monitor_group_daily','hw_monitor_alert','hw_question_key','hw_ai_grade_scheme') and tableowner='digiclassroom_app'")
[ "$OWN" = 11 ] || fail "only $OWN of 11 new tables are owned by digiclassroom_app: ALTER TABLE ... OWNER TO digiclassroom_app for the rest"; ok "all 11 new tables are owned by digiclassroom_app"
[ "$(val $DB "select count(*) from information_schema.columns where (table_name,column_name) in (('hw_question','scheme_source'),('hw_question','rubric_mode'),('hw_question','origin'),('hw_tenant_quota','monthly_budget_paise'),('hw_tenant_quota','scope_restricted'),('hw_ai_usage_monthly','key_cost_paise')) and column_default is not null")" = 6 ] || fail "a new column is missing its default"; ok "the six new columns have their defaults"
[ "$(val $DB "select count(*) from pg_tables where schemaname='public'")" = "$((BEFORE + 11))" ] || fail "production table count is not $((BEFORE + 11))"; ok "production now has $((BEFORE + 11)) tables"
echo "      still off: hw_tenant_quota rows = $(val $DB 'select count(*) from hw_tenant_quota'), hw_eligibility rows = $(val $DB 'select count(*) from hw_eligibility')"
echo; echo "Done. Now run the runbook's step 6 checks (containers healthy, flags off, 401 from the job endpoint, clean logs)."
