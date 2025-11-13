/**
 * LLM Executor for Claude CLI Adapter
 *
 * Handles all interactions with the Claude LLM, including:
 * - Building system prompts from agent definitions
 * - Invoking Claude with appropriate parameters
 * - Managing message history
 * - Executing single and multi-step LLM interactions
 * - Extracting outputs based on output modes
 *
 * This class provides the bridge between the agent framework and
 * the actual Claude Code CLI LLM interface.
 *
 * HYBRID MODE SUPPORT:
 * - FREE mode: No API key, spawn_agents disabled
 * - PAID mode: API key provided, full multi-agent support via Anthropic API
 *
 * @module llm-executor
 */

import type { AgentDefinition, AgentState } from '../../.agents/types/agent-definition'
import type { Message } from '../../.agents/types/util-types'
import type { AgentExecutionContext } from './types'
import type { ToolCall } from '../../.agents/types/agent-definition'
import type { ToolResultOutput } from '../../.agents/types/util-types'
import { MAX_STEP_ALL_ITERATIONS, MAX_PROMPT_DISPLAY_LENGTH } from './utils/constants'
import { AnthropicAPIIntegration } from './anthropic-api-integration'

/**
 * Parameters for Claude invocation
 */
export interface ClaudeInvocationParams {
  /** System prompt combining agent prompts */
  systemPrompt: string

  /** Message history to send to Claude */
  messages: Message[]

  /** List of available tool names */
  tools: string[]
}

/**
 * Configuration for LLMExecutor
 */
export interface LLMExecutorConfig {
  /** Optional Anthropic API key for PAID mode */
  anthropicApiKey?: string

  /** Enable debug logging */
  debug?: boolean

  /** Logger function */
  logger?: (message: string) => void

  /** Maximum iterations for STEP_ALL mode */
  maxStepAllIterations?: number

  /** Tool executor function (required for API mode) */
  toolExecutor?: (toolCall: ToolCall) => Promise<ToolResultOutput[]>
}

/**
 * Result from executing an LLM step
 */
export interface LLMStepResult {
  /** Whether this step ended the turn (no more tool calls) */
  endTurn: boolean

  /** Updated agent state after the step */
  agentState: AgentState
}

/**
 * LLM Executor
 *
 * Manages all LLM interactions for agent execution. Handles prompt building,
 * invocation, and output extraction with support for different execution modes.
 *
 * Execution Modes:
 * - Pure LLM: Direct prompt to response
 * - STEP: Execute single LLM interaction
 * - STEP_ALL: Execute until completion or limit
 *
 * @example
 * ```typescript
 * const executor = new LLMExecutor({
 *   debug: true,
 *   maxStepAllIterations: 50
 * })
 *
 * const result = await executor.executeSingleStep(
 *   agentDef,
 *   context,
 *   'STEP'
 * )
 * ```
 */
export class LLMExecutor {
  private readonly config: Required<Omit<LLMExecutorConfig, 'anthropicApiKey' | 'toolExecutor'>>
  private readonly anthropicApiKey?: string
  private readonly toolExecutor?: (toolCall: ToolCall) => Promise<ToolResultOutput[]>
  private anthropicIntegration?: AnthropicAPIIntegration

  /**
   * Create a new LLMExecutor
   *
   * @param config - Executor configuration
   */
  constructor(config: LLMExecutorConfig = {}) {
    this.config = {
      debug: config.debug ?? false,
      logger: config.logger ?? this.defaultLogger,
      maxStepAllIterations: config.maxStepAllIterations ?? MAX_STEP_ALL_ITERATIONS,
    }

    this.anthropicApiKey = config.anthropicApiKey
    this.toolExecutor = config.toolExecutor

    // Initialize Anthropic integration if API key is provided
    if (this.anthropicApiKey) {
      this.anthropicIntegration = new AnthropicAPIIntegration({
        apiKey: this.anthropicApiKey,
        debug: this.config.debug,
        logger: this.config.logger,
      })
    }
  }

  /**
   * Execute agent in pure LLM mode (no handleSteps)
   *
   * This mode sends the prompt directly to the LLM with the agent's
   * system prompt and available tools. The LLM decides what tools to use.
   *
   * @param agentDef - Agent definition
   * @param prompt - User prompt (optional)
   * @param context - Execution context
   * @returns Extracted output based on agent's outputMode
   *
   * @example
   * ```typescript
   * const output = await executor.executePureLLM(
   *   agentDef,
   *   'Find all TypeScript files',
   *   context
   * )
   * ```
   */
  async executePureLLM(
    agentDef: AgentDefinition,
    prompt: string | undefined,
    context: AgentExecutionContext
  ): Promise<any> {
    this.log('Executing in pure LLM mode')

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(agentDef)

    // Add user message to history if prompt is provided
    if (prompt) {
      context.messageHistory.push({
        role: 'user',
        content: prompt,
      })
    }

    // Invoke Claude (placeholder)
    const response = await this.invokeClaude({
      systemPrompt,
      messages: context.messageHistory,
      tools: agentDef.toolNames ?? [],
    })

    // Add assistant response to history
    context.messageHistory.push({
      role: 'assistant',
      content: response,
    })

    // Determine output based on outputMode
    return this.extractOutput(agentDef, context, response)
  }

  /**
   * Execute a single LLM step
   *
   * Called by handleSteps executor when it encounters 'STEP'.
   * Executes one interaction with the LLM and returns the result.
   *
   * @param agentDef - Agent definition
   * @param context - Execution context (modified in place)
   * @returns Step result with endTurn flag and agent state
   *
   * @example
   * ```typescript
   * const result = await executor.executeSingleStep(agentDef, context)
   * if (result.endTurn) {
   *   // No more tool calls, execution complete
   * }
   * ```
   */
  async executeSingleStep(
    agentDef: AgentDefinition,
    context: AgentExecutionContext
  ): Promise<LLMStepResult> {
    this.log('Executing single LLM step')

    // Build system prompt with step prompt
    const systemPrompt = this.buildSystemPrompt(agentDef, true)

    // Invoke Claude
    const response = await this.invokeClaude({
      systemPrompt,
      messages: context.messageHistory,
      tools: agentDef.toolNames ?? [],
    })

    // Add response to history
    context.messageHistory.push({
      role: 'assistant',
      content: response,
    })

    // Decrement steps
    context.stepsRemaining--

    // Check if this is end turn (no tool calls)
    const endTurn = this.isEndTurn(response)

    return {
      endTurn,
      agentState: this.contextToAgentState(context),
    }
  }

  /**
   * Execute multiple LLM steps until completion
   *
   * Called by handleSteps executor when it encounters 'STEP_ALL'.
   * Continues executing LLM steps until the LLM signals completion
   * or the step limit is reached.
   *
   * @param agentDef - Agent definition
   * @param context - Execution context (modified in place)
   * @returns Step result with final agent state
   *
   * @example
   * ```typescript
   * const result = await executor.executeAllSteps(agentDef, context)
   * // Execution continues until LLM signals end_turn
   * ```
   */
  async executeAllSteps(
    agentDef: AgentDefinition,
    context: AgentExecutionContext
  ): Promise<LLMStepResult> {
    this.log('Executing STEP_ALL mode')

    // Build system prompt with step prompt
    const systemPrompt = this.buildSystemPrompt(agentDef, true)

    let iterations = 0
    const maxIterations = Math.min(
      context.stepsRemaining,
      this.config.maxStepAllIterations
    )

    // Execute until completion or limit
    while (iterations < maxIterations) {
      // Invoke Claude
      const response = await this.invokeClaude({
        systemPrompt,
        messages: context.messageHistory,
        tools: agentDef.toolNames ?? [],
      })

      // Add response to history
      context.messageHistory.push({
        role: 'assistant',
        content: response,
      })

      // Check for end_turn or no tool calls
      if (this.isEndTurn(response)) {
        this.log(`STEP_ALL completed after ${iterations + 1} iterations`)
        break
      }

      iterations++
      context.stepsRemaining--
    }

    if (iterations >= maxIterations) {
      this.log(`STEP_ALL reached max iterations: ${maxIterations}`)
    }

    return {
      endTurn: true,
      agentState: this.contextToAgentState(context),
    }
  }

  /**
   * Execute an LLM step (dispatches to single or all based on mode)
   *
   * This is a convenience method that routes to the appropriate execution
   * method based on the mode parameter.
   *
   * @param agentDef - Agent definition
   * @param context - Execution context
   * @param mode - Execution mode (STEP or STEP_ALL)
   * @returns Step result
   */
  async executeStep(
    agentDef: AgentDefinition,
    context: AgentExecutionContext,
    mode: 'STEP' | 'STEP_ALL'
  ): Promise<LLMStepResult> {
    if (mode === 'STEP_ALL') {
      return await this.executeAllSteps(agentDef, context)
    } else {
      return await this.executeSingleStep(agentDef, context)
    }
  }

  // ============================================================================
  // Prompt Building
  // ============================================================================

  /**
   * Build system prompt for agent
   *
   * Combines the agent's system prompt, instructions prompt, and optionally
   * the step prompt (for handleSteps execution) into a single system prompt.
   *
   * @param agentDef - Agent definition
   * @param includeStepPrompt - Whether to include step prompt
   * @returns Combined system prompt
   *
   * @example
   * ```typescript
   * const prompt = executor.buildSystemPrompt(agentDef, true)
   * ```
   */
  buildSystemPrompt(
    agentDef: AgentDefinition,
    includeStepPrompt: boolean = false
  ): string {
    const parts: string[] = []

    if (agentDef.systemPrompt) {
      parts.push(agentDef.systemPrompt)
    }

    if (agentDef.instructionsPrompt) {
      parts.push(agentDef.instructionsPrompt)
    }

    if (includeStepPrompt && agentDef.stepPrompt) {
      parts.push(agentDef.stepPrompt)
    }

    return parts.filter(Boolean).join('\n\n')
  }

  // ============================================================================
  // Output Extraction
  // ============================================================================

  /**
   * Extract output from agent execution based on outputMode
   *
   * Different output modes:
   * - last_message: Returns the last assistant message
   * - all_messages: Returns the entire message history
   * - structured_output: Attempts to parse JSON from response
   *
   * @param agentDef - Agent definition (contains outputMode)
   * @param context - Execution context
   * @param lastResponse - Last response from Claude
   * @returns Extracted output
   *
   * @example
   * ```typescript
   * const output = executor.extractOutput(agentDef, context, response)
   * ```
   */
  extractOutput(
    agentDef: AgentDefinition,
    context: AgentExecutionContext,
    lastResponse: string
  ): any {
    const outputMode = agentDef.outputMode ?? 'last_message'

    switch (outputMode) {
      case 'last_message':
        return { type: 'lastMessage', value: lastResponse }

      case 'all_messages':
        return { type: 'allMessages', value: context.messageHistory }

      case 'structured_output':
        // Try to parse JSON from response
        try {
          const jsonMatch = lastResponse.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0])
          }
        } catch {
          // Fall through to return raw response
        }
        return { type: 'structuredOutput', value: lastResponse }

      default:
        return { type: 'lastMessage', value: lastResponse }
    }
  }

  // ============================================================================
  // Claude Integration (Placeholder)
  // ============================================================================

  /**
   * Invoke Claude
   *
   * HYBRID MODE:
   * - If API key is provided (PAID mode): Uses Anthropic API integration
   * - If no API key (FREE mode): Throws error (LLM invocation requires API key)
   *
   * For FREE mode, users should use Claude Code CLI directly without this adapter,
   * or provide an API key to enable full multi-agent support.
   *
   * @param params - Invocation parameters
   * @returns Promise resolving to Claude's response
   * @throws Error if no API key is configured
   *
   * @example
   * ```typescript
   * const response = await executor.invokeClaude({
   *   systemPrompt: 'You are a helpful assistant',
   *   messages: [{ role: 'user', content: 'Hello' }],
   *   tools: ['read_files', 'write_file']
   * })
   * ```
   */
  async invokeClaude(params: ClaudeInvocationParams): Promise<string> {
    // Check if API key is available
    if (!this.anthropicIntegration || !this.toolExecutor) {
      throw new Error(
        'LLM invocation requires Anthropic API key and tool executor. ' +
        'Set anthropicApiKey in config to enable multi-agent features. ' +
        'See HYBRID_MODE_GUIDE.md for details.'
      )
    }

    this.log('Invoking Claude via Anthropic API', {
      systemPromptLength: params.systemPrompt.length,
      messageCount: params.messages.length,
      toolCount: params.tools.length,
    })

    // Use the Anthropic API integration
    return await this.anthropicIntegration.invoke(params, this.toolExecutor)
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Check if response indicates end of turn
   *
   * Analyzes the response to determine if the LLM has finished its turn
   * (no more tool calls to execute).
   *
   * TODO: Implement proper parsing based on Claude CLI's actual response format
   *
   * @param response - Response from Claude
   * @returns True if this is the end of the turn
   */
  private isEndTurn(response: string): boolean {
    // Simple heuristic - check if response contains tool calls
    // TODO: Implement proper parsing based on Claude CLI's actual response format
    return (
      !response.includes('tool_call') &&
      !response.includes('<tool_use>') &&
      (response.includes('end_turn') || response.includes('DONE'))
    )
  }

  /**
   * Convert execution context to agent state
   *
   * @param context - Execution context
   * @returns Agent state
   */
  private contextToAgentState(context: AgentExecutionContext): AgentState {
    return {
      agentId: context.agentId,
      runId: this.generateId(),
      parentId: context.parentId,
      messageHistory: context.messageHistory,
      output: context.output as Record<string, any> | undefined,
    }
  }

  /**
   * Generate a unique ID
   *
   * @returns Unique ID string
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * Log a message
   *
   * @param message - Log message
   * @param data - Optional data to include
   */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      const prefix = '[LLMExecutor]'
      if (data !== undefined) {
        this.config.logger(`${prefix} ${message}: ${JSON.stringify(data)}`)
      } else {
        this.config.logger(`${prefix} ${message}`)
      }
    }
  }

  /**
   * Default logger implementation
   */
  private defaultLogger = (message: string): void => {
    console.log(message)
  }

  /**
   * Get configuration
   *
   * @returns Current configuration
   */
  getConfig(): Readonly<LLMExecutorConfig> {
    return {
      ...this.config,
      anthropicApiKey: this.anthropicApiKey,
      toolExecutor: this.toolExecutor,
    }
  }
}
