# Virat Evaluator: the complete guide

Written 3 Nov 2026 from the code in `H:\Apps\DCP-hw-wt` (branch `perf/hw-cost`). Everything below was read in the code or in
`docs/hw-eval/*`; where I did not verify something, it says so. **Nothing here was clicked through in a browser.**

## 0. What "Virat Evaluator" is (two things that share one name)

| Part | What it is | Who uses it |
|---|---|---|
| **Handwritten Assignments** (the product) | A teacher sets written questions; students answer by writing on a pad or typing; AI reads the handwriting and *suggests* marks; the teacher gives every final mark. | Students, teachers, institution admins |
| **Virat Evaluator** (the measurement system) | Everything that decides, with numbers, whether the AI reader and marker are good enough to show suggestions: datasets, an answer-key service, test runners, human rating tools, gates, shadow mode, monitoring. | Raters, the super admin, the developer |

The product runs on production, switched off. The measurement system has its screens, scripts and reports built, but the evidence it
exists to produce (real handwriting, real teacher baselines) has not been collected yet.

---

## 1. Philosophy: the rules every feature follows

1. **The AI only suggests; a teacher decides.** `services/marking.ts` is the only module that writes `hw_grade` (final marks). The AI path writes to `hw_ai_grade` and never imports it. `no-ai-final-grades.test.ts` greps for this.
2. **Measure, don't assume.** AI runs at the provider's default temperature, and repeatability is measured with 5 runs. A subject × question type × language is "Eligible" only when every gate in `stage1-design.md` §8 passes; otherwise "Not yet" (with reasons) or "Insufficient data". Items that fail or can't be grounded are counted and reported, never turned into numbers.
3. **No source, no key.** An answer key comes from an official scheme, the given passage, or the textbook, each with citations. If none exists the question is `no_grounding` and the teacher marks by hand. A model never writes a key from memory.
4. **Two different model families check each other.** Key writer ≠ key verifier; the mutation writer ≠ the grader. This reduces shared blind spots.
5. **The reader must not know the answer.** The reading prompt is not given the question, the model answer or the student's name, so it can't read the "right" answer into the handwriting. It must transcribe mistakes, use `[?]` for unreadable words, and never correct.
6. **Student text is data, never instructions.** Both prompts say so (injection defence). Injection resistance is a gate at 100%.
7. **Evidence or no credit.** The grader must quote the student's exact words, and code checks the quote is in *that student's own* transcript. A missing quote means the item becomes "missing" with 0 marks.
8. **Code does the arithmetic.** Totals are recomputed from the items; marks stay within bounds on a 0.5 grid; the model's sums are never used.
9. **Students never see the scheme.** No model answers, accepted answers or rubric reach a student, and marks appear only after the teacher *returns* the work.
10. **Humans are blind and pseudonymous.** Raters see only the item, never another rater's answer and never AI output. They appear by pseudonym.
11. **Immutable evidence.** Datasets never change (a change is a new version). Every run records its commit, config hash, tokens and cost. A regression gate blocks prompt/model changes that make it worse.
12. **Privacy and cost guard-rails.** Only de-identified work goes to providers. The feature is per-institution (off by default), has a monthly AI quota checked *before* every provider call, and every tunable is an environment variable validated in one place (`lib/hw/config.ts`).
13. **Offline-first for students.** Writing is saved on the device every 4 s; upload and hand-in wait for the network if needed.
14. **Hindi is first-class.** Whole product UI in English and Hindi, Devanagari handled in the reader, prompts, datasets and PDFs.

---

## 2. How a piece of work flows (end to end)

```
Teacher builds (draft)  → Publish → Student opens (draft) → writes/types, autosave, upload ink + PNG
   → Hand in → READ job (handwritten only) → transcript (or needs_review)
   → GRADE job per question (rules first, then AI) → AI suggestions on hw_ai_grade
   → Teacher marks (accept / edit / by hand) → hw_grade → Teacher returns → Student sees marks + concept feedback
```

- **Build.** Create the assignment (class, optional section, subject, title, due date, allowed modes), add questions from four type presets (very short, short, long, essay), write the prompt/marks/model answer, then the rubric: key points that must add up to the question's marks. "Draft with AI" proposes key points (`rubric-draft.v1`); a teacher can edit, reorder or delete them. Publishing is allowed only when the rules hold (marks bounds and publish triggers live in migration 014). After publishing only wording and due date can change; rubric changes retire old items and bump `rubric_version`, so every suggestion points at the wording it judged.
- **Answer.** Per question, Write (pen pad) or Type. The pad uses Pointer Events with pressure, ruled lines from `answer_lines`, undo/redo, stroke eraser, clear, palm rejection. Visible time per question is tracked. Pastes into typed answers are recorded for the teacher but not blocked.
- **Upload.** `POST /api/hw/submissions/:id/ink` takes the gzipped stroke JSON and the PNG drawn on the device. The server validates size, gzip, stroke schema, PNG header and width before storing to R2.
- **Hand in.** Typed answers are their own transcript. Blank questions mark as 0 without AI. If anything is handwritten, one read job covers the submission. Status goes `submitted → processing → ready_for_review → graded → returned`.
- **Read.** Tier 1 model reads; if confidence < 0.7 or more than 3 unclear words, escalate to tier 2; if still doubtful the answer becomes `needs_review` and the teacher reads the original (never left "pending"). The student may then tap words they think were misread (hints for the teacher only).
- **Mark.** Order: blank → 0; a one-mark answer equal to an accepted answer → full marks (with the cost flag on, in code); identical transcripts may be marked once (dedupe flag); otherwise AI in chunks of up to 10 answers per call, question block first for cache reuse. Output is validated (every answer and rubric item exactly once, quote-in-own-text, marks bounds, recomputed total). The job queue is Postgres (`hw_ai_job`, `FOR UPDATE SKIP LOCKED`), with backoff and a retry cap; batch API jobs sit in `batch_pending`.
- **Worker.** `POST /api/cron/hw-jobs`, called every minute by a Coolify scheduled task with `HW_CRON_SECRET` (refused if the secret is unset or under 32 characters). Each pass also does the 15-minute monitoring roll-up.
- **Return.** The teacher returns the assignment; only then can a student see marks, the teacher's comments and per-key-point marks.
- **Concept feedback.** After return, the student can see marks "concept by concept" (weakest first, with what to revise), built from the library knowledge graph. Off unless `LIBRARY_GRAPH_ENABLED`.

---

## 3. Frontend map and every button, by user type

All Handwritten Assignments pages sit inside `HwShell`: title, **language toggle (English ⇄ हिन्दी)**, and a gate that shows a message instead of a half-working page when the user has no institution, the feature is off, or their role isn't allowed. Strings: 365 keys, English and Hindi (`components/hw/strings.ts`).

### 3.1 Student
**Menu:** sidebar → *Learn → Assignments* (only when the institution has the feature on and the user is a student).
- `/dashboard/student/assignments`: three groups, **Pending / Submitted / Returned**. Each card: title, subject, marks, due date, **Late** badge, **Closed** badge, **Open** button.
- `/dashboard/student/assignments/[id]`:
  - Draft → **AnswerWorkspace**: numbered question buttons (1…n), **Write / Type** toggle (when both are allowed), the ruled pad (pen, undo, redo, eraser, clear), **Previous / Next**, **Submit** (asks confirmation, warns about unanswered questions). "Saved / Saving…" indicator, offline banner, "will send when you're back online" banner.
  - Submitted/processing → "being read" message, page re-checks every 20 s.
  - Read, not yet returned → **Check what we read**: tap any misread word, then **Save**.
  - Returned → total, **concept panel**, per-question transcript, key points with marks, teacher comment.

### 3.2 Teacher
**Menu:** teacher sidebar → *Assignments* (hidden unless the institution has the feature on). Teachers see only classes linked to them by the institution admin.
- `/dashboard/teacher/assignments`: cards with status badge (Draft/Published/Closed); **+ New assignment** → form (class, section, subject, due, title, instructions, Write/Type modes) → **Create**.
- `/dashboard/teacher/assignments/[id]`:
  - **Draft = Builder**: add-question buttons per type, per question: prompt, marks, language, answer lines, type, model answer, accepted answers (very short only), **Save**, up/down/delete; rubric editor: **Draft with AI**, add point, edit kind (key point/content/structure/language), marks, up/down/delete, running total vs question marks, **Save rubric**; **Publish** (confirmation, shows warnings).
  - **Published/closed = Overview**: one **Mark · Question n** button per question, **Close / Reopen**, **Return to students**, a class table (status, late, needs review, graded n/total), banners when AI work is waiting for a batch or fell back to standard, and failed jobs with their errors.
- `/dashboard/teacher/assignments/[id]/mark?question=…` (**Marking**): question picker, filters (All / Needs review / Low confidence / Flagged / Ungraded), **Accept all high-confidence (n)** (confirms the count), previous/next/student picker; left: handwriting image, **Original / Typed** toggle; right: transcript with highlighted quotes, `[?]` and student flags, **Fix transcript** (Save or Confirm), AI suggestion as rubric checkboxes with verdict and quote and a number box per item, confidence badge, **Accept (A)** or **Accept with changes**, **Mark by hand**, comment + **Save comment**. Keyboard: `J`/`K` next/previous student, `A` accept. The **Not an instruction** button and the "marked by rule / reused / shared" labels exist **only on the unpushed branch**.

### 3.3 Institution admin
**Menu:** institution sidebar → *Academics → Assignments*.
- `/dashboard/institution/assignments`: (1) *AI use this month*: pages read, answers marked, cost, and the quota line (read-only); (2) *Link teacher*: teacher, class, optional section, optional subject → **Link**; (3) the list of links with a delete button.

### 3.4 Parent
**No Handwritten Assignments screen exists.** The parent dashboard (attendance, billing, messages, progress, reports) has none, and `policy.ts` states "parent = no access in Phase 1 (there is no parent ↔ child link yet)".

### 3.5 Super admin
**Menu:** super-admin sidebar → *Insights → Evaluation* (`/dashboard/super-admin/evaluation`).
- **Raters**: add a rater (account email, pseudonym, skills), edit skills, activate/deactivate, see waiting/done counts. Skills: `transcribe`, `deidentify`, `adjudicate`, `mark:<subject>`, `audit:<subject>`. Students and parents cannot be raters.
- **Tasks for a dataset version**: pick/enter `name@vN`; per task kind (Transcription, Blind marking, Key audit, De-identification) see status counts and **Create tasks**; **Assign open tasks to raters**; **Download reference export** (agreed/adjudicated values, with each rater by pseudonym).

### 3.6 Raters (the human evaluators)
**No menu entry; they go to `/evaluate` directly.**
- `/evaluate`: *Your tasks* (waiting/done, **Start next task**), *Disagreements to resolve* (adjudicators only; never your own tasks), *Copy texts on the writing pad*.
- `/evaluate/task/[assignmentId]`: one of four forms: **Transcription** (image, type exactly what is written, **Insert [?]**), **Blind marking** (marks per key point, note), **Key audit** (verdict per point), **De-identification** (draw boxes, **Undo last box / Clear**, **Clean** or **Needs blanking**).
- `/evaluate/adjudicate/[taskId]`: resolve a disagreement, starting from rater A's answer, with a reason.
- `/evaluate/copy`: copy a given text on the ink pad; the ink and PNG go to `/api/hw-eval/copies` and become reading-test items.

---

## 4. Backend map

| Area | Where | Notes |
|---|---|---|
| tRPC | `lib/trpc/routers/hw.ts`, `hw-eval.ts` | `hw.status/presets`, `assignments.*`, `questions.*`, `rubric.*`, `classTeachers.*`, `student.*`, `marking.*`, `admin.usage/setQuota`; `hwEval.me/queue/open/submit/adjudications/adjudicate/copies/admin.*` |
| HTTP | `apps/api/src/app/api/…` | `hw/submissions/:id/ink`, `hw/submissions/:id/concept-feedback`, `cron/hw-jobs`, `hw-eval/media` (image served per request after an assignment check, no signed URL), `hw-eval/copies` |
| Access | `lib/hw/access/{actor,guards,policy}.ts` | Roles from verified membership: admin, teacher, student, parent (no access), none. Every endpoint loads the row, checks the org, then applies a pure rule |
| Services | `lib/hw/services/{assignments,submissions,marking}.ts` | Teacher build, student side, teacher marking |
| Reader | `lib/hw/reader/*`, `prompts/read.v1.ts` | Gemini (tiers + escalation), Sarvam option, OpenRouter, OpenAI |
| Grader | `lib/hw/grader/*`, `prompts/grade.v1.ts`, `grade-strict.v1/v2.ts` | Rules, exact match, AI, dedupe, strict four-verdict marking, partial-credit setting, instruction screen |
| Jobs | `lib/hw/jobs/*` | Queue, read/grade handlers, homework batch, runner |
| Keys | `lib/hw/keys/*` | Answer-key service. **Used by the evaluation scripts only**; the product marks against the teacher's rubric, not these keys |
| Eval | `lib/hw/eval/*`, `scripts/hw-eval-*.ts` | Metrics, datasets, mutations, near-miss, runner, gates, regression, reports, cost projection |
| Human tools | `lib/hw/eval-tools/*` | Tasks, assignments, blind payload checks, copies, source |
| Shadow/monitoring | `lib/hw/shadow/*` | Sampled candidate runs and daily roll-ups |
| Cost | `lib/hw/cost/*` | Price table, usage, quota |
| Data | `db/hw-schema.ts` (014), `hw-eval-schema.ts` (015), `hw-cost-schema.ts` (019, 020) | See below |

**Tables.** Product: `hw_class_teacher`, `hw_assignment`, `hw_question`, `hw_rubric_item`, `hw_submission`, `hw_answer`, `hw_transcript_revision`, `hw_ai_job`, `hw_ai_grade`, `hw_grade` (+ append-only `hw_grade_history`), `hw_ai_usage_monthly`, `hw_tenant_quota`; reserved and unused: `hw_writing_calibration`, `hw_answer_group(_member)`. Evaluator (015): `hw_eval_rater`, `_task`, `_assignment`, `_submission`, `_adjudication`, `_consent`, `_shadow_result`, `_monitor_daily`. Cost (019, 020, **not applied to production**): shared-key and dedupe tables, and `hw_instruction_flag`.

**Feature flags (all default off):** feature per institution via `hw_tenant_quota.enabled` (or `HW_FEATURE_DEFAULT_ENABLED`), `HW_EVAL_TOOLS_ENABLED`, `HW_SHADOW_RATE`, `HW_HOMEWORK_BATCH_ENABLED`, `HW_SHARED_KEYS_ENABLED`, `HW_CODE_MARKING_ENABLED`, `HW_DEDUPE_MARKING_ENABLED`, `HW_INSTRUCTION_GUARD_ENABLED`, `HW_OPENAI_EXPLICIT_CACHE_ENABLED`; `HW_PARTIAL_CREDIT_RULE` = `zero` (teachers' decision pending).

**Tests:** 389 test cases across 21 files in `apps/web/src/__tests__/hw` (counted by pattern; phase 1d reported 402 passing, 2 skipped).

---

## 5. The measurement system, in one page

- **Datasets** (immutable manifests, six sources A–F: volunteers' known texts, constructed answers, real student answers, previously checked copies, teacher double-marked sets, key audit sets). **Mutation rules** (remove a point, wrong fact, wrong arithmetic, missing unit, paraphrase, spelling, Hindi/mixed version, padding, injection, near-miss) give answers whose correct marks are known by construction.
- **Runner** (`npm run hw:eval`): modes `read`, `key`, `mark`, `e2e`, with budget caps and resume. It calls the reader/keys/grader as libraries and never writes a student-facing table.
- **Metrics:** CER (code points and graphemes), WER, invented-text rate, QWK, MAE, bias, detection, false credit, invariance, injection resistance, repeatability (all-five-identical, ICC), reading-error effect, bootstrap CIs by answer.
- **Gates** (`hw:eval:report`): marking agreement vs teacher baseline, ≤5% large errors, ≥95% detection, ≤5% false credit, 100% injection resistance, ≥90% repeatability, group gaps ≤0.05, keys audited ≤2% error, ≥60 answers and ≥30 double-marked.
- **Regression gate** (`hw:eval:regression`): a paired, noise-aware comparison against a baseline run. Required before merging prompt/model/route/key changes.
- **Shadow mode and monitoring:** a sampled share of live answers is also run with a candidate configuration, results saved only in `hw_eval_shadow_result` (never shown); daily roll-ups of override rate/size, transcript fixes, misread flags (`hw:eval:live`).
- **What the small real run showed (25 Oct, ₹24.84 of ₹100, synthetic images):** reading CER 0.09%, marking QWK 1.0 on 39 constructed answers, repeatability 94.9%; one "Not yet" (Social Science, source-based, Hindi). **This is not a measurement of real handwriting.**
- **The cost work (phases 1–1d, on `perf/hw-cost`, not pushed):** measured cost per student-month ₹6.87 today → ₹3.14 with the five flagged savings → ₹1.22 cheapest combination; strict four-verdict marking and a partial-credit setting; the 155-item `heldout-1d@v1`; a decision kit for teachers.

---

## 6. What is built and what is remaining, per user type

Legend: **Built** = code exists and is tested in the repo; **Not live** = on `main` in production but switched off; **Branch only** = on `perf/hw-cost`, not pushed.

### Student
- Built / not live: assignment list, ink and typed workspace, offline queue, hand-in, "check what we read", returned result, concept feedback (needs `LIBRARY_GRAPH_ENABLED`).
- Remaining: **photo answers** (the server explicitly rejects them: "arrive in a later update"). No practice mode ("AI feedback without marks") found in the code I read, though design decision 3 plans one. Real-device testing on tablets/phones with pens, which only the pilot gives.

### Parent
- Built: nothing. The role exists in policy but has no access.
- Remaining: a parent ↔ child link, a policy for what a parent may see (returned marks? feedback?), and screens in the parent dashboard. This is a product decision first; the pilot plan doesn't include parents.

### Teacher
- Built / not live: create, build, AI-drafted rubric, publish, overview, marking with suggestions, bulk accept, transcript fix, return.
- Branch only: "Not an instruction" button, labels for marks given by rule / reused / shared, batch-wait banners.
- Remaining: no gradebook/export, no class-level analytics, no view of grade history (the history table exists but I found no screen that reads it). Whether suggestions should be shown at all is decided by the gates, which are not yet passed.

### Institution admin
- Built / not live: link teachers to classes, see this month's AI use and the quota.
- Remaining: **no screen to switch the feature on or set the quota** (`admin.setQuota` exists, no UI calls it, and it's platform staff only: today it needs a database edit); no results/completion/class outcomes view; no per-teacher or per-class usage breakdown.

### "Admin" dashboard (`dashboard/admin`)
- Contains only live classes and Zoom. No Handwritten Assignments or Evaluator pages.

### Super admin
- Built / not live: raters, tasks, assignment, reference export.
- Remaining: **no gate table, no monitoring dashboard, no regression/shadow view** (all command-line scripts); **no tenant switch/quota screen**; no screens for consent records (`hw_eval_consent` exists as a table) or for choosing/viewing datasets and runs beyond the task list.

### Raters / evaluators
- Built / not live: queue, four task forms, adjudication, copy tasks.
- Remaining: **no menu link** (URL only); English-only; real use needs the volunteers, the consent forms and the datasets.

### Platform-level (not a user type, but it blocks all of them)
- Real-handwriting data and teacher baselines; `HW_KEY_R_MIN` calibration (you run it); Class 9–10 Science/SST books in English and Hindi medium ingested; frozen `regression@v1`; teachers' answer on partial credit; person-check of `heldout-1d@v1`.
- Cost work: ~₹84 of runs waiting for an OpenRouter top-up; Gemini/OpenAI probes need real keys; migrations 019 and 020 and the `perf/hw-cost` branch need your go-ahead to push or apply.

---

## 7. Where to read more
`docs/hw-eval/stage1-design.md` (design and formulas) · `pilot-plan.md` (the 4-step pilot) · `regression.md` · `small-run-report.md` · `cost-phase1*.md` · `verdicts.md` · `partial-credit-decision.md` · `migration-019/020-runbook.md`.
