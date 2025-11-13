# Error Handling and Retry Logic Implementation Summary

This document summarizes the comprehensive error handling and retry logic improvements made to the Claude CLI Adapter.

## Completed Implementations

### 1. Custom Error Classes (`adapter/src/errors.ts`)

Created a complete hierarchy of custom error classes with comprehensive context tracking:

#### Base Error Class
- **`AdapterError`**: Base class for all adapter errors
  - Includes: `timestamp`, `agentId`, `originalError`, `context`, `originalStack`
  - Methods: `toJSON()`, `toDetailedString()`
  - Maintains proper stack traces

#### Specialized Error Classes
- **`ToolExecutionError`**: Tool-specific errors with tool name and input context
- **`LLMExecutionError`**: LLM invocation errors with prompt snippets and message count
- **`ValidationError`**: Input validation errors with field, value, and reason
- **`TimeoutError`**: Timeout errors with duration and operation details
- **`AgentNotFoundError`**: Agent registry lookup failures with available agents list

#### Utility Functions
- Type guards: `isAdapterError`, `isToolExecutionError`, `isLLMExecutionError`, etc.
- `formatError(error, includeStack)`: Universal error formatting
- `withErrorContext(fn, context)`: Wrap functions with automatic error context

### 2. Async Utilities (`adapter/src/utils/async-utils.ts`)

Comprehensive async operation utilities:

#### Timeout Handling
- **`withTimeout(fn, timeoutMs, operation, agentId)`**: Wrap operations with timeout
  - Throws `TimeoutError` on timeout
  - Properly cleans up timeout handles
  - Includes operation context in errors

#### Retry Logic
- **`withRetry(fn, options)`**: Execute with exponential backoff retry
  - Configurable: `maxRetries`, `initialDelayMs`, `maxDelayMs`, `backoffMultiplier`
  - Custom `shouldRetry` predicate
  - `onRetry` callback for logging
  - Supports both exponential and linear backoff

#### Combined Operations
- **`withTimeoutAndRetry(fn, timeoutMs, retryOptions)`**: Timeout + retry together
- **`withBatchTimeout(operations, timeoutMs)`**: Timeout for Promise.all batches
- **`raceWithTimeout(operations, timeoutMs)`**: Timeout for Promise.race

#### Error Detection Utilities
- `isTimeoutError(error)`: Detect timeout errors from various sources
- `isNetworkError(error)`: Detect network-related errors
- `isTransientError(error)`: Combined timeout + network detection for retry logic

### 3. Type Definitions (`adapter/src/types.ts`)

Added configuration types for retry and timeout:

```typescript
interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  exponentialBackoff: boolean
}

interface TimeoutConfig {
  toolExecutionTimeoutMs: number
  llmInvocationTimeoutMs: number
  terminalCommandTimeoutMs: number
}

interface AdapterConfig {
  // ... existing fields
  retry?: Partial<RetryConfig>
  timeouts?: Partial<TimeoutConfig>
}
```

### 4. Terminal Tools Retry Logic (`adapter/src/tools/terminal.ts`)

Comprehensive retry implementation:

#### Interface Updates
- Added `retry?: boolean` to `RunTerminalCommandInput`
- Added `retryConfig?: Partial<RetryConfig>` for per-command overrides

#### Class Updates
- Constructor accepts `retryConfig?: Partial<RetryConfig>`
- Stores `defaultRetryConfig` merged with defaults
- `createTerminalTools()` factory accepts retry configuration

#### New Methods
- **`executeCommandWithRetry()`**: Wraps `executeCommand()` with retry logic
  - Uses `withRetry` from async-utils
  - Only retries on transient errors (timeout, network)
  - Logs retry attempts with delay information
  - Preserves error context across retries

#### Error Handling
- **`runTerminalCommand()`**: Now wraps errors in `ToolExecutionError`
  - Includes tool name, input, and original error
  - Returns `errorDetails` with full error JSON
  - Conditional retry based on `input.retry` flag

### 5. Claude CLI Adapter Updates (`adapter/src/claude-cli-adapter.ts`)

Partial implementation completed:

#### Imports Added
- All custom error classes
- Type imports for `RetryConfig` and `TimeoutConfig`
- `withTimeout` from async-utils

#### Constructor Updates
- Accepts and stores retry and timeout configuration
- Applies defaults:
  - Retry: 3 attempts, 1s initial delay, 10s max delay, 2x backoff
  - Timeouts: 30s tools, 60s LLM, 30s terminal

## Remaining Work

### 1. Complete Adapter Error Handling

Update `adapter/src/claude-cli-adapter.ts`:

#### `executeAgent()` Method
```typescript
async executeAgent(...): Promise<AgentExecutionResult> {
  try {
    // Validate agent definition
    if (!agentDef || !agentDef.id) {
      throw new ValidationError('Invalid agent definition', {...})
    }

    // ... existing execution logic wrapped in try-catch

    // Wrap execution errors with context
  } catch (error) {
    // Log with full context
    // Re-throw with proper error type
    throw new AdapterError('Agent execution failed', {
      agentId: context.agentId,
      originalError: error,
      context: {...}
    })
  }
}
```

#### Tool Dispatcher Methods

Wrap each tool method with error handling:

```typescript
private async toolReadFiles(input: any): Promise<ToolResultOutput[]> {
  try {
    return await this.fileOps.readFiles(input)
  } catch (error) {
    throw new ToolExecutionError('File read failed', {
      toolName: 'read_files',
      toolInput: input,
      originalError: error
    })
  }
}
```

Apply to:
- `toolReadFiles()`
- `toolWriteFile()`
- `toolStrReplace()`
- `toolCodeSearch()`
- `toolFindFiles()`
- `toolRunTerminal()`
- `toolSpawnAgents()`
- `toolSetOutput()`

#### LLM Integration

Update `invokeClaude()` method:

```typescript
private async invokeClaude(params: ClaudeInvocationParams): Promise<string> {
  try {
    return await withTimeout(
      async () => {
        // TODO: Actual Claude CLI integration
        // Placeholder for now
        return `[Response from Claude]`
      },
      this.config.timeouts.llmInvocationTimeoutMs,
      'llm_invocation'
    )
  } catch (error) {
    throw new LLMExecutionError('Claude invocation failed', {
      systemPrompt: params.systemPrompt,
      messageCount: params.messages.length,
      availableTools: params.tools,
      originalError: error
    })
  }
}
```

### 2. File Operations Error Handling

Update `adapter/src/tools/file-operations.ts`:

#### Add Imports
```typescript
import { ToolExecutionError, ValidationError } from '../errors'
```

#### Update Methods
- Wrap file system operations in try-catch
- Throw `ToolExecutionError` instead of returning error results
- Add path validation with `ValidationError`

Example:
```typescript
async readFiles(input: ReadFilesParams): Promise<ToolResultOutput[]> {
  try {
    // Validate input
    if (!input.paths || !Array.isArray(input.paths)) {
      throw new ValidationError('Invalid paths parameter', {
        field: 'paths',
        value: input.paths,
        reason: 'Must be an array of strings'
      })
    }

    // ... existing logic with improved error handling

  } catch (error) {
    throw new ToolExecutionError('Failed to read files', {
      toolName: 'read_files',
      toolInput: input,
      originalError: error
    })
  }
}
```

### 3. Code Search Error Handling

Update `adapter/src/tools/code-search.ts`:

Similar pattern to file operations:
- Add error class imports
- Wrap ripgrep execution in try-catch
- Throw `ToolExecutionError` on failures
- Add input validation

### 4. Spawn Agents Error Handling

Update `adapter/src/tools/spawn-agents.ts`:

#### Add Imports
```typescript
import { ToolExecutionError, AgentNotFoundError } from '../errors'
```

#### Update `spawnAgents()` Method
```typescript
async spawnAgents(
  input: SpawnAgentsParams,
  parentContext: AgentExecutionContext
): Promise<ToolResultOutput[]> {
  const results: SpawnedAgentResult[] = []

  for (const agentSpec of input.agents) {
    try {
      const agentDef = this.resolveAgent(agentSpec.agent_type)

      if (!agentDef) {
        throw new AgentNotFoundError(agentSpec.agent_type, {
          availableAgents: this.listRegisteredAgents(),
          parentAgentId: parentContext.agentId
        })
      }

      const { output } = await this.agentExecutor(...)

      results.push({...})
    } catch (error) {
      // Include error in results (don't throw, allow continuation)
      results.push({
        agentType: agentSpec.agent_type,
        agentName: agentSpec.agent_type,
        value: {
          errorMessage: formatError(error),
          errorDetails: isAdapterError(error) ? error.toJSON() : undefined
        }
      })
    }
  }

  return [{ type: 'json', value: results }]
}
```

### 5. Documentation Updates

#### JSDoc Tags
Add `@throws` tags to all methods that can throw errors:

```typescript
/**
 * @throws {ValidationError} If input is invalid
 * @throws {ToolExecutionError} If file operation fails
 * @throws {TimeoutError} If operation exceeds timeout
 */
```

#### Error Handling Guide
Create `adapter/docs/ERROR_HANDLING_GUIDE.md`:
- When to use each error type
- How to handle errors in tool implementations
- Retry strategy recommendations
- Logging best practices

## Configuration Examples

### Basic Configuration
```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: '/path/to/project',
  maxSteps: 20,
  debug: true,
  retry: {
    maxRetries: 3,
    exponentialBackoff: true
  },
  timeouts: {
    toolExecutionTimeoutMs: 30000,
    llmInvocationTimeoutMs: 60000
  }
})
```

### Per-Tool Retry Configuration
```typescript
await terminal.runTerminalCommand({
  command: 'npm install',
  retry: true,
  retryConfig: {
    maxRetries: 5,
    initialDelayMs: 2000,
    maxDelayMs: 30000
  }
})
```

### Custom Error Handling
```typescript
try {
  const result = await adapter.executeAgent(agent, prompt, params)
} catch (error) {
  if (isToolExecutionError(error)) {
    console.error(`Tool ${error.toolName} failed:`, error.message)
    console.error('Input:', error.toolInput)
  } else if (isLLMExecutionError(error)) {
    console.error(`LLM invocation failed after ${error.messageCount} messages`)
  } else if (isTimeoutError(error)) {
    console.error(`Operation timed out after ${error.timeoutMs}ms`)
  } else {
    console.error('Unexpected error:', formatError(error, true))
  }
}
```

## Testing Recommendations

### Unit Tests Needed

1. **Error Classes (`errors.test.ts`)**
   - Test error serialization (toJSON())
   - Test detailed string formatting
   - Test error wrapping and context preservation
   - Test type guards

2. **Async Utilities (`async-utils.test.ts`)**
   - Test timeout functionality
   - Test retry with exponential backoff
   - Test shouldRetry predicates
   - Test error detection utilities

3. **Terminal Retry Logic (`terminal.test.ts`)**
   - Test retry on transient failures
   - Test retry count limits
   - Test backoff delays
   - Test non-retryable errors

4. **Tool Error Handling**
   - Test each tool's error wrapping
   - Test validation errors
   - Test timeout handling
   - Test error context preservation

### Integration Tests Needed

1. **End-to-End Error Scenarios**
   - Agent execution with tool failures
   - Nested agent failures
   - Timeout in various operations
   - Retry recovery scenarios

2. **Error Propagation**
   - Verify errors bubble up correctly
   - Verify context is preserved through call stack
   - Verify logging captures all errors

## Performance Considerations

### Implemented Optimizations

1. **Terminal Tools**
   - Cached merged environment variables
   - Cached normalized CWD path
   - Avoid repeated object spreading

2. **Retry Logic**
   - Configurable exponential backoff
   - Early exit on non-retryable errors
   - Proper cleanup of resources

### Future Optimizations

1. **Error Object Pooling**
   - Reuse error objects for common cases
   - Reduce allocation overhead

2. **Structured Logging**
   - Use structured logger instead of console
   - Async logging to avoid blocking
   - Log sampling for high-frequency errors

## Migration Guide

For existing code using the adapter:

### Before
```typescript
try {
  await adapter.executeAgent(agent, prompt)
} catch (error) {
  console.error('Error:', error.message)
}
```

### After
```typescript
try {
  await adapter.executeAgent(agent, prompt)
} catch (error) {
  if (isAdapterError(error)) {
    // Rich error context available
    console.error(error.toDetailedString())

    // Access error metadata
    console.log('Agent ID:', error.agentId)
    console.log('Timestamp:', error.timestamp)
    console.log('Context:', error.context)

    // Access original error
    if (error.originalError) {
      console.log('Original:', error.originalError.message)
    }
  } else {
    // Fallback for unexpected errors
    console.error('Unexpected error:', formatError(error))
  }
}
```

## Summary of Benefits

1. **Comprehensive Error Context**
   - Every error includes agent ID, timestamp, and operation context
   - Original errors are preserved with full stack traces
   - Errors can be serialized to JSON for logging/monitoring

2. **Automatic Retry Logic**
   - Transient failures are automatically retried
   - Exponential backoff prevents overwhelming systems
   - Configurable per-tool and per-operation

3. **Proper Timeout Handling**
   - All async operations can have timeouts
   - Timeouts are configurable globally and per-operation
   - Timeout errors include operation context

4. **Type-Safe Error Handling**
   - Type guards enable specific error handling
   - TypeScript knows which properties are available
   - Reduces runtime errors from incorrect error handling

5. **Debugging and Monitoring**
   - Rich error details aid debugging
   - Errors can be logged to monitoring systems
   - Error context helps trace issues through nested agents

## Next Steps

1. Complete error handling in `claude-cli-adapter.ts`
2. Add error handling to file-operations.ts
3. Add error handling to code-search.ts
4. Add error handling to spawn-agents.ts
5. Write comprehensive tests
6. Create error handling documentation
7. Add monitoring/logging integration examples
