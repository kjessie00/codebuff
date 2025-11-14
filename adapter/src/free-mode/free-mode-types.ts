/**
 * FREE Mode Type Definitions
 *
 * TypeScript type definitions specific to FREE mode usage of the Claude CLI adapter.
 * These types provide a convenient, type-safe interface for working with the adapter
 * without requiring an API key.
 *
 * @module free-mode-types
 */

import type { AgentExecutionResult } from '../claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'
import type { ClaudeCodeCLIAdapter } from '../claude-cli-adapter'

// ============================================================================
// Result Types
// ============================================================================

/**
 * Standard result type with success/error discrimination
 *
 * Use this for consistent error handling across FREE mode operations.
 *
 * @example
 * ```typescript
 * const result: Result<string[]> = await executeAgent(...)
 * if (result.success) {
 *   console.log('Files:', result.data)
 * } else {
 *   console.error('Error:', result.error)
 * }
 * ```
 */
export type Result<T = any> =
  | { success: true; data: T }
  | { success: false; error: string; details?: any }

/**
 * Create a success result
 *
 * @param data - The successful result data
 * @returns Success result
 *
 * @example
 * ```typescript
 * return success(['file1.ts', 'file2.ts'])
 * ```
 */
export function success<T>(data: T): Result<T> {
  return { success: true, data }
}

/**
 * Create an error result
 *
 * @param error - Error message
 * @param details - Optional error details
 * @returns Error result
 *
 * @example
 * ```typescript
 * return failure('Failed to read file', { path: '/invalid/path' })
 * ```
 */
export function failure(error: string, details?: any): Result<never> {
  return { success: false, error, details }
}

// ============================================================================
// Execution Options
// ============================================================================

/**
 * Options for agent execution
 *
 * @example
 * ```typescript
 * const options: ExecutionOptions = {
 *   timeout: 30000,
 *   retries: 3,
 *   onProgress: (step, total) => console.log(`Step ${step}/${total}`)
 * }
 * ```
 */
export interface ExecutionOptions {
  /** Maximum execution time in milliseconds */
  timeout?: number

  /** Number of retry attempts on failure */
  retries?: number

  /** Progress callback */
  onProgress?: (step: number, total: number) => void

  /** Whether to suppress error logs */
  silent?: boolean
}

// ============================================================================
// Tool Availability
// ============================================================================

/**
 * Tool availability information
 *
 * Indicates which tools are available in the current mode (FREE or PAID).
 */
export interface ToolInfo {
  /** Whether the tool is available in current mode */
  available: boolean

  /** Whether the tool requires an API key (PAID mode) */
  requiresApiKey: boolean

  /** Tool description */
  description: string

  /** Tool category */
  category: 'file' | 'code' | 'terminal' | 'agent' | 'output'
}

/**
 * Map of tool names to availability info
 */
export type ToolAvailability = {
  [toolName: string]: ToolInfo
}

// ============================================================================
// Agent Templates
// ============================================================================

/**
 * Agent template with usage examples
 *
 * Pre-built agent definitions with comprehensive documentation and examples.
 */
export interface AgentTemplate {
  /** Agent definition */
  definition: AgentDefinition

  /** Category for organization */
  category: 'file' | 'code' | 'terminal' | 'analysis' | 'documentation' | 'review' | 'security'

  /** Usage examples */
  examples: Array<{
    description: string
    prompt: string
    expectedOutput?: string
  }>

  /** Best practices and tips */
  tips?: string[]
}

// ============================================================================
// Adapter Factory Options
// ============================================================================

/**
 * Options for creating a FREE mode adapter
 *
 * @example
 * ```typescript
 * const options: FreeAdapterOptions = {
 *   cwd: '/path/to/project',
 *   debug: true,
 *   logger: (msg) => console.log(`[ADAPTER] ${msg}`)
 * }
 * ```
 */
export interface FreeAdapterOptions {
  /** Working directory for all operations */
  cwd?: string

  /** Enable debug logging */
  debug?: boolean

  /** Custom logger function */
  logger?: (msg: string) => void

  /** Maximum number of steps to prevent infinite loops */
  maxSteps?: number

  /** Environment variables to pass to tools */
  env?: Record<string, string>
}

// ============================================================================
// Execution Context
// ============================================================================

/**
 * Execution context for tracking agent runs
 *
 * Internal type for managing execution state.
 */
export interface ExecutionContext {
  /** Agent being executed */
  agent: AgentDefinition

  /** User prompt */
  prompt?: string

  /** Start time */
  startTime: number

  /** Execution options */
  options: ExecutionOptions
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Extractor function for processing agent output
 *
 * @example
 * ```typescript
 * const extractFiles: Extractor<string[]> = (output) => {
 *   return output.files as string[]
 * }
 * ```
 */
export type Extractor<T> = (output: any) => T

/**
 * Agent task for sequential execution
 *
 * @example
 * ```typescript
 * const tasks: AgentTask[] = [
 *   { agent: fileExplorerAgent, prompt: 'Find all .ts files' },
 *   { agent: codeSearchAgent, prompt: 'Search for TODO comments' }
 * ]
 * ```
 */
export interface AgentTask {
  /** Agent to execute */
  agent: AgentDefinition

  /** Prompt for the agent */
  prompt: string

  /** Optional task name for logging */
  name?: string
}

// ============================================================================
// Configuration Presets
// ============================================================================

/**
 * Configuration preset names
 */
export type PresetName = 'development' | 'production' | 'testing'

/**
 * Configuration preset definition
 */
export interface PresetConfig {
  /** Enable debug logging */
  debug: boolean

  /** Custom logger */
  logger?: (msg: string) => void

  /** Maximum steps */
  maxSteps: number

  /** Additional description */
  description?: string
}

// ============================================================================
// Export Helper Types
// ============================================================================

/**
 * Re-export commonly used types from the main adapter
 */
export type { AgentExecutionResult, AgentDefinition, ClaudeCodeCLIAdapter }
