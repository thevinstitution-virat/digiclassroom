-- 030_guardian_onboarding.down.sql: removes the guardian invitations and links (guardians then see nothing: the safe direction). The links and invitations are lost; export them first if they matter.
BEGIN;
DROP TABLE IF EXISTS guardian_invitation;
DROP TABLE IF EXISTS guardian_link;
DROP FUNCTION IF EXISTS guardian_link_guard();
DROP FUNCTION IF EXISTS guardian_invitation_guard();
DROP FUNCTION IF EXISTS guardian_no_direct_delete();
COMMIT;
