# Quick Start Guide - Enterprise Architecture

## For Developers New to the Codebase

This guide helps you understand and work with the new enterprise architecture.

---

## Architecture in 5 Minutes

### The Big Picture

```
User Request
    ↓
API Route (route.ts)
    ↓
Agent Orchestrator (routes to correct agent)
    ↓
Agent (e.g., HomeworkHelpAgent)
    ↓
Agent Capabilities (search, generate, verify)
    ↓
Services (LLM, VectorSearch, Cache)
    ↓
Infrastructure (OpenAI, Qdrant, Redis)
```

### Key Concepts

1. **Dependency Injection (DI):** Services are registered in a container and injected where needed
2. **Composition:** Agents use capabilities (not inheritance)
3. **Interfaces:** Services implement contracts (easy to swap)
4. **Orchestration:** Central router handles all requests

---

## How to Add a New Agent

### Step 1: Create Agent File

**File:** `src/lib/agents/my-new-agent.agent.ts`

```typescript
import {
  BaseAgent,
  type AgentRequest,
  type AgentResponse,
  type StreamingAgentResponse
} from './core/base-agent';
import type { AgentCapabilities, AgentConfig } from './core/agent-capabilities';

export class MyNewAgent extends BaseAgent {
  constructor(capabilities: AgentCapabilities) {
    const config: AgentConfig = {
      name: 'my_new_agent',
      description: 'What this agent does',
      contentTypes: ['examples', 'solutions'], // What to search for
      topK: 5,                                  // How many results
      sectionLevel: 3,                          // Max section depth
      temperature: 0.7,                         // LLM creativity
      maxTokens: 800                            // Max response length
    };

    super(capabilities, config);
  }

  async execute(request: AgentRequest): Promise<AgentResponse> {
    // 1. Search for content
    const results = await this.capabilities.search.search(this.config, {
      query: request.query,
      subject: request.subject,
      classLevel: request.classLevel,
      board: request.board
    });

    // 2. Build prompt
    const context = this.buildContext(results);
    const prompt = `You are helping with ${request.query}\n\nContext:\n${context}`;

    // 3. Generate response
    const content = await this.capabilities.generation.generate(this.config, prompt);

    // 4. Verify content
    const verification = await this.capabilities.verification.verify(
      this.config,
      content,
      results.map(r => r.text)
    );

    // 5. Return response
    return {
      content,
      metadata: {
        agentName: this.config.name,
        route: 'my_new_agent',
        sources: this.extractSources(results),
        fidelity: verification.score,
        latency: 0,
        cached: false
      }
    };
  }

  async executeStreaming(request: AgentRequest): Promise<StreamingAgentResponse> {
    // Similar to execute() but returns stream
    const results = await this.capabilities.search.search(this.config, {
      query: request.query,
      subject: request.subject,
      classLevel: request.classLevel,
      board: request.board
    });

    const context = this.buildContext(results);
    const prompt = `You are helping with ${request.query}\n\nContext:\n${context}`;

    const stream = this.capabilities.generation.generateStreaming(this.config, prompt);

    return {
      stream,
      metadata: {
        agentName: this.config.name,
        route: 'my_new_agent',
        sources: this.extractSources(results)
      }
    };
  }
}
```

### Step 2: Register Agent

**File:** `src/lib/bootstrap/app-initializer.ts`

```typescript
// Add import
import { MyNewAgent } from '@/lib/agents/my-new-agent.agent';

// In registerAgents() function, add:
orchestrator.registerAgent('my_new_intent', new MyNewAgent(capabilities));
```

### Step 3: Test

```bash
# Start dev server
npm run dev

# Test endpoint
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Test question",
    "subject": "Mathematics",
    "classLevel": "Class 9",
    "userId": "test_user",
    "menuIntent": "my_new_intent"
  }'
```

---

## How to Add a New Service

### Step 1: Define Interface

**File:** `src/lib/services/interfaces/index.ts`

```typescript
export interface IMyNewService {
  doSomething(input: string): Promise<string>;
  getSomething(id: string): Promise<any>;
}
```

### Step 2: Implement Service

**File:** `src/lib/services/implementations/my-new.service.ts`

```typescript
import type { IMyNewService } from '../interfaces';

export class MyNewService implements IMyNewService {
  constructor(private config: any) {
    console.log('✅ MyNewService initialized');
  }

  async doSomething(input: string): Promise<string> {
    // Implementation
    return `Processed: ${input}`;
  }

  async getSomething(id: string): Promise<any> {
    // Implementation
    return { id, data: 'something' };
  }
}
```

### Step 3: Register Service

**File:** `src/lib/di/service-registry.ts`

```typescript
// Add to SERVICE_NAMES
export const SERVICE_NAMES = {
  // ... existing
  MY_NEW_SERVICE: 'myNewService'
} as const;

// In registerServices() function, add:
container.register(
  SERVICE_NAMES.MY_NEW_SERVICE,
  async () => {
    const { MyNewService } = await import('@/lib/services/implementations/my-new.service');
    return new MyNewService({ /* config */ });
  },
  ServiceLifecycle.SINGLETON,
  [] // dependencies
);
```

### Step 4: Use Service

```typescript
// In any agent or service
const container = getContainer();
const myService = await container.resolve<IMyNewService>(SERVICE_NAMES.MY_NEW_SERVICE);
const result = await myService.doSomething('test');
```

---

## Common Tasks

### Task 1: Change Agent Configuration

**File:** `src/lib/config/app-config.ts`

```typescript
export const APP_CONFIG = {
  agents: {
    homework_help: {
      contentTypes: ['examples', 'solutions'], // Change this
      topK: 10,                                 // Or this
      temperature: 0.8                          // Or this
    }
  }
};
```

### Task 2: Add Caching to a Function

```typescript
async function myExpensiveFunction(input: string): Promise<string> {
  const cacheKey = `my_function:${input}`;
  
  // Check cache
  const cached = await cacheService.get<string>(cacheKey);
  if (cached) return cached;
  
  // Compute result
  const result = await doExpensiveWork(input);
  
  // Cache result
  await cacheService.set(cacheKey, result, { ttl: 3600 });
  
  return result;
}
```

### Task 3: Track Analytics Event

```typescript
await analyticsService.trackEvent({
  eventType: 'custom_event',
  userId: request.userId,
  metadata: {
    action: 'something_happened',
    value: 123
  },
  timestamp: new Date()
});
```

---

## Debugging Tips

### Check Service Health

```bash
# GET /api/ai/chat returns health status
curl http://localhost:3000/api/ai/chat
```

### View Container Status

```typescript
const container = getContainer();
const health = container.getHealthStatus();
console.log(health);
```

### Check Cache Stats

```typescript
const cacheService = await container.resolve<ICacheService>(SERVICE_NAMES.CACHE);
const stats = await cacheService.getStats();
console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
```

---

## Best Practices

1. **Always use interfaces** - Don't depend on concrete implementations
2. **Use DI container** - Don't create services with `new`
3. **Cache expensive operations** - Search, LLM calls, database queries
4. **Track analytics** - Every important action
5. **Handle errors gracefully** - Use try/catch and fallbacks
6. **Test with mocks** - Inject mock services for testing

---

## Need Help?

- **Architecture:** See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Migration:** See [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)
- **Decisions:** See [ARCHITECTURE_DECISION_RECORD.md](./ARCHITECTURE_DECISION_RECORD.md)
- **Implementation:** See [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)

