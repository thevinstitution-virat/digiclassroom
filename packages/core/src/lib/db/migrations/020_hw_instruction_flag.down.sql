-- 020_hw_instruction_flag.down.sql
--
-- Rolls back 020_hw_instruction_flag.sql. Drops only the table it created; marks and answers are untouched.
-- The instruction screen keeps working without it only if HW_INSTRUCTION_GUARD_ENABLED is switched off first.

BEGIN;

DROP TABLE IF EXISTS hw_instruction_flag;

COMMIT;
