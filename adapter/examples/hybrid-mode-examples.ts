/**
 * Hybrid Mode Examples
 *
 * This file demonstrates how to use the Claude CLI adapter in both
 * FREE mode (no API key) and PAID mode (with API key).
 *
 * See HYBRID_MODE_GUIDE.md for complete documentation.
 */

import { ClaudeCodeCLIAdapter } from '../src/claude-cli-adapter'
import type { AgentDefinition } from '../../.agents/types/agent-definition'

// ============================================================================
// Example 1: FREE Mode (No API Key)
// ============================================================================

/**
 * Example 1: FREE Mode
 *
 * Cost: $0.00
 * Works: All tools except spawn_agents
 * Use case: Simple file operations, code search, terminal commands
 */
async function example1_FreeMode() {
  console.log('=== Example 1: FREE Mode ===\n')

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    debug: true, // Shows "No API key - Free mode (spawn_agents disabled)"
  })

  // Register a simple agent that doesn't use spawn_agents
  const simpleAgent: AgentDefinition = {
    id: 'simple-file-reader',
    displayName: 'Simple File Reader',
    systemPrompt: 'You are a file reading assistant.',
    toolNames: ['read_files', 'code_search', 'find_files'],
    outputMode: 'last_message',
  }

  adapter.registerAgent(simpleAgent)

  // This works in FREE mode!
  try {
    const result = await adapter.executeAgent(
      simpleAgent,
      'Find all TypeScript files in the src directory'
    )

    console.log('Result:', result.output)
  } catch (error) {
    console.error('Error:', error.message)
  }

  console.log('\n✅ FREE mode example completed\n')
}

// ============================================================================
// Example 2: PAID Mode (With API Key)
// ============================================================================

/**
 * Example 2: PAID Mode
 *
 * Cost: ~$3-15 per 1M tokens
 * Works: Everything including spawn_agents
 * Use case: Complex multi-agent workflows
 */
async function example2_PaidMode() {
  console.log('=== Example 2: PAID Mode ===\n')

  // Check if API key is available
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('⚠️  Skipping PAID mode example - ANTHROPIC_API_KEY not set')
    console.log('Set API key to run this example:')
    console.log('  export ANTHROPIC_API_KEY="sk-ant-..."')
    return
  }

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY, // Enable PAID features
    debug: true, // Shows "API key detected - Full multi-agent support enabled"
  })

  // Register agents that use spawn_agents
  const orchestratorAgent: AgentDefinition = {
    id: 'orchestrator',
    displayName: 'Multi-Agent Orchestrator',
    systemPrompt: 'You orchestrate multiple agents to complete complex tasks.',
    toolNames: ['spawn_agents', 'set_output'],
    outputMode: 'structured_output',
  }

  const workerAgent: AgentDefinition = {
    id: 'worker',
    displayName: 'Worker Agent',
    systemPrompt: 'You perform specific tasks.',
    toolNames: ['read_files', 'write_file', 'code_search'],
    outputMode: 'last_message',
  }

  adapter.registerAgent(orchestratorAgent)
  adapter.registerAgent(workerAgent)

  // This works in PAID mode!
  try {
    const result = await adapter.executeAgent(
      orchestratorAgent,
      'Analyze the codebase and generate a summary'
    )

    console.log('Result:', result.output)
  } catch (error) {
    console.error('Error:', error.message)
  }

  console.log('\n✅ PAID mode example completed\n')
}

// ============================================================================
// Example 3: Graceful Fallback
// ============================================================================

/**
 * Example 3: Graceful Fallback
 *
 * Detect whether API key is available and adjust behavior accordingly.
 */
async function example3_GracefulFallback() {
  console.log('=== Example 3: Graceful Fallback ===\n')

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY, // May be undefined
    debug: true,
  })

  // Check if API key is available
  if (!adapter.hasApiKeyAvailable()) {
    console.log('⚠️  Running in FREE mode - spawn_agents disabled')
    console.log('Set ANTHROPIC_API_KEY to enable multi-agent features\n')

    // Use simpler workflow without spawn_agents
    const simpleAgent: AgentDefinition = {
      id: 'simple-workflow',
      displayName: 'Simple Workflow',
      systemPrompt: 'You perform simple file operations.',
      toolNames: ['read_files', 'write_file', 'code_search'],
      outputMode: 'last_message',
    }

    adapter.registerAgent(simpleAgent)

    const result = await adapter.executeAgent(
      simpleAgent,
      'List all TypeScript files'
    )

    console.log('Result:', result.output)
  } else {
    console.log('✅ PAID mode enabled - full features available\n')

    // Use complex workflow with spawn_agents
    const complexAgent: AgentDefinition = {
      id: 'complex-workflow',
      displayName: 'Complex Workflow',
      systemPrompt: 'You orchestrate complex multi-agent workflows.',
      toolNames: ['spawn_agents', 'set_output'],
      outputMode: 'structured_output',
    }

    adapter.registerAgent(complexAgent)

    const result = await adapter.executeAgent(
      complexAgent,
      'Analyze codebase with multiple agents'
    )

    console.log('Result:', result.output)
  }

  console.log('\n✅ Graceful fallback example completed\n')
}

// ============================================================================
// Example 4: Conditional API Key Usage
// ============================================================================

/**
 * Example 4: Conditional API Key Usage
 *
 * Only use API key when actually needed for spawn_agents.
 */
async function example4_ConditionalApiKeyUsage() {
  console.log('=== Example 4: Conditional API Key Usage ===\n')

  // Determine if task requires multi-agent orchestration
  const userRequest = 'Read all files in src/'
  const needsMultiAgent = userRequest.includes('orchestrate') ||
                           userRequest.includes('multiple agents')

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    // Only use API key if multi-agent is needed
    anthropicApiKey: needsMultiAgent ? process.env.ANTHROPIC_API_KEY : undefined,
    debug: true,
  })

  if (!needsMultiAgent) {
    console.log('💰 Running in FREE mode - no costs incurred\n')
  } else {
    console.log('💳 Running in PAID mode - API costs will apply\n')
  }

  // Execute appropriate workflow
  const agent: AgentDefinition = {
    id: needsMultiAgent ? 'multi-agent-workflow' : 'simple-workflow',
    displayName: needsMultiAgent ? 'Multi-Agent Workflow' : 'Simple Workflow',
    systemPrompt: 'You complete the requested task.',
    toolNames: needsMultiAgent ?
      ['spawn_agents', 'set_output'] :
      ['read_files', 'write_file', 'code_search'],
    outputMode: 'last_message',
  }

  adapter.registerAgent(agent)

  try {
    const result = await adapter.executeAgent(agent, userRequest)
    console.log('Result:', result.output)
  } catch (error) {
    console.error('Error:', error.message)
  }

  console.log('\n✅ Conditional API key usage example completed\n')
}

// ============================================================================
// Example 5: Error Handling for spawn_agents
// ============================================================================

/**
 * Example 5: Error Handling
 *
 * Handle the case where spawn_agents is called without API key.
 */
async function example5_ErrorHandling() {
  console.log('=== Example 5: Error Handling ===\n')

  // Create adapter WITHOUT API key
  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    // No API key - FREE mode
  })

  // Try to use spawn_agents (will get error message)
  const multiAgentWorkflow: AgentDefinition = {
    id: 'multi-agent-workflow',
    displayName: 'Multi-Agent Workflow',
    systemPrompt: 'You orchestrate multiple agents.',
    toolNames: ['spawn_agents', 'set_output'],
    outputMode: 'last_message',

    // This handleSteps will try to call spawn_agents
    async *handleSteps(context) {
      // This will return an error message instead of spawning agents
      const spawnResult = yield {
        type: 'TOOL_CALL',
        toolCall: {
          toolName: 'spawn_agents',
          input: {
            agents: [
              { agentId: 'worker', prompt: 'Do some work' },
            ],
          },
        },
      }

      // Check if it's an error
      if (spawnResult[0]?.type === 'text' &&
          spawnResult[0]?.value.includes('ERROR')) {
        console.log('Received expected error:\n')
        console.log(spawnResult[0].value)

        // Handle gracefully - inform user
        yield {
          type: 'TOOL_CALL',
          toolCall: {
            toolName: 'set_output',
            input: {
              output: {
                error: 'spawn_agents requires API key',
                suggestion: 'Run in FREE mode with simpler workflow',
              },
            },
          },
        }
      }

      return 'DONE'
    },
  }

  adapter.registerAgent(multiAgentWorkflow)

  try {
    const result = await adapter.executeAgent(
      multiAgentWorkflow,
      'Try to spawn agents'
    )

    console.log('\nFinal result:', result.output)
  } catch (error) {
    console.error('Error:', error.message)
  }

  console.log('\n✅ Error handling example completed\n')
}

// ============================================================================
// Example 6: Using Both Modes
// ============================================================================

/**
 * Example 6: Using Both Modes
 *
 * Create separate adapters for FREE and PAID operations.
 */
async function example6_UsingBothModes() {
  console.log('=== Example 6: Using Both Modes ===\n')

  // FREE adapter for simple operations
  const freeAdapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    // No API key
  })

  // PAID adapter for complex operations (if API key available)
  const paidAdapter = process.env.ANTHROPIC_API_KEY ?
    new ClaudeCodeCLIAdapter({
      cwd: process.cwd(),
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    }) : null

  // Simple agent for FREE mode
  const simpleAgent: AgentDefinition = {
    id: 'simple-agent',
    displayName: 'Simple Agent',
    systemPrompt: 'You perform simple operations.',
    toolNames: ['read_files', 'code_search'],
    outputMode: 'last_message',
  }

  freeAdapter.registerAgent(simpleAgent)

  console.log('Using FREE adapter for simple task...')
  const freeResult = await freeAdapter.executeAgent(
    simpleAgent,
    'List files'
  )
  console.log('FREE result:', freeResult.output)

  // Complex agent for PAID mode
  if (paidAdapter) {
    const complexAgent: AgentDefinition = {
      id: 'complex-agent',
      displayName: 'Complex Agent',
      systemPrompt: 'You orchestrate complex workflows.',
      toolNames: ['spawn_agents', 'set_output'],
      outputMode: 'structured_output',
    }

    paidAdapter.registerAgent(complexAgent)

    console.log('\nUsing PAID adapter for complex task...')
    const paidResult = await paidAdapter.executeAgent(
      complexAgent,
      'Run multi-agent workflow'
    )
    console.log('PAID result:', paidResult.output)
  } else {
    console.log('\n⚠️  Skipping PAID mode - API key not available')
  }

  console.log('\n✅ Using both modes example completed\n')
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('HYBRID MODE EXAMPLES\n')
  console.log('These examples demonstrate FREE and PAID mode usage.\n')
  console.log('='repeat(60) + '\n')

  try {
    // Run examples
    await example1_FreeMode()
    await example2_PaidMode()
    await example3_GracefulFallback()
    await example4_ConditionalApiKeyUsage()
    await example5_ErrorHandling()
    await example6_UsingBothModes()

    console.log('\n' + '='.repeat(60))
    console.log('All examples completed!')
    console.log('\nFor more information, see:')
    console.log('- HYBRID_MODE_GUIDE.md')
    console.log('- README.md')
  } catch (error) {
    console.error('Example failed:', error)
    process.exit(1)
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

// Export for use in other files
export {
  example1_FreeMode,
  example2_PaidMode,
  example3_GracefulFallback,
  example4_ConditionalApiKeyUsage,
  example5_ErrorHandling,
  example6_UsingBothModes,
}
