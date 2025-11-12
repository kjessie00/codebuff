/**
 * Example: Using HandleStepsExecutor
 *
 * This example demonstrates how to use the HandleStepsExecutor to execute
 * an agent's handleSteps generator function.
 */

import {
  HandleStepsExecutor,
  createDebugExecutor,
  type ToolExecutor,
  type LLMExecutor,
  type TextOutputHandler,
} from '../src/handle-steps-executor'

import type {
  AgentDefinition,
  AgentStepContext,
  ToolCall,
  AgentState,
} from '../../common/src/templates/initial-agents-dir/types/agent-definition'

import type { ToolResultOutput } from '../../common/src/templates/initial-agents-dir/types/util-types'

// ============================================================================
// Example 1: Basic Usage with a Simple Agent
// ============================================================================

/**
 * Example agent that reads files and analyzes them
 */
const fileAnalyzerAgent: AgentDefinition = {
  id: 'file-analyzer',
  displayName: 'File Analyzer',
  model: 'anthropic/claude-sonnet-4.5',
  toolNames: ['read_files', 'code_search', 'set_output'],

  handleSteps: function* ({ agentState, prompt, params, logger }) {
    logger.info('Starting file analysis')

    // Step 1: Read the files
    const { toolResult: readResult } = yield {
      toolName: 'read_files',
      input: {
        paths: params?.files || ['README.md'],
      },
    }

    logger.info('Files read successfully', { resultCount: readResult?.length })

    // Step 2: Search for patterns
    yield {
      toolName: 'code_search',
      input: {
        pattern: params?.searchPattern || 'TODO',
        flags: '-i',
      },
    }

    // Step 3: Let the LLM analyze the results
    logger.info('Asking LLM to analyze')
    yield 'STEP_ALL'

    // Step 4: Set output
    yield {
      toolName: 'set_output',
      input: {
        output: {
          status: 'completed',
          filesAnalyzed: params?.files?.length || 1,
        },
      },
    }

    logger.info('Analysis complete')
  },
}

/**
 * Mock tool executor for demonstration
 */
const mockToolExecutor: ToolExecutor = async (toolCall: ToolCall) => {
  console.log(`[Tool] Executing: ${toolCall.toolName}`)
  console.log(`[Tool] Input:`, JSON.stringify(toolCall.input, null, 2))

  // Simulate different tool responses
  switch (toolCall.toolName) {
    case 'read_files':
      return [
        {
          type: 'json',
          value: {
            'README.md': '# Example Project\n\nTODO: Add more documentation',
            'src/index.ts': 'console.log("Hello world")',
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
                path: 'README.md',
                line_number: 3,
                line: 'TODO: Add more documentation',
              },
            ],
            total: 1,
          },
        },
      ]

    case 'set_output':
      return [{ type: 'json', value: { success: true } }]

    default:
      return [{ type: 'json', value: { error: 'Unknown tool' } }]
  }
}

/**
 * Mock LLM executor for demonstration
 */
const mockLLMExecutor: LLMExecutor = async (mode, agentState?) => {
  console.log(`[LLM] Executing ${mode}`)

  // Simulate LLM thinking and responding
  const response = `Based on the files I've analyzed, I found 1 TODO item in the README.md file.`

  const updatedState: AgentState = agentState || {
    agentId: 'agent-1',
    runId: 'run-1',
    parentId: undefined,
    messageHistory: [],
    output: undefined,
  }

  updatedState.messageHistory.push({
    role: 'assistant',
    content: response,
  })

  return {
    endTurn: true,
    agentState: updatedState,
  }
}

/**
 * Mock text output handler
 */
const mockTextOutputHandler: TextOutputHandler = (text: string) => {
  console.log(`[Output] ${text}`)
}

/**
 * Run the example
 */
async function runExample1() {
  console.log('\n=== Example 1: Basic Usage ===\n')

  // Create the executor
  const executor = createDebugExecutor({
    maxIterations: 50,
  })

  // Create initial context
  const context: AgentStepContext = {
    agentState: {
      agentId: 'agent-1',
      runId: 'run-1',
      parentId: undefined,
      messageHistory: [
        {
          role: 'user',
          content: 'Please analyze the project files and find all TODO items',
        },
      ],
      output: undefined,
    },
    prompt: 'Please analyze the project files and find all TODO items',
    params: {
      files: ['README.md', 'src/index.ts'],
      searchPattern: 'TODO',
    },
    logger: {
      debug: (data: any, msg?: string) => console.log('[DEBUG]', msg || '', data),
      info: (data: any, msg?: string) => console.log('[INFO]', msg || '', data),
      warn: (data: any, msg?: string) => console.warn('[WARN]', msg || '', data),
      error: (data: any, msg?: string) => console.error('[ERROR]', msg || '', data),
    },
  }

  // Execute the agent
  try {
    const result = await executor.execute(
      fileAnalyzerAgent,
      context,
      mockToolExecutor,
      mockLLMExecutor,
      mockTextOutputHandler
    )

    console.log('\n=== Execution Result ===')
    console.log('Iteration count:', result.iterationCount)
    console.log('Completed normally:', result.completedNormally)
    console.log('Final output:', result.agentState.output)
    console.log('Message history length:', result.agentState.messageHistory.length)

    if (result.error) {
      console.error('Error:', result.error.message)
    }
  } catch (error) {
    console.error('Execution failed:', error)
  }
}

// ============================================================================
// Example 2: Error Handling and Max Iterations
// ============================================================================

/**
 * Agent with an infinite loop (for demonstration)
 */
const infiniteLoopAgent: AgentDefinition = {
  id: 'infinite-loop',
  displayName: 'Infinite Loop Agent',
  model: 'anthropic/claude-sonnet-4.5',
  toolNames: ['code_search'],

  handleSteps: function* ({ logger }) {
    // This will loop forever without terminating
    while (true) {
      logger.info('Searching...')
      yield {
        toolName: 'code_search',
        input: { pattern: 'test' },
      }
    }
  },
}

async function runExample2() {
  console.log('\n=== Example 2: Max Iterations Protection ===\n')

  const executor = new HandleStepsExecutor({
    maxIterations: 10, // Set low for demonstration
    debug: true,
  })

  const context: AgentStepContext = {
    agentState: {
      agentId: 'agent-2',
      runId: 'run-2',
      parentId: undefined,
      messageHistory: [],
      output: undefined,
    },
    logger: {
      debug: (data: any) => console.log('[DEBUG]', data),
      info: (data: any) => console.log('[INFO]', data),
      warn: (data: any) => console.warn('[WARN]', data),
      error: (data: any) => console.error('[ERROR]', data),
    },
  }

  try {
    const result = await executor.execute(
      infiniteLoopAgent,
      context,
      mockToolExecutor,
      mockLLMExecutor
    )

    console.log('\n=== Result ===')
    console.log('Should have hit max iterations')
    console.log('Error:', result.error?.message)
  } catch (error) {
    console.error('Caught error (expected):', error)
  }
}

// ============================================================================
// Example 3: Using STEP and STEP_TEXT
// ============================================================================

const interactiveAgent: AgentDefinition = {
  id: 'interactive',
  displayName: 'Interactive Agent',
  model: 'anthropic/claude-sonnet-4.5',
  toolNames: [],

  handleSteps: function* ({ logger }) {
    // Output some text
    yield {
      type: 'STEP_TEXT',
      text: 'Starting interactive conversation...',
    }

    // Single LLM step
    const { stepsComplete: step1Complete } = yield 'STEP'

    yield {
      type: 'STEP_TEXT',
      text: 'First step complete. Continuing...',
    }

    if (!step1Complete) {
      yield 'STEP'
    }

    yield {
      type: 'STEP_TEXT',
      text: 'All done!',
    }
  },
}

async function runExample3() {
  console.log('\n=== Example 3: STEP and STEP_TEXT ===\n')

  const executor = createDebugExecutor()

  const context: AgentStepContext = {
    agentState: {
      agentId: 'agent-3',
      runId: 'run-3',
      parentId: undefined,
      messageHistory: [],
      output: undefined,
    },
    logger: {
      debug: (data: any) => {},
      info: (data: any) => console.log('[INFO]', data),
      warn: (data: any) => console.warn('[WARN]', data),
      error: (data: any) => console.error('[ERROR]', data),
    },
  }

  const result = await executor.execute(
    interactiveAgent,
    context,
    mockToolExecutor,
    mockLLMExecutor,
    (text) => console.log(`\n>>> ${text}\n`)
  )

  console.log('\n=== Result ===')
  console.log('Iterations:', result.iterationCount)
  console.log('Message history length:', result.agentState.messageHistory.length)
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('='.repeat(80))
  console.log('HandleStepsExecutor Examples')
  console.log('='.repeat(80))

  await runExample1()
  await runExample2()
  await runExample3()

  console.log('\n' + '='.repeat(80))
  console.log('All examples completed!')
  console.log('='.repeat(80) + '\n')
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { runExample1, runExample2, runExample3 }
