/**
 * Constants for Claude CLI Adapter
 *
 * Centralized configuration constants to avoid magic numbers throughout the codebase.
 * These values control timeouts, buffer sizes, iteration limits, and other configurable behaviors.
 *
 * @module utils/constants
 */

// ============================================================================
// Agent Execution Limits
// ============================================================================

/**
 * Default maximum number of steps an agent can execute before stopping
 *
 * This prevents infinite loops in agent execution. Each tool call or LLM
 * invocation counts as one step.
 *
 * @default 20
 */
export const DEFAULT_MAX_STEPS = 20

/**
 * Maximum number of iterations for handleSteps generator execution
 *
 * This is typically higher than max steps to allow more fine-grained control
 * within the generator. Each iteration of the generator counts separately.
 *
 * Formula: MAX_STEPS * ITERATION_MULTIPLIER
 *
 * @default 2
 */
export const ITERATION_MULTIPLIER = 2

/**
 * Maximum number of steps allowed in STEP_ALL mode before forcing completion
 *
 * In STEP_ALL mode, the agent continues executing until it signals end_turn
 * or hits this limit.
 *
 * @default 50
 */
export const MAX_STEP_ALL_ITERATIONS = 50

// ============================================================================
// Timeout Configuration
// ============================================================================

/**
 * Default timeout for terminal commands in milliseconds
 *
 * Commands that exceed this timeout will be terminated.
 * Can be overridden per-command via timeout_seconds parameter.
 *
 * @default 30000 (30 seconds)
 */
export const DEFAULT_COMMAND_TIMEOUT_MS = 30000

/**
 * Extended timeout for long-running operations (in milliseconds)
 *
 * Used for operations like npm install, tests, builds, etc.
 *
 * @default 120000 (2 minutes)
 */
export const EXTENDED_COMMAND_TIMEOUT_MS = 120000

/**
 * Timeout for command verification checks (in milliseconds)
 *
 * Used when checking if a command exists on the system.
 *
 * @default 5000 (5 seconds)
 */
export const COMMAND_VERIFICATION_TIMEOUT_MS = 5000

// ============================================================================
// Buffer Sizes
// ============================================================================

/**
 * Maximum buffer size for command output in bytes
 *
 * This prevents memory issues when commands produce large amounts of output.
 * Commands that exceed this buffer will error.
 *
 * @default 10485760 (10 MB)
 */
export const MAX_COMMAND_OUTPUT_BUFFER_BYTES = 10 * 1024 * 1024

/**
 * Maximum file size to read into memory in bytes
 *
 * Files larger than this should be streamed or processed in chunks.
 *
 * @default 52428800 (50 MB)
 */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Length of random component in generated IDs
 *
 * IDs are generated as: timestamp-randomString
 * Higher values reduce collision probability.
 *
 * @default 9
 */
export const ID_RANDOM_LENGTH = 9

// ============================================================================
// Execution Time Thresholds
// ============================================================================

/**
 * Threshold in milliseconds for considering a command "long-running"
 *
 * Commands exceeding this threshold will have execution time displayed
 * in the formatted output.
 *
 * @default 1000 (1 second)
 */
export const LONG_RUNNING_COMMAND_THRESHOLD_MS = 1000

/**
 * Minimum execution time to display in error messages (in milliseconds)
 *
 * Error messages for very quick failures may omit execution time.
 *
 * @default 100 (0.1 seconds)
 */
export const MIN_ERROR_DISPLAY_TIME_MS = 100

// ============================================================================
// Display Configuration
// ============================================================================

/**
 * Maximum length of prompt to display in logs
 *
 * Long prompts are truncated to avoid cluttering logs.
 *
 * @default 100
 */
export const MAX_PROMPT_DISPLAY_LENGTH = 100

/**
 * Maximum depth for nested agent execution
 *
 * Prevents stack overflow from deeply nested agent spawning.
 *
 * @default 10
 */
export const MAX_AGENT_NESTING_DEPTH = 10

// ============================================================================
// Path Validation
// ============================================================================

/**
 * Whether to enforce strict path validation
 *
 * When true, all file operations must be within the working directory.
 * Disabling this is a security risk.
 *
 * @default true
 */
export const ENFORCE_PATH_VALIDATION = true

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate max iterations based on configured max steps
 *
 * @param maxSteps - Maximum number of steps
 * @returns Maximum iterations for handleSteps execution
 *
 * @example
 * ```typescript
 * const maxIterations = calculateMaxIterations(20) // Returns 40
 * ```
 */
export function calculateMaxIterations(maxSteps: number): number {
  return maxSteps * ITERATION_MULTIPLIER
}

/**
 * Convert seconds to milliseconds
 *
 * @param seconds - Time in seconds
 * @returns Time in milliseconds
 *
 * @example
 * ```typescript
 * const timeoutMs = secondsToMs(30) // Returns 30000
 * ```
 */
export function secondsToMs(seconds: number): number {
  return seconds * 1000
}

/**
 * Convert milliseconds to seconds with precision
 *
 * @param milliseconds - Time in milliseconds
 * @param precision - Number of decimal places (default: 2)
 * @returns Time in seconds as string
 *
 * @example
 * ```typescript
 * const time = msToSeconds(1234) // Returns "1.23"
 * const time2 = msToSeconds(1234, 1) // Returns "1.2"
 * ```
 */
export function msToSeconds(milliseconds: number, precision: number = 2): string {
  return (milliseconds / 1000).toFixed(precision)
}

/**
 * Check if execution time exceeds long-running threshold
 *
 * @param executionTimeMs - Execution time in milliseconds
 * @returns True if command is considered long-running
 *
 * @example
 * ```typescript
 * if (isLongRunning(executionTime)) {
 *   console.log(`Completed in ${msToSeconds(executionTime)}s`)
 * }
 * ```
 */
export function isLongRunning(executionTimeMs: number): boolean {
  return executionTimeMs > LONG_RUNNING_COMMAND_THRESHOLD_MS
}
