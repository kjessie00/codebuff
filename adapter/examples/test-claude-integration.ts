/**
 * Test Example: Claude Integration
 *
 * This example demonstrates the Claude LLM integration in the adapter.
 * It shows how the adapter can now invoke Claude and handle tool calls.
 *
 * Run this example:
 * 1. Set your ANTHROPIC_API_KEY environment variable
 * 2. Build the adapter: npm run build
 * 3. Run: npx tsx examples/test-claude-integration.ts
 */

import { createDebugAdapter } from '../src'
import type { AgentDefinition } from '../../.agents/types/agent-definition'

// ============================================================================
// Example Agents
// ============================================================================

/**
 * Simple agent that asks Claude a question
 */
const simpleAgent: AgentDefinition = {
  id: 'simple-test',
  displayName: 'Simple Test Agent',
  model: 'claude-sonnet-4-20250514',
  systemPrompt: 'You are a helpful assistant.',
  toolNames: [], // No tools needed
}

/**
 * File operation agent that reads a file
 */
const fileAgent: AgentDefinition = {
  id: 'file-test',
  displayName: 'File Test Agent',
  model: 'claude-sonnet-4-20250514',
  systemPrompt: 'You are a file analysis assistant.',
  toolNames: ['read_files'],
}

/**
 * Multi-tool agent that can search code and run commands
 */
const multiToolAgent: AgentDefinition = {
  id: 'multi-tool-test',
  displayName: 'Multi-Tool Test Agent',
  model: 'claude-sonnet-4-20250514',
  systemPrompt: 'You are a code analysis assistant with access to search and terminal tools.',
  toolNames: ['find_files', 'code_search', 'run_terminal_command'],
}

// ============================================================================
// Test Functions
// ============================================================================

/**
 * Test 1: Simple conversation (no tools)
 */
async function testSimpleConversation() {
  console.log('\n=== Test 1: Simple Conversation ===\n')

  const adapter = createDebugAdapter(process.cwd())

  try {
    const result = await adapter.executeAgent(
      simpleAgent,
      'What is 2 + 2? Please answer concisely.'
    )

    console.log('Response:', result.output)
    console.log('Message count:', result.messageHistory.length)
    console.log('Execution time:', result.metadata?.executionTime, 'ms')
  } catch (error) {
    console.error('Error:', error)
  }
}

/**
 * Test 2: File operations
 */
async function testFileOperations() {
  console.log('\n=== Test 2: File Operations ===\n')

  const adapter = createDebugAdapter(process.cwd())

  try {
    const result = await adapter.executeAgent(
      fileAgent,
      'Read the package.json file and tell me the package name and version.'
    )

    console.log('Response:', result.output)
    console.log('Message count:', result.messageHistory.length)
    console.log('Execution time:', result.metadata?.executionTime, 'ms')
  } catch (error) {
    console.error('Error:', error)
  }
}

/**
 * Test 3: Multi-tool usage
 */
async function testMultiToolUsage() {
  console.log('\n=== Test 3: Multi-Tool Usage ===\n')

  const adapter = createDebugAdapter(process.cwd())

  try {
    const result = await adapter.executeAgent(
      multiToolAgent,
      'Find all TypeScript files in the src directory and count them.'
    )

    console.log('Response:', result.output)
    console.log('Message count:', result.messageHistory.length)
    console.log('Execution time:', result.metadata?.executionTime, 'ms')
  } catch (error) {
    console.error('Error:', error)
  }
}

/**
 * Test 4: Agent with handleSteps (programmatic control)
 */
async function testHandleSteps() {
  console.log('\n=== Test 4: HandleSteps Agent ===\n')

  const handleStepsAgent: AgentDefinition = {
    id: 'handlesteps-test',
    displayName: 'HandleSteps Test Agent',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: 'You are a helpful assistant.',
    toolNames: ['read_files'],

    *handleSteps(context) {
      // Step 1: Read package.json
      console.log('Step 1: Reading package.json...')
      const { toolResult } = yield {
        toolName: 'read_files',
        input: { paths: ['package.json'] },
      }

      console.log('Tool result received:', toolResult)

      // Step 2: Ask Claude to analyze it
      console.log('Step 2: Asking Claude to analyze...')
      yield 'STEP'

      // Step 3: Return output
      yield {
        toolName: 'set_output',
        input: {
          output: {
            summary: 'Analysis complete',
            analyzed: true,
          },
        },
      }
    },
  }

  const adapter = createDebugAdapter(process.cwd())

  try {
    const result = await adapter.executeAgent(
      handleStepsAgent,
      'Analyze the package.json file'
    )

    console.log('Response:', result.output)
    console.log('Iteration count:', result.metadata?.iterationCount)
    console.log('Completed normally:', result.metadata?.completedNormally)
    console.log('Execution time:', result.metadata?.executionTime, 'ms')
  } catch (error) {
    console.error('Error:', error)
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('Claude Integration Test Suite')
  console.log('==============================')

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('\nError: ANTHROPIC_API_KEY environment variable not set!')
    console.error('Please set it to your Anthropic API key.')
    console.error('\nExample:')
    console.error('  export ANTHROPIC_API_KEY=sk-ant-...')
    process.exit(1)
  }

  console.log('\nAPI Key found, running tests...\n')

  try {
    // Run all tests
    await testSimpleConversation()
    await testFileOperations()
    await testMultiToolUsage()
    await testHandleSteps()

    console.log('\n✅ All tests completed!\n')
  } catch (error) {
    console.error('\n❌ Test suite failed:',  error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { testSimpleConversation, testFileOperations, testMultiToolUsage, testHandleSteps }
