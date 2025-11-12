/**
 * Spawn Agents Tool for Claude CLI Adapter
 *
 * Maps Codebuff's spawn_agents tool to Claude Code CLI's Task tool.
 * Note: Claude CLI Task tool limitation means sequential execution instead of parallel.
 *
 * Key differences from Codebuff:
 * - Codebuff: Parallel execution via Promise.allSettled
 * - Claude CLI: Sequential execution (Task tool constraint)
 * - Performance tradeoff: Sequential is slower but more predictable
 *
 * @module spawn-agents
 */

import type { AgentDefinition, AgentState } from '../../../.agents/types/agent-definition'
import type { ToolResultOutput, Message } from '../../../.agents/types/util-types'
import type { AgentExecutionContext as AdapterAgentExecutionContext } from '../types'

/**
 * Tool result output format matching Codebuff's expectations
 */
export type { ToolResultOutput }

/**
 * Parameters for spawn_agents tool
 */
export interface SpawnAgentsParams {
  /**
   * Array of agents to spawn with their prompts and parameters
   */
  agents: Array<{
    /** Agent ID or fully qualified agent reference (e.g., 'file-picker' or 'codebuff/file-picker@0.0.1') */
    agent_type: string
    /** Prompt to send to the spawned agent */
    prompt?: string
    /** Parameters object for the agent (if any) */
    params?: Record<string, any>
  }>
}

/**
 * Result from spawning a single agent
 * Compatible with JSONValue type for ToolResultOutput
 */
export interface SpawnedAgentResult {
  /** Agent type/ID that was spawned */
  agentType: string
  /** Display name of the agent */
  agentName: string
  /** Output from the agent or error information */
  value: any
  /** Index signature for JSONObject compatibility */
  [key: string]: any
}

/**
 * Agent executor function type
 * Function that executes an agent and returns its output
 */
export type AgentExecutor = (
  agentDef: AgentDefinition,
  prompt: string | undefined,
  params: Record<string, any> | undefined,
  parentContext: AgentExecutionContext
) => Promise<{
  output: any
  messageHistory: Message[]
}>

/**
 * Parent execution context passed to spawned agents
 * Re-export from types with additional optional fields
 */
export type AgentExecutionContext = AdapterAgentExecutionContext & {
  /** Agent state */
  agentState?: AgentState
}

/**
 * Agent registry for looking up agent definitions
 * Maps agent IDs to their full definitions
 */
export type AgentRegistry = Map<string, AgentDefinition>

/**
 * Spawn Agents Tool implementation
 *
 * Manages spawning and executing sub-agents. Unlike Codebuff's parallel
 * execution model, this adapter executes agents sequentially due to
 * Claude CLI Task tool limitations.
 *
 * Features:
 * - Sequential execution of multiple sub-agents
 * - Agent registry lookup by ID
 * - Parent-child context inheritance
 * - Comprehensive error handling
 * - Result aggregation matching Codebuff format
 *
 * @example
 * ```typescript
 * const registry = new Map([
 *   ['file-picker', filePickerAgent],
 *   ['code-reviewer', codeReviewerAgent]
 * ])
 *
 * const adapter = new SpawnAgentsAdapter(registry, agentExecutor)
 *
 * const results = await adapter.spawnAgents({
 *   agents: [
 *     { agent_type: 'file-picker', prompt: 'Find TypeScript files' },
 *     { agent_type: 'code-reviewer', prompt: 'Review the code' }
 *   ]
 * }, parentContext)
 * ```
 */
export class SpawnAgentsAdapter {
  /**
   * Create a new SpawnAgentsAdapter
   *
   * @param agentRegistry - Map of agent IDs to their definitions
   * @param agentExecutor - Function to execute an agent and get its output
   */
  constructor(
    private readonly agentRegistry: AgentRegistry,
    private readonly agentExecutor: AgentExecutor
  ) {}

  /**
   * Spawn multiple agents and execute them sequentially
   *
   * This is the main implementation of the spawn_agents tool.
   * Executes each agent in sequence, collecting results and handling errors.
   *
   * Note: Sequential execution is a limitation of Claude CLI's Task tool,
   * which doesn't support parallel agent execution like Codebuff does.
   *
   * @param input - Object containing array of agents to spawn
   * @param parentContext - Context from the parent agent (for inheritance)
   * @returns Promise resolving to tool result with all agent outputs
   *
   * @example
   * ```typescript
   * const result = await adapter.spawnAgents({
   *   agents: [
   *     {
   *       agent_type: 'file-picker',
   *       prompt: 'Find all test files',
   *       params: { pattern: '*.test.ts' }
   *     },
   *     {
   *       agent_type: 'code-reviewer',
   *       prompt: 'Review the test files'
   *     }
   *   ]
   * }, parentContext)
   *
   * // result[0].value = [
   * //   {
   * //     agentType: 'file-picker',
   * //     agentName: 'File Picker',
   * //     value: { files: [...] }
   * //   },
   * //   {
   * //     agentType: 'code-reviewer',
   * //     agentName: 'Code Reviewer',
   * //     value: { review: '...' }
   * //   }
   * // ]
   * ```
   */
  async spawnAgents(
    input: SpawnAgentsParams,
    parentContext: AgentExecutionContext
  ): Promise<ToolResultOutput[]> {
    const results: SpawnedAgentResult[] = []

    // NOTE: Sequential execution due to Claude Code CLI Task tool limitation
    // This is slower than Codebuff's parallel Promise.allSettled approach,
    // but is necessary for Claude CLI compatibility
    for (const agentSpec of input.agents) {
      try {
        // Look up agent definition in registry
        const agentDef = this.resolveAgent(agentSpec.agent_type)

        if (!agentDef) {
          // Agent not found - add error result
          results.push({
            agentType: agentSpec.agent_type,
            agentName: agentSpec.agent_type,
            value: {
              errorMessage: `Agent not found in registry: ${agentSpec.agent_type}. ` +
                'Make sure the agent is registered before spawning.'
            }
          })
          continue
        }

        // Execute the sub-agent
        const { output } = await this.agentExecutor(
          agentDef,
          agentSpec.prompt,
          agentSpec.params,
          parentContext
        )

        // Add successful result
        results.push({
          agentType: agentSpec.agent_type,
          agentName: agentDef.displayName,
          value: output ?? { type: 'lastMessage', value: 'Agent completed without output' }
        })

      } catch (error) {
        // Agent execution failed - add error result
        results.push({
          agentType: agentSpec.agent_type,
          agentName: agentSpec.agent_type,
          value: {
            errorMessage: this.formatError(error)
          }
        })
      }
    }

    // Return results in Codebuff's expected format
    return [
      {
        type: 'json',
        value: results
      }
    ]
  }

  /**
   * Spawn agents in parallel (experimental)
   *
   * This is an experimental version that attempts to spawn agents in parallel.
   * It may work if Claude Code CLI supports multiple concurrent Task executions,
   * but this is not guaranteed.
   *
   * WARNING: This is not the default implementation because Claude CLI may not
   * support concurrent agent execution. Use at your own risk.
   *
   * @param input - Object containing array of agents to spawn
   * @param parentContext - Context from the parent agent
   * @returns Promise resolving to tool result with all agent outputs
   *
   * @experimental
   *
   * @example
   * ```typescript
   * // Enable experimental parallel execution
   * const result = await adapter.spawnAgentsParallel({
   *   agents: [
   *     { agent_type: 'agent1', prompt: 'Task 1' },
   *     { agent_type: 'agent2', prompt: 'Task 2' }
   *   ]
   * }, parentContext)
   * ```
   */
  async spawnAgentsParallel(
    input: SpawnAgentsParams,
    parentContext: AgentExecutionContext
  ): Promise<ToolResultOutput[]> {
    // Create promises for all agent executions
    const agentPromises = input.agents.map(async (agentSpec) => {
      try {
        // Look up agent definition
        const agentDef = this.resolveAgent(agentSpec.agent_type)

        if (!agentDef) {
          return {
            agentType: agentSpec.agent_type,
            agentName: agentSpec.agent_type,
            value: {
              errorMessage: `Agent not found in registry: ${agentSpec.agent_type}`
            }
          }
        }

        // Execute agent
        const { output } = await this.agentExecutor(
          agentDef,
          agentSpec.prompt,
          agentSpec.params,
          parentContext
        )

        return {
          agentType: agentSpec.agent_type,
          agentName: agentDef.displayName,
          value: output ?? { type: 'lastMessage', value: 'Agent completed without output' }
        }

      } catch (error) {
        return {
          agentType: agentSpec.agent_type,
          agentName: agentSpec.agent_type,
          value: {
            errorMessage: this.formatError(error)
          }
        }
      }
    })

    // Wait for all agents to complete (or fail)
    const settledResults = await Promise.allSettled(agentPromises)

    // Extract results from settled promises
    const results: SpawnedAgentResult[] = settledResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        // Promise rejection (should be rare since we handle errors in the promise)
        return {
          agentType: input.agents[index].agent_type,
          agentName: input.agents[index].agent_type,
          value: {
            errorMessage: this.formatError(result.reason)
          }
        }
      }
    })

    return [
      {
        type: 'json',
        value: results
      }
    ]
  }

  /**
   * Get information about a registered agent
   *
   * Useful for debugging and validation. Can be called before spawning
   * to verify an agent exists and understand its capabilities.
   *
   * @param agentId - Agent ID to lookup
   * @returns Agent definition or undefined if not found
   *
   * @example
   * ```typescript
   * const agentDef = adapter.getAgentInfo('file-picker')
   * if (agentDef) {
   *   console.log('Agent:', agentDef.displayName)
   *   console.log('Tools:', agentDef.toolNames)
   * }
   * ```
   */
  getAgentInfo(agentId: string): AgentDefinition | undefined {
    return this.resolveAgent(agentId)
  }

  /**
   * List all registered agents
   *
   * Returns an array of all agent IDs currently in the registry.
   *
   * @returns Array of registered agent IDs
   *
   * @example
   * ```typescript
   * const agents = adapter.listRegisteredAgents()
   * console.log('Available agents:', agents)
   * // ['file-picker', 'code-reviewer', 'thinker', ...]
   * ```
   */
  listRegisteredAgents(): string[] {
    return Array.from(this.agentRegistry.keys())
  }

  /**
   * Check if an agent is registered
   *
   * @param agentId - Agent ID to check
   * @returns true if agent is registered, false otherwise
   *
   * @example
   * ```typescript
   * if (!adapter.hasAgent('file-picker')) {
   *   console.error('file-picker not registered!')
   * }
   * ```
   */
  hasAgent(agentId: string): boolean {
    return this.agentRegistry.has(this.normalizeAgentId(agentId))
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Resolve an agent definition from the registry
   *
   * Handles both simple IDs ('file-picker') and fully qualified references
   * ('codebuff/file-picker@0.0.1'). For now, strips version and publisher
   * and looks up by the base ID.
   *
   * @param agentReference - Agent ID or fully qualified reference
   * @returns Agent definition or undefined if not found
   */
  private resolveAgent(agentReference: string): AgentDefinition | undefined {
    // Normalize the agent reference to just the ID
    const agentId = this.normalizeAgentId(agentReference)

    // Look up in registry
    return this.agentRegistry.get(agentId)
  }

  /**
   * Normalize an agent reference to a simple ID
   *
   * Converts fully qualified references like 'codebuff/file-picker@0.0.1'
   * to just 'file-picker'.
   *
   * @param agentReference - Full agent reference
   * @returns Normalized agent ID
   *
   * @example
   * normalizeAgentId('codebuff/file-picker@0.0.1') // => 'file-picker'
   * normalizeAgentId('file-picker') // => 'file-picker'
   */
  private normalizeAgentId(agentReference: string): string {
    // Strip publisher prefix if present (e.g., 'codebuff/file-picker@0.0.1' -> 'file-picker@0.0.1')
    let id = agentReference
    if (id.includes('/')) {
      id = id.split('/')[1]
    }

    // Strip version suffix if present (e.g., 'file-picker@0.0.1' -> 'file-picker')
    if (id.includes('@')) {
      id = id.split('@')[0]
    }

    return id
  }

  /**
   * Format an error into a user-friendly message
   *
   * @param error - Error to format
   * @returns Formatted error message
   */
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      // Include error name for better debugging
      return `${error.name}: ${error.message}`
    }
    if (typeof error === 'string') {
      return error
    }
    if (typeof error === 'object' && error !== null) {
      try {
        return JSON.stringify(error)
      } catch {
        return String(error)
      }
    }
    return 'Unknown error occurred'
  }
}

/**
 * Create a new SpawnAgentsAdapter instance
 *
 * Convenience factory function for creating the adapter with proper typing.
 *
 * @param agentRegistry - Map of agent IDs to their definitions
 * @param agentExecutor - Function to execute an agent
 * @returns SpawnAgentsAdapter instance
 *
 * @example
 * ```typescript
 * const adapter = createSpawnAgentsAdapter(
 *   new Map([
 *     ['file-picker', filePickerAgent],
 *     ['code-reviewer', codeReviewerAgent]
 *   ]),
 *   async (def, prompt, params, ctx) => {
 *     // Your agent execution logic
 *     return { output: {...}, messageHistory: [...] }
 *   }
 * )
 * ```
 */
export function createSpawnAgentsAdapter(
  agentRegistry: AgentRegistry,
  agentExecutor: AgentExecutor
): SpawnAgentsAdapter {
  return new SpawnAgentsAdapter(agentRegistry, agentExecutor)
}
