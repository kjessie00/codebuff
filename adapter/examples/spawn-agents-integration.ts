/**
 * Spawn Agents Integration Example
 *
 * Demonstrates how to integrate the SpawnAgentsAdapter with an agent execution system.
 * Shows proper setup, agent registry management, and sub-agent spawning workflows.
 *
 * Usage:
 * ```bash
 * ts-node examples/spawn-agents-integration.ts
 * ```
 */

import {
  SpawnAgentsAdapter,
  createSpawnAgentsAdapter,
  type AgentRegistry,
  type AgentExecutor,
  type AgentExecutionContext,
} from '../src/tools/spawn-agents'

import type { AgentDefinition } from '../../.agents/types/agent-definition'

// ============================================================================
// Example Agent Definitions
// ============================================================================

/**
 * File Picker Agent - Finds and analyzes files
 */
const filePickerAgent: AgentDefinition = {
  id: 'file-picker',
  displayName: 'File Picker',
  model: 'openai/gpt-5-mini',
  toolNames: ['find_files', 'read_files', 'code_search'],

  systemPrompt: 'You are a file exploration agent. Help users find and analyze files.',

  instructionsPrompt: `
Find files matching the user's criteria. You can:
- Use find_files to search by glob patterns
- Use code_search to find files containing specific code
- Use read_files to examine file contents

Always provide a summary of what you found.
  `.trim(),

  inputSchema: {
    prompt: {
      type: 'string',
      description: 'Description of files to find'
    },
    params: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern to match files'
        },
        maxFiles: {
          type: 'number',
          description: 'Maximum number of files to return'
        }
      }
    }
  },

  outputMode: 'structured_output',
  outputSchema: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        description: 'List of files found'
      },
      summary: {
        type: 'string',
        description: 'Summary of findings'
      }
    },
    required: ['files', 'summary']
  }
}

/**
 * Code Reviewer Agent - Reviews code quality
 */
const codeReviewerAgent: AgentDefinition = {
  id: 'code-reviewer',
  displayName: 'Code Reviewer',
  model: 'anthropic/claude-sonnet-4.5',
  toolNames: ['read_files', 'code_search'],

  systemPrompt: `You are an expert code reviewer. Analyze code for:
- Best practices and patterns
- Potential bugs and issues
- Security vulnerabilities
- Performance optimizations
- Code maintainability
  `.trim(),

  instructionsPrompt: `
Review the code thoroughly and provide actionable feedback.
Focus on the most important issues first.
  `.trim(),

  inputSchema: {
    prompt: {
      type: 'string',
      description: 'What to review'
    }
  },

  outputMode: 'structured_output',
  outputSchema: {
    type: 'object',
    properties: {
      issues: {
        type: 'array',
        description: 'List of issues found'
      },
      suggestions: {
        type: 'array',
        description: 'Improvement suggestions'
      },
      rating: {
        type: 'string',
        description: 'Overall code quality rating'
      }
    },
    required: ['issues', 'suggestions', 'rating']
  }
}

/**
 * Deep Thinker Agent - Analyzes complex problems
 */
const thinkerAgent: AgentDefinition = {
  id: 'thinker',
  displayName: 'Deep Thinker',
  model: 'anthropic/claude-opus-4.1',
  toolNames: [],

  systemPrompt: 'You are a deep thinking agent that analyzes complex problems.',

  instructionsPrompt: `
Think deeply about the problem:
1. Break it down into components
2. Analyze each component
3. Identify patterns and relationships
4. Synthesize insights
5. Provide clear recommendations
  `.trim(),

  outputMode: 'last_message'
}

/**
 * Orchestrator Agent - Coordinates multiple sub-agents
 */
const orchestratorAgent: AgentDefinition = {
  id: 'orchestrator',
  displayName: 'Orchestrator',
  model: 'openai/gpt-5',
  toolNames: ['spawn_agents', 'set_output'],
  spawnableAgents: ['file-picker', 'code-reviewer', 'thinker'],

  systemPrompt: 'You are an orchestrator that coordinates multiple specialized agents.',

  instructionsPrompt: `
Your role is to:
1. Understand the user's request
2. Determine which agents to spawn
3. Coordinate their work
4. Synthesize their outputs into a cohesive response
  `.trim(),

  handleSteps: function* ({ agentState, prompt, params, logger }) {
    logger.info('Orchestrator starting')

    // Step 1: Spawn file picker to find relevant files
    logger.info('Spawning file-picker agent')
    const { toolResult: filePickerResult } = yield {
      toolName: 'spawn_agents',
      input: {
        agents: [
          {
            agent_type: 'file-picker',
            prompt: 'Find all TypeScript files in the project',
            params: { pattern: '**/*.ts', maxFiles: 20 }
          }
        ]
      }
    }

    // Step 2: Spawn code reviewer to analyze the files
    logger.info('Spawning code-reviewer agent')
    const { toolResult: reviewerResult } = yield {
      toolName: 'spawn_agents',
      input: {
        agents: [
          {
            agent_type: 'code-reviewer',
            prompt: 'Review the TypeScript files found earlier'
          }
        ]
      }
    }

    // Step 3: Spawn thinker to provide insights
    logger.info('Spawning thinker agent')
    yield {
      toolName: 'spawn_agents',
      input: {
        agents: [
          {
            agent_type: 'thinker',
            prompt: 'Provide strategic insights based on the code review'
          }
        ]
      }
    }

    // Step 4: Let LLM synthesize all results
    logger.info('Synthesizing results')
    yield 'STEP_ALL'
  }
}

// ============================================================================
// Mock Agent Executor
// ============================================================================

/**
 * Mock implementation of agent executor
 * In a real system, this would execute the actual agent logic
 */
const createMockAgentExecutor = (): AgentExecutor => {
  return async (agentDef, prompt, params, parentContext) => {
    console.log(`\n[Executor] Running agent: ${agentDef.displayName}`)
    console.log(`[Executor] Prompt: ${prompt || 'No prompt'}`)
    console.log(`[Executor] Params:`, params || 'No params')

    // Simulate agent execution based on type
    let output: any

    switch (agentDef.id) {
      case 'file-picker':
        output = {
          files: [
            'src/index.ts',
            'src/tools/spawn-agents.ts',
            'src/tools/file-operations.ts'
          ],
          summary: 'Found 3 TypeScript files in the project'
        }
        break

      case 'code-reviewer':
        output = {
          issues: [
            'Missing error handling in spawn-agents.ts',
            'Inconsistent naming conventions'
          ],
          suggestions: [
            'Add try-catch blocks for error handling',
            'Standardize naming across files'
          ],
          rating: 'Good - minor improvements needed'
        }
        break

      case 'thinker':
        output = {
          type: 'lastMessage',
          value: 'The codebase shows good architecture with clear separation of concerns. ' +
            'Suggest focusing on error handling improvements and documentation.'
        }
        break

      default:
        output = {
          type: 'lastMessage',
          value: 'Agent execution completed'
        }
    }

    return {
      output,
      messageHistory: [
        { role: 'user', content: prompt || 'Execute task' },
        { role: 'assistant', content: JSON.stringify(output) }
      ]
    }
  }
}

// ============================================================================
// Example Usage Scenarios
// ============================================================================

/**
 * Example 1: Simple sequential agent spawning
 */
async function exampleSequentialSpawning() {
  console.log('\n========================================')
  console.log('Example 1: Sequential Agent Spawning')
  console.log('========================================')

  // Create agent registry
  const registry: AgentRegistry = new Map([
    ['file-picker', filePickerAgent],
    ['code-reviewer', codeReviewerAgent],
    ['thinker', thinkerAgent]
  ])

  // Create adapter
  const adapter = createSpawnAgentsAdapter(
    registry,
    createMockAgentExecutor()
  )

  // Parent context
  const parentContext: AgentExecutionContext = {
    agentId: 'parent-123',
    messageHistory: [],
    output: {}
  }

  // Spawn multiple agents sequentially
  console.log('\nSpawning agents sequentially...')
  const result = await adapter.spawnAgents({
    agents: [
      {
        agent_type: 'file-picker',
        prompt: 'Find TypeScript files',
        params: { pattern: '*.ts' }
      },
      {
        agent_type: 'code-reviewer',
        prompt: 'Review the code'
      },
      {
        agent_type: 'thinker',
        prompt: 'Provide insights'
      }
    ]
  }, parentContext)

  // Display results
  console.log('\n--- Results ---')
  console.log(JSON.stringify(result[0].value, null, 2))
}

/**
 * Example 2: Error handling
 */
async function exampleErrorHandling() {
  console.log('\n========================================')
  console.log('Example 2: Error Handling')
  console.log('========================================')

  const registry: AgentRegistry = new Map([
    ['file-picker', filePickerAgent]
  ])

  const adapter = createSpawnAgentsAdapter(
    registry,
    createMockAgentExecutor()
  )

  const parentContext: AgentExecutionContext = {
    agentId: 'parent-456',
    messageHistory: [],
    output: {}
  }

  // Try to spawn agents including one that doesn't exist
  console.log('\nSpawning agents with one non-existent...')
  const result = await adapter.spawnAgents({
    agents: [
      { agent_type: 'file-picker', prompt: 'Find files' },
      { agent_type: 'non-existent-agent', prompt: 'This will fail' },
      { agent_type: 'file-picker', prompt: 'Find more files' }
    ]
  }, parentContext)

  console.log('\n--- Results ---')
  result[0].value.forEach((agentResult: any, index: number) => {
    console.log(`\nAgent ${index + 1}: ${agentResult.agentName}`)
    if (agentResult.value.errorMessage) {
      console.log(`  ERROR: ${agentResult.value.errorMessage}`)
    } else {
      console.log(`  SUCCESS:`, agentResult.value)
    }
  })
}

/**
 * Example 3: Agent registry management
 */
function exampleRegistryManagement() {
  console.log('\n========================================')
  console.log('Example 3: Registry Management')
  console.log('========================================')

  const registry: AgentRegistry = new Map([
    ['file-picker', filePickerAgent],
    ['code-reviewer', codeReviewerAgent],
    ['thinker', thinkerAgent]
  ])

  const adapter = createSpawnAgentsAdapter(
    registry,
    createMockAgentExecutor()
  )

  // List all registered agents
  console.log('\nRegistered agents:')
  adapter.listRegisteredAgents().forEach(agentId => {
    const info = adapter.getAgentInfo(agentId)
    console.log(`  - ${agentId}: ${info?.displayName}`)
  })

  // Check if specific agents exist
  console.log('\nAgent checks:')
  console.log(`  file-picker exists: ${adapter.hasAgent('file-picker')}`)
  console.log(`  non-existent exists: ${adapter.hasAgent('non-existent')}`)

  // Get agent info
  console.log('\nFile Picker info:')
  const filePickerInfo = adapter.getAgentInfo('file-picker')
  if (filePickerInfo) {
    console.log(`  Display Name: ${filePickerInfo.displayName}`)
    console.log(`  Model: ${filePickerInfo.model}`)
    console.log(`  Tools: ${filePickerInfo.toolNames?.join(', ')}`)
  }

  // Test fully qualified agent references
  console.log('\nFully qualified reference resolution:')
  console.log(`  codebuff/file-picker@0.0.1: ${adapter.hasAgent('codebuff/file-picker@0.0.1')}`)
  console.log(`  file-picker@1.0.0: ${adapter.hasAgent('file-picker@1.0.0')}`)
}

/**
 * Example 4: Parallel spawning (experimental)
 */
async function exampleParallelSpawning() {
  console.log('\n========================================')
  console.log('Example 4: Parallel Spawning (Experimental)')
  console.log('========================================')

  const registry: AgentRegistry = new Map([
    ['file-picker', filePickerAgent],
    ['code-reviewer', codeReviewerAgent],
    ['thinker', thinkerAgent]
  ])

  const adapter = createSpawnAgentsAdapter(
    registry,
    createMockAgentExecutor()
  )

  const parentContext: AgentExecutionContext = {
    agentId: 'parent-789',
    messageHistory: [],
    output: {}
  }

  console.log('\nSpawning agents in parallel (experimental)...')
  const startTime = Date.now()

  const result = await adapter.spawnAgentsParallel({
    agents: [
      { agent_type: 'file-picker', prompt: 'Task 1' },
      { agent_type: 'code-reviewer', prompt: 'Task 2' },
      { agent_type: 'thinker', prompt: 'Task 3' }
    ]
  }, parentContext)

  const duration = Date.now() - startTime

  console.log(`\nCompleted in ${duration}ms`)
  console.log('\n--- Results ---')
  console.log(JSON.stringify(result[0].value, null, 2))
}

// ============================================================================
// Main Function
// ============================================================================

async function main() {
  console.log('===========================================')
  console.log('Spawn Agents Adapter - Integration Examples')
  console.log('===========================================')

  try {
    // Run all examples
    await exampleSequentialSpawning()
    await exampleErrorHandling()
    exampleRegistryManagement()
    await exampleParallelSpawning()

    console.log('\n✓ All examples completed successfully!')

  } catch (error) {
    console.error('\n✗ Error running examples:', error)
    process.exit(1)
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  main()
}

// Export for use in other files
export {
  filePickerAgent,
  codeReviewerAgent,
  thinkerAgent,
  orchestratorAgent,
  createMockAgentExecutor
}
