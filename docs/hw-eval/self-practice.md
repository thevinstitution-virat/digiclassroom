# Self-practice for independent learners: InkBuddy, the Virat Gyankosh trial (design, 7 Nov 2026)

Owner decisions (7 Nov): an independent learner **practises textbook questions** (pick a chapter question, write the answer, get AI reading,
marks and feedback; the model answer comes from the textbook). The **trial is up to ₹10 of AI cost within 7 days**. It opens **only after the
strict-marking gates pass**, with marks shown as an **AI practice estimate**.

Status (7 Nov): **phase 1 (backend) is built and tested locally; nothing is migrated on the server or switched on.** Phases 2 (question picker), 3 (the tab, API and screens) and 4 (readiness command and pilot runbook, [self-practice-pilot.md](self-practice-pilot.md)) are done locally. **Phase 3 has not been looked at in a browser**: the checks are type checks, lint, API tests against Postgres and text tests.

## Why this is a new mode, not a switch

Read from the code on 7 Nov:

- Every table in the Evaluator carries `organization_id`, and `resolveHwActor` only accepts someone who is a member of an institution
  ([actor.ts](../../packages/core/src/lib/hw/access/actor.ts)). An independent learner has no institution.
- Work reaches a student through a teacher: a student sees an assignment only if enrolled in its class, and sees marks only after the teacher
  returns the work (`studentCanSeeResult` needs `status === 'returned'`).
- Cost is counted per institution per month (`hw_ai_usage_monthly`, `hw_tenant_quota`), not per person.
- Answer keys are built from a question by retrieval over the textbook (`keys/`), so a question has to be chosen first. The hub holds each
  chapter's practice questions (`keys/exercise-match.ts`).

## Design

1. **A practice space.** One platform-owned "Virat Gyankosh Practice" institution with one class and one section, created by code on first use.
   Learners are **not** added as members of it (that could change how the app treats them elsewhere); they get an enrollment row only.
2. **A trial row per learner** (new table `hw_practice_trial`, migration 031, additive, with a down script): user, started at, ends at
   (start + 7 days), budget in paise (1000), spent in paise, state (`active`, `used_up`, `ended`). Created when the learner first opens the tab.
3. **Actor.** When a user has no institution, the feature flag is on and they have an active trial, `resolveHwActor` returns a student actor in
   the practice space. A person who is in an institution is unchanged.
4. **An attempt** is a one-question assignment the system creates when the learner picks a chapter question, built from the book's own practice
   row, with a textbook-sourced key only (never a key from the model's own knowledge). The existing submit, read and mark pipeline then runs unchanged.
5. **Results.** The pipeline queues marking as today, and the eligibility check still decides whether AI may mark. In the practice space the work is
   returned automatically and every mark carries the label "AI practice estimate" (English and Hindi), with the key points and the learner's own
   words quoted back.
6. **Budget.** Each AI job's cost is added to the learner's trial before the next step; a step that would pass ₹10 does not run and the learner
   sees a plain message. A platform-wide ceiling and an off switch (`HW_SELF_PRACTICE_ENABLED`, default false) sit above it.
7. **After the trial** the tab shows an upgrade message. Plan and payment are the existing subscription system's job and are **not** built here.
8. **The tab.** "InkBuddy" (the name of the independent-learner feature) in the AI & Research section of the user sidebar, shown only when the flag is on and the user has no institution
   (or has a trial). Every string has English and Hindi.

## What phase 1 built

- Migration 031 (`hw_practice_trial`, additive, with a down script) and its Drizzle table. **Applied only to a scratch database.**
- `lib/hw/practice/rules.ts` (pure: the trial verdict, the English and Hindi texts) and `practice/trial.ts` (the practice space, start a trial, the per-learner budget).
- Settings, all in `apps/api/.env.example`: `HW_SELF_PRACTICE_ENABLED` (default false), trial days (7), trial budget (1000 paise), step reserve (5 paise), platform ceiling.
- `resolveHwActor`: a person in no institution who has started a trial works in the practice space as a student. Naming the space in a header does not let anyone in.
- Reading, marking and handing in are refused with a plain English and Hindi message once the trial's days or rupees are used; the cost of each reading and marking job is added to the learner's own trial.
- Return without a teacher: `releasePracticeSubmissions` in `services/marking.ts` (the only file allowed to write a final mark), run by the job runner through `practice/release.ts`. It returns a submission only in the practice space, only when every answer has a suggestion for the current scheme, the reader and the AI were at least `HW_HIGH_CONFIDENCE` sure, and nothing is flagged as addressed to the marker. Anything doubtful is held, not released. `myResult` adds the "AI practice estimate" label and note, both languages.
- Tests: `practice-rules` (pure, 20 including the narrowness of the exception) and `practice-trial` (24, against Postgres; no provider is called). The whole hw suite passes: 684.

## What phase 2 built (7 Nov)

- `practice/catalog.ts`: the learner picks class, subject and medium and types a topic; the library hub is asked (`includePractice`) for the book's own exercise rows, which are split into single questions and ranked by overlap with the topic (at most 30). It is a search, not a chapter browser: the hub has no "list a chapter's exercises" call. With the hub off the answer is "not available" in both languages; a hub outage is a plain error.
- Every question is **verified by the server**: the browser sends the hub's passage id, the question number and the text, and the server asks the hub again and accepts only that very row and question. A learner cannot start an arbitrary question and have it keyed as a textbook exercise.
- `practice/attempt.ts` `startAttempt`: needs an active trial; makes (once) a class per level and a section per learner and level, enrolls the learner in their own section only, creates a published one-question assignment (modes: ink and typed) owned by the learner, with `origin='textbook_exercise'`, `rubric_mode='key'` and the book, chapter and exercise reference, and queues its answer key. The same question twice opens the same attempt. A cap (`HW_SELF_PRACTICE_MAX_ATTEMPTS`, 25) bounds what the platform spends on keys per learner.
- **Privacy, twice over.** Each learner has their own section, and the access rule `studentCanSee` (and `myAssignments`) also requires, in the practice institution, that the assignment was created by the viewer. A test enrolls a stranger into someone else's section and shows they still see nothing.
- The shared practice class from phase 1 is gone: starting a trial now creates only the institution, its ceiling and the trial row.
- A question's marks come from its length (up to 10 words: 1 mark, up to 25: 3, longer: 5), because a book exercise has none; the key splits them over the book's key points.
- Tests: `practice-attempt` (16, with a fake hub and the key only queued); the whole hw suite passes: 700.

## What phase 3 built (7 Nov)

- **API** (`hw.practice` in the tRPC router): `status` (never throws for off or not-for-you), `start`, `search`, `startQuestion`. They work from the signed-in user, not from an institution, because an independent learner has none; errors map like the rest of `hw`. Search and start are rate limited. `hw.status` now also says `practice: true` for someone working in the practice space.
- **The tab** `/dashboard/user/inkbuddy` ("Virat Evaluator", shown in the user sidebar only while self-practice is on and the person has no institution or already has a trial): the free-trial introduction and start button; days left and the share of the practice allowance left (never rupees); the finder (class, subject, medium, topic) and its results; "Your practice" list. When the trial has ended the finder is replaced by the plain two-language message and past work stays visible. English and Hindi, with the same language switch as the other hw screens.
- **The answer and result screens are the ordinary student ones** (ink or typed answer, hand in, reading, marks). For practice work they change: the back link returns to the Evaluator; the "tap misread words to send to your teacher" panel is hidden (there is no teacher); a returned result shows the "AI practice estimate" label and the "no teacher has checked it" note from the server in the learner's language; a handed-in answer with no mark yet says why it might be missing, and the page keeps checking while it waits. The sidebar's "Assignments" item is hidden for these learners.
- Tests: `practice-api` (9, tRPC against Postgres with a fake session and hub), `practice-ui` (6: every pr.* string has Hindi with the same placeholders, every key the screens use exists, the sidebar rule). The whole hw suite passes: 715.

### Write it again (7 Nov, local)

- `retryAttempt` (`practice/attempt.ts`, API `hw.practice.retry`, button "Write it again / फिर से लिखें" on the waiting screen): an answer that was read but got no mark (reader or AI not sure, key not ready, trial short) is removed with its reading and suggestions, and the submission is a draft again on the same question. The device's saved copy of the old writing is cleared first, or it would come back looking as if already uploaded.
- Allowed only for the learner's own submission, only while it is waiting for a mark, and not while a job is still working on it. A marked (returned) answer is final. It needs a usable trial; the new reading and marking are paid from the same allowance, which is what bounds how often a learner can retry.
- Answer key: a question the book has no key for stays refused ("choose another question"); a failed key is queued again, at most three builds per question (the platform pays for each).
- Not cleaned up: the old handwriting image and ink file stay in storage (the rows are gone). A storage clean-up for practice files, with a retention period, belongs with the consent decision for under-18 learners.
- Tests: `practice-retry` (11), one more in `practice-api` and one in `practice-ui`; the whole hw suite passes: 728.

### What a learner cannot do yet

- **Write on paper and photograph it** (decision D4).
- **See the amounts.** By design they see days left and a percentage of the allowance, not rupees.

### Limits to know

- **Photo answers do not exist yet** (decision D4), so a learner answers on screen (ink) or by typing. Writing on paper and photographing it is not possible.
- Whether a key can be built depends on the live blockers below; until then a started question shows no mark.

### Choices made in phase 1 that you may overrule

- **graded_by is the learner's own id.** The column is a foreign key to a real user, and a system user row would show up in user lists. Source `accepted_ai` in the practice institution means no teacher. The same will apply to an attempt's `created_by` in phase 2.
- **Held work stays held.** A learner whose handwriting the reader was unsure of, or whose mark the AI was unsure of, sees the reading but no mark (phase 3 must explain this and offer "write it again"). There is no teacher to correct it.
- **Key building is not charged to the learner** (the platform ceiling counts it). Charging it is a one-line change once you decide.
- **A grade job's cost is shared equally** if one question ever covered several learners; in the practice space every attempt will have its own question, so it is one learner.
- **The practice institution** appears in the super admin's institution list.

## Blockers on the live server (not code)

| Blocker | Why it matters | Who |
|---|---|---|
| No textbook is ingested, and Qdrant has no access key (roadmap D12) | No chapter questions to pick and nothing to build a key from; nearly every question is `no_grounding` | You: protect Qdrant, then ingest |
| No OpenRouter key; answer keys are routed through it | A key cannot be built at all today | You: add a key, or decide to route keys to OpenAI |
| Strict-marking results not imported through the gates | Nothing is eligible for AI marking; the learner would get reading but no marks | Claude (import) after the run is complete |
| Migration 031 | New table | Needs your explicit go-ahead before it is applied (written, rehearsed on a scratch database, down script included) |

## Open points for the owner

- **Minors.** Independent learners may be under 18. Handwriting images are personal data: decide the consent wording and how long images are kept
  (the roadmap already lists the consent forms as awaiting legal review).
- **Key cost.** Building a key is the largest cost per question and is not yet measured per learner; shared keys (`hw_shared_key`) would spread it
  across learners who pick the same question. Whether the key build counts against the learner's ₹10 or the platform's is your call.
- **Hindi.** Hindi-medium learners need Hindi-medium books in the library, which do not exist yet.

## Build phases

1. **Backend (done 7 Nov, local):** migration 031 and down, trial service, actor change, per-learner budget check, automatic return with the label, tests.
2. **Question picker (done 7 Nov, local):** search the hub for exercise questions, verify, create the attempt, queue the key.
3. **Tab and pages (done 7 Nov, local, not checked in a browser):** the sidebar item, the picker, the answer page (reusing the student answer screen), the result with the label, trial status. English and Hindi.
4. **Pilot checklist (done 7 Nov):** `npm run hw:practice:readiness`, the runbook and monitoring queries in [self-practice-pilot.md](self-practice-pilot.md). Running the pilot is not done.
