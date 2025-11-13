# Agent System Architecture - Core Algorithms & Principles

## Table of Contents
1. [Agent Type System](#agent-type-system)
2. [Core Execution Algorithms](#core-execution-algorithms)
3. [Orchestration Patterns](#orchestration-patterns)
4. [Key Architectural Principles](#key-architectural-principles)
5. [Code Reference Map](#code-reference-map)

---

## Agent Type System

### 1. Agent Definition Schema

**Location**: `/.agents/types/agent-definition.ts`

```typescript
// Lines 21-208: Core AgentDefinition Interface
interface AgentDefinition<P = any, T = any> {
  // Identity
  id: string;                    // Unique agent identifier
  version?: string;              // Version string
  publisher?: string;            // Publisher name
  displayName?: string;          // Human-readable name

  // Model Configuration
  model?: 'max' | 'default' | 'fast' | 'haiku';
  reasoningOptions?: {
    mode?: 'extended' | 'standard' | 'disabled';
    budgetTokens?: number;
  };

  // Tool & Agent Configuration
  toolNames?: string[];          // Available tools
  spawnableAgents?: Array<{      // Agents this can spawn
    agentType: string;
    displayName?: string;
    description?: string;
  }>;

  // Input/Output Schema
  inputSchema?: ZodTypeAny;      // Validates params
  outputMode?: 'text' | 'structured';
  outputSchema?: ZodTypeAny;     // Validates output

  // Prompts (build agent behavior)
  spawnerPrompt?: string;        // Shown to parent spawner
  systemPrompt?: string;         // System-level instructions
  instructionsPrompt?: string;   // Detailed instructions
  stepPrompt?: string | ((context) => string);  // Per-step guidance

  // Programmatic Control
  handleSteps?: StepGenerator<P, T>;  // Generator function for control flow
}
```

**Key Principle**: Agents are configured via declarative prompts OR programmatic generators (`handleSteps`), enabling both LLM-driven and code-driven behavior.

---

### 2. Runtime Agent State

**Location**: `/common/src/types/session-state.ts:27-67`

```typescript
interface AgentState {
  // Identity
  agentId: string;
  agentType: string;
  runId: string;                 // Unique execution ID

  // Hierarchy
  parentId?: string;             // Parent agent's runId
  ancestorRunIds: string[];      // All ancestor runIds
  childRunIds: string[];         // Spawned child runIds

  // Execution State
  messageHistory: MessageHistory;
  agentContext?: Record<string, any>;
  output?: any;

  // Resource Tracking
  stepsRemaining: number;
  creditsUsed: number;           // Total credits (self + descendants)
  directCreditsUsed: number;     // Credits used by this agent only
}
```

**Key Principle**: Immutable state updates - each step creates a new state object. Hierarchical tracking via `parentId`/`ancestorRunIds` enables cost aggregation and context inheritance.

---

## Core Execution Algorithms

### 1. Main Agent Execution Loop

**Location**: `/packages/agent-runtime/src/run-agent-step.ts:438-827`

**Function**: `loopAgentSteps()`

#### Algorithm Flow

```
┌─────────────────────────────────────┐
│ 1. Initialize Agent Run             │
│    - startAgentRun()                │
│    - Build initial message history  │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│ 2. Main Loop (until shouldEndTurn)  │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ a. Check if input is live   │   │
│  │    (cancellation support)   │   │
│  └──────────┬──────────────────┘   │
│             ↓                       │
│  ┌─────────────────────────────┐   │
│  │ b. Run programmatic step    │   │
│  │    if handleSteps exists    │   │
│  │    (runProgrammaticStep)    │   │
│  └──────────┬──────────────────┘   │
│             ↓                       │
│  ┌─────────────────────────────┐   │
│  │ c. Run LLM agent step       │   │
│  │    (runAgentStep)           │   │
│  └──────────┬──────────────────┘   │
│             ↓                       │
│  ┌─────────────────────────────┐   │
│  │ d. Update state & check     │   │
│  │    completion               │   │
│  └──────────┬──────────────────┘   │
│             ↓                       │
│  ┌─────────────────────────────┐   │
│  │ e. Validate output schema   │   │
│  └─────────────────────────────┘   │
│                                     │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 3. Finish Agent Run                 │
│    - Return output                  │
└─────────────────────────────────────┘
```

#### Key Code Sections

```typescript
// Lines 438-827: Main loop
export async function loopAgentSteps(params: LoopAgentStepsParams) {
  // Line 470: Initialize run
  let state = await startAgentRun(params);

  // Lines 520-561: Build initial message history
  const initialMessages = [
    { role: 'user', content: params.prompt },
    { role: 'user', content: template.instructionsPrompt }
  ];

  // Lines 618-820: Main execution loop
  while (!shouldEndTurn) {
    // Lines 646-661: Check if input is still live
    if (!isAgentInputLive(state)) {
      break;
    }

    // Lines 667-691: Run programmatic step
    if (template.handleSteps) {
      const programmaticResult = await runProgrammaticStep({...});
      state = programmaticResult.state;
      shouldEndTurn = programmaticResult.shouldEndTurn;
    }

    // Lines 694-726: Validate output schema
    if (shouldEndTurn && template.outputSchema) {
      const validation = template.outputSchema.safeParse(state.output);
      if (!validation.success) {
        // Add error to message history and continue
        shouldEndTurn = false;
      }
    }

    // Lines 735-747: Run LLM step if not ended
    if (!shouldEndTurn) {
      const stepResult = await runAgentStep({...});
      state = stepResult.state;
      shouldEndTurn = stepResult.shouldEndTurn;
    }
  }

  // Line 821: Finalize and return
  return await finishAgentRun(state);
}
```

**Key Principles**:
- **Hybrid Control**: Alternates between programmatic (`handleSteps`) and LLM-driven steps
- **Cancellation Support**: Checks `isAgentInputLive()` to respect user cancellations
- **Schema Validation**: Enforces `outputSchema` by retrying with error messages
- **Immutable Updates**: Each step returns new state, never mutates

---

### 2. LLM Agent Step Execution

**Location**: `/packages/agent-runtime/src/run-agent-step.ts:55-436`

**Function**: `runAgentStep()`

#### Algorithm Flow

```typescript
// Lines 55-436
export async function runAgentStep(params: RunAgentStepParams) {
  const { state, template } = params;

  // Lines 154-183: Step limit enforcement
  const stepsRemaining = state.stepsRemaining - 1;
  if (stepsRemaining <= STEP_LIMIT_WARNING_THRESHOLD) {
    // Inject warning message into prompt
  }

  // Lines 209-235: Build step prompt
  const stepPromptContent = typeof template.stepPrompt === 'function'
    ? template.stepPrompt(context)
    : template.stepPrompt;

  // Lines 248-318: Stream LLM response
  const stream = streamChatCompletion({
    model: template.model,
    messages: state.messageHistory,
    tools: availableTools,
    reasoning: template.reasoningOptions
  });

  let toolCalls = [];
  for await (const chunk of stream) {
    // Process streaming chunks
    toolCalls.push(...extractToolCalls(chunk));
  }

  // Lines 320-361: Update message history
  const newMessage = {
    role: 'assistant',
    content: responseText,
    toolCalls: toolCalls
  };

  // Lines 364-403: Determine if turn should end
  const shouldEndTurn =
    hasTaskCompleted ||
    toolCalls.length === 0 ||
    stepsRemaining <= 0;

  return {
    state: { ...state, messageHistory: [...state.messageHistory, newMessage] },
    shouldEndTurn
  };
}
```

**Key Principles**:
- **Streaming First**: Uses streaming API for real-time tool execution
- **Step Limiting**: Enforces max steps with warnings at thresholds
- **Turn Ending Logic**: Ends on task completion, no tools, or step limit
- **Tool Extraction**: Parses tool calls from streaming chunks

---

### 3. Programmatic Step Execution

**Location**: `/packages/agent-runtime/src/run-programmatic-step.ts:40-441`

**Function**: `runProgrammaticStep()`

#### Algorithm: Generator-Based Control Flow

```typescript
// Lines 40-441
export async function runProgrammaticStep(params: RunProgrammaticStepParams) {
  const { state, template } = params;

  // Lines 120-157: Get or create generator
  let generator = generatorCache.get(state.runId);
  if (!generator && template.handleSteps) {
    generator = template.handleSteps({
      params: state.agentContext.params,
      state: state,
      logger: createStreamingLogger(state.runId)
    });
    generatorCache.set(state.runId, generator);
  }

  // Lines 159-167: STEP_ALL mode (continuous stepping)
  let stepAllMode = stepAllModeCache.get(state.runId) || false;

  // Lines 169-441: Generator loop
  while (generator) {
    const yieldResult = generator.next(previousToolResult);

    if (yieldResult.done) {
      // Generator finished
      shouldEndTurn = true;
      break;
    }

    const yielded = yieldResult.value;

    // Lines 213-234: Handle yield commands
    if (yielded === 'STEP') {
      // Let LLM take next step
      break;
    } else if (yielded === 'STEP_ALL') {
      // Enter continuous LLM stepping mode
      stepAllMode = true;
      stepAllModeCache.set(state.runId, true);
      break;
    } else if (typeof yielded === 'object' && yielded.toolName) {
      // Lines 282-349: Execute tool call synchronously
      const toolResult = await executeToolCall({
        toolName: yielded.toolName,
        input: yielded.input,
        state: currentState
      });

      // Update state and continue generator
      currentState = toolResult.state;
      previousToolResult = toolResult.output;
    }
  }

  return { state: currentState, shouldEndTurn };
}
```

#### Generator Yield Commands

| Yield Value | Effect |
|-------------|--------|
| `{ toolName: 'spawn_agents', input: {...} }` | Execute tool synchronously, result passed to next `generator.next(result)` |
| `'STEP'` | Exit generator, let LLM generate next message |
| `'STEP_ALL'` | Enter continuous LLM mode until turn ends |
| `'STEP_TEXT'` | Override next LLM response text |
| `return value` | End turn, set `state.output = value` |

**Key Principles**:
- **Stateful Generators**: Cached per `runId`, maintains state across steps
- **Synchronous Tool Execution**: Generator yields tool calls, waits for results
- **Hybrid Control**: Can switch between programmatic and LLM control
- **STEP_ALL Mode**: Enables "background" agents that let LLM run freely

---

### 4. Multi-Agent Spawning

**Location**: `/packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts:32-292`

**Function**: `handleSpawnAgents()`

#### Algorithm: Parallel Subagent Execution

```typescript
// Lines 32-292
export async function handleSpawnAgents(params: HandleSpawnAgentsParams) {
  const { state, toolInput } = params;
  const agentsToSpawn = toolInput.agents;

  // Lines 101-213: Execute all agents in parallel
  const results = await Promise.allSettled(
    agentsToSpawn.map(async (agentConfig) => {

      // Lines 105-130: Validate template and permissions
      const template = await validateAndGetAgentTemplate(agentConfig.agent_type);
      const spawnConfig = getMatchingSpawn(template, state);
      if (!spawnConfig) {
        throw new Error('Agent not in spawnableAgents list');
      }

      // Lines 132-143: Validate input
      if (template.inputSchema) {
        const validation = template.inputSchema.safeParse(agentConfig.params);
        if (!validation.success) {
          throw new Error('Invalid params');
        }
      }

      // Lines 145-177: Create child state
      const childState = createAgentState({
        agentType: agentConfig.agent_type,
        parentId: state.runId,
        ancestorRunIds: [...state.ancestorRunIds, state.runId],
        params: agentConfig.params,
        inheritMessageHistory: agentConfig.include_message_history
      });

      // Lines 179-208: Execute subagent
      const result = await executeSubagent({
        state: childState,
        template: template,
        onStream: (chunk) => {
          // Stream responses back to parent
          emitStreamEvent({
            type: 'spawn_agent_response',
            agentType: childState.agentType,
            runId: childState.runId,
            content: chunk
          });
        }
      });

      return result;
    })
  );

  // Lines 235-276: Aggregate costs
  let totalCredits = 0;
  for (const result of results) {
    if (result.status === 'fulfilled') {
      totalCredits += result.value.creditsUsed;
    }
  }

  // Update parent state with aggregated costs
  const updatedState = {
    ...state,
    creditsUsed: state.creditsUsed + totalCredits,
    childRunIds: [...state.childRunIds, ...newChildRunIds]
  };

  return { state: updatedState, outputs: agentOutputs };
}
```

**Key Principles**:
- **Parallel Execution**: `Promise.allSettled()` runs all subagents concurrently
- **Permission Validation**: Checks `spawnableAgents` list before spawning
- **Schema Validation**: Validates `params` against `inputSchema`
- **Cost Aggregation**: Bubbles up `creditsUsed` from children to parent
- **Response Streaming**: Streams nested agent output in real-time
- **Fault Tolerance**: `allSettled` continues even if some agents fail

---

## Orchestration Patterns

### Pattern 1: Iterative Planning + Parallel Execution

**Location**: `/.agents/orchestrator/iterative-orchestrator/iterative-orchestrator.ts:30-161`

#### Algorithm

```
Loop (max 15 iterations):
  ┌────────────────────────────────┐
  │ 1. PLAN PHASE                  │
  │    Spawn: iterative-orchestrator-step
  │    Input: Task + progress history
  │    Output: Next batch of steps │
  └────────────┬───────────────────┘
               │
               ↓
  ┌────────────────────────────────┐
  │ 2. EXECUTION PHASE             │
  │    Spawn: base2-with-files-input (parallel)
  │    For each step in batch      │
  │    Types: implementation, decision
  └────────────┬───────────────────┘
               │
               ↓
  ┌────────────────────────────────┐
  │ 3. RECORD PROGRESS             │
  │    Update progress history     │
  │    Check if task complete      │
  └────────────┬───────────────────┘
               │
               ↓
  ┌────────────────────────────────┐
  │ 4. CHECK COMPLETION            │
  │    If complete: break          │
  │    Else: continue loop         │
  └────────────────────────────────┘
```

#### Code

```typescript
// Lines 30-161
handleSteps: function* ({ params }) {
  const progressHistory = [];

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    // Lines 46-78: PLAN - Get next steps
    const planResult = yield {
      toolName: 'spawn_agents',
      input: {
        agents: [{
          agent_type: 'iterative-orchestrator-step',
          params: {
            task: params.task,
            progressHistory: progressHistory
          }
        }]
      }
    };

    const nextSteps = planResult[0].steps;

    // Lines 79-95: Check if complete
    if (nextSteps.length === 0 || planResult[0].taskComplete) {
      return {
        iterations: iteration,
        progress: progressHistory,
        result: planResult[0].result
      };
    }

    // Lines 102-117: EXECUTE - Run steps in parallel
    const execResult = yield {
      toolName: 'spawn_agents',
      input: {
        agents: nextSteps.map(step => ({
          agent_type: 'base2-with-files-input',
          params: {
            task: step.description,
            type: step.type  // 'implementation' or 'decision'
          }
        }))
      }
    };

    // Lines 120-140: RECORD progress
    progressHistory.push({
      iteration,
      steps: nextSteps,
      results: execResult
    });
  }

  return { error: 'Max iterations reached' };
}
```

**Key Principles**:
- **Separation of Concerns**: Planning agent ≠ execution agent
- **Incremental Progress**: Each iteration builds on previous results
- **Parallel Execution**: Independent steps run concurrently
- **Bounded Iteration**: Max 15 iterations prevents infinite loops

---

### Pattern 2: Best-of-N Selection

**Location**: `/.agents/thinker/thinker-best-of-n.ts:48-154`

#### Algorithm

```
┌─────────────────────────────────┐
│ 1. GENERATION PHASE             │
│    Spawn N thinkers in parallel │
│    (default N=5, max N=10)      │
│    Each generates independent   │
│    thinking output              │
└────────────┬────────────────────┘
             │
             ↓
┌─────────────────────────────────┐
│ 2. COLLECTION PHASE             │
│    Wait for all to complete     │
│    Aggregate all outputs        │
└────────────┬────────────────────┘
             │
             ↓
┌─────────────────────────────────┐
│ 3. SELECTION PHASE              │
│    Spawn selector agent         │
│    Input: All N outputs         │
│    Output: Best output + reason │
└────────────┬────────────────────┘
             │
             ↓
┌─────────────────────────────────┐
│ 4. RETURN SELECTED              │
│    Return chosen output         │
└─────────────────────────────────┘
```

#### Code

```typescript
// Lines 48-154
handleSteps: function* ({ params }) {
  const n = Math.min(params.n || 5, 10);

  // Lines 70-79: Spawn N thinkers in parallel
  const thinkerResults = yield {
    toolName: 'spawn_agents',
    input: {
      agents: Array(n).fill(null).map((_, i) => ({
        agent_type: 'thinker',
        params: { problem: params.problem }
      }))
    }
  };

  // Lines 91-102: Spawn selector
  const selectorResult = yield {
    toolName: 'spawn_agents',
    input: {
      agents: [{
        agent_type: 'thinker-selector',
        params: {
          problem: params.problem,
          options: thinkerResults.map((r, i) => ({
            id: i,
            thinking: r.output
          }))
        }
      }]
    }
  };

  // Lines 116-123: Return selected output
  const selectedId = selectorResult[0].selectedId;
  return {
    selectedThinking: thinkerResults[selectedId].output,
    reason: selectorResult[0].reason,
    allOptions: thinkerResults
  };
}
```

**Key Principles**:
- **Diversity**: Generate multiple independent solutions
- **Meta-Selection**: Use separate agent to choose best (avoids bias)
- **Bounded N**: Cap at 10 to control costs
- **Transparency**: Return all options + selection reason

---

### Pattern 3: Research → Implement Sequential

**Location**: `/.agents/orchestrator/research-implement-orchestrator/research-implement-orchestrator.ts:9-86`

#### Algorithm

```
┌─────────────────────────────────┐
│ 1. RESEARCH PHASE               │
│    Spawn: task-researcher       │
│    Gathers context, explores    │
│    codebase, finds relevant info│
└────────────┬────────────────────┘
             │
             ↓
┌─────────────────────────────────┐
│ 2. HANDOFF                      │
│    Pass research findings to    │
│    implementation agent         │
└────────────┬────────────────────┘
             │
             ↓
┌─────────────────────────────────┐
│ 3. IMPLEMENTATION PHASE         │
│    Spawn: base2-implementor     │
│    Uses research to make changes│
└────────────┬────────────────────┘
             │
             ↓
┌─────────────────────────────────┐
│ 4. FOLLOW-UP (if needed)        │
│    Either relay to implementor  │
│    or re-research if new info   │
│    needed                       │
└─────────────────────────────────┘
```

#### Code

```typescript
// Lines 9-86
handleSteps: function* ({ params }) {
  // Lines 37-38: Research phase
  const researchResult = yield {
    toolName: 'spawn_agents',
    input: {
      agents: [{
        agent_type: 'task-researcher',
        params: { task: params.task }
      }]
    }
  };

  // Lines 40-56: Implementation phase with research context
  const implementResult = yield {
    toolName: 'spawn_agents',
    input: {
      agents: [{
        agent_type: 'base2-implementor',
        params: {
          task: params.task,
          researchFindings: researchResult[0].findings
        }
      }]
    }
  };

  // Lines 66-77: Follow-up loop
  while (!implementResult.taskComplete) {
    // Decide: relay to implementor or re-research?
    const followUpResult = yield 'STEP';  // Let LLM decide

    if (followUpResult.needsMoreResearch) {
      // Re-run research phase
    } else {
      // Relay to implementor
    }
  }

  return implementResult;
}
```

**Key Principles**:
- **Phase Separation**: Research ≠ Implementation
- **Context Passing**: Research findings inform implementation
- **Adaptive Follow-up**: Can re-research or direct-implement based on needs
- **Sequential Dependency**: Implementation waits for research

---

## Key Architectural Principles

### 1. Generator-Based Control Flow

**Concept**: Agents use JavaScript generators (`function*`) for programmatic control.

**Yield Commands**:
```typescript
// Execute tool synchronously
yield { toolName: 'spawn_agents', input: {...} }

// Let LLM take control for one step
yield 'STEP'

// Let LLM run continuously until task ends
yield 'STEP_ALL'

// Override next LLM response
yield 'STEP_TEXT'

// End turn and return output
return { result: 'final output' }
```

**Example**: Auto-context-pruning pattern
```typescript
// /.agents/base2/base2.ts:183-200
handleSteps: function* ({ params }) {
  while (true) {
    // Always prune context before each LLM step
    yield {
      toolName: 'spawn_agent_inline',
      input: {
        agent_type: 'context-pruner',
        params
      }
    };

    // Let LLM generate next response
    const { stepsComplete } = yield 'STEP';

    if (stepsComplete) break;
  }
}
```

**Why Generators?**
- **Synchronous-looking async code**: `yield` waits for tool results
- **Stateful**: Generator instance preserves local variables across steps
- **Flexible control**: Can switch between programmatic and LLM control
- **Composable**: Can yield other generators

---

### 2. Hierarchical Agent Trees

**Concept**: Parent-child relationships with state propagation.

**Structure**:
```
Parent Agent (runId: A)
  ├─ Child 1 (runId: B, parentId: A)
  │   └─ Grandchild (runId: D, parentId: B, ancestorRunIds: [A, B])
  └─ Child 2 (runId: C, parentId: A)
```

**State Propagation**:
```typescript
// Child state creation
const childState = {
  runId: generateRunId(),
  parentId: parentState.runId,
  ancestorRunIds: [...parentState.ancestorRunIds, parentState.runId],

  // Inherit message history if requested
  messageHistory: includeMessageHistory
    ? parentState.messageHistory
    : [],

  // Fresh resource limits
  stepsRemaining: MAX_STEPS,
  creditsUsed: 0,
  directCreditsUsed: 0
};

// Cost aggregation (bubbles up)
parentState.creditsUsed += childState.creditsUsed;
parentState.childRunIds.push(childState.runId);
```

**Key Features**:
- **Cost Tracking**: Children's costs automatically added to parent
- **Context Inheritance**: Can include parent's message history
- **Cancellation Propagation**: Canceling parent cancels all descendants
- **Audit Trail**: `ancestorRunIds` enables full execution trace

---

### 3. Immutable State Management

**Concept**: State is never mutated, always cloned with changes.

**Pattern**:
```typescript
// ❌ WRONG: Mutation
state.messageHistory.push(newMessage);
state.stepsRemaining--;

// ✅ CORRECT: Immutable update
const newState = {
  ...state,
  messageHistory: [...state.messageHistory, newMessage],
  stepsRemaining: state.stepsRemaining - 1
};
```

**Benefits**:
- **Predictability**: Previous state unaffected by updates
- **Debugging**: Can inspect state at any point in execution
- **Concurrency**: Safe to read state while updates happen
- **Testing**: Easy to construct specific states

**Exception**: Generator cache is stateful (by design)
```typescript
// Lines 27-29 in run-programmatic-step.ts
const generatorCache = new Map<string, Generator>();

// Generators are stateful objects, cached per runId
generatorCache.set(state.runId, generator);
```

---

### 4. Parallel & Sequential Composition

**Parallel Execution** (independent tasks):
```typescript
// All agents run concurrently
const results = yield {
  toolName: 'spawn_agents',
  input: {
    agents: [
      { agent_type: 'file-picker', params: {...} },
      { agent_type: 'code-searcher', params: {...} },
      { agent_type: 'directory-lister', params: {...} }
    ]
  }
};
```

**Sequential Execution** (dependent tasks):
```typescript
// Research first
const research = yield {
  toolName: 'spawn_agents',
  input: { agents: [{ agent_type: 'researcher', ... }] }
};

// Then implement using research
const implementation = yield {
  toolName: 'spawn_agents',
  input: {
    agents: [{
      agent_type: 'implementor',
      params: { context: research[0].findings }
    }]
  }
};
```

**Mixed Pattern**:
```typescript
// Iterative orchestrator: Sequential planning, parallel execution
for (let i = 0; i < maxIterations; i++) {
  // Sequential: Plan next batch
  const plan = yield { ... };

  // Parallel: Execute all steps
  const results = yield {
    toolName: 'spawn_agents',
    input: { agents: plan.steps.map(step => ({...})) }
  };
}
```

---

### 5. Template Inheritance & Prompt Caching

**Concept**: Reuse parent's `systemPrompt` to enable prompt caching.

**Configuration**:
```typescript
// Child agent definition
{
  id: 'implementor',
  inheritParentSystemPrompt: true,  // Reuse parent's system prompt
  instructionsPrompt: 'Your specific implementation instructions...',
  // ...
}
```

**Why?**
- **Prompt Caching**: LLM providers cache identical prefixes (system prompts)
- **Cost Savings**: Cached prompts are cheaper and faster
- **Consistency**: Children inherit parent's behavioral context

**Used By**:
- `/.agents/base2/best-of-n/best-of-n-implementor.ts` - Inherits base2's system prompt
- `/.agents/thinker/thinker-selector.ts` - Inherits thinker's system prompt

---

## Code Reference Map

### Type Definitions
```
/.agents/types/agent-definition.ts
  Lines 21-208   : AgentDefinition interface
  Lines 214-224  : AgentState interface
  Lines 229-234  : AgentStepContext
  Lines 241-247  : ToolCall type

/common/src/types/agent-template.ts
  Lines 50-83    : AgentTemplate<P, T> (backend)
  Lines 87-106   : StepGenerator and StepHandler types

/common/src/types/dynamic-agent-template.ts
  Lines 112-167  : DynamicAgentDefinitionSchema (Zod)
  Lines 175-263  : DynamicAgentTemplateSchema

/common/src/types/session-state.ts
  Lines 27-67    : AgentState (runtime)
```

### Core Execution
```
/packages/agent-runtime/src/run-agent-step.ts
  Lines 438-827  : loopAgentSteps() - Main execution loop
  Lines 55-436   : runAgentStep() - LLM step execution
  Lines 154-183  : Step limit enforcement
  Lines 364-403  : Turn ending logic

/packages/agent-runtime/src/run-programmatic-step.ts
  Lines 40-441   : runProgrammaticStep() - Generator execution
  Lines 120-157  : Generator initialization
  Lines 213-234  : Yield command handling
  Lines 282-349  : Tool execution
  Lines 27-29    : Generator cache
```

### Multi-Agent Spawning
```
/packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts
  Lines 32-292   : handleSpawnAgents() - Parallel spawning
  Lines 101-213  : Parallel execution with Promise.allSettled
  Lines 235-276  : Cost aggregation

/packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts
  Lines 49-99    : validateSpawnState()
  Lines 104-160  : getMatchingSpawn() - Permission checking
  Lines 165-200  : validateAndGetAgentTemplate()
  Lines 237-267  : createAgentState()
  Lines 307-355  : executeSubagent()
```

### Agent Registry
```
/packages/agent-runtime/src/templates/agent-registry.ts
  Lines 18-73    : getAgentTemplate() - Resolution logic
  Lines 78-96    : assembleLocalAgentTemplates()
```

### Orchestration Patterns
```
/.agents/orchestrator/iterative-orchestrator/iterative-orchestrator.ts
  Lines 30-161   : Iterative planning + parallel execution

/.agents/orchestrator/research-implement-orchestrator/research-implement-orchestrator.ts
  Lines 9-86     : Research → Implement sequential pattern

/.agents/thinker/thinker-best-of-n.ts
  Lines 48-154   : Best-of-N selection pattern

/.agents/base2/best-of-n/best-of-n-implementor.ts
  Full file      : Single-shot implementation generator
```

### Example Agents
```
/.agents/base2/base2.ts
  Lines 9-201    : Main orchestrator configuration
  Lines 183-200  : Auto-context-pruning handleSteps

/.agents/thinker/thinker.ts
  Full file      : Extended thinking agent

/.agents/researcher/task-researcher.ts
  Full file      : Context gathering agent
```

---

## Summary

This agent system implements a **hierarchical, multi-agent orchestration framework** with:

1. **Hybrid Control**: Declarative prompts + programmatic generators
2. **Flexible Orchestration**: Sequential, parallel, and iterative patterns
3. **Type Safety**: Strong TypeScript types with Zod validation
4. **Resource Management**: Cost tracking, step limits, cancellation
5. **Production-Ready**: Database integration, streaming, error handling

The core innovation is the **generator-based control flow**, which enables agents to:
- Execute tools synchronously (via `yield`)
- Switch between programmatic and LLM control (via `'STEP'`)
- Maintain stateful execution across multiple steps
- Compose complex workflows with minimal code

This architecture supports diverse patterns from simple single-agent execution to complex multi-agent coordination like best-of-N selection and iterative refinement.
