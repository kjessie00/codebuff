/**
 * Claude Code CLI Adapter - Main Orchestration Class
 *
 * This adapter bridges Codebuff's AgentDefinition system with Claude Code CLI tools.
 * It provides a unified execution environment for agents, handling:
 * - Agent execution lifecycle (handleSteps generators or pure LLM mode)
 * - Tool dispatch and execution
 * - Sub-agent spawning and management
 * - State and context management
 * - Error handling and recovery
 *
 * @module claude-cli-adapter
 */

import type {
  AgentDefinition,
  AgentState,
  AgentStepContext,
  ToolCall,
} from '../../.agents/types/agent-definition'

import type { ToolResultOutput, Message } from '../../.agents/types/util-types'

import { HandleStepsExecutor } from './handle-steps-executor'
import { FileOperationsTools } from './tools/file-operations'
import { CodeSearchTools } from './tools/code-search'
import { TerminalTools } from './tools/terminal'
import { SpawnAgentsAdapter } from './tools/spawn-agents'

import type {
  AdapterConfig,
  AgentExecutionContext,
  ReadFilesParams,
  WriteFileParams,
  StrReplaceParams,
  CodeSearchInput,
  FindFilesInput,
  RunTerminalCommandInput,
  SpawnAgentsParams,
  SetOutputParams,
  RetryConfig,
  TimeoutConfig,
} from './types'

import {
  AdapterError,
  ToolExecutionError,
  LLMExecutionError,
  ValidationError,
  AgentNotFoundError,
  formatError,
  isAdapterError,
} from './errors'

import { withTimeout } from './utils/async-utils'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Result from executing an agent
 */
export interface AgentExecutionResult {
  /** The output value from the agent */
  output: unknown
  /** Complete message history from the agent execution */
  messageHistory: Message[]
  /** Final agent state */
  agentState?: AgentState
  /** Execution metadata */
  metadata?: {
    iterationCount?: number
    completedNormally?: boolean
    executionTime?: number
  }
}

/**
 * Parameters for Claude invocation (placeholder)
 */
interface ClaudeInvocationParams {
  systemPrompt: string
  messages: Message[]
  tools: string[]
}

// ============================================================================
// Main Adapter Class
// ============================================================================

/**
 * ClaudeCodeCLIAdapter - Orchestrates agent execution with Claude Code CLI
 *
 * This is the main entry point for executing Codebuff agents within Claude Code CLI.
 * It manages the complete execution lifecycle:
 *
 * 1. Agent Registration: Register agent definitions
 * 2. Context Management: Track execution state across nested agents
 * 3. Tool Execution: Dispatch tool calls to appropriate implementations
 * 4. LLM Integration: Interface with Claude Code CLI (placeholder)
 * 5. Error Handling: Graceful error recovery and reporting
 *
 * @example
 * ```typescript
 * const adapter = new ClaudeCodeCLIAdapter({
 *   cwd: '/path/to/project',
 *   maxSteps: 20,
 *   debug: true
 * })
 *
 * // Register agents
 * adapter.registerAgent(filePickerAgent)
 * adapter.registerAgent(codeReviewerAgent)
 *
 * // Execute an agent
 * const result = await adapter.executeAgent(
 *   filePickerAgent,
 *   'Find all TypeScript test files',
 *   { pattern: '*.test.ts' }
 * )
 *
 * console.log('Output:', result.output)
 * ```
 */
export class ClaudeCodeCLIAdapter {
  // Configuration
  private readonly config: Required<AdapterConfig>

  // Execution contexts (tracked by agent ID)
  private readonly contexts: Map<string, AgentExecutionContext> = new Map()

  // Agent registry (agent ID -> definition)
  private readonly agentRegistry: Map<string, AgentDefinition> = new Map()

  // Tool implementations
  private readonly fileOps: FileOperationsTools
  private readonly codeSearch: CodeSearchTools
  private readonly terminal: TerminalTools
  private readonly spawnAgents: SpawnAgentsAdapter

  // HandleSteps executor
  private readonly handleStepsExecutor: HandleStepsExecutor

  /**
   * Create a new ClaudeCodeCLIAdapter
   *
   * @param config - Adapter configuration
   */
  constructor(config: AdapterConfig) {
    // Apply default configuration
    this.config = {
      cwd: config.cwd,
      env: config.env ?? {},
      maxSteps: config.maxSteps ?? 20,
      debug: config.debug ?? false,
      logger: config.logger ?? this.defaultLogger,
      retry: config.retry ?? {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        exponentialBackoff: true,
      },
      timeouts: config.timeouts ?? {
        toolExecutionTimeoutMs: 30000,
        llmInvocationTimeoutMs: 60000,
        terminalCommandTimeoutMs: 30000,
      },
    }

    // Initialize tool implementations
    this.fileOps = new FileOperationsTools(this.config.cwd)
    this.codeSearch = new CodeSearchTools(this.config.cwd)
    this.terminal = new TerminalTools(this.config.cwd, this.config.env)

    // Initialize spawn agents adapter with bound executor
    this.spawnAgents = new SpawnAgentsAdapter(
      this.agentRegistry,
      this.executeAgent.bind(this)
    )

    // Initialize handleSteps executor
    this.handleStepsExecutor = new HandleStepsExecutor({
      maxIterations: this.config.maxSteps * 2, // Allow more iterations than steps
      debug: this.config.debug,
      logger: this.log.bind(this),
    })

    this.log('ClaudeCodeCLIAdapter initialized', {
      cwd: this.config.cwd,
      maxSteps: this.config.maxSteps,
    })
  }

  // ============================================================================
  // Agent Registration
  // ============================================================================

  /**
   * Register an agent definition
   *
   * Makes the agent available for spawning and execution.
   * Agents can be registered with multiple identifiers:
   * - Simple ID: 'file-picker'
   * - Versioned ID: 'file-picker@0.0.1'
   * - Fully qualified: 'codebuff/file-picker@0.0.1'
   *
   * @param agentDef - Agent definition to register
   *
   * @example
   * ```typescript
   * adapter.registerAgent(filePickerAgent)
   * adapter.registerAgent(codeReviewerAgent)
   * ```
   */
  registerAgent(agentDef: AgentDefinition): void {
    this.agentRegistry.set(agentDef.id, agentDef)
    this.log(`Registered agent: ${agentDef.id} (${agentDef.displayName})`)
  }

  /**
   * Register multiple agents at once
   *
   * @param agents - Array of agent definitions
   */
  registerAgents(agents: AgentDefinition[]): void {
    for (const agent of agents) {
      this.registerAgent(agent)
    }
  }

  /**
   * Get a registered agent by ID
   *
   * @param agentId - Agent identifier
   * @returns Agent definition or undefined if not found
   */
  getAgent(agentId: string): AgentDefinition | undefined {
    return this.spawnAgents.getAgentInfo(agentId)
  }

  /**
   * List all registered agents
   *
   * @returns Array of all registered agent IDs
   */
  listAgents(): string[] {
    return this.spawnAgents.listRegisteredAgents()
  }

  // ============================================================================
  // Agent Execution - Main Entry Point
  // ============================================================================

  /**
   * Execute an agent with the given prompt and parameters
   *
   * This is the main entry point for agent execution. It handles:
   * 1. Creating execution context
   * 2. Determining execution mode (handleSteps vs pure LLM)
   * 3. Managing state and cleanup
   * 4. Returning results
   *
   * @param agentDef - Agent definition to execute
   * @param prompt - User prompt for the agent (optional for some agents)
   * @param params - Optional parameters for the agent
   * @param parentContext - Optional parent execution context for nested agents
   * @returns Promise resolving to execution result
   * @throws {MaxIterationsError} If execution exceeds maxSteps configuration
   * @throws {Error} If agent execution fails or tool execution errors
   *
   * @example
   * ```typescript
   * const result = await adapter.executeAgent(
   *   filePickerAgent,
   *   'Find all test files',
   *   { pattern: '*.test.ts' }
   * )
   * ```
   */
  async executeAgent(
    agentDef: AgentDefinition,
    prompt: string | undefined,
    params?: Record<string, unknown>,
    parentContext?: AgentExecutionContext
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now()

    // Create execution context
    const context = this.createExecutionContext(prompt, parentContext)

    this.log(`Starting agent execution: ${agentDef.id}`, {
      agentId: context.agentId,
      parentId: context.parentId,
      prompt: prompt ? prompt.substring(0, 100) : '(no prompt)',
    })

    try {
      // Store context
      this.contexts.set(context.agentId, context)

      let result: AgentExecutionResult

      // Determine execution mode
      if (agentDef.handleSteps) {
        // Programmatic execution with handleSteps generator
        result = await this.executeWithHandleSteps(
          agentDef,
          prompt,
          params,
          context
        )
      } else {
        // Pure LLM mode execution
        result = await this.executePureLLM(agentDef, prompt, context)
      }

      // Calculate execution time
      const executionTime = Date.now() - startTime

      this.log(`Agent execution completed: ${agentDef.id}`, {
        agentId: context.agentId,
        executionTime,
      })

      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTime,
        },
      }
    } finally {
      // Cleanup context
      this.contexts.delete(context.agentId)
    }
  }

  // ============================================================================
  // Execution Modes
  // ============================================================================

  /**
   * Execute agent with handleSteps generator (programmatic mode)
   *
   * This mode gives the agent definition full control over execution flow.
   * The handleSteps generator can:
   * - Call tools directly
   * - Execute LLM steps (STEP or STEP_ALL)
   * - Control when to end execution
   *
   * @param agentDef - Agent definition with handleSteps
   * @param prompt - User prompt (optional)
   * @param params - Optional parameters
   * @param context - Execution context
   * @returns Promise resolving to execution result
   */
  private async executeWithHandleSteps(
    agentDef: AgentDefinition,
    prompt: string | undefined,
    params: Record<string, unknown> | undefined,
    context: AgentExecutionContext
  ): Promise<AgentExecutionResult> {
    this.log('Executing with handleSteps generator')

    // Create agent state
    const agentState: AgentState = {
      agentId: context.agentId,
      runId: this.generateId(),
      parentId: context.parentId,
      messageHistory: context.messageHistory,
      output: context.output as Record<string, any> | undefined,
    }

    // Create step context
    const stepContext: AgentStepContext = {
      agentState,
      prompt,
      params,
      logger: this.createLogger(),
    }

    // Execute using HandleStepsExecutor
    const executionResult = await this.handleStepsExecutor.execute(
      agentDef,
      stepContext,
      this.executeToolCall.bind(this, context),
      this.executeLLMStep.bind(this, agentDef, context)
    )

    // Update context with final state
    context.messageHistory = executionResult.agentState.messageHistory
    context.output = executionResult.agentState.output

    return {
      output: executionResult.agentState.output,
      messageHistory: executionResult.agentState.messageHistory,
      agentState: executionResult.agentState,
      metadata: {
        iterationCount: executionResult.iterationCount,
        completedNormally: executionResult.completedNormally,
      },
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
   * @returns Promise resolving to execution result
   */
  private async executePureLLM(
    agentDef: AgentDefinition,
    prompt: string | undefined,
    context: AgentExecutionContext
  ): Promise<AgentExecutionResult> {
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
    const output = this.extractOutput(agentDef, context, response)

    return {
      output,
      messageHistory: context.messageHistory,
    }
  }

  /**
   * Execute a single LLM step
   *
   * Called by handleSteps executor when it encounters 'STEP' or 'STEP_ALL'.
   *
   * @param agentDef - Agent definition
   * @param context - Execution context
   * @param mode - Execution mode (STEP or STEP_ALL)
   * @returns Promise resolving to step result
   */
  private async executeLLMStep(
    agentDef: AgentDefinition,
    context: AgentExecutionContext,
    mode: 'STEP' | 'STEP_ALL'
  ): Promise<{ endTurn: boolean; agentState: AgentState }> {
    this.log(`Executing LLM step: ${mode}`)

    // Build system prompt with step prompt
    const systemPrompt = this.buildSystemPrompt(agentDef, true)

    if (mode === 'STEP_ALL') {
      // Execute until completion (end_turn or no tool calls)
      let endTurn = false

      while (context.stepsRemaining > 0) {
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
          endTurn = true
          break
        }

        context.stepsRemaining--
      }

      return {
        endTurn: true,
        agentState: this.contextToAgentState(context),
      }
    } else {
      // Execute single step
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

      context.stepsRemaining--

      // Check if this is end turn (no tool calls)
      const endTurn = this.isEndTurn(response)

      return {
        endTurn,
        agentState: this.contextToAgentState(context),
      }
    }
  }

  // ============================================================================
  // Tool Execution - Dispatcher
  // ============================================================================

  /**
   * Execute a tool call
   *
   * Dispatches to the appropriate tool implementation based on toolName.
   * This is the central dispatcher for all tool executions.
   *
   * @param context - Execution context
   * @param toolCall - Tool call to execute
   * @returns Promise resolving to tool result
   * @throws {Error} If tool name is unknown or tool execution fails
   */
  private async executeToolCall(
    context: AgentExecutionContext,
    toolCall: ToolCall
  ): Promise<ToolResultOutput[]> {
    const { toolName, input } = toolCall

    this.log(`Executing tool: ${toolName}`, { input })

    try {
      switch (toolName) {
        // File operations
        case 'read_files':
          return await this.toolReadFiles(input)

        case 'write_file':
          return await this.toolWriteFile(input)

        case 'str_replace':
          return await this.toolStrReplace(input)

        // Code search
        case 'code_search':
          return await this.toolCodeSearch(input)

        case 'find_files':
          return await this.toolFindFiles(input)

        // Terminal
        case 'run_terminal_command':
          return await this.toolRunTerminal(input)

        // Agent management
        case 'spawn_agents':
          return await this.toolSpawnAgents(input, context)

        // Output control
        case 'set_output':
          return await this.toolSetOutput(input, context)

        default:
          throw new Error(`Unknown tool: ${toolName}`)
      }
    } catch (error) {
      this.log(`Tool execution failed: ${toolName}`, { error })
      throw error
    }
  }

  // ============================================================================
  // Tool Implementations
  // ============================================================================

  /**
   * read_files tool - Read multiple files from disk
   */
  private async toolReadFiles(input: unknown): Promise<ToolResultOutput[]> {
    return await this.fileOps.readFiles(input as ReadFilesParams)
  }

  /**
   * write_file tool - Write content to a file
   */
  private async toolWriteFile(input: unknown): Promise<ToolResultOutput[]> {
    return await this.fileOps.writeFile(input as WriteFileParams)
  }

  /**
   * str_replace tool - Replace string in a file
   */
  private async toolStrReplace(input: unknown): Promise<ToolResultOutput[]> {
    return await this.fileOps.strReplace(input as StrReplaceParams)
  }

  /**
   * code_search tool - Search codebase with ripgrep
   */
  private async toolCodeSearch(input: unknown): Promise<ToolResultOutput[]> {
    return await this.codeSearch.codeSearch(input as CodeSearchInput)
  }

  /**
   * find_files tool - Find files matching glob pattern
   */
  private async toolFindFiles(input: unknown): Promise<ToolResultOutput[]> {
    return await this.codeSearch.findFiles(input as FindFilesInput)
  }

  /**
   * run_terminal_command tool - Execute shell command
   */
  private async toolRunTerminal(input: unknown): Promise<ToolResultOutput[]> {
    return await this.terminal.runTerminalCommand(input as RunTerminalCommandInput)
  }

  /**
   * spawn_agents tool - Spawn and execute sub-agents
   */
  private async toolSpawnAgents(
    input: unknown,
    context: AgentExecutionContext
  ): Promise<ToolResultOutput[]> {
    return await this.spawnAgents.spawnAgents(input as SpawnAgentsParams, context)
  }

  /**
   * set_output tool - Set agent output value
   */
  private async toolSetOutput(
    input: unknown,
    context: AgentExecutionContext
  ): Promise<ToolResultOutput[]> {
    // Extract output from input (handle both agent and adapter formats)
    const outputValue = (input as { output?: unknown })?.output ?? input

    // Update context output
    context.output = outputValue as Record<string, any> | undefined

    return [
      {
        type: 'json',
        value: {
          success: true,
          output: outputValue as any,
        } as any,
      },
    ]
  }

  // ============================================================================
  // Claude Integration (Placeholder)
  // ============================================================================

  /**
   * Invoke Claude Code CLI
   *
   * PLACEHOLDER: This needs to be implemented to integrate with actual Claude Code CLI.
   *
   * Possible approaches:
   * 1. Use Claude Code CLI internal API (if available)
   * 2. File-based communication (input/output files)
   * 3. stdin/stdout pipe
   * 4. HTTP API (if Claude CLI exposes one)
   *
   * @param params - Invocation parameters
   * @returns Promise resolving to Claude's response
   */
  private async invokeClaude(
    params: ClaudeInvocationParams
  ): Promise<string> {
    // TODO: Implement actual Claude Code CLI integration

    this.log('Invoking Claude (PLACEHOLDER)', {
      systemPromptLength: params.systemPrompt.length,
      messageCount: params.messages.length,
      toolCount: params.tools.length,
    })

    // Placeholder response
    return `[Claude Response Placeholder]\nReceived ${params.messages.length} messages with ${params.tools.length} available tools.`
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Create a new execution context
   */
  private createExecutionContext(
    prompt: string | undefined,
    parentContext?: AgentExecutionContext
  ): AgentExecutionContext {
    return {
      agentId: this.generateId(),
      parentId: parentContext?.agentId,
      messageHistory: parentContext?.messageHistory ?? [],
      stepsRemaining: this.config.maxSteps,
      output: undefined,
    }
  }

  /**
   * Convert execution context to agent state
   */
  private contextToAgentState(
    context: AgentExecutionContext
  ): AgentState {
    return {
      agentId: context.agentId,
      runId: this.generateId(),
      parentId: context.parentId,
      messageHistory: context.messageHistory,
      output: context.output as Record<string, any> | undefined,
    }
  }

  /**
   * Build system prompt for agent
   */
  private buildSystemPrompt(
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

  /**
   * Extract output from agent execution based on outputMode
   */
  private extractOutput(
    agentDef: AgentDefinition,
    context: AgentExecutionContext,
    lastResponse: string
  ): unknown {
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

  /**
   * Check if response indicates end of turn
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
   * Create a logger for agent execution
   */
  private createLogger() {
    return {
      debug: (data: any, msg?: string) =>
        this.config.debug && this.log(msg || 'debug', data),
      info: (data: any, msg?: string) => this.log(msg || 'info', data),
      warn: (data: any, msg?: string) => this.log(msg || 'warn', data),
      error: (data: any, msg?: string) => this.log(msg || 'error', data),
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Log a message
   */
  private log(message: string, data?: any): void {
    if (this.config.debug || message.includes('error') || message.includes('warn')) {
      const prefix = '[ClaudeCodeCLIAdapter]'
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

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get current working directory
   */
  getCwd(): string {
    return this.config.cwd
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<Required<AdapterConfig>> {
    return { ...this.config }
  }

  /**
   * Get active execution contexts (for debugging)
   */
  getActiveContexts(): Map<string, AgentExecutionContext> {
    return new Map(this.contexts)
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new ClaudeCodeCLIAdapter with default configuration
 *
 * @param cwd - Working directory
 * @param options - Optional configuration overrides
 * @returns ClaudeCodeCLIAdapter instance
 *
 * @example
 * ```typescript
 * const adapter = createAdapter('/path/to/project', {
 *   debug: true,
 *   maxSteps: 30
 * })
 * ```
 */
export function createAdapter(
  cwd: string,
  options?: Partial<Omit<AdapterConfig, 'cwd'>>
): ClaudeCodeCLIAdapter {
  return new ClaudeCodeCLIAdapter({
    cwd,
    ...options,
  })
}

/**
 * Create a ClaudeCodeCLIAdapter with debug logging enabled
 *
 * @param cwd - Working directory
 * @param options - Optional configuration overrides
 * @returns ClaudeCodeCLIAdapter instance with debug logging
 *
 * @example
 * ```typescript
 * const adapter = createDebugAdapter('/path/to/project')
 * ```
 */
export function createDebugAdapter(
  cwd: string,
  options?: Partial<Omit<AdapterConfig, 'cwd' | 'debug'>>
): ClaudeCodeCLIAdapter {
  return new ClaudeCodeCLIAdapter({
    cwd,
    debug: true,
    ...options,
  })
}
