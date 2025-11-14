# Architecture Guide

Comprehensive architecture documentation for the Claude CLI Adapter.

## Table of Contents

- [System Architecture](#system-architecture)
- [Design Decisions](#design-decisions)
- [Component Details](#component-details)
- [Data Flow](#data-flow)
- [Extension Points](#extension-points)
- [Internals](#internals)
- [Contributing](#contributing)

---

## System Architecture

### High-Level Overview

```
┌────────────────────────────────────────────────────────────────┐
│                    User Application Layer                       │
│                                                                  │
│  - Agent Definitions                                            │
│  - Business Logic                                               │
│  - Custom Workflows                                             │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                           │ AgentDefinition
                           │
┌──────────────────────────▼─────────────────────────────────────┐
│               ClaudeCodeCLIAdapter (Main Orchestrator)          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Agent Registration & Lifecycle Management         │  │
│  │  - registerAgent()                                        │  │
│  │  - executeAgent()                                         │  │
│  │  - Context Management                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│         ┌─────────────────┼─────────────────┐                  │
│         ▼                 ▼                 ▼                   │
│  ┌────────────┐    ┌────────────┐   ┌────────────┐           │
│  │ handleSteps│    │  Pure LLM  │   │   Tool     │           │
│  │  Executor  │    │    Mode    │   │ Dispatcher │           │
│  └────────────┘    └────────────┘   └────────────┘           │
│         │                 │                 │                   │
│         └─────────────────┴─────────────────┘                  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Tool Execution Layer                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│         │                                                       │
│    ┌────┴───┬────────┬───────────┬──────────┬──────────┐     │
│    ▼        ▼        ▼           ▼          ▼          ▼      │
│  ┌────┐  ┌────┐  ┌────────┐  ┌───────┐  ┌────────┐ ┌─────┐  │
│  │File│  │Code│  │Terminal│  │Spawn  │  │Set     │ │LLM  │  │
│  │Ops │  │Srch│  │        │  │Agents*│  │Output  │ │Exec │  │
│  └────┘  └────┘  └────────┘  └───────┘  └────────┘ └─────┘  │
│                                  *PAID mode only               │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                           │ System Calls
                           │
┌──────────────────────────▼─────────────────────────────────────┐
│                   Operating System Layer                        │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │File      │  │Process   │  │Network   │  │System    │      │
│  │System    │  │Management│  │(ripgrep) │  │Calls     │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
└────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. ClaudeCodeCLIAdapter (Main Orchestrator)

**Responsibilities:**
- Agent lifecycle management
- Execution mode determination
- Context management
- Tool dispatch coordination
- Error handling

**Key Methods:**
- `registerAgent()` - Register agents
- `executeAgent()` - Execute agent workflows
- `executeToolCall()` - Dispatch tool calls
- `invokeClaude()` - LLM integration (placeholder)

**State Management:**
- Agent registry (Map<string, AgentDefinition>)
- Active execution contexts (Map<string, AgentExecutionContext>)
- Tool instances (FileOperationsTools, CodeSearchTools, etc.)

#### 2. HandleStepsExecutor (Generator Engine)

**Responsibilities:**
- Execute handleSteps generators
- Manage iteration lifecycle
- Process yielded values (ToolCall, STEP, STEP_ALL, STEP_TEXT)
- Track execution metadata

**Key Features:**
- Max iteration protection
- Tool call processing
- LLM step execution
- State transitions

#### 3. Tool Implementations

**FileOperationsTools:**
- File reading with parallel support
- File writing with directory creation
- String replacement (first occurrence)
- Path validation and security

**CodeSearchTools:**
- Ripgrep integration for fast search
- Glob pattern matching
- Result limiting and filtering
- Security validation

**TerminalTools:**
- Shell command execution
- Timeout management
- Retry support
- Command injection prevention

**SpawnAgentsAdapter (PAID mode):**
- Sub-agent execution
- Result aggregation
- Error handling
- Sequential execution

---

## Design Decisions

### Why These Tools?

#### File Operations
**Decision:** Map to fs module with custom wrapper

**Rationale:**
- Direct file system access is fastest
- No need for CLI tools for basic operations
- Better error handling and validation
- Consistent cross-platform behavior

**Trade-offs:**
- ✅ Better performance
- ✅ More control
- ❌ More complex implementation

#### Code Search
**Decision:** Use ripgrep for search, glob for file finding

**Rationale:**
- Ripgrep is fastest search tool available
- Glob is standard, well-tested pattern matching
- Both are widely available
- Native performance

**Trade-offs:**
- ✅ Excellent performance
- ✅ Rich feature set
- ❌ External dependency (ripgrep)

#### Terminal Commands
**Decision:** Use child_process.spawn with security

**Rationale:**
- Maximum flexibility for users
- Supports any command-line tool
- Necessary for build tools, git, etc.

**Trade-offs:**
- ✅ Maximum flexibility
- ❌ Security concerns (mitigated)
- ❌ Platform-specific behavior

### Why This Architecture?

#### Layered Architecture
**Decision:** Clear separation of concerns with distinct layers

**Rationale:**
- **Presentation Layer:** User agents define workflow
- **Orchestration Layer:** Adapter manages execution
- **Tool Layer:** Individual tools implement functionality
- **System Layer:** OS provides primitives

**Benefits:**
- Easy to understand and maintain
- Clear boundaries and interfaces
- Testable in isolation
- Extensible without breaking changes

#### Generator-Based Execution
**Decision:** Use generators for handleSteps instead of async/await

**Rationale:**
- Allows yielding control back to framework
- Can intercept tool calls before execution
- Supports streaming output (STEP_TEXT)
- Compatible with Codebuff's design

**Benefits:**
- ✅ Fine-grained control
- ✅ Streaming support
- ✅ Codebuff compatibility
- ❌ Slightly more complex than async/await

#### Context Management
**Decision:** Maintain execution context per agent instance

**Rationale:**
- Tracks message history
- Manages remaining steps
- Enables nested agent calls
- Supports state management

**Benefits:**
- ✅ Complete state tracking
- ✅ Supports agent nesting
- ✅ Clean separation
- ✅ Easy debugging

### Trade-offs Made

#### 1. Sequential vs Parallel spawn_agents

**Current:** Sequential execution
**Alternative:** Parallel execution (like Codebuff)

**Decision Rationale:**
- Claude CLI's Task tool executes sequentially
- Simpler error handling
- Easier to reason about execution order
- More predictable resource usage

**Trade-offs:**
- ❌ Slower for parallel-compatible tasks
- ✅ Simpler implementation
- ✅ Better error tracking
- ✅ Predictable execution

#### 2. FREE vs PAID Mode

**Current:** Hybrid mode with spawn_agents gated
**Alternative:** Always require API key

**Decision Rationale:**
- 80% of use cases don't need spawn_agents
- FREE mode has zero cost
- Privacy-conscious users prefer local
- Gradual adoption path

**Trade-offs:**
- ✅ FREE mode has no cost
- ✅ Better privacy for simple cases
- ❌ Two code paths to maintain
- ✅ Flexibility for users

#### 3. TypeScript for Everything

**Current:** Full TypeScript implementation
**Alternative:** JavaScript with JSDoc

**Decision Rationale:**
- Better type safety
- IDE support
- Catch errors at compile time
- Self-documenting code

**Trade-offs:**
- ✅ Type safety
- ✅ Better DX
- ❌ Build step required
- ❌ Slightly more complexity

---

## Component Details

### ClaudeCodeCLIAdapter

**File:** `/home/user/codebuff/adapter/src/claude-cli-adapter.ts`

**Class Diagram:**

```
┌─────────────────────────────────────────────────────────┐
│           ClaudeCodeCLIAdapter                          │
├─────────────────────────────────────────────────────────┤
│ - config: Required<AdapterConfig>                       │
│ - hasApiKey: boolean                                    │
│ - contexts: Map<string, AgentExecutionContext>          │
│ - agentRegistry: Map<string, AgentDefinition>           │
│ - fileOps: FileOperationsTools                          │
│ - codeSearch: CodeSearchTools                           │
│ - terminal: TerminalTools                               │
│ - spawnAgents: SpawnAgentsAdapter                       │
│ - handleStepsExecutor: HandleStepsExecutor              │
├─────────────────────────────────────────────────────────┤
│ + constructor(config: AdapterConfig)                    │
│ + registerAgent(agentDef: AgentDefinition): void        │
│ + registerAgents(agents: AgentDefinition[]): void       │
│ + executeAgent(...): Promise<AgentExecutionResult>      │
│ + getAgent(agentId: string): AgentDefinition?           │
│ + listAgents(): string[]                                │
│ + getCwd(): string                                      │
│ + getConfig(): Readonly<Required<AdapterConfig>>        │
│ + hasApiKeyAvailable(): boolean                         │
│                                                          │
│ - executeWithHandleSteps(...): Promise<...>             │
│ - executePureLLM(...): Promise<...>                     │
│ - executeLLMStep(...): Promise<...>                     │
│ - executeToolCall(...): Promise<...>                    │
│ - invokeClaude(...): Promise<string>                    │
│ - createExecutionContext(...): AgentExecutionContext    │
│ - buildSystemPrompt(...): string                        │
└─────────────────────────────────────────────────────────┘
```

**Initialization Flow:**

```
1. Constructor called with AdapterConfig
   │
2. Detect API key (FREE vs PAID mode)
   │
3. Initialize tool implementations
   │   ├── FileOperationsTools(cwd)
   │   ├── CodeSearchTools(cwd)
   │   ├── TerminalTools(cwd, env)
   │   └── SpawnAgentsAdapter(registry, executor)
   │
4. Initialize HandleStepsExecutor
   │
5. Log initialization complete
```

### HandleStepsExecutor

**File:** `/home/user/codebuff/adapter/src/handle-steps-executor.ts`

**Execution Flow:**

```
execute(agentDef, context, toolExecutor, llmExecutor)
   │
1. Validate agentDef has handleSteps
   │
2. Start generator: agentDef.handleSteps(context)
   │
3. Main Loop (until done or maxIterations)
   │
   ├─► Get next value from generator
   │   │
   │   ├─ If done: Break (success)
   │   │
   │   ├─ If ToolCall:
   │   │   ├─ Execute tool via toolExecutor
   │   │   ├─ Pass result back to generator
   │   │   └─ Continue loop
   │   │
   │   ├─ If 'STEP':
   │   │   ├─ Execute single LLM turn via llmExecutor
   │   │   ├─ Pass state back to generator
   │   │   └─ Continue loop
   │   │
   │   ├─ If 'STEP_ALL':
   │   │   ├─ Execute LLM until completion
   │   │   ├─ Pass final state back to generator
   │   │   └─ Break (completion)
   │   │
   │   └─ If STEP_TEXT:
   │       ├─ Add to message history
   │       ├─ Call textOutputHandler if provided
   │       └─ Continue loop
   │
4. Return ExecutionResult
   ├─ agentState
   ├─ iterationCount
   ├─ completedNormally
   └─ error (if any)
```

### Tool Layer Architecture

**Common Pattern:**

```typescript
class ToolImplementation {
  constructor(private readonly cwd: string) {}

  async executeToolOperation(input: InputType): Promise<ToolResultOutput[]> {
    // 1. Validate input
    this.validateInput(input)

    // 2. Execute operation
    const result = await this.performOperation(input)

    // 3. Format result
    return this.formatResult(result)
  }

  private validateInput(input: InputType): void {
    // Security checks
    // Type validation
    // Business logic validation
  }

  private async performOperation(input: InputType): Promise<RawResult> {
    // Core implementation
    // Error handling
    // Resource management
  }

  private formatResult(result: RawResult): ToolResultOutput[] {
    // Convert to standard format
    return [{ type: 'json', value: result }]
  }
}
```

---

## Data Flow

### Complete Execution Flow

```
User Code
   │
   │ executeAgent(agentDef, prompt, params)
   │
   ▼
┌──────────────────────────────────────────┐
│ ClaudeCodeCLIAdapter.executeAgent()     │
├──────────────────────────────────────────┤
│ 1. Create execution context              │
│ 2. Store context in contexts map         │
│ 3. Determine execution mode              │
│    ├─ handleSteps? → executeWithHandleSteps
│    └─ no handleSteps? → executePureLLM   │
└──────────────────────────────────────────┘
   │
   ├─────────────────────┬────────────────────┐
   │                     │                    │
   ▼                     ▼                    ▼
executeWithHandleSteps   │              executePureLLM
   │                     │                    │
   ▼                     │                    │
HandleStepsExecutor      │                    │
   │                     │                    │
   │ Generator Loop      │                    │
   │                     │                    │
   ├─ Yield ToolCall ───┤                    │
   │                     │                    │
   ▼                     ▼                    ▼
   │              executeToolCall()     invokeClaude()
   │                     │                    │
   │                     ▼                    │
   │              Tool Dispatch               │
   │                     │                    │
   │        ┌────────────┼──────────┐        │
   │        ▼            ▼          ▼         │
   │    FileOps     CodeSearch  Terminal     │
   │        │            │          │         │
   │        │            │          │         │
   │        └────────────┴──────────┘         │
   │                     │                    │
   │               Tool Result                │
   │                     │                    │
   │◄────────────────────┤                    │
   │                                          │
   │                                          │
   └──────────────────────┬───────────────────┘
                          │
                          ▼
                   AgentExecutionResult
                          │
                          ▼
                      User Code
```

### Tool Call Data Flow

```
Generator yields ToolCall
   │
   │ { toolName: 'read_files', input: { paths: [...] } }
   │
   ▼
executeToolCall(context, toolCall)
   │
   │ Switch on toolName
   │
   ├─ 'read_files' ──► FileOperationsTools.readFiles(input)
   │                    │
   │                    ├─ Validate paths (security)
   │                    ├─ Resolve paths relative to cwd
   │                    ├─ Read files in parallel (Promise.all)
   │                    └─ Return { type: 'json', value: {...} }
   │
   ├─ 'code_search' ──► CodeSearchTools.codeSearch(input)
   │                    │
   │                    ├─ Validate query (injection prevention)
   │                    ├─ Spawn ripgrep process
   │                    ├─ Parse JSON output
   │                    └─ Return formatted results
   │
   └─ 'run_terminal_command' ──► TerminalTools.runTerminalCommand(input)
                        │
                        ├─ Sanitize command (security)
                        ├─ Spawn process
                        ├─ Collect stdout/stderr
                        └─ Return execution result
```

---

## Extension Points

### How to Extend the Adapter

#### 1. Adding New Tools

**Step-by-step:**

```typescript
// 1. Create tool implementation
// src/tools/my-custom-tool.ts

export interface MyToolInput {
  param1: string
  param2: number
}

export class MyCustomTool {
  constructor(private readonly cwd: string) {}

  async executeMyTool(input: MyToolInput): Promise<ToolResultOutput[]> {
    // Validate input
    if (!input.param1) {
      throw new Error('param1 is required')
    }

    // Execute operation
    const result = await this.doWork(input)

    // Return formatted result
    return [{
      type: 'json',
      value: result
    }]
  }

  private async doWork(input: MyToolInput): Promise<any> {
    // Implementation
  }
}

// 2. Add to adapter
// src/claude-cli-adapter.ts

class ClaudeCodeCLIAdapter {
  private readonly myCustomTool: MyCustomTool

  constructor(config: AdapterConfig) {
    // ...existing code...
    this.myCustomTool = new MyCustomTool(this.config.cwd)
  }

  private async executeToolCall(
    context: AgentExecutionContext,
    toolCall: ToolCall
  ): Promise<ToolResultOutput[]> {
    switch (toolCall.toolName) {
      // ...existing cases...

      case 'my_custom_tool':
        return await this.myCustomTool.executeMyTool(toolCall.input)

      default:
        throw new Error(`Unknown tool: ${toolCall.toolName}`)
    }
  }
}

// 3. Export from tools/index.ts
export { MyCustomTool } from './my-custom-tool'

// 4. Use in agents
const agent: AgentDefinition = {
  id: 'my-agent',
  toolNames: ['my_custom_tool'],

  handleSteps: function* () {
    const { toolResult } = yield {
      toolName: 'my_custom_tool',
      input: { param1: 'value', param2: 42 }
    }
  }
}
```

#### 2. Custom Execution Modes

**Creating Custom Executor:**

```typescript
import { HandleStepsExecutor } from '@codebuff/adapter'

class CustomExecutor extends HandleStepsExecutor {
  async execute(agentDef, context, toolExecutor, llmExecutor) {
    // Pre-processing
    console.log('Starting custom execution')

    // Call parent implementation
    const result = await super.execute(
      agentDef,
      context,
      toolExecutor,
      llmExecutor
    )

    // Post-processing
    console.log('Custom execution complete')

    return result
  }
}

// Use custom executor
const adapter = new ClaudeCodeCLIAdapter(config)
// Replace internal executor (would need to expose this)
```

#### 3. Plugin Architecture

**Example Plugin System:**

```typescript
interface Plugin {
  name: string
  version: string
  onToolCall?(toolName: string, input: any): void
  onToolResult?(toolName: string, result: any): void
  onAgentStart?(agentId: string): void
  onAgentComplete?(agentId: string, result: any): void
}

class PluginManager {
  private plugins: Plugin[] = []

  register(plugin: Plugin): void {
    this.plugins.push(plugin)
    console.log(`Registered plugin: ${plugin.name}@${plugin.version}`)
  }

  async executeHook<K extends keyof Plugin>(
    hook: K,
    ...args: Parameters<NonNullable<Plugin[K]>>
  ): Promise<void> {
    for (const plugin of this.plugins) {
      const fn = plugin[hook]
      if (fn && typeof fn === 'function') {
        await fn(...args)
      }
    }
  }
}

// Example plugin
const loggingPlugin: Plugin = {
  name: 'logging-plugin',
  version: '1.0.0',

  onToolCall(toolName, input) {
    console.log(`[Plugin] Tool called: ${toolName}`)
  },

  onToolResult(toolName, result) {
    console.log(`[Plugin] Tool completed: ${toolName}`)
  }
}
```

---

## Internals

### How Tool Execution Works

**Deep Dive:**

```typescript
// 1. Generator yields tool call
yield {
  toolName: 'read_files',
  input: { paths: ['file.ts'] }
}

// 2. HandleStepsExecutor receives yielded value
const { value } = generator.next()

// 3. HandleStepsExecutor identifies it as ToolCall
if (this.isToolCall(value)) {
  // 4. Call tool executor (provided by adapter)
  const toolResult = await toolExecutor(value)

  // 5. Pass result back to generator
  generator.next({
    agentState: currentAgentState,
    toolResult,
    stepsComplete: false
  })
}

// 6. Adapter's executeToolCall receives call
private async executeToolCall(
  context: AgentExecutionContext,
  toolCall: ToolCall
): Promise<ToolResultOutput[]> {
  // 7. Dispatch to correct tool
  switch (toolCall.toolName) {
    case 'read_files':
      // 8. Call tool implementation
      return await this.fileOps.readFiles(toolCall.input)
  }
}

// 9. Tool implementation executes
async readFiles(input: ReadFilesParams): Promise<ToolResultOutput[]> {
  // 10. Validate, execute, format
  const results = await Promise.all(
    input.paths.map(async (path) => {
      const fullPath = this.resolvePath(path)
      await this.validatePath(fullPath)
      return await fs.readFile(fullPath, 'utf-8')
    })
  )

  // 11. Return formatted result
  return [{
    type: 'json',
    value: Object.fromEntries(
      input.paths.map((path, i) => [path, results[i]])
    )
  }]
}
```

### How Context Works

**Context Lifecycle:**

```
1. Agent Execution Starts
   │
   ├─► createExecutionContext()
   │   │
   │   └─ Create new context:
   │       {
   │         agentId: 'unique-id',
   │         parentId: undefined,
   │         messageHistory: [],
   │         stepsRemaining: 20,
   │         output: undefined
   │       }
   │
2. Store in contexts map
   │
   contexts.set(agentId, context)
   │
3. Pass to execution mode
   │
   ├─ executeWithHandleSteps(context)
   │  │
   │  └─ Create AgentState from context
   │     {
   │       agentId: context.agentId,
   │       runId: 'new-run-id',
   │       messageHistory: context.messageHistory,
   │       output: context.output
   │     }
   │
4. Update context during execution
   │
   ├─ Tool results added to messageHistory
   ├─ stepsRemaining decremented
   └─ output updated via set_output
   │
5. Extract final result
   │
   return {
     output: context.output,
     messageHistory: context.messageHistory,
     agentState: final state
   }
   │
6. Cleanup
   │
   contexts.delete(agentId)
```

### How Error Handling Works

**Error Flow:**

```
Error occurs in tool execution
   │
   ▼
try {
  const result = await toolExecutor(toolCall)
} catch (error) {
  │
  │ Is it an AdapterError?
  │
  ├─ Yes ─► Re-throw (already formatted)
  │
  └─ No ──► Wrap in ToolExecutionError
      │
      new ToolExecutionError(
        'Tool execution failed',
        {
          toolName,
          toolInput: toolCall.input,
          originalError: error
        }
      )
      │
      ▼
  Propagates to executeAgent
      │
      ▼
  User code's catch block
      │
      ▼
  User handles error
}
```

---

## Contributing

### Code Structure

```
adapter/
├── src/
│   ├── claude-cli-adapter.ts      # Main orchestrator
│   ├── handle-steps-executor.ts   # Generator engine
│   ├── errors.ts                   # Error classes
│   ├── types.ts                    # Type definitions
│   ├── index.ts                    # Public API exports
│   │
│   ├── tools/                      # Tool implementations
│   │   ├── file-operations.ts
│   │   ├── code-search.ts
│   │   ├── terminal.ts
│   │   ├── spawn-agents.ts
│   │   └── index.ts
│   │
│   └── utils/                      # Shared utilities
│       ├── async-utils.ts
│       ├── error-formatting.ts
│       ├── path-validation.ts
│       └── index.ts
│
├── docs/                           # Documentation
├── examples/                       # Usage examples
└── tests/                          # Test files
```

### Adding Features

**Checklist:**

1. **Design**
   - [ ] Document requirements
   - [ ] Design API interface
   - [ ] Consider backward compatibility
   - [ ] Plan error cases

2. **Implementation**
   - [ ] Write TypeScript code
   - [ ] Add comprehensive JSDoc comments
   - [ ] Implement error handling
   - [ ] Add input validation

3. **Testing**
   - [ ] Write unit tests
   - [ ] Write integration tests
   - [ ] Test error cases
   - [ ] Test edge cases

4. **Documentation**
   - [ ] Update API reference
   - [ ] Add usage examples
   - [ ] Update changelog
   - [ ] Update README if needed

5. **Review**
   - [ ] Code review
   - [ ] Performance review
   - [ ] Security review
   - [ ] Documentation review

### Testing Requirements

**Test Coverage Goals:**
- Unit tests: >80% coverage
- Integration tests: Core workflows
- Error cases: All error paths
- Edge cases: Boundary conditions

**Example Test Structure:**

```typescript
describe('FeatureName', () => {
  describe('Happy Path', () => {
    it('should work with valid input', () => {})
    it('should handle common use case', () => {})
  })

  describe('Edge Cases', () => {
    it('should handle empty input', () => {})
    it('should handle maximum values', () => {})
  })

  describe('Error Cases', () => {
    it('should validate required parameters', () => {})
    it('should handle file not found', () => {})
  })

  describe('Integration', () => {
    it('should integrate with other components', () => {})
  })
})
```

---

## See Also

- [FREE Mode API Reference](./FREE_MODE_API_REFERENCE.md)
- [Advanced Patterns](./ADVANCED_PATTERNS.md)
- [Best Practices](./BEST_PRACTICES.md)
- [Main README](../README.md)
