/**
 * Complete Integration Example - ClaudeCodeCLIAdapter with Commander Agent
 *
 * This example demonstrates the complete integration flow of the ClaudeCodeCLIAdapter
 * with a real agent definition (Commander Agent). It shows:
 *
 * 1. Setting up the adapter with proper configuration
 * 2. Registering agents into the system
 * 3. Executing agents with various parameters
 * 4. Handling results and errors
 * 5. Best practices for production use
 *
 * The Commander Agent is a specialized agent that runs terminal commands
 * and analyzes their output based on user requests. It's perfect for
 * demonstrating the adapter's capabilities because it:
 * - Uses handleSteps generator for programmatic control
 * - Executes terminal commands via tools
 * - Returns structured output
 * - Demonstrates real-world agent behavior
 *
 * Usage:
 * ```bash
 * ts-node examples/complete-integration.ts
 * ```
 *
 * @module examples/complete-integration
 */

import path from 'path'
import {
  ClaudeCodeCLIAdapter,
  createAdapter,
  createDebugAdapter,
  type AgentExecutionResult,
} from '../src/claude-cli-adapter'

// Import the commander agent definition
import commanderAgent from '../../.agents/commander'
import type { AgentDefinition } from '../../.agents/types/agent-definition'

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get the project root directory
 * This is where all file operations will be relative to
 */
const PROJECT_ROOT = path.resolve(__dirname, '../..')

/**
 * Configuration for the adapter
 * These settings control how the adapter behaves
 */
const ADAPTER_CONFIG = {
  cwd: PROJECT_ROOT,
  maxSteps: 20, // Maximum steps per agent execution
  debug: true, // Enable detailed logging
  env: {
    // Environment variables available to all commands
    NODE_ENV: 'development',
    LOG_LEVEL: 'info',
  },
}

// ============================================================================
// Example 1: Basic Setup and Agent Registration
// ============================================================================

/**
 * Demonstrates how to set up the adapter and register agents
 *
 * This is the foundation for all agent execution. The adapter must be
 * initialized with configuration and agents must be registered before use.
 */
function example1_BasicSetup() {
  console.log('\n' + '='.repeat(80))
  console.log('Example 1: Basic Setup and Agent Registration')
  console.log('='.repeat(80) + '\n')

  // Step 1: Create the adapter
  // Use createAdapter for basic setup or createDebugAdapter for debug mode
  console.log('Step 1: Creating the ClaudeCodeCLIAdapter...')
  const adapter = createDebugAdapter(PROJECT_ROOT, {
    maxSteps: ADAPTER_CONFIG.maxSteps,
    env: ADAPTER_CONFIG.env,
  })
  console.log('✓ Adapter created successfully\n')

  // Step 2: Register the commander agent
  // Agents must be registered before they can be executed or spawned
  console.log('Step 2: Registering the Commander Agent...')
  adapter.registerAgent(commanderAgent)
  console.log('✓ Commander agent registered\n')

  // Step 3: Verify registration
  // List all registered agents to confirm
  console.log('Step 3: Verifying registered agents...')
  const registeredAgents = adapter.listAgents()
  console.log('Registered agents:', registeredAgents)

  // Get detailed info about the commander agent
  const agentInfo = adapter.getAgent('commander')
  if (agentInfo) {
    console.log('\nCommander Agent Details:')
    console.log('  ID:', agentInfo.id)
    console.log('  Display Name:', agentInfo.displayName)
    console.log('  Model:', agentInfo.model)
    console.log('  Output Mode:', agentInfo.outputMode)
    console.log('  Has handleSteps:', !!agentInfo.handleSteps)
    console.log('  Tool Names:', agentInfo.toolNames?.join(', '))
  }
  console.log('✓ Registration verified\n')

  return adapter
}

// ============================================================================
// Example 2: Executing Commander Agent with Git Status
// ============================================================================

/**
 * Demonstrates executing the commander agent with a real command
 *
 * This example shows how to:
 * - Prepare agent parameters
 * - Execute the agent
 * - Handle the results
 * - Extract meaningful information
 */
async function example2_ExecuteGitStatus(adapter: ClaudeCodeCLIAdapter) {
  console.log('\n' + '='.repeat(80))
  console.log('Example 2: Executing Commander Agent - Git Status')
  console.log('='.repeat(80) + '\n')

  try {
    // Step 1: Prepare the execution parameters
    console.log('Step 1: Preparing execution parameters...')

    // The prompt tells the agent what information we want from the output
    const prompt = 'Analyze the git status and tell me if there are any uncommitted changes'

    // Parameters specify the command to run and optional timeout
    const params = {
      command: 'git status --short',
      timeout_seconds: 10,
    }

    console.log('  Prompt:', prompt)
    console.log('  Command:', params.command)
    console.log('  Timeout:', params.timeout_seconds, 'seconds\n')

    // Step 2: Execute the agent
    console.log('Step 2: Executing the commander agent...')
    const startTime = Date.now()

    const result: AgentExecutionResult = await adapter.executeAgent(
      commanderAgent,
      prompt,
      params
    )

    const executionTime = Date.now() - startTime
    console.log(`✓ Agent execution completed in ${executionTime}ms\n`)

    // Step 3: Analyze the results
    console.log('Step 3: Analyzing execution results...')
    console.log('\n--- Agent Output ---')
    console.log(JSON.stringify(result.output, null, 2))

    console.log('\n--- Message History ---')
    console.log(`Total messages: ${result.messageHistory.length}`)
    result.messageHistory.forEach((msg, idx) => {
      console.log(`  [${idx}] ${msg.role}: ${msg.content.substring(0, 100)}...`)
    })

    console.log('\n--- Execution Metadata ---')
    if (result.metadata) {
      console.log('  Iteration Count:', result.metadata.iterationCount)
      console.log('  Completed Normally:', result.metadata.completedNormally)
      console.log('  Execution Time:', result.metadata.executionTime, 'ms')
    }

    console.log('\n✓ Results analyzed successfully\n')

    return result

  } catch (error) {
    console.error('\n✗ Error executing agent:', error)
    throw error
  }
}

// ============================================================================
// Example 3: Multiple Command Executions
// ============================================================================

/**
 * Demonstrates executing multiple different commands using the same adapter
 *
 * This shows how the adapter maintains state across multiple executions
 * and how each execution is isolated from the others.
 */
async function example3_MultipleCommands(adapter: ClaudeCodeCLIAdapter) {
  console.log('\n' + '='.repeat(80))
  console.log('Example 3: Multiple Command Executions')
  console.log('='.repeat(80) + '\n')

  // Define multiple commands to execute
  const commands = [
    {
      name: 'List TypeScript Files',
      prompt: 'Show me how many TypeScript files are in the adapter directory',
      command: 'find adapter -name "*.ts" -type f | wc -l',
    },
    {
      name: 'Check Node Version',
      prompt: 'What version of Node.js is installed?',
      command: 'node --version',
    },
    {
      name: 'Current Directory',
      prompt: 'What is the current working directory?',
      command: 'pwd',
    },
    {
      name: 'Git Branch',
      prompt: 'What git branch are we currently on?',
      command: 'git rev-parse --abbrev-ref HEAD',
    },
  ]

  const results: Array<{ name: string; success: boolean; output?: any; error?: string }> = []

  // Execute each command
  for (const cmd of commands) {
    console.log(`\nExecuting: ${cmd.name}`)
    console.log(`  Command: ${cmd.command}`)

    try {
      const result = await adapter.executeAgent(
        commanderAgent,
        cmd.prompt,
        { command: cmd.command, timeout_seconds: 5 }
      )

      results.push({
        name: cmd.name,
        success: true,
        output: result.output,
      })

      console.log('  ✓ Success')

    } catch (error) {
      results.push({
        name: cmd.name,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })

      console.log('  ✗ Failed:', error)
    }
  }

  // Summary
  console.log('\n--- Execution Summary ---')
  const successCount = results.filter(r => r.success).length
  console.log(`Total: ${results.length}`)
  console.log(`Successful: ${successCount}`)
  console.log(`Failed: ${results.length - successCount}`)

  console.log('\n--- Detailed Results ---')
  results.forEach((result, idx) => {
    console.log(`\n[${idx + 1}] ${result.name}`)
    console.log(`    Status: ${result.success ? '✓ Success' : '✗ Failed'}`)
    if (result.success && result.output) {
      console.log('    Output:', JSON.stringify(result.output).substring(0, 100))
    } else if (result.error) {
      console.log('    Error:', result.error)
    }
  })

  return results
}

// ============================================================================
// Example 4: Error Handling and Recovery
// ============================================================================

/**
 * Demonstrates comprehensive error handling patterns
 *
 * Shows how to handle:
 * - Invalid commands
 * - Timeout errors
 * - Missing parameters
 * - Agent execution failures
 */
async function example4_ErrorHandling(adapter: ClaudeCodeCLIAdapter) {
  console.log('\n' + '='.repeat(80))
  console.log('Example 4: Error Handling and Recovery')
  console.log('='.repeat(80) + '\n')

  // Test Case 1: Command that doesn't exist
  console.log('Test Case 1: Non-existent command')
  try {
    await adapter.executeAgent(
      commanderAgent,
      'Run this command',
      { command: 'this-command-does-not-exist' }
    )
    console.log('  ✗ Expected error but got success (unexpected!)')
  } catch (error) {
    console.log('  ✓ Caught expected error:', error instanceof Error ? error.message : error)
  }

  // Test Case 2: Command that times out
  console.log('\nTest Case 2: Command timeout')
  try {
    await adapter.executeAgent(
      commanderAgent,
      'Run this long command',
      {
        command: 'sleep 10',
        timeout_seconds: 2, // Will timeout after 2 seconds
      }
    )
    console.log('  ✗ Expected timeout but got success (unexpected!)')
  } catch (error) {
    console.log('  ✓ Caught expected timeout:', error instanceof Error ? error.message : error)
  }

  // Test Case 3: Missing required parameter
  console.log('\nTest Case 3: Missing command parameter')
  try {
    await adapter.executeAgent(
      commanderAgent,
      'Do something',
      {} // Missing 'command' parameter
    )
    console.log('  ⚠ Agent handled missing parameter gracefully')
  } catch (error) {
    console.log('  ✓ Caught expected error:', error instanceof Error ? error.message : error)
  }

  // Test Case 4: Invalid agent reference
  console.log('\nTest Case 4: Non-existent agent')
  try {
    const fakeAgent: AgentDefinition = {
      id: 'non-existent',
      displayName: 'Fake Agent',
      model: 'none',
      toolNames: ['fake_tool'],
    }

    await adapter.executeAgent(fakeAgent, 'Do something')
    console.log('  ⚠ Execution completed despite invalid agent')
  } catch (error) {
    console.log('  ✓ Caught expected error:', error instanceof Error ? error.message : error)
  }

  // Test Case 5: Recovery pattern - retry on failure
  console.log('\nTest Case 5: Retry pattern')
  const MAX_RETRIES = 3
  let retryCount = 0
  let success = false

  while (retryCount < MAX_RETRIES && !success) {
    try {
      console.log(`  Attempt ${retryCount + 1}/${MAX_RETRIES}`)

      await adapter.executeAgent(
        commanderAgent,
        'Get the current time',
        { command: 'date' }
      )

      success = true
      console.log('  ✓ Success on retry', retryCount + 1)

    } catch (error) {
      retryCount++
      if (retryCount >= MAX_RETRIES) {
        console.log('  ✗ Failed after', MAX_RETRIES, 'attempts')
      } else {
        console.log('  ⚠ Failed, retrying...')
      }
    }
  }

  console.log('\n✓ Error handling tests completed\n')
}

// ============================================================================
// Example 5: Advanced Usage - Custom Configuration
// ============================================================================

/**
 * Demonstrates advanced configuration options
 *
 * Shows how to customize:
 * - Working directory
 * - Environment variables
 * - Step limits
 * - Logging behavior
 */
async function example5_AdvancedConfiguration() {
  console.log('\n' + '='.repeat(80))
  console.log('Example 5: Advanced Configuration')
  console.log('='.repeat(80) + '\n')

  // Configuration 1: Custom working directory
  console.log('Configuration 1: Custom working directory')
  const adapterWithCustomCwd = createAdapter(
    path.join(PROJECT_ROOT, 'adapter'),
    { debug: false }
  )
  adapterWithCustomCwd.registerAgent(commanderAgent)

  console.log('  Working directory:', adapterWithCustomCwd.getCwd())

  const result1 = await adapterWithCustomCwd.executeAgent(
    commanderAgent,
    'Show current directory',
    { command: 'pwd' }
  )
  console.log('  Output:', result1.output)

  // Configuration 2: Custom environment variables
  console.log('\nConfiguration 2: Custom environment variables')
  const adapterWithEnv = createAdapter(PROJECT_ROOT, {
    debug: false,
    env: {
      CUSTOM_VAR: 'Hello from adapter!',
      APP_MODE: 'test',
    },
  })
  adapterWithEnv.registerAgent(commanderAgent)

  const result2 = await adapterWithEnv.executeAgent(
    commanderAgent,
    'Show CUSTOM_VAR environment variable',
    { command: 'echo $CUSTOM_VAR' }
  )
  console.log('  Output:', result2.output)

  // Configuration 3: Limited steps
  console.log('\nConfiguration 3: Step limit configuration')
  const adapterWithLimitedSteps = createAdapter(PROJECT_ROOT, {
    debug: false,
    maxSteps: 5, // Very low limit for demonstration
  })
  adapterWithLimitedSteps.registerAgent(commanderAgent)

  console.log('  Max steps:', adapterWithLimitedSteps.getConfig().maxSteps)

  // Configuration 4: Custom logger
  console.log('\nConfiguration 4: Custom logger')
  const logs: string[] = []
  const adapterWithCustomLogger = createAdapter(PROJECT_ROOT, {
    debug: true,
    logger: (message: string) => {
      logs.push(message)
      console.log('  [CustomLog]', message)
    },
  })
  adapterWithCustomLogger.registerAgent(commanderAgent)

  await adapterWithCustomLogger.executeAgent(
    commanderAgent,
    'Echo test',
    { command: 'echo "Custom logger test"' }
  )

  console.log(`  Total log messages captured: ${logs.length}`)

  console.log('\n✓ Advanced configuration examples completed\n')
}

// ============================================================================
// Example 6: Production-Ready Pattern
// ============================================================================

/**
 * Demonstrates a production-ready integration pattern
 *
 * This example shows best practices for using the adapter in production:
 * - Proper initialization and cleanup
 * - Error handling with context
 * - Performance monitoring
 * - Structured logging
 * - Result validation
 */
async function example6_ProductionPattern() {
  console.log('\n' + '='.repeat(80))
  console.log('Example 6: Production-Ready Pattern')
  console.log('='.repeat(80) + '\n')

  // Initialize with production settings
  const adapter = createAdapter(PROJECT_ROOT, {
    maxSteps: 30,
    debug: false, // Disable debug logging in production
    logger: (message: string) => {
      // Use structured logging in production
      const timestamp = new Date().toISOString()
      console.log(JSON.stringify({ timestamp, message }))
    },
  })

  // Register all required agents
  adapter.registerAgent(commanderAgent)

  // Example production task: Health check
  console.log('Running production health check...\n')

  const healthChecks = [
    {
      name: 'Git Repository',
      command: 'git status',
      validate: (output: any) => {
        // Validate that output exists
        return output !== null && output !== undefined
      },
    },
    {
      name: 'Node Version',
      command: 'node --version',
      validate: (output: any) => {
        // Validate that we got a version string
        return typeof output === 'object' || typeof output === 'string'
      },
    },
    {
      name: 'Disk Space',
      command: 'df -h .',
      validate: (output: any) => {
        return output !== null
      },
    },
  ]

  const healthCheckResults = []

  for (const check of healthChecks) {
    const startTime = Date.now()
    let status = 'UNKNOWN'
    let error = null
    let output = null

    try {
      // Execute with timeout
      const result = await adapter.executeAgent(
        commanderAgent,
        `Check ${check.name}`,
        { command: check.command, timeout_seconds: 10 }
      )

      output = result.output

      // Validate result
      if (check.validate(output)) {
        status = 'HEALTHY'
      } else {
        status = 'INVALID_OUTPUT'
      }

    } catch (err) {
      status = 'ERROR'
      error = err instanceof Error ? err.message : String(err)
    }

    const duration = Date.now() - startTime

    healthCheckResults.push({
      name: check.name,
      status,
      duration,
      error,
      timestamp: new Date().toISOString(),
    })

    // Log structured result
    console.log(JSON.stringify({
      check: check.name,
      status,
      duration,
      error,
    }))
  }

  // Summary
  console.log('\n--- Health Check Summary ---')
  const healthy = healthCheckResults.filter(r => r.status === 'HEALTHY').length
  console.log(`Total Checks: ${healthCheckResults.length}`)
  console.log(`Healthy: ${healthy}`)
  console.log(`Unhealthy: ${healthCheckResults.length - healthy}`)

  // Determine overall health
  const overallHealth = healthy === healthCheckResults.length ? 'HEALTHY' : 'DEGRADED'
  console.log(`Overall Status: ${overallHealth}`)

  return {
    status: overallHealth,
    checks: healthCheckResults,
    timestamp: new Date().toISOString(),
  }
}

// ============================================================================
// Main Execution
// ============================================================================

/**
 * Main function - runs all examples in sequence
 */
async function main() {
  console.log('\n' + '█'.repeat(80))
  console.log('█' + ' '.repeat(78) + '█')
  console.log('█' + '  Complete Integration Example - ClaudeCodeCLIAdapter with Commander Agent  '.padEnd(78) + '█')
  console.log('█' + ' '.repeat(78) + '█')
  console.log('█'.repeat(80))

  try {
    // Example 1: Setup
    const adapter = example1_BasicSetup()

    // Example 2: Execute git status
    await example2_ExecuteGitStatus(adapter)

    // Example 3: Multiple commands
    await example3_MultipleCommands(adapter)

    // Example 4: Error handling
    await example4_ErrorHandling(adapter)

    // Example 5: Advanced configuration
    await example5_AdvancedConfiguration()

    // Example 6: Production pattern
    const healthCheck = await example6_ProductionPattern()

    console.log('\n' + '█'.repeat(80))
    console.log('█' + ' '.repeat(78) + '█')
    console.log('█  ✓ All examples completed successfully!'.padEnd(79) + '█')
    console.log('█' + ' '.repeat(78) + '█')
    console.log('█'.repeat(80) + '\n')

  } catch (error) {
    console.error('\n' + '█'.repeat(80))
    console.error('█  ✗ Error running examples:'.padEnd(79) + '█')
    console.error('█' + ' '.repeat(78) + '█')
    console.error('█ ', error)
    console.error('█'.repeat(80) + '\n')
    process.exit(1)
  }
}

// ============================================================================
// Export for Testing and Reuse
// ============================================================================

export {
  example1_BasicSetup,
  example2_ExecuteGitStatus,
  example3_MultipleCommands,
  example4_ErrorHandling,
  example5_AdvancedConfiguration,
  example6_ProductionPattern,
  ADAPTER_CONFIG,
  PROJECT_ROOT,
}

// Run if executed directly
if (require.main === module) {
  main()
}
