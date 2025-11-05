# Architecture Decision Record (ADR)

## Context

Virat Gyankosh AI Tutor needs to scale from 100 concurrent users to **1 million+ concurrent users** while maintaining code quality for a growing development team.

**Current Issues:**
- 11-17 second response times (target: 3-5s)
- <5% cache hit rate (target: 60-85%)
- ~10% error rate (target: <1%)
- Code duplication across 6 agents
- Merge conflicts from tight coupling
- Difficult to swap components (LLM, vector DB, etc.)

---

## Decision: Hybrid Architecture

**Chosen Approach:** Composition + Dependency Injection + Event-Driven Design

### Why This Approach?

#### 1. Composition Over Inheritance

**Decision:** Use composition pattern for agent capabilities

**Rationale:**
- ✅ **Flexibility:** Agents can mix and match capabilities without inheritance hierarchy
- ✅ **Testability:** Easy to inject mock capabilities for testing
- ✅ **Maintainability:** No deep inheritance chains to understand
- ✅ **Reusability:** Capabilities shared across all agents without duplication

**Trade-offs:**
- ❌ Slightly more verbose (need to inject dependencies)
- ✅ But: Much easier to understand and maintain long-term

**Alternative Considered:** Abstract base class with inheritance
- ❌ Rejected because: Creates tight coupling, difficult to test, inheritance hierarchy becomes complex

---

#### 2. Dependency Injection Container

**Decision:** Use full DI container (not simple registry)

**Rationale:**
- ✅ **Lifecycle Management:** Singleton, Transient, Scoped lifecycles prevent memory leaks
- ✅ **Hot-Swapping:** Replace services without restarting (zero-downtime deployments)
- ✅ **Testing:** Mock any service easily
- ✅ **Monitoring:** Centralized health checks
- ✅ **Circular Dependency Detection:** Prevents initialization bugs

**Trade-offs:**
- ❌ More complex than simple registry
- ✅ But: Essential for 1M+ users (prevents memory leaks, enables monitoring)

**Alternative Considered:** Simple module-level singletons
- ❌ Rejected because: No lifecycle management, difficult to test, no health monitoring

**When to Use Simple Registry:**
- ✅ If you have <10 services
- ✅ If you don't need hot-swapping
- ✅ If you're not scaling beyond 10,000 users

**Why We Need Full DI:**
- ✅ We have 8+ services
- ✅ We need zero-downtime deployments
- ✅ We're targeting 1M+ users

---

#### 3. Interface-Based Contracts

**Decision:** All services implement interfaces

**Rationale:**
- ✅ **Upgradability:** Swap OpenAI for Claude/Gemini without changing agent code
- ✅ **Testing:** Mock services easily
- ✅ **Type Safety:** TypeScript enforces contracts
- ✅ **Clear Boundaries:** Each service has well-defined API

**Trade-offs:**
- ❌ More files to maintain (interface + implementation)
- ✅ But: Enables swapping implementations without breaking changes

**Example:**
```typescript
// Current: OpenAI
class OpenAILLMService implements ILLMService { ... }

// Future: Swap to Claude (agents don't change!)
class ClaudeLLMService implements ILLMService { ... }
```

---

#### 4. Multi-Layer Caching

**Decision:** 3-layer caching strategy

**Layers:**
1. **Pre-Generated Answers** (MySQL) - 7 day TTL - 20-30% hit rate
2. **Semantic Cache** (Redis) - 24 hour TTL - 10-15% hit rate
3. **Vector Search Cache** (Redis) - 1 hour TTL - 30-40% hit rate

**Total Expected Hit Rate:** 60-85%

**Rationale:**
- ✅ **Performance:** 95% of requests served from cache (sub-second response)
- ✅ **Cost Savings:** Reduce OpenAI API calls by 60-85%
- ✅ **Scalability:** Cache handles 1M+ users, LLM doesn't need to

**Trade-offs:**
- ❌ More complexity (3 cache layers to manage)
- ❌ Cache invalidation complexity
- ✅ But: Essential for 1M+ users (LLM can't handle that load)

---

#### 5. Agent Orchestrator

**Decision:** Centralized orchestration layer

**Rationale:**
- ✅ **Routing:** Single place to route requests to agents
- ✅ **Fallback:** Graceful degradation when agents fail
- ✅ **Analytics:** Track all agent executions
- ✅ **Health Monitoring:** Check agent health

**Trade-offs:**
- ❌ Extra layer of indirection
- ✅ But: Prevents code duplication in routing logic

---

## Scalability Analysis

### How This Architecture Scales to 1M+ Users

#### Horizontal Scaling
```
Load Balancer
    ↓
Next.js Instance 1 (1,000 concurrent users)
Next.js Instance 2 (1,000 concurrent users)
...
Next.js Instance 1,000 (1,000 concurrent users)
    ↓
Shared Redis Cache (handles 100,000+ ops/sec)
    ↓
Shared MySQL (read replicas for 10,000+ queries/sec)
    ↓
Shared Qdrant (handles 10,000+ searches/sec)
```

**Key Enablers:**
- ✅ **Stateless Services:** No server-side session state
- ✅ **Singleton Pattern:** One service instance per Next.js instance
- ✅ **Connection Pooling:** Reuse database/Redis connections
- ✅ **Caching:** 60-85% hit rate = 5-10x fewer LLM calls

#### Performance Targets

| Metric | Current | Target | How |
|--------|---------|--------|-----|
| Response time (P50) | 11-17s | 3-5s | Multi-layer caching |
| Response time (P95) | 20s+ | 8-12s | Optimized filters |
| Cache hit rate | <5% | 60-85% | 3-layer caching |
| Error rate | ~10% | <1% | Circuit breakers |
| Concurrent users | 100 | 1M+ | Horizontal scaling |

---

## Maintainability Analysis

### How This Architecture Prevents Merge Conflicts

#### Problem: Current Architecture
```
6 developers editing same files:
- src/lib/agents/homework_help_agent.ts (1150 lines)
- src/lib/ai/rag/qdrant-search.ts (1241 lines)
→ Constant merge conflicts
```

#### Solution: Modular Architecture
```
Developer A: src/lib/agents/homework-help.agent.ts (300 lines)
Developer B: src/lib/agents/topic-explanation.agent.ts (300 lines)
Developer C: src/lib/agents/exam-prep.agent.ts (300 lines)
Developer D: src/lib/services/implementations/vector-search.service.ts
Developer E: src/lib/services/implementations/cache.service.ts
Developer F: src/lib/orchestration/agent-orchestrator.ts

Shared (rarely changes):
- src/lib/agents/core/agent-capabilities.ts
- src/lib/agents/core/base-agent.ts
- src/lib/services/interfaces/index.ts
```

**Result:** Developers work in separate files, minimal conflicts

---

## Upgradability Analysis

### How to Swap Components

#### Example 1: Swap LLM (OpenAI → Claude)

**Step 1:** Create new implementation
```typescript
// src/lib/services/implementations/claude-llm.service.ts
export class ClaudeLLMService implements ILLMService {
  // Implement same interface
}
```

**Step 2:** Update service registry
```typescript
// src/lib/di/service-registry.ts
container.register(
  SERVICE_NAMES.LLM,
  async () => new ClaudeLLMService(), // Changed this line only
  ServiceLifecycle.SINGLETON
);
```

**Step 3:** Done! Agents don't change.

---

#### Example 2: Swap Vector DB (Qdrant → Pinecone)

**Step 1:** Create new implementation
```typescript
// src/lib/services/implementations/pinecone-vector-search.service.ts
export class PineconeVectorSearchService implements IVectorSearchService {
  // Implement same interface
}
```

**Step 2:** Update service registry
```typescript
container.register(
  SERVICE_NAMES.VECTOR_SEARCH,
  async () => new PineconeVectorSearchService(),
  ServiceLifecycle.SINGLETON
);
```

**Step 3:** Done! Agents don't change.

---

## Trade-offs Summary

### What We Gain
- ✅ **Scalability:** 1M+ concurrent users
- ✅ **Performance:** 3-5s response time (from 11-17s)
- ✅ **Maintainability:** No merge conflicts, modular code
- ✅ **Upgradability:** Swap any component without breaking changes
- ✅ **Testability:** Easy to mock services
- ✅ **Reliability:** <1% error rate (from ~10%)

### What We Pay
- ❌ **Complexity:** More files, more abstractions
- ❌ **Learning Curve:** Team needs to understand DI, composition
- ❌ **Initial Development Time:** 4-6 weeks to migrate

### Is It Worth It?
- ✅ **YES** if targeting 1M+ users
- ✅ **YES** if team is growing (3+ developers)
- ✅ **YES** if need to swap components (LLM, vector DB)
- ❌ **NO** if staying at <10,000 users with 1-2 developers

---

## Recommendation

**For Virat Gyankosh AI Tutor:** ✅ **IMPLEMENT FULL ARCHITECTURE**

**Reasons:**
1. Target: 1M+ users (requires horizontal scaling)
2. Team: Growing (requires modular code)
3. Tech: May swap LLM/vector DB (requires interfaces)
4. Performance: 11-17s → 3-5s (requires caching)
5. Reliability: ~10% → <1% errors (requires proper error handling)

**Migration Timeline:** 4-6 weeks (see MIGRATION_PLAN.md)

**Expected ROI:**
- 3-5x faster response times
- 10x more concurrent users per instance
- 90% reduction in merge conflicts
- Zero-downtime component swapping

