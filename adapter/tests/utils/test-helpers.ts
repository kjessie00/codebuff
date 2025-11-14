/**
 * Test Utilities and Helpers
 *
 * Common test utilities for creating mocks, temporary directories,
 * and test fixtures used across the test suite.
 */

import { promises as fs } from 'fs'
import * as path from 'path'
import * as os from 'os'
import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type {
  AgentDefinition,
  ToolCall,
} from '../../../.agents/types/agent-definition'
import type { ToolResultOutput } from '../../../.agents/types/util-types'
import type { AdapterConfig } from '../../src/types'
import { registerTempDir } from '../setup/test-setup'

// ============================================================================
// Temporary Directory Utilities
// ============================================================================

/**
 * Create a temporary test directory
 *
 * The directory is automatically registered for cleanup after tests.
 *
 * @param prefix - Optional prefix for the directory name
 * @returns Absolute path to the temporary directory
 */
export async function createTestDir(prefix: string = 'adapter-test-'): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
  registerTempDir(tmpDir)
  return tmpDir
}

/**
 * Clean up a test directory
 *
 * @param dir - Directory to remove
 */
export async function cleanupTestDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch (error) {
    // Ignore errors
    console.warn(`Failed to cleanup test dir ${dir}:`, error)
  }
}

/**
 * Create test files with content in a directory
 *
 * @param dir - Directory to create files in
 * @param files - Object mapping file paths to their content
 *
 * @example
 * ```typescript
 * await createTestFiles(testDir, {
 *   'src/index.ts': 'export const foo = "bar"',
 *   'package.json': JSON.stringify({ name: 'test' })
 * })
 * ```
 */
export async function createTestFiles(
  dir: string,
  files: Record<string, string>
): Promise<void> {
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, filePath)

    // Create parent directory if needed
    const parentDir = path.dirname(fullPath)
    await fs.mkdir(parentDir, { recursive: true })

    // Write file
    await fs.writeFile(fullPath, content, 'utf-8')
  }
}

/**
 * Read test file content
 *
 * @param dir - Base directory
 * @param filePath - Relative file path
 * @returns File content
 */
export async function readTestFile(dir: string, filePath: string): Promise<string> {
  const fullPath = path.join(dir, filePath)
  return fs.readFile(fullPath, 'utf-8')
}

/**
 * Check if a test file exists
 *
 * @param dir - Base directory
 * @param filePath - Relative file path
 * @returns True if file exists
 */
export async function testFileExists(dir: string, filePath: string): Promise<boolean> {
  try {
    const fullPath = path.join(dir, filePath)
    await fs.access(fullPath)
    return true
  } catch {
    return false
  }
}

// ============================================================================
// Mock Adapter Utilities
// ============================================================================

/**
 * Create a mock adapter for testing
 *
 * Creates an adapter in FREE mode (no API key) for testing basic functionality.
 *
 * @param cwd - Working directory (defaults to temp directory)
 * @param config - Optional configuration overrides
 * @returns ClaudeCodeCLIAdapter instance
 */
export async function createMockAdapter(
  cwd?: string,
  config?: Partial<Omit<AdapterConfig, 'cwd'>>
): Promise<ClaudeCodeCLIAdapter> {
  const testCwd = cwd || await createTestDir()

  return new ClaudeCodeCLIAdapter({
    cwd: testCwd,
    debug: false, // Disable debug output in tests
    ...config,
  })
}

/**
 * Create a mock adapter with debug logging enabled
 *
 * @param cwd - Working directory
 * @param config - Optional configuration overrides
 * @returns ClaudeCodeCLIAdapter instance
 */
export async function createDebugMockAdapter(
  cwd?: string,
  config?: Partial<Omit<AdapterConfig, 'cwd' | 'debug'>>
): Promise<ClaudeCodeCLIAdapter> {
  return createMockAdapter(cwd, {
    ...config,
    debug: true,
  })
}

// ============================================================================
// Mock Agent Definitions
// ============================================================================

/**
 * Create a simple mock agent definition
 *
 * @param overrides - Optional property overrides
 * @returns AgentDefinition
 */
export function createMockAgent(
  overrides?: Partial<AgentDefinition>
): AgentDefinition {
  return {
    id: 'test-agent',
    displayName: 'Test Agent',
    description: 'A simple test agent',
    version: '1.0.0',
    systemPrompt: 'You are a helpful test agent.',
    toolNames: ['read_files', 'write_file'],
    outputMode: 'last_message',
    ...overrides,
  }
}

/**
 * Create a mock agent with handleSteps generator
 *
 * @param stepsFn - Generator function for handleSteps
 * @param overrides - Optional property overrides
 * @returns AgentDefinition
 */
export function createMockAgentWithSteps(
  stepsFn: AgentDefinition['handleSteps'],
  overrides?: Partial<AgentDefinition>
): AgentDefinition {
  return createMockAgent({
    handleSteps: stepsFn,
    ...overrides,
  })
}

// ============================================================================
// Mock Tool Executor
// ============================================================================

/**
 * Tool executor function type
 */
export type ToolExecutor = (toolCall: ToolCall) => Promise<ToolResultOutput[]>

/**
 * Create a mock tool executor
 *
 * Returns a function that tracks tool calls and returns mock results.
 *
 * @param mockResults - Optional map of tool names to their mock results
 * @returns Object with executor function and call tracking
 */
export function createMockToolExecutor(
  mockResults?: Record<string, ToolResultOutput[]>
): {
  executor: ToolExecutor
  calls: ToolCall[]
  getCalls: (toolName: string) => ToolCall[]
  reset: () => void
} {
  const calls: ToolCall[] = []

  const executor: ToolExecutor = async (toolCall: ToolCall) => {
    calls.push(toolCall)

    // Return mock result if provided
    if (mockResults && mockResults[toolCall.toolName]) {
      return mockResults[toolCall.toolName]
    }

    // Default mock result
    return [
      {
        type: 'json',
        value: {
          success: true,
          tool: toolCall.toolName,
          input: toolCall.input,
        },
      },
    ]
  }

  return {
    executor,
    calls,
    getCalls: (toolName: string) => calls.filter(c => c.toolName === toolName),
    reset: () => {
      calls.length = 0
    },
  }
}

// ============================================================================
// Mock LLM Executor
// ============================================================================

/**
 * LLM executor function type
 */
export type LLMExecutor = (
  mode: 'STEP' | 'STEP_ALL'
) => Promise<{ endTurn: boolean; agentState: any }>

/**
 * Create a mock LLM executor
 *
 * @param responses - Array of responses to return (cycles through them)
 * @returns Object with executor function and call tracking
 */
export function createMockLLMExecutor(
  responses: Array<{ endTurn: boolean; agentState?: any }> = []
): {
  executor: LLMExecutor
  calls: Array<{ mode: 'STEP' | 'STEP_ALL' }>
  reset: () => void
} {
  const calls: Array<{ mode: 'STEP' | 'STEP_ALL' }> = []
  let callIndex = 0

  const executor: LLMExecutor = async (mode: 'STEP' | 'STEP_ALL') => {
    calls.push({ mode })

    // Return mock response if provided
    if (responses.length > 0) {
      const response = responses[callIndex % responses.length]
      callIndex++
      return {
        endTurn: response.endTurn,
        agentState: response.agentState || {
          agentId: 'test-agent-id',
          runId: 'test-run-id',
          messageHistory: [],
          output: undefined,
        },
      }
    }

    // Default response
    return {
      endTurn: true,
      agentState: {
        agentId: 'test-agent-id',
        runId: 'test-run-id',
        messageHistory: [],
        output: undefined,
      },
    }
  }

  return {
    executor,
    calls,
    reset: () => {
      calls.length = 0
      callIndex = 0
    },
  }
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that a tool result is successful
 *
 * @param result - Tool result to check
 */
export function assertToolSuccess(result: ToolResultOutput[]): void {
  expect(result).toBeDefined()
  expect(result.length).toBeGreaterThan(0)

  const firstResult = result[0]
  if (firstResult.type === 'json') {
    expect(firstResult.value).toBeDefined()
    if ('success' in firstResult.value) {
      expect(firstResult.value.success).toBe(true)
    }
  }
}

/**
 * Assert that a tool result is an error
 *
 * @param result - Tool result to check
 */
export function assertToolError(result: ToolResultOutput[]): void {
  expect(result).toBeDefined()
  expect(result.length).toBeGreaterThan(0)

  const firstResult = result[0]
  if (firstResult.type === 'json') {
    expect(firstResult.value).toBeDefined()
    if ('success' in firstResult.value) {
      expect(firstResult.value.success).toBe(false)
    }
    if ('error' in firstResult.value) {
      expect(firstResult.value.error).toBeDefined()
    }
  }
}

/**
 * Extract JSON value from tool result
 *
 * @param result - Tool result
 * @returns JSON value or undefined
 */
export function getToolResultValue<T = any>(result: ToolResultOutput[]): T | undefined {
  if (result.length === 0) return undefined

  const firstResult = result[0]
  if (firstResult.type === 'json') {
    return firstResult.value as T
  }

  return undefined
}

// ============================================================================
// Time Utilities
// ============================================================================

/**
 * Measure execution time of a function
 *
 * @param fn - Function to measure
 * @returns Object with result and execution time in milliseconds
 */
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; timeMs: number }> {
  const start = Date.now()
  const result = await fn()
  const timeMs = Date.now() - start

  return { result, timeMs }
}

// ============================================================================
// Mock File System Utilities
// ============================================================================

/**
 * Create a mock project structure
 *
 * Creates a realistic project structure with common files.
 *
 * @param dir - Base directory
 * @returns Object with paths to created files
 */
export async function createMockProject(dir: string): Promise<{
  packageJson: string
  tsconfig: string
  srcIndex: string
  srcTypes: string
  testFile: string
  readme: string
}> {
  const files = {
    'package.json': JSON.stringify(
      {
        name: 'test-project',
        version: '1.0.0',
        main: 'dist/index.js',
        scripts: {
          build: 'tsc',
          test: 'jest',
        },
      },
      null,
      2
    ),
    'tsconfig.json': JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          outDir: './dist',
          rootDir: './src',
        },
      },
      null,
      2
    ),
    'src/index.ts': 'export const hello = () => "world"',
    'src/types.ts': 'export interface User { id: string; name: string }',
    'src/index.test.ts': 'import { hello } from "./index"\ntest("hello", () => expect(hello()).toBe("world"))',
    'README.md': '# Test Project\n\nThis is a test project.',
  }

  await createTestFiles(dir, files)

  return {
    packageJson: path.join(dir, 'package.json'),
    tsconfig: path.join(dir, 'tsconfig.json'),
    srcIndex: path.join(dir, 'src/index.ts'),
    srcTypes: path.join(dir, 'src/types.ts'),
    testFile: path.join(dir, 'src/index.test.ts'),
    readme: path.join(dir, 'README.md'),
  }
}
