#!/usr/bin/env bash
# Applies migration 036 (mark revisions: the new table hw_mark_revision with an append-only trigger, and numbered report revisions on
# hw_exam_report: a revision column, UNIQUE (attempt_id) becomes UNIQUE (attempt_id, revision)) to the DigiClassroom production database,
# same method as apply-migration-035.sh. Needs 034 and 035. Adds one table and drops nothing. Apply it BEFORE deploying the code that uses it.
# RUN ON THE VPS, as root.
#
#   1. copy 036_hw_mark_revisions.sql and .down.sql to /root/hw-migrate/ (or set MIG_DIR)
#   2. ./apply-migration-036.sh            -> checks, backup, REHEARSAL on a throwaway copy; changes nothing in production
#   3. ./apply-migration-036.sh --apply    -> the same, and then applies 036 to production and checks it
#
# The file is one transaction, so a failure changes nothing; the script stops at the first failure.
# Rollback (only if needed): 036_hw_mark_revisions.down.sql as digiclassroom_app; it refuses once any revision exists.

set -euo pipefail
P=${PG_CONTAINER:-sn7jgws05e0uq48u31u5ezr8}
DB=digiclassroom
REH=hw_rehearsal
DIR=${MIG_DIR:-/root/hw-migrate}
BK=/root/backups/digiclassroom
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
F=036_hw_mark_revisions

ok()   { echo "OK    $*"; }
fail() { echo "FAIL  $*" >&2; exit 1; }
pg()   { docker exec -i "$P" psql -U "${PGROLE:-postgres}" -d "$1" -v ON_ERROR_STOP=1 -q "${@:2}"; }
val()  { docker exec "$P" psql -U postgres -d "$1" -Atc "$2"; }
norm() { docker exec "$P" pg_dump -U postgres -s -d "$1" | grep -v -E '^\\(un)?restrict'; }

echo "== 0. checks (read only)"
[ -s "$DIR/$F.sql" ] && [ -s "$DIR/$F.down.sql" ] || fail "missing $DIR/$F.sql or its .down.sql"; ok "036 and its .down.sql are in $DIR"
[ "$(val $DB "select count(*) from information_schema.columns where table_name='hw_exam_set' and column_name='owner_user_id'")" = 1 ] || fail "035 is not applied"; ok "035 is applied"
[ "$(val $DB "select to_regclass('hw_mark_revision') is null")" = t ] || fail "036 is already (partly) applied"; ok "036 is not applied yet"
echo "      user rows: $(val $DB 'select count(*) from "user"')   organization rows: $(val $DB 'select count(*) from organization')   tables: $(val $DB "select count(*) from pg_tables where schemaname='public'")"
BEFORE=$(val $DB "select count(*) from pg_tables where schemaname='public'")

echo "== 1. backup"
mkdir -p "$BK"; T=$(date +%Y%m%d-%H%M)
docker exec "$P" pg_dump -U postgres -s -d $DB > "$BK/schema-before-036-$T.sql"
docker exec "$P" pg_dump -U postgres -Fc -t 'hw_*' -t organization -d $DB > "$BK/hw-data-before-036-$T.dump"
[ "$(wc -l < "$BK/schema-before-036-$T.sql")" -gt 1000 ] || fail "schema backup looks empty"
[ -s "$BK/hw-data-before-036-$T.dump" ] || fail "data backup is empty"
ok "backups in $BK (schema-before-036-$T.sql, hw-data-before-036-$T.dump)"
echo "      RESTORE POINT (UTC): $(val $DB "select now() at time zone 'utc'")"

echo "== 2. rehearsal on a throwaway copy of the production schema"
docker exec "$P" psql -U postgres -qc "drop database if exists $REH" -c "create database $REH owner digiclassroom_app template template0"
docker exec -i "$P" psql -U postgres -d $REH -q -v ON_ERROR_STOP=0 < "$BK/schema-before-036-$T.sql" > /dev/null 2>&1 || true
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "the rehearsal copy does not have production's $BEFORE tables"; ok "rehearsal copy restored ($BEFORE tables)"
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.sql" > /dev/null || fail "rehearsal: 036 failed"
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$((BEFORE + 1))" ] || fail "rehearsal: expected $((BEFORE + 1)) tables (production + hw_mark_revision)"; ok "036 applies on the copy: $((BEFORE + 1)) tables"
norm $REH > /tmp/pt_up.sql
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.down.sql" > /dev/null || fail "rehearsal: 036 down failed"
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "rehearsal: rollback did not return to $BEFORE tables"; ok "rollback 036 returns to $BEFORE tables"
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.sql" > /dev/null || fail "rehearsal: re-apply failed"
norm $REH > /tmp/pt_up2.sql
diff -q /tmp/pt_up.sql /tmp/pt_up2.sql > /dev/null || fail "rehearsal: schema after re-apply differs from the first apply"; ok "re-apply gives an identical schema"
docker exec "$P" psql -U postgres -qc "drop database $REH"; ok "throwaway database dropped"

if [ "$APPLY" != 1 ]; then echo; echo "Rehearsal passed. Production is UNCHANGED. Re-run with --apply to apply 036."; exit 0; fi

echo "== 3. apply to production (as digiclassroom_app)"
PGROLE=digiclassroom_app pg $DB < "$DIR/$F.sql" > /dev/null || fail "production: 036 failed (it changed nothing; stop and read the error)"; ok "applied 036"

echo "== 4. table, trigger, report revisions"
[ "$(val $DB "select to_regclass('hw_mark_revision') is not null")" = t ] || fail "hw_mark_revision is missing"; ok "hw_mark_revision is there"
[ "$(val $DB "select count(*) from pg_trigger where tgname='hw_mark_revision_append_only' and not tgisinternal")" = 1 ] || fail "the append-only trigger is missing"; ok "the append-only trigger is present"
[ "$(val $DB "select count(*) from information_schema.columns where table_name='hw_exam_report' and column_name='revision'")" = 1 ] || fail "hw_exam_report.revision is missing"; ok "hw_exam_report has revision"
[ "$(val $DB "select count(*) from hw_exam_report where revision <> 0")" = 0 ] || fail "existing reports should all be revision 0"; ok "existing reports are revision 0: $(val $DB 'select count(*) from hw_exam_report')"
[ "$(val $DB "select count(*) from pg_tables where schemaname='public'")" = "$((BEFORE + 1))" ] || fail "production table count is not $((BEFORE + 1))"; ok "production has $((BEFORE + 1)) tables"
echo; echo "Done. Now deploy the code (push main)."
