# Multi-Tenancy Audit & Hardening Plan

Status as of 2026-06-13. Goal: **true, enforced B2B2C multi-tenancy** — institutions strictly isolated by org; individual (D2C) learners keep working against global content; the platform owner sees across orgs.

## Isolation contract

Every tenant-ownable row is exactly one of:

| Class | Rule | Examples |
|---|---|---|
| **org-owned** | `organization_id = <orgId>` — visible only inside that org | institution classes/sections/enrollments, an org's private question bank, org materials |
| **global / platform** | `organization_id IS NULL` — readable by everyone | NCERT base materials, the global dictionary, default subscription plans |
| **personal** | `user_id = <userId>` (org-tagged or B2C/null) | notes, folders, subscriptions, usage, sarvagya spaces, quiz history |

Callers (`TenantContext`): **platform staff** (super_admin → cross-org), **org member** (orgId set), **individual/B2C** (orgId null → global + own personal only).

## What already exists (the good)

- **`organization` / `member` / `invitation`** tables (Better Auth) + **~38 tenant tables** carry `organization_id` FK (cascade delete).
- **`getOrgContext()`** — membership-verified org resolution; closes the swapped-cookie cross-tenant gap by checking `(userId, orgId)` against `member`.
- **`withOrgContext()`** wrapper — used by **19 routes** (practest/*, materials, materials/access, institution/*, analytics/*) with role gates + `requireOrg`.
- **Vector/RAG isolation** — `chat/stream` computes a fail-closed org scope (member → org+global, B2C → global-only); uploads tag `organization_id`.

## The gaps (why it isn't "true" yet)

1. **`withOrgContext` rejects B2C.** It calls `getOrgContext()`, which **throws for any non-staff user with no org** — so the 19 wrapped routes (incl. practest, materials) are **B2B-only and 401/403 every individual D2C learner**, even with `requireOrg:false`. This breaks the B2B2C promise for shared features.
2. **`scopedQuery()` is unused** (0 real call sites) and **`isRbacEnforced()` is never called** — the enforcement switch gates nothing; `MT_RBAC_ENFORCEMENT` is unset (false).
3. **187 raw DB ops across 77 route files**; only 19 use the wrapper. The remainder scope by `userId` (ok for personal data) or not at all. Org-owned tables touched **outside** the wrapper without an explicit org filter are the real leak surface.
4. **`organization_id` is nullable on every content/personal table** and not backfilled → isolation isn't structurally guaranteed; `enforce-org-not-null.ts` exists but is unapplied.
5. **No DB-level RLS** (MySQL) — isolation is app-layer only, so it must be applied at every query.
6. **Schema holes**: `note_links` has `user_id` but **no `organization_id`**; some teacher tables likewise — can't be org-filtered today.

## The new foundation (Phase 1 — done)

`src/lib/db/tenant-scope.ts` (additive — nothing uses it yet; typecheck unchanged):
- **`getTenantContext()`** — B2B2C-aware: authenticated + no org = valid individual caller (orgId null), not an error.
- **`tenantScope(ctx)`** — **Drizzle** filter builders: `orgOnly`, `orgOrGlobal`, `personal`, `orgIdForInsert()`. Platform staff → no restriction.
- **`tenantSql(ctx, alias)`** — **raw-SQL** variant returning `{ clause, params }` for the majority of routes built on `executeQuery()` (notes, materials, practest, …). `clause: '1=1'` = platform bypass.
- **`requireOrgScope(ctx)`** — institution-only guard; rejects B2C when `MT_RBAC_ENFORCEMENT` on, degrades safe (global-only) while off.

## Course correction from reading the real code (2026-06-13)

- **Personal data is already correctly isolated by `user_id`** (notes/folders/etc. filter `WHERE user_id = ?` and tag `organization_id` on insert). For personal rows, `user_id` IS the access boundary — **do NOT add an org read-filter**, because it would *hide a user's own data* when they switch org context (a regression). The MT requirement for personal tables is just correct org *tagging* (already done), used for analytics/billing, not access control.
- So the **real leak surface is org-OWNED content** queried without an org filter — NOT personal routes.
- The app is **majority raw SQL** (`executeQuery`), not Drizzle — hence the `tenantSql` raw helper above is the actual enabler for migration.

## Phased rollout (remaining)

- **Phase 2 — org-OWNED content routes (batched, verified) — the real work:**
  - *2a* **Audit & fix org-owned reads/writes** missing an org filter. Verify each route that touches `materials`, `practest_question_bank`/`configurations`, `classes`/`institution_classes`/`sections`/`enrollments`, `teacher_*`, `sarvagya_documents`, `google_drive_*`, `note_templates`, `dictionary_words` actually applies `tenantSql().orgOnly()`/`orgOrGlobal()`. (materials ✅ already filters; practest is `withOrgContext`-gated — verify the bank query itself filters org.)
  - *2b* **Fix the B2C-rejection bug** on shared features (materials, practest): make them serve no-org/D2C learners against global content via `getTenantContext` + `orgOrGlobal()`, instead of `getOrgContext()` throwing 403.
  - *2c* Personal routes: **leave reads `user_id`-scoped**; only confirm `organization_id` is tagged on insert (defense for analytics). No read-filter change.
  - *2d* super-admin/* — already platform-guarded; audit cross-org writes stamp the right target org.
- **Phase 3 — schema:** add `organization_id` to `note_links` + teacher tables; backfill all NULLs that should be org-owned; add `NOT NULL` only on truly org-owned tables (leave global/personal nullable).
- **Phase 4 — enforce:** wire `requireOrgScope`/`isRbacEnforced` into the institution routes; set `MT_RBAC_ENFORCEMENT=true`; narrow the Phase-1 `admin` bypass.
- **Phase 5 — vectors:** confirm every Qdrant search applies the org/global directive (chat/stream done; verify enhanced-query, sarvagya, materials search).
- **Phase 6 — tests:** a tenant-isolation suite (member A cannot read org B; B2C sees only global + own; super_admin sees all).

Each phase is a checkpoint; nothing destructive (Phase 3 constraints, Phase 4 enforcement flip) runs without explicit go-ahead + verification.
