/**
 * Type definitions for Claude CLI Adapter
 *
 * Common types used across the adapter implementation
 */

import type { Message } from '../../.agents/types/util-types'

/**
 * Tool result format matching Codebuff's specification
 */
export interface ToolResult {
  type: 'text' | 'json' | 'error'
  value?: any
  text?: string
}

/**
 * Adapter configuration
 */
export interface AdapterConfig {
  /** Working directory for all operations */
  cwd: string

  /** Environment variables to pass to tools */
  env?: Record<string, string>

  /** Maximum number of steps to prevent infinite loops */
  maxSteps?: number

  /** Enable debug logging */
  debug?: boolean

  /** Custom logger function */
  logger?: (message: string) => void
}

/**
 * Agent execution context
 */
export interface AgentExecutionContext {
  agentId: string
  parentId?: string
  messageHistory: Message[]
  stepsRemaining: number
  output?: Record<string, any>
}

/**
 * Claude Tool Result (internal representation)
 */
export interface ClaudeToolResult {
  type: 'text' | 'json' | 'error'
  content: string | Record<string, any>
}
