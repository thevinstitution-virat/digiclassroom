#!/usr/bin/env bash
# Applies migration 038 (exam questions carry their worked model answer, its source and the question bank's permanent ID: three columns, one CHECK
# and one partial index on hw_exam_set_item) to a production database, same method as apply-migration-037.sh. Works for DigiClassroom (the defaults)
# and Study Buddy (set PG_CONTAINER, PG_DB, PG_APP_ROLE, PG_SUPER, BACKUP_DIR, MIG_DIR as for 037 there).
# Needs 037 already applied. Adds no table and drops nothing; nothing fills the new columns until a pool is imported or refreshed
# (npm run hw:exam:pool -- import|refresh).
# RUN ON THE VPS, as root.
#
#   1. copy 038_hw_exam_item_answers.sql and .down.sql to /root/hw-migrate/ (or set MIG_DIR)
#   2. ./apply-migration-038.sh            -> checks, backup, REHEARSAL on a throwaway copy; changes nothing in production
#   3. ./apply-migration-038.sh --apply    -> the same, and then applies 038 to production and checks it
#
# The file is one transaction, so a failure changes nothing; the script stops at the first failure.
# Rollback (only if needed): 038_hw_exam_item_answers.down.sql as the app role; it refuses while any question carries a model answer or an ID.
set -euo pipefail
P=${PG_CONTAINER:-sn7jgws05e0uq48u31u5ezr8}
DB=${PG_DB:-digiclassroom}
APP=${PG_APP_ROLE:-digiclassroom_app}
SUPER=${PG_SUPER:-postgres}
REH=hw_rehearsal
DIR=${MIG_DIR:-/root/hw-migrate}
BK=${BACKUP_DIR:-/root/backups/$DB}
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
F=038_hw_exam_item_answers

ok()   { echo "OK    $*"; }
fail() { echo "FAIL  $*" >&2; exit 1; }
pg()   { docker exec -i "$P" psql -U "${PGROLE:-$SUPER}" -d "$1" -v ON_ERROR_STOP=1 -q "${@:2}"; }
val()  { docker exec "$P" psql -U "$SUPER" -d "$1" -Atc "$2"; }
norm() { docker exec "$P" pg_dump -U "$SUPER" -s -d "$1" | grep -v -E '^\\(un)?restrict'; }

echo "== 0. checks (read only)"
[ -s "$DIR/$F.sql" ] && [ -s "$DIR/$F.down.sql" ] || fail "missing $DIR/$F.sql or its .down.sql"; ok "038 and its .down.sql are in $DIR"
[ "$(val $DB "select count(*) from information_schema.columns where table_name='hw_exam_set_item' and column_name='key_checked_by'")" = 1 ] || fail "037 is not applied (hw_exam_set_item.key_checked_by is missing)"; ok "037 is applied"
[ "$(val $DB "select count(*) from information_schema.columns where table_name='hw_exam_set_item' and column_name in ('model_answer','answer_source','qid')")" = 0 ] || fail "038 is already (partly) applied"; ok "038 is not applied yet"
echo "      user rows: $(val $DB 'select count(*) from "user"')   organization rows: $(val $DB 'select count(*) from organization')   tables: $(val $DB "select count(*) from pg_tables where schemaname='public'")"
BEFORE=$(val $DB "select count(*) from pg_tables where schemaname='public'")

echo "== 1. backup"
mkdir -p "$BK"; T=$(date +%Y%m%d-%H%M)
docker exec "$P" pg_dump -U "$SUPER" -s -d $DB > "$BK/schema-before-038-$T.sql"
docker exec "$P" pg_dump -U "$SUPER" -Fc -t 'hw_*' -t organization -d $DB > "$BK/hw-data-before-038-$T.dump"
[ "$(wc -l < "$BK/schema-before-038-$T.sql")" -gt 1000 ] || fail "schema backup looks empty"
[ -s "$BK/hw-data-before-038-$T.dump" ] || fail "data backup is empty"
ok "backups in $BK (schema-before-038-$T.sql, hw-data-before-038-$T.dump)"
echo "      RESTORE POINT (UTC): $(val $DB "select now() at time zone 'utc'")"

echo "== 2. rehearsal on a throwaway copy of the production schema"
docker exec "$P" psql -U "$SUPER" -d postgres -qc "drop database if exists $REH" -c "create database $REH owner \"$APP\" template template0"
docker exec -i "$P" psql -U "$SUPER" -d $REH -q -v ON_ERROR_STOP=0 < "$BK/schema-before-038-$T.sql" > /dev/null 2>&1 || true
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "the rehearsal copy does not have production's $BEFORE tables"; ok "rehearsal copy restored ($BEFORE tables)"
PGROLE=$APP pg $REH < "$DIR/$F.sql" > /dev/null || fail "rehearsal: 038 failed"
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "rehearsal: expected $BEFORE tables (production, no new table)"; ok "038 applies on the copy: $BEFORE tables"
norm $REH > /tmp/pt_up.sql
PGROLE=$APP pg $REH < "$DIR/$F.down.sql" > /dev/null || fail "rehearsal: 038 down failed"
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "rehearsal: rollback did not return to $BEFORE tables"; ok "rollback 038 returns to $BEFORE tables"
PGROLE=$APP pg $REH < "$DIR/$F.sql" > /dev/null || fail "rehearsal: re-apply failed"
norm $REH > /tmp/pt_up2.sql
diff -q /tmp/pt_up.sql /tmp/pt_up2.sql > /dev/null || fail "rehearsal: schema after re-apply differs from the first apply"; ok "re-apply gives an identical schema"
docker exec "$P" psql -U "$SUPER" -d postgres -qc "drop database $REH"; ok "throwaway database dropped"

if [ "$APPLY" != 1 ]; then echo; echo "Rehearsal passed. Production is UNCHANGED. Re-run with --apply to apply 038."; exit 0; fi

echo "== 3. apply to production (as $APP)"
PGROLE=$APP pg $DB < "$DIR/$F.sql" > /dev/null || fail "production: 038 failed (it changed nothing; stop and read the error)"; ok "applied 038"

echo "== 4. columns, trigger, counts"
[ "$(val $DB "select count(*) from information_schema.columns where table_name='hw_exam_set_item' and column_name in ('model_answer','answer_source','qid')")" = 3 ] || fail "the three new columns are not all there"; ok "model_answer, answer_source and qid are there"
[ "$(val $DB "select count(*) from pg_constraint where conname = 'hw_exam_set_item_answer_shapes'")" = 1 ] || fail "the CHECK is missing"; ok "the CHECK is present"
[ "$(val $DB "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "production table count changed"; ok "production still has $BEFORE tables"
echo; echo "Done. The new fields fill only when someone imports an exam-pool/2 file (npm run hw:exam:pool)."
