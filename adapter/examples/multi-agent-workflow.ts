/**
 * Multi-Agent Workflow Example - Complex Agent Orchestration
 *
 * This example demonstrates a sophisticated multi-agent workflow using the
 * ClaudeCodeCLIAdapter. It showcases:
 *
 * 1. Multiple specialized agents working together
 * 2. spawn_agents tool usage for agent coordination
 * 3. File operations, code search, and terminal tools in harmony
 * 4. Real-world scenario: Project structure analysis and documentation
 * 5. Error handling across multiple agent executions
 * 6. Result aggregation and synthesis
 *
 * Real-World Scenario:
 * ===================
 * We're building an "Architect Agent" that analyzes a codebase and generates
 * a comprehensive project report. It coordinates multiple specialized agents:
 *
 * - **Structure Agent**: Analyzes directory structure and file organization
 * - **Code Analyzer Agent**: Examines TypeScript files for patterns and quality
 * - **Test Coverage Agent**: Analyzes test files and coverage
 * - **Commander Agent**: Runs terminal commands for git info and stats
 * - **Documentation Agent**: Generates final comprehensive report
 *
 * This demonstrates how complex tasks can be decomposed into specialized
 * sub-agents, each focusing on a specific aspect of the problem.
 *
 * Usage:
 * ```bash
 * ts-node examples/multi-agent-workflow.ts
 * ```
 *
 * @module examples/multi-agent-workflow
 */

import path from 'path'
import { ClaudeCodeCLIAdapter, createDebugAdapter } from '../src/claude-cli-adapter'
import type { AgentDefinition, AgentStepContext } from '../../.agents/types/agent-definition'
import commanderAgent from '../../.agents/commander'

// ============================================================================
// Agent Definitions - Specialized Agents for Different Tasks
// ============================================================================

/**
 * Structure Agent - Analyzes directory structure and file organization
 *
 * This agent uses find_files and read_files to understand the project layout.
 * It identifies key directories, counts files by type, and assesses organization.
 */
const structureAgent: AgentDefinition = {
  id: 'structure-analyzer',
  displayName: 'Structure Analyzer',
  model: 'anthropic/claude-haiku-4.5',
  publisher: 'codebuff',

  systemPrompt: `You are a project structure analyzer. Your job is to examine a codebase's
directory structure and file organization to understand how the project is laid out.`,

  instructionsPrompt: `Analyze the project structure by:
1. Finding all directories and key files
2. Identifying main code directories (src, lib, etc.)
3. Locating configuration files (package.json, tsconfig.json, etc.)
4. Counting files by type (.ts, .js, .json, etc.)
5. Assessing the organization quality

Provide a structured summary of your findings.`,

  inputSchema: {
    prompt: {
      type: 'string',
      description: 'What aspect of the structure to analyze',
    },
    params: {
      type: 'object',
      properties: {
        rootPath: {
          type: 'string',
          description: 'Root path to analyze',
        },
      },
    },
  },

  toolNames: ['find_files', 'read_files'],
  outputMode: 'structured_output',

  outputSchema: {
    type: 'object',
    properties: {
      directories: {
        type: 'array',
        description: 'Main directories found',
      },
      fileCount: {
        type: 'object',
        description: 'Files count by extension',
      },
      configFiles: {
        type: 'array',
        description: 'Configuration files found',
      },
      organizationRating: {
        type: 'string',
        description: 'Assessment of code organization (Good/Fair/Poor)',
      },
      summary: {
        type: 'string',
        description: 'Overall structural summary',
      },
    },
    required: ['directories', 'fileCount', 'summary'],
  },
}

/**
 * Code Analyzer Agent - Examines code quality and patterns
 *
 * This agent uses code_search to find patterns, imports, and potential issues.
 * It analyzes TypeScript code for common patterns and best practices.
 */
const codeAnalyzerAgent: AgentDefinition = {
  id: 'code-analyzer',
  displayName: 'Code Analyzer',
  model: 'anthropic/claude-sonnet-4.5',
  publisher: 'codebuff',

  systemPrompt: `You are an expert code analyzer. You examine TypeScript code to identify
patterns, architecture decisions, and code quality indicators.`,

  instructionsPrompt: `Analyze the codebase by:
1. Searching for common patterns (classes, functions, exports)
2. Identifying architectural patterns (MVC, functional, etc.)
3. Looking for error handling patterns
4. Finding test files and testing patterns
5. Assessing code organization and modularity

Provide actionable insights and recommendations.`,

  inputSchema: {
    prompt: {
      type: 'string',
      description: 'What to analyze in the code',
    },
    params: {
      type: 'object',
      properties: {
        filePattern: {
          type: 'string',
          description: 'File pattern to analyze (e.g., "*.ts")',
        },
        searchDepth: {
          type: 'string',
          description: 'Directory to search in',
        },
      },
    },
  },

  toolNames: ['code_search', 'read_files', 'find_files'],
  outputMode: 'structured_output',

  outputSchema: {
    type: 'object',
    properties: {
      patterns: {
        type: 'array',
        description: 'Code patterns identified',
      },
      architecture: {
        type: 'string',
        description: 'Architectural style detected',
      },
      quality: {
        type: 'object',
        description: 'Code quality metrics',
      },
      recommendations: {
        type: 'array',
        description: 'Improvement recommendations',
      },
    },
    required: ['patterns', 'architecture', 'recommendations'],
  },
}

/**
 * Test Coverage Agent - Analyzes test files and coverage
 *
 * This agent examines test files to understand testing patterns and coverage.
 */
const testCoverageAgent: AgentDefinition = {
  id: 'test-coverage',
  displayName: 'Test Coverage Analyzer',
  model: 'anthropic/claude-haiku-4.5',
  publisher: 'codebuff',

  systemPrompt: `You are a testing expert who analyzes test suites and test coverage.`,

  instructionsPrompt: `Analyze the test suite by:
1. Finding all test files (.test.ts, .spec.ts)
2. Identifying test frameworks used
3. Counting test cases
4. Assessing test organization
5. Looking for integration vs unit tests

Provide a testing summary.`,

  inputSchema: {
    prompt: {
      type: 'string',
      description: 'Testing aspect to analyze',
    },
  },

  toolNames: ['find_files', 'code_search', 'read_files'],
  outputMode: 'structured_output',

  outputSchema: {
    type: 'object',
    properties: {
      testFiles: {
        type: 'array',
        description: 'Test files found',
      },
      framework: {
        type: 'string',
        description: 'Test framework detected',
      },
      testCount: {
        type: 'number',
        description: 'Approximate number of tests',
      },
      coverage: {
        type: 'string',
        description: 'Coverage assessment',
      },
    },
    required: ['testFiles', 'framework', 'coverage'],
  },
}

/**
 * Documentation Agent - Synthesizes information into a report
 *
 * This agent takes input from other agents and generates a comprehensive report.
 */
const documentationAgent: AgentDefinition = {
  id: 'documentation-generator',
  displayName: 'Documentation Generator',
  model: 'anthropic/claude-sonnet-4.5',
  publisher: 'codebuff',

  systemPrompt: `You are a technical writer who creates comprehensive project documentation
from analysis data. You excel at synthesizing complex information into clear reports.`,

  instructionsPrompt: `Generate a comprehensive project report that includes:
1. Executive summary
2. Project structure overview
3. Code architecture and patterns
4. Testing approach and coverage
5. Key findings and recommendations
6. Next steps

Make the report clear, actionable, and well-organized.`,

  inputSchema: {
    prompt: {
      type: 'string',
      description: 'Report generation instructions',
    },
    params: {
      type: 'object',
      properties: {
        structureData: { type: 'object' },
        codeData: { type: 'object' },
        testData: { type: 'object' },
        gitData: { type: 'object' },
      },
    },
  },

  toolNames: ['write_file'],
  outputMode: 'structured_output',

  outputSchema: {
    type: 'object',
    properties: {
      reportPath: {
        type: 'string',
        description: 'Path to generated report',
      },
      summary: {
        type: 'string',
        description: 'Executive summary',
      },
      sections: {
        type: 'array',
        description: 'Report sections',
      },
    },
    required: ['summary', 'sections'],
  },
}

/**
 * Architect Agent - Orchestrates the entire workflow
 *
 * This is the master agent that coordinates all other agents using spawn_agents.
 * It demonstrates sophisticated agent orchestration.
 */
const architectAgent: AgentDefinition = {
  id: 'architect',
  displayName: 'Project Architect',
  model: 'anthropic/claude-sonnet-4.5',
  publisher: 'codebuff',

  systemPrompt: `You are a project architect who coordinates multiple specialized agents
to perform comprehensive codebase analysis. You orchestrate the workflow and ensure
all aspects of the project are properly analyzed.`,

  instructionsPrompt: `Your role is to:
1. Coordinate specialized agents for different analysis tasks
2. Collect and organize their outputs
3. Synthesize findings into actionable insights
4. Generate a comprehensive project report

Use spawn_agents to coordinate the analysis workflow.`,

  inputSchema: {
    prompt: {
      type: 'string',
      description: 'Analysis goal',
    },
    params: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to project',
        },
        depth: {
          type: 'string',
          description: 'Analysis depth (quick/full)',
        },
      },
    },
  },

  toolNames: ['spawn_agents', 'set_output'],
  spawnableAgents: [
    'structure-analyzer',
    'code-analyzer',
    'test-coverage',
    'commander',
    'documentation-generator',
  ],
  outputMode: 'structured_output',

  outputSchema: {
    type: 'object',
    properties: {
      projectName: { type: 'string' },
      analysisDate: { type: 'string' },
      structure: { type: 'object' },
      code: { type: 'object' },
      testing: { type: 'object' },
      git: { type: 'object' },
      recommendations: { type: 'array' },
      reportPath: { type: 'string' },
    },
    required: ['projectName', 'analysisDate', 'recommendations'],
  },

  // handleSteps generator for orchestration
  handleSteps: function* ({ params, logger }: AgentStepContext) {
    logger.info('Starting project architecture analysis')

    const projectPath = (params?.projectPath as string) || '.'
    const depth = (params?.depth as string) || 'full'

    logger.info('Analysis configuration', { projectPath, depth })

    // Step 1: Analyze project structure
    logger.info('Step 1: Analyzing project structure...')
    const { toolResult: structureResult } = yield {
      toolName: 'spawn_agents',
      input: {
        agents: [
          {
            agent_type: 'structure-analyzer',
            prompt: `Analyze the project structure at ${projectPath}`,
            params: { rootPath: projectPath },
          },
        ],
      },
    }

    // Step 2: Gather git information using commander
    logger.info('Step 2: Gathering git repository information...')
    const { toolResult: gitStatusResult } = yield {
      toolName: 'spawn_agents',
      input: {
        agents: [
          {
            agent_type: 'commander',
            prompt: 'Get git status and branch information',
            params: {
              command: 'git status --short && git rev-parse --abbrev-ref HEAD',
              timeout_seconds: 10,
            },
          },
        ],
      },
    }

    const { toolResult: gitLogResult } = yield {
      toolName: 'spawn_agents',
      input: {
        agents: [
          {
            agent_type: 'commander',
            prompt: 'Get recent commit history',
            params: {
              command: 'git log --oneline -10',
              timeout_seconds: 10,
            },
          },
        ],
      },
    }

    // Step 3: Analyze code quality (parallel with test analysis)
    logger.info('Step 3: Analyzing code quality and tests...')
    const { toolResult: codeAndTestResults } = yield {
      toolName: 'spawn_agents',
      input: {
        agents: [
          {
            agent_type: 'code-analyzer',
            prompt: 'Analyze TypeScript code in the adapter directory',
            params: {
              filePattern: '*.ts',
              searchDepth: 'adapter/src',
            },
          },
          {
            agent_type: 'test-coverage',
            prompt: 'Analyze test coverage in the adapter directory',
          },
        ],
      },
    }

    // Step 4: Get file statistics using commander
    logger.info('Step 4: Gathering file statistics...')
    const { toolResult: fileStatsResult } = yield {
      toolName: 'spawn_agents',
      input: {
        agents: [
          {
            agent_type: 'commander',
            prompt: 'Count TypeScript files',
            params: {
              command: 'find adapter -name "*.ts" -type f | wc -l',
              timeout_seconds: 10,
            },
          },
        ],
      },
    }

    // Step 5: Set output with aggregated results
    logger.info('Step 5: Aggregating results...')
    yield {
      toolName: 'set_output',
      input: {
        output: {
          projectName: 'Codebuff Adapter',
          analysisDate: new Date().toISOString(),
          depth,
          structure: structureResult,
          git: {
            status: gitStatusResult,
            recentCommits: gitLogResult,
          },
          code: codeAndTestResults,
          fileStats: fileStatsResult,
          recommendations: [
            'Continue maintaining comprehensive test coverage',
            'Consider adding integration tests for multi-agent workflows',
            'Document complex agent orchestration patterns',
            'Keep monitoring code organization as the project grows',
          ],
        },
      },
    }

    // Step 6: Let LLM summarize and finalize
    logger.info('Step 6: Finalizing analysis...')
    yield 'STEP'
  },
}

// ============================================================================
// Example 1: Basic Multi-Agent Coordination
// ============================================================================

/**
 * Demonstrates basic coordination between multiple agents
 *
 * Shows how to execute agents sequentially and collect their results.
 */
async function example1_BasicCoordination(adapter: ClaudeCodeCLIAdapter) {
  console.log('\n' + '='.repeat(80))
  console.log('Example 1: Basic Multi-Agent Coordination')
  console.log('='.repeat(80) + '\n')

  console.log('Scenario: Analyze project structure and git status\n')

  // Task 1: Get git status
  console.log('Task 1: Getting git status...')
  const gitResult = await adapter.executeAgent(
    commanderAgent,
    'What is the current git branch and status?',
    {
      command: 'git branch && git status --short',
      timeout_seconds: 10,
    }
  )
  console.log('✓ Git status retrieved\n')

  // Task 2: Count TypeScript files
  console.log('Task 2: Counting TypeScript files...')
  const fileCountResult = await adapter.executeAgent(
    commanderAgent,
    'How many TypeScript files are in the adapter directory?',
    {
      command: 'find adapter -name "*.ts" -type f | wc -l',
      timeout_seconds: 10,
    }
  )
  console.log('✓ File count retrieved\n')

  // Task 3: Get Node version
  console.log('Task 3: Getting Node version...')
  const nodeVersionResult = await adapter.executeAgent(
    commanderAgent,
    'What version of Node.js is installed?',
    {
      command: 'node --version',
      timeout_seconds: 5,
    }
  )
  console.log('✓ Node version retrieved\n')

  // Aggregate results
  console.log('--- Aggregated Results ---')
  console.log('Git Status:', JSON.stringify(gitResult.output, null, 2))
  console.log('\nFile Count:', JSON.stringify(fileCountResult.output, null, 2))
  console.log('\nNode Version:', JSON.stringify(nodeVersionResult.output, null, 2))

  return {
    git: gitResult.output,
    fileCount: fileCountResult.output,
    nodeVersion: nodeVersionResult.output,
  }
}

// ============================================================================
// Example 2: Parallel Agent Execution
// ============================================================================

/**
 * Demonstrates executing multiple agents in parallel
 *
 * Shows how Promise.all can be used to run agents concurrently.
 */
async function example2_ParallelExecution(adapter: ClaudeCodeCLIAdapter) {
  console.log('\n' + '='.repeat(80))
  console.log('Example 2: Parallel Agent Execution')
  console.log('='.repeat(80) + '\n')

  console.log('Executing multiple commands in parallel...\n')

  const startTime = Date.now()

  // Execute multiple agents in parallel
  const [gitResult, fileCountResult, nodeResult, pwdResult] = await Promise.all([
    adapter.executeAgent(
      commanderAgent,
      'Get git branch',
      { command: 'git rev-parse --abbrev-ref HEAD', timeout_seconds: 5 }
    ),
    adapter.executeAgent(
      commanderAgent,
      'Count TypeScript files',
      { command: 'find adapter -name "*.ts" | wc -l', timeout_seconds: 10 }
    ),
    adapter.executeAgent(
      commanderAgent,
      'Get Node version',
      { command: 'node --version', timeout_seconds: 5 }
    ),
    adapter.executeAgent(
      commanderAgent,
      'Get current directory',
      { command: 'pwd', timeout_seconds: 5 }
    ),
  ])

  const duration = Date.now() - startTime

  console.log('✓ All agents completed in parallel\n')
  console.log(`Total execution time: ${duration}ms`)
  console.log('\n--- Results ---')
  console.log('Git Branch:', JSON.stringify(gitResult.output))
  console.log('File Count:', JSON.stringify(fileCountResult.output))
  console.log('Node Version:', JSON.stringify(nodeResult.output))
  console.log('Current Dir:', JSON.stringify(pwdResult.output))

  return { duration, results: [gitResult, fileCountResult, nodeResult, pwdResult] }
}

// ============================================================================
// Example 3: Agent Orchestration with spawn_agents
// ============================================================================

/**
 * Demonstrates using spawn_agents for sophisticated orchestration
 *
 * Shows how an orchestrator agent can coordinate multiple sub-agents.
 */
async function example3_SpawnAgentsOrchestration(adapter: ClaudeCodeCLIAdapter) {
  console.log('\n' + '='.repeat(80))
  console.log('Example 3: Agent Orchestration with spawn_agents')
  console.log('='.repeat(80) + '\n')

  console.log('Running the Architect Agent...')
  console.log('This agent will coordinate multiple specialized agents\n')

  const startTime = Date.now()

  try {
    const result = await adapter.executeAgent(
      architectAgent,
      'Perform a comprehensive analysis of the adapter project',
      {
        projectPath: 'adapter',
        depth: 'full',
      }
    )

    const duration = Date.now() - startTime

    console.log(`✓ Architecture analysis completed in ${duration}ms\n`)

    console.log('--- Analysis Results ---')
    console.log(JSON.stringify(result.output, null, 2))

    console.log('\n--- Execution Metadata ---')
    console.log('Iterations:', result.metadata?.iterationCount)
    console.log('Completed Normally:', result.metadata?.completedNormally)
    console.log('Message History Length:', result.messageHistory.length)

    return result

  } catch (error) {
    console.error('✗ Architecture analysis failed:', error)
    throw error
  }
}

// ============================================================================
// Example 4: Real-World Scenario - Complete Project Analysis
// ============================================================================

/**
 * Demonstrates a complete real-world multi-agent workflow
 *
 * This is the main demonstration showing how multiple agents work together
 * to analyze a codebase comprehensively.
 */
async function example4_CompleteProjectAnalysis(adapter: ClaudeCodeCLIAdapter) {
  console.log('\n' + '='.repeat(80))
  console.log('Example 4: Complete Project Analysis Workflow')
  console.log('='.repeat(80) + '\n')

  console.log('Scenario: Comprehensive codebase analysis for documentation\n')

  const analysisSteps = [
    {
      name: 'Repository Information',
      agent: commanderAgent,
      prompt: 'Get repository branch and status',
      params: { command: 'git branch -vv && git status --short', timeout_seconds: 10 },
    },
    {
      name: 'Project Dependencies',
      agent: commanderAgent,
      prompt: 'List main dependencies',
      params: {
        command: 'cat adapter/package.json | grep -A 20 "\\"dependencies\\""',
        timeout_seconds: 10,
      },
    },
    {
      name: 'Code Statistics',
      agent: commanderAgent,
      prompt: 'Get code statistics',
      params: {
        command:
          'echo "TypeScript files:" && find adapter -name "*.ts" | wc -l && ' +
          'echo "Test files:" && find adapter -name "*.test.ts" | wc -l',
        timeout_seconds: 15,
      },
    },
    {
      name: 'Recent Activity',
      agent: commanderAgent,
      prompt: 'Get recent commit activity',
      params: { command: 'git log --oneline --since="7 days ago"', timeout_seconds: 10 },
    },
  ]

  const results: Record<string, any> = {}

  // Execute each analysis step
  for (const step of analysisSteps) {
    console.log(`\n→ ${step.name}`)
    console.log(`  Command: ${step.params.command.substring(0, 60)}...`)

    try {
      const result = await adapter.executeAgent(step.agent, step.prompt, step.params)

      results[step.name] = {
        success: true,
        output: result.output,
        executionTime: result.metadata?.executionTime,
      }

      console.log(`  ✓ Completed in ${result.metadata?.executionTime}ms`)

    } catch (error) {
      results[step.name] = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }

      console.log(`  ✗ Failed:`, error)
    }
  }

  // Generate summary
  console.log('\n' + '='.repeat(80))
  console.log('Analysis Summary')
  console.log('='.repeat(80))

  const successful = Object.values(results).filter(r => r.success).length
  const total = Object.keys(results).length

  console.log(`\nCompleted: ${successful}/${total} analysis steps`)

  console.log('\n--- Detailed Results ---')
  for (const [name, result] of Object.entries(results)) {
    console.log(`\n${name}:`)
    if (result.success) {
      console.log('  Status: ✓ Success')
      console.log('  Execution Time:', result.executionTime, 'ms')
      console.log('  Output Preview:', JSON.stringify(result.output).substring(0, 100))
    } else {
      console.log('  Status: ✗ Failed')
      console.log('  Error:', result.error)
    }
  }

  return results
}

// ============================================================================
// Example 5: Error Handling in Multi-Agent Workflows
// ============================================================================

/**
 * Demonstrates error handling across multiple agent executions
 *
 * Shows how to handle failures gracefully in complex workflows.
 */
async function example5_ErrorHandlingInWorkflow(adapter: ClaudeCodeCLIAdapter) {
  console.log('\n' + '='.repeat(80))
  console.log('Example 5: Error Handling in Multi-Agent Workflows')
  console.log('='.repeat(80) + '\n')

  console.log('Testing error handling with intentional failures...\n')

  const tasks = [
    {
      name: 'Valid Command',
      command: 'echo "This will succeed"',
      shouldSucceed: true,
    },
    {
      name: 'Invalid Command',
      command: 'nonexistent-command-xyz',
      shouldSucceed: false,
    },
    {
      name: 'Timeout Command',
      command: 'sleep 10',
      timeout: 2,
      shouldSucceed: false,
    },
    {
      name: 'Another Valid Command',
      command: 'date',
      shouldSucceed: true,
    },
  ]

  const results = []

  for (const task of tasks) {
    console.log(`\nExecuting: ${task.name}`)

    try {
      const result = await adapter.executeAgent(
        commanderAgent,
        `Run: ${task.name}`,
        {
          command: task.command,
          timeout_seconds: task.timeout || 10,
        }
      )

      results.push({
        name: task.name,
        success: true,
        expectedToSucceed: task.shouldSucceed,
        output: result.output,
      })

      console.log('  ✓ Completed successfully')

      if (!task.shouldSucceed) {
        console.log('  ⚠ Warning: Expected to fail but succeeded!')
      }

    } catch (error) {
      results.push({
        name: task.name,
        success: false,
        expectedToSucceed: task.shouldSucceed,
        error: error instanceof Error ? error.message : String(error),
      })

      console.log('  ✗ Failed (as expected)')

      if (task.shouldSucceed) {
        console.log('  ⚠ Warning: Expected to succeed but failed!')
      }
    }
  }

  // Summary
  console.log('\n--- Error Handling Summary ---')
  results.forEach(result => {
    const status = result.success ? '✓' : '✗'
    const expectation = result.expectedToSucceed ? '(should succeed)' : '(should fail)'
    const outcome =
      result.success === result.expectedToSucceed ? '✓ As expected' : '⚠ Unexpected'

    console.log(`\n${status} ${result.name} ${expectation}`)
    console.log(`  Outcome: ${outcome}`)
  })

  const asExpected = results.filter(r => r.success === r.expectedToSucceed).length
  console.log(`\n${asExpected}/${results.length} behaved as expected`)

  return results
}

// ============================================================================
// Example 6: Production-Ready Multi-Agent Pipeline
// ============================================================================

/**
 * Demonstrates a production-ready multi-agent pipeline with monitoring
 *
 * Shows best practices for production deployments.
 */
async function example6_ProductionPipeline(adapter: ClaudeCodeCLIAdapter) {
  console.log('\n' + '='.repeat(80))
  console.log('Example 6: Production-Ready Multi-Agent Pipeline')
  console.log('='.repeat(80) + '\n')

  interface PipelineMetrics {
    startTime: number
    endTime?: number
    duration?: number
    totalSteps: number
    successfulSteps: number
    failedSteps: number
    steps: Array<{
      name: string
      status: 'success' | 'failure'
      duration: number
      error?: string
    }>
  }

  const metrics: PipelineMetrics = {
    startTime: Date.now(),
    totalSteps: 0,
    successfulSteps: 0,
    failedSteps: 0,
    steps: [],
  }

  console.log('Starting production analysis pipeline...\n')

  // Define pipeline steps
  const pipelineSteps = [
    {
      name: 'Environment Check',
      command: 'node --version && npm --version',
      critical: true,
    },
    {
      name: 'Git Status',
      command: 'git status --porcelain',
      critical: false,
    },
    {
      name: 'File Structure',
      command: 'find adapter -type f -name "*.ts" | head -20',
      critical: false,
    },
    {
      name: 'Dependencies Check',
      command: 'cat adapter/package.json | grep -E "dependencies|devDependencies" -A 5',
      critical: false,
    },
  ]

  // Execute pipeline
  for (const step of pipelineSteps) {
    metrics.totalSteps++
    const stepStartTime = Date.now()

    console.log(`→ Executing: ${step.name}`)
    console.log(`  Critical: ${step.critical ? 'Yes' : 'No'}`)

    try {
      await adapter.executeAgent(
        commanderAgent,
        `Execute pipeline step: ${step.name}`,
        {
          command: step.command,
          timeout_seconds: 15,
        }
      )

      const stepDuration = Date.now() - stepStartTime
      metrics.successfulSteps++
      metrics.steps.push({
        name: step.name,
        status: 'success',
        duration: stepDuration,
      })

      console.log(`  ✓ Completed in ${stepDuration}ms\n`)

    } catch (error) {
      const stepDuration = Date.now() - stepStartTime
      metrics.failedSteps++
      metrics.steps.push({
        name: step.name,
        status: 'failure',
        duration: stepDuration,
        error: error instanceof Error ? error.message : String(error),
      })

      console.log(`  ✗ Failed in ${stepDuration}ms`)
      console.log(`  Error: ${error}\n`)

      // If critical step failed, abort pipeline
      if (step.critical) {
        console.log('  ⚠ Critical step failed, aborting pipeline')
        break
      }
    }
  }

  metrics.endTime = Date.now()
  metrics.duration = metrics.endTime - metrics.startTime

  // Generate pipeline report
  console.log('='.repeat(80))
  console.log('Pipeline Execution Report')
  console.log('='.repeat(80))
  console.log('\n--- Metrics ---')
  console.log('Total Duration:', metrics.duration, 'ms')
  console.log('Total Steps:', metrics.totalSteps)
  console.log('Successful:', metrics.successfulSteps)
  console.log('Failed:', metrics.failedSteps)
  console.log('Success Rate:', ((metrics.successfulSteps / metrics.totalSteps) * 100).toFixed(1), '%')

  console.log('\n--- Step Details ---')
  metrics.steps.forEach((step, idx) => {
    console.log(`\n[${idx + 1}] ${step.name}`)
    console.log(`    Status: ${step.status === 'success' ? '✓ Success' : '✗ Failed'}`)
    console.log(`    Duration: ${step.duration}ms`)
    if (step.error) {
      console.log(`    Error: ${step.error}`)
    }
  })

  console.log('\n--- Final Status ---')
  const pipelineSuccess = metrics.failedSteps === 0
  console.log(`Pipeline: ${pipelineSuccess ? '✓ SUCCESS' : '✗ FAILED'}`)

  return metrics
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
  console.log('█' + '  Multi-Agent Workflow Examples - Advanced Agent Orchestration  '.padEnd(78) + '█')
  console.log('█' + ' '.repeat(78) + '█')
  console.log('█'.repeat(80))

  const PROJECT_ROOT = path.resolve(__dirname, '../..')

  try {
    // Initialize adapter
    console.log('\n→ Initializing ClaudeCodeCLIAdapter...')
    const adapter = createDebugAdapter(PROJECT_ROOT, {
      maxSteps: 50,
      env: { NODE_ENV: 'development' },
    })

    // Register all agents
    console.log('→ Registering agents...')
    adapter.registerAgents([
      commanderAgent,
      structureAgent,
      codeAnalyzerAgent,
      testCoverageAgent,
      documentationAgent,
      architectAgent,
    ])

    console.log('✓ Adapter initialized with', adapter.listAgents().length, 'agents\n')

    // Run examples
    await example1_BasicCoordination(adapter)
    await example2_ParallelExecution(adapter)
    await example3_SpawnAgentsOrchestration(adapter)
    await example4_CompleteProjectAnalysis(adapter)
    await example5_ErrorHandlingInWorkflow(adapter)
    const pipelineMetrics = await example6_ProductionPipeline(adapter)

    // Final summary
    console.log('\n' + '█'.repeat(80))
    console.log('█' + ' '.repeat(78) + '█')
    console.log('█  ✓ All multi-agent workflow examples completed successfully!'.padEnd(79) + '█')
    console.log('█' + ' '.repeat(78) + '█')
    console.log('█  Pipeline Success Rate: ' +
      `${((pipelineMetrics.successfulSteps / pipelineMetrics.totalSteps) * 100).toFixed(1)}%`.padEnd(52) + '█')
    console.log('█' + ' '.repeat(78) + '█')
    console.log('█'.repeat(80) + '\n')

  } catch (error) {
    console.error('\n' + '█'.repeat(80))
    console.error('█  ✗ Error running multi-agent workflow examples:'.padEnd(79) + '█')
    console.error('█' + ' '.repeat(78) + '█')
    console.error('█ ', error)
    console.error('█'.repeat(80) + '\n')
    process.exit(1)
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  // Agent definitions
  structureAgent,
  codeAnalyzerAgent,
  testCoverageAgent,
  documentationAgent,
  architectAgent,

  // Examples
  example1_BasicCoordination,
  example2_ParallelExecution,
  example3_SpawnAgentsOrchestration,
  example4_CompleteProjectAnalysis,
  example5_ErrorHandlingInWorkflow,
  example6_ProductionPipeline,
}

// Run if executed directly
if (require.main === module) {
  main()
}
