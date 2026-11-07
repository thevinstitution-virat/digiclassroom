#!/usr/bin/env bash
# Applies migration 032 (board-paper bank: hw_bank_paper, hw_bank_question, hw_bank_figure, hw_bank_import) to the DigiClassroom production database, same method as apply-migration-031.sh.
# Needs 031 already applied. Adds FOUR new tables and alters nothing; nothing reads or writes them until a paper is imported (scripts/hw-paper-import.ts).
# RUN ON THE VPS, as root.
#
#   1. copy 032_hw_bank.sql and .down.sql to /root/hw-migrate/ (or set MIG_DIR)
#   2. ./apply-migration-032.sh            -> checks, backup, REHEARSAL on a throwaway copy; changes nothing in production
#   3. ./apply-migration-032.sh --apply    -> the same, and then applies 032 to production and checks ownership
#
# The file is one transaction, so a failure changes nothing; the script stops at the first failure.
# Rollback (only if needed): 032_hw_bank.down.sql as digiclassroom_app. It drops the four bank tables and their two guard functions, and nothing else.

set -euo pipefail
P=${PG_CONTAINER:-sn7jgws05e0uq48u31u5ezr8}
DB=digiclassroom
REH=hw_rehearsal
DIR=${MIG_DIR:-/root/hw-migrate}
BK=/root/backups/digiclassroom
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
F=032_hw_bank

ok()   { echo "OK    $*"; }
fail() { echo "FAIL  $*" >&2; exit 1; }
pg()   { docker exec -i "$P" psql -U "${PGROLE:-postgres}" -d "$1" -v ON_ERROR_STOP=1 -q "${@:2}"; }
val()  { docker exec "$P" psql -U postgres -d "$1" -Atc "$2"; }
norm() { docker exec "$P" pg_dump -U postgres -s -d "$1" | grep -v -E '^\\(un)?restrict'; }

echo "== 0. checks (read only)"
[ -s "$DIR/$F.sql" ] && [ -s "$DIR/$F.down.sql" ] || fail "missing $DIR/$F.sql or its .down.sql"; ok "032 and its .down.sql are in $DIR"
[ "$(val $DB "select to_regclass('hw_practice_trial') is not null")" = t ] || fail "031 is not applied (hw_practice_trial is missing)"; ok "031 (and so 019 to 030) is applied"
[ "$(val $DB "select count(*) from pg_tables where tablename like 'hw_bank_%'")" = 0 ] || fail "032 is already (partly) applied"; ok "032 is not applied yet"
echo "      user rows: $(val $DB 'select count(*) from "user"')   organization rows: $(val $DB 'select count(*) from organization')   tables: $(val $DB "select count(*) from pg_tables where schemaname='public'")"
BEFORE=$(val $DB "select count(*) from pg_tables where schemaname='public'")

echo "== 1. backup"
mkdir -p "$BK"; T=$(date +%Y%m%d-%H%M)
docker exec "$P" pg_dump -U postgres -s -d $DB > "$BK/schema-before-032-$T.sql"
docker exec "$P" pg_dump -U postgres -Fc -t 'hw_*' -t organization -d $DB > "$BK/hw-data-before-032-$T.dump"
[ "$(wc -l < "$BK/schema-before-032-$T.sql")" -gt 1000 ] || fail "schema backup looks empty"
[ -s "$BK/hw-data-before-032-$T.dump" ] || fail "data backup is empty"
ok "backups in $BK (schema-before-032-$T.sql, hw-data-before-032-$T.dump)"
echo "      RESTORE POINT (UTC): $(val $DB "select now() at time zone 'utc'")"

echo "== 2. rehearsal on a throwaway copy of the production schema"
docker exec "$P" psql -U postgres -qc "drop database if exists $REH" -c "create database $REH owner digiclassroom_app template template0"
docker exec -i "$P" psql -U postgres -d $REH -q -v ON_ERROR_STOP=0 < "$BK/schema-before-032-$T.sql" > /dev/null 2>&1 || true
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "the rehearsal copy does not have production's $BEFORE tables"; ok "rehearsal copy restored ($BEFORE tables)"
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.sql" > /dev/null || fail "rehearsal: 032 failed"
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$((BEFORE + 4))" ] || fail "rehearsal: expected $((BEFORE + 4)) tables (production + 4)"; ok "032 applies on the copy: $((BEFORE + 4)) tables"
norm $REH > /tmp/pt_up.sql
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.down.sql" > /dev/null || fail "rehearsal: 032 down failed"
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "rehearsal: rollback did not return to $BEFORE tables"; ok "rollback 032 returns to $BEFORE tables"
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.sql" > /dev/null || fail "rehearsal: re-apply failed"
norm $REH > /tmp/pt_up2.sql
diff -q /tmp/pt_up.sql /tmp/pt_up2.sql > /dev/null || fail "rehearsal: schema after re-apply differs from the first apply"; ok "re-apply gives an identical schema"
docker exec "$P" psql -U postgres -qc "drop database $REH"; ok "throwaway database dropped"

if [ "$APPLY" != 1 ]; then echo; echo "Rehearsal passed. Production is UNCHANGED. Re-run with --apply to apply 032."; exit 0; fi

echo "== 3. apply to production (as digiclassroom_app)"
PGROLE=digiclassroom_app pg $DB < "$DIR/$F.sql" > /dev/null || fail "production: 032 failed (it changed nothing; stop and read the error)"; ok "applied 032"

echo "== 4. ownership, constraints, counts"
[ "$(val $DB "select count(*) from pg_tables where tablename like 'hw_bank_%' and tableowner='digiclassroom_app'")" = 4 ] || fail "the four hw_bank tables are not all owned by digiclassroom_app: ALTER TABLE ... OWNER TO digiclassroom_app"; ok "the four hw_bank tables are owned by digiclassroom_app"
[ "$(val $DB "select count(*) from pg_trigger where tgname in ('hw_bank_question_guard','hw_bank_import_append_only') and not tgisinternal")" = 2 ] || fail "the two guard triggers are not both present"; ok "the guard triggers are present"
[ "$(val $DB "select count(*) from pg_tables where schemaname='public'")" = "$((BEFORE + 4))" ] || fail "production table count is not $((BEFORE + 4))"; ok "production now has $((BEFORE + 4)) tables"
echo "      bank rows so far: $(val $DB 'select count(*) from hw_bank_question') (expected 0)"
echo; echo "Done. Nothing reads the tables yet; a paper arrives only when someone runs the importer (npm run hw:paper:import)."
