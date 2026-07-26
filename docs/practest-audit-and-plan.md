# Practest — Audit, Decisions & Build Plan

> Status: **living design doc**. Owner: platform/super-admin. Last updated by the Practest deep audit.
> Companion to `docs/identity-federation-design.md`.

Practest is the assessment engine of DigiClassroom Pro. The super-admin side controls the
question bank, test blueprints, and everything a student experiences at `/dashboard/user/practest`.
The long-term ambition is a **Testbook/Oliveboard-grade** engine governed by **Vinstitution's
CASA discipline** (every question pinned to board → textbook → chapter → **page**, zero
hallucination).

This document records (1) the **ground-truth audit** of what exists today, (2) the
**architectural decisions** to lock before building, and (3) the **phased plan**.

---

## 1. Ground truth — what exists today

There is a substantial scaffold, but it was built as **three independent layers that were never
reconciled**, so it does **not run end-to-end** today.

### 1.1 The three inconsistent models

| Layer | File(s) | "Question" shape | "Session" shape |
|---|---|---|---|
| **Live DB** (migration `003` + Drizzle) | `lib/db/practest-migrate.ts`, `db/schema.ts` | `option_a/b/c/d`, `correct_option`, `class_level`, `difficulty_level`*, `bloom_level`*, `content_hash`* | `total_score`, `start_time`, `end_time`, `percentage`, `user_responses`, `question_wise_results` |
| **Runtime queries** (what the APIs call) | `lib/db/practest-queries.ts` | `options` (JSON), `correct_answer`, `grade`, `difficulty` | `score`, `started_at`, `completed_at` |
| **Types** (what the UI compiles against) | `types/practest.ts` | all of the above **plus** `discrimination_index`, `difficulty_index`, `cognitive_load`, `reviewed_by`, `CurriculumStructure.ncert_page_numbers` | `topic_wise_performance`, `time_analytics`, `device_info` |

\* Declared in the migration SQL / sample-data insert but **not** in the Drizzle `schema.ts`
(`schema.ts` and the `003` SQL have themselves drifted).

**Consequence:** `practest-queries.ts` filters on `pqb.grade`, `pqb.options`, `pqb.correct_answer`,
and inserts `started_at` / `score` — none of which exist in the live table (`class_level`,
`option_a..d`, `correct_option`, `start_time`, `total_score`). The student flow throws
*"Unknown column"* at runtime.

### 1.2 Functional status

| Area | Status | Evidence |
|---|---|---|
| Student `generate` / `submit` / `history` | 🔴 **Broken at runtime** | raw SQL references non-existent columns |
| `chapters` API | 🔴 Broken | queries `materials.grade` (no such column) |
| Admin console (`/dashboard/super-admin/practest`) | 🟡 **Shell + mock data** | `loadAdminStats()` returns hardcoded `15420…`; **no admin API exists** |
| Security / multi-tenancy | 🟢 **Solid** | `withOrgContext` + org-scoped queries; platform-global (`NULL` org) questions; answer key **withheld** from `generate`; score **recomputed server-side** on `submit` |
| Schema (3 tables) | 🟢 Good base | `practest_question_bank`, `practest_test_configurations`, `practest_test_sessions` — org-scoped, Bloom/difficulty distributions, randomization & review toggles |
| Components | 🟡 **Duplicated** | `components/practest/*` (live) **and** `components/learning/practest/*` (dead twin) |

### 1.3 Inventory
- **Tables:** `practest_question_bank`, `practest_test_configurations`, `practest_test_sessions` (all `organization_id`-scoped, nullable = platform-global).
- **APIs:** `api/practest/{generate,submit,chapters,history}` — all student-facing. **No admin API.**
- **Lib:** `practest-queries.ts` (raw SQL), `practest-session-queries.ts`, `question-selection-engine.ts`, `practest-migrate.ts`.
- **Admin UI:** 5-tab console (Overview/Questions/Editor/Analytics/Settings) + `QuestionEditor`, `QuestionBankManager`, `PractestAnalytics`.
- **Student UI:** `TestGeneratorForm`, `ActiveTestInterface`, `TestResultsView`.

---

## 2. Gaps vs. the Testbook/Oliveboard + CASA blueprint

- **Page-level CASA** — questions map to `board→class→subject→chapter→topic`; there is **no
  textbook entity and no page reference**. The flagship "page-level citation + 100% curriculum
  alignment" promise is unbuilt. (`CurriculumStructure` type mentions `ncert_page_numbers` but
  has no table and no FK.)
- **Competitive-exam model** — everything is school-board (CBSE/ICSE/State, `class_level`). No
  `Exam → Section → PatternVersion` (UPSC/NEET/JEE/CSAT/AIR, sectional timing, cut-offs).
- **RBAC authoring** — only a `validation_status` enum; no SME/Reviewer/QA/Exam-Lead pipeline,
  no question versioning, no audit trail.
- **i18n variants** — single-language question; no `question_group_id`.
- **Real analytics** — raw counters live on the question row; no discrimination/percentile/cohort
  computation; mutating the question row won't scale.
- **Adaptive recommendations, config-toggle service, ecosystem integrations** — none.
- **Real scoring** — `submit` computes `correct/total %` only; ignores `max_marks`, negative &
  partial marking (which the schema already supports).

---

## 3. Architectural decisions to lock (cheap now, expensive later)

1. **One canonical model.** Keep the live rich schema as canonical; **reconcile
   `practest-queries.ts` (and `schema.ts`) to it** so the engine actually runs. Prefer Drizzle ORM
   over raw SQL to make column drift impossible.
2. **CASA = edition-pinned anchor resolved against the Qdrant NCERT corpus**, and *verified*
   (the keyed answer must derive from the cited chunk), not merely a mandatory field. Reuse the
   existing ingestion/embeddings (questions already share `organization_id` payload tagging).
3. **`Exam → Section → PatternVersion(effective_from)`** abstraction — a board class is just an
   exam with one section. Add before competitive exams arrive.
4. **Logical `Question` vs. per-language/per-version `QuestionRendering`.** Analytics + CASA attach
   to the logical question; renderings carry localized stem/options/solution. Do the split before
   data accumulates (otherwise every historical attempt must be re-keyed).
5. **Append-only attempt events + derived analytics tables.** Stop mutating
   `usage_count/total_attempts` on the question row. Define discrimination precisely (point-biserial)
   and gate on a minimum sample size before acting on it.
6. **Bank ownership = global + per-institution**, gated by the **existing entitlement layer**
   (`organization.settings.entitlements`). RBAC sub-roles (Exam-Lead/SME/Reviewer/QA/Analytics)
   are **scoped Practest capabilities**, not new platform global roles.

---

## 4. Phased plan

### Phase 0a — Make it real (small, immediately verifiable)
- Reconcile `practest-queries.ts` ↔ live schema (use Drizzle) so `generate/submit/history` work.
- Fix the `chapters` route (`materials` grade/class column).
- Replace the admin **mock** stats with a real `GET /api/practest/admin/stats` (platform-wide for
  super_admin) and wire `loadAdminStats()`.
- Delete the duplicate `components/learning/practest/*` tree.

### Phase 0b — Foundations
- Add CASA: `textbook`/`edition`/`page-anchor` model + Qdrant tie-in + page-level authoring check.
- Land the model decisions: Exam/Section, logical-Question/Rendering split, append-only attempts.
- Reconcile `schema.ts` ↔ migration ↔ `types/practest.ts` into one source of truth.

### Phase 1 — Engine (per blueprint, on solid ground)
- Authoring & review pipeline (RBAC capabilities, versioning, dedup via embeddings).
- Real scoring (marks, negative/partial), server-authoritative timer, idempotent submit.
- Question-level analytics (difficulty/discrimination) + student/cohort dashboards.

### Phase 2 — Analytics & recommendations
- Percentile/AIR, cohort analytics, rule-based recommendation engine.

### Phase 3 — Advanced UX & ecosystem
- Feature-flag config service, DigiClassroom/PDLMS/Vidyaverse integration, CASA & bank-health dashboards.

---

## 5. Notes & invariants
- **Security model is good — preserve it:** `withOrgContext`, platform-global (`NULL` org)
  questions, answer key withheld from `generate`, server-side score recompute on `submit`.
- The model is currently **school-board**, not competitive-exam. Generalize via the Exam
  abstraction rather than bolting competitive exams onto the class/subject schema.
