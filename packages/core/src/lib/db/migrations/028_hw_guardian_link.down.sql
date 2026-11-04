-- 028_hw_guardian_link.down.sql: removes the guardian link table and its guards. Parents then see nothing (the safe direction); the links are lost.
BEGIN;
DROP TABLE IF EXISTS hw_guardian_link;
DROP FUNCTION IF EXISTS hw_guardian_link_guard();
DROP FUNCTION IF EXISTS hw_guardian_link_no_direct_delete();
COMMIT;
