/**
 * Claude Code CLI Adapter - Type Definitions
 *
 * This module provides TypeScript type definitions for the Claude Code CLI adapter,
 * enabling seamless integration between Codebuff's agent definitions and Claude Code CLI tools.
 *
 * Based on: CLAUDE_CLI_ADAPTER_GUIDE.md section "핵심 어댑터 설계 > 기본 타입 정의"
 * Compatible with: .agents/types/agent-definition.ts
 *
 * @module adapter/types
 */

import type { AgentDefinition, AgentState, ToolCall } from '../.agents/types/agent-definition'
import type { Message, ToolResultOutput, Logger } from '../.agents/types/util-types'

/**
 * Result object returned from executing a Claude Code CLI tool
 *
 * Represents the structured output from any Claude Code CLI tool execution,
 * including file operations, code search, terminal commands, etc.
 *
 * @example
 * ```typescript
 * const result: ClaudeToolResult = {
 *   type: 'json',
 *   content: { success: true, path: '/path/to/file.ts' }
 * }
 *
 * const textResult: ClaudeToolResult = {
 *   type: 'text',
 *   content: '$ git status\nOn branch main\n...'
 * }
 * ```
 */
export interface ClaudeToolResult {
  /**
   * Type of the result content
   * - 'text': Plain text output (terminal commands, logs, etc.)
   * - 'json': Structured JSON response (file reads, search results, etc.)
   * - 'error': Error occurred during tool execution
   */
  type: 'text' | 'json' | 'error'

  /**
   * The actual result content
   * - For 'text' type: Raw output string
   * - For 'json' type: Structured object or array
   * - For 'error' type: Error message string or error details object
   */
  content: string | Record<string, any>
}

/**
 * Configuration object for initializing the Claude Code CLI adapter
 *
 * Configures the adapter's behavior, including working directory, environment,
 * execution limits, and debugging options.
 *
 * @example
 * ```typescript
 * const config: AdapterConfig = {
 *   cwd: '/home/user/project',
 *   env: { NODE_ENV: 'production' },
 *   maxSteps: 50,
 *   debug: true,
 *   logger: (msg) => console.log(`[Adapter] ${msg}`)
 * }
 * ```
 */
export interface AdapterConfig {
  /**
   * Working directory for all operations
   *
   * This is the base directory where the adapter will perform file operations,
   * run terminal commands, and search for files. All relative paths are resolved
   * from this directory.
   *
   * @example '/home/user/project' or process.cwd()
   */
  cwd: string

  /**
   * Environment variables to inject into tool execution contexts
   *
   * These variables will be merged with the current process environment
   * and passed to terminal commands and other tools that need environment
   * variables (e.g., git operations, npm commands, etc.).
   *
   * @example { NODE_ENV: 'production', DEBUG: 'true' }
   */
  env?: Record<string, string>

  /**
   * Maximum number of steps to execute before timeout
   *
   * Prevents infinite loops in agent execution by limiting the number of
   * generator iterations. Each tool call, STEP, or STEP_ALL counts as one step.
   *
   * @default 20
   * @example 50 for more complex workflows
   */
  maxSteps?: number

  /**
   * Enable debug mode logging
   *
   * When true, additional debug information will be logged via the logger function,
   * including detailed tool call information, intermediate results, and state changes.
   *
   * @default false
   */
  debug?: boolean

  /**
   * Custom logging function
   *
   * Called to log messages from the adapter. If not provided, logs are discarded.
   * Use this to integrate with your logging system.
   *
   * @example (msg) => console.log(msg)
   * @example (msg) => logger.info(msg)
   */
  logger?: (message: string) => void

  /**
   * Maximum time in milliseconds to wait for a tool execution
   *
   * Individual tool calls (like file operations or terminal commands) will timeout
   * if they take longer than this duration. Set to -1 for no timeout.
   *
   * @default 30000 (30 seconds)
   */
  toolTimeout?: number

  /**
   * Enable strict mode for type checking and validation
   *
   * When true, the adapter will perform additional validation on tool inputs
   * and outputs, and throw errors for unexpected types or missing required fields.
   *
   * @default false
   */
  strictMode?: boolean
}

/**
 * Execution context for a running agent
 *
 * Tracks the state and history of a single agent execution, including
 * conversation history, remaining steps, and output.
 *
 * @example
 * ```typescript
 * const context: AgentExecutionContext = {
 *   agentId: 'unique-id-123',
 *   parentId: undefined,
 *   messageHistory: [
 *     { role: 'user', content: 'Find all TypeScript files' },
 *     { role: 'assistant', content: 'I will search for TypeScript files...' }
 *   ],
 *   stepsRemaining: 18,
 *   output: { files: ['file1.ts', 'file2.ts'] }
 * }
 * ```
 */
export interface AgentExecutionContext {
  /**
   * Unique identifier for this agent execution
   *
   * Generated when the agent starts execution. Used to track the execution
   * context across multiple tool calls and LLM steps.
   *
   * @example 'agent-run-550e8400-e29b-41d4-a716-446655440000'
   */
  agentId: string

  /**
   * ID of the parent agent, if this agent was spawned by another agent
   *
   * Used to track the agent hierarchy when agents spawn sub-agents via
   * the spawn_agents tool. Undefined for root agents.
   *
   * @example 'orchestrator-run-550e8400-e29b-41d4-a716-446655440000'
   */
  parentId?: string

  /**
   * Conversation message history
   *
   * Maintains the complete conversation between the user and the agent,
   * including all messages and tool results. Essential for context maintenance
   * across multiple steps.
   *
   * Structure: Array of messages with 'user' or 'assistant' roles
   */
  messageHistory: Array<{
    /** Role of the message sender */
    role: 'user' | 'assistant'
    /** Content of the message */
    content: string
  }>

  /**
   * Number of steps remaining before reaching the maxSteps limit
   *
   * Decremented with each tool execution or LLM step. When this reaches zero,
   * agent execution stops to prevent infinite loops.
   *
   * @example 18 (out of original 20)
   */
  stepsRemaining: number

  /**
   * Output set by the agent
   *
   * Can be set via the set_output tool or from handleSteps generator.
   * This is what gets returned to the parent agent or user.
   *
   * @example { success: true, results: [...] }
   */
  output?: Record<string, any>

  /**
   * Start time of this execution
   *
   * Timestamp when the agent started executing. Useful for tracking execution
   * duration and performance metrics.
   *
   * @internal
   */
  startTime?: number

  /**
   * Error encountered during execution (if any)
   *
   * If an error occurs during execution, it's stored here for debugging
   * and error handling purposes.
   *
   * @internal
   */
  error?: Error | null
}

/**
 * Enhanced agent execution context with additional runtime information
 *
 * Extends AgentExecutionContext with adapter-specific runtime state,
 * used internally by the adapter for managing execution flow.
 *
 * @internal
 */
export interface AdapterExecutionContext extends AgentExecutionContext {
  /**
   * Reference to the agent definition being executed
   *
   * @internal
   */
  agentDefinition: AgentDefinition

  /**
   * Tool results from the last execution step
   *
   * Passed to the next generator iteration to allow the handleSteps
   * function to work with tool results.
   *
   * @internal
   */
  lastToolResult?: ToolResultOutput[]

  /**
   * Whether the agent's work is complete
   *
   * Set to true when the agent calls end_turn or when handleSteps returns.
   * Used to determine if the execution loop should continue.
   *
   * @internal
   */
  stepsComplete?: boolean
}

/**
 * Parameters for initializing a new agent execution
 *
 * Used when starting a new agent run via executeAgent method.
 *
 * @example
 * ```typescript
 * const params: ExecuteAgentParams = {
 *   agentDefinition: myAgent,
 *   prompt: 'Find and review TypeScript files',
 *   params: { pattern: '**\/*.ts' },
 *   parentContext: parentAgentContext
 * }
 * ```
 */
export interface ExecuteAgentParams {
  /**
   * The agent definition to execute
   */
  agentDefinition: AgentDefinition

  /**
   * User prompt for the agent
   *
   * Describes what the user wants the agent to do.
   *
   * @example 'Find all TypeScript files with TODO comments'
   */
  prompt: string

  /**
   * Input parameters for the agent
   *
   * Used by handleSteps to customize behavior. Structure depends on
   * the agent's input schema.
   *
   * @example { pattern: '**\/*.ts', keyword: 'TODO' }
   */
  params?: Record<string, any>

  /**
   * Parent execution context if this agent is spawned
   *
   * When an agent spawns sub-agents via spawn_agents tool,
   * the parent context is passed to establish hierarchy.
   *
   * @internal
   */
  parentContext?: AgentExecutionContext
}

/**
 * Result from executing an agent
 *
 * Contains the final output and message history from agent execution.
 *
 * @example
 * ```typescript
 * const result: ExecuteAgentResult = {
 *   output: { files: ['src/index.ts', 'src/utils.ts'] },
 *   messageHistory: [
 *     { role: 'user', content: '...' },
 *     { role: 'assistant', content: '...' }
 *   ],
 *   context: agentExecutionContext
 * }
 * ```
 */
export interface ExecuteAgentResult {
  /**
   * The final output from the agent
   *
   * Set via set_output tool or returned from handleSteps.
   * If no output was set, this will be the final message content.
   *
   * @example { success: true, fileCount: 2 }
   */
  output: Record<string, any> | string | undefined

  /**
   * Complete message history from the execution
   *
   * All messages exchanged during the agent run, useful for
   * auditing, logging, or displaying conversation history.
   */
  messageHistory: Array<{ role: 'user' | 'assistant'; content: string }>

  /**
   * The execution context that tracked this run
   *
   * Contains metadata about the execution, including timing, steps used, etc.
   *
   * @internal
   */
  context: AgentExecutionContext
}

/**
 * Tool execution result from the adapter
 *
 * Internal representation of tool execution, mapped from Claude Code CLI tool results.
 *
 * @internal
 */
export interface ToolExecutionResult {
  /**
   * Was the tool execution successful?
   */
  success: boolean

  /**
   * The output from the tool
   */
  output: ToolResultOutput[]

  /**
   * Error message if execution failed
   */
  error?: Error | string
}

/**
 * Agent execution statistics
 *
 * Performance and usage metrics from an agent execution.
 *
 * @internal
 */
export interface ExecutionStats {
  /**
   * Total execution time in milliseconds
   */
  duration: number

  /**
   * Number of steps executed
   */
  stepsExecuted: number

  /**
   * Number of tool calls made
   */
  toolCallsCount: number

  /**
   * Number of LLM steps (STEP/STEP_ALL)
   */
  llmStepsCount: number

  /**
   * Tools that were used during execution
   */
  toolsUsed: string[]

  /**
   * Total tokens used (if available from LLM)
   */
  tokensUsed?: {
    input: number
    output: number
    total: number
  }
}

/**
 * Adapter event that can be emitted during execution
 *
 * For event-driven logging and monitoring.
 *
 * @internal
 */
export type AdapterEvent =
  | {
      type: 'agent-start'
      agentId: string
      agentName: string
      prompt: string
    }
  | {
      type: 'agent-end'
      agentId: string
      output: Record<string, any> | undefined
      stats: ExecutionStats
    }
  | {
      type: 'tool-call'
      agentId: string
      toolName: string
      input: Record<string, any>
    }
  | {
      type: 'tool-result'
      agentId: string
      toolName: string
      result: ToolResultOutput[]
      duration: number
    }
  | {
      type: 'step'
      agentId: string
      stepType: 'STEP' | 'STEP_ALL'
      messageCount: number
    }
  | {
      type: 'error'
      agentId: string
      error: Error
      context: string
    }

/**
 * Event handler for adapter events
 *
 * @internal
 */
export type AdapterEventListener = (event: AdapterEvent) => void

/**
 * Registry of available agents for spawning
 *
 * Maps agent IDs to their definitions for use with spawn_agents tool.
 *
 * @internal
 */
export type AgentRegistry = Map<string, AgentDefinition>

/**
 * Options for spawning sub-agents
 *
 * @internal
 */
export interface SpawnAgentOptions {
  /**
   * Whether to run agents in parallel or sequentially
   *
   * Claude Code CLI's Task tool supports only sequential execution,
   * but the adapter can run agents in parallel internally.
   *
   * @default 'sequential'
   */
  executionMode?: 'sequential' | 'parallel'

  /**
   * Timeout for each spawned agent in milliseconds
   *
   * @default inherits from AdapterConfig.toolTimeout
   */
  timeout?: number

  /**
   * Whether to include parent message history in spawned agents
   *
   * @default true
   */
  includeHistory?: boolean
}

/**
 * Cached execution context for performance optimization
 *
 * @internal
 */
export interface ExecutionCache {
  /**
   * LRU cache of agent execution contexts
   */
  contexts: Map<string, AgentExecutionContext>

  /**
   * Cache of tool results for reuse
   */
  toolResults: Map<string, ToolResultOutput[]>

  /**
   * Cache size limit
   */
  maxSize: number

  /**
   * Clear cache entries
   */
  clear(): void
}

/**
 * Type guard to check if an object is a valid ClaudeToolResult
 *
 * @internal
 */
export function isClaudeToolResult(obj: any): obj is ClaudeToolResult {
  return (
    obj &&
    typeof obj === 'object' &&
    ('type' in obj) &&
    ['text', 'json', 'error'].includes(obj.type) &&
    'content' in obj
  )
}

/**
 * Type guard to check if an object is a valid ToolCall
 *
 * @internal
 */
export function isToolCall(obj: any): obj is ToolCall {
  return obj && typeof obj === 'object' && 'toolName' in obj && 'input' in obj
}

/**
 * Type guard to check if a value is a step command
 *
 * @internal
 */
export function isStepCommand(value: any): value is 'STEP' | 'STEP_ALL' {
  return value === 'STEP' || value === 'STEP_ALL'
}

/**
 * Type guard to check if a value is a STEP_TEXT command
 *
 * @internal
 */
export function isStepText(obj: any): obj is { type: 'STEP_TEXT'; text: string } {
  return (
    obj &&
    typeof obj === 'object' &&
    obj.type === 'STEP_TEXT' &&
    typeof obj.text === 'string'
  )
}
