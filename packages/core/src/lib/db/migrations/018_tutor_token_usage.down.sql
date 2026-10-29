-- Undo 018: the token-window log (the flag must be off first).
BEGIN;
DROP TABLE IF EXISTS tutor_token_usage;
COMMIT;
