# Claude CLI Adapter - API Reference

Complete API documentation for the Claude Code CLI Adapter, including all public classes, interfaces, methods, and configuration options.

## Table of Contents

- [Overview](#overview)
- [Main Classes](#main-classes)
  - [ClaudeCodeCLIAdapter](#claudecodecliadapter)
  - [HandleStepsExecutor](#handlestepsexecutor)
- [Factory Functions](#factory-functions)
- [Configuration](#configuration)
- [Type Definitions](#type-definitions)
- [Error Classes](#error-classes)
- [Tool Implementations](#tool-implementations)
- [Usage Examples](#usage-examples)

## Overview

The Claude CLI Adapter provides a bridge between Codebuff's agent definition system and Claude Code CLI tools. The API is organized into several main components:

- **ClaudeCodeCLIAdapter**: Main orchestration class for agent execution
- **HandleStepsExecutor**: Generator-based execution engine
- **Tool Classes**: File operations, code search, terminal, and agent spawning
- **Factory Functions**: Convenient creation helpers
- **Type Definitions**: TypeScript interfaces and types

## Main Classes

### ClaudeCodeCLIAdapter

The main adapter class that orchestrates agent execution with Claude Code CLI.

#### Constructor

```typescript
constructor(config: AdapterConfig)
```

Creates a new adapter instance.

**Parameters:**
- `config: AdapterConfig` - Adapter configuration (see [Configuration](#configuration))

**Example:**
```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: '/path/to/project',
  maxSteps: 20,
  debug: true
})
```

#### Agent Registration Methods

##### `registerAgent(agentDef: AgentDefinition): void`

Register a single agent definition.

**Parameters:**
- `agentDef: AgentDefinition` - Agent definition to register

**Example:**
```typescript
adapter.registerAgent(filePickerAgent)
```

##### `registerAgents(agents: AgentDefinition[]): void`

Register multiple agents at once.

**Parameters:**
- `agents: AgentDefinition[]` - Array of agent definitions

**Example:**
```typescript
adapter.registerAgents([filePickerAgent, codeReviewerAgent, thinkerAgent])
```

##### `getAgent(agentId: string): AgentDefinition | undefined`

Retrieve a registered agent by ID.

**Parameters:**
- `agentId: string` - Agent identifier

**Returns:**
- `AgentDefinition | undefined` - Agent definition or undefined if not found

**Example:**
```typescript
const agent = adapter.getAgent('file-picker')
if (agent) {
  console.log('Agent found:', agent.displayName)
}
```

##### `listAgents(): string[]`

List all registered agent IDs.

**Returns:**
- `string[]` - Array of registered agent IDs

**Example:**
```typescript
const agentIds = adapter.listAgents()
console.log('Available agents:', agentIds)
```

#### Agent Execution Methods

##### `executeAgent(agentDef, prompt?, params?, parentContext?): Promise<AgentExecutionResult>`

Execute an agent with the given prompt and parameters.

**Parameters:**
- `agentDef: AgentDefinition` - Agent definition to execute
- `prompt?: string` - User prompt for the agent (optional for some agents)
- `params?: Record<string, any>` - Optional parameters for the agent
- `parentContext?: AgentExecutionContext` - Optional parent execution context for nested agents

**Returns:**
- `Promise<AgentExecutionResult>` - Execution result with output and metadata

**Throws:**
- `MaxIterationsError` - If execution exceeds maxSteps
- `Error` - If agent execution fails

**Example:**
```typescript
const result = await adapter.executeAgent(
  filePickerAgent,
  'Find all TypeScript test files',
  { pattern: '*.test.ts' }
)

console.log('Output:', result.output)
console.log('Execution time:', result.metadata?.executionTime)
```

#### Utility Methods

##### `getCwd(): string`

Get the current working directory.

**Returns:**
- `string` - Current working directory path

**Example:**
```typescript
const cwd = adapter.getCwd()
console.log('Working directory:', cwd)
```

##### `getConfig(): Readonly<Required<AdapterConfig>>`

Get the adapter configuration.

**Returns:**
- `Readonly<Required<AdapterConfig>>` - Adapter configuration (read-only)

**Example:**
```typescript
const config = adapter.getConfig()
console.log('Max steps:', config.maxSteps)
console.log('Debug mode:', config.debug)
```

##### `getActiveContexts(): Map<string, AgentExecutionContext>`

Get all active execution contexts (for debugging).

**Returns:**
- `Map<string, AgentExecutionContext>` - Map of active contexts by agent ID

**Example:**
```typescript
const contexts = adapter.getActiveContexts()
console.log('Active agents:', contexts.size)
```

---

### HandleStepsExecutor

Generator-based execution engine for handleSteps functions.

#### Constructor

```typescript
constructor(config?: HandleStepsExecutorConfig)
```

Creates a new executor instance.

**Parameters:**
- `config?: HandleStepsExecutorConfig` - Optional configuration (see below)

**Example:**
```typescript
const executor = new HandleStepsExecutor({
  maxIterations: 100,
  debug: true,
  logger: (msg, data) => console.log(msg, data)
})
```

#### Execution Methods

##### `execute(agentDef, context, toolExecutor, llmExecutor, textOutputHandler?): Promise<ExecutionResult>`

Execute the handleSteps generator to completion.

**Parameters:**
- `agentDef: AgentDefinition` - Agent definition with handleSteps function
- `context: AgentStepContext` - Initial execution context
- `toolExecutor: ToolExecutor` - Function to execute tool calls
- `llmExecutor: LLMExecutor` - Function to execute LLM steps
- `textOutputHandler?: TextOutputHandler` - Optional handler for text output

**Returns:**
- `Promise<ExecutionResult>` - Execution result with final state and metadata

**Throws:**
- `Error` - If agentDef has no handleSteps function
- `MaxIterationsError` - If execution exceeds maxIterations
- `UnknownYieldValueError` - If unrecognized yield value encountered

**Example:**
```typescript
const result = await executor.execute(
  agentDef,
  context,
  async (toolCall) => { /* execute tool */ },
  async (mode) => { /* execute LLM */ },
  (text) => console.log('Output:', text)
)

console.log('Completed:', result.completedNormally)
console.log('Iterations:', result.iterationCount)
```

---

## Factory Functions

### `createAdapter(cwd, options?): ClaudeCodeCLIAdapter`

Create a new ClaudeCodeCLIAdapter with default configuration.

**Parameters:**
- `cwd: string` - Working directory
- `options?: Partial<Omit<AdapterConfig, 'cwd'>>` - Optional configuration overrides

**Returns:**
- `ClaudeCodeCLIAdapter` - Configured adapter instance

**Example:**
```typescript
const adapter = createAdapter('/path/to/project', {
  debug: true,
  maxSteps: 30
})
```

### `createDebugAdapter(cwd, options?): ClaudeCodeCLIAdapter`

Create a ClaudeCodeCLIAdapter with debug logging enabled.

**Parameters:**
- `cwd: string` - Working directory
- `options?: Partial<Omit<AdapterConfig, 'cwd' | 'debug'>>` - Optional configuration overrides

**Returns:**
- `ClaudeCodeCLIAdapter` - Configured adapter instance with debug logging

**Example:**
```typescript
const adapter = createDebugAdapter('/path/to/project')
// Debug logging is automatically enabled
```

### `createProductionExecutor(options?): HandleStepsExecutor`

Create a HandleStepsExecutor with production settings.

**Parameters:**
- `options?: Partial<HandleStepsExecutorConfig>` - Optional configuration overrides

**Returns:**
- `HandleStepsExecutor` - Configured executor instance

**Example:**
```typescript
const executor = createProductionExecutor({
  maxIterations: 50
})
```

### `createDebugExecutor(options?): HandleStepsExecutor`

Create a HandleStepsExecutor with debug logging enabled.

**Parameters:**
- `options?: Partial<HandleStepsExecutorConfig>` - Optional configuration overrides

**Returns:**
- `HandleStepsExecutor` - Configured executor instance with debug logging

**Example:**
```typescript
const executor = createDebugExecutor({
  logger: customLogger
})
```

---

## Configuration

### AdapterConfig

Configuration interface for ClaudeCodeCLIAdapter.

```typescript
interface AdapterConfig {
  /** Working directory for all operations */
  cwd: string

  /** Environment variables to pass to tools */
  env?: Record<string, string>

  /** Maximum number of steps to prevent infinite loops (default: 20) */
  maxSteps?: number

  /** Enable debug logging (default: false) */
  debug?: boolean

  /** Custom logger function (default: console.log) */
  logger?: (message: string) => void
}
```

**Properties:**

- **cwd** (required): Working directory for all file operations and command execution
- **env** (optional): Environment variables merged with process.env for terminal commands
- **maxSteps** (optional): Maximum execution steps before throwing MaxIterationsError
- **debug** (optional): Enable detailed debug logging for troubleshooting
- **logger** (optional): Custom logger function for debug output

**Example:**
```typescript
const config: AdapterConfig = {
  cwd: '/path/to/project',
  env: {
    NODE_ENV: 'development',
    DEBUG: '*'
  },
  maxSteps: 30,
  debug: true,
  logger: (msg) => myLogger.info(msg)
}

const adapter = new ClaudeCodeCLIAdapter(config)
```

### HandleStepsExecutorConfig

Configuration interface for HandleStepsExecutor.

```typescript
interface HandleStepsExecutorConfig {
  /** Maximum iterations before throwing error (default: 100) */
  maxIterations?: number

  /** Enable debug logging (default: false) */
  debug?: boolean

  /** Custom logger function */
  logger?: (message: string, data?: any) => void
}
```

**Properties:**

- **maxIterations** (optional): Maximum iterations before throwing MaxIterationsError
- **debug** (optional): Enable detailed debug logging
- **logger** (optional): Custom logger function for debug output

**Example:**
```typescript
const config: HandleStepsExecutorConfig = {
  maxIterations: 200,
  debug: process.env.NODE_ENV !== 'production',
  logger: (msg, data) => console.log(`[Executor] ${msg}`, data)
}

const executor = new HandleStepsExecutor(config)
```

---

## Type Definitions

### AgentExecutionResult

Result from executing an agent.

```typescript
interface AgentExecutionResult {
  /** The output value from the agent */
  output: any

  /** Complete message history from the agent execution */
  messageHistory: Message[]

  /** Final agent state */
  agentState?: AgentState

  /** Execution metadata */
  metadata?: {
    iterationCount?: number
    completedNormally?: boolean
    executionTime?: number
  }
}
```

### AgentExecutionContext

Agent execution context tracking state across nested agents.

```typescript
interface AgentExecutionContext {
  /** Unique agent execution ID */
  agentId: string

  /** Parent agent ID (for nested execution) */
  parentId?: string

  /** Message history */
  messageHistory: Message[]

  /** Steps remaining before max limit */
  stepsRemaining: number

  /** Agent output value */
  output?: Record<string, any>
}
```

### ExecutionResult

Result from HandleStepsExecutor execution.

```typescript
interface ExecutionResult {
  /** Final agent state after execution */
  agentState: AgentState

  /** Total number of iterations executed */
  iterationCount: number

  /** Whether execution completed normally (true) or hit max iterations (false) */
  completedNormally: boolean

  /** Any error that occurred during execution */
  error?: Error
}
```

### ToolExecutor

Function signature for tool execution.

```typescript
type ToolExecutor = (toolCall: ToolCall) => Promise<ToolResultOutput[]>
```

### LLMExecutor

Function signature for LLM step execution.

```typescript
type LLMExecutor = (mode: 'STEP' | 'STEP_ALL') => Promise<{
  endTurn: boolean
  agentState: AgentState
}>
```

### TextOutputHandler

Function signature for text output handling.

```typescript
type TextOutputHandler = (text: string) => void
```

### ToolResult

Tool result format matching Codebuff's specification.

```typescript
interface ToolResult {
  type: 'text' | 'json' | 'error'
  value?: any
  text?: string
}
```

---

## Error Classes

### MaxIterationsError

Thrown when execution exceeds maximum iterations.

```typescript
class MaxIterationsError extends Error {
  constructor(maxIterations: number)
}
```

**Description:**
Indicates a possible infinite loop in the handleSteps generator. Increase `maxIterations` in HandleStepsExecutorConfig or check generator logic.

**Example:**
```typescript
try {
  await executor.execute(agentDef, context, toolExecutor, llmExecutor)
} catch (error) {
  if (error instanceof MaxIterationsError) {
    console.error('Generator exceeded max iterations - possible infinite loop')
    // Increase maxIterations or fix generator logic
  }
}
```

### UnknownYieldValueError

Thrown when an unrecognized yield value is encountered.

```typescript
class UnknownYieldValueError extends Error {
  constructor(value: unknown)
}
```

**Description:**
Indicates an invalid yield value in the handleSteps generator. Valid yields are:
- ToolCall objects: `{ toolName: string, input: any }`
- Step strings: `'STEP'` or `'STEP_ALL'`
- StepText objects: `{ type: 'STEP_TEXT', text: string }`

**Example:**
```typescript
try {
  await executor.execute(agentDef, context, toolExecutor, llmExecutor)
} catch (error) {
  if (error instanceof UnknownYieldValueError) {
    console.error('Invalid yield value in handleSteps:', error.message)
    // Fix the generator to yield valid values only
  }
}
```

---

## Tool Implementations

The adapter includes built-in tool implementations. For detailed tool documentation, see [TOOL_REFERENCE.md](./TOOL_REFERENCE.md).

### Tool Classes

- **FileOperationsTools**: File reading, writing, and editing
- **CodeSearchTools**: Code searching and file finding
- **TerminalTools**: Shell command execution
- **SpawnAgentsAdapter**: Sub-agent spawning and management

### Tool Mapping

| Codebuff Tool | Claude CLI Tool | Implementation Class |
|--------------|-----------------|---------------------|
| read_files | Read | FileOperationsTools |
| write_file | Write | FileOperationsTools |
| str_replace | Edit | FileOperationsTools |
| code_search | Grep | CodeSearchTools |
| find_files | Glob | CodeSearchTools |
| run_terminal_command | Bash | TerminalTools |
| spawn_agents | Task | SpawnAgentsAdapter |
| set_output | (internal) | Built-in |

---

## Usage Examples

### Example 1: Basic Adapter Setup

```typescript
import { createAdapter } from '@codebuff/adapter'

// Create adapter
const adapter = createAdapter('/path/to/project', {
  maxSteps: 20,
  debug: true
})

// Register agents
adapter.registerAgent(filePickerAgent)
adapter.registerAgent(codeReviewerAgent)

// Execute agent
const result = await adapter.executeAgent(
  filePickerAgent,
  'Find all TypeScript files',
  { pattern: '*.ts' }
)

console.log('Found files:', result.output)
```

### Example 2: HandleSteps Generator

```typescript
const filePickerAgent: AgentDefinition = {
  id: 'file-picker',
  displayName: 'File Picker',
  toolNames: ['find_files', 'set_output'],

  handleSteps: function* ({ params }) {
    // Find files
    const { toolResult } = yield {
      toolName: 'find_files',
      input: { pattern: params.pattern }
    }

    // Set output
    yield {
      toolName: 'set_output',
      input: { output: toolResult[0].value }
    }
  }
}

const result = await adapter.executeAgent(
  filePickerAgent,
  'Find test files',
  { pattern: '*.test.ts' }
)
```

### Example 3: Sub-Agent Spawning

```typescript
const orchestratorAgent: AgentDefinition = {
  id: 'orchestrator',
  displayName: 'Orchestrator',
  toolNames: ['spawn_agents', 'set_output'],

  handleSteps: function* () {
    // Spawn multiple agents
    const { toolResult } = yield {
      toolName: 'spawn_agents',
      input: {
        agents: [
          {
            agent_type: 'file-picker',
            prompt: 'Find TypeScript files',
            params: { pattern: '*.ts' }
          },
          {
            agent_type: 'code-reviewer',
            prompt: 'Review the code for issues'
          }
        ]
      }
    }

    // Aggregate results
    yield {
      toolName: 'set_output',
      input: { output: toolResult[0].value }
    }
  }
}

const result = await adapter.executeAgent(orchestratorAgent)
```

### Example 4: Error Handling

```typescript
import { MaxIterationsError } from '@codebuff/adapter'

try {
  const result = await adapter.executeAgent(
    myAgent,
    'Perform complex task'
  )

  if (result.metadata?.completedNormally) {
    console.log('Success:', result.output)
  } else {
    console.warn('Completed with issues')
  }
} catch (error) {
  if (error instanceof MaxIterationsError) {
    console.error('Agent exceeded max iterations')
    // Increase maxSteps in adapter config
  } else {
    console.error('Agent execution failed:', error.message)
  }
}
```

### Example 5: Custom Logger

```typescript
const adapter = createAdapter('/path/to/project', {
  debug: true,
  logger: (message) => {
    // Custom logging with timestamps and formatting
    const timestamp = new Date().toISOString()
    const formatted = `[${timestamp}] ${message}`

    // Log to file or external service
    myLoggingService.info(formatted)
  }
})
```

### Example 6: Environment Variables

```typescript
const adapter = createAdapter('/path/to/project', {
  env: {
    NODE_ENV: 'production',
    API_KEY: process.env.API_KEY,
    DEBUG: 'myapp:*'
  }
})

// Terminal commands will have access to these env vars
const result = await adapter.executeAgent(terminalAgent, 'Run tests')
```

### Example 7: Programmatic Tool Execution

```typescript
import { FileOperationsTools } from '@codebuff/adapter'

// Direct tool usage (without adapter)
const fileOps = new FileOperationsTools('/path/to/project')

// Read files
const readResult = await fileOps.readFiles({
  paths: ['package.json', 'tsconfig.json']
})

// Write file
const writeResult = await fileOps.writeFile({
  path: 'output.txt',
  content: 'Hello, world!'
})

// Replace string
const replaceResult = await fileOps.strReplace({
  path: 'config.ts',
  old_string: 'const PORT = 3000',
  new_string: 'const PORT = 8080'
})
```

---

## See Also

- [TOOL_REFERENCE.md](./TOOL_REFERENCE.md) - Complete tool documentation
- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - Claude CLI integration guide
- [README.md](./README.md) - Getting started and overview
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical architecture details
