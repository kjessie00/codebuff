/**
 * Error Formatting Utilities
 *
 * Provides consistent error message formatting across the adapter.
 * Handles various error types and provides user-friendly error messages.
 *
 * @module utils/error-formatting
 */

/**
 * Type guard for Node.js errno exceptions
 *
 * @param error - Error to check
 * @returns True if error has a code property (like ENOENT, EACCES, etc.)
 */
export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

/**
 * Type guard for child_process exec errors
 *
 * These errors contain stdout/stderr from the failed command.
 *
 * @param error - Error to check
 * @returns True if error is from child_process.exec
 */
export function isExecError(
  error: unknown
): error is Error & {
  code?: number
  stdout?: string
  stderr?: string
  killed?: boolean
} {
  return (
    error instanceof Error &&
    ('stdout' in error || 'stderr' in error || 'killed' in error)
  )
}

/**
 * Format an error into a user-friendly string
 *
 * Handles multiple error types:
 * - Error objects: Returns error.message
 * - String errors: Returns the string directly
 * - Exec errors: Includes timeout detection
 * - Unknown errors: Returns generic message
 *
 * @param error - Error to format
 * @returns Formatted error message
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation()
 * } catch (error) {
 *   const message = formatError(error)
 *   console.error('Operation failed:', message)
 * }
 * ```
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    // Handle timeout errors specially
    if (isExecError(error) && error.killed) {
      return 'Command timed out and was killed'
    }
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Unknown error occurred'
}

/**
 * Format an error with stack trace for debugging
 *
 * Returns detailed error information including stack trace.
 * Useful for debug logging.
 *
 * @param error - Error to format
 * @returns Detailed error information
 *
 * @example
 * ```typescript
 * try {
 *   await operation()
 * } catch (error) {
 *   console.debug(formatErrorWithStack(error))
 * }
 * ```
 */
export function formatErrorWithStack(error: unknown): string {
  if (error instanceof Error) {
    return `${error.message}\n${error.stack || '(no stack trace)'}`
  }

  return formatError(error)
}

/**
 * Create an error result for tool execution
 *
 * Returns a standardized error result object that can be returned
 * from tool implementations.
 *
 * @param error - Error that occurred
 * @param context - Additional context (e.g., file path, command)
 * @returns Standardized error result object
 *
 * @example
 * ```typescript
 * try {
 *   await performOperation()
 * } catch (error) {
 *   return createErrorResult(error, { path: filePath })
 * }
 * ```
 */
export function createErrorResult(
  error: unknown,
  context?: Record<string, any>
): {
  success: false
  error: string
  [key: string]: any
} {
  return {
    success: false,
    error: formatError(error),
    ...context,
  }
}

/**
 * Create a success result for tool execution
 *
 * Returns a standardized success result object.
 *
 * @param data - Additional data to include in the result
 * @returns Standardized success result object
 *
 * @example
 * ```typescript
 * await performOperation()
 * return createSuccessResult({ path: filePath })
 * ```
 */
export function createSuccessResult(
  data?: Record<string, any>
): {
  success: true
  [key: string]: any
} {
  return {
    success: true,
    ...data,
  }
}

/**
 * Extract error code from Node.js errno exceptions
 *
 * @param error - Error to extract code from
 * @returns Error code (e.g., 'ENOENT') or null
 *
 * @example
 * ```typescript
 * const code = getErrorCode(error)
 * if (code === 'ENOENT') {
 *   console.log('File not found')
 * }
 * ```
 */
export function getErrorCode(error: unknown): string | null {
  if (isNodeError(error) && error.code) {
    return error.code
  }
  return null
}

/**
 * Check if error is a specific Node.js error code
 *
 * @param error - Error to check
 * @param code - Error code to check for (e.g., 'ENOENT', 'EACCES')
 * @returns True if error matches the code
 *
 * @example
 * ```typescript
 * if (isErrorCode(error, 'ENOENT')) {
 *   console.log('File does not exist')
 * } else if (isErrorCode(error, 'EACCES')) {
 *   console.log('Permission denied')
 * }
 * ```
 */
export function isErrorCode(error: unknown, code: string): boolean {
  return getErrorCode(error) === code
}

/**
 * Check if error indicates a file not found
 *
 * @param error - Error to check
 * @returns True if error is ENOENT
 *
 * @example
 * ```typescript
 * try {
 *   await fs.readFile(path)
 * } catch (error) {
 *   if (isFileNotFoundError(error)) {
 *     return null // File doesn't exist
 *   }
 *   throw error // Other error
 * }
 * ```
 */
export function isFileNotFoundError(error: unknown): boolean {
  return isErrorCode(error, 'ENOENT')
}

/**
 * Check if error indicates a permission issue
 *
 * @param error - Error to check
 * @returns True if error is EACCES or EPERM
 *
 * @example
 * ```typescript
 * try {
 *   await fs.writeFile(path, content)
 * } catch (error) {
 *   if (isPermissionError(error)) {
 *     console.error('Permission denied')
 *   }
 * }
 * ```
 */
export function isPermissionError(error: unknown): boolean {
  return isErrorCode(error, 'EACCES') || isErrorCode(error, 'EPERM')
}

/**
 * Check if error indicates a timeout
 *
 * @param error - Error to check
 * @returns True if error is a timeout error
 *
 * @example
 * ```typescript
 * try {
 *   await executeCommand(cmd)
 * } catch (error) {
 *   if (isTimeoutError(error)) {
 *     console.error('Command took too long')
 *   }
 * }
 * ```
 */
export function isTimeoutError(error: unknown): boolean {
  if (isExecError(error) && error.killed) {
    return true
  }

  if (error instanceof Error) {
    return error.message.toLowerCase().includes('timeout')
  }

  return false
}

/**
 * Safely extract stdout from exec errors
 *
 * @param error - Error to extract stdout from
 * @returns stdout string or empty string
 */
export function getExecStdout(error: unknown): string {
  if (isExecError(error) && error.stdout) {
    return error.stdout
  }
  return ''
}

/**
 * Safely extract stderr from exec errors
 *
 * @param error - Error to extract stderr from
 * @returns stderr string or empty string
 */
export function getExecStderr(error: unknown): string {
  if (isExecError(error) && error.stderr) {
    return error.stderr
  }
  return ''
}

/**
 * Safely extract exit code from exec errors
 *
 * @param error - Error to extract exit code from
 * @returns Exit code or -1 if not available
 */
export function getExecExitCode(error: unknown): number {
  if (isExecError(error) && error.code !== undefined) {
    return error.code
  }
  return -1
}
