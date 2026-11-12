#!/usr/bin/env bash
# Applies migration 035 (question pools and learners' practice tests: two columns on hw_exam_set, one on hw_exam_set_item, a wider kind CHECK,
# and a guard trigger on hw_exam_attempt) to the DigiClassroom production database, same method as apply-migration-034.sh.
# Needs 034 already applied. Adds no table and drops nothing; nothing uses the new kinds until a pool is imported (npm run hw:exam:pool).
# RUN ON THE VPS, as root.
#
#   1. copy 035_hw_exam_practice.sql and .down.sql to /root/hw-migrate/ (or set MIG_DIR)
#   2. ./apply-migration-035.sh            -> checks, backup, REHEARSAL on a throwaway copy; changes nothing in production
#   3. ./apply-migration-035.sh --apply    -> the same, and then applies 035 to production and checks it
#
# The file is one transaction, so a failure changes nothing; the script stops at the first failure.
# Rollback (only if needed): 035_hw_exam_practice.down.sql as digiclassroom_app; it refuses while any pool or practice set exists.

set -euo pipefail
P=${PG_CONTAINER:-sn7jgws05e0uq48u31u5ezr8}
DB=digiclassroom
REH=hw_rehearsal
DIR=${MIG_DIR:-/root/hw-migrate}
BK=/root/backups/digiclassroom
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
F=035_hw_exam_practice

ok()   { echo "OK    $*"; }
fail() { echo "FAIL  $*" >&2; exit 1; }
pg()   { docker exec -i "$P" psql -U "${PGROLE:-postgres}" -d "$1" -v ON_ERROR_STOP=1 -q "${@:2}"; }
val()  { docker exec "$P" psql -U postgres -d "$1" -Atc "$2"; }
norm() { docker exec "$P" pg_dump -U postgres -s -d "$1" | grep -v -E '^\\(un)?restrict'; }

echo "== 0. checks (read only)"
[ -s "$DIR/$F.sql" ] && [ -s "$DIR/$F.down.sql" ] || fail "missing $DIR/$F.sql or its .down.sql"; ok "035 and its .down.sql are in $DIR"
[ "$(val $DB "select to_regclass('hw_exam_package') is not null")" = t ] || fail "034 is not applied (hw_exam_package is missing)"; ok "034 is applied"
[ "$(val $DB "select count(*) from information_schema.columns where table_name='hw_exam_set' and column_name='owner_user_id'")" = 0 ] || fail "035 is already (partly) applied"; ok "035 is not applied yet"
echo "      user rows: $(val $DB 'select count(*) from "user"')   organization rows: $(val $DB 'select count(*) from organization')   tables: $(val $DB "select count(*) from pg_tables where schemaname='public'")"
BEFORE=$(val $DB "select count(*) from pg_tables where schemaname='public'")

echo "== 1. backup"
mkdir -p "$BK"; T=$(date +%Y%m%d-%H%M)
docker exec "$P" pg_dump -U postgres -s -d $DB > "$BK/schema-before-035-$T.sql"
docker exec "$P" pg_dump -U postgres -Fc -t 'hw_*' -t organization -d $DB > "$BK/hw-data-before-035-$T.dump"
[ "$(wc -l < "$BK/schema-before-035-$T.sql")" -gt 1000 ] || fail "schema backup looks empty"
[ -s "$BK/hw-data-before-035-$T.dump" ] || fail "data backup is empty"
ok "backups in $BK (schema-before-035-$T.sql, hw-data-before-035-$T.dump)"
echo "      RESTORE POINT (UTC): $(val $DB "select now() at time zone 'utc'")"

echo "== 2. rehearsal on a throwaway copy of the production schema"
docker exec "$P" psql -U postgres -qc "drop database if exists $REH" -c "create database $REH owner digiclassroom_app template template0"
docker exec -i "$P" psql -U postgres -d $REH -q -v ON_ERROR_STOP=0 < "$BK/schema-before-035-$T.sql" > /dev/null 2>&1 || true
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "the rehearsal copy does not have production's $BEFORE tables"; ok "rehearsal copy restored ($BEFORE tables)"
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.sql" > /dev/null || fail "rehearsal: 035 failed"
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "rehearsal: expected $BEFORE tables (production, no new table)"; ok "035 applies on the copy: $BEFORE tables"
norm $REH > /tmp/pt_up.sql
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.down.sql" > /dev/null || fail "rehearsal: 035 down failed"
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "rehearsal: rollback did not return to $BEFORE tables"; ok "rollback 035 returns to $BEFORE tables"
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.sql" > /dev/null || fail "rehearsal: re-apply failed"
norm $REH > /tmp/pt_up2.sql
diff -q /tmp/pt_up.sql /tmp/pt_up2.sql > /dev/null || fail "rehearsal: schema after re-apply differs from the first apply"; ok "re-apply gives an identical schema"
docker exec "$P" psql -U postgres -qc "drop database $REH"; ok "throwaway database dropped"

if [ "$APPLY" != 1 ]; then echo; echo "Rehearsal passed. Production is UNCHANGED. Re-run with --apply to apply 035."; exit 0; fi

echo "== 3. apply to production (as digiclassroom_app)"
PGROLE=digiclassroom_app pg $DB < "$DIR/$F.sql" > /dev/null || fail "production: 035 failed (it changed nothing; stop and read the error)"; ok "applied 035"

echo "== 4. columns, trigger, counts"
[ "$(val $DB "select count(*) from information_schema.columns where (table_name='hw_exam_set' and column_name in ('owner_user_id','pool_set_id')) or (table_name='hw_exam_set_item' and column_name='topic')")" = 3 ] || fail "the three new columns are not all there"; ok "owner_user_id, pool_set_id and topic are there"
[ "$(val $DB "select count(*) from pg_trigger where tgname='hw_exam_attempt_practice' and not tgisinternal")" = 1 ] || fail "the practice guard trigger is missing"; ok "the practice guard trigger is present"
[ "$(val $DB "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "production table count changed"; ok "production still has $BEFORE tables"
echo; echo "Done. Pools arrive only when someone runs the pool importer (npm run hw:exam:pool)."
