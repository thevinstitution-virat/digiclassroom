# Phase 2b — Route Tiering Audit
# All 143 API routes categorized into three tiers for org-scoping treatment.
# Complete this audit BEFORE enabling MT_RBAC_ENFORCEMENT (Phase 2d).
#
# TIERS:
#   PLATFORM  — super_admin only; no org scope; withOrgContext({ requireOrg: false, roles: ['super_admin'] })
#   ORG       — org-scoped; withOrgContext({ requireOrg: true }); DB query MUST include orgId WHERE clause
#   USER      — auth required, no org gate; withOrgContext({ requireOrg: false })
#   PUBLIC    — no auth; already in publicPrefixes
#   DELETE    — remove from codebase (dead/test routes)
#
# STATUS KEY:
#   ✅ DONE   — withOrgContext + DB scoping confirmed correct
#   ⚠️ TODO   — needs withOrgContext and/or DB query orgId clause
#   🔴 URGENT — data leak confirmed; fix before Phase 2d
#   🗑️ DELETE — dead code; remove file

---

## Admin Routes — All PLATFORM tier

| Route | Method | Tier | Status | Notes |
|-------|--------|------|--------|-------|
| /api/admin/users | GET/POST | PLATFORM | ⚠️ TODO | Add super_admin gate; currently admin-only |
| /api/admin/users/bulk | POST | PLATFORM | ⚠️ TODO | |
| /api/admin/users/[userId] | GET/PUT/DELETE | PLATFORM | ⚠️ TODO | |
| /api/admin/books | GET/POST | PLATFORM | ⚠️ TODO | Book ingestion is platform-wide |
| /api/admin/books/[bookId]/ingest | POST | PLATFORM | ⚠️ TODO | |
| /api/admin/books/[bookId]/ingest/status | GET | PLATFORM | ⚠️ TODO | |
| /api/admin/qdrant/books | GET | PLATFORM | ⚠️ TODO | |
| /api/admin/qdrant/stats | GET | PLATFORM | ⚠️ TODO | |
| /api/admin/qdrant/clear | DELETE | PLATFORM | ✅ DONE | Fixed in Phase 2a (I6 fix) |
| /api/admin/queues | GET | PLATFORM | ⚠️ TODO | BullMQ — platform-wide |
| /api/admin/teachers/pending | GET | PLATFORM | ⚠️ TODO | |
| /api/admin/teachers/approve/[id] | POST | PLATFORM | ⚠️ TODO | |
| /api/admin/teachers/reject/[id] | POST | PLATFORM | ⚠️ TODO | |
| /api/admin/quality-metrics | GET | PLATFORM | ⚠️ TODO | |
| /api/admin/sarvagya/health | GET | PLATFORM | ⚠️ TODO | |
| /api/admin/pre-generated-answers | GET/POST | PLATFORM | ⚠️ TODO | |

---

## AI / Chat Routes — ORG tier (chat is per-org content)

| Route | Method | Tier | Status | Notes |
|-------|--------|------|--------|-------|
| /api/chat/stream | POST | ORG | ⚠️ TODO | RAG retrieval scoped to org's materials |
| /api/ai/stream | POST | ORG | 🗑️ DELETE | Duplicate of /api/chat/stream — consolidate first |
| /api/ai/chat | POST | ORG | ⚠️ TODO | Legacy fallback — keep until /api/chat/stream is stable |
| /api/ai/enhanced-query | POST | ORG | ⚠️ TODO | |
| /api/ai/generate-visual | POST | USER | ⚠️ TODO | GPT-4V — user-level, no org-specific data |
| /api/ai/translate | POST | USER | ⚠️ TODO | Azure Translator — stateless |
| /api/ai/word-meanings | POST | USER | ⚠️ TODO | Dictionary AI — global |
| /api/ai/health | GET | PUBLIC | ✅ OK | Unauthenticated health — acceptable |

---

## Practest Routes — ORG tier (fixed in Phase 2a)

| Route | Method | Tier | Status | Notes |
|-------|--------|------|--------|-------|
| /api/practest/* | GET/POST/PUT/DELETE | ORG | ✅ DONE | Use practestQueries(orgId) from Phase 2a fix |

---

## Notes / Sanchika — USER tier (personal notes, not org-shared)

| Route | Method | Tier | Status | Notes |
|-------|--------|------|--------|-------|
| /api/notes/* | GET/POST/PUT/DELETE | USER | 🔴 URGENT | clerkId D1 fix required first; notes are user-personal not org-shared |
| /api/folders/* | GET/POST/PUT/DELETE | USER | ⚠️ TODO | Bug A8 (operator precedence) made /folders accidentally public |

---

## Institution Routes — ORG tier

| Route | Method | Tier | Status | Notes |
|-------|--------|------|--------|-------|
| /api/institution/* | GET/POST/PUT/DELETE | ORG | ⚠️ TODO | orgRole: owner/org_admin required |
| /api/teacher/* | GET/POST | ORG | ⚠️ TODO | Teacher registration scoped to org |

---

## Materials — ORG tier (content is per-org)

| Route | Method | Tier | Status | Notes |
|-------|--------|------|--------|-------|
| /api/materials/* | GET/POST/PUT/DELETE | ORG | ✅ DONE | materials.organizationId FK exists; WHERE clause must be enforced |

---

## Dictionary — USER tier (global word list, not org-specific)

| Route | Method | Tier | Status | Notes |
|-------|--------|------|--------|-------|
| /api/dictionary/search | GET | USER | ⚠️ TODO | Word lookup — global |
| /api/dictionary/translate | POST | USER | ⚠️ TODO | |
| /api/dictionary/cache | GET/POST | USER | ⚠️ TODO | |
| /api/dictionary/test* (5 routes) | * | DELETE | 🗑️ DELETE | Test routes in production |

---

## Quiz / Flashcards — USER tier

| Route | Method | Tier | Status | Notes |
|-------|--------|------|--------|-------|
| /api/quiz/* | GET/POST | USER | ⚠️ TODO | Spaced repetition is per-user |
| /api/flashcards/generate | POST | USER | ⚠️ TODO | |

---

## Subscriptions — USER tier (plan is per-user, not per-org)

| Route | Method | Tier | Status | Notes |
|-------|--------|------|--------|-------|
| /api/user/subscription/* | GET/POST | USER | ⚠️ TODO | D7 fix ensures userSubscriptions is in scopedQuery now |

---

## Engagement / Attention — USER tier

| Route | Method | Tier | Status | Notes |
|-------|--------|------|--------|-------|
| /api/curricutimer/* | GET/POST | USER | ⚠️ TODO | |
| /api/mitram/* | GET/POST | USER | ⚠️ TODO | Attention assessments are per-user |
| /api/performance/profile | GET | USER | ⚠️ TODO | |

---

## Utility — USER tier

| Route | Method | Tier | Status | Notes |
|-------|--------|------|--------|-------|
| /api/ocr | POST | USER | ⚠️ TODO | Remove from publicPrefixes (A7) — done in middleware fix |
| /api/speech-to-text | POST | USER | ⚠️ TODO | |
| /api/voice-notes/* | GET/POST/DELETE | USER | ⚠️ TODO | |
| /api/drawings | GET/POST | USER | ⚠️ TODO | |
| /api/pdf-attachments | GET/POST | USER | ⚠️ TODO | |
| /api/audio/[jobId] | GET | USER | ⚠️ TODO | Audio job polling — per-user |
| /api/smart-detect | POST | USER | ⚠️ TODO | |
| /api/ai-writing | POST | USER | ⚠️ TODO | |
| /api/feedback/* | POST | USER | ⚠️ TODO | |

---

## Auth Routes

| Route | Tier | Status | Notes |
|-------|------|--------|-------|
| /api/auth/[...all] | PUBLIC | ✅ OK | Better Auth handler |
| /api/assign-role | PUBLIC | ✅ DONE | Fixed in Phase 1 |
| /api/webhooks/razorpay | PUBLIC | ✅ OK | Webhook signature verified internally |
| /api/webhook/clerk | DELETE | 🗑️ DELETE | Dead — Clerk removed (Bug I4) |

---

## tRPC Routes

| Router | Tier | Status | Notes |
|--------|------|--------|-------|
| content.* | ORG | ⚠️ TODO | Book/chapter queries — org-scoped |
| dictionary.* | USER | ⚠️ TODO | Global word data |
| sarvagya.* | ORG | ⚠️ TODO | Sarvagya bridge — pass orgId through |

---

## Routes to DELETE (never re-add to publicPrefixes)

```
/api/debug/user
/api/dev/reset-quota
/api/test/advanced-components
/api/test/educational-rag
/api/test-multi-modal
/api/test-ocr
/api/dictionary/test* (5 routes)
/api/ragas/batch-evaluate
/api/experiments/*
/api/ground-truth/*
/api/scan-books
/api/webhook/clerk
/api/ai/stream  (consolidate into /api/chat/stream first)
```

---

## Priority Order for Phase 2b Implementation

Fix in this sequence (highest data-leak risk first):

1. 🔴 /api/materials/*      — org-scoped content; highest leak surface
2. 🔴 /api/practest/*       — done in Phase 2a; verify WHERE clauses in route handlers too
3. 🔴 /api/chat/stream      — RAG must only retrieve org's own materials
4. 🔴 /api/institution/*    — institution data must be per-org
5. ⚠️ /api/admin/* (all)    — restrict to super_admin role via manage:platform
6. ⚠️ /api/notes/*          — user-scoped; unblock D1 fix first
7. ⚠️ remaining USER routes — add withOrgContext({ requireOrg: false }) for auth gate
