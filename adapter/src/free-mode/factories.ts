/**
 * FREE Mode Factory Functions
 *
 * Convenient factory functions for creating Claude CLI adapters in FREE mode.
 * These functions provide sensible defaults and make it easy to get started
 * without requiring an API key.
 *
 * @module factories
 */

import { ClaudeCodeCLIAdapter } from '../claude-cli-adapter'
import type { AdapterConfig } from '../types'
import type { FreeAdapterOptions } from './free-mode-types'

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a FREE mode adapter with sensible defaults
 *
 * This is the primary factory function for creating adapters in FREE mode.
 * It provides sensible defaults and does not require an API key.
 *
 * **Available tools in FREE mode:**
 * - `read_files` - Read multiple files from disk
 * - `write_file` - Write content to a file
 * - `str_replace` - Replace string in a file
 * - `code_search` - Search codebase with ripgrep
 * - `find_files` - Find files matching glob pattern
 * - `run_terminal_command` - Execute shell commands
 * - `set_output` - Set agent output value
 *
 * **NOT available in FREE mode:**
 * - `spawn_agents` - Requires PAID mode (API key)
 *
 * @param options - Configuration options
 * @returns ClaudeCodeCLIAdapter instance configured for FREE mode
 *
 * @example
 * ```typescript
 * // Create with defaults (uses process.cwd())
 * const adapter = createFreeAdapter()
 *
 * // Create with custom working directory
 * const adapter = createFreeAdapter({
 *   cwd: '/path/to/project'
 * })
 *
 * // Create with debug logging
 * const adapter = createFreeAdapter({
 *   cwd: '/path/to/project',
 *   debug: true,
 *   logger: (msg) => console.log(`[FREE] ${msg}`)
 * })
 *
 * // Create with custom max steps
 * const adapter = createFreeAdapter({
 *   cwd: '/path/to/project',
 *   maxSteps: 50
 * })
 * ```
 */
export function createFreeAdapter(
  options: FreeAdapterOptions = {}
): ClaudeCodeCLIAdapter {
  const config: AdapterConfig = {
    cwd: options.cwd ?? process.cwd(),
    debug: options.debug ?? false,
    logger: options.logger,
    maxSteps: options.maxSteps ?? 20,
    env: options.env ?? {},
    // Explicitly omit anthropicApiKey to ensure FREE mode
    anthropicApiKey: undefined,
  }

  return new ClaudeCodeCLIAdapter(config)
}

/**
 * Create an adapter for the current working directory
 *
 * Convenience function that creates a FREE mode adapter for the current
 * working directory. Optionally enables debug logging.
 *
 * @param debug - Enable debug logging (default: false)
 * @returns ClaudeCodeCLIAdapter instance for current directory
 *
 * @example
 * ```typescript
 * // Create for current directory
 * const adapter = createAdapterForCwd()
 *
 * // Create with debug logging
 * const adapter = createAdapterForCwd(true)
 * ```
 */
export function createAdapterForCwd(
  debug: boolean = false
): ClaudeCodeCLIAdapter {
  return createFreeAdapter({
    cwd: process.cwd(),
    debug,
  })
}

/**
 * Create an adapter for a specific project
 *
 * Convenience function for creating a FREE mode adapter for a specific
 * project directory.
 *
 * @param projectPath - Absolute path to project directory
 * @returns ClaudeCodeCLIAdapter instance for the project
 *
 * @example
 * ```typescript
 * // Create for specific project
 * const adapter = createAdapterForProject('/home/user/my-project')
 *
 * // Then use it
 * const result = await adapter.executeAgent(
 *   fileExplorerAgent,
 *   'Find all TypeScript files'
 * )
 * ```
 */
export function createAdapterForProject(
  projectPath: string
): ClaudeCodeCLIAdapter {
  return createFreeAdapter({
    cwd: projectPath,
  })
}

/**
 * Create a debug adapter for development
 *
 * Creates a FREE mode adapter with debug logging enabled and verbose output.
 * Useful for development and troubleshooting.
 *
 * @param options - Configuration options
 * @returns ClaudeCodeCLIAdapter instance with debug enabled
 *
 * @example
 * ```typescript
 * const adapter = createDebugAdapter({
 *   cwd: '/path/to/project'
 * })
 *
 * // Custom logger with timestamps
 * const adapter = createDebugAdapter({
 *   cwd: '/path/to/project',
 *   logger: (msg) => console.log(`[${new Date().toISOString()}] ${msg}`)
 * })
 * ```
 */
export function createDebugAdapter(
  options: FreeAdapterOptions = {}
): ClaudeCodeCLIAdapter {
  return createFreeAdapter({
    ...options,
    debug: true,
    logger: options.logger ?? ((msg) => console.log(`[DEBUG] ${msg}`)),
  })
}

/**
 * Create a silent adapter with minimal logging
 *
 * Creates a FREE mode adapter with debug logging disabled.
 * Useful for production environments or when you want minimal output.
 *
 * @param options - Configuration options
 * @returns ClaudeCodeCLIAdapter instance with minimal logging
 *
 * @example
 * ```typescript
 * const adapter = createSilentAdapter({
 *   cwd: '/path/to/project'
 * })
 * ```
 */
export function createSilentAdapter(
  options: FreeAdapterOptions = {}
): ClaudeCodeCLIAdapter {
  return createFreeAdapter({
    ...options,
    debug: false,
    logger: () => {}, // No-op logger
  })
}

/**
 * Create an adapter with custom environment variables
 *
 * Creates a FREE mode adapter with custom environment variables for terminal commands.
 *
 * @param env - Environment variables
 * @param options - Additional configuration options
 * @returns ClaudeCodeCLIAdapter instance with custom environment
 *
 * @example
 * ```typescript
 * const adapter = createAdapterWithEnv({
 *   NODE_ENV: 'development',
 *   DEBUG: '*'
 * }, {
 *   cwd: '/path/to/project'
 * })
 * ```
 */
export function createAdapterWithEnv(
  env: Record<string, string>,
  options: FreeAdapterOptions = {}
): ClaudeCodeCLIAdapter {
  return createFreeAdapter({
    ...options,
    env,
  })
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate that an adapter is in FREE mode
 *
 * Checks if the adapter is configured for FREE mode (no API key).
 *
 * @param adapter - Adapter instance to check
 * @returns True if adapter is in FREE mode
 *
 * @example
 * ```typescript
 * const adapter = createFreeAdapter()
 * if (isFreeMode(adapter)) {
 *   console.log('Running in FREE mode - no costs!')
 * }
 * ```
 */
export function isFreeMode(adapter: ClaudeCodeCLIAdapter): boolean {
  return !adapter.hasApiKeyAvailable()
}

/**
 * Assert that an adapter is in FREE mode
 *
 * Throws an error if the adapter is not in FREE mode.
 *
 * @param adapter - Adapter instance to check
 * @throws {Error} If adapter is not in FREE mode
 *
 * @example
 * ```typescript
 * const adapter = createFreeAdapter()
 * assertFreeMode(adapter) // OK
 *
 * const paidAdapter = new ClaudeCodeCLIAdapter({
 *   cwd: process.cwd(),
 *   anthropicApiKey: 'sk-...'
 * })
 * assertFreeMode(paidAdapter) // Throws error
 * ```
 */
export function assertFreeMode(adapter: ClaudeCodeCLIAdapter): void {
  if (!isFreeMode(adapter)) {
    throw new Error(
      'This operation requires FREE mode (no API key). ' +
        'Create adapter with createFreeAdapter() or omit anthropicApiKey.'
    )
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if adapter has specific tool available
 *
 * @param adapter - Adapter instance
 * @param toolName - Tool name to check
 * @returns True if tool is available
 *
 * @example
 * ```typescript
 * const adapter = createFreeAdapter()
 * console.log(hasToolAvailable(adapter, 'read_files')) // true
 * console.log(hasToolAvailable(adapter, 'spawn_agents')) // false
 * ```
 */
export function hasToolAvailable(
  adapter: ClaudeCodeCLIAdapter,
  toolName: string
): boolean {
  // In FREE mode, all tools except spawn_agents are available
  if (toolName === 'spawn_agents') {
    return adapter.hasApiKeyAvailable()
  }

  // All other tools are available in FREE mode
  return true
}
