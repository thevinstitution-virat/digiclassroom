#!/usr/bin/env bash
# Applies migration 030 (guardian onboarding: guardian_link + guardian_invitation) to the DigiClassroom production database, same method as apply-migration-029.sh (already run).
# Needs 029 already applied. Adds TWO new tables and three trigger functions; nothing reads or writes them until GUARDIAN_INVITES_ENABLED is switched on (off by default).
# RUN ON THE VPS, as root, by the owner. Nothing here has been run yet.
# (Copy 030_guardian_onboarding.sql and .down.sql to the migrations folder on the server first.)
#
#   1. copy packages/core/src/lib/db/migrations/030_guardian_onboarding.sql and .down.sql to /root/hw-migrate/ (or set MIG_DIR)
#   2. ./apply-migration-030.sh            -> checks, backup, REHEARSAL on a throwaway copy; changes nothing in production
#   3. read the output; if every line says OK, then
#      ./apply-migration-030.sh --apply    -> the same, and then applies 030 to production and checks ownership
#
# The file is one transaction, so a failure changes nothing; the script stops at the first failure.
# Rollback (only if needed, after reverting the code): 030_guardian_onboarding.down.sql as digiclassroom_app.
# Order: apply 030 FIRST, then push main (the code reads the new tables only when the flag is on, but the build expects them).

set -euo pipefail
P=${PG_CONTAINER:-sn7jgws05e0uq48u31u5ezr8}
DB=digiclassroom
REH=hw_rehearsal
DIR=${MIG_DIR:-/root/hw-migrate}
BK=/root/backups/digiclassroom
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
F=030_guardian_onboarding

ok()   { echo "OK    $*"; }
fail() { echo "FAIL  $*" >&2; exit 1; }
pg()   { docker exec -i "$P" psql -U "${PGROLE:-postgres}" -d "$1" -v ON_ERROR_STOP=1 -q "${@:2}"; }
val()  { docker exec "$P" psql -U postgres -d "$1" -Atc "$2"; }
norm() { docker exec "$P" pg_dump -U postgres -s -d "$1" | grep -v -E '^\\(un)?restrict'; }

echo "== 0. checks (read only)"
[ -s "$DIR/$F.sql" ] && [ -s "$DIR/$F.down.sql" ] || fail "missing $DIR/$F.sql or its .down.sql"; ok "030 and its .down.sql are in $DIR"
[ "$(val $DB "select to_regclass('hw_eval_regression') is not null")" = t ] || fail "029 is not applied (hw_eval_regression is missing)"; ok "029 (and so 019 to 028) is applied"
[ "$(val $DB "select count(*) from pg_tables where tablename in ('guardian_link','guardian_invitation')")" = 0 ] || fail "030 is already (partly) applied"; ok "030 is not applied yet"
# 028 made hw_guardian_link; 030 replaces it. If anyone made links in it, they would stop showing: stop and look first.
OLD=$(val $DB "select count(*) from hw_guardian_link")
[ "$OLD" = 0 ] || fail "hw_guardian_link has $OLD rows: those links would not carry over. Stop and ask before applying."; ok "hw_guardian_link has 0 rows (nothing to carry over)"
echo "      user rows: $(val $DB 'select count(*) from "user"')   organization rows: $(val $DB 'select count(*) from organization')   tables: $(val $DB "select count(*) from pg_tables where schemaname='public'")"
BEFORE=$(val $DB "select count(*) from pg_tables where schemaname='public'")

echo "== 1. backup"
mkdir -p "$BK"; T=$(date +%Y%m%d-%H%M)
docker exec "$P" pg_dump -U postgres -s -d $DB > "$BK/schema-before-030-$T.sql"
docker exec "$P" pg_dump -U postgres -Fc -t 'hw_*' -t organization -d $DB > "$BK/hw-data-before-030-$T.dump"
[ "$(wc -l < "$BK/schema-before-030-$T.sql")" -gt 1000 ] || fail "schema backup looks empty"
[ -s "$BK/hw-data-before-030-$T.dump" ] || fail "data backup is empty"
ok "backups in $BK (schema-before-030-$T.sql, hw-data-before-030-$T.dump)"
echo "      RESTORE POINT (UTC): $(val $DB "select now() at time zone 'utc'")   <- write this in the roadmap log"

echo "== 2. rehearsal on a throwaway copy of the production schema"
docker exec "$P" psql -U postgres -qc "drop database if exists $REH" -c "create database $REH owner digiclassroom_app template template0"
docker exec -i "$P" psql -U postgres -d $REH -q -v ON_ERROR_STOP=0 < "$BK/schema-before-030-$T.sql" > /dev/null 2>&1 || true
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "the rehearsal copy does not have production's $BEFORE tables"; ok "rehearsal copy restored ($BEFORE tables)"
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.sql" > /dev/null || fail "rehearsal: 030 failed"
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$((BEFORE + 2))" ] || fail "rehearsal: expected $((BEFORE + 2)) tables (production + 2)"; ok "030 applies on the copy: $((BEFORE + 2)) tables"
norm $REH > /tmp/gd_up.sql
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.down.sql" > /dev/null || fail "rehearsal: 030 down failed"
[ "$(val $REH "select count(*) from pg_tables where schemaname='public'")" = "$BEFORE" ] || fail "rehearsal: rollback did not return to $BEFORE tables"; ok "rollback 030 returns to $BEFORE tables"
PGROLE=digiclassroom_app pg $REH < "$DIR/$F.sql" > /dev/null || fail "rehearsal: re-apply failed"
norm $REH > /tmp/gd_up2.sql
diff -q /tmp/gd_up.sql /tmp/gd_up2.sql > /dev/null || fail "rehearsal: schema after re-apply differs from the first apply"; ok "re-apply gives an identical schema"
docker exec "$P" psql -U postgres -qc "drop database $REH"; ok "throwaway database dropped"

if [ "$APPLY" != 1 ]; then echo; echo "Rehearsal passed. Production is UNCHANGED. Re-run with --apply to apply 030."; exit 0; fi

echo "== 3. apply to production (as digiclassroom_app)"
PGROLE=digiclassroom_app pg $DB < "$DIR/$F.sql" > /dev/null || fail "production: 030 failed (it changed nothing; stop and read the error)"; ok "applied 030"

echo "== 4. ownership, triggers, counts"
[ "$(val $DB "select count(*) from pg_tables where tablename in ('guardian_link','guardian_invitation') and tableowner='digiclassroom_app'")" = 2 ] || fail "the two tables are not owned by digiclassroom_app: ALTER TABLE ... OWNER TO digiclassroom_app"; ok "both tables are owned by digiclassroom_app"
[ "$(val $DB "select count(*) from pg_trigger where tgname in ('guardian_link_guard','guardian_invitation_guard','guardian_link_no_delete','guardian_invitation_no_delete')")" = 4 ] || fail "the four guard triggers are not all present"; ok "the four guard triggers are present"
[ "$(val $DB "select count(*) from pg_tables where schemaname='public'")" = "$((BEFORE + 2))" ] || fail "production table count is not $((BEFORE + 2))"; ok "production now has $((BEFORE + 2)) tables"
echo "      rows so far: links $(val $DB 'select count(*) from guardian_link'), invitations $(val $DB 'select count(*) from guardian_invitation') (expected 0, 0)"
echo; echo "Done. Nothing uses the tables until GUARDIAN_INVITES_ENABLED is switched on (it is off by default)."
