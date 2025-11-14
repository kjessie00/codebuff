/**
 * Example 11: Test Counter Agent
 *
 * Counts test files and test cases in a project.
 *
 * Features:
 * - Find all test files
 * - Count describe/it blocks
 * - Calculate test coverage
 * - Generate test statistics
 *
 * Tools used: find_files, code_search, set_output
 */

import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'

export const testCounterAgent: AgentDefinition = {
  id: 'test-counter',
  displayName: 'Test Counter',
  systemPrompt: 'You count tests in a project.',
  toolNames: ['find_files', 'code_search', 'set_output'],
  outputMode: 'structured_output',

  async *handleSteps(context) {
    // Find test files
    const findResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'find_files',
        input: { pattern: '**/*.{test,spec}.{ts,js}' },
      },
    }

    const testFiles = findResult[0]?.value?.files || []

    // Count describe blocks
    const describeResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'code_search',
        input: {
          query: 'describe\\(',
          file_pattern: '*.{test,spec}.{ts,js}',
        },
      },
    }

    // Count it/test blocks
    const itResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'code_search',
        input: {
          query: '\\b(it|test)\\(',
          file_pattern: '*.{test,spec}.{ts,js}',
        },
      },
    }

    const describeCount = describeResult[0]?.value?.total || 0
    const itCount = itResult[0]?.value?.total || 0

    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: {
          output: {
            testFiles: testFiles.length,
            testSuites: describeCount,
            testCases: itCount,
            avgTestsPerFile: testFiles.length > 0
              ? Math.round(itCount / testFiles.length)
              : 0,
            files: testFiles,
          },
        },
      },
    }

    return 'DONE'
  },
}

export async function runTestCounterExample() {
  console.log('=== Test Counter Agent Example ===\n')

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    debug: false,
  })

  adapter.registerAgent(testCounterAgent)

  const result = await adapter.executeAgent(
    testCounterAgent,
    'Count tests'
  )

  const output = result.output as any
  console.log('Test files:', output.testFiles)
  console.log('Test suites:', output.testSuites)
  console.log('Test cases:', output.testCases)
  console.log('\n✅ Test Counter example completed!')
}

if (require.main === module) {
  runTestCounterExample().catch(console.error)
}
