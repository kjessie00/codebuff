/**
 * Test file for Claude CLI Integration
 *
 * This tests the FREE Claude Code CLI subprocess integration (NO API keys required)
 *
 * Usage:
 *   npm run build
 *   node dist/test-cli-integration.js
 *
 * Or with ts-node:
 *   npx ts-node test-cli-integration.ts
 */

import { ClaudeCLIIntegration } from './src/claude-cli-integration'
import type { ToolCall } from '../.agents/types/agent-definition'
import type { ToolResultOutput } from '../.agents/types/util-types'

/**
 * Simple tool executor for testing
 * In a real implementation, this would use the actual tool implementations
 */
async function mockToolExecutor(toolCall: ToolCall): Promise<ToolResultOutput[]> {
  console.log(`[MockTool] Executing: ${toolCall.toolName}`, toolCall.input)

  // Simulate tool execution
  switch (toolCall.toolName) {
    case 'read_files':
      return [
        {
          type: 'json',
          value: {
            'test.txt': 'Hello, World!\nThis is a test file.',
          },
        },
      ]

    case 'write_file':
      return [
        {
          type: 'json',
          value: {
            success: true,
            path: toolCall.input.path,
          },
        },
      ]

    case 'code_search':
      return [
        {
          type: 'json',
          value: {
            results: [
              {
                file: 'src/index.ts',
                line: 42,
                content: 'console.log("Hello")',
              },
            ],
            total: 1,
          },
        },
      ]

    default:
      return [
        {
          type: 'json',
          value: {
            success: true,
            message: `Mock execution of ${toolCall.toolName}`,
          },
        },
      ]
  }
}

/**
 * Test basic CLI integration
 */
async function testBasicIntegration() {
  console.log('\n=== Test 1: Basic Claude CLI Integration ===\n')

  const integration = new ClaudeCLIIntegration({
    debug: true,
    timeout: 30000, // 30 seconds
    logger: (msg, data) => {
      if (data) {
        console.log(msg, JSON.stringify(data, null, 2))
      } else {
        console.log(msg)
      }
    },
  })

  try {
    const response = await integration.invoke(
      {
        systemPrompt: 'You are a helpful assistant.',
        messages: [
          {
            role: 'user',
            content: 'What is 2 + 2? Please respond with just the number.',
          },
        ],
        tools: [], // No tools for this simple test
        timeout: 30000,
      },
      mockToolExecutor
    )

    console.log('\n✅ Response received:', response)
    return true
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    return false
  }
}

/**
 * Test CLI integration with tools
 */
async function testWithTools() {
  console.log('\n=== Test 2: Claude CLI Integration with Tools ===\n')

  const integration = new ClaudeCLIIntegration({
    debug: true,
    timeout: 30000,
    logger: (msg, data) => {
      if (data) {
        console.log(msg, JSON.stringify(data, null, 2))
      } else {
        console.log(msg)
      }
    },
  })

  try {
    const response = await integration.invoke(
      {
        systemPrompt:
          'You are a helpful assistant with access to file operations.',
        messages: [
          {
            role: 'user',
            content:
              'Please search for the pattern "console.log" in the codebase.',
          },
        ],
        tools: ['code_search'], // Enable code search tool
        timeout: 30000,
      },
      mockToolExecutor
    )

    console.log('\n✅ Response with tools received:', response)
    return true
  } catch (error) {
    console.error('\n❌ Test with tools failed:', error)
    return false
  }
}

/**
 * Test error handling
 */
async function testErrorHandling() {
  console.log('\n=== Test 3: Error Handling ===\n')

  const integration = new ClaudeCLIIntegration({
    claudePath: '/nonexistent/claude', // Invalid path to test error handling
    debug: true,
    timeout: 5000,
    logger: (msg, data) => {
      if (data) {
        console.log(msg, JSON.stringify(data, null, 2))
      } else {
        console.log(msg)
      }
    },
  })

  try {
    await integration.invoke(
      {
        systemPrompt: 'You are a helpful assistant.',
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
        tools: [],
        timeout: 5000,
      },
      mockToolExecutor
    )

    console.log('\n❌ Expected error but got success')
    return false
  } catch (error) {
    if (error instanceof Error && error.message.includes('spawn')) {
      console.log('\n✅ Error handling works correctly:', error.message)
      return true
    } else {
      console.error('\n❌ Unexpected error:', error)
      return false
    }
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗')
  console.log('║  Claude Code CLI Integration Test Suite               ║')
  console.log('║  FREE - No API Keys Required                           ║')
  console.log('║  Uses Your Existing Claude Code CLI Subscription      ║')
  console.log('╚════════════════════════════════════════════════════════╝')

  const results = {
    basicIntegration: false,
    withTools: false,
    errorHandling: false,
  }

  console.log('\n📝 Note: These tests use SUBPROCESS calls to Claude CLI')
  console.log('   No API keys needed, completely FREE execution\n')

  // Run tests
  results.basicIntegration = await testBasicIntegration()
  results.withTools = await testWithTools()
  results.errorHandling = await testErrorHandling()

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('Test Summary:')
  console.log('='.repeat(60))
  console.log(`Basic Integration:  ${results.basicIntegration ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`With Tools:         ${results.withTools ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Error Handling:     ${results.errorHandling ? '✅ PASS' : '❌ FAIL'}`)
  console.log('='.repeat(60))

  const allPassed = Object.values(results).every((r) => r)

  if (allPassed) {
    console.log('\n🎉 All tests passed!')
    console.log('✅ Claude CLI integration is working correctly')
    console.log('💰 Running 100% FREE - No API costs!')
    process.exit(0)
  } else {
    console.log('\n❌ Some tests failed')
    console.log('Please check the logs above for details')
    process.exit(1)
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { testBasicIntegration, testWithTools, testErrorHandling }
