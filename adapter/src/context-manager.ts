/**
 * Context Manager for Claude CLI Adapter
 *
 * Manages execution contexts for agents, tracking message history, state,
 * and relationships between parent and child agent executions.
 *
 * Execution contexts maintain:
 * - Unique agent IDs for tracking
 * - Parent-child relationships for nested agents
 * - Message history for LLM continuity
 * - Steps remaining to prevent infinite loops
 * - Output values from agent execution
 *
 * @module context-manager
 */

import type { Message, AgentState } from '../../.agents/types/util-types'
import type { AgentExecutionContext } from './types'
import { DEFAULT_MAX_STEPS, ID_RANDOM_LENGTH } from './utils/constants'

/**
 * Configuration for ContextManager
 */
export interface ContextManagerConfig {
  /** Maximum number of steps per agent execution */
  maxSteps?: number

  /** Enable debug logging */
  debug?: boolean

  /** Logger function */
  logger?: (message: string) => void
}

/**
 * Context Manager
 *
 * Provides centralized management of execution contexts for agent runs.
 * Handles context creation, lifecycle tracking, and cleanup.
 *
 * Each execution context represents a single agent execution and maintains
 * its own state independently. Nested agents create child contexts that
 * reference their parent context.
 *
 * @example
 * ```typescript
 * const manager = new ContextManager({ maxSteps: 20 })
 *
 * // Create a new context
 * const context = manager.createContext('prompt')
 * manager.registerContext(context)
 *
 * // Use context during execution...
 *
 * // Clean up when done
 * manager.unregisterContext(context.agentId)
 * ```
 */
export class ContextManager {
  private readonly config: Required<ContextManagerConfig>
  private readonly contexts: Map<string, AgentExecutionContext> = new Map()

  /**
   * Create a new ContextManager
   *
   * @param config - Manager configuration
   */
  constructor(config: ContextManagerConfig = {}) {
    this.config = {
      maxSteps: config.maxSteps ?? DEFAULT_MAX_STEPS,
      debug: config.debug ?? false,
      logger: config.logger ?? this.defaultLogger,
    }
  }

  /**
   * Create a new execution context
   *
   * Creates a fresh context for an agent execution. If a parent context
   * is provided, the new context inherits the parent's message history
   * (for conversation continuity) and establishes the parent-child relationship.
   *
   * @param prompt - User prompt (optional)
   * @param parentContext - Parent execution context (for nested agents)
   * @returns New execution context
   *
   * @example
   * ```typescript
   * // Create root context
   * const rootContext = manager.createContext('Find all TypeScript files')
   *
   * // Create child context (for nested agent)
   * const childContext = manager.createContext('Review file', rootContext)
   * ```
   */
  createContext(
    prompt?: string,
    parentContext?: AgentExecutionContext
  ): AgentExecutionContext {
    const context: AgentExecutionContext = {
      agentId: this.generateId(),
      parentId: parentContext?.agentId,
      messageHistory: parentContext ? [...parentContext.messageHistory] : [],
      stepsRemaining: this.config.maxSteps,
      output: undefined,
    }

    this.log(`Created context: ${context.agentId}`, {
      parentId: context.parentId,
      hasPrompt: !!prompt,
    })

    return context
  }

  /**
   * Register a context for tracking
   *
   * Adds the context to the active contexts map. This allows the manager
   * to track all active executions and provide debugging information.
   *
   * @param context - Context to register
   *
   * @example
   * ```typescript
   * const context = manager.createContext('prompt')
   * manager.registerContext(context)
   * ```
   */
  registerContext(context: AgentExecutionContext): void {
    this.contexts.set(context.agentId, context)
    this.log(`Registered context: ${context.agentId}`)
  }

  /**
   * Unregister a context
   *
   * Removes the context from tracking. Should be called when an agent
   * execution completes to prevent memory leaks.
   *
   * @param agentId - ID of context to unregister
   *
   * @example
   * ```typescript
   * try {
   *   // Execute agent...
   * } finally {
   *   manager.unregisterContext(context.agentId)
   * }
   * ```
   */
  unregisterContext(agentId: string): void {
    const removed = this.contexts.delete(agentId)
    if (removed) {
      this.log(`Unregistered context: ${agentId}`)
    }
  }

  /**
   * Get a context by ID
   *
   * @param agentId - Agent ID to look up
   * @returns Context if found, undefined otherwise
   */
  getContext(agentId: string): AgentExecutionContext | undefined {
    return this.contexts.get(agentId)
  }

  /**
   * Get all active contexts
   *
   * Useful for debugging or monitoring active agent executions.
   *
   * @returns Map of agent IDs to contexts
   *
   * @example
   * ```typescript
   * const active = manager.getActiveContexts()
   * console.log(`${active.size} agents currently executing`)
   * ```
   */
  getActiveContexts(): Map<string, AgentExecutionContext> {
    return new Map(this.contexts)
  }

  /**
   * Get count of active contexts
   *
   * @returns Number of currently active contexts
   */
  getActiveCount(): number {
    return this.contexts.size
  }

  /**
   * Check if a context is registered
   *
   * @param agentId - Agent ID to check
   * @returns True if context is active
   */
  hasContext(agentId: string): boolean {
    return this.contexts.has(agentId)
  }

  /**
   * Convert execution context to agent state
   *
   * Transforms the internal context representation to the AgentState
   * format used by the agent definition system.
   *
   * @param context - Execution context to convert
   * @returns Agent state
   *
   * @example
   * ```typescript
   * const agentState = manager.toAgentState(context)
   * // Can be passed to handleSteps generator
   * ```
   */
  toAgentState(context: AgentExecutionContext): AgentState {
    return {
      agentId: context.agentId,
      runId: this.generateId(),
      parentId: context.parentId,
      messageHistory: context.messageHistory,
      output: context.output,
    }
  }

  /**
   * Decrement steps remaining for a context
   *
   * Decrements the step counter and returns whether steps remain.
   * Prevents agents from exceeding their step limit.
   *
   * @param context - Context to update
   * @returns True if steps remain, false if limit reached
   *
   * @example
   * ```typescript
   * while (manager.decrementSteps(context)) {
   *   // Execute next step...
   * }
   * ```
   */
  decrementSteps(context: AgentExecutionContext): boolean {
    if (context.stepsRemaining > 0) {
      context.stepsRemaining--
      return true
    }
    return false
  }

  /**
   * Reset steps remaining to maximum
   *
   * Useful if you need to give an agent more steps during execution.
   *
   * @param context - Context to reset
   */
  resetSteps(context: AgentExecutionContext): void {
    context.stepsRemaining = this.config.maxSteps
    this.log(`Reset steps for context: ${context.agentId}`)
  }

  /**
   * Add a message to context history
   *
   * Appends a message to the context's message history.
   *
   * @param context - Context to update
   * @param message - Message to add
   *
   * @example
   * ```typescript
   * manager.addMessage(context, {
   *   role: 'user',
   *   content: 'Find all TypeScript files'
   * })
   * ```
   */
  addMessage(context: AgentExecutionContext, message: Message): void {
    context.messageHistory.push(message)
  }

  /**
   * Add multiple messages to context history
   *
   * @param context - Context to update
   * @param messages - Messages to add
   */
  addMessages(context: AgentExecutionContext, messages: Message[]): void {
    context.messageHistory.push(...messages)
  }

  /**
   * Clear message history
   *
   * Removes all messages from the context. Use with caution as this
   * breaks conversation continuity.
   *
   * @param context - Context to clear
   */
  clearMessages(context: AgentExecutionContext): void {
    context.messageHistory = []
    this.log(`Cleared messages for context: ${context.agentId}`)
  }

  /**
   * Set output value for a context
   *
   * @param context - Context to update
   * @param output - Output value to set
   */
  setOutput(context: AgentExecutionContext, output: any): void {
    context.output = output
  }

  /**
   * Get output value from a context
   *
   * @param context - Context to read from
   * @returns Output value
   */
  getOutput(context: AgentExecutionContext): any {
    return context.output
  }

  /**
   * Get nesting depth of a context
   *
   * Calculates how many levels deep this context is in the
   * parent-child hierarchy.
   *
   * @param context - Context to check
   * @returns Nesting depth (0 for root contexts)
   *
   * @example
   * ```typescript
   * const depth = manager.getNestingDepth(context)
   * if (depth > 5) {
   *   console.warn('Deep nesting detected')
   * }
   * ```
   */
  getNestingDepth(context: AgentExecutionContext): number {
    let depth = 0
    let currentContext: AgentExecutionContext | undefined = context

    while (currentContext?.parentId) {
      depth++
      currentContext = this.contexts.get(currentContext.parentId)
    }

    return depth
  }

  /**
   * Clear all contexts
   *
   * Removes all tracked contexts. Useful for cleanup or testing.
   */
  clearAll(): void {
    const count = this.contexts.size
    this.contexts.clear()
    this.log(`Cleared all contexts (${count} total)`)
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Generate a unique ID
   *
   * Generates a unique identifier using timestamp and random string.
   * Format: {timestamp}-{randomString}
   *
   * @returns Unique ID string
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 2 + ID_RANDOM_LENGTH)}`
  }

  /**
   * Log a message
   *
   * @param message - Log message
   * @param data - Optional data to include
   */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      const prefix = '[ContextManager]'
      if (data !== undefined) {
        this.config.logger(`${prefix} ${message}: ${JSON.stringify(data)}`)
      } else {
        this.config.logger(`${prefix} ${message}`)
      }
    }
  }

  /**
   * Default logger implementation
   */
  private defaultLogger = (message: string): void => {
    console.log(message)
  }

  /**
   * Get configuration
   *
   * @returns Current configuration
   */
  getConfig(): Readonly<Required<ContextManagerConfig>> {
    return { ...this.config }
  }
}
