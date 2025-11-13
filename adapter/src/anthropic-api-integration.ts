/**
 * Anthropic API Integration Module (PAID Mode Only)
 *
 * This module provides integration with Claude via the Anthropic SDK.
 * It is ONLY used when an API key is provided (PAID mode).
 *
 * PAID Mode Features:
 * - Full multi-agent support (spawn_agents)
 * - Direct Anthropic API integration
 * - Cost: ~$3-15 per 1M tokens
 *
 * This module handles:
 * - Tool definition building
 * - Message formatting
 * - Response parsing
 * - Tool call execution loop
 * - Error handling and timeouts
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  MessageParam,
  Tool,
  ContentBlock,
  Message as AnthropicMessage,
} from '@anthropic-ai/sdk/resources/messages'

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

// ============================================================================
// Anthropic API Integration Class
// ============================================================================

/**
 * Handles all interactions with Claude via the Anthropic SDK
 *
 * This class is used exclusively in PAID mode when an API key is provided.
 */
export class AnthropicAPIIntegration {
  private readonly client: Anthropic
  private readonly model: string
  private readonly maxTokens: number
  private readonly timeout: number
  private readonly debug: boolean
  private readonly logger: (message: string, data?: any) => void

  constructor(options: {
    apiKey: string
    model?: string
    maxTokens?: number
    timeout?: number
    debug?: boolean
    logger?: (message: string, data?: any) => void
  }) {
    // Initialize Anthropic client
    this.client = new Anthropic({
      apiKey: options.apiKey,
    })

    this.model = options.model || 'claude-sonnet-4-20250514'
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
   * 2. Call Claude API
   * 3. Process response (text or tool calls)
   * 4. If tool calls, execute them and continue conversation
   * 5. Return final response
   */
  async invoke(
    params: ClaudeInvocationParams,
    toolExecutor: ToolExecutor
  ): Promise<string> {
    this.log('Invoking Claude via Anthropic API', {
      systemPromptLength: params.systemPrompt.length,
      messageCount: params.messages.length,
      toolCount: params.tools.length,
    })

    // Build tool definitions
    const tools = this.buildToolDefinitions(params.tools)

    // Convert messages to Anthropic format
    const messages = this.convertMessages(params.messages)

    // Add timeout wrapper
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Claude invocation timeout')),
        params.timeout || this.timeout
      )
    })

    try {
      // Execute with timeout
      const result = await Promise.race([
        this.executeConversationTurn(
          params.systemPrompt,
          messages,
          tools,
          toolExecutor
        ),
        timeoutPromise,
      ])

      return result
    } catch (error) {
      this.log('Claude invocation failed', { error })
      throw error
    }
  }

  /**
   * Execute a single conversation turn, potentially with multiple tool call rounds
   */
  private async executeConversationTurn(
    systemPrompt: string,
    messages: MessageParam[],
    tools: Tool[],
    toolExecutor: ToolExecutor
  ): Promise<string> {
    const conversationMessages = [...messages]
    let continueLoop = true
    let finalText = ''

    while (continueLoop) {
      // Call Claude API
      const response = await this.callClaudeAPI(
        systemPrompt,
        conversationMessages,
        tools
      )

      this.log('Claude response', {
        stopReason: response.stopReason,
        hasText: response.text.length > 0,
        toolCallCount: response.toolCalls.length,
      })

      // Accumulate text
      if (response.text) {
        finalText += response.text
      }

      // Check if there are tool calls to execute
      if (response.toolCalls.length > 0) {
        // Add assistant's response to conversation
        conversationMessages.push({
          role: 'assistant',
          content: this.buildContentBlocks(response),
        })

        // Execute all tool calls
        const toolResults = await this.executeToolCalls(
          response.toolCalls,
          toolExecutor
        )

        // Add tool results to conversation
        conversationMessages.push({
          role: 'user',
          content: toolResults,
        })

        // Continue the loop to get Claude's next response
        continueLoop = true
      } else {
        // No tool calls, conversation turn is complete
        continueLoop = false
      }
    }

    return finalText
  }

  /**
   * Call Claude API and parse response
   */
  private async callClaudeAPI(
    systemPrompt: string,
    messages: MessageParam[],
    tools: Tool[]
  ): Promise<ClaudeResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages,
      tools: tools.length > 0 ? tools : undefined,
    })

    return this.parseResponse(response)
  }

  /**
   * Execute tool calls and return results
   */
  private async executeToolCalls(
    toolCalls: Array<{ id: string; name: string; input: any }>,
    toolExecutor: ToolExecutor
  ): Promise<Array<{ type: 'tool_result'; tool_use_id: string; content: string }>> {
    const results: Array<{
      type: 'tool_result'
      tool_use_id: string
      content: string
    }> = []

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
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: resultString,
        })
      } catch (error) {
        // Return error as tool result
        const errorMessage =
          error instanceof Error ? error.message : String(error)

        results.push({
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: `Error executing tool: ${errorMessage}`,
        })
      }
    }

    return results
  }

  /**
   * Parse Anthropic API response into our format
   */
  private parseResponse(response: AnthropicMessage): ClaudeResponse {
    const toolCalls: Array<{ id: string; name: string; input: any }> = []
    let text = ''

    // Extract text and tool calls from content blocks
    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input,
        })
      }
    }

    return {
      text,
      toolCalls,
      stopReason: response.stop_reason as any,
    }
  }

  /**
   * Build content blocks for assistant message (text + tool calls)
   */
  private buildContentBlocks(
    response: ClaudeResponse
  ): Array<ContentBlock> {
    const blocks: Array<ContentBlock> = []

    // Add text block if present
    if (response.text) {
      blocks.push({
        type: 'text',
        text: response.text,
      } as ContentBlock)
    }

    // Add tool use blocks
    for (const toolCall of response.toolCalls) {
      blocks.push({
        type: 'tool_use',
        id: toolCall.id,
        name: toolCall.name,
        input: toolCall.input,
      } as ContentBlock)
    }

    return blocks
  }

  /**
   * Convert Codebuff messages to Anthropic format
   */
  private convertMessages(messages: Message[]): MessageParam[] {
    return messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content:
        typeof msg.content === 'string'
          ? msg.content
          : JSON.stringify(msg.content),
    }))
  }

  /**
   * Format tool result for Claude
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
   * Build tool definitions for Claude API
   */
  private buildToolDefinitions(toolNames: string[]): Tool[] {
    return toolNames.map((name) => this.getToolDefinition(name)).filter(Boolean) as Tool[]
  }

  /**
   * Get tool definition for a specific tool name
   */
  private getToolDefinition(toolName: string): Tool | null {
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
                description: 'The output value to set (any JSON-serializable value)',
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
      const prefix = '[AnthropicAPIIntegration]'
      if (data !== undefined) {
        this.logger(`${prefix} ${message}:`, data)
      } else {
        this.logger(`${prefix} ${message}`)
      }
    }
  }
}
