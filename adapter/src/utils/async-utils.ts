/**
 * Async Utilities for Error Handling
 *
 * Provides timeout wrappers, retry logic with exponential backoff,
 * and other utilities for handling async operations safely.
 *
 * @module async-utils
 */

import { TimeoutError } from '../errors'
import type { RetryConfig } from '../types'

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  exponentialBackoff: true,
}

/**
 * Wrap an async operation with a timeout
 *
 * If the operation doesn't complete within the timeout, it throws a TimeoutError.
 * The operation continues running in the background (no way to cancel it in JS),
 * but the promise rejects with timeout error.
 *
 * @param fn - Async function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param operation - Name of the operation (for error messages)
 * @param agentId - Optional agent ID for error context
 * @returns Promise that resolves to the function result or rejects with TimeoutError
 *
 * @throws {TimeoutError} If operation exceeds timeout
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   async () => await longRunningOperation(),
 *   5000,
 *   'long_operation'
 * )
 * ```
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  operation?: string,
  agentId?: string
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(
        new TimeoutError(`Operation timed out after ${timeoutMs}ms`, {
          timeoutMs,
          operation,
          agentId,
        })
      )
    }, timeoutMs)
  })

  try {
    const result = await Promise.race([fn(), timeoutPromise])
    return result
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
}

/**
 * Options for retry logic
 */
interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number

  /** Initial delay between retries in milliseconds */
  initialDelayMs?: number

  /** Maximum delay between retries in milliseconds */
  maxDelayMs?: number

  /** Backoff multiplier for exponential backoff */
  backoffMultiplier?: number

  /** Whether to use exponential backoff */
  exponentialBackoff?: boolean

  /** Predicate to determine if error is retryable */
  shouldRetry?: (error: unknown, attempt: number) => boolean

  /** Callback invoked on each retry attempt */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void

  /** Operation name for logging */
  operation?: string

  /** Agent ID for error context */
  agentId?: string
}

/**
 * Execute an async operation with retry logic and exponential backoff
 *
 * Retries transient failures with configurable backoff strategy.
 * By default, retries all errors up to maxRetries times.
 *
 * @param fn - Async function to execute
 * @param options - Retry options
 * @returns Promise that resolves to the function result
 *
 * @throws {Error} The last error if all retries are exhausted
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => await unstableOperation(),
 *   {
 *     maxRetries: 3,
 *     initialDelayMs: 1000,
 *     exponentialBackoff: true,
 *     shouldRetry: (err) => isTransientError(err),
 *     onRetry: (err, attempt, delay) => {
 *       console.log(`Retry attempt ${attempt} after ${delay}ms`)
 *     }
 *   }
 * )
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const config = {
    maxRetries: options?.maxRetries ?? DEFAULT_RETRY_CONFIG.maxRetries,
    initialDelayMs: options?.initialDelayMs ?? DEFAULT_RETRY_CONFIG.initialDelayMs,
    maxDelayMs: options?.maxDelayMs ?? DEFAULT_RETRY_CONFIG.maxDelayMs,
    backoffMultiplier:
      options?.backoffMultiplier ?? DEFAULT_RETRY_CONFIG.backoffMultiplier,
    exponentialBackoff:
      options?.exponentialBackoff ?? DEFAULT_RETRY_CONFIG.exponentialBackoff,
    shouldRetry: options?.shouldRetry ?? (() => true),
    onRetry: options?.onRetry,
  }

  let lastError: unknown
  let attempt = 0

  while (attempt <= config.maxRetries) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      attempt++

      // Check if we should retry
      if (attempt > config.maxRetries || !config.shouldRetry(error, attempt)) {
        throw error
      }

      // Calculate delay with exponential backoff
      let delayMs: number
      if (config.exponentialBackoff) {
        delayMs = Math.min(
          config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelayMs
        )
      } else {
        delayMs = config.initialDelayMs
      }

      // Notify retry callback
      if (config.onRetry) {
        config.onRetry(error, attempt, delayMs)
      }

      // Wait before retrying
      await sleep(delayMs)
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError
}

/**
 * Sleep for a specified duration
 *
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the duration
 *
 * @example
 * ```typescript
 * await sleep(1000) // Wait 1 second
 * ```
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Predicate to check if an error is a timeout error
 *
 * Checks for common timeout error patterns from various sources:
 * - TimeoutError from this library
 * - Node.js timeout errors
 * - HTTP timeout errors
 *
 * @param error - Error to check
 * @returns True if error indicates a timeout
 *
 * @example
 * ```typescript
 * const shouldRetry = (err) => isTimeoutError(err) || isNetworkError(err)
 * ```
 */
export function isTimeoutError(error: unknown): boolean {
  if (error instanceof TimeoutError) {
    return true
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('etimedout')
    )
  }

  return false
}

/**
 * Predicate to check if an error is a network error
 *
 * Checks for common network error patterns:
 * - Connection refused
 * - Network unreachable
 * - DNS errors
 *
 * @param error - Error to check
 * @returns True if error indicates a network issue
 *
 * @example
 * ```typescript
 * await withRetry(
 *   async () => await fetchData(),
 *   { shouldRetry: isNetworkError }
 * )
 * ```
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('enetunreach') ||
      message.includes('econnreset') ||
      message.includes('network') ||
      message.includes('fetch failed')
    )
  }

  return false
}

/**
 * Predicate to check if an error is transient (should be retried)
 *
 * Combines timeout and network error checks. Use this as a default
 * shouldRetry predicate for most operations.
 *
 * @param error - Error to check
 * @returns True if error is likely transient
 *
 * @example
 * ```typescript
 * await withRetry(
 *   async () => await operation(),
 *   { shouldRetry: isTransientError }
 * )
 * ```
 */
export function isTransientError(error: unknown): boolean {
  return isTimeoutError(error) || isNetworkError(error)
}

/**
 * Wrap an async operation with both timeout and retry logic
 *
 * Combines withTimeout and withRetry for comprehensive error handling.
 * Useful for operations that might fail transiently or take too long.
 *
 * @param fn - Async function to execute
 * @param timeoutMs - Timeout per attempt in milliseconds
 * @param retryOptions - Retry configuration
 * @returns Promise that resolves to the function result
 *
 * @throws {TimeoutError} If an attempt exceeds timeout
 * @throws {Error} The last error if all retries are exhausted
 *
 * @example
 * ```typescript
 * const result = await withTimeoutAndRetry(
 *   async () => await unstableOperation(),
 *   5000,  // 5 second timeout per attempt
 *   {
 *     maxRetries: 3,
 *     exponentialBackoff: true,
 *     shouldRetry: isTransientError
 *   }
 * )
 * ```
 */
export async function withTimeoutAndRetry<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  retryOptions?: RetryOptions
): Promise<T> {
  return withRetry(
    () =>
      withTimeout(
        fn,
        timeoutMs,
        retryOptions?.operation,
        retryOptions?.agentId
      ),
    retryOptions
  )
}

/**
 * Execute multiple async operations with a timeout for the entire batch
 *
 * Similar to Promise.all but with a timeout. If any operation fails or
 * the timeout is exceeded, all pending operations continue but the
 * promise rejects.
 *
 * @param operations - Array of async functions to execute
 * @param timeoutMs - Total timeout for all operations in milliseconds
 * @param operation - Name of the batch operation (for error messages)
 * @returns Promise that resolves to array of results
 *
 * @throws {TimeoutError} If batch exceeds timeout
 * @throws {Error} If any operation fails
 *
 * @example
 * ```typescript
 * const results = await withBatchTimeout(
 *   [
 *     async () => await operation1(),
 *     async () => await operation2(),
 *     async () => await operation3()
 *   ],
 *   10000,  // 10 second timeout for all operations
 *   'batch_operation'
 * )
 * ```
 */
export async function withBatchTimeout<T>(
  operations: Array<() => Promise<T>>,
  timeoutMs: number,
  operation?: string
): Promise<T[]> {
  return withTimeout(
    () => Promise.all(operations.map((op) => op())),
    timeoutMs,
    operation
  )
}

/**
 * Race multiple async operations with a timeout
 *
 * Returns the first operation to complete. If timeout is exceeded,
 * throws TimeoutError. Other operations continue but are ignored.
 *
 * @param operations - Array of async functions to race
 * @param timeoutMs - Timeout in milliseconds
 * @param operation - Name of the race operation (for error messages)
 * @returns Promise that resolves to the first result
 *
 * @throws {TimeoutError} If no operation completes within timeout
 *
 * @example
 * ```typescript
 * const result = await raceWithTimeout(
 *   [
 *     async () => await primarySource(),
 *     async () => await fallbackSource()
 *   ],
 *   5000,  // Use whichever responds first within 5 seconds
 *   'fetch_data'
 * )
 * ```
 */
export async function raceWithTimeout<T>(
  operations: Array<() => Promise<T>>,
  timeoutMs: number,
  operation?: string
): Promise<T> {
  return withTimeout(
    () => Promise.race(operations.map((op) => op())),
    timeoutMs,
    operation
  )
}
