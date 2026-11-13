# Handwritten Assignments and Virat Evaluator: roadmap to the pilot and launch

Version 1, 3 Nov 2026. This file lives at `docs/hw-eval/roadmap.md`.

## How to use this file

**Claude Code:**
- Read this whole file at the start of every session.
- Work only on the phase you are told to do, and follow the standing rules in §2.
- Stop at every **STOP**, report, and wait for the owner.
- At the end of a session, update §9 Status and add one line to §10 Log, in the same commit as the work.

**Owner (vpro):** say "Do phase N" or "Continue phase N". Items marked **YOU**, **TEACHERS** or **SCHOOL** are not Claude Code's work; Claude Code prepares what those people need.

---

## 1. Where things stand (3 Nov 2026)

- **Product:** built, on `main`, deployed and switched off in production.
  - The student and teacher flows are complete.
  - The institution admin side is partial.
  - Parents have nothing.
- **Evaluator:** the tools, runner, gates, shadow mode and monitoring are built. The evidence they exist to produce has not been collected: real handwriting, teacher baselines and the `HW_KEY_R_MIN` calibration.
- **Branch `perf/hw-cost`:** cost phases 1 to 1d, not pushed.
  - Migrations 019 and 020 are applied nowhere.
  - About ₹84 of phase-1d runs are waiting for an OpenRouter top-up.
  - The Gemini and OpenAI direct batch probes are waiting for real dev keys.
- **The guide:** `docs/hw-eval/virat-evaluator-guide.md` is written but not committed.
- **Open decisions:** listed in §8.

---

## 2. Standing rules (every phase)

### Repository
- npm only. Work on the branch the phase names.
- A push to `main` is a production deploy. Never push or merge without the owner's explicit go-ahead in the same session.
- Never stage the uncommitted rate-limit change in `packages/core/src/auth/main auth/index.ts`. Check `git status` before every commit and stage files by name, never with `git add -A` or `git add .`.
- Postgres only.
  - Migrations are additive and follow expand → deploy → migrate → contract. Never rename between deploys.
  - Rehearse every migration, including its rollback, on a scratch DB with the production schema (schema only, no production data).
- R2 writes go only under `hw-assignments/`, and any cleanup is prefix-scoped.
- Don't write to the shared Qdrant collection or the `trio` content schema unless the phase says so.
- Never print or log a secret.
- Never set or change a production env var, quota or flag unless the phase says so and the owner approved it in that session.
- Until Phase 5.3 ships, never create a `hw_tenant_quota` row in production. A quota row is the only gate before AI marking, and the product checks no eligibility.

### Feature principles (from guide §1; never weaken one)
- **Marks:** the AI only suggests. Only `services/marking.ts` writes `hw_grade`.
- **Keys:** no source, no key. Key writer ≠ key verifier family, and mutation writer ≠ grader family.
- **Reading:** the reader isn't told the answer.
- **Student text:** it is data, never instructions.
- **Evidence:** every credited point quotes the student's own transcript. Code does the arithmetic.
- **Visibility:** students never see the scheme, and see marks only after the teacher returns the work.
- **Raters:** blind and pseudonymous.
- **Data:** datasets are immutable. Only de-identified data goes to providers. The quota is checked before every provider call.

### Measurement
- Measure, don't estimate, and report counts alongside percentages.
- Change no profile after seeing its held-out results.
- Print the estimated spend before every run, and respect the phase's cap.

### New for the control room
- **Audit trail:** every super-admin change (feature switch, quota, eligibility, thresholds, consent) writes an append-only audit row: who, when, old value → new value, and reason. The database blocks updates and deletes on that table.
- **Money and time:** store money as integer paise. Use Asia/Kolkata (IST) day and month boundaries.
- **One source of numbers:** screens show stored results and never recompute them differently from the CLI. A test checks that a screen and `hw:eval:report` agree for the same run.
- **Privacy in views:** monitoring views show aggregates only, apply the minimum group size, and carry no item ids or names.
- **Language:** every new screen gets English and Hindi strings, like the rest of the product.
- **No silent failures:** every failure gets a visible status and a reason.

---

## 3. The super-admin plan, upgraded

The original question was whether to build one super-admin screen for quota, gates and monitoring. Those three are needed at different times. A gates screen also does nothing unless the product obeys it. So the plan changes in five ways.

### 3.1 What changes

1. **Build in the order the pilot needs things, not screen by screen.**
   - Before pilot step 1: consent records and rater access.
   - Before step 4: tenant control, eligibility and monitoring.
   - Views of runs, gates, regression and shadow results are a convenience, because the CLI already produces them.
2. **Gates become an eligibility registry that the product obeys.** A read-only gate table can't stop the product from showing suggestions in a group that failed. The guide doesn't say the product checks eligibility anywhere (Phase 1 verifies this). The registry records, for each group:
   - its status;
   - the gate run, dataset versions and configuration hash the status rests on.

   It then works like this:
   - The product shows suggestions only in Eligible groups.
   - A configuration change voids eligibility until the regression gate passes.
   - Monitoring can demote a group automatically.
3. **The quota is in rupees, with an audit trail.** Money is what matters for margin, and tokens don't map cleanly to it. `admin.setQuota` exists but has no screen, so today changing a quota needs a database edit.
4. **One monitoring view, two scopes.** The super admin sees every institution. An institution admin sees only their own, as the pilot plan requires ("partner schools see their own monitoring only").
5. **A group is subject × question type × language × scheme source.** The scheme source is a textbook key, a board-paper key or a teacher's rubric. It is added because the product would otherwise mark custom questions against teacher rubrics that the pilot never measures.

### 3.2 The control room

These are tabs on the existing `/dashboard/super-admin/evaluation` page (*Insights → Evaluation*).

| Tab | What it does | Needed by | Phase |
|---|---|---|---|
| **Consent** | Record and withdraw consent; withdrawal excludes the person from the next dataset version | Pilot step 1 | 3 |
| **Raters & tasks** (exists) | Adds email invitations for raters | Pilot step 1 | 3 |
| **Tenants** | Feature switch, pilot class allow-list, ₹ quota, usage, change history | Pilot step 4 | 5 |
| **Eligibility** | Status per group, promote and demote with reasons, history | Pilot step 4 | 5 |
| **Monitoring** | Daily figures per group, alerts, automatic demotion | Pilot step 4 | 5 |
| **Runs & gates** | Datasets, runs, gate tables, regression and shadow results (read-only) | Convenience | 5 |

### 3.3 Gaps found while planning

Phase 1 verified each of these on 4 Nov 2026 (file and line for each are in `roadmap-phase1-report.md`); the named phase fixes it.

1. **The product does not read gate results. VERIFIED.** Nothing checks eligibility before an AI suggestion is created or shown; the only gate is the quota (`grade-handler.ts:91-98`, `read-handler.ts:58-66`). Build in Phase 5.
2. **Raters need an invitation flow, not accounts. VERIFIED, and corrected.** Self sign-up has been open since 16 Aug (`auth/index.ts:150-157`, email verification required), so volunteers can already create accounts. What is missing is an invitation flow: today a super admin can add a rater only for an existing account (`eval-tools/admin.ts:47-50`), and a rater has no isolation from product pages. Phase 3.
3. **No consent screen.** Step 1 needs volunteer consent, and sources C and D need parents' consent. Phase 3.
4. **The rater tools are English only.** Hindi-medium teachers will be raters. Phase 3.
5. **The key service is used only by evaluation scripts, and questions have no source field. VERIFIED.** Phase 5, after decisions D2 and D3.
6. **"Draft with AI" can break the no-key-from-memory principle. VERIFIED.** It uses the teacher's model answer when there is one and the model's own knowledge when there is none (`rubric-draft.v1.ts:17, 40`), and publishing does not require a reviewed rubric (`assignments.ts:146-150`). Fixed in Phase 3, task 3.4.
7. **No photo answers.** Most students have phones, not pen tablets. Step 4 needs either a school with tablets or photo capture. Decision D4; Phase 5P.
8. **The feature switch is per institution. VERIFIED.** There is no class, section or teacher allow-list (`guards.ts:25-29`). A pilot can be confined indirectly by linking only pilot teachers and classes, except that an institution admin can create for any class. Phase 5.
9. **The quota's unit and month boundary. VERIFIED.** It is an answer count shared by reading and marking (`quota.ts:1-5`), the month is the UTC month (`db.ts:17-20`, so it starts at 05:30 IST), and a missing quota row means quota 0. Cost is recorded in paise but is not what the quota compares. Migrate in Phase 5.1.

---

## 4. Roadmap at a glance

| Phase | What | Owner | Needs | Rough time |
|---|---|---|---|---|
| **1** | Finish the cost work, verify the gaps, merge `perf/hw-cost` | Claude Code; YOU approve the merge | Keys or an OpenRouter top-up | 1–2 sessions |
| **2** | Pilot step 0: content and decisions, no students | YOU, TEACHERS; Claude Code supports | Phase 1 | 1–2 weeks (pilot plan) |
| **3** | Build A: consent, rater invitations, Hindi rater tools | Claude Code | Phase 1 merged | 2–3 sessions |
| **4** | Pilot steps 1–3: evidence for reading, keys and marking | YOU, SCHOOL, TEACHERS; Claude Code runs and reports | Phases 2 and 3 | 3–5 weeks (estimate) |
| **5** | Build B: tenants, scheme source and keys, eligibility, monitoring, run views | Claude Code | Phase 1; D2 and D3 for task 5.2 | 4–6 sessions, alongside Phase 4 |
| **5P** | Photo answers (if D4 says so) | Claude Code | D4 | 2–3 sessions, alongside Phase 4 |
| **6** | Pilot step 4: classroom, suggestions only in Eligible groups | SCHOOL, TEACHERS, YOU; Claude Code monitors | Phases 4, 5 (and 5P) | 4–6 weeks (pilot plan) |
| **7** | Pilot report and launch decision | YOU decide; Claude Code drafts | Phase 6 | about 1 week |
| **8** | After launch: teacher, institution and parent features | Claude Code | Phase 7 | ongoing |

---

## 5. Phase details

### Phase 1: finish the cost work, verify the gaps, merge

**Branch:** `perf/hw-cost`. **Spend cap:** ₹150.

1.1 **Commit the docs.** Commit `docs/hw-eval/virat-evaluator-guide.md` and this roadmap.

1.2 **Pending phase-1d runs.** If there is OpenRouter credit or a direct key, run the pending runs (about ₹84). If not, say so and skip.

Report the leak rate first: how often a reversed fact gets the verdict `right_idea_wrong_detail` instead of `different_fact`, for each candidate. A leak that appears for one model and not for another, under the same wording, points to that model's behaviour, not to the wording. The wording is suspect only if **every** candidate leaks, and then **STOP**: it needs fixing before the teachers see the decision kit. (Corrected 4 Nov 2026: the rule first said any leak over 5% stops the work.)

1.3 **Direct batch probes.** If the keys are present, run the Gemini and OpenAI round trips. Report:
- submit-to-complete time;
- whether OpenAI's batch accepts base64 images;
- the price actually charged;
- a recommendation of E0 or E1.

1.4 **Verify the gaps.** For each item, report with file and line. Don't fix anything in this phase.
- a) Does the product check any eligibility before creating or showing AI suggestions?
- b) What unit does `hw_tenant_quota` use, how is usage counted, and in which time zone does the month start?
- c) What does `rubric-draft.v1` draw on: only the teacher's model answer, textbook passages, or the model's own knowledge?
- d) Can the feature be switched on for part of an institution (a class, section or teacher)?
- e) How is a rater account created today, given the state of DCP sign-up?
- f) Does `hw_eval_monitor_daily` have every field task 5.4 needs? List what's missing.
- g) Does any path show a student or parent anything before the teacher returns the work?

1.5 **Merge readiness.**
1. Merge `main` into the branch, then run the full test suite, build and typecheck.
2. Rehearse migrations 019 and 020 together, with rollback, on a scratch DB with the production schema.
3. Write `docs/hw-eval/merge-hw-cost-runbook.md`: backup → apply 019 and 020 → push the merge to `main` with every flag off → the checks in 1.6.

**STOP.** Wait for the owner's go-ahead.

1.6 **After the go-ahead.**
1. Run the runbook.
2. Then check, and report each result:
   - containers are healthy, with 0 restarts;
   - the feature is still off for every institution, and every new flag is off;
   - `/api/cron/hw-jobs` still refuses requests without the secret;
   - the error logs are clean for 30 minutes.
3. Tag the commit `hw-cost-merged-<date>`.

**Exit:** the branch is merged, the migrations are applied, the tag is pushed, and §9 is updated.

---

### Phase 2: pilot step 0, content and decisions (no students)

This phase is mostly people's work. Claude Code's tasks are marked.

2.1 **Books (pilot 0.1).** Get the pilot's books into the shared library through the PDLMS hub (the only writer of `trio.library` and the Qdrant collection `library_v2_te3l_3072`).

**Where things stand (checked read-only on production, 4 Nov 2026; details in `phase2-support.md` and the findings below):**
- **Inventory: one book.** NCERT Science, Class IX, **English** (`sci9-en`, ISBN 8174504923, edition "Reprint 2025-26", 12 chapters, 987 passages). There is no Social Science, no Class 10 and no Hindi-medium book. The earlier plan's premise (Class 9 SST twice, Class 11 Geography) no longer holds.
- **Why the earlier books are gone: deliberately, on 26 Oct.** The library hub plan (`PLAN-library-hub-v2.md`, Phase 8) says all current book content is wiped and reloaded. On 26 Oct 2026 at 17:05:50 UTC the old Qdrant collection `trio_content_v1_openai3072` was deleted (`DELETE /collections/…` from the host, `curl/8.5.0`) and at 17:07 UTC a `TRUNCATE content.*` ran (its first attempt is in the Postgres log, refused by a foreign key from `notes.note`; the `content` tables are now empty and `notes.note` has 0 rows). The only backups of the old collection are daily snapshots up to 27 Aug; no dump of `trio.content` or of the collection from 25–26 Oct was found in `/root/backups`. The books' sources (enriched Markdown) are re-ingestable.
- **A path that can delete ingested books, found and reported first:** Qdrant on the shared Docker network has **no API key** (`QDRANT__SERVICE__API_KEY` is unset), so any container or host process on that network can delete a collection or its points. That is what the 26 Oct deletion used. The library code's own deletes are scoped (previews by work, revision and status; points by explicit id; Postgres rows by chapter revision or work), and no application path deletes a whole work or the collection. Nothing should be ingested until the owner has decided whether to put an API key on Qdrant (and give every client the key) or to keep the network the only protection, and has a snapshot schedule for `library_v2_te3l_3072` (the old collection's daily snapshots stopped on 27 Aug).
- **The ingest lane:** the last success was 26 Oct (12 live runs after four early failures on a database check). It has not run since, so it is **unproven for a new book, for Hindi-medium text, and for today's build**.
- **Hindi readiness, without ingesting (found by reading the code):**
  - Ready: the dense model (`text-embedding-3-large`) and NFC normalisation; the sparse tokenizer keeps Devanagari combining marks (`\p{M}`) and hashes UTF-8 bytes (pinned in its header and fixtures; not run here); `hindi` maps to the medium code `hi`; each work has its own ISBN and `book_code`, a work has one medium, and hub search filters works by medium (`resolveScope`), which DCP's key service already sends (`hub-retrieval.ts:53`, with the reason `no_book` when none exists). `LIBRARY_HUB_ENABLED` is true in production.
  - **Gaps:** (1) the medium defaults to English when the manifest's medium is missing or unrecognised (`library-hub.service.ts:133`, `library-hub.controller.ts:58`), so a Hindi book must be checked after upload; (2) the Markdown parser's structural labels (Activity, Fig., Table, Example, Questions, Exercises) default to the Science IX English set, and no per-book labels are passed in the upload hub path, so a Hindi book needs its own labels pack and that wiring; (3) the prep skill is Science IX English; a Hindi pack is needed; (4) no stemming or stopwords in the sparse tokenizer (by contract), so Hindi inflections rely on the IDF weighting; (5) `R_min` has to be calibrated per medium.
  - "Fix the medium filter in Gyankosh search" is superseded: the old payload filter pointed at the deleted collection; the live path is the hub's work-level medium filter above. It has not been exercised with a Hindi book, because none exists.
- **Claude Code first, before any ingest:** confirm the owner's decision on the Qdrant key and snapshots; then run a one-chapter test ingest of the English book to a scratch collection (not the shared one), then the Hindi labels pack and a one-chapter Hindi test, before the full books.
- **Then:** each chapter goes prep app → enriched Markdown → ingest.
- **Owners:** YOU prepare chapters and decide D11; Claude Code builds the Hindi labels pack and wiring and ingests. This touches the PDLMS repo, so follow that repo's rules.

2.2 **`HW_KEY_R_MIN` calibration (pilot 0.2).** Calibration has to run **on the server**: `scripts/hw-key-calibrate.ts` needs Qdrant, the trio database and a real OpenAI key, none of which this development machine has. Run it per medium (English now; Hindi once a Hindi book is in).
1. Claude Code exports 60 question → passage pairs as a labelling sheet.
2. YOU (or a teacher) label them.
3. Claude Code runs `scripts/hw-key-calibrate.ts` and reports the value.

Production holds 0.50 today, uncalibrated. Changing it needs the owner's approval.

2.3 **CER line breaks (pilot 0.4).** Record decision D7. Claude Code then sets the reader prompt and the metric to match.

2.4 **Partial credit and verdict definitions (pilot 0.6).**
1. TEACHERS use `partial-credit-decision.md` and `verdicts.md` (released to the teachers on 4 Nov 2026; see §8 for the leak decision). M0-strict stays a candidate only if the teachers choose `zero`, or if its leak on `heldout-1d@v1` is at most 5% (that check is blind to reversed facts, because those labels come from how the set was built).
2. Claude Code then:
   - sets `HW_PARTIAL_CREDIT_RULE`, per subject if the teachers chose that, in the evaluation config;
   - updates the expected marks in the mutation rules;
   - recomputes the strict runs from their stored verdicts.

2.5 **Person-check of `heldout-1d@v1`.**
1. A Hindi-reading TEACHER checks every item on the exported sheet.
2. Claude Code applies the corrections as `heldout-1d@v2` and reports again.

2.6 **Instruction phrases.** YOU review `grader/instruction-phrases.json`, especially the Hindi and Hinglish patterns.

2.7 **Decisions.** YOU decide D2, D3, D4, D7 and D8.

2.8 **Recruiting.** YOU and SCHOOL find:
- 1–2 partner schools;
- 10–15 adult volunteers;
- two teachers per subject × medium;
- one expert auditor per subject.

Claude Code drafts the consent forms in Phase 3.

Pilot 0.3 (numerical keys) was done in `6fc23e0`. Pilot 0.5 (freezing `regression@v1`) happens in Phase 4, after step 1.

**Exit:**
- the books are indexed and filterable by medium;
- `HW_KEY_R_MIN` is calibrated;
- D2–D8 are recorded in §8;
- `heldout-1d` has been person-checked.

---

### Phase 3: build A, for pilot steps 1–3

**Branch:** `feat/hw-pilot-a`.

3.1 **Consent tab.**
- **A record holds:**
  - subject type: volunteer, student, or parent for a student;
  - pseudonym and institution;
  - scope: which sources (A–F) and which uses (evaluation, shadow, report);
  - form version, date signed and who collected it;
  - the form scan, stored privately under `hw-assignments/eval/consent/`;
  - status: active or withdrawn, with the date.
- **Identity:** the link from a record to a real account or name is visible only to the super admin.
- **Gate:** the copy task, source C transcription and source D intake refuse any item whose subject lacks active consent covering that source.
- **Withdrawal:** a single action. The next dataset version excludes the person. Frozen versions stay unchanged, as datasets are immutable, but the runner refuses to run a version that contains a withdrawn subject and points to the newer version.
- **Forms:** draft the volunteer, parent and student-assent forms in English and Hindi. YOU get them legally reviewed; Claude Code isn't giving legal advice.

3.2 **Rater access.**
- **Invite by email** from the Raters tab. Self sign-up works, so the invitation email carries the sign-up link; once the person verifies their email, the rater role and the pseudonym are assigned automatically. "Add a rater by account email" stays as it is, for people who already have an account.
- **Isolation:** a rater cannot open any product page.
- **Menu:** an "Evaluate" entry for users with the rater role.
- **Language:** Hindi strings and the language toggle for `/evaluate`, every task form, and adjudication.

3.3 **Volunteer flow check.** Write a manual test script for the copy flow on a Samsung tablet with S Pen and on a phone, and confirm the printable copy sheets render in both languages.

3.4 **"Draft with AI" (gap 6).**
- **No model answer, no draft:** disable the button when the question has no model answer, with the hint "Add a model answer first".
- **Source:** draft only from the teacher's model answer, never from the model's own knowledge.
- **Label:** drafted points are labelled "AI draft" until the teacher saves the rubric.
- **Publish:** block Publish while any unsaved AI-draft point exists.
- **Tests:** one test for each of these four rules.

**Acceptance:**
- tests show the consent gate refusing, withdrawal excluding the person and the runner refusing, the invitation working (sign-up link, automatic rater role after verification), and raters blocked from product routes;
- the four tests for task 3.4 pass;
- the Hindi strings are complete;
- the migration rehearsal passes.

**STOP** before merging.

---

### Phase 4: pilot steps 1–3, the evidence

This phase follows `pilot-plan.md` and uses the profiles in `pilot@v1` as updated in Phase 2.

**Step 1: reading (sources A and C).**
- **People:** volunteers copy 20–30 texts each, on the pad and on paper. Targets: at least 300 items per language and at least 100 per handwriting band, half on the pad and half on paper. 200 real student answers from consenting classes are each transcribed by two people.
- **Claude Code:**
  1. Generate the copy-sheet packs.
  2. Run `read` and `e2e` for R0, R1, R-luna (English), E0 and E-sarvam (Hindi).
  3. Report CER, WER and invented text per language, handwriting band and device; the escalation rate; and ₹ per page on real handwriting.
  4. Recommend a reading route per language.
  5. Freeze `regression@v1` and record the production baseline (pilot 0.5).

**Step 2: keys (source F).**
1. Build K0 keys for every pilot question.
2. An expert audits 20%, at least 30 per subject × medium. **The sample is stratified by origin** (textbook exercise, board paper, custom): at least 20 keys for each origin per subject × medium, so the 2% gate is measured on teacher-written questions too (decision D3).
3. The gate is an audit error of at most 2%.

**Step 3: marking (sources B, D and E).**
- **Data:**
  - mutation sets: 30 questions × all rules, person-checked (10%, at least 20 per rule), and copied by the step-1 writers;
  - teacher baseline: two teachers × 50–60 answers per subject × medium, adjudicated where they differ;
  - source D: 200 previously checked copies;
  - repeatability: 5 runs on 100 answers per subject.
- **Profiles:** M0-guarded, M0-strict and M1-strict, with the grouping-effect check on the grouped profiles.
- **Claude Code reports:**
  - the gate table per group;
  - the cheapest passing configuration per group;
  - cost per student and per teacher at measured real costs.

**Exit:**
- every group shows Eligible, Not yet or Insufficient data;
- a configuration is chosen for each group;
- `regression@v1` is frozen with a baseline;
- the costs come from real handwriting.

---

### Phase 5: build B, for pilot step 4

**Branch:** `feat/hw-pilot-b`. It can start once Phase 1 is merged; task 5.2 also waits for D2 and D3.

5.1 **Tenants tab.**
- **Per institution:**
  - the feature switch;
  - an optional allow-list of classes and sections, for pilots;
  - a monthly quota in rupees, with IST months;
  - this month's usage: pages read, answers marked, and ₹.
- **Quota behaviour:** a warning at 80%. At 100%, the existing rule applies: answers become `needs_review` with the reason "AI quota reached", shown to the teacher and admin.
- **History:** every change writes an audit row with a reason, and the history is visible on the tab.
- **Consistency:** the institution admin's existing usage card shows the same numbers (add a test).
- **Migration:** the quota moves from an answer count shared by reading and marking, with a UTC month, to paise with an IST month, using expand → migrate → contract (verified in 1.4b: `quota.ts:1-5`, `db.ts:17-20`). A missing quota row stays "AI off".

5.2 **Scheme source and keys in the product** (D2 and D3 decided 5 Nov 2026; **built** on `feat/hw-pilot-b`, migration 027). Delivered: question origin (textbook exercise, board paper, custom) with its reference, an optional passage, key statuses (building, ready, partial, no grounding, failed, not available) shown in the builder, the key as a read-only rubric with citations, "Use my own rubric instead", scheme source (`board_scheme_key`, `passage_key`, `textbook_key`, `teacher_rubric`) on the question, in the eligibility group key and on every suggestion with the key id and version, the marking-time check (key-service version, R_min and settings, question, book text) with a queued rebuild, key spend inside the monthly budget with a separate "keys" line, and the publish preview of hand-marked questions. The original brief follows.
- **Source field:** each question gets a `source` of textbook exercise, board paper or custom, with the book and chapter for textbook questions.
- **D2, recommended option A with C as the backstop:**
  - For textbook and board questions, the key service builds the key at authoring, or reuses it from the shared library. The teacher sees it as the rubric.
  - At marking time, the key is used only if it is still fully supported. Otherwise there is no suggestion and the teacher marks by hand.
- **Custom questions:** follow D3. The recommendation is that they're hand-marked during the pilot, and teacher-rubric marking becomes its own measured group later.
- **Gap 6:** depending on 1.4c, make "Draft with AI" draw only on the teacher's model answer or the textbook, never the model's own knowledge, and label drafted points as drafts.

5.3 **Eligibility tab and registry.**
- **What it stores:** the group key (subject, question type, language, scheme source); status (`insufficient_data`, `not_yet` or `eligible`); gate run id; dataset versions; configuration hash; who decided, when, and why. The history is append-only.
- **Product rule:**
  - AI suggestions are created and shown only for an Eligible group whose configuration hash matches the running configuration.
  - Everywhere else there is no suggestion, and the teacher marks by hand. Shadow runs at `HW_SHADOW_RATE` and stays hidden.
  - The default for every group is not eligible.
- **Promotion:** only from a gate run that passes for that group. The run's numbers are shown on screen, and promotion needs a typed reason and a confirmation.
- **Demotion:** manual with a reason, or automatic (task 5.4).
- **Configuration change:** when the running hash differs from the promoted one, the group shows "configuration changed: run the regression gate" and suggestions stop until a passing regression run is linked.

5.4 **Monitoring tab.**
- **Figures per group, per IST day and rolling 7 days:**
  - answers, and suggestions shown;
  - accepted unchanged, edited, or replaced by hand;
  - mean override and large overrides;
  - transcript fixes and misread taps;
  - instruction flags and "not an instruction" taps;
  - failed jobs and batch fallbacks;
  - batch turnaround at p50 and p90;
  - ₹ per answer, actual against projected;
  - quota burn per tenant.
- **Alerts and demotion:** the owner sets thresholds in config. A breach, with at least the minimum number of answers, demotes the group to `not_yet` automatically, with the reason, an audit row, and an email to the super admin.
- **Institution view:** the institution admin sees the same view scoped to their own institution, as aggregates only, with the minimum group size applied.
- **Migration for the missing fields (verified in 1.4f):** `hw_eval_monitor_daily` today has only answers marked, AI suggested, overrides, override size, transcript fixes and misread flags, keyed by day, institution, subject and question type. Add, as an additive migration:
  - language and scheme source in the key, and the configuration hash;
  - suggestions shown (as against created);
  - accepted unchanged, edited, and replaced by hand;
  - large overrides;
  - instruction flags and "not an instruction" taps (rolled up from `hw_instruction_flag`);
  - failed jobs and batch fallbacks;
  - batch turnaround (p50 and p90);
  - ₹ per answer, in paise.

5.5 **Runs & gates tab** (read-only).
- **What it lists:**
  - dataset versions: manifest, source mix and consent status;
  - runs: mode, profile, commit, configuration hash and cost;
  - gate tables per group;
  - regression results;
  - shadow comparisons.
- **Where the numbers come from:** import the CLI outputs; don't recompute them. Add a test that the screen matches `hw:eval:report` for the same run.

**Acceptance:**
- tests for every task;
- tests that a non-eligible group gets no suggestion, that a hash mismatch stops suggestions, and that automatic demotion works;
- the audit table refuses updates and deletes at the database level;
- the Hindi strings are complete;
- the migration rehearsal passes.

**STOP** before merging.

---

### Phase 5P: photo answers (only if D4 says so)

This follows the original Phase 2 specification, part A:
- **Capture:** per-question photo capture on phones. On the device, crop, convert to greyscale, scale to about 1000 px wide, and strip EXIF data including GPS.
- **Storage and reading:** upload under `hw-assignments/`, with a reader route for photos.
- **Server:** replace its current refusal ("arrive in a later update").

Reading paper photos is already measured in pilot step 1, where half the items are on paper. The printed answer booklet stays for later.

---

### Phase 6: pilot step 4, the classroom

- **Prerequisite: the scheduled job worker (production change; only with the owner's go-ahead, and not before Phase 5 is merged).** Found on 4 Nov 2026 after the first deploy: no Coolify scheduled task calls `/api/cron/hw-jobs` (Coolify has no scheduled tasks and 0 executions) and `HW_CRON_SECRET` is unset in production (the route refuses every call), so nothing would process reading or marking even with the feature on, and the 15-minute monitoring roll-up (which runs inside the worker pass) does not run either. Before the classroom step: create the Coolify scheduled task for the route (every minute, as `cron/hw-jobs/route.ts` documents), set `HW_CRON_SECRET` (at least 32 characters) in production, and confirm one clean pass, including the monitoring roll-up, in the logs.
- **YOU, on the Tenants tab:** switch on the pilot classes and set their quota.
- **Settings:** eligibility comes from Phase 4. Shadow mode runs at 0.1–0.2. Monitoring runs daily, and automatic demotion is live.
- **Reviews:** a 15-minute weekly review with the teachers.
- **Claude Code:** a weekly report covering monitoring, cost against projection, and flags. No configuration changes without the regression gate.
- **Length:** 4–6 weeks of normal homework.

---

### Phase 7: pilot report and launch decision

- **Report:** a public summary and a full report, against the pilot plan's exit criteria.
- **Decisions:** which groups launch, the configuration for each, the default quota per student, and the price.
- **Owners:** Claude Code drafts; YOU decide.

---

### Phase 8: after launch, in order of value

1. **Teacher:** a gradebook and export, and a grade-history view (the history table already exists).
2. **Institution admin:** results and completion by class, and usage per teacher and per class.
3. **Parent view:** decide the policy first (what a parent may see, and how parent and child are linked, possibly through trio identity), then build.
4. **Practice mode:** AI feedback without marks, only in Eligible groups.
5. **Per-language routing:** only if the pilot chose R-luna for English or Sarvam for Hindi.
6. **Later builds:** an Android wrapper with on-device ML Kit reading, the printed answer booklet, and answer grouping.

---

## 6. Owner checklist for this week

- **Keys:** put Gemini (billing-enabled project) and OpenAI dev keys in `.env.local`, or top up OpenRouter by about ₹100 for the pending runs.
- **Merge:** approve the Phase 1 merge after its STOP.
- **Decisions:** decide D2, D3, D4, D7 and D8.
- **Recruiting:** start on partner schools, two teachers per subject × medium, a Hindi-reading teacher for the person-check, and an expert auditor per subject.
- **Review:** go through `grader/instruction-phrases.json`.

---

## 7. Cost picture (for planning only)

Measured on handwriting fonts, so not decision grade:

| Configuration | ₹ per student per month |
|---|---|
| Today's settings | 6.94 |
| Five cost flags | 3.14 |
| Cheapest mix tried | 1.22 |

- **Marking per answer:** M0 ₹0.051; M1-strict ₹0.014.
- **Teacher side:** answer keys, a small amount.
- **Guardian side:** ₹0, because there is no parent screen.
- **Pilot AI budget:** ₹1,000–3,000, from the pilot plan.

Real figures come from Phase 4.

---

## 8. Decisions

| # | Decision | Owner | Recommendation | Status |
|---|---|---|---|---|
| D1 | Merge `perf/hw-cost` | YOU | Yes, once task 1.5's checks pass | **Approved 4 Nov 2026**, with three conditions (production-schema rehearsal, ownership and grants, backup and rollback). Migrations 019 and 020 applied 4 Nov; the push waits for GitHub credentials |
| D2 | How keys enter the product | YOU | Option A, with C as the backstop | **Decided 5 Nov 2026: option A with C.** At authoring the key service builds or reuses the key and the teacher sees it in place of a rubric; at marking time the key is checked again and a key that is no longer fully supported means no suggestion. Built (5.2) |
| D3 | Custom, teacher-written questions in the pilot | YOU | Hand-marked during the pilot; measure teacher-rubric marking later as its own group | **Decided 5 Nov 2026, differently from the recommendation:** teacher-written questions go through the same key service. A fully supported key (from a passage given in the question, or from the textbook) is marked like a textbook question; otherwise the teacher marks by hand. AI marking depends on where the key came from, not on who wrote the question. A teacher's own rubric ("Use my own rubric instead") is hand-marked during the pilot. Built (5.2) |
| D4 | Answer mode in pilot step 4 | YOU | Build photo answers (5P). Most students will write on paper, so a tablet-only pilot wouldn't test the mode most schools will use | Decided 13 Nov 2026: build them (owner) |
| D5 | Partial-credit rule | TEACHERS | Decide now; the kit is released (4 Nov). Leak decision: the verdict wording is not the cause (the same definitions gave 0 leaks in 69 judgements on M1-strict); M0-strict's 3 of 15 is model behaviour. M0-strict stays a candidate only if the teachers choose `zero`, or its leak on `heldout-1d@v1` is at most 5% (a blind check: the reversed-fact labels there come from how the set was built) | Open, kit released |
| D6 | Verdict definitions | TEACHERS | Start from the draft in `verdicts.md`; the leak result gives no reason to change the wording | Open, kit released |
| D7 | How line breaks count in CER | YOU | Count a line break read as a space as correct, and keep raw CER as a second figure | Open |
| D8 | Quota unit | YOU | Rupees, stored as paise, with IST months | Open |
| D13 | Monitoring alert thresholds | YOU | n/a | **Decided 5 Nov 2026, provisional until Phase 4.** Over a rolling 7 days with at least 60 suggestions in the group: demote when more than 5% of suggestions are changed by a large amount (the large-error gate's own definition of large) or more than 30% are changed at all. Every other alert only warns. Set as the defaults in config and marked provisional on the Monitoring tab |
| D9 | Batching escalation (E0 or E1) | YOU | E0, until the Gemini probe shows image batches finishing fast | **Decided 4 Nov 2026: stays E0** |
| D10 | Parent access | YOU | After the pilot, policy first | Open |
| D11 | Pilot round 1 scope | YOU | Class 9 Science, English and Hindi medium, with Social Science and Class 10 in round 2 once the lane has ingested a Hindi book | Open |
| D12 | Qdrant protection before anything is ingested (found 4 Nov) | YOU | Put an API key on Qdrant and give every client the key, and snapshot `library_v2_te3l_3072` on a schedule. Until then ingest nothing | Open |

---

## 8a. Model inventory (4 Nov 2026)

Exact model IDs, so the family rules can be checked at a glance. Sources: the production backend's environment (read-only, IDs and set/unset only), `apps/api/.env.example`, and `packages/core/src/lib/hw/eval/profiles.ts`. In evaluation runs every call goes through OpenRouter; production code defaults to Gemini direct (`HW_AI_PROVIDER`, default `gemini`).

**Production today.** No model runs for reading, escalation, marking or rubric drafting: `HW_READ_MODEL`, `HW_ESCALATE_MODEL`, `HW_GRADE_MODEL`, `HW_RUBRIC_MODEL` and `HW_AI_PROVIDER` are unset, and there is no `GEMINI_API_KEY`, `OPENROUTER_API_KEY` or `SARVAM_API_KEY` (only `OPENAI_API_KEY` is set). The AI path would refuse with NOT_CONFIGURED.

| Step | Production env now | `.env.example` | `pilot@v1` profiles (via OpenRouter) | Family |
|---|---|---|---|---|
| Read (tier 1) | none (unset) | `gemini-3.5-flash-lite`, Gemini direct | R0 and R1: `google/gemini-3.5-flash-lite` (R1 in batch); R-luna: `openai/gpt-6-luna`, low effort, English only | google; openai for R-luna |
| Escalate (tier 2) | none (unset) | `gemini-3.6-flash`, Gemini direct | E0: `google/gemini-3.6-flash`; E-sarvam: Sarvam Vision, per page, Hindi only (not runnable: no key, and `SarvamReader` is not implemented) | google; sarvam |
| Mark | none (unset) | `gemini-3.5-flash-lite`, batch size 10 (commented alternative: OpenAI `gpt-6-luna`, low effort, batch size 1) | M0-guarded and M0-strict: `google/gemini-3.5-flash-lite` (10 answers a call); M1-strict: `openai/gpt-6-luna`, low effort, 1 answer a call | google; openai for M1-strict |
| Rubric draft ("Draft with AI") | none (unset) | `gemini-3.5-flash-lite` | not in the profiles | google |
| Key write | `google/gemini-3.6-flash` via OpenRouter (no OpenRouter key set, so it could not run) | blank (commented example `gemini-3.6-flash`) | K0: `google/gemini-3.6-flash` | google |
| Key verify | `openai/gpt-5.4-mini` via OpenRouter (same key gap) | blank, provider `openrouter` (commented example `gpt-5.4-mini`) | K0: `openai/gpt-5.4-mini` | openai |
| Mutation and near-miss generation | not a production step | not set | `anthropic/claude-haiku-5.5` (`DEFAULT_MUTATION_MODEL`; near-miss uses the same) | anthropic |
| Embeddings (key retrieval and the book library) | `text-embedding-3-large` (OpenAI key set; used by the library hub) | `text-embedding-3-large` | same | openai |

**Family rules, checked:** key writer (google) differs from key verifier (openai) in production env and in K0; the mutation generator (anthropic) differs from every candidate grader (google for M0-guarded and M0-strict, openai for M1-strict). `profiles.ts` (lines 182-188) refuses a profile set that breaks either rule. `.env.example` leaves the writer and verifier blank, so the rule there is unchecked until they are set. Varta (the tutor) is separate from this feature; the owner states Basic runs GPT-6 Luna and Prime GPT-5.4 mini (not re-verified here).

**Sequential scans on the new tables (checked 4 Nov).** `hw_ai_grade_source` 4, `hw_shared_key` 2, `hw_instruction_flag` 2. They do not come from row-count queries (none was run on these tables) or from the app: `last_seq_scan` is 18:47:35 to 18:47:36 UTC, the moment migrations 019 and 020 ran, with none since (including after the new code started at 19:28 UTC). The counts equal the number of indexes the migrations build (4, 2, 2), and `CREATE INDEX` scans the table once per index. Harmless.

---

## 9. Status (Claude Code updates this)

| Phase | Status | Branch / commit | Updated |
|---|---|---|---|
| 1 | Merge approved (D1). Migrations 019 and 020 applied on production 4 Nov (rehearsed on the production schema; backup and restore point recorded). **Done 4 Nov 2026:** `perf/hw-cost` fast-forwarded into `main` (`d558558..50a2d34`), deployed by Coolify, tag `hw-cost-merged-2026-11-04` pushed; every post-deploy check passed (runbook, "Executed on 4 Nov 2026"). 1.2 and 1.3 skipped (no credit, no keys) | `perf/hw-cost` | 4 Nov 2026 |
| 2 | Support prepared (teacher pack, R_min labelling sheet, trio check); the people's work has not started. Findings in `phase2-support.md` | n/a | 4 Nov 2026 |
| 3 | **Built, local, not pushed; stopped before merge.** Tasks 3.1 to 3.4 done: consent tab, gates and withdrawal (migration 022), rater invitations, evaluator isolation, Evaluate menu entry, Hindi rater screens (migration 021), the volunteer test script, the "Draft with AI" fix. Tests: hw suite 459 passed, 2 skipped. Migrations 021 and 022 rehearsed on the production schema, not applied anywhere. See `migration-021-022-runbook.md` | `feat/hw-pilot-a` | 4 Nov 2026 |
| 4 | Not started | n/a | 3 Nov 2026 |
| 5 | **Built locally, including 5.2 (5 Nov); stopped before merge.** 5.1 Tenants tab (feature switch, class allow-list, rupee budget on IST months, usage, 80% warning, audit with history; institution usage card reads the same function), 5.3 Eligibility tab and registry (the product obeys it), 5.4 Monitoring tab (per-group daily roll-up, alerts, automatic demotion with email, institution view with the minimum group size), 5.5 Runs & gates tab (read-only, imported from `report.json`). 5.2 answer keys built (migration 027). Regression and shadow results are not imported into the Runs tab yet. Migrations 021 to 027 rehearsed, not applied anywhere; merge plan in `merge-pilot-ab-runbook.md` (not run). hw suite passes in parallel: 558 passed, 2 skipped, three runs in a row. See `migration-023-026-runbook.md` | `feat/hw-pilot-b` (stacked on `feat/hw-pilot-a`) | 4 Nov 2026 |
| 5P | Built 13 Nov 2026 (photo-answers.md): InkBuddy always; school homework when the teacher allows Photo. Crop on the device not built | n/a | 13 Nov 2026 |
| 6 | Not started | n/a | 3 Nov 2026 |
| 7 | Not started | n/a | 3 Nov 2026 |
| 8 | Not started | n/a | 3 Nov 2026 |

---

## 10. Log

On the super-admin screen: yes, build it, but not as one screen and not first. Quota, gates and monitoring are needed at different stages, and a gates screen changes nothing unless the product actually obeys it. The plan upgrades it in five ways:

1. Build in the order the pilot needs things. Consent records and rater access come first, because pilot step 1 can’t start without them. Tenant control, eligibility and monitoring come before the classroom step. Views of runs and gates come last; the CLI already produces them.
2. Gates become a registry the product obeys. Suggestions appear only in groups promoted from a passing gate run. Each promotion is tied to the exact configuration that was measured, so changing a prompt or model switches suggestions off until the regression gate passes again. Monitoring can demote a group automatically.
3. The quota is in rupees, and every change is logged. Each change to the switch, quota or eligibility records who made it and why, in a log that can’t be edited.
4. One monitoring view, two scopes. You see every school; each partner school sees only its own.
5. Groups include the scheme source. Otherwise the product would mark custom questions against teacher rubrics the pilot never measured.

Gaps I found while planning. Phase 1 verifies each one before anything is built:

* Eligibility: the product may not check it at all.
* Rater accounts: volunteers may not be able to get one, because DCP sign-up was disabled.
* Consent and language: there’s no consent screen, and the rater tools are English-only.
* “Draft with AI”: it may draft rubric points from the model’s own knowledge, against your “no key from memory” rule.
* Photo answers: there are none, but most students will write on paper.

Your part this week:

* Add dev keys, or top up OpenRouter, so the pending runs can finish.
* Approve the merge when Claude Code stops for it.
* Decide D2, D3, D4, D7 and D8 (§8 of the roadmap has my recommendations).
* Start recruiting teachers and a partner school.

The one result to read first is the leak rate in task 1.2. If it’s high, the verdict wording needs fixing before the teachers see the partial-credit kit.

4 Nov 2026, Phase 1: no credit or keys, so 1.2 runs and 1.3 probes skipped; leak rate from stored runs is M0-strict 3/15 (20%, over the 5% line) and M1-strict 0/69; gaps a-g verified (docs/hw-eval/roadmap-phase1-report.md); merge runbook written (docs/hw-eval/merge-hw-cost-runbook.md); stopped at 1.5 for the owner's go-ahead.

4 Nov 2026, Phase 1 close-out: D1 approved with three conditions; production schema rehearsed (no dependency differs from dev), roles and grants checked (app role `digiclassroom_app` owns everything and has full privileges on the 3 new tables), fresh backup at restore point 2026-11-03 18:45 UTC; 019 and 020 applied on production; push to `main` blocked by a missing GitHub credential for `thevinstitution-virat` (nothing pushed, deployed code does not use the new tables). Roadmap updated (§2 quota rule, §3.3 gaps verified, tasks 1.2, 3.2, 3.4, 5.1, 5.4, §8). Phase 2 support prepared (`phase2-support.md`): teacher pack (4-page A4, English and Hindi), R_min labelling sheet (60 questions, git-ignored in `hw-evals/rmin-labelling/`; the only book in the shared library is NCERT Science IX English, so SST, Class 10 and Hindi need books first). Part D skipped (OpenRouter -$0.045, no Gemini key, OpenAI key is a placeholder). Phase 3 not started.

4 Nov 2026, push preparation and read-only checks: `origin/main` (`d558558`) is an ancestor of `perf/hw-cost` (9 commits, head `50a2d34`); annotated tag `hw-cost-merged-2026-11-04` created locally; owner pushes. Production backend env checked read-only (names, plus the values of the non-secret switches): `HW_FEATURE_DEFAULT_ENABLED=false`, `HW_EVAL_TOOLS_ENABLED=false`, `HW_SHADOW_RATE=0`, `HW_KEY_R_MIN=0.50`, no new flags, `HW_PARTIAL_CREDIT_RULE` unset, `HW_CRON_SECRET` unset (so the cron route refuses every call), `hw_tenant_quota` 0 rows. Read-only checks on the shared library: the old books were wiped deliberately on 26 Oct (Phase 8 of the library hub plan); Qdrant has no API key (decision D12, ingest nothing until decided); Hindi readiness gaps listed in task 2.1. Roadmap: task 2.1 rewritten, task 2.2 note, D11 and D12 added.

4 Nov 2026, Phase 1 DONE: the owner approved a browser login; `perf/hw-cost` fast-forwarded into `main` (`d558558..50a2d34`), the branch and the annotated tag `hw-cost-merged-2026-11-04` pushed. Coolify deployed both apps (19:28 and 19:31 UTC); all post-deploy checks pass: 0 restarts, feature off for every institution (`hw_tenant_quota` 0 rows), no new flag set, `HW_PARTIAL_CREDIT_RULE` unset, cron route 401 without the secret, clean error logs for over 30 minutes. Found: no scheduled task calls the job worker and `HW_CRON_SECRET` is unset (Phase 6 prerequisite added). Model inventory added (§8a). Phase 3 next.

4 Nov 2026, Phase 3 built on `feat/hw-pilot-a` (local; `main` untouched): 3.4 "Draft with AI" (button needs a model answer, prompt rubric-draft.v2 uses only the model answer, AI-draft label until saved, Publish blocked by unsaved drafts); 3.2 rater invitations (email with sign-up link, accepted on verified email, blocked with a reason for an institution's student or parent), evaluator-only accounts sent to /evaluate and turned away from /dashboard pages, Evaluate menu entry, English and Hindi for every rater screen; 3.1 consent records with gates on copy tasks, task creation and the runner, one-action withdrawal, audit trail, next dataset version without withdrawn people (hw:eval:consent); 3.3 volunteer-flow test script and a check that the printable copy sheets render in English, Hindi and mixed. Migrations 021 (invites, audit, relaxed rater account rule) and 022 (consent). Stopped before merge.

4 Nov 2026, Phase 5 in progress on `feat/hw-pilot-b` (stacked on `feat/hw-pilot-a`, because the audit table of migration 021 is there; local, not pushed): 5.3 eligibility registry done: migrations 023 (imported runs and gate results) and 024 (registry, append-only history, `hw_question.scheme_source`), the product rule (AI suggestions are created and shown only for an eligible group on the marking setup running now; every other group is marked by hand; rules in code still mark), promotion only from a passing gate result for the running setup, manual and automatic demotion, `hw:eval:gates import`. `HW_ELIGIBILITY_ENFORCED` defaults to true. 5.1, 5.4, 5.5 screens and 5.2 (blocked on D2 and D3) still to do.

4 Nov 2026, Phase 5 built on `feat/hw-pilot-b` (local, not pushed; stopped before merge): 5.1, 5.3, 5.4, 5.5 done; 5.2 blocked on D2 and D3. Migrations 023 to 026 (additive; rehearsed on the production schema, rollback and re-apply identical; runbook `migration-023-026-runbook.md`). The quota moved to paise with IST months by expand only (the old answer-count column stays; contract is a later migration). Monitoring needs the job worker scheduled in production (Phase 6 prerequisite) to run at all. Alert thresholds are the author's defaults, to be set by the owner. Tests: hw suite 539 passed, 2 skipped; typechecks and both builds clean (the type errors that remain are in files this work does not touch).

5 Nov 2026, Phase 5 finish on `feat/hw-pilot-b` (local, not pushed; stopped before merge): D2 (option A with C) and D3 (teacher-written questions through the same key service) decided by the owner and built as 5.2: migration 027, key builds in the job runner, the builder's key panel, the marking-time check, scheme source in the eligibility group key (vocabulary renamed in the unapplied 023/024/026; the gates CLI still accepts the old names). Alert thresholds set to the owner's provisional values (D13). Test isolation: each integration suite has its own job namespace (`HW_JOB_ORG_PREFIX`), so the hw suite runs in parallel. Merge runbook for Phases 3 and 5 written (`merge-pilot-ab-runbook.md`), not run. Phase 4 step 2 now stratifies the key audit by origin. Screen walkthrough done (31 screenshots in `docs/hw-eval/screens/phase3-5/`, English and Hindi): it found and fixed one product bug (the publish preview queued key rebuilds) and one missing Hindi label; not covered: an `/evaluate` task page. hw suite 559 passed, 2 skipped, parallel.

5 Nov 2026 (UTC 4 Nov evening), Phases 3 and 5 on production: `main` pushed to `07db5cc` by the owner's go-ahead (code first; the migrations should have gone first, so for about 20 minutes the new code ran against the old schema with the feature off and no student data). Migrations 021 to 027 applied by the owner with `apply-migrations-021-027.sh --apply` after a dry run and a rehearsal on a throwaway copy of the production schema (109 tables to 120; rollback to 109; re-apply identical). **Restore point (UTC): 2026-11-04 20:55:55**, backups `/root/backups/digiclassroom/schema-before-021-027-20261104-2155.sql` and `hw-data-before-021-027-20261104-2155.dump` (an earlier dry-run pair from 20:54:56 also exists). Post-deploy checks: backend and frontend healthy with 0 restarts, backend image `07db5cc`; `hw_tenant_quota` 0 rows, `hw_eligibility` 0 rows; new tables untouched; `/api/cron/hw-jobs` 401; no error lines in 15 minutes of backend logs; `HW_EVAL_TOOLS_ENABLED=false`, `HW_FEATURE_DEFAULT_ENABLED=false`, `HW_SHADOW_RATE=0`. Found set on the backend: `HW_KEY_R_MIN=0.50` and the key writer and verifier models (the owner to confirm these are the calibrated values before any institution is switched on). The job worker is still unscheduled.

5 Nov 2026, migration 028 and the parent view on production: 028 (`hw_guardian_link`) applied with `apply-migration-028.sh --apply` after a dry run and a rehearsal (120 to 121 tables, rollback to 120, re-apply identical); **restore point (UTC) 2026-11-04 21:39:30**, backups `schema-before-028-20261104-2239.sql` and `hw-data-before-028-20261104-2239.dump` in `/root/backups/digiclassroom/`. Then `main` pushed to `315fe06` (migration first, this time). Post-deploy: backend image `315fe06`, 0 restarts; tables 121; `hw_tenant_quota` 0 rows, `hw_eligibility` 0, `hw_guardian_link` 0; `HW_PARENT_VIEW_ENABLED` not set; job endpoint 401; no error lines in the first minutes of logs (the frontend was still redeploying at that moment). Still off for every institution; worker unscheduled.

5 Nov 2026, migration 029 and regression results on production: 029 (`hw_eval_regression`) applied with `apply-migration-029.sh --apply` after a dry run and rehearsal (121 to 122 tables, rollback to 121, re-apply identical); **restore point (UTC) 2026-11-04 21:59:53**, backups `schema-before-029-20261104-2259.sql` and `hw-data-before-029-20261104-2259.dump`. `main` pushed to `ae6c3ea` (migration first). Post-deploy: backend and frontend both on `ae6c3ea`, 0 restarts; 122 tables; `hw_tenant_quota`, `hw_eligibility`, `hw_guardian_link`, `hw_eval_regression` all 0 rows; no `HW_PARENT_VIEW_ENABLED`; job endpoint 401; 0 error lines in the first minutes of logs. Everything still off for every institution; worker unscheduled.
