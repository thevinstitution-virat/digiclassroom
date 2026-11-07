# Self-practice for independent learners, Virat Gyankosh trial (design, 7 Nov 2026)

Owner decisions (7 Nov): an independent learner **practises textbook questions** (pick a chapter question, write the answer, get AI reading,
marks and feedback; the model answer comes from the textbook). The **trial is up to ₹10 of AI cost within 7 days**. It opens **only after the
strict-marking gates pass**, with marks shown as an **AI practice estimate**.

Status: design only. Nothing below is built, migrated or switched on.

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
8. **The tab.** "Virat Evaluator" in the Virat Gyankosh section of the user sidebar, shown only when the flag is on and the user has no institution
   (or has a trial). Every string has English and Hindi.

## Blockers on the live server (not code)

| Blocker | Why it matters | Who |
|---|---|---|
| No textbook is ingested, and Qdrant has no access key (roadmap D12) | No chapter questions to pick and nothing to build a key from; nearly every question is `no_grounding` | You: protect Qdrant, then ingest |
| No OpenRouter key; answer keys are routed through it | A key cannot be built at all today | You: add a key, or decide to route keys to OpenAI |
| Strict-marking results not imported through the gates | Nothing is eligible for AI marking; the learner would get reading but no marks | Claude (import) after the run is complete |
| Migration 031 | New table | Needs your explicit go-ahead before it is applied |

## Open points for the owner

- **Minors.** Independent learners may be under 18. Handwriting images are personal data: decide the consent wording and how long images are kept
  (the roadmap already lists the consent forms as awaiting legal review).
- **Key cost.** Building a key is the largest cost per question and is not yet measured per learner; shared keys (`hw_shared_key`) would spread it
  across learners who pick the same question. Whether the key build counts against the learner's ₹10 or the platform's is your call.
- **Hindi.** Hindi-medium learners need Hindi-medium books in the library, which do not exist yet.

## Build phases

1. **Backend:** migration 031 and down, trial service, actor change, per-learner budget check, automatic return with the label, tests with fake providers.
2. **Question picker:** list chapter practice questions from the hub, create the attempt, queue the key.
3. **Tab and pages:** the sidebar item, the picker, the answer page (reusing the student answer screen), the result with the label, trial status. English and Hindi.
4. **Pilot checklist:** the blockers above cleared, then a trial with a few invited learners.
