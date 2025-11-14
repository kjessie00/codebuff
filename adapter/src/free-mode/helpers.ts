/**
 * FREE Mode Helper Functions
 *
 * Helper functions for common patterns when working with FREE mode adapters.
 * These functions provide convenient wrappers around agent execution with
 * error handling, retries, and output extraction.
 *
 * @module helpers
 */

import type { ClaudeCodeCLIAdapter, AgentExecutionResult } from '../claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'
import type {
  Result,
  ExecutionOptions,
  Extractor,
  AgentTask,
  ToolAvailability,
  ToolInfo,
} from './free-mode-types'
import { success, failure } from './free-mode-types'

// ============================================================================
// Execution Helpers
// ============================================================================

/**
 * Execute an agent with default error handling
 *
 * Wraps agent execution with try/catch and returns a Result type.
 *
 * @param adapter - ClaudeCodeCLIAdapter instance
 * @param agent - Agent definition to execute
 * @param prompt - User prompt for the agent
 * @param options - Execution options
 * @returns Promise resolving to Result with execution output
 *
 * @example
 * ```typescript
 * const result = await executeWithErrorHandling(
 *   adapter,
 *   fileExplorerAgent,
 *   'Find all TypeScript files'
 * )
 *
 * if (result.success) {
 *   console.log('Output:', result.data.output)
 * } else {
 *   console.error('Error:', result.error)
 * }
 * ```
 */
export async function executeWithErrorHandling(
  adapter: ClaudeCodeCLIAdapter,
  agent: AgentDefinition,
  prompt: string,
  options: ExecutionOptions = {}
): Promise<Result<AgentExecutionResult>> {
  try {
    // Progress tracking
    if (options.onProgress) {
      options.onProgress(0, 1)
    }

    // Execute agent
    const result = await adapter.executeAgent(agent, prompt)

    // Progress complete
    if (options.onProgress) {
      options.onProgress(1, 1)
    }

    return success(result)
  } catch (error: any) {
    if (!options.silent) {
      console.error(`Agent execution failed: ${error.message}`)
    }

    return failure(error.message, {
      agentId: agent.id,
      prompt,
      error,
    })
  }
}

/**
 * Execute an agent and extract specific output
 *
 * Executes an agent and applies an extractor function to process the output.
 *
 * @param adapter - ClaudeCodeCLIAdapter instance
 * @param agent - Agent definition to execute
 * @param prompt - User prompt for the agent
 * @param extractor - Function to extract desired output
 * @param options - Execution options
 * @returns Promise resolving to extracted output
 *
 * @example
 * ```typescript
 * // Extract file list from agent output
 * const files = await executeAndExtract(
 *   adapter,
 *   fileExplorerAgent,
 *   'Find all TypeScript files',
 *   (output) => output.files as string[]
 * )
 * ```
 */
export async function executeAndExtract<T>(
  adapter: ClaudeCodeCLIAdapter,
  agent: AgentDefinition,
  prompt: string,
  extractor: Extractor<T>,
  options: ExecutionOptions = {}
): Promise<Result<T>> {
  const result = await executeWithErrorHandling(adapter, agent, prompt, options)

  if (!result.success) {
    return result
  }

  try {
    const extracted = extractor(result.data.output)
    return success(extracted)
  } catch (error: any) {
    return failure(`Failed to extract output: ${error.message}`, {
      output: result.data.output,
      error,
    })
  }
}

/**
 * Execute an agent with retry logic
 *
 * Automatically retries failed executions with exponential backoff.
 *
 * @param adapter - ClaudeCodeCLIAdapter instance
 * @param agent - Agent definition to execute
 * @param prompt - User prompt for the agent
 * @param options - Execution options (including retries)
 * @returns Promise resolving to Result with execution output
 *
 * @example
 * ```typescript
 * const result = await executeWithRetry(
 *   adapter,
 *   terminalAgent,
 *   'npm install',
 *   { retries: 3, timeout: 60000 }
 * )
 * ```
 */
export async function executeWithRetry(
  adapter: ClaudeCodeCLIAdapter,
  agent: AgentDefinition,
  prompt: string,
  options: ExecutionOptions = {}
): Promise<Result<AgentExecutionResult>> {
  const maxRetries = options.retries ?? 1
  let lastError: any

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0 && !options.silent) {
      console.log(`Retry attempt ${attempt}/${maxRetries - 1}`)
    }

    const result = await executeWithErrorHandling(adapter, agent, prompt, {
      ...options,
      onProgress: options.onProgress
        ? (step, total) => options.onProgress!(step + attempt * total, total * maxRetries)
        : undefined,
    })

    if (result.success) {
      return result
    }

    lastError = result

    // Exponential backoff
    if (attempt < maxRetries - 1) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  return failure(`Failed after ${maxRetries} attempts: ${lastError.error}`, {
    attempts: maxRetries,
    lastError,
  })
}

/**
 * Execute an agent with timeout
 *
 * Wraps agent execution with a timeout to prevent hanging.
 *
 * @param adapter - ClaudeCodeCLIAdapter instance
 * @param agent - Agent definition to execute
 * @param prompt - User prompt for the agent
 * @param options - Execution options (including timeout)
 * @returns Promise resolving to Result with execution output
 *
 * @example
 * ```typescript
 * const result = await executeWithTimeout(
 *   adapter,
 *   codeSearchAgent,
 *   'Search for patterns',
 *   { timeout: 30000 } // 30 seconds
 * )
 * ```
 */
export async function executeWithTimeout(
  adapter: ClaudeCodeCLIAdapter,
  agent: AgentDefinition,
  prompt: string,
  options: ExecutionOptions = {}
): Promise<Result<AgentExecutionResult>> {
  const timeout = options.timeout ?? 120000 // Default 2 minutes

  const timeoutPromise = new Promise<Result<never>>((resolve) => {
    setTimeout(() => {
      resolve(failure(`Execution timed out after ${timeout}ms`, { timeout }))
    }, timeout)
  })

  const executionPromise = executeWithErrorHandling(adapter, agent, prompt, options)

  return Promise.race([executionPromise, timeoutPromise])
}

// ============================================================================
// Sequential Execution
// ============================================================================

/**
 * Execute multiple agents sequentially
 *
 * Runs a series of agent tasks one after another, passing results forward.
 *
 * @param adapter - ClaudeCodeCLIAdapter instance
 * @param tasks - Array of agent tasks to execute
 * @param options - Execution options
 * @returns Promise resolving to array of results
 *
 * @example
 * ```typescript
 * const results = await executeSequence(adapter, [
 *   { agent: fileExplorerAgent, prompt: 'Find all .ts files', name: 'explore' },
 *   { agent: codeSearchAgent, prompt: 'Search for TODOs', name: 'search' },
 *   { agent: todoFinderAgent, prompt: 'Organize TODOs', name: 'organize' }
 * ])
 *
 * results.forEach((result, i) => {
 *   if (result.success) {
 *     console.log(`Task ${i} completed:`, result.data.output)
 *   }
 * })
 * ```
 */
export async function executeSequence(
  adapter: ClaudeCodeCLIAdapter,
  tasks: AgentTask[],
  options: ExecutionOptions = {}
): Promise<Result<AgentExecutionResult>[]> {
  const results: Result<AgentExecutionResult>[] = []

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]

    if (!options.silent) {
      console.log(`Executing task ${i + 1}/${tasks.length}: ${task.name ?? task.agent.displayName}`)
    }

    if (options.onProgress) {
      options.onProgress(i, tasks.length)
    }

    const result = await executeWithErrorHandling(adapter, task.agent, task.prompt, {
      ...options,
      onProgress: undefined, // Don't pass progress to individual executions
    })

    results.push(result)

    // Stop on first error unless explicitly configured otherwise
    if (!result.success && !options.silent) {
      console.error(`Task failed: ${task.name ?? task.agent.displayName}`)
      break
    }
  }

  if (options.onProgress) {
    options.onProgress(tasks.length, tasks.length)
  }

  return results
}

/**
 * Execute multiple agents in parallel
 *
 * Runs multiple agent tasks concurrently for faster execution.
 *
 * @param adapter - ClaudeCodeCLIAdapter instance
 * @param tasks - Array of agent tasks to execute
 * @param options - Execution options
 * @returns Promise resolving to array of results
 *
 * @example
 * ```typescript
 * const results = await executeParallel(adapter, [
 *   { agent: codeSearchAgent, prompt: 'Find TODOs' },
 *   { agent: codeSearchAgent, prompt: 'Find FIXMEs' },
 *   { agent: codeSearchAgent, prompt: 'Find HACKs' }
 * ])
 * ```
 */
export async function executeParallel(
  adapter: ClaudeCodeCLIAdapter,
  tasks: AgentTask[],
  options: ExecutionOptions = {}
): Promise<Result<AgentExecutionResult>[]> {
  const promises = tasks.map((task) =>
    executeWithErrorHandling(adapter, task.agent, task.prompt, options)
  )

  return Promise.all(promises)
}

// ============================================================================
// Mode Checking
// ============================================================================

/**
 * Check if adapter is in FREE mode
 *
 * @param adapter - ClaudeCodeCLIAdapter instance
 * @returns True if adapter is in FREE mode (no API key)
 *
 * @example
 * ```typescript
 * if (isFreeMode(adapter)) {
 *   console.log('Running in FREE mode')
 * }
 * ```
 */
export function isFreeMode(adapter: ClaudeCodeCLIAdapter): boolean {
  return !adapter.hasApiKeyAvailable()
}

/**
 * Check if adapter is in PAID mode
 *
 * @param adapter - ClaudeCodeCLIAdapter instance
 * @returns True if adapter is in PAID mode (has API key)
 *
 * @example
 * ```typescript
 * if (isPaidMode(adapter)) {
 *   console.log('Full multi-agent support available')
 * }
 * ```
 */
export function isPaidMode(adapter: ClaudeCodeCLIAdapter): boolean {
  return adapter.hasApiKeyAvailable()
}

// ============================================================================
// Tool Information
// ============================================================================

/**
 * Get list of available tools in FREE mode
 *
 * Returns all tools that work without an API key.
 *
 * @returns Array of FREE mode tool names
 *
 * @example
 * ```typescript
 * const tools = getFreeModeTools()
 * console.log('Available tools:', tools)
 * // ['read_files', 'write_file', 'str_replace', 'code_search', 'find_files', 'run_terminal_command', 'set_output']
 * ```
 */
export function getFreeModeTools(): string[] {
  return [
    'read_files',
    'write_file',
    'str_replace',
    'code_search',
    'find_files',
    'run_terminal_command',
    'set_output',
  ]
}

/**
 * Get list of PAID mode only tools
 *
 * Returns tools that require an API key.
 *
 * @returns Array of PAID mode tool names
 *
 * @example
 * ```typescript
 * const tools = getPaidModeTools()
 * console.log('PAID mode tools:', tools)
 * // ['spawn_agents']
 * ```
 */
export function getPaidModeTools(): string[] {
  return ['spawn_agents']
}

/**
 * Get comprehensive tool availability information
 *
 * Returns detailed information about all tools and their availability.
 *
 * @param adapter - ClaudeCodeCLIAdapter instance
 * @returns Map of tool names to availability info
 *
 * @example
 * ```typescript
 * const availability = getToolAvailability(adapter)
 *
 * Object.entries(availability).forEach(([tool, info]) => {
 *   console.log(`${tool}: ${info.available ? 'available' : 'not available'}`)
 *   if (!info.available) {
 *     console.log(`  Requires: ${info.requiresApiKey ? 'API key' : 'unknown'}`)
 *   }
 * })
 * ```
 */
export function getToolAvailability(adapter: ClaudeCodeCLIAdapter): ToolAvailability {
  const hasApiKey = adapter.hasApiKeyAvailable()

  const tools: ToolAvailability = {
    read_files: {
      available: true,
      requiresApiKey: false,
      description: 'Read multiple files from disk',
      category: 'file',
    },
    write_file: {
      available: true,
      requiresApiKey: false,
      description: 'Write content to a file',
      category: 'file',
    },
    str_replace: {
      available: true,
      requiresApiKey: false,
      description: 'Replace string in a file',
      category: 'file',
    },
    code_search: {
      available: true,
      requiresApiKey: false,
      description: 'Search codebase with ripgrep',
      category: 'code',
    },
    find_files: {
      available: true,
      requiresApiKey: false,
      description: 'Find files matching glob pattern',
      category: 'code',
    },
    run_terminal_command: {
      available: true,
      requiresApiKey: false,
      description: 'Execute shell commands',
      category: 'terminal',
    },
    set_output: {
      available: true,
      requiresApiKey: false,
      description: 'Set agent output value',
      category: 'output',
    },
    spawn_agents: {
      available: hasApiKey,
      requiresApiKey: true,
      description: 'Spawn and execute sub-agents (requires API key)',
      category: 'agent',
    },
  }

  return tools
}

/**
 * Check if a specific tool is available
 *
 * @param adapter - ClaudeCodeCLIAdapter instance
 * @param toolName - Tool name to check
 * @returns True if tool is available
 *
 * @example
 * ```typescript
 * if (isToolAvailable(adapter, 'spawn_agents')) {
 *   console.log('Multi-agent support available')
 * } else {
 *   console.log('spawn_agents requires API key')
 * }
 * ```
 */
export function isToolAvailable(
  adapter: ClaudeCodeCLIAdapter,
  toolName: string
): boolean {
  const availability = getToolAvailability(adapter)
  return availability[toolName]?.available ?? false
}

/**
 * Get tools by category
 *
 * @param category - Tool category
 * @returns Array of tool names in the category
 *
 * @example
 * ```typescript
 * const fileTools = getToolsByCategory('file')
 * // ['read_files', 'write_file', 'str_replace']
 * ```
 */
export function getToolsByCategory(
  category: ToolInfo['category']
): string[] {
  const dummyAdapter = { hasApiKeyAvailable: () => true } as ClaudeCodeCLIAdapter
  const availability = getToolAvailability(dummyAdapter)

  return Object.entries(availability)
    .filter(([_, info]) => info.category === category)
    .map(([name, _]) => name)
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate that an agent can run in FREE mode
 *
 * Checks if an agent definition only uses FREE mode tools.
 *
 * @param agent - Agent definition to validate
 * @returns Result indicating if agent is compatible with FREE mode
 *
 * @example
 * ```typescript
 * const validation = validateAgentForFreeMode(myAgent)
 * if (validation.success) {
 *   console.log('Agent is FREE mode compatible')
 * } else {
 *   console.error('Agent requires PAID mode:', validation.error)
 * }
 * ```
 */
export function validateAgentForFreeMode(
  agent: AgentDefinition
): Result<boolean> {
  const freeModeTools = getFreeModeTools()
  const paidModeTools = getPaidModeTools()

  const toolNames = agent.toolNames ?? []

  const requiresPaidMode = toolNames.some((tool) => paidModeTools.includes(tool))

  if (requiresPaidMode) {
    const paidTools = toolNames.filter((tool) => paidModeTools.includes(tool))
    return failure(
      `Agent requires PAID mode tools: ${paidTools.join(', ')}`,
      { agent: agent.id, paidTools }
    )
  }

  return success(true)
}

/**
 * Get FREE mode compatible agents from a list
 *
 * Filters a list of agents to only those that work in FREE mode.
 *
 * @param agents - Array of agent definitions
 * @returns Array of FREE mode compatible agents
 *
 * @example
 * ```typescript
 * const allAgents = [agent1, agent2, agent3]
 * const freeAgents = getFreeModeCompatibleAgents(allAgents)
 * console.log(`${freeAgents.length} agents work in FREE mode`)
 * ```
 */
export function getFreeModeCompatibleAgents(
  agents: AgentDefinition[]
): AgentDefinition[] {
  return agents.filter((agent) => {
    const validation = validateAgentForFreeMode(agent)
    return validation.success
  })
}

// ============================================================================
// Output Helpers
// ============================================================================

/**
 * Pretty print agent execution result
 *
 * @param result - Agent execution result
 * @param options - Display options
 *
 * @example
 * ```typescript
 * const result = await executeAgent(adapter, agent, prompt)
 * prettyPrintResult(result)
 * ```
 */
export function prettyPrintResult(
  result: Result<AgentExecutionResult>,
  options: { includeMetadata?: boolean; includeHistory?: boolean } = {}
): void {
  if (result.success) {
    console.log('\n=== Execution Successful ===')
    console.log('\nOutput:')
    console.log(JSON.stringify(result.data.output, null, 2))

    if (options.includeMetadata && result.data.metadata) {
      console.log('\nMetadata:')
      console.log(JSON.stringify(result.data.metadata, null, 2))
    }

    if (options.includeHistory) {
      console.log(`\nMessage History (${result.data.messageHistory.length} messages)`)
    }
  } else {
    console.error('\n=== Execution Failed ===')
    console.error('\nError:', result.error)

    if (result.details) {
      console.error('\nDetails:')
      console.error(JSON.stringify(result.details, null, 2))
    }
  }
}

/**
 * Create a progress bar for agent execution
 *
 * @param label - Progress bar label
 * @returns Progress callback function
 *
 * @example
 * ```typescript
 * const result = await executeWithErrorHandling(
 *   adapter,
 *   agent,
 *   prompt,
 *   { onProgress: createProgressBar('Processing') }
 * )
 * ```
 */
export function createProgressBar(label: string): (step: number, total: number) => void {
  return (step: number, total: number) => {
    const percentage = Math.round((step / total) * 100)
    const bar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5))
    process.stdout.write(`\r${label}: [${bar}] ${percentage}%`)

    if (step === total) {
      process.stdout.write('\n')
    }
  }
}
