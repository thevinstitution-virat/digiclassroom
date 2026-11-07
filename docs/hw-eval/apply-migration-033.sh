#!/usr/bin/env bash
# Applies migration 033 (board-paper bank review: hw_bank_review log + the paper guard) to the DigiClassroom production database, same method as apply-migration-032.sh.
# Needs 032 already applied. Adds ONE new table and two guard functions; alters nothing that exists. Nothing reads or writes the table until a person's check is recorded (scripts/hw-paper-review.ts).
# RUN ON THE VPS, as root.
#
#   1. copy 033_hw_bank_review.sql and .down.sql to /root/hw-migrate/ (or set MIG_DIR)
#   2. ./apply-migration-033.sh            -> checks, backup, REHEARSAL on a throwaway copy; changes nothing in production
#   3. ./apply-migration-033.sh --apply    -> the same, and then applies 033 to production and checks ownership
#
# The file is one transaction, so a failure changes nothing; the script stops at the first failure.
# Rollback (only if needed): 033_hw_bank_review.down.sql as digiclassroom_app. It drops the review table, the paper guard and the log's guard function, and nothing else; rows keep their status and checker.

set -euo pipefail
P=${PG_CONTAINER:-sn7jgws05e0uq48u31u5ezr8}
DB=digiclassroom
REH=hw_rehearsal
DIR=${MIG_DIR:-/root/hw-migrate}
BK=/root/backups/digiclassroom
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
F=033_hw_bank_review

ok()   { echo "OK    $*"; }
fail() { echo "FAIL  $*" >&2; exit 1; }
pg()   { docker exec -i "$P" psql -U "${PGROLE:-postgres}" -d "$1" -v ON_ERROR_STOP=1 -q "${@:2}"; }
val()  { docker exec "$P" psql -U postgres -d "$1" -Atc "$2"; }
norm() { docker exec "$P" pg_dump -U postgres -s -d "$1" | grep -v -E '^\\(un)?restrict'; }

echo "== 0. checks (read only)"
[ -s "$DIR/$F.sql" ] && [ -s "$DIR/$F.down.sql" ] || fail "missing $DIR/$F.sql or its .down.sql"; ok "033 and its .down.sql are in $DIR"
[ "$(val $DB "select to_regclass('hw_bank_question') is not null")" = t ] || fail "032 is not applied (hw_bank_question is missing)"; ok "032 (and so 019 to 031) is applied"
[ "$(val $DB "select count(*) from pg_tables where tablename = 'hw_bank_review'")" = 0 ] || fail "033 is already (partly) applied"; ok "033 is not applied yet"
echo "      user rows: $(val $DB 'select count(*) from "user"')   organization rows: $(val $DB 'select count(*) from organization')   tables: $(val $DB "select count(*) from pg_tables where schemaname='public'")"
BEFORE=$(val $DB "select count(*) from pg_tables where schemaname='public'")

echo "== 1. backup"
mkdir -p "$BK"; T=$(date +%Y%m%d-%H%M)
docker exec "$P" pg_dump -U postgres -s -d $DB > "$BK/schema-before-033-$T.sql"
docker exec "$P" pg_dump -U postgres -Fc -t 'hw_*' -t organization -d $DB > "$BK/hw-data-before-033-$T.dump"
[ "$(wc -l < "$BK/schema-before-033-$T.sql")" -gt 1000 ] || fail "schema backup looks empty"
[ -s "$BK/hw-data-before-033-$T.dump" ] || fail "data backup is empty"
ok "backups in $BK (schema-before-033-$T.sql, hw-data-before-033-$T.dump)"
echo "      RESTORE POINT (UTC): $(val $DB "select now() at time zone 'utc'")"

echo "== 2. rehearsal on a throwaway copy of the production schema"
docker exec "$P" psql -U postgres -qc "drop database if exists $REH" -c "create database $REH owner digiclassroom_app template template0"
docker exec -i "$P" psql -U postgres -d $REH -q -v ON_ERROR_STOP=0 < "$BK/schema-before-033-$T.sql" > /dev/null 2>&1 || true
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "the rehearsal copy does not have production's $BEFORE tables"; ok "rehearsal copy restored ($BEFORE tables)"
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.sql" > /dev/null || fail "rehearsal: 033 failed"
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$((BEFORE + 1))" ] || fail "rehearsal: expected $((BEFORE + 1)) tables (production + 1)"; ok "033 applies on the copy: $((BEFORE + 1)) tables"
norm $REH > /tmp/pt_up.sql
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.down.sql" > /dev/null || fail "rehearsal: 033 down failed"
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "rehearsal: rollback did not return to $BEFORE tables"; ok "rollback 033 returns to $BEFORE tables"
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.sql" > /dev/null || fail "rehearsal: re-apply failed"
norm $REH > /tmp/pt_up2.sql
diff -q /tmp/pt_up.sql /tmp/pt_up2.sql > /dev/null || fail "rehearsal: schema after re-apply differs from the first apply"; ok "re-apply gives an identical schema"
docker exec "$P" psql -U postgres -qc "drop database $REH"; ok "throwaway database dropped"

if [ "$APPLY" != 1 ]; then echo; echo "Rehearsal passed. Production is UNCHANGED. Re-run with --apply to apply 033."; exit 0; fi

echo "== 3. apply to production (as digiclassroom_app)"
PGROLE=digiclassroom_app pg $DB < "$DIR/$F.sql" > /dev/null || fail "production: 033 failed (it changed nothing; stop and read the error)"; ok "applied 033"

echo "== 4. ownership, constraints, counts"
[ "$(val $DB "select count(*) from pg_tables where tablename = 'hw_bank_review' and tableowner='digiclassroom_app'")" = 1 ] || fail "hw_bank_review is not owned by digiclassroom_app: ALTER TABLE hw_bank_review OWNER TO digiclassroom_app"; ok "hw_bank_review is owned by digiclassroom_app"
[ "$(val $DB "select count(*) from pg_trigger where tgname in ('hw_bank_review_append_only','hw_bank_paper_guard') and not tgisinternal")" = 2 ] || fail "the two guard triggers are not both present"; ok "the guard triggers are present"
[ "$(val $DB "select count(*) from pg_tables where schemaname='public'")" = "$((BEFORE + 1))" ] || fail "production table count is not $((BEFORE + 1))"; ok "production now has $((BEFORE + 1)) tables"
echo "      review rows so far: $(val $DB 'select count(*) from hw_bank_review') (expected 0)"
echo; echo "Done. Nothing reads the table yet; a verdict arrives only when someone runs the review command (npm run hw:paper:review)."
