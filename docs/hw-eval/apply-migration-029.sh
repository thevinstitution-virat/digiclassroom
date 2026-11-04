#!/usr/bin/env bash
# Applies migration 029 (the regression-results table) to the DigiClassroom production database, same method as apply-migrations-021-027.sh (already run).
# Needs 023 to 028 already applied. Adds ONE table (imported regression results); nothing reads it until a result is imported.
# RUN ON THE VPS, as root, by the owner. Nothing here has been run yet.
# (Copy 029_hw_eval_regression.sql and .down.sql to the migrations folder on the server first.)
#
#   1. copy the 14 files packages/core/src/lib/db/migrations/02[1-7]_*.sql to /root/hw-migrate/ (or set MIG_DIR)
#   2. ./apply-migration-029.sh            -> checks, backup, REHEARSAL on a throwaway copy; changes nothing in production
#   3. read the output; if every line says OK, then
#      ./apply-migration-029.sh --apply    -> the same, and then applies 029 to production and checks ownership
#
# Each migration file is one transaction, so a file that fails changes nothing; the script stops at the first failure.
# Rollback (only if needed, after reverting the code): the .down.sql files, 029 down, as digiclassroom_app.

set -euo pipefail
P=${PG_CONTAINER:-sn7jgws05e0uq48u31u5ezr8}
DB=digiclassroom
REH=hw_rehearsal
DIR=${MIG_DIR:-/root/hw-migrate}
BK=/root/backups/digiclassroom
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
FILES="029_hw_eval_regression"

ok()   { echo "OK    $*"; }
fail() { echo "FAIL  $*" >&2; exit 1; }
pg()   { docker exec -i "$P" psql -U "${PGROLE:-postgres}" -d "$1" -v ON_ERROR_STOP=1 -q "${@:2}"; }
val()  { docker exec "$P" psql -U postgres -d "$1" -Atc "$2"; }
norm() { docker exec "$P" pg_dump -U postgres -s -d "$1" | grep -v -E '^\\(un)?restrict'; }

echo "== 0. checks (read only)"
for f in $FILES; do [ -s "$DIR/$f.sql" ] && [ -s "$DIR/$f.down.sql" ] || fail "missing $DIR/$f.sql or its .down.sql"; done; ok "029 and its .down.sql are in $DIR"
[ "$(val $DB "select count(*) from pg_tables where tablename in ('hw_ai_grade_source','hw_shared_key','hw_instruction_flag','hw_question_key','hw_guardian_link','hw_eval_gate_result')")" = 6 ] || fail "019 to 028 are not all applied"; ok "019 to 028 are applied"
[ "$(val $DB "select to_regclass('hw_eval_regression') is null")" = t ] || fail "029 already applied"; ok "029 is not applied yet"
echo "      hw_tenant_quota rows: $(val $DB 'select count(*) from hw_tenant_quota')   hw_answer rows: $(val $DB 'select count(*) from hw_answer')   tables: $(val $DB "select count(*) from pg_tables where schemaname='public'")"
BEFORE=$(val $DB "select count(*) from pg_tables where schemaname='public'")

echo "== 1. backup"
mkdir -p "$BK"; T=$(date +%Y%m%d-%H%M)
docker exec "$P" pg_dump -U postgres -s -d $DB > "$BK/schema-before-029-$T.sql"
docker exec "$P" pg_dump -U postgres -Fc -t 'hw_*' -t organization -d $DB > "$BK/hw-data-before-029-$T.dump"
[ "$(wc -l < "$BK/schema-before-029-$T.sql")" -gt 1000 ] || fail "schema backup looks empty"
[ -s "$BK/hw-data-before-029-$T.dump" ] || fail "data backup is empty"
ok "backups in $BK (schema-before-029-$T.sql, hw-data-before-029-$T.dump)"
echo "      RESTORE POINT (UTC): $(val $DB "select now() at time zone 'utc'")   <- write this in the roadmap log"

echo "== 2. rehearsal on a throwaway copy of the production schema"
docker exec "$P" psql -U postgres -qc "drop database if exists $REH" -c "create database $REH owner digiclassroom_app template template0"
docker exec -i "$P" psql -U postgres -d $REH -q -v ON_ERROR_STOP=0 < "$BK/schema-before-029-$T.sql" > /dev/null 2>&1 || true
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "the rehearsal copy does not have production's $BEFORE tables"; ok "rehearsal copy restored ($BEFORE tables)"
for f in $FILES; do PGROLE=digiclassroom_app pg $REH < "$DIR/$f.sql" > /dev/null || fail "rehearsal: $f failed"; done
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$((BEFORE + 1))" ] || fail "rehearsal: expected $((BEFORE + 1)) tables (production + 1)"; ok "029 applies on the copy: $((BEFORE + 1)) tables"
norm $REH > /tmp/hw_up.sql
for f in 029_hw_eval_regression; do PGROLE=digiclassroom_app pg $REH < "$DIR/$f.down.sql" > /dev/null || fail "rehearsal: $f down failed"; done
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "rehearsal: rollback did not return to $BEFORE tables"; ok "rollback 029 returns to $BEFORE tables"
for f in $FILES; do PGROLE=digiclassroom_app pg $REH < "$DIR/$f.sql" > /dev/null || fail "rehearsal: re-apply $f failed"; done
norm $REH > /tmp/hw_up2.sql
diff -q /tmp/hw_up.sql /tmp/hw_up2.sql > /dev/null || fail "rehearsal: schema after re-apply differs from the first apply"; ok "re-apply gives an identical schema"
docker exec "$P" psql -U postgres -qc "drop database $REH"; ok "throwaway database dropped"

if [ "$APPLY" != 1 ]; then echo; echo "Rehearsal passed. Production is UNCHANGED. Re-run with --apply to apply 029."; exit 0; fi

echo "== 3. apply to production (as digiclassroom_app)"
for f in $FILES; do PGROLE=digiclassroom_app pg $DB < "$DIR/$f.sql" > /dev/null || fail "production: $f failed (it changed nothing; stop and read the error)"; ok "applied $f"; done

echo "== 4. ownership, grants, defaults"
OWN=$(val $DB "select count(*) from pg_tables where tablename='hw_eval_regression' and tableowner='digiclassroom_app'")
[ "$OWN" = 1 ] || fail "hw_eval_regression is not owned by digiclassroom_app: ALTER TABLE hw_eval_regression OWNER TO digiclassroom_app"; ok "hw_eval_regression is owned by digiclassroom_app"
[ "$(val $DB "select count(*) from pg_tables where schemaname='public'")" = "$((BEFORE + 1))" ] || fail "production table count is not $((BEFORE + 1))"; ok "production now has $((BEFORE + 1)) tables"
echo "      rows so far: $(val $DB 'select count(*) from hw_eval_regression') (expected 0)"
echo; echo "Done. Nothing reads the table until a regression result is imported."
