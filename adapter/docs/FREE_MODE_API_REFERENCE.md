# FREE Mode API Reference

Complete API reference for using the Claude CLI Adapter in FREE mode (no API key required).

## Table of Contents

- [Overview](#overview)
- [Factories](#factories)
  - [createAdapter()](#createadapter)
  - [createDebugAdapter()](#createdebugadapter)
- [Classes](#classes)
  - [ClaudeCodeCLIAdapter](#claudecodecliadapter)
  - [HandleStepsExecutor](#handlestepsexecutor)
  - [FileOperationsTools](#fileoperationstools)
  - [CodeSearchTools](#codesearchtools)
  - [TerminalTools](#terminaltools)
- [Types](#types)
  - [AdapterConfig](#adapterconfig)
  - [AgentExecutionResult](#agentexecutionresult)
  - [ToolResultOutput](#toolresultoutput)
  - [RetryConfig](#retryconfig)
  - [TimeoutConfig](#timeoutconfig)
- [Error Classes](#error-classes)
  - [AdapterError](#adaptererror)
  - [ToolExecutionError](#toolexecutionerror)
  - [ValidationError](#validationerror)
  - [TimeoutError](#timeouterror)
  - [MaxIterationsError](#maxiterationserror)
- [Tool APIs](#tool-apis)
  - [read_files](#read_files)
  - [write_file](#write_file)
  - [str_replace](#str_replace)
  - [code_search](#code_search)
  - [find_files](#find_files)
  - [run_terminal_command](#run_terminal_command)
  - [set_output](#set_output)

---

## Overview

FREE mode provides complete access to all adapter features except multi-agent orchestration (`spawn_agents`). This mode requires no API key and incurs zero costs while providing full file operations, code search, and terminal command capabilities.

**What's Available in FREE Mode:**
- ✅ File operations (`read_files`, `write_file`, `str_replace`)
- ✅ Code search (`code_search`, `find_files`)
- ✅ Terminal commands (`run_terminal_command`)
- ✅ Single agent execution with `handleSteps` generators
- ✅ Output control (`set_output`)
- ❌ Multi-agent orchestration (`spawn_agents` - requires PAID mode)

---

## Factories

Factory functions provide convenient ways to create adapter instances with common configurations.

### createAdapter()

Creates a new ClaudeCodeCLIAdapter instance with default FREE mode configuration.

**Signature:**
```typescript
function createAdapter(
  cwd: string,
  options?: Partial<Omit<AdapterConfig, 'cwd'>>
): ClaudeCodeCLIAdapter
```

**Parameters:**
- `cwd` (string): Working directory for all file operations. All relative paths will be resolved against this directory.
- `options` (Partial<AdapterConfig>, optional): Configuration overrides
  - `debug` (boolean): Enable debug logging (default: false)
  - `maxSteps` (number): Maximum execution steps (default: 20)
  - `env` (Record<string, string>): Environment variables for terminal commands
  - `logger` (function): Custom logger function
  - `retry` (Partial<RetryConfig>): Retry configuration
  - `timeouts` (Partial<TimeoutConfig>): Timeout configuration

**Returns:**
ClaudeCodeCLIAdapter instance configured for FREE mode

**Examples:**

```typescript
// Basic usage - FREE mode with defaults
import { createAdapter } from '@codebuff/adapter'

const adapter = createAdapter('/path/to/project')
```

```typescript
// With debug logging
const adapter = createAdapter('/path/to/project', {
  debug: true
})
```

```typescript
// With custom max steps
const adapter = createAdapter('/path/to/project', {
  maxSteps: 50,  // Allow more complex workflows
  debug: true
})
```

```typescript
// With custom environment variables
const adapter = createAdapter('/path/to/project', {
  env: {
    NODE_ENV: 'development',
    DEBUG: 'true',
    PATH: process.env.PATH
  }
})
```

```typescript
// With custom logger
const adapter = createAdapter('/path/to/project', {
  debug: true,
  logger: (message) => {
    // Send to custom logging service
    myLogger.info(message)
  }
})
```

**See Also:**
- [createDebugAdapter()](#createdebugadapter)
- [ClaudeCodeCLIAdapter](#claudecodecliadapter)
- [AdapterConfig](#adapterconfig)

---

### createDebugAdapter()

Creates a ClaudeCodeCLIAdapter instance with debug logging pre-enabled. Useful for development and troubleshooting.

**Signature:**
```typescript
function createDebugAdapter(
  cwd: string,
  options?: Partial<Omit<AdapterConfig, 'cwd' | 'debug'>>
): ClaudeCodeCLIAdapter
```

**Parameters:**
- `cwd` (string): Working directory for all file operations
- `options` (Partial<AdapterConfig>, optional): Configuration overrides (debug is always true)

**Returns:**
ClaudeCodeCLIAdapter instance with debug logging enabled

**Examples:**

```typescript
// Debug mode with defaults
import { createDebugAdapter } from '@codebuff/adapter'

const adapter = createDebugAdapter('/path/to/project')

// Debug output will be logged to console:
// [ClaudeCodeCLIAdapter] ClaudeCodeCLIAdapter initialized
// [ClaudeCodeCLIAdapter] No API key - Free mode (spawn_agents disabled)
```

```typescript
// Debug mode with increased max steps
const adapter = createDebugAdapter('/path/to/project', {
  maxSteps: 100
})
```

```typescript
// Debug mode with custom logger
const adapter = createDebugAdapter('/path/to/project', {
  logger: (msg) => {
    console.log(`[${new Date().toISOString()}] ${msg}`)
    fs.appendFileSync('debug.log', msg + '\n')
  }
})
```

**Debug Output Includes:**
- Adapter initialization details
- Agent registration confirmations
- Tool execution logs with parameters
- Execution timing information
- Error details with context

**See Also:**
- [createAdapter()](#createadapter)
- [Debugging Guide](../README.md#debug-logging)

---

## Classes

### ClaudeCodeCLIAdapter

Main adapter class that orchestrates agent execution with Claude Code CLI tools.

**Constructor:**
```typescript
constructor(config: AdapterConfig)
```

#### Methods

##### registerAgent()

Register an agent definition to make it available for execution.

**Signature:**
```typescript
registerAgent(agentDef: AgentDefinition): void
```

**Parameters:**
- `agentDef` (AgentDefinition): Agent definition to register

**Examples:**

```typescript
const fileReaderAgent: AgentDefinition = {
  id: 'file-reader',
  displayName: 'File Reader',
  systemPrompt: 'You are a file reading assistant.',
  toolNames: ['read_files', 'find_files'],
  outputMode: 'last_message',

  handleSteps: function* ({ params }) {
    const { toolResult } = yield {
      toolName: 'find_files',
      input: { pattern: params.pattern }
    }

    yield {
      toolName: 'set_output',
      input: { output: toolResult[0].value }
    }
  }
}

adapter.registerAgent(fileReaderAgent)
```

**See Also:**
- [registerAgents()](#registeragents)
- [AgentDefinition Type](../README.md#agent-definitions)

---

##### registerAgents()

Register multiple agents at once.

**Signature:**
```typescript
registerAgents(agents: AgentDefinition[]): void
```

**Parameters:**
- `agents` (AgentDefinition[]): Array of agent definitions

**Examples:**

```typescript
adapter.registerAgents([
  fileReaderAgent,
  codeAnalyzerAgent,
  buildRunnerAgent
])
```

---

##### executeAgent()

Execute an agent with the given prompt and parameters.

**Signature:**
```typescript
async executeAgent(
  agentDef: AgentDefinition,
  prompt: string | undefined,
  params?: Record<string, unknown>,
  parentContext?: AgentExecutionContext
): Promise<AgentExecutionResult>
```

**Parameters:**
- `agentDef` (AgentDefinition): Agent to execute
- `prompt` (string | undefined): User prompt for the agent
- `params` (Record<string, unknown>, optional): Parameters to pass to agent
- `parentContext` (AgentExecutionContext, optional): Parent context for nested agents

**Returns:**
Promise<AgentExecutionResult> with:
- `output` (unknown): The agent's output
- `messageHistory` (Message[]): Complete conversation history
- `agentState` (AgentState, optional): Final agent state
- `metadata` (object, optional): Execution metadata including timing

**Throws:**
- `MaxIterationsError`: If execution exceeds maxSteps
- `ToolExecutionError`: If a tool fails
- `ValidationError`: If input validation fails
- `Error`: For other execution failures

**Examples:**

```typescript
// Basic execution
const result = await adapter.executeAgent(
  fileReaderAgent,
  'Find all TypeScript files'
)
console.log('Files:', result.output)
```

```typescript
// With parameters
const result = await adapter.executeAgent(
  fileReaderAgent,
  undefined,  // No prompt
  { pattern: '**/*.ts', limit: 10 }
)
```

```typescript
// With error handling
try {
  const result = await adapter.executeAgent(
    fileReaderAgent,
    'Find files'
  )

  console.log('Success:', result.output)
  console.log('Execution time:', result.metadata?.executionTime, 'ms')
} catch (error) {
  if (error instanceof MaxIterationsError) {
    console.error('Agent took too many steps')
  } else {
    console.error('Execution failed:', error.message)
  }
}
```

**See Also:**
- [AgentExecutionResult](#agentexecutionresult)
- [Error Handling Guide](#error-classes)

---

##### getAgent()

Retrieve a registered agent by ID.

**Signature:**
```typescript
getAgent(agentId: string): AgentDefinition | undefined
```

**Parameters:**
- `agentId` (string): Agent identifier

**Returns:**
AgentDefinition or undefined if not found

**Examples:**

```typescript
const agent = adapter.getAgent('file-reader')
if (agent) {
  console.log('Found agent:', agent.displayName)
} else {
  console.log('Agent not registered')
}
```

---

##### listAgents()

List all registered agent IDs.

**Signature:**
```typescript
listAgents(): string[]
```

**Returns:**
Array of registered agent IDs

**Examples:**

```typescript
const agentIds = adapter.listAgents()
console.log('Registered agents:', agentIds)
// Output: ['file-reader', 'code-analyzer', 'build-runner']
```

---

##### getCwd()

Get the current working directory.

**Signature:**
```typescript
getCwd(): string
```

**Returns:**
Current working directory path

**Examples:**

```typescript
const cwd = adapter.getCwd()
console.log('Working directory:', cwd)
```

---

##### getConfig()

Get the adapter configuration.

**Signature:**
```typescript
getConfig(): Readonly<Required<AdapterConfig>>
```

**Returns:**
Read-only copy of the complete adapter configuration

**Examples:**

```typescript
const config = adapter.getConfig()
console.log('Max steps:', config.maxSteps)
console.log('Debug enabled:', config.debug)
console.log('Timeouts:', config.timeouts)
```

---

##### hasApiKeyAvailable()

Check if API key is available (determines if PAID mode features are enabled).

**Signature:**
```typescript
hasApiKeyAvailable(): boolean
```

**Returns:**
true if API key is configured (PAID mode), false otherwise (FREE mode)

**Examples:**

```typescript
if (!adapter.hasApiKeyAvailable()) {
  console.log('Running in FREE mode - spawn_agents disabled')
} else {
  console.log('Running in PAID mode - all features available')
}
```

---

### HandleStepsExecutor

Executes the handleSteps generator function from agent definitions. Manages the iteration lifecycle, tool dispatching, and state management.

**Constructor:**
```typescript
constructor(config: HandleStepsExecutorConfig = {})
```

**Configuration:**
```typescript
interface HandleStepsExecutorConfig {
  maxIterations?: number        // Default: 100
  debug?: boolean               // Default: false
  logger?: (msg: string, data?: any) => void
}
```

#### Methods

##### execute()

Execute a handleSteps generator to completion.

**Signature:**
```typescript
async execute(
  agentDef: AgentDefinition,
  context: AgentStepContext,
  toolExecutor: ToolExecutor,
  llmExecutor: LLMExecutor,
  textOutputHandler?: TextOutputHandler
): Promise<ExecutionResult>
```

**Parameters:**
- `agentDef` (AgentDefinition): Agent with handleSteps function
- `context` (AgentStepContext): Initial execution context
- `toolExecutor` (ToolExecutor): Function to execute tools
- `llmExecutor` (LLMExecutor): Function to execute LLM steps
- `textOutputHandler` (TextOutputHandler, optional): Handler for text output

**Returns:**
Promise<ExecutionResult> with:
- `agentState` (AgentState): Final agent state
- `iterationCount` (number): Total iterations executed
- `completedNormally` (boolean): Whether execution completed without errors
- `error` (Error, optional): Any error that occurred

**Throws:**
- `MaxIterationsError`: If execution exceeds maxIterations
- `UnknownYieldValueError`: If generator yields invalid value
- `Error`: If agentDef has no handleSteps function

**Examples:**

```typescript
import { HandleStepsExecutor } from '@codebuff/adapter'

const executor = new HandleStepsExecutor({
  maxIterations: 100,
  debug: true
})

const result = await executor.execute(
  agentDef,
  context,
  async (toolCall) => {
    // Execute tool
    return await executeTool(toolCall)
  },
  async (mode) => {
    // Execute LLM step
    return { endTurn: true, agentState: updatedState }
  }
)

console.log('Completed in', result.iterationCount, 'iterations')
```

**See Also:**
- [ExecutionResult Type](#types)
- [Generator Patterns](./ADVANCED_PATTERNS.md#pattern-1-custom-tool-implementation)

---

### FileOperationsTools

Provides file reading, writing, and editing operations.

**Constructor:**
```typescript
constructor(cwd: string)
```

#### Methods

##### readFiles()

Read multiple files from disk in parallel.

**Signature:**
```typescript
async readFiles(input: ReadFilesParams): Promise<ToolResultOutput[]>
```

**Parameters:**
```typescript
interface ReadFilesParams {
  paths: string[]  // File paths relative to cwd
}
```

**Returns:**
Array with single ToolResultOutput containing:
```typescript
{
  type: 'json',
  value: {
    [filePath: string]: string | null  // null if file not found
  }
}
```

**Examples:**

```typescript
const tools = new FileOperationsTools('/project')

const result = await tools.readFiles({
  paths: ['src/index.ts', 'package.json', 'README.md']
})

const files = result[0].value
console.log('Index content:', files['src/index.ts'])
console.log('Package:', JSON.parse(files['package.json']))
```

**Performance:**
Uses Promise.all for parallel reads. Reading 10 files is ~10x faster than sequential reads.

**See Also:**
- [read_files Tool API](#read_files)

---

##### writeFile()

Write content to a file, creating parent directories if needed.

**Signature:**
```typescript
async writeFile(input: WriteFileParams): Promise<ToolResultOutput[]>
```

**Parameters:**
```typescript
interface WriteFileParams {
  path: string      // File path relative to cwd
  content: string   // Content to write
}
```

**Returns:**
```typescript
{
  type: 'json',
  value: {
    success: boolean
    path: string
    error?: string  // Present if success is false
  }
}
```

**Examples:**

```typescript
const result = await tools.writeFile({
  path: 'src/generated/config.ts',
  content: 'export const config = { version: "1.0.0" };'
})

if (result[0].value.success) {
  console.log('File written successfully')
}
```

**See Also:**
- [write_file Tool API](#write_file)

---

##### strReplace()

Replace a string in a file (first occurrence only).

**Signature:**
```typescript
async strReplace(input: StrReplaceParams): Promise<ToolResultOutput[]>
```

**Parameters:**
```typescript
interface StrReplaceParams {
  path: string         // File path relative to cwd
  old_string: string   // Exact string to find
  new_string: string   // Replacement string
}
```

**Returns:**
```typescript
{
  type: 'json',
  value: {
    success: boolean
    path: string
    error?: string          // Present if success is false
    old_string?: string     // Echo of old_string if not found
  }
}
```

**Examples:**

```typescript
const result = await tools.strReplace({
  path: 'src/config.ts',
  old_string: 'const PORT = 3000',
  new_string: 'const PORT = 8080'
})

if (!result[0].value.success) {
  console.error('Replacement failed:', result[0].value.error)
}
```

**See Also:**
- [str_replace Tool API](#str_replace)

---

### CodeSearchTools

Provides code search and file finding capabilities using ripgrep and glob.

**Constructor:**
```typescript
constructor(cwd: string)
```

#### Methods

##### codeSearch()

Search codebase using ripgrep.

**Signature:**
```typescript
async codeSearch(input: CodeSearchInput): Promise<ToolResultOutput[]>
```

**Parameters:**
```typescript
interface CodeSearchInput {
  query: string              // Search pattern/regex
  file_pattern?: string      // Glob pattern to filter files
  case_sensitive?: boolean   // Default: false
  cwd?: string              // Optional search directory
  maxResults?: number       // Default: 250
}
```

**Returns:**
```typescript
{
  type: 'json',
  value: {
    results: SearchResult[]  // Array of matches
    total: number            // Total matches found
    truncated: boolean       // True if results were limited
  }
}
```

**Examples:**

```typescript
const tools = new CodeSearchTools('/project')

const result = await tools.codeSearch({
  query: 'TODO:',
  file_pattern: '*.ts',
  maxResults: 50
})

const todos = result[0].value.results
todos.forEach(match => {
  console.log(`${match.path}:${match.line_number}: ${match.line}`)
})
```

**See Also:**
- [code_search Tool API](#code_search)

---

##### findFiles()

Find files matching a glob pattern.

**Signature:**
```typescript
async findFiles(input: FindFilesInput): Promise<ToolResultOutput[]>
```

**Parameters:**
```typescript
interface FindFilesInput {
  pattern: string   // Glob pattern (e.g., "**/*.ts")
  cwd?: string     // Optional search directory
}
```

**Returns:**
```typescript
{
  type: 'json',
  value: {
    files: string[]      // Array of matching file paths
    total: number        // Total files found
    pattern: string      // Echo of search pattern
  }
}
```

**Examples:**

```typescript
const result = await tools.findFiles({
  pattern: 'src/**/*.test.ts'
})

const testFiles = result[0].value.files
console.log(`Found ${testFiles.length} test files`)
```

**See Also:**
- [find_files Tool API](#find_files)

---

### TerminalTools

Provides shell command execution with timeout and environment control.

**Constructor:**
```typescript
constructor(cwd: string, env?: Record<string, string>)
```

#### Methods

##### runTerminalCommand()

Execute a shell command.

**Signature:**
```typescript
async runTerminalCommand(
  input: RunTerminalCommandInput
): Promise<ToolResultOutput[]>
```

**Parameters:**
```typescript
interface RunTerminalCommandInput {
  command: string               // Shell command to execute
  mode?: 'user' | 'agent'      // Execution mode
  process_type?: 'SYNC' | 'ASYNC'  // Process type
  timeout_seconds?: number      // Timeout (default: 30)
  cwd?: string                 // Override working directory
  env?: Record<string, string> // Additional environment variables
  description?: string         // Command description for logging
  retry?: boolean              // Enable retry on transient errors
  retryConfig?: Partial<RetryConfig>  // Retry configuration
}
```

**Returns:**
```typescript
{
  type: 'json',
  value: {
    command: string
    stdout: string
    stderr: string
    exitCode: number
    timedOut: boolean
    executionTime: number
    cwd: string
    error?: string
  }
}
```

**Examples:**

```typescript
const tools = new TerminalTools('/project', { NODE_ENV: 'test' })

// Simple command
const result = await tools.runTerminalCommand({
  command: 'npm test',
  timeout_seconds: 60
})

console.log('Exit code:', result[0].value.exitCode)
console.log('Output:', result[0].value.stdout)
```

```typescript
// With retry on failure
const result = await tools.runTerminalCommand({
  command: 'npm install',
  timeout_seconds: 300,
  retry: true,
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 2000
  }
})
```

**See Also:**
- [run_terminal_command Tool API](#run_terminal_command)

---

## Types

### AdapterConfig

Configuration options for ClaudeCodeCLIAdapter.

```typescript
interface AdapterConfig {
  // Required
  cwd: string                              // Working directory

  // Optional - FREE mode
  env?: Record<string, string>             // Environment variables
  maxSteps?: number                        // Max execution steps (default: 20)
  debug?: boolean                          // Enable debug logging
  logger?: (message: string) => void       // Custom logger
  retry?: Partial<RetryConfig>             // Retry configuration
  timeouts?: Partial<TimeoutConfig>        // Timeout configuration

  // Optional - PAID mode only
  anthropicApiKey?: string                 // API key for spawn_agents
}
```

**Examples:**

```typescript
const config: AdapterConfig = {
  cwd: '/path/to/project',
  debug: true,
  maxSteps: 50,
  env: {
    NODE_ENV: 'development'
  },
  retry: {
    maxRetries: 3,
    exponentialBackoff: true
  },
  timeouts: {
    toolExecutionTimeoutMs: 60000,
    terminalCommandTimeoutMs: 120000
  }
}

const adapter = new ClaudeCodeCLIAdapter(config)
```

---

### AgentExecutionResult

Result from executing an agent.

```typescript
interface AgentExecutionResult {
  output: unknown                    // Agent output value
  messageHistory: Message[]          // Complete message history
  agentState?: AgentState           // Final agent state
  metadata?: {
    iterationCount?: number          // Total iterations
    completedNormally?: boolean      // Clean completion flag
    executionTime?: number           // Time in milliseconds
  }
}
```

---

### ToolResultOutput

Standard tool result format.

```typescript
type ToolResultOutput =
  | {
      type: 'json'
      value: any
    }
  | {
      type: 'media'
      data: string
      mediaType: string
    }
```

---

### RetryConfig

Retry behavior configuration.

```typescript
interface RetryConfig {
  maxRetries: number              // Max retry attempts (default: 3)
  initialDelayMs: number          // Initial retry delay (default: 1000)
  maxDelayMs: number             // Max retry delay (default: 10000)
  backoffMultiplier: number      // Delay multiplier (default: 2)
  exponentialBackoff: boolean    // Use exponential backoff (default: true)
}
```

---

### TimeoutConfig

Timeout configuration for async operations.

```typescript
interface TimeoutConfig {
  toolExecutionTimeoutMs: number      // Tool timeout (default: 30000)
  llmInvocationTimeoutMs: number      // LLM timeout (default: 60000)
  terminalCommandTimeoutMs: number    // Terminal timeout (default: 30000)
}
```

---

## Error Classes

### AdapterError

Base error class for all adapter errors.

**Constructor:**
```typescript
constructor(
  message: string,
  options?: {
    agentId?: string
    originalError?: Error | unknown
    context?: Record<string, any>
  }
)
```

**Properties:**
- `timestamp` (Date): When error occurred
- `agentId` (string, optional): Agent that was executing
- `originalError` (Error, optional): Original cause
- `context` (Record<string, any>, optional): Additional context
- `originalStack` (string, optional): Stack from original error

**Methods:**
- `toJSON()`: Serialize to JSON
- `toDetailedString()`: Get formatted error with context

**Examples:**

```typescript
import { AdapterError, isAdapterError } from '@codebuff/adapter'

try {
  await adapter.executeAgent(agent, 'prompt')
} catch (error) {
  if (isAdapterError(error)) {
    console.error('Adapter error:', error.toDetailedString())
    console.error('Agent ID:', error.agentId)
    console.error('Context:', error.context)
  }
}
```

---

### ToolExecutionError

Error thrown when a tool execution fails.

**Extends:** AdapterError

**Additional Properties:**
- `toolName` (string): Tool that failed
- `toolInput` (any): Input provided to tool

**Examples:**

```typescript
import { ToolExecutionError, isToolExecutionError } from '@codebuff/adapter'

try {
  // Tool execution
} catch (error) {
  if (isToolExecutionError(error)) {
    console.error('Tool failed:', error.toolName)
    console.error('Input was:', error.toolInput)
  }
}
```

---

### ValidationError

Error thrown when input validation fails.

**Extends:** AdapterError

**Additional Properties:**
- `field` (string, optional): Field that failed validation
- `value` (any, optional): Invalid value
- `reason` (string, optional): Why validation failed
- `operation` (string, optional): Operation being validated

**Examples:**

```typescript
import { ValidationError, isValidationError } from '@codebuff/adapter'

try {
  // Validation
} catch (error) {
  if (isValidationError(error)) {
    console.error('Validation failed:', error.field)
    console.error('Invalid value:', error.value)
    console.error('Reason:', error.reason)
  }
}
```

---

### TimeoutError

Error thrown when an operation times out.

**Extends:** AdapterError

**Additional Properties:**
- `timeoutMs` (number): Timeout duration
- `operation` (string, optional): Operation that timed out

**Examples:**

```typescript
import { TimeoutError, isTimeoutError } from '@codebuff/adapter'

try {
  // Long running operation
} catch (error) {
  if (isTimeoutError(error)) {
    console.error('Timed out after:', error.timeoutMs, 'ms')
    console.error('Operation:', error.operation)
  }
}
```

---

### MaxIterationsError

Error thrown when execution exceeds maximum iterations.

**Extends:** Error

**Constructor:**
```typescript
constructor(maxIterations: number)
```

**Examples:**

```typescript
import { MaxIterationsError } from '@codebuff/adapter'

try {
  await adapter.executeAgent(agent, 'prompt')
} catch (error) {
  if (error instanceof MaxIterationsError) {
    console.error('Infinite loop detected')
    // Check handleSteps logic for infinite loops
  }
}
```

---

## Tool APIs

### read_files

Read multiple files from disk in parallel.

**Input Parameters:**
```typescript
{
  paths: string[]  // Array of file paths relative to cwd
}
```

**Output:**
```typescript
{
  type: 'json',
  value: {
    [filePath: string]: string | null  // File content or null if not found
  }
}
```

**Usage in handleSteps:**

```typescript
handleSteps: function* () {
  const { toolResult } = yield {
    toolName: 'read_files',
    input: {
      paths: ['package.json', 'src/index.ts', 'README.md']
    }
  }

  const files = toolResult[0].value

  // Check if file exists
  if (files['package.json']) {
    const pkg = JSON.parse(files['package.json'])
    console.log('Package name:', pkg.name)
  } else {
    console.log('package.json not found')
  }
}
```

**Features:**
- ✅ Parallel file reading for performance
- ✅ Handles missing files gracefully (returns null)
- ✅ Path traversal protection
- ✅ Symlink resolution for security

**Security:**
- Validates all paths are within cwd
- Resolves symlinks to prevent traversal attacks
- Rejects paths outside working directory

---

### write_file

Write content to a file, creating parent directories as needed.

**Input Parameters:**
```typescript
{
  path: string      // File path relative to cwd
  content: string   // Content to write
}
```

**Output:**
```typescript
{
  type: 'json',
  value: {
    success: boolean
    path: string
    error?: string  // Present if success is false
  }
}
```

**Usage in handleSteps:**

```typescript
handleSteps: function* () {
  const { toolResult } = yield {
    toolName: 'write_file',
    input: {
      path: 'dist/output.json',
      content: JSON.stringify({ data: 'example' }, null, 2)
    }
  }

  if (toolResult[0].value.success) {
    console.log('File written successfully')
  } else {
    console.error('Write failed:', toolResult[0].value.error)
  }
}
```

**Features:**
- ✅ Auto-creates parent directories
- ✅ UTF-8 encoding
- ✅ Atomic write operations
- ✅ Graceful error handling

---

### str_replace

Replace first occurrence of a string in a file.

**Input Parameters:**
```typescript
{
  path: string         // File path relative to cwd
  old_string: string   // Exact string to find and replace
  new_string: string   // Replacement string
}
```

**Output:**
```typescript
{
  type: 'json',
  value: {
    success: boolean
    path: string
    error?: string          // Present if success is false
    old_string?: string     // Echo if not found
  }
}
```

**Usage in handleSteps:**

```typescript
handleSteps: function* () {
  const { toolResult } = yield {
    toolName: 'str_replace',
    input: {
      path: 'src/config.ts',
      old_string: 'export const VERSION = "1.0.0"',
      new_string: 'export const VERSION = "1.1.0"'
    }
  }

  if (toolResult[0].value.success) {
    console.log('Version updated')
  } else {
    console.error('String not found in file')
  }
}
```

**Features:**
- ✅ Exact string matching (not regex)
- ✅ First occurrence only
- ✅ Validates old_string exists before replacing
- ✅ Safe for code editing

---

### code_search

Search codebase using ripgrep with regex support.

**Input Parameters:**
```typescript
{
  query: string              // Search pattern (supports regex)
  file_pattern?: string      // Glob to filter files (e.g., "*.ts")
  case_sensitive?: boolean   // Default: false
  cwd?: string              // Optional search directory
  maxResults?: number       // Default: 250
}
```

**Output:**
```typescript
{
  type: 'json',
  value: {
    results: Array<{
      path: string
      line_number: number
      line: string
      match?: string
    }>
    total: number
    truncated: boolean
  }
}
```

**Usage in handleSteps:**

```typescript
handleSteps: function* () {
  const { toolResult } = yield {
    toolName: 'code_search',
    input: {
      query: 'TODO:|FIXME:',
      file_pattern: '*.ts',
      maxResults: 100
    }
  }

  const results = toolResult[0].value.results
  console.log(`Found ${results.length} TODOs/FIXMEs`)

  results.forEach(match => {
    console.log(`${match.path}:${match.line_number}: ${match.line.trim()}`)
  })
}
```

**Features:**
- ✅ Fast regex-based search powered by ripgrep
- ✅ File pattern filtering
- ✅ Case-sensitive/insensitive modes
- ✅ Result limiting
- ✅ Line number and context

**Requirements:**
- Requires ripgrep (`rg`) installed on system

---

### find_files

Find files matching a glob pattern.

**Input Parameters:**
```typescript
{
  pattern: string   // Glob pattern (e.g., "**/*.ts", "src/**/*.test.js")
  cwd?: string     // Optional search directory
}
```

**Output:**
```typescript
{
  type: 'json',
  value: {
    files: string[]      // Array of matching file paths
    total: number        // Total files found
    pattern: string      // Echo of search pattern
  }
}
```

**Usage in handleSteps:**

```typescript
handleSteps: function* () {
  const { toolResult } = yield {
    toolName: 'find_files',
    input: {
      pattern: 'src/**/*.test.ts'
    }
  }

  const testFiles = toolResult[0].value.files
  console.log(`Found ${testFiles.length} test files:`)
  testFiles.forEach(file => console.log(' -', file))
}
```

**Glob Pattern Examples:**
- `**/*.ts` - All TypeScript files recursively
- `src/**/*.js` - All JS files in src/ and subdirectories
- `*.json` - JSON files in current directory only
- `test/**/*.spec.ts` - All spec files in test/

**Features:**
- ✅ Fast glob matching
- ✅ Recursive directory traversal
- ✅ gitignore support
- ✅ Sorted results

---

### run_terminal_command

Execute shell commands with timeout and environment control.

**Input Parameters:**
```typescript
{
  command: string                  // Shell command to execute
  mode?: 'user' | 'agent'         // Execution mode
  process_type?: 'SYNC' | 'ASYNC' // Process type
  timeout_seconds?: number         // Timeout (default: 30)
  cwd?: string                    // Override working directory
  env?: Record<string, string>    // Additional environment variables
  description?: string            // Command description for logging
  retry?: boolean                 // Enable retry on transient errors
  retryConfig?: Partial<RetryConfig>
}
```

**Output:**
```typescript
{
  type: 'json',
  value: {
    command: string
    stdout: string
    stderr: string
    exitCode: number
    timedOut: boolean
    executionTime: number
    cwd: string
    error?: string
  }
}
```

**Usage in handleSteps:**

```typescript
handleSteps: function* () {
  // Simple command
  const { toolResult } = yield {
    toolName: 'run_terminal_command',
    input: {
      command: 'npm test',
      timeout_seconds: 60
    }
  }

  const result = toolResult[0].value
  if (result.exitCode === 0) {
    console.log('Tests passed!')
  } else {
    console.error('Tests failed:', result.stderr)
  }
}
```

```typescript
handleSteps: function* () {
  // Long-running command with retry
  const { toolResult } = yield {
    toolName: 'run_terminal_command',
    input: {
      command: 'npm install',
      timeout_seconds: 300,
      retry: true,
      retryConfig: {
        maxRetries: 3,
        initialDelayMs: 2000,
        exponentialBackoff: true
      }
    }
  }
}
```

**Features:**
- ✅ Configurable timeout
- ✅ Captures stdout and stderr
- ✅ Exit code tracking
- ✅ Custom environment variables
- ✅ Retry on transient failures
- ✅ Command injection protection

**Security:**
- Validates input to prevent command injection
- Uses spawn() instead of shell execution
- Sanitizes dangerous characters

---

### set_output

Set the agent's output value.

**Input Parameters:**
```typescript
{
  output: unknown  // Any serializable value
}
```

**Output:**
```typescript
{
  type: 'json',
  value: {
    success: true
    output: unknown  // Echo of output value
  }
}
```

**Usage in handleSteps:**

```typescript
handleSteps: function* () {
  // Set structured output
  yield {
    toolName: 'set_output',
    input: {
      output: {
        filesFound: 42,
        totalSize: 1024 * 1024,
        summary: 'Analysis complete'
      }
    }
  }
}
```

```typescript
handleSteps: function* () {
  // Set simple output
  yield {
    toolName: 'set_output',
    input: {
      output: 'Task completed successfully'
    }
  }
}
```

**Features:**
- ✅ Accepts any serializable value
- ✅ Updates agent state immediately
- ✅ Available in result.output after execution

---

## Complete Examples

### Example 1: File Analysis Agent

```typescript
import { createAdapter } from '@codebuff/adapter'
import type { AgentDefinition } from '@codebuff/types'

const fileAnalyzer: AgentDefinition = {
  id: 'file-analyzer',
  displayName: 'File Analyzer',
  toolNames: ['find_files', 'read_files', 'set_output'],

  handleSteps: function* ({ params }) {
    // Find files
    const { toolResult: findResult } = yield {
      toolName: 'find_files',
      input: { pattern: params.pattern || '**/*.ts' }
    }

    const files = findResult[0].value.files

    // Read first 5 files
    const { toolResult: readResult } = yield {
      toolName: 'read_files',
      input: { paths: files.slice(0, 5) }
    }

    const contents = readResult[0].value

    // Analyze
    const analysis = {
      totalFiles: files.length,
      sampledFiles: Object.keys(contents).length,
      totalLines: Object.values(contents)
        .filter(c => c !== null)
        .reduce((sum, content) =>
          sum + (content as string).split('\n').length, 0
        )
    }

    // Set output
    yield {
      toolName: 'set_output',
      input: { output: analysis }
    }
  }
}

// Use it
const adapter = createAdapter(process.cwd())
adapter.registerAgent(fileAnalyzer)

const result = await adapter.executeAgent(
  fileAnalyzer,
  undefined,
  { pattern: 'src/**/*.ts' }
)

console.log('Analysis:', result.output)
// Output: { totalFiles: 42, sampledFiles: 5, totalLines: 1234 }
```

### Example 2: Code Search and Report

```typescript
const todoReporter: AgentDefinition = {
  id: 'todo-reporter',
  displayName: 'TODO Reporter',
  toolNames: ['code_search', 'write_file', 'set_output'],

  handleSteps: function* () {
    // Search for TODOs
    const { toolResult } = yield {
      toolName: 'code_search',
      input: {
        query: 'TODO:|FIXME:',
        file_pattern: '*.ts',
        maxResults: 500
      }
    }

    const results = toolResult[0].value.results

    // Generate report
    const report = [
      '# TODO Report',
      '',
      `Found ${results.length} TODOs/FIXMEs`,
      '',
      '## Details',
      '',
      ...results.map(r =>
        `- ${r.path}:${r.line_number} - ${r.line.trim()}`
      )
    ].join('\n')

    // Write report
    yield {
      toolName: 'write_file',
      input: {
        path: 'TODO_REPORT.md',
        content: report
      }
    }

    // Set output
    yield {
      toolName: 'set_output',
      input: {
        output: {
          totalTodos: results.length,
          reportPath: 'TODO_REPORT.md'
        }
      }
    }
  }
}
```

### Example 3: Build Runner

```typescript
const buildRunner: AgentDefinition = {
  id: 'build-runner',
  displayName: 'Build Runner',
  toolNames: ['run_terminal_command', 'set_output'],

  handleSteps: function* () {
    const steps = ['npm install', 'npm run lint', 'npm test', 'npm run build']
    const results = []

    for (const command of steps) {
      const { toolResult } = yield {
        toolName: 'run_terminal_command',
        input: {
          command,
          timeout_seconds: 300,
          retry: command === 'npm install' // Retry install if it fails
        }
      }

      const result = toolResult[0].value
      results.push({
        command,
        success: result.exitCode === 0,
        executionTime: result.executionTime
      })

      // Stop on first failure
      if (result.exitCode !== 0) {
        break
      }
    }

    yield {
      toolName: 'set_output',
      input: {
        output: {
          steps: results,
          allPassed: results.every(r => r.success)
        }
      }
    }
  }
}
```

---

## See Also

- [Advanced Patterns Guide](./ADVANCED_PATTERNS.md)
- [Best Practices](./BEST_PRACTICES.md)
- [Performance Guide](./PERFORMANCE_GUIDE.md)
- [Main README](../README.md)
