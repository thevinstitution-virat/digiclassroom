-- 033_hw_bank_review.down.sql: removes the review log and the paper guard. Rows keep their status and checked_by/checked_at (those are on hw_bank_question);
-- only the history of verdicts (including "fix" and "reject" notes) is lost.
BEGIN;
DROP TRIGGER IF EXISTS hw_bank_paper_guard ON hw_bank_paper;
DROP TABLE IF EXISTS hw_bank_review;
DROP FUNCTION IF EXISTS hw_bank_review_append_only();
DROP FUNCTION IF EXISTS hw_bank_paper_guard();
COMMIT;
