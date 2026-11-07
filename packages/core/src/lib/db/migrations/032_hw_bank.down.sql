-- 032_hw_bank.down.sql: removes the board-paper bank (papers, questions, figures, import log) and its guards. Nothing else reads these tables yet
-- (phase 1), so nothing breaks; the imported rows are lost and can be imported again from the bank file.
BEGIN;
DROP TABLE IF EXISTS hw_bank_import;
DROP TABLE IF EXISTS hw_bank_figure;
DROP TABLE IF EXISTS hw_bank_question;
DROP TABLE IF EXISTS hw_bank_paper;
DROP FUNCTION IF EXISTS hw_bank_question_guard();
DROP FUNCTION IF EXISTS hw_bank_import_append_only();
COMMIT;
