/**
 * Type definitions for Claude CLI Adapter
 *
 * Common types used across the adapter implementation
 */

import type { Message } from '../../.agents/types/util-types'

// ============================================================================
// Re-export Tool Parameter Types
// ============================================================================

export type {
  ReadFilesParams,
  WriteFileParams,
  StrReplaceParams,
} from './tools/file-operations'

export type {
  CodeSearchInput,
  FindFilesInput,
} from './tools/code-search'

export type { RunTerminalCommandInput } from './tools/terminal'

export type { SpawnAgentsParams } from './tools/spawn-agents'

// ============================================================================
// Core Type Definitions
// ============================================================================

/**
 * JSON value type - matches ToolResultOutput expectations
 */
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue }

/**
 * Tool result format matching Codebuff's specification
 */
export interface ToolResult {
  type: 'text' | 'json' | 'error'
  value?: JSONValue
  text?: string
}

/**
 * Retry configuration for transient failures
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number

  /** Initial delay between retries in milliseconds */
  initialDelayMs: number

  /** Maximum delay between retries in milliseconds */
  maxDelayMs: number

  /** Backoff multiplier for exponential backoff */
  backoffMultiplier: number

  /** Whether to use exponential backoff (default: true) */
  exponentialBackoff: boolean
}

/**
 * Timeout configuration for async operations
 */
export interface TimeoutConfig {
  /** Default timeout for tool executions in milliseconds */
  toolExecutionTimeoutMs: number

  /** Default timeout for LLM invocations in milliseconds */
  llmInvocationTimeoutMs: number

  /** Default timeout for terminal commands in milliseconds */
  terminalCommandTimeoutMs: number
}

/**
 * Adapter configuration
 */
export interface AdapterConfig {
  /** Working directory for all operations */
  cwd: string

  /** Optional Anthropic API key for PAID mode (enables spawn_agents) */
  anthropicApiKey?: string

  /** Environment variables to pass to tools */
  env?: Record<string, string>

  /** Maximum number of steps to prevent infinite loops */
  maxSteps?: number

  /** Enable debug logging */
  debug?: boolean

  /** Custom logger function */
  logger?: (message: string) => void

  /** Retry configuration for transient failures */
  retry?: Partial<RetryConfig>

  /** Timeout configuration for async operations */
  timeouts?: Partial<TimeoutConfig>
}

/**
 * Agent execution context
 */
export interface AgentExecutionContext {
  agentId: string
  parentId?: string
  messageHistory: Message[]
  stepsRemaining: number
  output?: unknown
}

/**
 * Claude Tool Result (internal representation)
 */
export interface ClaudeToolResult {
  type: 'text' | 'json' | 'error'
  content: string | JSONValue
}

// ============================================================================
// Tool-Specific Parameter Types
// ============================================================================

/**
 * Parameters for set_output tool
 */
export interface SetOutputParams {
  /** Output value to set (can be any serializable value) */
  output: unknown
}
