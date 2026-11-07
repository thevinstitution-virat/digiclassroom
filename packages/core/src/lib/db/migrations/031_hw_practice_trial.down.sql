-- 031_hw_practice_trial.down.sql: removes the practice trial table. Independent learners then have no trial (the safe direction);
-- the spent amounts are lost. Work already submitted in the practice space stays in the ordinary tables.
BEGIN;
DROP TABLE IF EXISTS hw_practice_trial;
COMMIT;
