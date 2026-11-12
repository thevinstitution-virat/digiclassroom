# CBSE exam packages: PYQs, mock tests, timed attempts, photo booklets, 8-parameter reports

Design and phases, 11 Nov 2026. Branch `feat/exam-packages`, stacked on `feat/board-paper-bank`.

**Status: phases 1 to 4 are built and verified on a scratch database (schema, rules, the super-admin
builder, the learner's catalogue, timed paper and photo booklet behind `HW_EXAMS_ENABLED`, off by default).
Nothing is applied to any real database, nothing is pushed, nothing is offered to any learner.**

## 1. What the owner asked for

Super-admin builds **packages** — for example "CBSE Class 10, 2027 boards" — holding past papers and
sample papers plus **10 half-syllabus and 10 full-syllabus mock tests** per subject, with
subject-wise and chapter-wise questions, model answers and the marking scheme. A subscriber may
attempt **every set 5 times**. Starting a set starts a **timer against that learner**; when the time
is up the timer stops and the learner **uploads clear photographs of every answer page**. The
evaluator reads and marks them **in batch**, and the learner gets a **detailed report**: marks by the
board's step marking, every weak area, and a rating on **8 parameters** (punctuation, grammar,
spelling, factual correctness, presentation, tables and diagrams drawn, sticking to the textbook, and
step marking). Models are **OpenAI direct — no OpenRouter**.

## 2. The two decisions that shape the schema

**An attempt materialises an ordinary `hw_assignment`.** Everything after the upload — reading,
escalation, strict marking, eligibility, quotas, monitoring, the instruction guard — then runs on the
pipeline that has already been measured, untouched. This is exactly what InkBuddy already does for a
single practised question (`practice/paper.ts` creates an assignment under `PRACTICE_ORG_ID` with
`ensureLearnerSpace()`), extended from one question to a whole paper.

A happy consequence: **5 attempts needs no change to `hw_submission`.** Its
`UNIQUE (assignment_id, student_id)` is per assignment, and each attempt gets its own assignment, so
the limit lives in `hw_exam_attempt` (`UNIQUE (user_id, set_id, attempt_no)`) and nothing in the
existing marking schema has to move.

**Marks come only from the official marking scheme; the 8 parameters are advisory.** The mark-bearing
path judges one thing per value point (`grade-strict.v2` returns
`same_fact | right_idea_wrong_detail | different_fact | absent`, and code — never the model — turns
verdicts into marks). Its measured quality (295/300 and 296/300 mutation detection against M0's
264/300) depends on that narrowness, and its prompt explicitly ignores spelling and grammar, as CBSE
examiners do outside language papers. So the 8 parameters are a **separate writing profile** that
never moves a mark. Of the eight:

| Parameter | Where it comes from |
|---|---|
| Factual correctness | the marking pass itself (value-point verdicts) — already built |
| Step marking | the marking pass (`step` / `unit` / `format` / `competency` key points) — already built |
| Punctuation, grammar, spelling | the writing-profile pass, text-only over the transcript |
| Presentation of the answer | the **reader** pass, which sees the page (`unclear_count`, `ink_stats`) |
| Tables and diagrams drawn | the reader pass plus the question's `diagram_parts` from the bank |
| Sticking to the textbook | textbook retrieval through the library hub — **not deployed for Study Buddy**; this parameter stays absent until it is, and the report must say so rather than guess |

## 3. Tables (migration 034)

Shared content, like the bank, carries no `organization_id`; anything about a person does.

- **`hw_exam_package`** — the sellable unit: board, class level, exam year, slug, title, blurb,
  `attempts_per_set` (default 5), `price_paise`, `status` (`draft` → `published` → `retired`).
  Identity: `UNIQUE (board, class_level, exam_year, slug)`.
- **`hw_exam_set`** — one attemptable paper in a package: `kind`
  (`pyq | sqp | mock_half | mock_full`), subject and subject code, title, `max_marks`,
  `duration_minutes`, `syllabus_scope` (the chapters it covers), optional `paper_id` into
  `hw_bank_paper` when the set *is* a board paper, `status`. `UNIQUE (package_id, position)`.
- **`hw_exam_set_item`** — the questions, in order. Either a reference to a checked
  `hw_bank_question` **or** an authored question (stem, scheme text, parts, in the bank's own JSONB
  shape) so an in-house mock can carry questions no board paper has. Exactly one of the two, enforced
  by a CHECK. `UNIQUE (set_id, position)`.
- **`hw_exam_entitlement`** — who may attempt a package: `source`
  (`purchase | trial | grant`), `status` (`active | expired | refunded`), window, order reference, an
  optional `attempts_per_set` override. `UNIQUE (user_id, package_id)`.
- **`hw_exam_attempt`** — the timed run: `attempt_no`, the materialised `assignment_id`, `status`
  (`started | time_up | uploaded | evaluating | reported | abandoned`), and the **server-anchored
  clock**: `started_at`, `expires_at`, `upload_deadline_at`, with `ended_at`, `submitted_at`,
  `reported_at`, marks and max marks. `UNIQUE (user_id, set_id, attempt_no)`.
- **`hw_exam_page`** — one uploaded answer page: `image_key` (R2, under `hw-exams/`), pixel size,
  bytes, sha256, a `quality` verdict, `status` (`accepted | rejected`) with a reason.
  `UNIQUE (attempt_id, position)`; a rejected page always says why.
- **`hw_exam_report`** — one row per attempt (append-only): marks, per-question detail, the
  8-parameter profile, weak areas, the model and prompt version that produced it.

Database guards, not only code:

1. A **published** package or set cannot have its identity, marks or duration changed, and a set
   cannot move within its package — the same rule the bank applies to a checked row, for the same
   reason: a learner's past attempt must still mean what it meant.
2. An attempt's **clock is immutable**: `started_at`, `expires_at` and `upload_deadline_at` cannot be
   updated after the row is inserted. This is the integrity heart of a timed test; without it a
   client could buy itself time.
3. `attempt_no` cannot exceed the **effective allowance** (the entitlement's override, else the
   package's `attempts_per_set`), checked by a trigger so no code path can skip it.
4. `hw_exam_report` is append-only, like `hw_ai_grade`.
5. A set item may only reference a bank question that is `checked` or `published` — never a draft.
6. A published package or set can be retired and reopened but **never set back to draft** (which
   would unfreeze it).
7. An attempt can only be inserted on a **published set of a published package**.
8. A set with attempts, and a bank paper a set is built on, **cannot be deleted** (`RESTRICT`):
   a learner's history cannot vanish. A draft set nobody attempted can be.

Guards 6-8 were added after 034 was first applied to a scratch database and its guards were tested
against real Postgres (`apps/web/src/__tests__/hw/exams-db.test.ts`), which showed the holes.

## 4. Rules (pure, tested)

`packages/core/src/lib/hw/exams/rules.ts` holds every decision as a pure function, so the rules are
tested exactly and the database functions stay thin:

- `effectiveAttemptsAllowed(pkg, entitlement)`
- `startDecision({ now, entitlement, allowed, attemptsUsed, openAttempt, setStatus })` — one reason
  code per refusal (`not_entitled`, `entitlement_expired`, `attempts_exhausted`, `attempt_open`,
  `set_not_published`)
- `clockFor(startedAt, durationMinutes, graceMinutes)` → `{ expiresAt, uploadDeadlineAt }`
- `remainingMs(now, expiresAt)`, `isTimeUp`, `uploadWindow(now, attempt)`
- `pageVerdict(facts)` — a page is refused before it ever costs a token if it is too small, too
  blurred, too dark or too bright
- `batchDecision({ instantRequested, now, uploadDeadline })` — batch by default (half price, a
  "ready by" time), standard path when the learner paid for instant
- `profileFromPasses(...)` — assembles the 8 parameters from the reader pass, the marking pass and
  the writing pass, marking a parameter `unavailable` rather than guessing (textbook adherence
  without the hub)
- `weakAreas(perQuestion, items)` — roll-up by chapter and by value-point kind, worst first

## 5. Phases

| # | What | State |
|---|---|---|
| 0 | Land the board-paper bank: push, merge, apply 032 and 033, import a paper, teacher check, publish | **owner's action** |
| 1 | Migration 034, the rules module, unit tests; 034 verified up/down/up and its guards tested on a scratch DB | **done (local)** |
| 2 | Super-admin: package and set builder, item picker, publish, grants | **done (local)**; walked through in the browser |
| 3 | Learner: package catalogue, entitlement, start a set, the server-anchored timer, auto-stop | **done (local)**; walked through in the browser |
| 4 | The photo booklet: multi-page upload, quality gates, ordering, page-to-question mapping | **done (local)**: booklet, printed answer sheet, and the mapping rule (fed by the reader in phase 5); needs the Study Buddy R2 bucket to run anywhere real |
| 5 | Batch evaluation of a whole attempt: chunking, ready-by, fallback, cost booked per attempt | **5a done (local)**: read, place, hand to marking, cost per attempt, run live on gpt-6-luna; **5b to do**: the batch path (ready-by, chunking, fallback) |
| 6 | The report: marks, step marking, the 8 parameters, weak areas, progress across attempts | to do |
| 7 | Pilot behind the existing eligibility gates, with monitoring and budgets on | to do |

Phases 2 to 6 each need the previous one's tables; phase 4 additionally needs **an R2 bucket and key
for Study Buddy**, which does not exist yet, and phase 5 needs a **scheduled job runner** for the
studybuddy app, which does not exist either. Both are in
`H:\Trio\VIRAT-EVALUATOR-HANDOFF.md`, section 10.

**Real CBSE material (11 Nov 2026):** the 2026 board papers, the official marking scheme for sets 31/4/1-3 and a real
examiner-marked answer book are summarised in [`cbse-2026-sources.md`](cbse-2026-sources.md), with three marking rules from the
scheme that the product does not follow yet (error carried forward, open "any other" points, keeping the better of two answered
alternatives).

## 6. Still the owner's to decide

- ~~Page-to-question mapping~~ — **decided 11 Nov 2026** (section 10): a printed answer sheet with the
  question numbers pre-marked, plus the reader matching anything else against the question paper and
  answer key.
- Instant evaluation as a paid option, or batch for everyone.
- `HW_PARTIAL_CREDIT_RULE` (`zero` today).
- Whether a half-syllabus mock's `syllabus_scope` is authored per subject by a teacher or generated
  from the taxonomy.
- Rights to distribute past-paper text and figures.

## 7. Phase 2 as built (server side)

- `packages/core/src/lib/hw/exams/build-rules.ts` — the publish checks, pure: `attainableMarks` (each
  internal-choice group, or else each question number, counted once at its highest mark),
  `setProblems` (`no_items`, `marks_mismatch`, `bank_row_not_published`, `number_gap`, `no_scope`),
  `packageProblems` (needs one published set), each with a readable line.
- `packages/core/src/lib/hw/exams/builder.ts` — the database side: create/update/list/get/publish/
  retire packages; add a mock set, or **turn a published board paper into a set in one call**
  (`setFromPaper`: every published row, internal-choice alternatives kept, visually-impaired variants
  left out, marks and time from the paper); add bank or authored items, edit, remove, reorder;
  publish a set under a row lock after the checks; grant a package. Migration 034's refusals come
  back as `HwError` with plain words, never a constraint name.
- `packages/core/src/db/hw-exams-schema.ts` — the drizzle mirror of 034.
- `packages/core/src/lib/trpc/routers/hw-exams.ts`, mounted at `hw.exams` — `admin.*` procedures,
  `super_admin` only; `admin.grant` finds the learner by email.
- Tests: `exams-build-rules` (pure), `exams-builder-db` and `exams-api` (scratch DB). Bank items carry
  no chapter (the bank has none), so the builder lets the super-admin set one per item — the report's
  weak areas by chapter depend on it.

- An authored question's value points must add up to their part and the parts (an alternative label
  counted once) to the question (`authoredProblems`), checked live in the form and again on the server.

Screens (`apps/web/src/components/hw-exams/admin/`, routes under `/dashboard/super-admin/exams`, nav entry
"Exam Packages" under Content & Knowledge): the package list and new-package form; a package page with its
sets and what stops each from publishing, a board paper as a set, a new mock, details, publish/retire, and
grant by email; a set page with its questions (chapter per question, reorder, remove), the board-question
picker, the write-a-question form with value points, settings, publish/retire/delete. A draft set warns
which questions lack a chapter, since chapters freeze with the set. How to run them locally, and what the
walk-through found: `docs/hw-eval/screens/exam-packages/README.md`.

## 8. Phase 3 as built (learner)

- **Switch:** `HW_EXAMS_ENABLED` (default `false`). Off, the learner procedures refuse and the sidebar entry
  "Board Exam Practice" is hidden; the super-admin builder works either way.
- **Store:** `packages/core/src/lib/hw/exams/learner.ts` — `catalogue` (published packages, plus retired
  ones the learner has access to), `packageForLearner` (sets with attempts used / allowed and the start
  verdict, the learner's open attempt anywhere), `startAttempt` (under a lock on the learner's entitlement
  row, so two clicks or two tabs make one attempt — tested), `finishWriting`, `abandonAttempt` (still
  counts as an attempt, otherwise giving up is a free look at the paper), `attemptView` (the clock and the
  paper; the paper carries stems, options and figures, never the scheme, value points or the right option
  — tested by searching the whole response).
- **The clock:** `started_at` is the server's now; `expires_at` and `upload_deadline_at` are stored once
  (034 refuses changes). Statuses that follow from time are settled whenever an attempt is read
  (`rules.settle`): writing time over → `time_up`, ended at the expiry; upload window over with no accepted
  page → `abandoned` (`no_pages_uploaded`). No scheduled job is needed. One open attempt per learner at a
  time, across all sets.
- **The countdown on screen** starts from the server's now sent with the view and adds
  `performance.now()` time, so changing the device's date or time does not move it (checked in the
  browser by shifting the page's clock 30 minutes); at zero the page asks the server, which is what ends
  the time.
- **Decision: the `hw_assignment` an attempt is marked through is made in phase 5**, when the attempt is
  sent for marking, not at the start. `assignment_id` stays NULL until then; phases 3-4 need only the clock
  and the paper, and this keeps the marking pipeline untouched until it is used.
- **Screens** (`apps/web/src/components/hw-exams/learner/`, routes under `/dashboard/user/exams`), English
  and Hindi with the shared language switch: the catalogue, a package page (tests, attempts, start with a
  plain warning that the clock starts at once, the way back to an open test), and the timed paper (the
  countdown pinned under the dashboard header, the paper with sections and "OR" between internal choices,
  finish writing, give up). After time is up the page says uploading opens in the next update (phase 4).
- Tests: `exams-learner-db` (13, against the scratch DB, time passed in), `settle` in `exams-rules`, the
  learner procedures in `exams-api`.

## 9. Phase 4 as built (the photo booklet)

- **When:** pages are taken only once writing time is over (finished early, or the clock ran out) and
  until the upload deadline fixed at the start. Handing in closes the booklet. When the window closes
  with pages and the learner has not handed in, the attempt is **handed in as it stands at the deadline**
  (`rules.settle` → `uploaded`); with no page it is abandoned, as before.
- **Checked in the browser first** (`lib/hw/exams/page-measure.ts`, pure): brightness, share of blown-out
  pixels (glare), and sharpness (variance of the Laplacian on an ~800 px copy). The photo is then
  shrunk to 2400 px on the long side and sent as JPEG (about 150-350 KB a page). **The thresholds are
  provisional** until calibrated on real photographs of real answer pages, so for blur, light and glare
  the learner may choose "use it anyway"; the choice and the measurements are stored with the page
  (`quality`).
- **Checked again on the server** (`lib/hw/exams/pages.ts`, `POST /api/hw/exams/attempts/:id/pages`):
  what the bytes really are (from their header), at least about 1.2 MP, at most 8 MB, not the same
  photo twice (sha256), at most 40 pages, the window open, and the attempt the caller's own. "Too small"
  cannot be overridden.
- **Storage:** private objects `hw-exams/{attempt}/p{page}.{ext}`, shown through short-lived signed links;
  a removed page's object is deleted. **R2 for Study Buddy does not exist yet**; for local development
  only, `HW_DEV_LOCAL_STORAGE_DIR` keeps pages in a folder (ignored in production).
- **Order:** pages are moved up or down and removed until handed in.
- **Not built: page-to-question mapping** — still the owner's choice (the learner tags pages, a numbered
  answer sheet, or the reader finds the question numbers). `hw_exam_page.question_hint` is there for the
  first option. The screen tells the learner to number each answer as on the paper, which the third
  option needs anyway.
- Tests: `exams-page-measure` (pure), `exams-pages-db` (10, in-memory store), the settle cases in
  `exams-rules`.

## 10. Matching pages to questions (owner's decision, 11 Nov 2026)

The owner's answer: the model recognises the questions from the question paper and the answer key the
super admin provided, reads the learner's handwriting, and judges how near each answer is to the key —
and learners get a **model answer sheet** with the question numbers already marked, proper margins, and
**no ruled lines** so they can draw diagrams and tables as needed. Together these leave no ambiguity.

Built so far (the reading itself is phase 5):

- **The printed answer sheet** (`lib/hw/exams/sheet.ts`, printed at `/exam-sheet/:setId`; linked from
  each test on the learner's package page, previewed by the super admin from the set page): A4, unruled;
  multiple choice answered in one grid of circled letters; each written answer in a box whose height
  follows its marks (20 mm + 28 mm a mark, at most 220 mm), the question number and marks printed in a
  24 mm left margin that is not written in; an internal choice is one box with "Answering ☐ A ☐ B"; no
  box is split across pages; two extra pages at the end ask for the question number before each answer.
  Every page carries the sheet code and page number large (`C3F245-3`: the set's code and the page),
  and a black square in each corner so a photo can be squared up. Labels are printed in English and
  Hindi. The sheet shows numbers and marks only, never the questions, so it can be printed before
  starting. Plain paper still works (the learner numbers each answer).
- **The matching rule** (`lib/hw/exams/mapping.ts`, pure, tested), strongest evidence first:
  1. writing inside a printed box on a page whose code is this set's: that box's question, certain;
  2. a question number the learner wrote, read with confidence >= 0.8;
  3. the answer itself, when its closeness to one question's answer key is >= 0.6 and at least 0.15
     above the next.
  Anything else goes to **review** rather than being guessed: a page of another set's sheet, a sheet page
  that does not exist, a different number written inside a printed box, two numbers on one answer, a
  number that the answer strongly contradicts, or nothing conclusive. An answer continued on an extra
  page joins its question in page order. A question nothing points to is not attempted. The thresholds
  are provisional, to be set on real reader output.
- **Phase 5 then has the reader report, per page:** the sheet code and page it reads, and for each stretch
  of writing, the printed box it sits in, any question number written, and its closeness to each
  question's answer key — exactly the `PageEvidence` the rule takes.

## 11. Phase 5a as built: reading a booklet and handing it to marking (11 Nov 2026)

- **Its own space.** Marking work lives in a system institution `vgp-exams` with its own monthly ceiling
  (`HW_EXAMS_PLATFORM_BUDGET_PAISE`, default Rs 5,000). It never touches an InkBuddy trial (the trial
  charge and refusals are keyed on InkBuddy's practice space), and its cost is on its own line.
- **One assignment per attempt** (`exams/materialise.ts`), made when the booklet is first evaluated: board
  questions through InkBuddy's own offer path, keyed from the bank's person-checked scheme; authored
  questions with their value points as rubric points; a multiple choice answered by its letter and
  marked by code. Alternatives are separate questions; the one not taken is blank.
- **Reading** (`prompts/exam-page-read.v1`): one call per page, verbatim, told only the paper's question
  numbers — never the questions or the key, so nothing pulls the transcript towards a right answer.
  It reports the sheet code and page, the multiple-choice grid, and each piece of writing with its box,
  written number, chosen alternative and confidence. Kept with the page (`hw_exam_page.quality.read`).
- **Placing** (`exams/assemble.ts` over `exams/mapping.ts`): the matching rule of section 10; the
  text-only answer-key matcher (`prompts/answer-match.v1`) only for writing nothing else placed, then the
  rule again. The learner's own label ("Q12.") is taken off the transcript; a multiple choice keeps its
  letter (and goes to a person if no option can be told); alternatives by the ticked or written letter,
  else a clear key preference, else review; hard-to-read writing to review; blanks held for review while
  any writing is unplaced. What a person must look at is kept with its page (`quality.review`).
- **Hand-over:** one transcript per question, then the existing pipeline: rules (blank, exact match) and
  strict marking jobs, keys, quotas, monitoring — unchanged. The attempt stays `evaluating` until the
  report (phase 6).
- **Running:** a new `exams` step in the job runner claims handed-in attempts by status (no new job kind,
  no migration), `HW_EXAMS_EVAL_PER_PASS` at a time; a failure is retried up to `HW_EXAMS_EVAL_MAX_TRIES`
  then left for a person with the reason; a pass that died half-way is picked up again once stale.
- **Cost** is booked as a finished `read` job on the attempt's submission; the attempt's cost is that job
  plus its grade jobs.
- **Publishing** now also refuses a board question InkBuddy would not offer (a figure with no picture,
  nothing markable), with the reason; at evaluation such a row (changed after publishing) goes to a person.

**Live run** (gpt-6-luna, OpenAI direct, the owner's key, 11 Nov): a 2-page plain-paper booklet — one page
drawn "handwriting" with "Q1"/"Q2" written, one deliberately blurred. Read in about 18 s; Q1 placed by its
written number and marked **3/3** by strict marking with the quoted evidence for each value point; Q2's
"(B) virtual" reduced to "B" and marked **1/1 by code** (free); the blurred page came back as "[?]" at low
confidence, could not be placed, and was recorded for a person. **Cost: 8.6 paise reading (2 pages and one
matcher call) + 1.4 paise marking = about Rs 0.10.** Found and fixed on the way: the label kept in
transcripts left a multiple choice unmarked; "[??]" was not counted as unreadable. The pages were drawn on
a canvas, not photographed: **reading accuracy and the price per page must still be measured on real phone
photos of real handwriting** before anything is priced or promised.

**Real handwriting, measured 12 Nov** ([`real-handwriting-read-1.md`](real-handwriting-read-1.md)): six pages of a real examiner-marked CBSE
answer book on the production reader, 81% of words read right at 5.5 paise a page, but option letters and question numbers misread at 0.95
confidence and some unreadable words filled in with the textbook's idea. Plain-paper booklets are not ready to promise. Two checks are now in
placement: a multiple choice whose written words are another option's goes to a person, and every answer placed by a written number is also
scored by the text-only matcher, so a number its content contradicts goes to a person (mapping.ts already had the rule; 5a never gave it the
scores). A letter the reader reports only in its "alternative" field is now used. Pages are read as two overlapping halves by default
(`HW_EXAMS_READ_SPLIT=halves`, `exams/halves.ts` + `exams/crop.ts`): fewer invented words and better question numbers, at about 1.6 times the
reading cost (8.7 against 5.5 paise a page); `page` turns it off.

**Printed sheet read box by box (12 Nov)** ([`printed-sheet-read-1.md`](printed-sheet-read-1.md)): code finds the page's corners, straightens it,
reads a new identity strip (sheet code + page) and the multiple-choice grid from the ink, and sends only the boxes with writing to the reader,
one call each (`exam-box-read.v1`). On phone-style photos of the real student's handwriting: 93-96% of words right, every grid letter right,
nothing to review, about 3.5 paise a box (about Rs 0.70 a paper). `HW_EXAMS_SHEET_VISION` (on); pages code cannot square up fall back to halves.

**Owner's decision needed — AI marking of authored questions.** The pilot gate (roadmap decision D3,
`HW_TEACHER_RUBRIC_AI_ENABLED`, off) keeps a question marked with its own rubric off AI marking: such
questions are marked by a person. Questions the super admin writes in the builder are exactly that, so
on production today **an authored mock's written answers would wait for a person**; board-paper
questions (official scheme) and every multiple choice are not affected. The live run above switched the
gate off locally to exercise the marking. Options: (a) author mocks from the bank's board questions only;
(b) measure authored-scheme marking like the other groups and promote it through the eligibility
registry; (c) switch the gate on for the exam space only. Board questions are still subject to the
eligibility registry (`HW_ELIGIBILITY_ENFORCED`): their group must be promoted before AI marks show.

**Phase 5b (to do):** the batch path — page reads and marking on the Batch API (half price), a visible
"report ready by" time, chunking for the batch file limits, and the standard-path fallback.

