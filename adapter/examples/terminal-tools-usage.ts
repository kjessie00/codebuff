/**
 * Terminal Tools Usage Examples
 *
 * Demonstrates various use cases for the TerminalTools class
 * which maps Codebuff's run_terminal_command to Claude CLI Bash tool.
 */

import { createTerminalTools } from '../src/tools/terminal'

// ============================================================================
// Basic Examples
// ============================================================================

/**
 * Example 1: Basic Command Execution
 */
async function basicCommandExample() {
  console.log('=== Example 1: Basic Command Execution ===\n')

  const tools = createTerminalTools(process.cwd())

  // Execute a simple command
  const result = await tools.runTerminalCommand({
    command: 'echo "Hello from Terminal Tools!"',
  })

  console.log(result[0].text)
  console.log()
}

/**
 * Example 2: Command with Custom Timeout
 */
async function customTimeoutExample() {
  console.log('=== Example 2: Custom Timeout ===\n')

  const tools = createTerminalTools(process.cwd())

  // Execute with 5 second timeout
  const result = await tools.runTerminalCommand({
    command: 'sleep 2 && echo "Completed within timeout"',
    timeout_seconds: 5,
  })

  console.log(result[0].text)
  console.log()
}

/**
 * Example 3: Custom Working Directory
 */
async function customWorkingDirectoryExample() {
  console.log('=== Example 3: Custom Working Directory ===\n')

  const tools = createTerminalTools(process.cwd())

  // Execute in a specific subdirectory
  const result = await tools.runTerminalCommand({
    command: 'pwd',
    cwd: 'adapter/src', // Relative to base cwd
  })

  console.log(result[0].text)
  console.log()
}

/**
 * Example 4: Environment Variables
 */
async function environmentVariablesExample() {
  console.log('=== Example 4: Environment Variables ===\n')

  const tools = createTerminalTools(process.cwd())

  // Execute with custom environment variables
  const result = await tools.runTerminalCommand({
    command: 'node -e "console.log(`NODE_ENV: ${process.env.NODE_ENV}`)"',
    env: {
      NODE_ENV: 'production',
      DEBUG: 'app:*',
    },
  })

  console.log(result[0].text)
  console.log()
}

/**
 * Example 5: Handling Errors
 */
async function errorHandlingExample() {
  console.log('=== Example 5: Error Handling ===\n')

  const tools = createTerminalTools(process.cwd())

  // Execute a command that fails
  const result = await tools.runTerminalCommand({
    command: 'nonexistent-command',
  })

  console.log('Command failed as expected:')
  console.log(result[0].text)
  console.log()
}

// ============================================================================
// Advanced Examples
// ============================================================================

/**
 * Example 6: Structured Command Results
 */
async function structuredResultsExample() {
  console.log('=== Example 6: Structured Results ===\n')

  const tools = createTerminalTools(process.cwd())

  // Get structured results instead of formatted text
  const result = await tools.executeCommandStructured({
    command: 'node --version',
  })

  console.log('Command:', result.command)
  console.log('Exit Code:', result.exitCode)
  console.log('Stdout:', result.stdout.trim())
  console.log('Stderr:', result.stderr.trim())
  console.log('Execution Time:', result.executionTime, 'ms')
  console.log('Timed Out:', result.timedOut)
  console.log()
}

/**
 * Example 7: Git Operations
 */
async function gitOperationsExample() {
  console.log('=== Example 7: Git Operations ===\n')

  const tools = createTerminalTools(process.cwd())

  // Check git status
  const statusResult = await tools.runTerminalCommand({
    command: 'git status --short',
  })

  console.log('Git Status:')
  console.log(statusResult[0].text)
  console.log()

  // Get current branch
  const branchResult = await tools.runTerminalCommand({
    command: 'git rev-parse --abbrev-ref HEAD',
  })

  console.log('Current Branch:')
  console.log(branchResult[0].text)
  console.log()
}

/**
 * Example 8: NPM Operations
 */
async function npmOperationsExample() {
  console.log('=== Example 8: NPM Operations ===\n')

  const tools = createTerminalTools(process.cwd())

  // List installed packages
  const result = await tools.runTerminalCommand({
    command: 'npm list --depth=0',
    cwd: 'adapter',
    timeout_seconds: 15,
  })

  console.log(result[0].text)
  console.log()
}

/**
 * Example 9: Command Verification
 */
async function commandVerificationExample() {
  console.log('=== Example 9: Command Verification ===\n')

  const tools = createTerminalTools(process.cwd())

  const commands = ['node', 'npm', 'git', 'bun', 'nonexistent']

  for (const cmd of commands) {
    const exists = await tools.verifyCommand(cmd)
    console.log(`${cmd}: ${exists ? '✓ available' : '✗ not found'}`)

    if (exists) {
      const version = await tools.getCommandVersion(cmd)
      console.log(`  Version: ${version}`)
    }
  }

  console.log()
}

/**
 * Example 10: Pipes and Redirects
 */
async function pipesAndRedirectsExample() {
  console.log('=== Example 10: Pipes and Redirects ===\n')

  const tools = createTerminalTools(process.cwd())

  // Command with pipes
  const result = await tools.runTerminalCommand({
    command: 'ls -la | grep ".ts$" | head -5',
    cwd: 'adapter/src/tools',
  })

  console.log('TypeScript files in tools directory:')
  console.log(result[0].text)
  console.log()
}

/**
 * Example 11: Multiple Commands
 */
async function multipleCommandsExample() {
  console.log('=== Example 11: Multiple Commands ===\n')

  const tools = createTerminalTools(process.cwd())

  // Execute multiple commands sequentially using &&
  const result = await tools.runTerminalCommand({
    command: 'echo "Step 1" && echo "Step 2" && echo "Step 3"',
  })

  console.log(result[0].text)
  console.log()
}

/**
 * Example 12: Long-Running Command with Progress
 */
async function longRunningCommandExample() {
  console.log('=== Example 12: Long-Running Command ===\n')

  const tools = createTerminalTools(process.cwd())

  // Command that takes a while (execution time will be shown)
  const result = await tools.runTerminalCommand({
    command: 'sleep 2 && echo "Done!"',
    timeout_seconds: 5,
  })

  console.log(result[0].text)
  console.log('Notice the execution time in the output above')
  console.log()
}

/**
 * Example 13: Global Environment Variables
 */
async function globalEnvironmentExample() {
  console.log('=== Example 13: Global Environment Variables ===\n')

  // Create tools with global environment variables
  const tools = createTerminalTools(process.cwd(), {
    APP_ENV: 'development',
    LOG_LEVEL: 'debug',
  })

  // These env vars will be available in all commands
  const result = await tools.runTerminalCommand({
    command:
      'node -e "console.log(`APP_ENV: ${process.env.APP_ENV}, LOG_LEVEL: ${process.env.LOG_LEVEL}`)"',
  })

  console.log(result[0].text)
  console.log()

  // Can still override or add more env vars per command
  const result2 = await tools.runTerminalCommand({
    command:
      'node -e "console.log(`APP_ENV: ${process.env.APP_ENV}, EXTRA: ${process.env.EXTRA}`)"',
    env: {
      EXTRA: 'command-specific',
    },
  })

  console.log(result2[0].text)
  console.log()
}

/**
 * Example 14: Handling Stderr
 */
async function stderrHandlingExample() {
  console.log('=== Example 14: Handling Stderr ===\n')

  const tools = createTerminalTools(process.cwd())

  // Command that writes to stderr
  const result = await tools.runTerminalCommand({
    command:
      'node -e "console.log(\'stdout message\'); console.error(\'stderr message\')"',
  })

  console.log(result[0].text)
  console.log('Notice [STDERR] section in output above')
  console.log()
}

/**
 * Example 15: Real-World Use Case - Build and Test
 */
async function buildAndTestExample() {
  console.log('=== Example 15: Build and Test Workflow ===\n')

  const tools = createTerminalTools(process.cwd())

  console.log('Step 1: Checking TypeScript...')
  const tscResult = await tools.runTerminalCommand({
    command: 'tsc --noEmit',
    cwd: 'adapter',
    timeout_seconds: 30,
  })
  console.log(tscResult[0].text, '\n')

  console.log('Step 2: Running tests...')
  const testResult = await tools.runTerminalCommand({
    command: 'bun test',
    cwd: 'adapter',
    timeout_seconds: 60,
  })
  console.log(testResult[0].text, '\n')

  console.log('Workflow complete!')
}

// ============================================================================
// Integration with Agent Workflow
// ============================================================================

/**
 * Example 16: Agent Integration Pattern
 *
 * Shows how terminal tools would be used in an agent's handleSteps generator
 */
async function agentIntegrationExample() {
  console.log('=== Example 16: Agent Integration Pattern ===\n')

  const tools = createTerminalTools(process.cwd())

  // Simulate an agent workflow that:
  // 1. Checks git status
  // 2. Runs tests
  // 3. Creates a summary

  console.log('Agent Task: Verify repository status and run tests\n')

  // Step 1: Check git status
  console.log('Agent Step 1: Checking git status...')
  const gitStatus = await tools.executeCommandStructured({
    command: 'git status --short',
  })

  if (gitStatus.stdout.trim() === '') {
    console.log('✓ Working directory clean\n')
  } else {
    console.log('⚠ Uncommitted changes detected')
    console.log(gitStatus.stdout)
  }

  // Step 2: Run tests
  console.log('Agent Step 2: Running tests...')
  const testResult = await tools.executeCommandStructured({
    command: 'echo "Running tests..." && sleep 1 && echo "All tests passed!"',
    timeout_seconds: 30,
  })

  if (testResult.exitCode === 0) {
    console.log('✓ Tests passed\n')
  } else {
    console.log('✗ Tests failed')
    console.log(testResult.stderr)
  }

  // Step 3: Summary
  console.log('Agent Summary:')
  console.log(`- Git status: ${gitStatus.exitCode === 0 ? 'OK' : 'Failed'}`)
  console.log(`- Tests: ${testResult.exitCode === 0 ? 'Passed' : 'Failed'}`)
  console.log(`- Total execution time: ${testResult.executionTime}ms`)
  console.log()
}

// ============================================================================
// Main Runner
// ============================================================================

async function main() {
  console.log('Terminal Tools Usage Examples')
  console.log('==============================\n')

  try {
    // Run basic examples
    await basicCommandExample()
    await customTimeoutExample()
    await customWorkingDirectoryExample()
    await environmentVariablesExample()
    await errorHandlingExample()

    // Run advanced examples
    await structuredResultsExample()
    await gitOperationsExample()
    await commandVerificationExample()
    await pipesAndRedirectsExample()
    await multipleCommandsExample()
    await longRunningCommandExample()
    await globalEnvironmentExample()
    await stderrHandlingExample()

    // Run integration examples
    await agentIntegrationExample()

    console.log('All examples completed successfully!')
  } catch (error) {
    console.error('Error running examples:', error)
    process.exit(1)
  }
}

// Run if executed directly
if (import.meta.main) {
  main()
}

export {
  basicCommandExample,
  customTimeoutExample,
  customWorkingDirectoryExample,
  environmentVariablesExample,
  errorHandlingExample,
  structuredResultsExample,
  gitOperationsExample,
  npmOperationsExample,
  commandVerificationExample,
  pipesAndRedirectsExample,
  multipleCommandsExample,
  longRunningCommandExample,
  globalEnvironmentExample,
  stderrHandlingExample,
  buildAndTestExample,
  agentIntegrationExample,
}
