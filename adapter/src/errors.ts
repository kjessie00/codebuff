/**
 * Custom Error Classes for Claude CLI Adapter
 *
 * Provides a hierarchy of error types with context information for debugging
 * and recovery. All errors include timestamp, agent context, and original error
 * details for comprehensive error tracking and logging.
 *
 * @module errors
 */

/**
 * Base error class for all adapter errors
 *
 * Provides common error context that all adapter errors should include:
 * - timestamp: When the error occurred
 * - agentId: Which agent was executing (if applicable)
 * - originalError: The underlying error that caused this error
 * - context: Additional context specific to the error
 *
 * @example
 * ```typescript
 * throw new AdapterError(
 *   'Failed to process agent execution',
 *   {
 *     agentId: 'file-picker',
 *     context: { step: 'initialization' },
 *     originalError: err
 *   }
 * )
 * ```
 */
export class AdapterError extends Error {
  /** When the error occurred */
  public readonly timestamp: Date

  /** Agent ID that was executing when error occurred (if applicable) */
  public readonly agentId?: string

  /** Original error that caused this error (if applicable) */
  public readonly originalError?: Error

  /** Additional context about the error */
  public readonly context?: Record<string, any>

  /** Stack trace from the original error */
  public readonly originalStack?: string

  /**
   * Create a new AdapterError
   *
   * @param message - Error message
   * @param options - Error options including agentId, originalError, context
   */
  constructor(
    message: string,
    options?: {
      agentId?: string
      originalError?: Error | unknown
      context?: Record<string, any>
    }
  ) {
    super(message)
    this.name = 'AdapterError'
    this.timestamp = new Date()
    this.agentId = options?.agentId
    this.context = options?.context

    // Capture original error details
    if (options?.originalError) {
      if (options.originalError instanceof Error) {
        this.originalError = options.originalError
        this.originalStack = options.originalError.stack
      } else {
        // Convert non-Error values to Error
        this.originalError = new Error(String(options.originalError))
      }
    }

    // Maintain proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor)
  }

  /**
   * Convert error to JSON for logging/serialization
   *
   * @returns JSON representation of the error
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      agentId: this.agentId,
      context: this.context,
      stack: this.stack,
      originalError: this.originalError
        ? {
            name: this.originalError.name,
            message: this.originalError.message,
            stack: this.originalStack,
          }
        : undefined,
    }
  }

  /**
   * Get a detailed error message including context
   *
   * @returns Detailed error message
   */
  toDetailedString(): string {
    const parts: string[] = []

    parts.push(`[${this.name}] ${this.message}`)

    if (this.agentId) {
      parts.push(`  Agent: ${this.agentId}`)
    }

    parts.push(`  Time: ${this.timestamp.toISOString()}`)

    if (this.context) {
      parts.push(`  Context: ${JSON.stringify(this.context, null, 2)}`)
    }

    if (this.originalError) {
      parts.push(`  Caused by: ${this.originalError.message}`)
      if (this.originalStack) {
        parts.push(`  Original stack:\n${this.originalStack}`)
      }
    }

    return parts.join('\n')
  }
}

/**
 * Error thrown when a tool execution fails
 *
 * Includes tool-specific context like tool name and input parameters.
 * This helps diagnose which tool failed and why.
 *
 * @example
 * ```typescript
 * throw new ToolExecutionError(
 *   'Failed to read file',
 *   {
 *     toolName: 'read_files',
 *     agentId: 'file-picker',
 *     context: { paths: ['missing.txt'] },
 *     originalError: err
 *   }
 * )
 * ```
 */
export class ToolExecutionError extends AdapterError {
  /** Name of the tool that failed */
  public readonly toolName: string

  /** Input that was provided to the tool */
  public readonly toolInput?: any

  /**
   * Create a new ToolExecutionError
   *
   * @param message - Error message
   * @param options - Error options including toolName and toolInput
   */
  constructor(
    message: string,
    options: {
      toolName: string
      toolInput?: any
      agentId?: string
      originalError?: Error | unknown
      context?: Record<string, any>
    }
  ) {
    super(message, {
      agentId: options.agentId,
      originalError: options.originalError,
      context: {
        ...options.context,
        toolName: options.toolName,
        toolInput: options.toolInput,
      },
    })
    this.name = 'ToolExecutionError'
    this.toolName = options.toolName
    this.toolInput = options.toolInput
  }

  /**
   * Convert error to JSON for logging/serialization
   *
   * @returns JSON representation of the error
   */
  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      toolName: this.toolName,
      toolInput: this.toolInput,
    }
  }
}

/**
 * Error thrown when LLM invocation fails
 *
 * Captures details about the LLM call that failed, including system prompt,
 * message count, and available tools. Useful for debugging LLM integration issues.
 *
 * @example
 * ```typescript
 * throw new LLMExecutionError(
 *   'Claude API timeout',
 *   {
 *     agentId: 'code-reviewer',
 *     context: {
 *       systemPromptLength: 1500,
 *       messageCount: 10,
 *       toolCount: 5
 *     },
 *     originalError: apiError
 *   }
 * )
 * ```
 */
export class LLMExecutionError extends AdapterError {
  /** System prompt that was used (truncated for logging) */
  public readonly systemPromptSnippet?: string

  /** Number of messages in the conversation */
  public readonly messageCount?: number

  /** Tools that were available for the LLM */
  public readonly availableTools?: string[]

  /**
   * Create a new LLMExecutionError
   *
   * @param message - Error message
   * @param options - Error options including LLM context
   */
  constructor(
    message: string,
    options: {
      agentId?: string
      systemPrompt?: string
      messageCount?: number
      availableTools?: string[]
      originalError?: Error | unknown
      context?: Record<string, any>
    }
  ) {
    super(message, {
      agentId: options.agentId,
      originalError: options.originalError,
      context: {
        ...options.context,
        messageCount: options.messageCount,
        availableTools: options.availableTools,
      },
    })
    this.name = 'LLMExecutionError'
    this.messageCount = options.messageCount
    this.availableTools = options.availableTools

    // Truncate system prompt for logging (don't store full prompt in error)
    if (options.systemPrompt) {
      this.systemPromptSnippet =
        options.systemPrompt.length > 200
          ? options.systemPrompt.substring(0, 200) + '...'
          : options.systemPrompt
    }
  }

  /**
   * Convert error to JSON for logging/serialization
   *
   * @returns JSON representation of the error
   */
  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      systemPromptSnippet: this.systemPromptSnippet,
      messageCount: this.messageCount,
      availableTools: this.availableTools,
    }
  }
}

/**
 * Error thrown when input validation fails
 *
 * Captures details about what validation failed and why. Helps users
 * understand what they need to fix in their input.
 *
 * @example
 * ```typescript
 * throw new ValidationError(
 *   'Invalid file path',
 *   {
 *     field: 'path',
 *     value: '../../../etc/passwd',
 *     reason: 'Path traversal detected',
 *     toolName: 'read_files'
 *   }
 * )
 * ```
 */
export class ValidationError extends AdapterError {
  /** Name of the field that failed validation */
  public readonly field?: string

  /** Value that failed validation */
  public readonly value?: any

  /** Reason why validation failed */
  public readonly reason?: string

  /** Tool or operation that was being validated */
  public readonly operation?: string

  /**
   * Create a new ValidationError
   *
   * @param message - Error message
   * @param options - Validation error options
   */
  constructor(
    message: string,
    options?: {
      field?: string
      value?: any
      reason?: string
      toolName?: string
      agentId?: string
      context?: Record<string, any>
    }
  ) {
    super(message, {
      agentId: options?.agentId,
      context: {
        ...options?.context,
        field: options?.field,
        value: options?.value,
        reason: options?.reason,
      },
    })
    this.name = 'ValidationError'
    this.field = options?.field
    this.value = options?.value
    this.reason = options?.reason
    this.operation = options?.toolName
  }

  /**
   * Convert error to JSON for logging/serialization
   *
   * @returns JSON representation of the error
   */
  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      field: this.field,
      value: this.value,
      reason: this.reason,
      operation: this.operation,
    }
  }
}

/**
 * Error thrown when an operation times out
 *
 * Includes information about the timeout duration and what operation timed out.
 *
 * @example
 * ```typescript
 * throw new TimeoutError(
 *   'Terminal command timed out',
 *   {
 *     operation: 'run_terminal_command',
 *     timeoutMs: 30000,
 *     agentId: 'build-runner',
 *     context: { command: 'npm test' }
 *   }
 * )
 * ```
 */
export class TimeoutError extends AdapterError {
  /** Timeout duration in milliseconds */
  public readonly timeoutMs: number

  /** Operation that timed out */
  public readonly operation?: string

  /**
   * Create a new TimeoutError
   *
   * @param message - Error message
   * @param options - Timeout error options
   */
  constructor(
    message: string,
    options: {
      timeoutMs: number
      operation?: string
      agentId?: string
      originalError?: Error | unknown
      context?: Record<string, any>
    }
  ) {
    super(message, {
      agentId: options.agentId,
      originalError: options.originalError,
      context: {
        ...options.context,
        timeoutMs: options.timeoutMs,
        operation: options.operation,
      },
    })
    this.name = 'TimeoutError'
    this.timeoutMs = options.timeoutMs
    this.operation = options.operation
  }

  /**
   * Convert error to JSON for logging/serialization
   *
   * @returns JSON representation of the error
   */
  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      timeoutMs: this.timeoutMs,
      operation: this.operation,
    }
  }
}

/**
 * Error thrown when an agent is not found in the registry
 *
 * @example
 * ```typescript
 * throw new AgentNotFoundError('file-picker', {
 *   availableAgents: ['code-reviewer', 'thinker'],
 *   parentAgentId: 'orchestrator'
 * })
 * ```
 */
export class AgentNotFoundError extends AdapterError {
  /** Agent ID that was not found */
  public readonly requestedAgentId: string

  /** List of available agent IDs */
  public readonly availableAgents?: string[]

  /**
   * Create a new AgentNotFoundError
   *
   * @param agentId - Agent ID that was not found
   * @param options - Error options
   */
  constructor(
    agentId: string,
    options?: {
      availableAgents?: string[]
      parentAgentId?: string
      context?: Record<string, any>
    }
  ) {
    super(`Agent not found in registry: ${agentId}`, {
      agentId: options?.parentAgentId,
      context: {
        ...options?.context,
        requestedAgentId: agentId,
        availableAgents: options?.availableAgents,
      },
    })
    this.name = 'AgentNotFoundError'
    this.requestedAgentId = agentId
    this.availableAgents = options?.availableAgents
  }

  /**
   * Convert error to JSON for logging/serialization
   *
   * @returns JSON representation of the error
   */
  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      requestedAgentId: this.requestedAgentId,
      availableAgents: this.availableAgents,
    }
  }
}

/**
 * Type guard to check if an error is an AdapterError
 *
 * @param error - Error to check
 * @returns True if error is an AdapterError
 *
 * @example
 * ```typescript
 * try {
 *   await executeAgent(...)
 * } catch (err) {
 *   if (isAdapterError(err)) {
 *     console.log('Agent error:', err.toDetailedString())
 *   }
 * }
 * ```
 */
export function isAdapterError(error: unknown): error is AdapterError {
  return error instanceof AdapterError
}

/**
 * Type guard to check if an error is a ToolExecutionError
 *
 * @param error - Error to check
 * @returns True if error is a ToolExecutionError
 */
export function isToolExecutionError(error: unknown): error is ToolExecutionError {
  return error instanceof ToolExecutionError
}

/**
 * Type guard to check if an error is an LLMExecutionError
 *
 * @param error - Error to check
 * @returns True if error is an LLMExecutionError
 */
export function isLLMExecutionError(error: unknown): error is LLMExecutionError {
  return error instanceof LLMExecutionError
}

/**
 * Type guard to check if an error is a ValidationError
 *
 * @param error - Error to check
 * @returns True if error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError
}

/**
 * Type guard to check if an error is a TimeoutError
 *
 * @param error - Error to check
 * @returns True if error is a TimeoutError
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError
}

/**
 * Type guard to check if an error is an AgentNotFoundError
 *
 * @param error - Error to check
 * @returns True if error is an AgentNotFoundError
 */
export function isAgentNotFoundError(error: unknown): error is AgentNotFoundError {
  return error instanceof AgentNotFoundError
}

/**
 * Format any error into a user-friendly string
 *
 * Handles AdapterError instances specially to include context,
 * and falls back to basic formatting for other error types.
 *
 * @param error - Error to format
 * @param includeStack - Whether to include stack trace (default: false)
 * @returns Formatted error message
 *
 * @example
 * ```typescript
 * try {
 *   await executeAgent(...)
 * } catch (err) {
 *   console.error(formatError(err, true))
 * }
 * ```
 */
export function formatError(error: unknown, includeStack: boolean = false): string {
  if (isAdapterError(error)) {
    return includeStack ? error.toDetailedString() : error.message
  }

  if (error instanceof Error) {
    const parts: string[] = [error.message]
    if (includeStack && error.stack) {
      parts.push(error.stack)
    }
    return parts.join('\n')
  }

  if (typeof error === 'string') {
    return error
  }

  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }

  return 'Unknown error occurred'
}

/**
 * Wrap an async function with error context
 *
 * Automatically catches errors and wraps them in AdapterError with context.
 *
 * @param fn - Function to wrap
 * @param context - Context to add to any errors
 * @returns Wrapped function
 *
 * @example
 * ```typescript
 * const safeExecute = withErrorContext(
 *   async () => await tool.execute(input),
 *   { toolName: 'read_files', agentId: 'file-picker' }
 * )
 *
 * try {
 *   await safeExecute()
 * } catch (err) {
 *   // Error will include context from wrapper
 * }
 * ```
 */
export function withErrorContext<T>(
  fn: () => Promise<T>,
  context: {
    agentId?: string
    operation?: string
    context?: Record<string, any>
  }
): () => Promise<T> {
  return async () => {
    try {
      return await fn()
    } catch (error) {
      // If it's already an AdapterError, re-throw it
      if (isAdapterError(error)) {
        throw error
      }

      // Wrap in AdapterError with context
      throw new AdapterError(
        `${context.operation || 'Operation'} failed: ${formatError(error)}`,
        {
          agentId: context.agentId,
          originalError: error instanceof Error ? error : new Error(String(error)),
          context: context.context,
        }
      )
    }
  }
}
