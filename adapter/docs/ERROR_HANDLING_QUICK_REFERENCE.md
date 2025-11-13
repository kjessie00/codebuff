# Error Handling Quick Reference

## Error Classes - When to Use

| Error Class | Use When | Example |
|------------|----------|---------|
| `ValidationError` | Input validation fails | Invalid parameters, missing required fields |
| `ToolExecutionError` | Tool operation fails | File read error, command execution failure |
| `LLMExecutionError` | LLM invocation fails | API timeout, rate limit, invalid response |
| `TimeoutError` | Operation exceeds timeout | Long-running operation cancelled |
| `AgentNotFoundError` | Agent not in registry | Invalid agent ID in spawn_agents |
| `AdapterError` | General adapter failure | Catch-all for other errors |

## Quick Patterns

### Input Validation

```typescript
// Validate required string parameter
if (!input.field || typeof input.field !== 'string') {
  throw new ValidationError('Invalid field parameter', {
    field: 'field',
    value: input.field,
    reason: 'Must be a non-empty string',
    toolName: 'your_tool_name',
  })
}

// Validate array parameter
if (!input.items || !Array.isArray(input.items)) {
  throw new ValidationError('Invalid items parameter', {
    field: 'items',
    value: input.items,
    reason: 'Must be an array',
    toolName: 'your_tool_name',
  })
}

// Validate number parameter
if (typeof input.count !== 'number' || input.count < 0) {
  throw new ValidationError('Invalid count parameter', {
    field: 'count',
    value: input.count,
    reason: 'Must be a non-negative number',
    toolName: 'your_tool_name',
  })
}
```

### Tool Error Wrapping

```typescript
async yourTool(input: InputType): Promise<ToolResultOutput[]> {
  try {
    // Validate input first
    if (!input.required) {
      throw new ValidationError(/* ... */)
    }

    // Do the work
    const result = await doSomething(input)

    return [{ type: 'json', value: result }]
  } catch (error) {
    // Re-throw ValidationError as-is
    if (error instanceof ValidationError) {
      throw error
    }

    // Wrap other errors
    throw new ToolExecutionError(
      `Tool failed: ${formatError(error)}`,
      {
        toolName: 'your_tool_name',
        toolInput: input,
        originalError: error instanceof Error ? error : new Error(String(error)),
      }
    )
  }
}
```

### Timeout Wrapping

```typescript
import { withTimeout } from '../utils/async-utils'

async yourMethod() {
  try {
    return await withTimeout(
      async () => {
        // Your async operation here
        return await slowOperation()
      },
      30000, // 30 second timeout
      'operation_name',
      this.agentId // optional
    )
  } catch (error) {
    // Handle TimeoutError specially if needed
    if (isTimeoutError(error)) {
      console.log('Operation timed out, using fallback')
      return fallbackValue
    }
    throw error
  }
}
```

### Retry Wrapping

```typescript
import { withRetry, isTransientError } from '../utils/async-utils'

async yourMethod() {
  return withRetry(
    async () => {
      // Your operation that might fail transiently
      return await unreliableOperation()
    },
    {
      maxRetries: 3,
      initialDelayMs: 1000,
      exponentialBackoff: true,
      shouldRetry: isTransientError, // or custom predicate
      onRetry: (error, attempt, delay) => {
        console.log(`Retry attempt ${attempt} after ${delay}ms`)
      },
    }
  )
}
```

### LLM Error Wrapping

```typescript
async invokeLLM(params: Params): Promise<string> {
  try {
    return await withTimeout(
      async () => {
        // LLM invocation here
        return await llmCall(params)
      },
      60000, // 60 second timeout
      'llm_invocation'
    )
  } catch (error) {
    throw new LLMExecutionError(
      'LLM invocation failed',
      {
        systemPrompt: params.systemPrompt,
        messageCount: params.messages.length,
        availableTools: params.tools,
        originalError: error instanceof Error ? error : new Error(String(error)),
      }
    )
  }
}
```

### Error Handling in Try-Catch

```typescript
try {
  await someOperation()
} catch (error) {
  // Check error type
  if (isToolExecutionError(error)) {
    console.error(`Tool ${error.toolName} failed`)
    console.error(`Input: ${JSON.stringify(error.toolInput)}`)
  } else if (isValidationError(error)) {
    console.error(`Validation failed for ${error.field}: ${error.reason}`)
  } else if (isTimeoutError(error)) {
    console.error(`Timed out after ${error.timeoutMs}ms`)
  } else if (isLLMExecutionError(error)) {
    console.error(`LLM failed after ${error.messageCount} messages`)
  } else if (isAdapterError(error)) {
    console.error(error.toDetailedString())
  } else {
    console.error('Unexpected error:', formatError(error, true))
  }
}
```

## JSDoc Tags

```typescript
/**
 * Your method description
 *
 * @param input - Input description
 * @returns Result description
 *
 * @throws {ValidationError} If input is invalid
 * @throws {ToolExecutionError} If operation fails
 * @throws {TimeoutError} If operation exceeds timeout
 *
 * @example
 * ```typescript
 * const result = await tool.method({ field: 'value' })
 * ```
 */
async method(input: InputType): Promise<ResultType> {
  // implementation
}
```

## Imports Needed

```typescript
// Error classes
import {
  AdapterError,
  ToolExecutionError,
  LLMExecutionError,
  ValidationError,
  TimeoutError,
  AgentNotFoundError,
  formatError,
  isAdapterError,
  isToolExecutionError,
  isLLMExecutionError,
  isValidationError,
  isTimeoutError,
  isAgentNotFoundError,
} from '../errors'

// Async utilities
import {
  withTimeout,
  withRetry,
  withTimeoutAndRetry,
  isTransientError,
  isTimeoutError as isTimeoutErrorUtil,
  isNetworkError,
  DEFAULT_RETRY_CONFIG,
} from '../utils/async-utils'

// Types
import type { RetryConfig, TimeoutConfig } from '../types'
```

## Error Serialization

```typescript
// Get JSON for logging
const errorData = error.toJSON()

// Log to service
logger.error({
  ...errorData,
  service: 'adapter',
  version: '1.0.0',
})

// Get detailed string for console
console.error(error.toDetailedString())

// Format any error
console.error(formatError(error, true)) // with stack
console.error(formatError(error, false)) // without stack
```

## Common Predicates

```typescript
// Should retry on transient errors
shouldRetry: isTransientError

// Should retry on timeout only
shouldRetry: (error) => isTimeoutError(error)

// Should retry on network only
shouldRetry: (error) => isNetworkError(error)

// Should retry on specific error codes
shouldRetry: (error) => {
  if (error instanceof Error) {
    return error.message.includes('ECONNREFUSED') ||
           error.message.includes('ETIMEDOUT')
  }
  return false
}

// Should retry with attempt limit
shouldRetry: (error, attempt) => {
  return isTransientError(error) && attempt <= 3
}
```

## Configuration Examples

```typescript
// Adapter with retry and timeout
const adapter = new ClaudeCodeCLIAdapter({
  cwd: '/path/to/project',
  retry: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    exponentialBackoff: true,
  },
  timeouts: {
    toolExecutionTimeoutMs: 30000,
    llmInvocationTimeoutMs: 60000,
    terminalCommandTimeoutMs: 30000,
  },
})

// Terminal with retry
const terminal = createTerminalTools(
  '/path/to/project',
  { NODE_ENV: 'production' },
  { maxRetries: 5, exponentialBackoff: true }
)

// Per-command retry
await terminal.runTerminalCommand({
  command: 'npm install',
  retry: true,
  retryConfig: { maxRetries: 5 },
})
```

## Testing Patterns

```typescript
import { ValidationError, ToolExecutionError } from '../errors'

describe('YourTool', () => {
  it('validates input', async () => {
    await expect(
      tool.method({ invalid: 'input' })
    ).rejects.toThrow(ValidationError)
  })

  it('wraps errors', async () => {
    try {
      await tool.method({ valid: 'input' })
      fail('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ToolExecutionError)
      expect(error.toolName).toBe('expected_name')
      expect(error.toolInput).toEqual({ valid: 'input' })
      expect(error.originalError).toBeDefined()
    }
  })

  it('includes context', async () => {
    try {
      await tool.method({ valid: 'input' })
    } catch (error) {
      expect(error.context).toBeDefined()
      expect(error.context.toolName).toBe('expected_name')
      expect(error.timestamp).toBeInstanceOf(Date)
    }
  })
})
```

## Common Mistakes to Avoid

❌ **Don't do this:**
```typescript
// Silently swallowing errors
try {
  await operation()
} catch (error) {
  // Nothing - error lost!
}

// Returning error in success path
catch (error) {
  return [{ type: 'json', value: { error: error.message } }]
}

// Losing error context
catch (error) {
  throw new Error('Failed') // Original error lost!
}

// Not validating input
async method(input: any) {
  const result = await doSomething(input.field) // Could be undefined!
}
```

✅ **Do this instead:**
```typescript
// Log and rethrow
try {
  await operation()
} catch (error) {
  console.error('Operation failed:', error)
  throw error
}

// Throw proper error
catch (error) {
  throw new ToolExecutionError('Failed', {
    toolName: 'my_tool',
    toolInput: input,
    originalError: error instanceof Error ? error : new Error(String(error)),
  })
}

// Preserve error context
catch (error) {
  throw new ToolExecutionError('Operation failed', {
    toolName: 'my_tool',
    toolInput: input,
    originalError: error instanceof Error ? error : new Error(String(error)),
    context: { additionalInfo: 'value' },
  })
}

// Validate input first
async method(input: any) {
  if (!input.field) {
    throw new ValidationError('Missing field', {
      field: 'field',
      value: input.field,
      reason: 'Required parameter',
    })
  }
  const result = await doSomething(input.field)
}
```

## Checklist for Each Method

- [ ] Import necessary error classes
- [ ] Validate all input parameters
- [ ] Throw `ValidationError` for invalid input
- [ ] Wrap operations in try-catch
- [ ] Throw appropriate error type (ToolExecutionError, LLMExecutionError, etc.)
- [ ] Include tool/operation name in error
- [ ] Include input in error context
- [ ] Preserve original error
- [ ] Add `@throws` JSDoc tags
- [ ] Log errors before throwing (when appropriate)
- [ ] Write tests for error cases

## Quick Links

- Full Documentation: `/home/user/codebuff/adapter/docs/ERROR_HANDLING_SUMMARY.md`
- Implementation Guide: `/home/user/codebuff/adapter/docs/ERROR_HANDLING_IMPLEMENTATION_GUIDE.md`
- Error Classes Source: `/home/user/codebuff/adapter/src/errors.ts`
- Async Utils Source: `/home/user/codebuff/adapter/src/utils/async-utils.ts`
