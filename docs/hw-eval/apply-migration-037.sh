#!/usr/bin/env bash
# Applies migration 037 (exam questions carry their textbook reference, printed sources, choice group, figures and the teacher's key check: six columns and three CHECKs on
# hw_exam_set_item, one partial index) to the DigiClassroom production database, same method as apply-migration-035.sh.
# Needs 034 and 035 already applied. Adds no table and drops nothing; nothing fills the new columns until a pool file (exam-pool/2) is imported.
# RUN ON THE VPS, as root.
#
#   1. copy 037_hw_exam_item_refs.sql and .down.sql to /root/hw-migrate/ (or set MIG_DIR)
#   2. ./apply-migration-037.sh            -> checks, backup, REHEARSAL on a throwaway copy; changes nothing in production
#   3. ./apply-migration-037.sh --apply    -> the same, and then applies 037 to production and checks it
#
# The file is one transaction, so a failure changes nothing; the script stops at the first failure.
# Rollback (only if needed): 037_hw_exam_item_refs.down.sql as digiclassroom_app; it refuses while any question carries one of the new fields.

set -euo pipefail
P=${PG_CONTAINER:-sn7jgws05e0uq48u31u5ezr8}
DB=digiclassroom
REH=hw_rehearsal
DIR=${MIG_DIR:-/root/hw-migrate}
BK=/root/backups/digiclassroom
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
F=037_hw_exam_item_refs

ok()   { echo "OK    $*"; }
fail() { echo "FAIL  $*" >&2; exit 1; }
pg()   { docker exec -i "$P" psql -U "${PGROLE:-postgres}" -d "$1" -v ON_ERROR_STOP=1 -q "${@:2}"; }
val()  { docker exec "$P" psql -U postgres -d "$1" -Atc "$2"; }
norm() { docker exec "$P" pg_dump -U postgres -s -d "$1" | grep -v -E '^\\(un)?restrict'; }

echo "== 0. checks (read only)"
[ -s "$DIR/$F.sql" ] && [ -s "$DIR/$F.down.sql" ] || fail "missing $DIR/$F.sql or its .down.sql"; ok "037 and its .down.sql are in $DIR"
[ "$(val $DB "select count(*) from information_schema.columns where table_name='hw_exam_set_item' and column_name='topic'")" = 1 ] || fail "035 is not applied (hw_exam_set_item.topic is missing)"; ok "034 and 035 are applied"
[ "$(val $DB "select count(*) from information_schema.columns where table_name='hw_exam_set_item' and column_name in ('ncert','sources','choice_group','figures','key_checked_by','key_checked_at')")" = 0 ] || fail "037 is already (partly) applied"; ok "037 is not applied yet"
echo "      user rows: $(val $DB 'select count(*) from "user"')   organization rows: $(val $DB 'select count(*) from organization')   tables: $(val $DB "select count(*) from pg_tables where schemaname='public'")"
BEFORE=$(val $DB "select count(*) from pg_tables where schemaname='public'")

echo "== 1. backup"
mkdir -p "$BK"; T=$(date +%Y%m%d-%H%M)
docker exec "$P" pg_dump -U postgres -s -d $DB > "$BK/schema-before-037-$T.sql"
docker exec "$P" pg_dump -U postgres -Fc -t 'hw_*' -t organization -d $DB > "$BK/hw-data-before-037-$T.dump"
[ "$(wc -l < "$BK/schema-before-037-$T.sql")" -gt 1000 ] || fail "schema backup looks empty"
[ -s "$BK/hw-data-before-037-$T.dump" ] || fail "data backup is empty"
ok "backups in $BK (schema-before-037-$T.sql, hw-data-before-037-$T.dump)"
echo "      RESTORE POINT (UTC): $(val $DB "select now() at time zone 'utc'")"

echo "== 2. rehearsal on a throwaway copy of the production schema"
docker exec "$P" psql -U postgres -qc "drop database if exists $REH" -c "create database $REH owner digiclassroom_app template template0"
docker exec -i "$P" psql -U postgres -d $REH -q -v ON_ERROR_STOP=0 < "$BK/schema-before-037-$T.sql" > /dev/null 2>&1 || true
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "the rehearsal copy does not have production's $BEFORE tables"; ok "rehearsal copy restored ($BEFORE tables)"
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.sql" > /dev/null || fail "rehearsal: 037 failed"
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "rehearsal: expected $BEFORE tables (production, no new table)"; ok "037 applies on the copy: $BEFORE tables"
norm $REH > /tmp/pt_up.sql
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.down.sql" > /dev/null || fail "rehearsal: 037 down failed"
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "rehearsal: rollback did not return to $BEFORE tables"; ok "rollback 037 returns to $BEFORE tables"
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.sql" > /dev/null || fail "rehearsal: re-apply failed"
norm $REH > /tmp/pt_up2.sql
diff -q /tmp/pt_up.sql /tmp/pt_up2.sql > /dev/null || fail "rehearsal: schema after re-apply differs from the first apply"; ok "re-apply gives an identical schema"
docker exec "$P" psql -U postgres -qc "drop database $REH"; ok "throwaway database dropped"

if [ "$APPLY" != 1 ]; then echo; echo "Rehearsal passed. Production is UNCHANGED. Re-run with --apply to apply 037."; exit 0; fi

echo "== 3. apply to production (as digiclassroom_app)"
PGROLE=digiclassroom_app pg $DB < "$DIR/$F.sql" > /dev/null || fail "production: 037 failed (it changed nothing; stop and read the error)"; ok "applied 037"

echo "== 4. columns, trigger, counts"
[ "$(val $DB "select count(*) from information_schema.columns where table_name='hw_exam_set_item' and column_name in ('ncert','sources','choice_group','figures','key_checked_by','key_checked_at')")" = 6 ] || fail "the six new columns are not all there"; ok "ncert, sources, choice_group, figures and the key-check columns are there"
[ "$(val $DB "select count(*) from pg_constraint where conname in ('hw_exam_set_item_ref_shapes','hw_exam_set_item_figure_keys','hw_exam_set_item_key_check_named')")" = 3 ] || fail "the three CHECKs are missing"; ok "the three CHECKs are present"
[ "$(val $DB "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "production table count changed"; ok "production still has $BEFORE tables"
echo; echo "Done. The new fields fill only when someone imports an exam-pool/2 file (npm run hw:exam:pool)."
