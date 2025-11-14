/**
 * Global test setup and teardown
 *
 * This file runs before all tests and sets up the testing environment.
 * It configures global test utilities, mocks, and cleanup handlers.
 */

import { promises as fs } from 'fs'
import * as path from 'path'
import * as os from 'os'

// ============================================================================
// Global Test Configuration
// ============================================================================

// Increase test timeout for integration tests
jest.setTimeout(30000)

// ============================================================================
// Global Mocks
// ============================================================================

// Mock console.warn to reduce noise in tests
const originalWarn = console.warn
beforeAll(() => {
  console.warn = jest.fn()
})

afterAll(() => {
  console.warn = originalWarn
})

// ============================================================================
// Cleanup Utilities
// ============================================================================

/**
 * Track temporary directories created during tests for cleanup
 */
const tempDirs: string[] = []

/**
 * Register a temporary directory for cleanup after tests
 */
export function registerTempDir(dir: string): void {
  tempDirs.push(dir)
}

/**
 * Clean up all temporary test directories
 */
async function cleanupTempDirs(): Promise<void> {
  for (const dir of tempDirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
      console.error(`Failed to clean up temp dir ${dir}:`, error)
    }
  }
  tempDirs.length = 0
}

// Clean up after all tests complete
afterAll(async () => {
  await cleanupTempDirs()
})

// ============================================================================
// Test Environment Checks
// ============================================================================

/**
 * Verify test environment is properly configured
 */
beforeAll(() => {
  // Verify Node.js version
  const nodeVersion = process.version
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10)

  if (majorVersion < 18) {
    throw new Error(
      `Tests require Node.js 18 or higher. Current version: ${nodeVersion}`
    )
  }

  // Verify we're in test environment
  if (process.env.NODE_ENV !== 'test') {
    console.warn('NODE_ENV is not set to "test". Setting it now.')
    process.env.NODE_ENV = 'test'
  }
})

// ============================================================================
// Global Test Helpers
// ============================================================================

/**
 * Wait for a condition to be true
 *
 * @param condition - Function that returns true when condition is met
 * @param timeout - Maximum time to wait in milliseconds
 * @param interval - How often to check condition in milliseconds
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`)
}

/**
 * Sleep for a specified duration
 *
 * @param ms - Milliseconds to sleep
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================================
// Global Matchers (Optional - for custom Jest matchers)
// ============================================================================

// Example: Add custom matchers if needed
// expect.extend({
//   toBeWithinRange(received: number, floor: number, ceiling: number) {
//     const pass = received >= floor && received <= ceiling
//     if (pass) {
//       return {
//         message: () =>
//           `expected ${received} not to be within range ${floor} - ${ceiling}`,
//         pass: true,
//       }
//     } else {
//       return {
//         message: () =>
//           `expected ${received} to be within range ${floor} - ${ceiling}`,
//         pass: false,
//       }
//     }
//   },
// })

// ============================================================================
// Environment Logging
// ============================================================================

// Log test environment info once
let hasLoggedEnv = false

beforeAll(() => {
  if (!hasLoggedEnv) {
    console.log('='.repeat(80))
    console.log('Test Environment:')
    console.log(`  Node.js: ${process.version}`)
    console.log(`  Platform: ${process.platform}`)
    console.log(`  Architecture: ${process.arch}`)
    console.log(`  CWD: ${process.cwd()}`)
    console.log(`  Temp Dir: ${os.tmpdir()}`)
    console.log('='.repeat(80))
    hasLoggedEnv = true
  }
})
