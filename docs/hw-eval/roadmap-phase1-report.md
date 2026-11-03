# Roadmap Phase 1: report (4 Nov 2026)

Branch `perf/hw-cost`. Spend: ₹0 (no model calls were made).

## 1.2 Pending phase-1d runs: skipped, and the leak rate

**Skipped.** The OpenRouter account is at -$0.045 (total credit $10.00, usage $10.045; checked through the credits endpoint, key not printed). No run was started.
Still pending: M0-strict on `heldout-1d@v1` and `heldout-1c@v1`, M1-strict on `heldout-1c@v1` and repeats 3 to 5 on `heldout-1d@v1`, and the M0-strict grouping runs (about ₹84).

**The leak rate, from the runs already on disk** (`npm run hw:eval:rules`, recomputed from stored verdicts, no model call). The leak = a **reversed** fact (the variant says the opposite) given `right_idea_wrong_detail` instead of `different_fact`:

| Profile | Dataset | Reversed-fact judgements | `right_idea_wrong_detail` | Rate |
|---|---|---|---|---|
| M0-strict | smoke (`smallrun-b@v1`) | 15 | 3 | **20.0%** |
| M1-strict | smoke | 33 (pooled over all its run folders) | 0 | 0.0% |
| M1-strict | `heldout-1d@v1` | 36 (14 variants) | 0 | 0.0% |
| M0-strict | `heldout-1d@v1` | not run | | |

- **M0-strict is over the 5% line** (3 of 15), so on the roadmap's own rule the verdict wording needs fixing before the teachers see the decision kit, **if M0-strict stays a candidate**. Caveats: the smoke "reversed" classification was made after the verdicts were seen, and 15 judgements are few; the 5% rule has not yet been tested on a held-out M0-strict run (that is the ~₹35 run waiting for credit).
- **M1-strict is at 0 of 69** reversed-fact judgements. The pilot already carries M0-guarded (control), M0-strict and M1-strict.
- The *replaced*-fact cases (the wrong substance, not the opposite) do land in `right_idea_wrong_detail` often (M1-strict 16 of 68 on `heldout-1d`; M0-strict 13 of 20 on smoke). That is the grey zone the teachers decide, not the leak the roadmap measures.
- This is the stop condition of task 1.2. I have continued with the tasks that cost nothing (1.4, 1.5); the teachers should not receive the decision kit until you have decided what to do about M0-strict.

## 1.3 Direct batch probes: skipped

`GEMINI_API_KEY` is absent from `apps/api/.env.local`; `OPENAI_API_KEY` is still a 26-character placeholder. No call was made. D9 (E0 or E1) stays at E0.

## 1.4 The gaps, with file and line (nothing was changed)

**a) Does the product check eligibility before creating or showing AI suggestions? No.**
The only gate before an AI marking call is the institution's quota: `packages/core/src/lib/hw/jobs/grade-handler.ts:91-98` (and `read-handler.ts:58-66` for reading). The word "eligible" appears in non-eval product code only for rater task eligibility (`eval-tools/admin.ts`, `eval-tools/payloads.ts`). The Marking page shows any suggestion that exists (`apps/web/src/components/hw/teacher/Marking.tsx:144-148, 176`). The eligibility registry of Phase 5 is therefore wholly new.

**b) Quota unit, usage and month.**
- Unit: **answers per month**, not rupees. `hw_tenant_quota.monthly_answer_quota` is an integer (`db/hw-schema.ts:265`); the rule is stated in `lib/hw/cost/quota.ts:1-5`: reading (`pages_read`) and marking (`answers_graded`) are **each** counted against the same number.
- Usage: `hw_ai_usage_monthly` per institution per month, with pages, answers, tokens and `cost_paise` (`db/hw-schema.ts:249-259`, written in `cost/usage.ts:45-62`). The rupee cost is recorded but is **not** what the quota compares.
- Month: `monthKey()` is the first day of the **UTC** month (`lib/hw/db.ts:17-20`), so a month starts at 05:30 IST on the 1st, not at midnight IST. The monitoring roll-up uses IST days (`shadow/monitor.ts:16`), so the two boundaries differ.
- No quota row means quota 0: `quotaState` returns `q?.quota ?? 0` (`cost/quota.ts:37`), so AI is off even when `HW_FEATURE_DEFAULT_ENABLED` is true (`access/guards.ts:25-29` falls back to that flag for the feature switch only).
- Drafting a rubric also needs quota (`services/assignments.ts:306-307`) but adds only tokens and cost to the usage row, not to `answers_graded`.

**c) What `rubric-draft.v1` draws on: the teacher's model answer when there is one, otherwise the model's own knowledge.**
The prompt says "Base the items on the model answer when one is given. Do not invent facts that are not in the model answer or not standard for the question" (`prompts/rubric-draft.v1.ts:17`); with no model answer the input says "(none given)" (`:40`). The call goes straight to the model with no textbook retrieval and no key service (`services/assignments.ts:299-340`). So a draft can come from the model's own knowledge; it is saved with `source = 'ai_draft'` and shown with a "draft" badge only while unedited (`Builder.tsx:72`). **Publishing does not require a reviewed rubric**: `publishAssignment` only warns when a question has no scheme or the points do not add up (`services/assignments.ts:146-150`). This is the tension with "no source, no key" that Phase 5 task 5.2 addresses.

**d) Can the feature be switched on for part of an institution? Not directly.**
`isHwEnabled` reads one row per organisation (`access/guards.ts:25-29`; columns in `db/hw-schema.ts:261-267`: `enabled`, `monthly_answer_quota`). There is no class, section or teacher allow-list. In practice a pilot can be limited indirectly: a teacher can create or manage assignments only for classes linked to them (`access/policy.ts` `canManageAssignment` and `canCreateFor`), a student sees only assignments of their enrolled class and section (`studentCanSee`), so linking only pilot teachers and classes confines the work. An institution **admin** can create for any class (`canCreateFor` returns true for admin), and the menu entries appear for everyone in the institution once it is on (`TeacherSidebar.tsx:14`, `UserSidebar.tsx:56-58`).

**e) How a rater account is created today.**
A super admin adds a rater by **email of an existing account**; otherwise "No account with that email. The person must sign up first." (`eval-tools/admin.ts:47-50`). The roadmap's premise is out of date here: **self sign-up is open again** (`packages/core/src/auth/index.ts:150-157`, `disableSignUp: false`, owner decision 2026-08-16; the sign-up page says the same, `apps/web/src/app/(auth)/sign-up/page.tsx:46-48`), with email verification required. So a volunteer can sign up and be added; what is missing is the invitation flow, not the possibility of an account. A rater is just a `hw_eval_rater` row on a normal user (`eval-tools/actor.ts`), with no isolation from the product pages (Phase 3 task 3.2).

**f) Does `hw_eval_monitor_daily` have every field task 5.4 needs? No.**
It has: day, organisation, subject, question type (the key) and `answers_marked`, `ai_suggested`, `overrides`, `override_abs_sum`, `transcript_fixes`, `misread_flags` (`db/hw-eval-schema.ts:104-116`; counts defined in `shadow/monitor.ts:18-25`).
Missing for 5.4:
- the group dimensions **language** and **scheme source** (and a configuration hash / eligibility link);
- suggestions **shown** (as against created);
- accepted unchanged vs edited vs replaced by hand (only `overrides` exists);
- large overrides;
- instruction flags and "not an instruction" taps (they live in `hw_instruction_flag`, migration 020, per answer, not rolled up);
- failed jobs and batch fallbacks, and batch turnaround p50 and p90 (on `hw_ai_job`, not rolled up);
- ₹ per answer, actual against projected, and quota burn per institution (cost is in `hw_ai_usage_monthly`, not per group).

**g) Does any path show a student or parent anything before the teacher returns the work? Transcripts only, by design; no marks.**
- After hand-in a student receives the transcript of their own answers (`services/submissions.ts:69`; only when the submission is not a draft) so they can tap misread words (`AfterSubmit.tsx` `CheckAnswer`). The same payload carries no marks, no AI suggestion, no rubric, no model answer or accepted answers (`studentQuestion` returns only id, position, type, prompt, marks, language and lines, `submissions.ts:22-24`).
- Marks, per-key-point marks, comments and the concept feedback are refused until the work is returned: `myResult` checks `studentCanSeeResult` (`submissions.ts:233-235`, `access/policy.ts:105`) and concept feedback does the same (`concept-feedback.ts:42-43`).
- Parents: every student function starts with `requireRole(actor, 'student')` (`submissions.ts:27, 48`) and `policy.ts` gives the parent role no access, so a parent sees nothing.
- Worth a decision, not a bug: whether a student should see the **AI reading** of their own handwriting before the teacher has returned the work. It is a deliberate feature (flagging misreads) and exposes no mark.

## 1.5 Merge readiness

- **Merge `main` into the branch:** nothing to merge. `origin/main` has no commit that `perf/hw-cost` lacks (0), so the push is a fast-forward.
- **Tests:** hw suite with a scratch database holding the schema + 019 + 020: **402 passed, 2 skipped** (the two live-OpenRouter tests), 20 suites passed, 1 skipped. Without a database: 359 passed, 45 skipped (integration tests skip). `tsc -p scripts/tsconfig.hw.json`: clean.
- **Build:** `next build` in `apps/api` and in `apps/web`, both exit 0 (4 Nov 2026; the API build prints Redis connection-refused lines because no Redis runs locally, which do not fail it).
- **Migrations 019 and 020 together, with rollback:** rehearsed on a scratch Postgres 16 loaded from a schema-only dump of the dev database (104 tables). Both apply (107 tables), rollback of 020 then 019 returns an identical schema, re-apply works. **Not production's schema**: it is the dev database's, and `digiclassroom_app` does not exist there, so ownership must be checked on production (runbook step 2).
- **Runbook:** `docs/hw-eval/merge-hw-cost-runbook.md`.

**Waiting for the owner's go-ahead (task 1.5's STOP).** Nothing was pushed, merged or applied anywhere.
