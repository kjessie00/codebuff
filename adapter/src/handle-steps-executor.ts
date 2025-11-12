/**
 * HandleStepsExecutor - Generator-based Agent Execution Engine
 *
 * This module implements the core execution engine for Codebuff agent handleSteps generators.
 * It orchestrates the execution flow between programmatic tool calls and LLM-driven steps.
 *
 * @module adapter/handle-steps-executor
 */

import type {
  AgentDefinition,
  AgentStepContext,
  AgentState,
  ToolCall,
  StepText,
} from '../../common/src/templates/initial-agents-dir/types/agent-definition'

import type { ToolResultOutput } from '../../common/src/templates/initial-agents-dir/types/util-types'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Tool executor function signature
 * Executes a tool call and returns the results
 */
export type ToolExecutor = (toolCall: ToolCall) => Promise<ToolResultOutput[]>

/**
 * LLM executor function signature
 * Executes one or more LLM steps and returns completion status
 *
 * @param mode - 'STEP' for single turn, 'STEP_ALL' for complete conversation
 * @returns Object with endTurn flag and updated agent state
 */
export type LLMExecutor = (mode: 'STEP' | 'STEP_ALL') => Promise<{
  endTurn: boolean
  agentState: AgentState
}>

/**
 * Text output handler function signature
 * Handles text output from STEP_TEXT yields
 */
export type TextOutputHandler = (text: string) => void

/**
 * Configuration for the HandleStepsExecutor
 */
export interface HandleStepsExecutorConfig {
  /**
   * Maximum number of iterations before throwing an error
   * Prevents infinite loops in poorly written generators
   * @default 100
   */
  maxIterations?: number

  /**
   * Whether to enable debug logging
   * @default false
   */
  debug?: boolean

  /**
   * Custom logger function for debug output
   */
  logger?: (message: string, data?: any) => void
}

/**
 * Result of executing the handleSteps generator
 */
export interface ExecutionResult {
  /**
   * Final agent state after execution
   */
  agentState: AgentState

  /**
   * Total number of iterations executed
   */
  iterationCount: number

  /**
   * Whether the execution completed normally (true) or hit max iterations (false)
   */
  completedNormally: boolean

  /**
   * Any error that occurred during execution
   */
  error?: Error
}

/**
 * Error thrown when execution exceeds maximum iterations
 */
export class MaxIterationsError extends Error {
  constructor(maxIterations: number) {
    super(
      `HandleSteps execution exceeded maximum iterations (${maxIterations}). ` +
        'Possible infinite loop detected. Check your generator logic.'
    )
    this.name = 'MaxIterationsError'
  }
}

/**
 * Error thrown when an unknown yield value is encountered
 */
export class UnknownYieldValueError extends Error {
  constructor(value: unknown) {
    super(
      `Unknown handleSteps yield value: ${JSON.stringify(value, null, 2)}. ` +
        'Valid yields are: ToolCall objects, "STEP", "STEP_ALL", or StepText objects.'
    )
    this.name = 'UnknownYieldValueError'
  }
}

// ============================================================================
// HandleStepsExecutor Class
// ============================================================================

/**
 * Executes the handleSteps generator function from an AgentDefinition.
 *
 * This class manages the complete lifecycle of a generator-based agent execution:
 * - Iterating through the generator
 * - Dispatching tool calls to the tool executor
 * - Dispatching LLM steps to the LLM executor
 * - Managing state transitions
 * - Handling text output
 * - Protecting against infinite loops
 *
 * @example
 * ```typescript
 * const executor = new HandleStepsExecutor({
 *   maxIterations: 100,
 *   debug: true
 * })
 *
 * const result = await executor.execute(
 *   agentDef,
 *   context,
 *   toolExecutor,
 *   llmExecutor,
 *   textOutputHandler
 * )
 *
 * console.log('Execution completed in', result.iterationCount, 'iterations')
 * ```
 */
export class HandleStepsExecutor {
  private readonly maxIterations: number
  private readonly debug: boolean
  private readonly logger: (message: string, data?: any) => void

  /**
   * Creates a new HandleStepsExecutor
   *
   * @param config - Configuration options
   */
  constructor(config: HandleStepsExecutorConfig = {}) {
    this.maxIterations = config.maxIterations ?? 100
    this.debug = config.debug ?? false
    this.logger = config.logger ?? this.defaultLogger
  }

  /**
   * Default logger that outputs to console when debug is enabled
   */
  private defaultLogger = (message: string, data?: any): void => {
    if (this.debug) {
      if (data !== undefined) {
        console.log(`[HandleStepsExecutor] ${message}`, data)
      } else {
        console.log(`[HandleStepsExecutor] ${message}`)
      }
    }
  }

  /**
   * Execute the handleSteps generator to completion
   *
   * This is the main entry point for executing an agent's handleSteps generator.
   * It manages the entire execution lifecycle:
   *
   * 1. Validates the agent definition has a handleSteps function
   * 2. Initializes the generator with the starting context
   * 3. Iterates through each yield:
   *    - ToolCall: Executes the tool and captures results
   *    - 'STEP': Executes a single LLM turn
   *    - 'STEP_ALL': Executes LLM until completion
   *    - StepText: Outputs text to the conversation
   * 4. Passes updated state back to the generator
   * 5. Terminates on generator completion or max iterations
   *
   * @param agentDef - The agent definition containing the handleSteps generator
   * @param context - Initial execution context with agent state and parameters
   * @param toolExecutor - Function to execute tool calls
   * @param llmExecutor - Function to execute LLM steps
   * @param textOutputHandler - Optional function to handle text output from STEP_TEXT
   * @returns Execution result with final state and metadata
   * @throws {Error} If agentDef has no handleSteps defined
   * @throws {MaxIterationsError} If execution exceeds maxIterations
   * @throws {UnknownYieldValueError} If an unrecognized yield value is encountered
   */
  async execute(
    agentDef: AgentDefinition,
    context: AgentStepContext,
    toolExecutor: ToolExecutor,
    llmExecutor: LLMExecutor,
    textOutputHandler?: TextOutputHandler
  ): Promise<ExecutionResult> {
    // Validate agent definition
    if (!agentDef.handleSteps) {
      throw new Error(
        `Agent "${agentDef.id}" does not have a handleSteps function defined. ` +
          'Cannot execute programmatic agent logic.'
      )
    }

    this.logger('Starting handleSteps execution', {
      agentId: agentDef.id,
      agentName: agentDef.displayName,
      maxIterations: this.maxIterations,
    })

    // Initialize execution state
    let iterationCount = 0
    let completedNormally = false
    let executionError: Error | undefined

    try {
      // Start the generator
      const generator = agentDef.handleSteps(context)
      this.logger('Generator initialized')

      // Execution loop state
      let lastToolResult: ToolResultOutput[] | undefined = undefined
      let stepsComplete = false
      let currentAgentState = context.agentState

      // Main execution loop
      while (iterationCount < this.maxIterations) {
        iterationCount++
        this.logger(`Iteration ${iterationCount}`)

        // Get next value from generator
        const { value, done } = generator.next({
          agentState: currentAgentState,
          toolResult: lastToolResult,
          stepsComplete,
        })

        // Check if generator is complete
        if (done) {
          this.logger('Generator completed normally')
          completedNormally = true
          break
        }

        // Process the yielded value
        try {
          const processResult = await this.processYieldedValue(
            value,
            currentAgentState,
            toolExecutor,
            llmExecutor,
            textOutputHandler
          )

          // Update state for next iteration
          lastToolResult = processResult.toolResult
          stepsComplete = processResult.stepsComplete
          currentAgentState = processResult.agentState

          // If steps are complete, break the loop
          if (stepsComplete && processResult.shouldTerminate) {
            this.logger('Steps completed, terminating execution')
            completedNormally = true
            break
          }
        } catch (error) {
          this.logger('Error processing yielded value', { error })
          executionError = error instanceof Error ? error : new Error(String(error))
          break
        }
      }

      // Check if we exceeded max iterations
      if (iterationCount >= this.maxIterations && !completedNormally) {
        throw new MaxIterationsError(this.maxIterations)
      }

      this.logger('Execution finished', {
        iterationCount,
        completedNormally,
        hasError: !!executionError,
      })

      return {
        agentState: currentAgentState,
        iterationCount,
        completedNormally,
        error: executionError,
      }
    } catch (error) {
      this.logger('Execution failed with error', { error })

      return {
        agentState: context.agentState,
        iterationCount,
        completedNormally: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }

  /**
   * Process a single yielded value from the generator
   *
   * This method handles the different types of values that can be yielded:
   * - ToolCall objects: Execute the tool via toolExecutor
   * - 'STEP': Execute a single LLM turn via llmExecutor
   * - 'STEP_ALL': Execute LLM until completion via llmExecutor
   * - StepText: Output text via textOutputHandler
   *
   * @param value - The value yielded from the generator
   * @param currentAgentState - Current agent state
   * @param toolExecutor - Function to execute tools
   * @param llmExecutor - Function to execute LLM steps
   * @param textOutputHandler - Function to handle text output
   * @returns Updated state and flags for the next iteration
   */
  private async processYieldedValue(
    value: ToolCall | 'STEP' | 'STEP_ALL' | StepText,
    currentAgentState: AgentState,
    toolExecutor: ToolExecutor,
    llmExecutor: LLMExecutor,
    textOutputHandler?: TextOutputHandler
  ): Promise<{
    toolResult: ToolResultOutput[] | undefined
    stepsComplete: boolean
    agentState: AgentState
    shouldTerminate: boolean
  }> {
    // Handle ToolCall objects
    if (this.isToolCall(value)) {
      return await this.handleToolCall(value, currentAgentState, toolExecutor)
    }

    // Handle 'STEP' - single LLM turn
    if (value === 'STEP') {
      return await this.handleStep(currentAgentState, llmExecutor)
    }

    // Handle 'STEP_ALL' - LLM until completion
    if (value === 'STEP_ALL') {
      return await this.handleStepAll(currentAgentState, llmExecutor)
    }

    // Handle StepText - text output
    if (this.isStepText(value)) {
      return this.handleStepText(value, currentAgentState, textOutputHandler)
    }

    // Unknown yield value
    this.logger('Unknown yield value encountered', { value })
    throw new UnknownYieldValueError(value)
  }

  /**
   * Handle a tool call yield
   */
  private async handleToolCall(
    toolCall: ToolCall,
    currentAgentState: AgentState,
    toolExecutor: ToolExecutor
  ): Promise<{
    toolResult: ToolResultOutput[]
    stepsComplete: boolean
    agentState: AgentState
    shouldTerminate: boolean
  }> {
    this.logger('Executing tool call', {
      toolName: toolCall.toolName,
      input: toolCall.input,
    })

    try {
      const toolResult = await toolExecutor(toolCall)
      this.logger('Tool execution completed', {
        toolName: toolCall.toolName,
        resultCount: toolResult.length,
      })

      // Special handling for set_output tool
      let updatedAgentState = currentAgentState
      if (toolCall.toolName === 'set_output' && 'output' in toolCall.input) {
        updatedAgentState = {
          ...currentAgentState,
          output: toolCall.input.output as Record<string, any>,
        }
        this.logger('Agent output updated via set_output tool')
      }

      return {
        toolResult,
        stepsComplete: false,
        agentState: updatedAgentState,
        shouldTerminate: false,
      }
    } catch (error) {
      this.logger('Tool execution failed', {
        toolName: toolCall.toolName,
        error,
      })
      throw error
    }
  }

  /**
   * Handle a 'STEP' yield - execute single LLM turn
   */
  private async handleStep(
    currentAgentState: AgentState,
    llmExecutor: LLMExecutor
  ): Promise<{
    toolResult: undefined
    stepsComplete: boolean
    agentState: AgentState
    shouldTerminate: boolean
  }> {
    this.logger('Executing STEP (single LLM turn)')

    try {
      const result = await llmExecutor('STEP')
      this.logger('STEP execution completed', { endTurn: result.endTurn })

      return {
        toolResult: undefined,
        stepsComplete: result.endTurn,
        agentState: result.agentState,
        shouldTerminate: result.endTurn,
      }
    } catch (error) {
      this.logger('STEP execution failed', { error })
      throw error
    }
  }

  /**
   * Handle a 'STEP_ALL' yield - execute LLM until completion
   */
  private async handleStepAll(
    currentAgentState: AgentState,
    llmExecutor: LLMExecutor
  ): Promise<{
    toolResult: undefined
    stepsComplete: boolean
    agentState: AgentState
    shouldTerminate: boolean
  }> {
    this.logger('Executing STEP_ALL (LLM until completion)')

    try {
      const result = await llmExecutor('STEP_ALL')
      this.logger('STEP_ALL execution completed', { endTurn: result.endTurn })

      return {
        toolResult: undefined,
        stepsComplete: true,
        agentState: result.agentState,
        shouldTerminate: true,
      }
    } catch (error) {
      this.logger('STEP_ALL execution failed', { error })
      throw error
    }
  }

  /**
   * Handle a StepText yield - output text to conversation
   */
  private handleStepText(
    stepText: StepText,
    currentAgentState: AgentState,
    textOutputHandler?: TextOutputHandler
  ): {
    toolResult: undefined
    stepsComplete: boolean
    agentState: AgentState
    shouldTerminate: boolean
  } {
    this.logger('Handling STEP_TEXT', { text: stepText.text })

    // Call the text output handler if provided
    if (textOutputHandler) {
      textOutputHandler(stepText.text)
    }

    // Add to message history
    const updatedAgentState: AgentState = {
      ...currentAgentState,
      messageHistory: [
        ...currentAgentState.messageHistory,
        {
          role: 'assistant',
          content: stepText.text,
        },
      ],
    }

    return {
      toolResult: undefined,
      stepsComplete: false,
      agentState: updatedAgentState,
      shouldTerminate: false,
    }
  }

  /**
   * Type guard to check if a value is a ToolCall object
   */
  private isToolCall(value: unknown): value is ToolCall {
    return (
      typeof value === 'object' &&
      value !== null &&
      'toolName' in value &&
      'input' in value &&
      typeof (value as any).toolName === 'string'
    )
  }

  /**
   * Type guard to check if a value is a StepText object
   */
  private isStepText(value: unknown): value is StepText {
    return (
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      (value as any).type === 'STEP_TEXT' &&
      'text' in value &&
      typeof (value as any).text === 'string'
    )
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a HandleStepsExecutor with common production settings
 *
 * @param options - Optional configuration overrides
 * @returns A configured HandleStepsExecutor instance
 *
 * @example
 * ```typescript
 * const executor = createProductionExecutor({
 *   maxIterations: 50,
 *   debug: process.env.NODE_ENV !== 'production'
 * })
 * ```
 */
export function createProductionExecutor(
  options: Partial<HandleStepsExecutorConfig> = {}
): HandleStepsExecutor {
  return new HandleStepsExecutor({
    maxIterations: 100,
    debug: false,
    ...options,
  })
}

/**
 * Create a HandleStepsExecutor with debug logging enabled
 *
 * @param options - Optional configuration overrides
 * @returns A configured HandleStepsExecutor instance with debug logging
 *
 * @example
 * ```typescript
 * const executor = createDebugExecutor({
 *   logger: (msg, data) => myCustomLogger.debug(msg, data)
 * })
 * ```
 */
export function createDebugExecutor(
  options: Partial<HandleStepsExecutorConfig> = {}
): HandleStepsExecutor {
  return new HandleStepsExecutor({
    maxIterations: 100,
    debug: true,
    ...options,
  })
}
