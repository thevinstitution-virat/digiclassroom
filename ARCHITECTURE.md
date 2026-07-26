# DigiClassroom Pro Architecture

## Core Tech Stack

- **Framework**: Next.js 15 (App Router, React Server Components)
- **Language**: TypeScript (Strict Mode)
- **Database**: MySQL (Drizzle ORM, type-safe SQL schema)
- **API Layer**: tRPC v11 (End-to-end type safety, superjson transformer)
- **Authentication**: Better Auth (Custom JWT/Session hybrid)
- **Queueing/Background**: BullMQ + Redis (ioredis)
- **AI/LLM**: LangChain / LangGraph (Multi-provider via `LangChainModelFactory`)
- **Vector Database**: Qdrant (Hybrid keyword + semantic search)
- **Observability**: Langfuse (LLM Tracing), Pino (Structured Logging), PostHog (Analytics)

## System Design

### 1. The Agent Ecosystem

DigiClassroom operates as a multi-agent orchestrator. All agents use the **LangGraph StateGraph** pattern via `BaseGraphFactory`.

**Graph flow:**
```
START → set_agent_name → retrieve → validate_scope
  ├─ (out of scope) → scope_violation_handler → trace → END
  └─ (in scope)     → generate → format_citations → conditional
                                                       ├─ (empty + fallbackLevel < 3) → fallback → generate
                                                       └─ trace → END
```

**Migrated LangGraph Agents** (all in `src/lib/agents/graph/agents/`):
- StudyTips, CbseAnswerFormatter, ConversationalLearning
- ExamPreparation, TopicExplanation, SelfStudyBuddy
- DoubtClearing, HomeworkHelp, ConstrainedGeneration
- EnhancedSynthesis, Citation, SourceValidation

**Shared infrastructure nodes** (`src/lib/agents/graph/nodes/`):
- `retrieval-node.ts`, `scope-validation-node.ts`, `citation-format-node.ts`
- `langfuse-trace-node.ts`, `fallback-node.ts`, `scope-violation-handler-node.ts`

All agent requests route through `src/lib/agents/agent_manager.ts`.
Feature flags in `src/lib/config/feature-flags.ts` gate per-agent LangGraph rollout.

### 2. Retrieval-Augmented Generation (RAG)

**Hybrid Retrieval Engine** (`src/lib/agents/core/services/retrieval.service.ts`):
- Dense vector similarity (Qdrant + OpenAI Embeddings)
- Sparse BM25 keyword search (Qdrant)
- Cross-encoder reranking (`src/lib/ai/rag/cross-encoder-reranker.ts`)
- Redis caching for RAG results
- Metadata filtering (Board, Grade, Subject, Chapter)
- Optional web search enrichment (`ScopedWebSearchService`)

### 3. Frontend Architecture

```
src/components/
├── admin/           — Admin panel components
├── ai/              — AI/Chat components
│   ├── chat/        — Chat UI, streaming messages
│   ├── core/        — Core AI components
│   ├── sarvagya/    — Sarvagya document intelligence
│   └── tutor/       — AI Tutor interface
├── auth/            — Authentication flows
│   └── core/
├── core/            — Shared/foundational components
│   ├── common/      — Error boundaries, utilities
│   ├── layout/      — Page layouts, containers
│   ├── navigation/  — Navigation bars, breadcrumbs
│   ├── providers/   — React context providers
│   ├── shared/      — Cross-feature shared components
│   └── ui/          — Design system primitives
├── dashboard/       — Dashboard views
│   └── core/
├── learning/        — Learning experience components
│   ├── dictionary/  — Dictionary/vocabulary tools
│   ├── lesson/      — Lesson viewer
│   ├── materials/   — Study materials browser
│   ├── practest/    — Practice tests
│   └── quiz/        — Quiz interface
├── marketing/       — Public-facing pages
│   └── landing/     — Landing page
├── user/            — User profile
│   └── profile/
└── workspace/       — Productivity tools
    ├── productivity/ — General productivity
    └── sanchika/    — Sanchika note editor
```

Data fetching occurs via `@tanstack/react-query` wrapped by tRPC.
Styling is handled via Tailwind CSS.
Global state via React Context Providers injected in `layout.tsx`.

### 4. Database Schema

Schema definitions live in `src/db/schema.ts`. Drizzle handles migrations via `drizzle-kit`.

## Execution Flows

**Typical User Query Flow:**
1. User submits question via UI (`tRPC` mutation called).
2. API Route handles `tRPC` request, authenticates via Better Auth middleware.
3. Request routed to `src/lib/agents/agent_manager.ts`.
4. Agent Manager identifies intent and dispatches to correct LangGraph agent.
5. Agent calls `RetrievalService` → fetches context from Qdrant.
6. Agent constructs prompt via `LangChainModelFactory` → calls LLM.
7. Output formatted, citations applied → validated via Zod → returned to UI.

## Error Handling

All errors use the hierarchy in `src/lib/errors/`:
- `AppError` (base) → `AgentError`, `ValidationError`, `AuthError`, `RateLimitError`
- tRPC maps `AppError` → `TRPCError` in `src/lib/trpc/server.ts`
- Agents throw `AgentExecutionError` on failure (never raw strings)

## Logging

All logging via `src/lib/logger.ts` (pino structured logger).
**Never use `console.log`** — use `logger.info()`, `logger.error()`, etc.
