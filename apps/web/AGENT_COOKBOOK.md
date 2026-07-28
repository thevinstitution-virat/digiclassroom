# DigiClassroom AI Agent Cookbook

This guide explains how to add new intelligent agents to the platform.

## Agent Architecture Paradigm

DigiClassroom currently supports two types of agents:
1. **Legacy Prompt-Chaining Agents** (Being phased out)
2. **LangGraph Agents** (Recommended)

## Creating a New LangGraph Agent

### 1. Define the Agent State
Create your interface extending the base agent state.
```typescript
import { BaseMessage } from "@langchain/core/messages";

export interface MyTutorState {
  messages: BaseMessage[];
  studentGrade: number;
  extractedConcepts: string[];
}
```

### 2. Implement the Node Functions
Break your agent's task into pure functions (nodes) that take the state and return partial updates.

```typescript
async function fetchContextNode(state: MyTutorState) {
  // Use RetrievalService here
  return { extractedConcepts: ["Gravity", "Inertia"] }; 
}

async function generationNode(state: MyTutorState) {
    const llm = LLMFactory.getProvider('openai').getModel();
    // call llm
    return { messages: [responseMessage] };
}
```

### 3. Build the Graph
```typescript
import { StateGraph, END } from "@langchain/langgraph";

const workflow = new StateGraph<MyTutorState>({
  channels: {
    messages: {
        value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
        default: () => [],
    },
    studentGrade: null,
    extractedConcepts: null
  }
});

workflow.addNode("fetchContext", fetchContextNode);
workflow.addNode("generate", generationNode);

workflow.addEdge("fetchContext", "generate");
workflow.addEdge("generate", END);
workflow.setEntryPoint("fetchContext");

export const myTutorAgent = workflow.compile();
```

### 4. Register in Agent Manager
Navigate to `src/lib/agents/agent_manager.ts`.
1. Instantiate your agent or the graph wrapper.
2. Inside `executeAgent()`, add a new `switch` case for your agent's route.
3. Ensure you map the request accurately to your initial state.
4. Catch any `AppError` and map them consistently, returning the typed `AgentResult`.

## Best Practices
- **Use `LLMFactory`**: Never hardcode `new ChatOpenAI()`. Always use `LLMFactory.getProvider('default')` to respect system-level routing and analytics logging.
- **Throw `AgentError`**: If something fails during agent execution, throw an `AgentError([reason])`. The AgentManager will catch this.
- **Always Trace**: Ensure `Langfuse` callbacks are attached to the executor so that we can monitor token usage and trace evaluation in production.
