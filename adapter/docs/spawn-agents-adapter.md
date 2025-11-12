# Spawn Agents Adapter Documentation

## Overview

The `SpawnAgentsAdapter` is a tool adapter that enables agents to spawn and coordinate sub-agents. It bridges the gap between Codebuff's parallel agent execution model and Claude CLI's sequential Task tool constraint.

## Key Features

- **Sequential Execution**: Spawns agents one at a time (Claude CLI limitation)
- **Agent Registry**: Centralized lookup of available agent definitions
- **Parent-Child Context**: Passes execution context from parent to spawned agents
- **Error Handling**: Gracefully handles missing agents and execution failures
- **Result Aggregation**: Collects and formats results matching Codebuff's expectations
- **Experimental Parallel Mode**: Optional parallel execution if Claude CLI supports it

## Architecture

```
┌─────────────────────────────────────────┐
│         Parent Agent                    │
│  (uses spawn_agents tool)               │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│     SpawnAgentsAdapter                  │
│  - Resolves agent IDs                   │
│  - Executes agents sequentially         │
│  - Aggregates results                   │
└─────────────┬───────────────────────────┘
              │
      ┌───────┴───────┬───────────────┐
      ▼               ▼               ▼
┌──────────┐    ┌──────────┐    ┌──────────┐
│ Agent 1  │    │ Agent 2  │    │ Agent 3  │
│ (file-   │    │ (code-   │    │ (thinker)│
│  picker) │    │ reviewer)│    │          │
└──────────┘    └──────────┘    └──────────┘
```

## Installation

The adapter is part of the `@codebuff/adapter` package:

```typescript
import {
  SpawnAgentsAdapter,
  createSpawnAgentsAdapter,
  type AgentRegistry,
  type AgentExecutor,
} from '@codebuff/adapter'
```

## Basic Usage

### 1. Create an Agent Registry

```typescript
import type { AgentDefinition } from '@codebuff/adapter'

const filePickerAgent: AgentDefinition = {
  id: 'file-picker',
  displayName: 'File Picker',
  model: 'openai/gpt-5-mini',
  toolNames: ['find_files', 'read_files'],
  // ... other configuration
}

const registry = new Map<string, AgentDefinition>([
  ['file-picker', filePickerAgent],
  ['code-reviewer', codeReviewerAgent],
  ['thinker', thinkerAgent]
])
```

### 2. Create an Agent Executor Function

```typescript
const agentExecutor: AgentExecutor = async (
  agentDef,
  prompt,
  params,
  parentContext
) => {
  // Your agent execution logic here
  // This should run the agent and return its output

  return {
    output: { /* agent's output */ },
    messageHistory: [ /* conversation history */ ]
  }
}
```

### 3. Initialize the Adapter

```typescript
const adapter = createSpawnAgentsAdapter(registry, agentExecutor)
```

### 4. Spawn Agents

```typescript
const parentContext = {
  agentId: 'parent-agent-123',
  messageHistory: [],
  output: {}
}

const result = await adapter.spawnAgents({
  agents: [
    {
      agent_type: 'file-picker',
      prompt: 'Find all TypeScript files',
      params: { pattern: '*.ts' }
    },
    {
      agent_type: 'code-reviewer',
      prompt: 'Review the code quality'
    }
  ]
}, parentContext)

console.log(result[0].value)
// [
//   {
//     agentType: 'file-picker',
//     agentName: 'File Picker',
//     value: { files: [...], summary: '...' }
//   },
//   {
//     agentType: 'code-reviewer',
//     agentName: 'Code Reviewer',
//     value: { issues: [...], suggestions: [...] }
//   }
// ]
```

## API Reference

### `SpawnAgentsAdapter`

Main class for spawning and coordinating sub-agents.

#### Constructor

```typescript
new SpawnAgentsAdapter(
  agentRegistry: AgentRegistry,
  agentExecutor: AgentExecutor
)
```

**Parameters:**
- `agentRegistry`: Map of agent IDs to their definitions
- `agentExecutor`: Function to execute an agent

#### Methods

##### `spawnAgents(input, parentContext)`

Spawns multiple agents sequentially and collects results.

```typescript
async spawnAgents(
  input: SpawnAgentsParams,
  parentContext: AgentExecutionContext
): Promise<ToolResultOutput[]>
```

**Parameters:**
- `input.agents`: Array of agents to spawn
  - `agent_type`: Agent ID or fully qualified reference
  - `prompt`: Optional prompt to send to agent
  - `params`: Optional parameters object
- `parentContext`: Parent agent's execution context

**Returns:**
Array containing a single ToolResultOutput with type 'json' and value containing array of results.

**Example:**
```typescript
const result = await adapter.spawnAgents({
  agents: [
    {
      agent_type: 'file-picker',
      prompt: 'Find test files',
      params: { pattern: '*.test.ts' }
    }
  ]
}, parentContext)
```

##### `spawnAgentsParallel(input, parentContext)` (Experimental)

Spawns agents in parallel using Promise.allSettled.

```typescript
async spawnAgentsParallel(
  input: SpawnAgentsParams,
  parentContext: AgentExecutionContext
): Promise<ToolResultOutput[]>
```

⚠️ **Warning:** This is experimental and may not work if Claude CLI doesn't support concurrent agent execution.

##### `getAgentInfo(agentId)`

Retrieves agent definition from registry.

```typescript
getAgentInfo(agentId: string): AgentDefinition | undefined
```

**Example:**
```typescript
const agentDef = adapter.getAgentInfo('file-picker')
if (agentDef) {
  console.log(agentDef.displayName, agentDef.toolNames)
}
```

##### `listRegisteredAgents()`

Lists all registered agent IDs.

```typescript
listRegisteredAgents(): string[]
```

**Example:**
```typescript
const agents = adapter.listRegisteredAgents()
// ['file-picker', 'code-reviewer', 'thinker']
```

##### `hasAgent(agentId)`

Checks if an agent is registered.

```typescript
hasAgent(agentId: string): boolean
```

**Example:**
```typescript
if (adapter.hasAgent('file-picker')) {
  // Agent exists
}
```

### Types

#### `SpawnAgentsParams`

Parameters for spawning agents.

```typescript
interface SpawnAgentsParams {
  agents: Array<{
    agent_type: string      // Agent ID
    prompt?: string         // Prompt to send
    params?: Record<string, any>  // Parameters
  }>
}
```

#### `SpawnedAgentResult`

Result from spawning a single agent.

```typescript
interface SpawnedAgentResult {
  agentType: string   // Agent ID that was spawned
  agentName: string   // Display name of the agent
  value: any          // Agent's output or error info
}
```

#### `AgentExecutor`

Function type for executing an agent.

```typescript
type AgentExecutor = (
  agentDef: AgentDefinition,
  prompt: string | undefined,
  params: Record<string, any> | undefined,
  parentContext: AgentExecutionContext
) => Promise<{
  output: any
  messageHistory: Array<{ role: 'user' | 'assistant'; content: string }>
}>
```

#### `AgentExecutionContext`

Context passed from parent to spawned agents.

```typescript
interface AgentExecutionContext {
  agentId: string
  messageHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  output?: Record<string, any>
  agentState?: AgentState
}
```

## Use Cases

### Use Case 1: Multi-Step Workflow

Orchestrate multiple agents to complete a complex task.

```typescript
const orchestrator: AgentDefinition = {
  id: 'orchestrator',
  toolNames: ['spawn_agents'],
  spawnableAgents: ['file-picker', 'code-reviewer', 'report-generator'],

  handleSteps: function* ({ agentState, prompt, params }) {
    // 1. Find files
    const { toolResult: files } = yield {
      toolName: 'spawn_agents',
      input: {
        agents: [
          { agent_type: 'file-picker', prompt: 'Find source files' }
        ]
      }
    }

    // 2. Review code
    yield {
      toolName: 'spawn_agents',
      input: {
        agents: [
          { agent_type: 'code-reviewer', prompt: 'Review the files' }
        ]
      }
    }

    // 3. Generate report
    yield {
      toolName: 'spawn_agents',
      input: {
        agents: [
          { agent_type: 'report-generator', prompt: 'Create report' }
        ]
      }
    }

    yield 'STEP_ALL'
  }
}
```

### Use Case 2: Parallel Analysis

Spawn multiple specialized agents to analyze different aspects.

```typescript
const result = await adapter.spawnAgents({
  agents: [
    { agent_type: 'security-analyzer', prompt: 'Check for vulnerabilities' },
    { agent_type: 'performance-analyzer', prompt: 'Check for performance issues' },
    { agent_type: 'style-checker', prompt: 'Check code style' }
  ]
}, parentContext)

// All agents execute sequentially, results are aggregated
```

### Use Case 3: Error Recovery

Handle failures gracefully and continue with other agents.

```typescript
const result = await adapter.spawnAgents({
  agents: [
    { agent_type: 'primary-agent', prompt: 'Main task' },
    { agent_type: 'non-existent-agent', prompt: 'This will fail' },
    { agent_type: 'backup-agent', prompt: 'Fallback task' }
  ]
}, parentContext)

// Check results
result[0].value.forEach(agentResult => {
  if (agentResult.value.errorMessage) {
    console.error(`Agent ${agentResult.agentType} failed:`, agentResult.value.errorMessage)
  } else {
    console.log(`Agent ${agentResult.agentType} succeeded:`, agentResult.value)
  }
})
```

## Differences from Codebuff

| Feature | Codebuff | Claude CLI Adapter |
|---------|----------|-------------------|
| **Execution Mode** | Parallel (Promise.allSettled) | Sequential (Task tool limitation) |
| **Performance** | Faster (agents run concurrently) | Slower (agents run one at a time) |
| **Predictability** | Less predictable order | Guaranteed sequential order |
| **Error Handling** | All failures collected at end | Failures don't stop execution |
| **Context Sharing** | Limited between parallel agents | Can pass results between agents |

## Best Practices

### 1. Agent Registry Organization

```typescript
// ✅ Good: Centralized registry
const registry = new Map([
  ['file-picker', filePickerAgent],
  ['code-reviewer', codeReviewerAgent],
  ['thinker', thinkerAgent]
])

// ❌ Bad: Creating new registries everywhere
function badExample() {
  const registry1 = new Map([['file-picker', filePickerAgent]])
  const registry2 = new Map([['code-reviewer', codeReviewerAgent]])
  // Scattered registries are hard to maintain
}
```

### 2. Error Handling

```typescript
// ✅ Good: Check for errors in results
const result = await adapter.spawnAgents(input, context)
result[0].value.forEach(agentResult => {
  if (agentResult.value.errorMessage) {
    // Handle error appropriately
    logger.error(`Agent failed: ${agentResult.value.errorMessage}`)
  } else {
    // Process successful result
    processResult(agentResult.value)
  }
})

// ❌ Bad: Assume all agents succeed
const result = await adapter.spawnAgents(input, context)
result[0].value.forEach(agentResult => {
  processResult(agentResult.value) // Will fail if there's an error
})
```

### 3. Agent Naming

```typescript
// ✅ Good: Use simple IDs in registry
const registry = new Map([
  ['file-picker', filePickerAgent]
])

// Also works with fully qualified references
await adapter.spawnAgents({
  agents: [
    { agent_type: 'file-picker' },  // Simple ID
    { agent_type: 'codebuff/file-picker@0.0.1' }  // Fully qualified
  ]
}, context)

// ❌ Bad: Inconsistent naming
const registry = new Map([
  ['codebuff/file-picker@0.0.1', filePickerAgent]  // Don't use full names as keys
])
```

### 4. Context Passing

```typescript
// ✅ Good: Provide meaningful parent context
const parentContext = {
  agentId: 'orchestrator-123',
  messageHistory: [
    { role: 'user', content: 'Analyze the codebase' }
  ],
  output: { filesAnalyzed: 42 },
  agentState: currentAgentState
}

// ❌ Bad: Minimal context
const parentContext = {
  agentId: 'parent'
}
```

## Troubleshooting

### Agent Not Found

**Problem:** Getting "Agent not found in registry" error.

**Solution:**
```typescript
// Check if agent is registered
if (!adapter.hasAgent('my-agent')) {
  console.error('Agent not registered!')
  console.log('Available agents:', adapter.listRegisteredAgents())
}

// Verify agent is in registry
const registry = new Map([
  ['my-agent', myAgentDefinition]  // Make sure ID matches
])
```

### Agent Execution Hangs

**Problem:** Agent execution never completes.

**Solution:**
- Ensure your `agentExecutor` function returns a Promise
- Add timeout handling in your executor
- Check that the agent's handleSteps generator completes properly

```typescript
const agentExecutor: AgentExecutor = async (agentDef, prompt, params, context) => {
  // Add timeout
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Agent timeout')), 30000)
  )

  const execution = executeAgent(agentDef, prompt, params, context)

  return Promise.race([execution, timeout])
}
```

### Type Errors

**Problem:** TypeScript errors when using the adapter.

**Solution:**
```typescript
// Import all necessary types
import type {
  AgentDefinition,
  AgentExecutor,
  AgentRegistry,
  SpawnAgentsParams,
  AgentExecutionContext
} from '@codebuff/adapter'

// Properly type your variables
const registry: AgentRegistry = new Map()
const executor: AgentExecutor = async (agentDef, prompt, params, context) => {
  // Implementation
}
```

## Performance Considerations

### Sequential vs Parallel

**Sequential (Default):**
- ✅ Guaranteed execution order
- ✅ Can pass results between agents
- ✅ More predictable resource usage
- ❌ Slower total execution time

**Parallel (Experimental):**
- ✅ Faster total execution time
- ✅ Better resource utilization
- ❌ Unpredictable execution order
- ❌ May not be supported by Claude CLI

### Optimization Tips

1. **Batch Similar Agents:** Group agents that do similar work
2. **Minimize Agent Count:** Only spawn necessary agents
3. **Use Caching:** Cache agent results when possible
4. **Optimize Prompts:** Shorter prompts = faster execution

## Related Documentation

- [File Operations Adapter](./file-operations-adapter.md)
- [Code Search Adapter](./code-search-adapter.md)
- [Handle Steps Executor](./handle-steps-executor.md)
- [Agent Definition Guide](../../.agents/README.md)
- [Claude CLI Adapter Guide](../../CLAUDE_CLI_ADAPTER_GUIDE.md)

## Contributing

To contribute improvements to the SpawnAgentsAdapter:

1. Add tests in `adapter/src/tools/spawn-agents.test.ts`
2. Update this documentation
3. Run type checking: `npm run type-check`
4. Submit a pull request

## License

Part of the Codebuff project. See main LICENSE file.
