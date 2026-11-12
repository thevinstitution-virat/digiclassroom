# Mark revisions and the AI usage view (migration 036, 12 Nov 2026)

## What the owner asked for

Released marks (returned homework, a reported exam attempt) can be changed **at any time** by the super admin, an institution's admin and
the learner's assigned teacher. A school's admin or teacher **must give their name and designation**, and the learner's grade card / report
then says **"Marks revised by <name>, <designation>, on <date>"**. When the super admin (the app's owner) changes marks, the learner sees
**the date only**. (Owner's choices, 12 Nov 2026: date only for the owner; exam learners' own schools may revise their exam reports.)

## Who may revise

| What | Who |
|---|---|
| Returned homework | whoever may mark that assignment: the institution's admin (owner, org admin; platform super admin acting inside the institution), or a teacher linked to the class in `hw_class_teacher` |
| A reported exam attempt (exam space, no institution) | the super admin; or a school the learner is a **student member** of: its admin, or a teacher whose `hw_class_teacher` link covers a class the learner is actively enrolled in (and, if the link names a subject, the test's subject) |

Anyone else is told the report is not there. Before release, homework is marked as before (no revision note); an exam attempt can only be
revised once it is reported (a person marks a "waiting" answer this way, too).

## What is recorded

- `hw_mark_revision` (new, append-only: updates refused by a trigger; rows go only with their answer): answer, submission, exam attempt,
  marks before (null if it had none) and after, per-key-point marks, **reason** (3-1000 characters, required), reviser's user id, the
  **name and designation as given**, kind (`platform | admin | teacher`), `show_reviser` (false exactly for `platform`, enforced by a CHECK),
  and the school the reviser acted for.
- The mark itself goes to `hw_grade` as a person's grade (`source = manual`), written by `services/marking.ts` (`writePersonGrade`): that
  file stays the only writer of final grades, as the `no-ai-final-grades` test requires. `hw_grade_history` keeps every value.
- An exam attempt gets a **new report row** (`hw_exam_report.revision` 1, 2, ...; UNIQUE (attempt_id, revision)), assembled from the marks
  as they now stand; the writing check and the models are carried over, never re-run (no AI cost). `hw_exam_attempt.marks_awarded` follows.
  Older rows stay as they were.

## What people see

- **Learner (and parent)**: on each revised answer, "Marks revised by Asha Rao, Class teacher, on 12 Nov 2026 (was 1)", or "Marks revised on
  12 Nov 2026" for the app's own staff. The report header says "Report updated ..., after marks were revised". The learner never receives
  the reason or the reviser's account.
- **Staff**: the full history with reasons and who made each change (marked "not shown to the learner" where so).
- Where: homework, in marking (`Revise marks` on returned work); exams, **Exam Reports** in the super admin's menu
  (`/dashboard/super-admin/exams/reviews`), the institution's (`/dashboard/institution/exam-reviews`) and the teacher's
  (`/dashboard/teacher/exam-reviews`).

## The super admin's AI usage view

Evaluation → **AI usage** (`hw/ai-usage.ts`, `hwEval.admin.aiUsage`), refreshed every minute:

- now: provider batches running (by kind and institution, oldest first, with their model), jobs queued and running, exam booklets in progress;
- cost today and this month (the monthly roll-up, which also counts shadow calls);
- cost per day for 7, 30 or 90 days (bars, hover for tokens and jobs, a table view), and the window's tokens in / cached / out and batch share;
- by institution (exam packages and InkBuddy named as such), by kind of work, by model.

Only the Virat Evaluator's AI is on these job rows; Varta, Gyankosh chat and embeddings are not. When `HW_PRICE_TABLE_JSON` is not set and the
provider gives no cost, costs show as ₹0 and the view says so.

## Rollout

1. Apply migration 036 on production **before** pushing the code: `docs/hw-eval/apply-migration-036.sh` (rehearsal first, then `--apply`).
2. Push main.

Tests: `mark-revisions` (5: name and reason rules; exam revisions by owner, school admin and assigned teacher, refusals, the learner's view,
staff history, report revisions, append-only; homework revisions and the learner's result; the AI usage view). Browser-checked on scratch:
AI usage tab; an exam report revised by the super admin (date only on the learner's report, nothing leaked). The homework "Revise marks"
button was not clicked through in a browser (no returned homework on scratch); its server side is covered by the test.
