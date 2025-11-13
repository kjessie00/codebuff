/**
 * Tool Dispatcher for Claude CLI Adapter
 *
 * Central dispatcher for all tool executions. Routes tool calls to the appropriate
 * implementation based on toolName and handles execution errors consistently.
 *
 * This class implements the Command pattern, providing a single entry point
 * for tool execution while delegating to specialized tool implementations.
 *
 * @module tool-dispatcher
 */

import type { ToolCall, ToolResultOutput } from '../../.agents/types/util-types'
import type { AgentExecutionContext } from './types'
import { FileOperationsTools } from './tools/file-operations'
import { CodeSearchTools } from './tools/code-search'
import { TerminalTools } from './tools/terminal'
import { SpawnAgentsAdapter } from './tools/spawn-agents'
import { formatError } from './utils/error-formatting'

/**
 * Configuration for ToolDispatcher
 */
export interface ToolDispatcherConfig {
  /** Current working directory */
  cwd: string

  /** Environment variables for terminal commands */
  env?: Record<string, string>

  /** Enable debug logging */
  debug?: boolean

  /** Logger function */
  logger?: (message: string) => void
}

/**
 * Tool Dispatcher
 *
 * Dispatches tool calls to appropriate implementations and handles execution.
 * Provides consistent error handling and logging for all tool operations.
 *
 * Supported tools:
 * - File Operations: read_files, write_file, str_replace
 * - Code Search: code_search, find_files
 * - Terminal: run_terminal_command
 * - Agent Management: spawn_agents
 * - Output Control: set_output
 *
 * @example
 * ```typescript
 * const dispatcher = new ToolDispatcher({
 *   cwd: '/path/to/project',
 *   debug: true
 * })
 *
 * const result = await dispatcher.dispatch(context, {
 *   toolName: 'read_files',
 *   input: { paths: ['README.md'] }
 * })
 * ```
 */
export class ToolDispatcher {
  private readonly config: Required<ToolDispatcherConfig>
  private readonly fileOps: FileOperationsTools
  private readonly codeSearch: CodeSearchTools
  private readonly terminal: TerminalTools
  private readonly spawnAgents: SpawnAgentsAdapter

  /**
   * Create a new ToolDispatcher
   *
   * @param config - Dispatcher configuration
   * @param spawnAgentsAdapter - Pre-configured spawn agents adapter
   */
  constructor(
    config: ToolDispatcherConfig,
    spawnAgentsAdapter: SpawnAgentsAdapter
  ) {
    this.config = {
      cwd: config.cwd,
      env: config.env ?? {},
      debug: config.debug ?? false,
      logger: config.logger ?? this.defaultLogger,
    }

    // Initialize tool implementations
    this.fileOps = new FileOperationsTools(this.config.cwd)
    this.codeSearch = new CodeSearchTools(this.config.cwd)
    this.terminal = new TerminalTools(this.config.cwd, this.config.env)
    this.spawnAgents = spawnAgentsAdapter
  }

  /**
   * Dispatch a tool call to the appropriate implementation
   *
   * Routes the tool call based on toolName and executes it with proper
   * error handling and logging.
   *
   * @param context - Current execution context
   * @param toolCall - Tool call to execute
   * @returns Promise resolving to tool result
   * @throws Error if tool is unknown or execution fails
   *
   * @example
   * ```typescript
   * const result = await dispatcher.dispatch(context, {
   *   toolName: 'write_file',
   *   input: { path: 'file.txt', content: 'Hello' }
   * })
   * ```
   */
  async dispatch(
    context: AgentExecutionContext,
    toolCall: ToolCall
  ): Promise<ToolResultOutput[]> {
    const { toolName, input } = toolCall

    this.log(`Executing tool: ${toolName}`, { input })

    try {
      // Route to appropriate tool implementation
      switch (toolName) {
        // File Operations
        case 'read_files':
          return await this.executeReadFiles(input)

        case 'write_file':
          return await this.executeWriteFile(input)

        case 'str_replace':
          return await this.executeStrReplace(input)

        // Code Search
        case 'code_search':
          return await this.executeCodeSearch(input)

        case 'find_files':
          return await this.executeFindFiles(input)

        // Terminal
        case 'run_terminal_command':
          return await this.executeRunTerminal(input)

        // Agent Management
        case 'spawn_agents':
          return await this.executeSpawnAgents(input, context)

        // Output Control
        case 'set_output':
          return await this.executeSetOutput(input, context)

        default:
          throw new Error(`Unknown tool: ${toolName}`)
      }
    } catch (error) {
      this.log(`Tool execution failed: ${toolName}`, { error: formatError(error) })
      throw error
    }
  }

  // ============================================================================
  // Tool Implementations
  // ============================================================================

  /**
   * Execute read_files tool
   *
   * Reads multiple files from disk and returns their contents.
   *
   * @param input - Tool input containing file paths
   * @returns Tool result with file contents
   */
  private async executeReadFiles(input: any): Promise<ToolResultOutput[]> {
    return await this.fileOps.readFiles(input)
  }

  /**
   * Execute write_file tool
   *
   * Writes content to a file, creating parent directories if needed.
   *
   * @param input - Tool input containing path and content
   * @returns Tool result with success status
   */
  private async executeWriteFile(input: any): Promise<ToolResultOutput[]> {
    return await this.fileOps.writeFile(input)
  }

  /**
   * Execute str_replace tool
   *
   * Replaces a string in a file with a new string.
   *
   * @param input - Tool input containing path and replacement strings
   * @returns Tool result with success status
   */
  private async executeStrReplace(input: any): Promise<ToolResultOutput[]> {
    return await this.fileOps.strReplace(input)
  }

  /**
   * Execute code_search tool
   *
   * Searches codebase using ripgrep with advanced filtering.
   *
   * @param input - Tool input containing search parameters
   * @returns Tool result with search results
   */
  private async executeCodeSearch(input: any): Promise<ToolResultOutput[]> {
    return await this.codeSearch.codeSearch(input)
  }

  /**
   * Execute find_files tool
   *
   * Finds files matching a glob pattern.
   *
   * @param input - Tool input containing glob pattern
   * @returns Tool result with matching file paths
   */
  private async executeFindFiles(input: any): Promise<ToolResultOutput[]> {
    return await this.codeSearch.findFiles(input)
  }

  /**
   * Execute run_terminal_command tool
   *
   * Executes a shell command and captures output.
   *
   * @param input - Tool input containing command and options
   * @returns Tool result with command output
   */
  private async executeRunTerminal(input: any): Promise<ToolResultOutput[]> {
    return await this.terminal.runTerminalCommand(input)
  }

  /**
   * Execute spawn_agents tool
   *
   * Spawns and executes sub-agents.
   *
   * @param input - Tool input containing agent specifications
   * @param context - Current execution context
   * @returns Tool result with agent outputs
   */
  private async executeSpawnAgents(
    input: any,
    context: AgentExecutionContext
  ): Promise<ToolResultOutput[]> {
    return await this.spawnAgents.spawnAgents(input, context)
  }

  /**
   * Execute set_output tool
   *
   * Sets the agent's output value. This allows agents to explicitly
   * control their return value.
   *
   * @param input - Tool input containing output value
   * @param context - Current execution context (modified in place)
   * @returns Tool result confirming output was set
   */
  private async executeSetOutput(
    input: any,
    context: AgentExecutionContext
  ): Promise<ToolResultOutput[]> {
    // Update context output
    context.output = input.output

    return [
      {
        type: 'json',
        value: {
          success: true,
          output: input.output,
        },
      },
    ]
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Log a message
   *
   * @param message - Log message
   * @param data - Optional data to include
   */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      const prefix = '[ToolDispatcher]'
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
   * Get current working directory
   *
   * @returns Current working directory
   */
  getCwd(): string {
    return this.config.cwd
  }

  /**
   * Get tool implementation for direct access (if needed)
   *
   * This is useful for advanced use cases where direct access
   * to tool implementations is required.
   *
   * @param toolCategory - Category of tools to get
   * @returns Tool implementation
   */
  getToolImplementation(
    toolCategory: 'file' | 'search' | 'terminal' | 'agents'
  ):
    | FileOperationsTools
    | CodeSearchTools
    | TerminalTools
    | SpawnAgentsAdapter {
    switch (toolCategory) {
      case 'file':
        return this.fileOps
      case 'search':
        return this.codeSearch
      case 'terminal':
        return this.terminal
      case 'agents':
        return this.spawnAgents
      default:
        throw new Error(`Unknown tool category: ${toolCategory}`)
    }
  }
}
