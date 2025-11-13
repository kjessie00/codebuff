/**
 * Claude Code CLI Integration Module
 *
 * This module provides integration with Claude via the FREE Claude Code CLI tool.
 * It handles:
 * - Subprocess invocation of the `claude` CLI command
 * - Message formatting for CLI input
 * - Response parsing from CLI output
 * - Tool call execution loop
 * - Error handling and timeouts
 *
 * NO API KEYS REQUIRED - Uses your existing Claude Code CLI subscription
 */

import { spawn, ChildProcess } from 'child_process'
import type { Message, ToolResultOutput } from '../../.agents/types/util-types'
import type { ToolCall } from '../../.agents/types/agent-definition'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Claude invocation parameters
 */
export interface ClaudeInvocationParams {
  systemPrompt: string
  messages: Message[]
  tools: string[]
  maxTokens?: number
  temperature?: number
  timeout?: number
}

/**
 * Claude response with potential tool calls
 */
export interface ClaudeResponse {
  text: string
  toolCalls: Array<{
    id: string
    name: string
    input: any
  }>
  stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use'
}

/**
 * Tool executor function type
 */
export type ToolExecutor = (toolCall: ToolCall) => Promise<ToolResultOutput[]>

/**
 * CLI process options
 */
interface CLIProcessOptions {
  systemPrompt: string
  userPrompt: string
  tools?: Array<{
    name: string
    description: string
    input_schema: any
  }>
  timeout?: number
}

// ============================================================================
// Claude CLI Integration Class
// ============================================================================

/**
 * Handles all interactions with Claude via the FREE Claude Code CLI
 */
export class ClaudeCLIIntegration {
  private readonly claudePath: string
  private readonly maxTokens: number
  private readonly timeout: number
  private readonly debug: boolean
  private readonly logger: (message: string, data?: any) => void

  constructor(options: {
    claudePath?: string
    maxTokens?: number
    timeout?: number
    debug?: boolean
    logger?: (message: string, data?: any) => void
  }) {
    // Use Claude CLI from PATH or specified location
    this.claudePath = options.claudePath || 'claude'

    this.maxTokens = options.maxTokens || 8192
    this.timeout = options.timeout || 120000 // 2 minutes default
    this.debug = options.debug || false
    this.logger = options.logger || console.log
  }

  /**
   * Invoke Claude with conversation turn and tool handling
   *
   * This method handles the complete interaction loop:
   * 1. Format messages and tools
   * 2. Call Claude CLI subprocess
   * 3. Process response (text or tool calls)
   * 4. If tool calls, execute them and continue conversation
   * 5. Return final response
   */
  async invoke(
    params: ClaudeInvocationParams,
    toolExecutor: ToolExecutor
  ): Promise<string> {
    this.log('Invoking Claude CLI', {
      systemPromptLength: params.systemPrompt.length,
      messageCount: params.messages.length,
      toolCount: params.tools.length,
    })

    // Build tool definitions
    const tools = this.buildToolDefinitions(params.tools)

    // Combine messages into a single conversation
    const conversationText = this.formatMessages(params.messages)

    // Add timeout wrapper
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Claude CLI invocation timeout')),
        params.timeout || this.timeout
      )
    })

    try {
      // Execute with timeout
      const result = await Promise.race([
        this.executeConversationTurn(
          params.systemPrompt,
          conversationText,
          tools,
          toolExecutor
        ),
        timeoutPromise,
      ])

      return result
    } catch (error) {
      this.log('Claude CLI invocation failed', { error })
      throw error
    }
  }

  /**
   * Execute a single conversation turn, potentially with multiple tool call rounds
   */
  private async executeConversationTurn(
    systemPrompt: string,
    conversationText: string,
    tools: Array<{ name: string; description: string; input_schema: any }>,
    toolExecutor: ToolExecutor
  ): Promise<string> {
    let currentPrompt = conversationText
    let finalText = ''
    let continueLoop = true
    let iterationCount = 0
    const maxIterations = 10 // Prevent infinite loops

    while (continueLoop && iterationCount < maxIterations) {
      iterationCount++

      // Call Claude CLI subprocess
      const response = await this.callClaudeCLI({
        systemPrompt,
        userPrompt: currentPrompt,
        tools: tools.length > 0 ? tools : undefined,
        timeout: this.timeout,
      })

      this.log('Claude CLI response', {
        iteration: iterationCount,
        responseLength: response.length,
      })

      // Parse the response to extract text and potential tool calls
      const parsed = this.parseResponse(response)

      // Accumulate text
      if (parsed.text) {
        finalText += parsed.text
      }

      // Check if there are tool calls to execute
      if (parsed.toolCalls.length > 0) {
        // Execute all tool calls
        const toolResults = await this.executeToolCalls(
          parsed.toolCalls,
          toolExecutor
        )

        // Format tool results as new user message
        const toolResultsText = this.formatToolResults(toolResults)

        // Continue conversation with tool results
        currentPrompt = `Previous response:\n${response}\n\nTool results:\n${toolResultsText}\n\nPlease continue based on these tool results.`

        continueLoop = true
      } else {
        // No tool calls, conversation turn is complete
        continueLoop = false
      }
    }

    if (iterationCount >= maxIterations) {
      this.log('Warning: Max iterations reached')
    }

    return finalText
  }

  /**
   * Call Claude CLI subprocess and capture output
   */
  private async callClaudeCLI(options: CLIProcessOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const args: string[] = []

      // Build the prompt
      let fullPrompt = ''

      if (options.systemPrompt) {
        fullPrompt += `System: ${options.systemPrompt}\n\n`
      }

      fullPrompt += options.userPrompt

      // Add tool definitions if provided
      if (options.tools && options.tools.length > 0) {
        fullPrompt += '\n\nAvailable tools:\n'
        fullPrompt += JSON.stringify(options.tools, null, 2)
        fullPrompt += '\n\nYou can use these tools by responding with a tool call in this format:\n'
        fullPrompt += '```tool_call\n{\n  "tool": "tool_name",\n  "id": "unique_id",\n  "input": {...}\n}\n```'
      }

      this.log('Spawning Claude CLI process', {
        command: this.claudePath,
        args,
        promptLength: fullPrompt.length,
      })

      // Spawn the Claude CLI process
      const claudeProcess: ChildProcess = spawn(this.claudePath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      })

      let stdout = ''
      let stderr = ''

      // Capture stdout
      if (claudeProcess.stdout) {
        claudeProcess.stdout.on('data', (data) => {
          const chunk = data.toString()
          stdout += chunk
          if (this.debug) {
            this.log('CLI stdout chunk', { length: chunk.length })
          }
        })
      }

      // Capture stderr
      if (claudeProcess.stderr) {
        claudeProcess.stderr.on('data', (data) => {
          stderr += data.toString()
        })
      }

      // Handle process completion
      claudeProcess.on('close', (code) => {
        this.log('CLI process closed', { code, stdoutLength: stdout.length, stderrLength: stderr.length })

        if (code === 0) {
          resolve(stdout)
        } else {
          reject(
            new Error(
              `Claude CLI exited with code ${code}\nStderr: ${stderr}\nStdout: ${stdout}`
            )
          )
        }
      })

      // Handle process errors
      claudeProcess.on('error', (error) => {
        this.log('CLI process error', { error })
        reject(
          new Error(
            `Failed to spawn Claude CLI: ${error.message}\nIs Claude CLI installed and in PATH?`
          )
        )
      })

      // Setup timeout
      const timeoutId = setTimeout(() => {
        claudeProcess.kill('SIGTERM')
        reject(new Error('Claude CLI process timeout'))
      }, options.timeout || this.timeout)

      // Send the prompt via stdin
      if (claudeProcess.stdin) {
        try {
          claudeProcess.stdin.write(fullPrompt)
          claudeProcess.stdin.end()
        } catch (error) {
          clearTimeout(timeoutId)
          reject(error)
        }
      } else {
        clearTimeout(timeoutId)
        reject(new Error('Failed to write to Claude CLI stdin'))
      }

      // Clear timeout when process completes
      claudeProcess.on('close', () => {
        clearTimeout(timeoutId)
      })
    })
  }

  /**
   * Execute tool calls and return results
   */
  private async executeToolCalls(
    toolCalls: Array<{ id: string; name: string; input: any }>,
    toolExecutor: ToolExecutor
  ): Promise<
    Array<{
      id: string
      name: string
      result: string
    }>
  > {
    const results: Array<{ id: string; name: string; result: string }> = []

    for (const toolCall of toolCalls) {
      this.log(`Executing tool: ${toolCall.name}`, { input: toolCall.input })

      try {
        // Execute the tool
        const toolResult = await toolExecutor({
          toolName: toolCall.name as any,
          input: toolCall.input,
        })

        // Format result as string
        const resultString = this.formatToolResult(toolResult)

        results.push({
          id: toolCall.id,
          name: toolCall.name,
          result: resultString,
        })
      } catch (error) {
        // Return error as tool result
        const errorMessage =
          error instanceof Error ? error.message : String(error)

        results.push({
          id: toolCall.id,
          name: toolCall.name,
          result: `Error executing tool: ${errorMessage}`,
        })
      }
    }

    return results
  }

  /**
   * Parse Claude CLI response to extract text and tool calls
   *
   * This is a simple parser that looks for tool call markers in the response.
   * In a production implementation, this would need to be more sophisticated
   * and handle the actual format that Claude CLI uses for tool calls.
   */
  private parseResponse(response: string): ClaudeResponse {
    const toolCalls: Array<{ id: string; name: string; input: any }> = []
    let text = response

    // Look for tool call blocks (this is a simplified parser)
    // Format: ```tool_call\n{json}\n```
    const toolCallRegex = /```tool_call\s*\n([\s\S]*?)\n```/g
    let match

    while ((match = toolCallRegex.exec(response)) !== null) {
      try {
        const toolCallJson = match[1]
        const toolCall = JSON.parse(toolCallJson)

        toolCalls.push({
          id: toolCall.id || `tool_${Date.now()}_${toolCalls.length}`,
          name: toolCall.tool || toolCall.name,
          input: toolCall.input || {},
        })

        // Remove the tool call block from the text
        text = text.replace(match[0], '')
      } catch (error) {
        this.log('Failed to parse tool call', { error, match: match[1] })
      }
    }

    // Determine stop reason
    let stopReason: ClaudeResponse['stopReason'] = 'end_turn'
    if (toolCalls.length > 0) {
      stopReason = 'tool_use'
    }

    return {
      text: text.trim(),
      toolCalls,
      stopReason,
    }
  }

  /**
   * Format messages into a single conversation string
   */
  private formatMessages(messages: Message[]): string {
    return messages
      .map((msg) => {
        const content =
          typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content)

        if (msg.role === 'user') {
          return `User: ${content}`
        } else if (msg.role === 'assistant') {
          return `Assistant: ${content}`
        }
        return content
      })
      .join('\n\n')
  }

  /**
   * Format tool results for Claude
   */
  private formatToolResult(results: ToolResultOutput[]): string {
    if (results.length === 0) {
      return 'Tool executed successfully (no output)'
    }

    const formatted = results
      .map((result) => {
        switch (result.type) {
          case 'json':
            return JSON.stringify(result.value, null, 2)
          case 'media':
            return `[Media: ${result.mediaType}]\n${result.data}`
          default:
            return String(result)
        }
      })
      .join('\n\n')

    return formatted
  }

  /**
   * Format tool results for inclusion in the next prompt
   */
  private formatToolResults(
    results: Array<{ id: string; name: string; result: string }>
  ): string {
    return results
      .map(
        (result) =>
          `Tool: ${result.name} (ID: ${result.id})\nResult:\n${result.result}`
      )
      .join('\n\n')
  }

  /**
   * Build tool definitions for Claude CLI
   */
  private buildToolDefinitions(
    toolNames: string[]
  ): Array<{ name: string; description: string; input_schema: any }> {
    return toolNames
      .map((name) => this.getToolDefinition(name))
      .filter(Boolean) as Array<{
      name: string
      description: string
      input_schema: any
    }>
  }

  /**
   * Get tool definition for a specific tool name
   * (Same definitions as the API version, but formatted for CLI)
   */
  private getToolDefinition(toolName: string): {
    name: string
    description: string
    input_schema: any
  } | null {
    switch (toolName as any) {
      case 'read_files':
        return {
          name: 'read_files',
          description:
            'Read multiple files from disk. Returns file contents with line numbers.',
          input_schema: {
            type: 'object',
            properties: {
              paths: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of absolute file paths to read',
              },
            },
            required: ['paths'],
          },
        }

      case 'write_file':
        return {
          name: 'write_file',
          description:
            'Write content to a file. Creates the file if it does not exist, overwrites if it does.',
          input_schema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Absolute path to the file to write',
              },
              content: {
                type: 'string',
                description: 'Content to write to the file',
              },
            },
            required: ['path', 'content'],
          },
        }

      case 'str_replace':
        return {
          name: 'str_replace',
          description:
            'Replace a string in a file with another string. More reliable than write_file for editing.',
          input_schema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Absolute path to the file to modify',
              },
              old_str: {
                type: 'string',
                description: 'The exact string to find and replace',
              },
              new_str: {
                type: 'string',
                description: 'The string to replace it with',
              },
            },
            required: ['path', 'old_str', 'new_str'],
          },
        }

      case 'code_search':
        return {
          name: 'code_search',
          description:
            'Search codebase using ripgrep with regex patterns. Fast and powerful full-text search.',
          input_schema: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description: 'Regex pattern to search for',
              },
              path: {
                type: 'string',
                description:
                  'Optional: directory or file to search in (defaults to project root)',
              },
              file_pattern: {
                type: 'string',
                description:
                  'Optional: glob pattern to filter files (e.g., "*.ts", "**/*.py")',
              },
              case_sensitive: {
                type: 'boolean',
                description: 'Optional: whether search is case sensitive',
              },
            },
            required: ['pattern'],
          },
        }

      case 'find_files':
        return {
          name: 'find_files',
          description:
            'Find files matching a glob pattern. Returns list of matching file paths.',
          input_schema: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description:
                  'Glob pattern to match files (e.g., "**/*.ts", "src/**/*.test.js")',
              },
              cwd: {
                type: 'string',
                description:
                  'Optional: directory to search in (defaults to project root)',
              },
            },
            required: ['pattern'],
          },
        }

      case 'run_terminal_command':
        return {
          name: 'run_terminal_command',
          description:
            'Execute a shell command in the terminal. Returns stdout, stderr, and exit code.',
          input_schema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The shell command to execute',
              },
              cwd: {
                type: 'string',
                description:
                  'Optional: working directory for the command (defaults to project root)',
              },
              timeout: {
                type: 'number',
                description:
                  'Optional: timeout in milliseconds (default: 30000)',
              },
            },
            required: ['command'],
          },
        }

      case 'spawn_agents':
        return {
          name: 'spawn_agents',
          description:
            'Spawn and execute one or more sub-agents in parallel or sequence. Returns their outputs.',
          input_schema: {
            type: 'object',
            properties: {
              agents: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    agentId: {
                      type: 'string',
                      description: 'ID of the agent to spawn',
                    },
                    prompt: {
                      type: 'string',
                      description: 'Prompt for the agent',
                    },
                    params: {
                      type: 'object',
                      description: 'Optional parameters for the agent',
                    },
                  },
                  required: ['agentId', 'prompt'],
                },
                description: 'Array of agents to spawn',
              },
              parallel: {
                type: 'boolean',
                description:
                  'Optional: whether to run agents in parallel (default: false)',
              },
            },
            required: ['agents'],
          },
        }

      case 'set_output':
        return {
          name: 'set_output',
          description:
            'Set the output value for the current agent. This will be returned to the caller.',
          input_schema: {
            type: 'object',
            properties: {
              output: {
                description:
                  'The output value to set (any JSON-serializable value)',
              },
            },
            required: ['output'],
          },
        }

      default:
        this.log(`Unknown tool: ${toolName}`)
        return null
    }
  }

  /**
   * Log a message (if debug enabled)
   */
  private log(message: string, data?: any): void {
    if (this.debug) {
      const prefix = '[ClaudeCLIIntegration]'
      if (data !== undefined) {
        this.logger(`${prefix} ${message}:`, data)
      } else {
        this.logger(`${prefix} ${message}`)
      }
    }
  }
}
