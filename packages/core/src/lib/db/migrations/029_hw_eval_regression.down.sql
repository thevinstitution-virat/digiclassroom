-- 029_hw_eval_regression.down.sql: removes the imported regression results (re-importable from the saved regression.json files).
BEGIN;
DROP TABLE IF EXISTS hw_eval_regression;
COMMIT;
