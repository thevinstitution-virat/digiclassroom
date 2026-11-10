# CBSE exam packages: PYQs, mock tests, timed attempts, photo booklets, 8-parameter reports

Design and phases, 11 Nov 2026. Branch `feat/exam-packages`, stacked on `feat/board-paper-bank`.

**Status: phases 1 to 3 are built and verified on a scratch database (schema, rules, the super-admin
builder, and the learner's catalogue, start and timed paper behind `HW_EXAMS_ENABLED`, off by default).
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
| 4 | The photo booklet: multi-page upload, quality gates, ordering, page-to-question mapping | to do |
| 5 | Batch evaluation of a whole attempt: chunking, ready-by, fallback, cost booked per attempt | to do |
| 6 | The report: marks, step marking, the 8 parameters, weak areas, progress across attempts | to do |
| 7 | Pilot behind the existing eligibility gates, with monitoring and budgets on | to do |

Phases 2 to 6 each need the previous one's tables; phase 4 additionally needs **an R2 bucket and key
for Study Buddy**, which does not exist yet, and phase 5 needs a **scheduled job runner** for the
studybuddy app, which does not exist either. Both are in
`H:\Trio\VIRAT-EVALUATOR-HANDOFF.md`, section 10.

## 6. Still the owner's to decide

- Page-to-question mapping: the learner tags each page, a numbered answer sheet, or the model reads
  the question numbers off the page. The schema holds pages in order and does not force the choice.
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

