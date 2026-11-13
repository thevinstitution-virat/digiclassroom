# Class 10 Science board-question bank in DigiClassroom, Study Buddy and InkBuddy (roadmap, 13 Nov 2026)

## What the owner asked for (13 Nov 2026)

"Load these questions in DigiClassroom and Study Buddy for class 10th science and make InkBuddy more powerful."

The questions come from the question bank in `H:\Trio\cbse-science-qbank`, which is outside git. The 2026 CBSE Class X Science papers were read in Claude.ai and mapped to NCERT chapter, section and printed page; `build.py` validates the mapping. Today the bank has 359 unique questions from 16 of the 23 papers.

The owner's decisions:

1. **Keys.** CBSE's own scheme where it exists (31/4/1-3 only). For everything else, the assistant writes the key from the NCERT textbook and marks it "KEY TO CHECK". A teacher approves each key before learners see the question. This is the chapter-1 pool's rule, applied to every chapter.
2. **Study Buddy gets the full exam port**: board-paper bank, exam packages, chapter pools and mark revisions (DCP migrations 032-036), plus everything below.
3. **InkBuddy upgrades:**
   - practice by chapter and topic;
   - after marking, the textbook section and pages to revise;
   - weak-topic suggestions;
   - a quick mixed test written with the pen.

## What exists already (DigiClassroom)

- **Board-paper bank** (`hw_bank_*`, 032/033). It needs a printed scheme quoted point by point, so it fits only 31/4.
- **Exam packages and chapter pools** (034/035).
  - A pool is a set of kind `pool` holding authored questions, each with a chapter and topic. A learner makes a practice test from it, which is photographed and marked as an exam.
  - The pool file format is `exam-pool/1`, loaded with `npm run hw:exam:pool`.
  - The chapter-1 pool (33 questions, 6 official keys) is loaded as a **draft on prod**.
  - Pool items carry no figures, no textbook reference and no internal choice. The importer's "KEY TO CHECK" text says "chapter 1" for every pool.
- **InkBuddy** practises one question at a time with the pen. Its question sources are:
  - textbook exercise questions from the library hub, keyed by the textbook key service;
  - published bank rows ("CBSE paper practice").

  The grade card, attempts, the teacher's pen and pacing (Phases 1-5 of `inkbuddy-teacher-roadmap.md`) are built locally and not yet deployed.

## Phases

| Phase | What | Where |
|---|---|---|
| 1 | All 13 chapter pools from the bank, keys included (`exam-pool/2`). **Done 13 Nov**: 424 items (359 questions, internal choices split), 74 official keys from the 31/4 scheme, 350 assistant keys to check, 65 with figures, 28 with a drawing part | data + importer |
| 2 | Migration 037: pool questions carry figures, textbook reference, sources, choice group and the teacher's key check; importer v2; builder key panel. **Done 13 Nov** (local, not applied anywhere but scratch) | DCP |
| 3 | InkBuddy board practice: chapter → topic → question with the pen; marked; "revise NCERT x.y, pages a-b" with a link into the book | DCP |
| 4 | Weak-topic suggestions and the quick mixed test (5-10 questions, timed, pen) | DCP |
| 5 | Study Buddy port: 032-037 by hand on its DB, bank/exams/pools/revisions code, phases 2-4 | Study Buddy |
| 6 | Remaining 7 papers (31/1/x, 31/8/x, 31(B)) once OCR'd; figures for 31/4 and 31/5 | data |

### Phase 1: chapter pools

- `exam-pool/2` is `exam-pool/1` plus, per item:
  - `ncert` (`section`, `title`, `pages`);
  - `figures` (`image` path in the bank folder, `description`, `labels`);
  - `choiceGroup`: an internal choice becomes one item per alternative, as the bank does, so a draw never takes both;
  - `asked`: the number of 2026 papers it was printed in.
- **Topics are NCERT sections** ("5.2.1 Autotrophic Nutrition"), so a learner's choice and the "revise" link are the same thing.
- **Keys:**
  - multiple choice and assertion-reason get the right option;
  - written questions get parts with value points, each written so a marker can find it in an answer, and citing the NCERT page.
  - A key is `official` when a 31/4 source has the scheme, otherwise `assistant` + `needsCheck`.
- **Files:**
  - `cbse-science-qbank/pools/cbse-x-science-chNN-2026.json`, kept out of git;
  - `pools.py` makes them from `bank.json` and `keys/chNN.json`. Keys are kept separately so a rebuilt bank keeps them.

### Phase 2 as built (13 Nov 2026)

**Migration 037** (`037_hw_exam_item_refs.sql`, applied by `apply-migration-037.sh`) adds six columns to `hw_exam_set_item` and adds no table:

- `ncert`: book, chapter number, section, title and pages.
- `sources`: the printed references.
- `choice_group`.
- `figures`: `[{key, description, labels}]`. Keys must be under `hw-exams/figures/`; a CHECK enforces this.
- `key_checked_by` and `key_checked_at`: a named check, enforced by a CHECK.

The 034 guard freezes all six with the rest once the set is published. The down script refuses while any question carries one of them. It was verified on a clean copy at 036: up, down and up give an identical schema.

**Importer** (`npm run hw:exam:pool`) reads `exam-pool/1` and `exam-pool/2`.

- **Pictures** are read from `--figures` (default: the folder above the pool file's folder). Each is size-checked and stored once, named by its sha-256 (`examFigureKey`). Storage goes through the exam page store: R2 in production, `HW_DEV_LOCAL_STORAGE_DIR` locally.
- **Left out and listed, not refused:** a question whose picture is missing or unusable, and a question that is only a drawing.
- **Drawing parts** become `answer_kind: 'diagram'` and `diagramParts`, so the AI does not mark them.
- **Scheme text** names the real chapter and "Taught in: NCERT x.y, pages a-b".

**The teacher's key check** (builder):

- Each authored question's row shows badges: key to check / key checked / CBSE key, asked N×, NCERT x.y · pages, pictures.
- "Show the key" opens the question with its pictures, the right option or value points, drawing parts, sources and the scheme text, with **"Key is right: mark it checked"**. The check is named by the signed-in account.
- A filter shows only keys still to check.
- **A set with an unchecked assistant key cannot be published.** `publishSet` refuses it, and the set page lists it as a problem.
- Changing a question's content clears its check; changing its number, section, chapter or topic does not.

**Practice and the learner's paper:**

- A practice test copies all six fields and never draws two alternatives of one choice group.
- The learner's paper shows an authored question's pictures as short-lived links.
- An authored choice group is shown as "attempt either" only when the set holds both alternatives.
- The learner's paper never carries the key, the scheme text or the check.

**Numbers:** the 13 pool files check clean. 398 of 424 questions import. 26 are left out:

- 21 have no picture: the 20 missing 31/4 and 31/5 crops, one of which is used twice;
- 5 are drawing-only.

The pictures come to 40 distinct objects. On the scratch database all 13 were imported into package slug `cbse-x-science-board-2026`.

**Tests:** `exams-pool-refs-db.test.ts` (9). The whole hw suite passes: 80 suites, 1293 tests. In the browser, the key panel, the picture, marking a key checked (26 → 25) and the publish problem all worked.

**Production, on the owner's go:**

1. Run `apply-migration-037.sh` (rehearsal), then `--apply`.
2. In the builder, delete the old draft chapter-1 pool. It has the same title, so the importer refuses until it is gone.
3. Copy `cbse-science-qbank/pools` and `figures` to the server.
4. Run `npm run hw:exam:pool -- import <pool> --year 2027 --slug cbse-x-science-chapter-practice --by "<name>"` for each of the 13 pools.
5. A teacher checks the keys in the builder, then the pools and the package are published.

### Phase 3: InkBuddy board practice

- **Offered:** only questions in a **published** pool, so every one has a teacher-checked key.
  - Multiple choice and assertion-reason are marked by code.
  - Written answers are marked against the checked key by the existing strict grader in the practice space. This needs an owner switch, `HW_INKBUDDY_POOL_AI_ENABLED` (default off), like `HW_EXAMS_AUTHORED_AI_ENABLED` for exams. While it is off, only objective questions are offered.
- **Browse:** chapter → topic, showing each topic's number of questions, how often the boards asked it, and the learner's best marks.
- **After marking:** "Revise NCERT 5.2.1 Autotrophic Nutrition, pages 81-83", with a link to the book in the library reader when the hub has it.

### Phase 3 as built (13 Nov 2026, commit e500fcb)

- **Server:** `packages/core/src/lib/hw/practice/board.ts`.
  - `boardPlanOf` decides whether a pool item is offered and how it is marked: an unchecked assistant key is never offered; MCQ and assertion-reason are code-marked; written answers only while `HW_INKBUDDY_POOL_AI_ENABLED` is on; drawing parts are left out of the marks.
  - `boardCatalogue` and `boardQuestions` list only items of published pools in published packages for the learner's class, never with the key.
  - `startBoardAttempt` makes a one-question practice assignment (`origin = 'custom'`, `rubric_mode = 'teacher'`, rubric from the pool's value points, attempt ref `pool:<itemId>`).
  - `reviseOf` links to `ncert.nic.in/textbook/pdf/jesc1NN.pdf#page=…` using the chapter first-page table `NCERT_SCI10_FIRST_PAGE`. The library reader link waits for the hub (not built).
  - The MCQ rule is read back from the pool item by `official-store.ts choiceRuleOf`; `keys/product.ts boardPoolAiAllowed()` and `eligibility/registry.ts` let these questions through the key gate.
- **tRPC:** `hw.practice.boardChapters`, `boardQuestions({section})`, `startBoardQuestion({itemId})`.
- **UI:** `BoardPractice.tsx` above `PaperPractice` on the InkBuddy page; `ReviseCard` in `ResultExtras.tsx`, shown by `AfterSubmit.tsx`; strings `pr.board.*`, `pr.revise.*` (EN, HI).
- **Tests:** `practice-board-db.test.ts` (10).
- **Browser walk on scratch (13 Nov):** chapter 5 → 5.2.4 → the pepsin MCQ (31/7/1 Q1) → typed "A" → handed in. The code marked it 1/1, the job runner released it, and the result showed the grade card and "Revise from your textbook: NCERT 5.2.4 Nutrition in Human Beings, pages 84-86" linking to `jesc105.pdf#page=6`. Topic 5.2.1 showed its picture from dev storage with its description as alt text.
  - Locally, a practice mark appears only after `POST /api/cron/hw-jobs` (Bearer `HW_CRON_SECRET`), which runs `releasePracticeSubmissions`; in production the cron does this.
  - "Hand in" asks with `window.confirm`; the in-app browser pane dismisses it, so a scripted walk must stub it.

### Phase 4: weak topics and the quick test

- **Weak topics:** topics with marks below 60% on first attempts, or never tried. They are ordered by how often the boards asked the topic, then by the learner's marks.
- **Quick test:** 5 or 10 questions from the chosen chapters, drawn as pool practice tests are, written with the pen in one sitting with the board's pace as the timer. Each question is marked as in phase 3, with one grade card for the test. It counts against the same trial and attempt limits.

### Phase 4 as built (13 Nov 2026)

- **Weak topics** (`board.ts weakTopicsOf`, returned by `boardCatalogue` as `weak`): topics never tried, and topics whose first attempts scored under 60% (`WEAK_BELOW`). A topic tried but not yet marked is left out. Low-mark topics come before never-tried ones (owner, 13 Nov 2026, after the walk showed a just-failed topic pushed off the list); within each, by times asked, then lowest marks; the six first (`WEAK_SHOWN`). Shown at the top of the board card as "Start with these topics", each opening its questions.
- **First try:** `triedOf` now reads each question's own marks (a quick test has many questions in one submission) and keeps the first marked attempt as well as the best; a returned question left unanswered counts 0. Marks from a quick test count as the first try.
- **Quick test** (`board.ts startQuickTest`, tRPC `hw.practice.startQuickTest({chapters, count: 5|10})`):
  - draws with `exams/practice.ts drawPractice` from the offered questions of the chosen chapters (all when none): spread over the NCERT topics, never both alternatives of one `choiceGroup`, in the board's order;
  - one practice assignment, one question per pool item (`origin_ref.quickTest = '1'`), instructions "N minutes for M marks, the board's pace";
  - a test not handed in yet is opened again instead of a new one (advisory lock per learner);
  - each question the learner has not met before counts against `HW_SELF_PRACTICE_MAX_ATTEMPTS`.
- **Quick-test questions are not attempts of their own:** `attempts.ts practiceRefOf` and `PRACTICE_REF_SQL` give them no ref, so they never become a question's latest attempt, "write it again", a peer's first attempt or a row of "Your practice".
- **Answer screen:** `QuickTimer` counts down the board's time (2¼ minutes a mark, at least ten) from when the test was first opened (`startSubmission` returns `quickTest` and `submission.openedAt`). It only tells the time; it never hands in.
- **Result:** one `GradeCard` labelled "Quick test · N questions" (no peer standing), then `QuickTestRevise`: the NCERT sections that lost marks, the most marks lost first, each linked to its page. Every question keeps its own revise card.
- **Home:** "Your quick tests", the last ten, with marks once returned.
- **Fixed on the way:**
  - the topic list said "1 questions" and "asked 1 times": plural strings now;
  - `startBoardAttempt` counted every assignment against the trial's limit; it now counts different questions, as textbook practice does (`attempts.ts questionsStarted`);
  - the writing-speed percentile left out board-pool questions (`paceOf` used its own ref).
- **Tests:** `practice-board-db.test.ts` 15 (weak-topic order, pace, the draw and its choice rule, reopening an open test, first-try marks from a test, the trial's limit). The catalogue test now runs on class 9, because scratch's real class 10 pools changed its counts.
- **Browser walk on scratch (13 Nov):** weak topics listed; quick test on chapter 5, 5 questions, timer "12 minutes for 5 marks"; 3 right, 1 wrong, 1 blank → handed in, job runner → grade card 3/5 (60%), "Revise these first" 5.4.2 and 5.4.1; the home listed the test at 3 / 5 and "Your practice" did not count its questions.

## Open for the owner

- `HW_INKBUDDY_POOL_AI_ENABLED`: AI marking of written answers against a teacher-checked authored key in InkBuddy.
- Who checks ~320 assistant keys. The builder shows each key with "KEY TO CHECK".
- Study Buddy's prerequisites from earlier work: an R2 bucket (done 13 Nov), a job runner and HW env.
