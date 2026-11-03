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

Phase 1 verifies each of these; the named phase fixes it.

1. **The product may not read gate results.** Verify in Phase 1; build in Phase 5.
2. **Raters may not be able to get accounts.** DCP sign-up was disabled in August, so volunteers would need invitations. Verify in Phase 1; build in Phase 3.
3. **No consent screen.** Step 1 needs volunteer consent, and sources C and D need parents' consent. Phase 3.
4. **The rater tools are English only.** Hindi-medium teachers will be raters. Phase 3.
5. **The key service is used only by evaluation scripts, and questions have no source field.** Phase 5, after decisions D2 and D3.
6. **"Draft with AI" may break the no-key-from-memory principle.** It proposes rubric points (`rubric-draft.v1`), while principle 3 says a model never writes a key from memory. Phase 1 checks what it draws on; Phase 5 fixes it if needed.
7. **No photo answers.** Most students have phones, not pen tablets. Step 4 needs either a school with tablets or photo capture. Decision D4; Phase 5P.
8. **The feature switch is per institution.** A pilot needs to switch on single classes. Phase 5.
9. **The quota's unit and month boundary are unknown.** Verify in Phase 1; migrate in Phase 5.

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

Report the leak rate first: how often a reversed fact gets the verdict `right_idea_wrong_detail` instead of `different_fact`. If it exceeds 5% of reversed-fact items, **STOP**. The verdict wording needs fixing before the teachers see the decision kit.

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

2.1 **Books (pilot 0.1).** Index the Class 9–10 Science and Social Science books, English and Hindi medium, through the trio pipeline. Remove the duplicate Class 9 SST book and fix the medium filter in Gyankosh search.
- **Claude Code first:** check whether the trio Markdown ingest lane works in production now (it couldn't in August), and list what is already indexed.
- **Then:** each chapter goes prep app → enriched Markdown → ingest, as decided in Oct 2026.
- **Owners:** YOU prepare chapters; Claude Code ingests and fixes the filter. This touches the trio repo, so follow that repo's rules.

2.2 **`HW_KEY_R_MIN` calibration (pilot 0.2).**
1. Claude Code exports 60 question → passage pairs as a labelling sheet.
2. YOU (or a teacher) label them.
3. Claude Code runs `scripts/hw-key-calibrate.ts` and reports the value.

Production holds 0.50 today, uncalibrated. Changing it needs the owner's approval.

2.3 **CER line breaks (pilot 0.4).** Record decision D7. Claude Code then sets the reader prompt and the metric to match.

2.4 **Partial credit and verdict definitions (pilot 0.6).**
1. TEACHERS use `partial-credit-decision.md` and `verdicts.md`, only after task 1.2's leak check passes.
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
- **Invite by email** from the Raters tab. This creates or links an account with rater access only, sends a sign-in link through the existing email provider, and assigns a pseudonym.
- **Isolation:** a rater cannot open any product page.
- **Menu:** an "Evaluate" entry for users with the rater role.
- **Language:** Hindi strings and the language toggle for `/evaluate`, every task form, and adjudication.

3.3 **Volunteer flow check.** Write a manual test script for the copy flow on a Samsung tablet with S Pen and on a phone, and confirm the printable copy sheets render in both languages.

**Acceptance:**
- tests show the consent gate refusing, withdrawal excluding the person and the runner refusing, the invitation working, and raters blocked from product routes;
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
2. An expert audits 20%, at least 30 per subject × medium.
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
- **Migration:** move the quota from its current unit (found in 1.4b) using expand → migrate → contract.

5.2 **Scheme source and keys in the product** (after D2 and D3).
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
| D1 | Merge `perf/hw-cost` | YOU | Yes, once task 1.5's checks pass | Open |
| D2 | How keys enter the product | YOU | Option A, with C as the backstop | Open |
| D3 | Custom, teacher-written questions in the pilot | YOU | Hand-marked during the pilot; measure teacher-rubric marking later as its own group | Open |
| D4 | Answer mode in pilot step 4 | YOU | Build photo answers (5P). Most students will write on paper, so a tablet-only pilot wouldn't test the mode most schools will use | Open |
| D5 | Partial-credit rule | TEACHERS | Decide after the leak check in task 1.2 | Open |
| D6 | Verdict definitions | TEACHERS | Start from the draft in `verdicts.md` | Open |
| D7 | How line breaks count in CER | YOU | Count a line break read as a space as correct, and keep raw CER as a second figure | Open |
| D8 | Quota unit | YOU | Rupees, stored as paise, with IST months | Open |
| D9 | Batching escalation (E0 or E1) | YOU | E0, until the Gemini probe shows image batches finishing fast | Open |
| D10 | Parent access | YOU | After the pilot, policy first | Open |

---

## 9. Status (Claude Code updates this)

| Phase | Status | Branch / commit | Updated |
|---|---|---|---|
| 1 | Stopped at 1.5: 1.4 and 1.5 done, 1.2 and 1.3 skipped (no credit or keys); M0-strict leak 3/15 is over 5%; waiting for the owner's merge go-ahead | `perf/hw-cost` | 4 Nov 2026 |
| 2 | Not started | n/a | 3 Nov 2026 |
| 3 | Not started | `feat/hw-pilot-a` | 3 Nov 2026 |
| 4 | Not started | n/a | 3 Nov 2026 |
| 5 | Not started | `feat/hw-pilot-b` | 3 Nov 2026 |
| 5P | Waiting for D4 | n/a | 3 Nov 2026 |
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
