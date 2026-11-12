#!/usr/bin/env bash
# Applies migration 034 (exam packages: hw_exam_package, _set, _set_item, _entitlement, _attempt, _page, _report) to the DigiClassroom production database, same method as apply-migration-032.sh.
# Needs 032 and 033 already applied. Adds SEVEN new tables and alters nothing; nothing writes them until a super admin builds a package, and learners
# see nothing while HW_EXAMS_ENABLED is off (the default).
# RUN ON THE VPS, as root.
#
#   1. copy 034_hw_exams.sql and .down.sql to /root/hw-migrate/ (or set MIG_DIR)
#   2. ./apply-migration-034.sh            -> checks, backup, REHEARSAL on a throwaway copy; changes nothing in production
#   3. ./apply-migration-034.sh --apply    -> the same, and then applies 034 to production and checks ownership
#
# The file is one transaction, so a failure changes nothing; the script stops at the first failure.
# Rollback (only if needed): 034_hw_exams.down.sql as digiclassroom_app. It drops the seven exam tables and their guard functions; the hw_assignment rows
# that attempts created stay (they are ordinary assignments).

set -euo pipefail
P=${PG_CONTAINER:-sn7jgws05e0uq48u31u5ezr8}
DB=digiclassroom
REH=hw_rehearsal
DIR=${MIG_DIR:-/root/hw-migrate}
BK=/root/backups/digiclassroom
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
F=034_hw_exams

ok()   { echo "OK    $*"; }
fail() { echo "FAIL  $*" >&2; exit 1; }
pg()   { docker exec -i "$P" psql -U "${PGROLE:-postgres}" -d "$1" -v ON_ERROR_STOP=1 -q "${@:2}"; }
val()  { docker exec "$P" psql -U postgres -d "$1" -Atc "$2"; }
norm() { docker exec "$P" pg_dump -U postgres -s -d "$1" | grep -v -E '^\\(un)?restrict'; }

echo "== 0. checks (read only)"
[ -s "$DIR/$F.sql" ] && [ -s "$DIR/$F.down.sql" ] || fail "missing $DIR/$F.sql or its .down.sql"; ok "034 and its .down.sql are in $DIR"
[ "$(val $DB "select to_regclass('hw_bank_review') is not null")" = t ] || fail "033 is not applied (hw_bank_review is missing)"; ok "033 (and so 032) is applied"
[ "$(val $DB "select count(*) from pg_tables where tablename like 'hw_exam_%'")" = 0 ] || fail "034 is already (partly) applied"; ok "034 is not applied yet"
echo "      user rows: $(val $DB 'select count(*) from "user"')   organization rows: $(val $DB 'select count(*) from organization')   tables: $(val $DB "select count(*) from pg_tables where schemaname='public'")"
BEFORE=$(val $DB "select count(*) from pg_tables where schemaname='public'")

echo "== 1. backup"
mkdir -p "$BK"; T=$(date +%Y%m%d-%H%M)
docker exec "$P" pg_dump -U postgres -s -d $DB > "$BK/schema-before-034-$T.sql"
docker exec "$P" pg_dump -U postgres -Fc -t 'hw_*' -t organization -d $DB > "$BK/hw-data-before-034-$T.dump"
[ "$(wc -l < "$BK/schema-before-034-$T.sql")" -gt 1000 ] || fail "schema backup looks empty"
[ -s "$BK/hw-data-before-034-$T.dump" ] || fail "data backup is empty"
ok "backups in $BK (schema-before-034-$T.sql, hw-data-before-034-$T.dump)"
echo "      RESTORE POINT (UTC): $(val $DB "select now() at time zone 'utc'")"

echo "== 2. rehearsal on a throwaway copy of the production schema"
docker exec "$P" psql -U postgres -qc "drop database if exists $REH" -c "create database $REH owner digiclassroom_app template template0"
docker exec -i "$P" psql -U postgres -d $REH -q -v ON_ERROR_STOP=0 < "$BK/schema-before-034-$T.sql" > /dev/null 2>&1 || true
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "the rehearsal copy does not have production's $BEFORE tables"; ok "rehearsal copy restored ($BEFORE tables)"
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.sql" > /dev/null || fail "rehearsal: 034 failed"
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$((BEFORE + 7))" ] || fail "rehearsal: expected $((BEFORE + 7)) tables (production + 7)"; ok "034 applies on the copy: $((BEFORE + 7)) tables"
norm $REH > /tmp/pt_up.sql
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.down.sql" > /dev/null || fail "rehearsal: 034 down failed"
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "rehearsal: rollback did not return to $BEFORE tables"; ok "rollback 034 returns to $BEFORE tables"
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.sql" > /dev/null || fail "rehearsal: re-apply failed"
norm $REH > /tmp/pt_up2.sql
diff -q /tmp/pt_up.sql /tmp/pt_up2.sql > /dev/null || fail "rehearsal: schema after re-apply differs from the first apply"; ok "re-apply gives an identical schema"
docker exec "$P" psql -U postgres -qc "drop database $REH"; ok "throwaway database dropped"

if [ "$APPLY" != 1 ]; then echo; echo "Rehearsal passed. Production is UNCHANGED. Re-run with --apply to apply 034."; exit 0; fi

echo "== 3. apply to production (as digiclassroom_app)"
PGROLE=digiclassroom_app pg $DB < "$DIR/$F.sql" > /dev/null || fail "production: 034 failed (it changed nothing; stop and read the error)"; ok "applied 034"

echo "== 4. ownership, triggers, counts"
[ "$(val $DB "select count(*) from pg_tables where tablename like 'hw_exam_%' and tableowner='digiclassroom_app'")" = 7 ] || fail "the seven hw_exam tables are not all owned by digiclassroom_app: ALTER TABLE ... OWNER TO digiclassroom_app"; ok "the seven hw_exam tables are owned by digiclassroom_app"
[ "$(val $DB "select count(*) from pg_trigger where tgname like 'hw_exam_%' and not tgisinternal")" = 12 ] || fail "the twelve hw_exam triggers are not all present"; ok "the twelve guard and touch triggers are present"
[ "$(val $DB "select count(*) from pg_tables where schemaname='public'")" = "$((BEFORE + 7))" ] || fail "production table count is not $((BEFORE + 7))"; ok "production now has $((BEFORE + 7)) tables"
echo "      packages so far: $(val $DB 'select count(*) from hw_exam_package') (expected 0)"
echo; echo "Done. Learners see nothing until HW_EXAMS_ENABLED=true; the super admin builder (Exam Packages) works now."
