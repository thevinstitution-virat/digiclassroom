# Self-practice pilot: checklist and runbook (7 Nov 2026)

Phase 4 of [self-practice.md](self-practice.md). It gets independent learners from "built and tested on a scratch database" to "a small invited
group using it on the live server", in an order that can be stopped and undone at every step.

**Nothing in this document has been done on the server.** Every step that changes production says who does it and needs the owner's go-ahead.

## The one command that tells you where things stand

```bash
npm run hw:practice:readiness -w apps/api -- --learners 10 --subjects Science --media en --class 9
```

Read-only. It reads the environment, runs SELECTs, and makes one library search per subject and medium (at most a query embedding). It prints no
secret, only whether one is set, and exits with 1 while anything blocks the pilot. Run it with the server's own environment: from the backend
container (`docker exec` into it), or locally with the production values in an env file. Its checks are in
`packages/core/src/lib/hw/practice/readiness.ts` (11 tests).

Run on a scratch database with only the AI models set, it reports: migration, models, strict marking and the eligibility check pass; eligibility,
answer keys, the retrieval threshold, the library and the job-runner secret fail; the Qdrant key, the schedule and consent are left for a person.
That is the honest picture of the live server too, apart from the migration.

## Decisions to take first (owner and teachers)

| # | Decision | Why it matters | Suggested |
|---|---|---|---|
| P1 | **Who is invited, and how many** | Sets the money at risk and what must be eligible | 10 learners; Class 9 Science, English medium (the first book to ingest) |
| P2 | **Under-18 learners: consent wording, who consents, how long handwriting images are kept** | Handwriting images are personal data of children; old images are not deleted when a learner writes again | Parent or guardian consent for under-18; legal review (already on the roadmap); decide a retention period and a clean-up job before opening beyond invited people |
| P3 | **Who pays for answer keys** | A key is not charged to the learner's ₹10; its price per question is unmeasured | The platform, with shared keys on, and measure it in week 1 |
| P4 | **Success and stop measures** (below) | Without them the pilot cannot end | As listed below |
| P5 | **`HW_KEY_R_MIN` confirmed** | Textbook retrieval threshold; the owner still has to confirm it | Owner confirms the calibrated value |
| P6 | **Partial-credit rule** (teachers) | Changes the marks learners see | Teachers decide; `zero` until then |
| P7 | **Hindi** | Hindi medium needs Hindi-medium books and a native-speaker read of every Hindi string | English medium first |

## Blockers to clear (in this order)

Each row says how to see that it is cleared. Re-run the readiness command after each.

| Step | What | Who | Cleared when |
|---|---|---|---|
| B1 | **Protect Qdrant with an access key**, give every client the key, snapshot the textbook collection on a schedule (roadmap D12) | Owner / Claude with go-ahead | The owner confirms (a manual check) |
| B2 | **Ingest the pilot book** (Class 9 Science, English medium) into the library hub | Owner / Claude | Readiness: "Textbook library" passes (exercise rows found) |
| B3 | **Answer keys can run.** (7 Nov: the owner chose OpenAI for both writer (`gpt-6-luna`) and verifier (`gpt-5.4-mini`), with `HW_KEY_ALLOW_SAME_FAMILY=true`; the production OpenAI key can see all three models. Unmeasured: the tested setup was a Gemini writer.) Production routes the writer (`gemini-3.6-flash`) and verifier (`gpt-5.4-mini`) through OpenRouter and has no OpenRouter key. The writer and verifier must be different model families, so a second family's key is needed: an OpenRouter key (simplest), or a Gemini key for the writer and `HW_KEY_VERIFIER_PROVIDER=openai` for the verifier | Owner provides the key; Claude sets it with go-ahead | Readiness: "Answer keys" passes |
| B4 | **Marking is eligible.** Strict marking is on, so every group reads "configuration changed" until evaluation runs made under the same setting are imported (`npm run hw:eval:gates`) and a person promotes the group in the control room. **A finding to check:** the group is keyed by marking scheme. The held-out marking results I know of were measured against hand-written key points, so they stand for `teacher_rubric` groups. A `textbook_key` group (what practice questions use) needs a marking evaluation whose scheme was an answer key built from the book by the key service. I have not seen one. Finish the held-out strict run (about ₹6) *and* run a textbook-key evaluation for the pilot subject (a first one is done: [textbook-key-eval.md](textbook-key-eval.md), 97.3% detection, 2.9% false credit, but one chapter and no teacher baseline), then import with `--scheme-source textbook_key` | Claude runs and imports; a person promotes | Readiness: "Groups eligible for the running setup" passes for the pilot's groups |
| B5 | **Job runner** scheduled every minute (`POST /api/cron/hw-jobs`, roadmap W1) with `HW_CRON_SECRET` of 32+ characters. Without it nothing is read, marked or returned | Owner / Claude with go-ahead | Readiness: secret passes; the owner confirms the schedule runs (manual) |
| B6 | **Instruction guard** (recommended): apply migration 020, then `HW_INSTRUCTION_GUARD_ENABLED=true` | Claude with go-ahead | Readiness: "Instruction guard" passes |
| B7 | **Shared keys on** (recommended): `HW_SHARED_KEYS_ENABLED=true`, so ten learners picking the same question cost one key | Claude with go-ahead | Readiness: "Shared keys" passes |

## The rehearsal (before production)

1. Restore a recent production backup into a scratch database (backups are in `/root/backups/digiclassroom` on the VPS).
2. Apply migration 031 to the copy, run `npm run hw:practice:readiness` against it, then apply `031_hw_practice_trial.down.sql` and 031 again.
   (This was done on 7 Nov on a scratch database that had migrations up to 030: down and up both clean.)
3. Run the whole hw test suite against that copy: `HW_ITEST_DATABASE_URL=… npx jest src/__tests__/hw` (739 tests on 7 Nov).

## Switching it on (each step is the owner's go-ahead)

1. **Back up** the DigiClassroom database.
2. **Apply migration 031** with `psql` as you applied 028 to 030. It creates one table (`hw_practice_trial`) and changes nothing existing; the
   rollback is `031_hw_practice_trial.down.sql` (it deletes the trial table only; work already submitted stays in the ordinary tables).
   Check: `\d hw_practice_trial` shows the table; readiness shows "Migration 031" passing.
3. **Deploy the code** (the commits 3494730, 60422e4, 301f0a8, bcc2c2c and this one on `main`; the owner pushes). With the flag off nothing
   changes for anyone: the new tRPC procedures answer "off" and the tab is not shown.
4. **Set the environment** in Coolify (Developer view of the backend; values for the web app are not needed) and redeploy, as for the luna settings:
   `HW_SELF_PRACTICE_ENABLED=true`, `HW_SELF_PRACTICE_TRIAL_DAYS=7`, `HW_SELF_PRACTICE_TRIAL_BUDGET_PAISE=1000`,
   `HW_SELF_PRACTICE_STEP_RESERVE_PAISE=5`, `HW_SELF_PRACTICE_PLATFORM_BUDGET_PAISE=` (sized below), `HW_SELF_PRACTICE_MAX_ATTEMPTS=25`,
   `LIBRARY_HUB_ENABLED=true` with `LIBRARY_HUB_URL` and `LIBRARY_HUB_SECRET`. **Set the flag last**, after the readiness command reports no blocking check.
   Remember that a Coolify change reaches the running container only after a redeploy.
5. **Size the ceiling.** `HW_SELF_PRACTICE_PLATFORM_BUDGET_PAISE` is read once, when the practice space is first created, and caps all learners' reading and
   marking plus key building for the month. For 10 learners, reading and marking are at most ₹100; keys are the unknown. A ceiling of ₹500 (50000 paise)
   leaves room for about 250 keys at ₹1.50, which is a guess to replace with the measured price. If the space already exists, change the ceiling on the
   Tenants tab like any institution.
6. **Smoke test with one account you own** (an independent-learner account with no institution): open the tab, start the trial, search a topic, start a
   question, write and hand in, wait for the result. Check the label "AI practice estimate" shows in English and in Hindi, and that "Write it again" works on
   a held answer. Then run the monitoring queries and the readiness command again.
7. **Invite the pilot learners** (P1) with a short message saying what it is, that marks are AI estimates no teacher checks, how long the trial lasts, and
   who to contact.

## While it runs

Run `docs/hw-eval/self-practice-pilot-queries.sql` daily (`psql "$DATABASE_URL" -f …`; SELECTs only; run clean on the scratch database on 7 Nov). It shows: trials
by state and spend, questions per learner, where handed-in work stands, why answers have no mark, failed jobs, answer keys and what they cost, the practice
space's spend against its ceiling, and the spread of marks.

Look at real handwriting yourself in the first days: platform staff acting inside the practice institution use the same answer view teachers use, which shows the original handwriting (not yet tried against the practice institution). The evaluation so far used handwriting-style
fonts, so these are the first real readings: the open questions are luna's confidence on real handwriting and whether a luna re-read catches a luna misread.

### Success measures (suggested)

- Most learners who start a question get a mark within a few minutes: of handed-in work, at least 80% `returned` within an hour (query 3).
- Of the marks you read against the handwriting, at least 90% are within one key point of what a teacher would give. Have a teacher check 30 answers in week 1.
- Reading errors on real handwriting stay low: a teacher-read sample of 30 answers, by language.
- Cost per learner stays inside the plan: query 7 spend under the ceiling; the measured cost of a key is known by the end of week 1.
- No learner sees another's work; no under-18 learner without consent (P2).

### Stop and undo

| If | Do |
|---|---|
| A wrong mark is serious, a learner sees something they should not, or spend runs away | Set `HW_SELF_PRACTICE_ENABLED=false` and redeploy. The tab disappears, new trials and questions stop, and the job runner stops returning practice work. Data stays. |
| The ceiling is reached | The practice space stops reading and marking by itself; raise it only after looking at query 7. |
| A learner asks for their data to be removed | Manual today. Delete the learner's practice assignments first (`hw_assignment.created_by` has no cascade, so the user row cannot be deleted while they exist; their questions, submissions, answers, readings and marks go with the assignments), then the user's trial row and enrollments, then their files in storage (`hw-assignments/<org>/…`). |
| The pilot ends | Set the flag off, export the numbers, and decide whether to extend. Rollback of the table (`031…down.sql`) is only for abandoning the feature: it deletes the trial records. |

## What is still not built or not decided

- **A clean-up of old handwriting files**, and a retention period (P2).
- **Payment after the trial**: the end of the trial shows an upgrade message and nothing else; the plan and payment flow is the subscription system's job.
- **Parent consent and parent view for independent learners**: nothing is built.
- **Hindi medium**: needs Hindi-medium books and a native-speaker review of every Hindi string.
- **A chapter browser** for questions: the library only supports a topic search.

## What the live library holds (checked read-only on 7 Nov, from the backend with its own hub credentials)

The link already exists: DigiClassroom reads the PDLMS library hub (`LIBRARY_HUB_ENABLED=true`, the hub answers). The library holds **one published work, NCERT Class 9 Science, English
medium (`sci9-en`): 12 chapters, 987 passages, of which about 320 are the book's own exercise and discussion questions (one per row), plus 58 printed answers.**
Not there: any other class or subject, and any Hindi book (a Class 10 or a Hindi search returns nothing).

- The work is **placed at Class 9 as a whole (`SCH.CBSE.C9`)**, so a Mathematics or Social Science search at Class 9 also returns the Science book. InkBuddy therefore offers only the books
  in `HW_SELF_PRACTICE_SCOPES` (default `9:Science:en`) and refuses any other. Placing the work at the Science node in PDLMS's Shelves would fix the cause for every app.
- Searching a bare topic often returns no exercise rows (the hub ranks them with the explanatory text, 20 at most). Adding the word "questions" brought them forward on the live book:
  atoms and molecules 0 to 4 rows, photosynthesis 3 to 14, sound 3 to 7. InkBuddy now searches that way.
