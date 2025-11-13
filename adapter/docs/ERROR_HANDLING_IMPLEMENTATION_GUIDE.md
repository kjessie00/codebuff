# Error Handling Implementation Guide

This guide provides specific code examples for implementing error handling in the remaining adapter files.

## File-by-File Implementation

### 1. claude-cli-adapter.ts - Tool Dispatcher Methods

Add error handling to all tool dispatcher methods:

```typescript
// Example for read_files
private async toolReadFiles(input: any): Promise<ToolResultOutput[]> {
  try {
    return await withTimeout(
      () => this.fileOps.readFiles(input),
      this.config.timeouts.toolExecutionTimeoutMs,
      'read_files'
    )
  } catch (error) {
    // Log error for debugging
    this.log('Tool execution failed: read_files', {
      error: isAdapterError(error) ? error.toJSON() : formatError(error),
      input,
    })

    // Wrap and rethrow
    throw new ToolExecutionError(
      'Failed to read files',
      {
        toolName: 'read_files',
        toolInput: input,
        originalError: error instanceof Error ? error : new Error(String(error)),
      }
    )
  }
}

// Apply same pattern to:
private async toolWriteFile(input: any): Promise<ToolResultOutput[]>
private async toolStrReplace(input: any): Promise<ToolResultOutput[]>
private async toolCodeSearch(input: any): Promise<ToolResultOutput[]>
private async toolFindFiles(input: any): Promise<ToolResultOutput[]>
private async toolRunTerminal(input: any): Promise<ToolResultOutput[]>
private async toolSpawnAgents(input: any, context: AgentExecutionContext): Promise<ToolResultOutput[]>
```

### 2. claude-cli-adapter.ts - LLM Integration

Update the `invokeClaude` method with timeout and error handling:

```typescript
private async invokeClaude(
  params: ClaudeInvocationParams
): Promise<string> {
  this.log('Invoking Claude', {
    systemPromptLength: params.systemPrompt.length,
    messageCount: params.messages.length,
    toolCount: params.tools.length,
  })

  try {
    return await withTimeout(
      async () => {
        // TODO: Implement actual Claude Code CLI integration
        // For now, return placeholder

        // Simulated delay for testing
        await new Promise(resolve => setTimeout(resolve, 100))

        return `[Claude Response Placeholder]\nReceived ${params.messages.length} messages with ${params.tools.length} available tools.`
      },
      this.config.timeouts.llmInvocationTimeoutMs,
      'claude_invocation'
    )
  } catch (error) {
    this.log('Claude invocation failed', {
      error: isAdapterError(error) ? error.toJSON() : formatError(error),
      messageCount: params.messages.length,
    })

    throw new LLMExecutionError(
      'Claude invocation failed',
      {
        systemPrompt: params.systemPrompt,
        messageCount: params.messages.length,
        availableTools: params.tools,
        originalError: error instanceof Error ? error : new Error(String(error)),
      }
    )
  }
}
```

### 3. claude-cli-adapter.ts - executePureLLM

Add graceful degradation for LLM failures:

```typescript
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

  try {
    // Invoke Claude with error handling
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
  } catch (error) {
    // Graceful degradation: return partial result with error
    this.log('LLM execution failed, returning partial result', {
      error: isAdapterError(error) ? error.toJSON() : formatError(error),
    })

    // Add error message to history
    context.messageHistory.push({
      role: 'assistant',
      content: `[Error: LLM execution failed - ${formatError(error)}]`,
    })

    return {
      output: {
        type: 'error',
        error: isAdapterError(error) ? error.toJSON() : formatError(error),
        partialResult: context.output,
      },
      messageHistory: context.messageHistory,
      metadata: {
        completedNormally: false,
      },
    }
  }
}
```

### 4. file-operations.ts - Enhanced Error Handling

Update all methods with proper error handling:

```typescript
import { ToolExecutionError, ValidationError } from '../errors'

export class FileOperationsTools {
  async readFiles(input: ReadFilesParams): Promise<ToolResultOutput[]> {
    try {
      // Validate input
      if (!input.paths || !Array.isArray(input.paths)) {
        throw new ValidationError(
          'Invalid paths parameter',
          {
            field: 'paths',
            value: input.paths,
            reason: 'Must be an array of file path strings',
            toolName: 'read_files',
          }
        )
      }

      if (input.paths.length === 0) {
        throw new ValidationError(
          'Empty paths array',
          {
            field: 'paths',
            value: input.paths,
            reason: 'At least one file path must be provided',
            toolName: 'read_files',
          }
        )
      }

      const results: Record<string, string | null> = {}

      // Read all files, handling errors individually
      for (const filePath of input.paths) {
        try {
          // Resolve path relative to cwd
          const fullPath = this.resolvePath(filePath)

          // Validate path is within cwd (security check)
          this.validatePath(fullPath)

          // Read file content
          const content = await fs.readFile(fullPath, 'utf-8')
          results[filePath] = content
        } catch (error) {
          // For individual file errors, store null and log warning
          // This allows partial success when reading multiple files
          results[filePath] = null

          if (this.isNodeError(error)) {
            if (error.code !== 'ENOENT') {
              // Log non-ENOENT errors (ENOENT is expected for missing files)
              console.warn(
                `[FileOperationsTools] Failed to read ${filePath}:`,
                error.message
              )
            }
          }
        }
      }

      return [
        {
          type: 'json',
          value: results,
        },
      ]
    } catch (error) {
      // Wrap validation and other errors
      if (error instanceof ValidationError) {
        throw error // Already properly formatted
      }

      throw new ToolExecutionError(
        `Failed to read files: ${formatError(error)}`,
        {
          toolName: 'read_files',
          toolInput: input,
          originalError: error instanceof Error ? error : new Error(String(error)),
        }
      )
    }
  }

  async writeFile(input: WriteFileParams): Promise<ToolResultOutput[]> {
    try {
      // Validate input
      if (!input.path || typeof input.path !== 'string') {
        throw new ValidationError(
          'Invalid path parameter',
          {
            field: 'path',
            value: input.path,
            reason: 'Path must be a non-empty string',
            toolName: 'write_file',
          }
        )
      }

      if (input.content === undefined || input.content === null) {
        throw new ValidationError(
          'Invalid content parameter',
          {
            field: 'content',
            value: input.content,
            reason: 'Content must be provided',
            toolName: 'write_file',
          }
        )
      }

      // Resolve path relative to cwd
      const fullPath = this.resolvePath(input.path)

      // Validate path is within cwd (security check)
      this.validatePath(fullPath)

      // Create parent directory if it doesn't exist
      const dirPath = path.dirname(fullPath)
      await fs.mkdir(dirPath, { recursive: true })

      // Write file content
      await fs.writeFile(fullPath, input.content, 'utf-8')

      return [
        {
          type: 'json',
          value: {
            success: true,
            path: input.path,
          },
        },
      ]
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }

      throw new ToolExecutionError(
        `Failed to write file: ${formatError(error)}`,
        {
          toolName: 'write_file',
          toolInput: input,
          originalError: error instanceof Error ? error : new Error(String(error)),
        }
      )
    }
  }

  async strReplace(input: StrReplaceParams): Promise<ToolResultOutput[]> {
    try {
      // Validate input
      if (!input.path || typeof input.path !== 'string') {
        throw new ValidationError(
          'Invalid path parameter',
          {
            field: 'path',
            value: input.path,
            reason: 'Path must be a non-empty string',
            toolName: 'str_replace',
          }
        )
      }

      if (!input.old_string || typeof input.old_string !== 'string') {
        throw new ValidationError(
          'Invalid old_string parameter',
          {
            field: 'old_string',
            value: input.old_string,
            reason: 'old_string must be a non-empty string',
            toolName: 'str_replace',
          }
        )
      }

      if (input.new_string === undefined || input.new_string === null) {
        throw new ValidationError(
          'Invalid new_string parameter',
          {
            field: 'new_string',
            value: input.new_string,
            reason: 'new_string must be provided',
            toolName: 'str_replace',
          }
        )
      }

      // Resolve path relative to cwd
      const fullPath = this.resolvePath(input.path)

      // Validate path is within cwd (security check)
      this.validatePath(fullPath)

      // Read current file content
      let content: string
      try {
        content = await fs.readFile(fullPath, 'utf-8')
      } catch (error) {
        if (this.isNodeError(error) && error.code === 'ENOENT') {
          throw new ValidationError(
            `File not found: ${input.path}`,
            {
              field: 'path',
              value: input.path,
              reason: 'File does not exist',
              toolName: 'str_replace',
            }
          )
        }
        throw error
      }

      // Check if old_string exists in the file
      if (!content.includes(input.old_string)) {
        throw new ValidationError(
          'String not found in file',
          {
            field: 'old_string',
            value: input.old_string,
            reason: `The string "${input.old_string}" was not found in ${input.path}`,
            toolName: 'str_replace',
          }
        )
      }

      // Perform replacement (first occurrence only, like Claude CLI Edit)
      const newContent = content.replace(input.old_string, input.new_string)

      // Write updated content back to file
      await fs.writeFile(fullPath, newContent, 'utf-8')

      return [
        {
          type: 'json',
          value: {
            success: true,
            path: input.path,
          },
        },
      ]
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }

      throw new ToolExecutionError(
        `Failed to replace string: ${formatError(error)}`,
        {
          toolName: 'str_replace',
          toolInput: input,
          originalError: error instanceof Error ? error : new Error(String(error)),
        }
      )
    }
  }

  // Update validatePath to throw ValidationError
  private validatePath(fullPath: string): void {
    const normalizedPath = path.normalize(fullPath)
    const normalizedCwd = path.normalize(this.cwd)

    if (!normalizedPath.startsWith(normalizedCwd)) {
      throw new ValidationError(
        'Path traversal detected',
        {
          field: 'path',
          value: fullPath,
          reason: `Path ${fullPath} is outside working directory ${this.cwd}`,
        }
      )
    }
  }
}
```

### 5. code-search.ts - Enhanced Error Handling

```typescript
import { ToolExecutionError, ValidationError, formatError } from '../errors'

export class CodeSearchTools {
  async codeSearch(input: CodeSearchInput): Promise<ToolResultOutput[]> {
    try {
      // Validate input
      if (!input.query || typeof input.query !== 'string') {
        throw new ValidationError(
          'Invalid query parameter',
          {
            field: 'query',
            value: input.query,
            reason: 'Query must be a non-empty string',
            toolName: 'code_search',
          }
        )
      }

      const {
        query,
        file_pattern,
        case_sensitive = false,
        cwd: searchCwd,
        maxResults = 250,
      } = input

      // Determine search directory
      const searchDir = searchCwd
        ? path.resolve(this.cwd, searchCwd)
        : this.cwd

      // Build ripgrep command arguments
      const args: string[] = [
        'rg',
        '--json',
        '--no-heading',
        '--line-number',
        '--column',
        case_sensitive ? '' : '-i',
      ]

      if (file_pattern) {
        args.push('--glob', `"${file_pattern}"`)
      }

      args.push(`"${query}"`, `"${searchDir}"`)

      const command = args.filter(Boolean).join(' ')

      // Execute ripgrep
      let stdout: string
      try {
        const result = await execAsync(command, {
          maxBuffer: 10 * 1024 * 1024,
          encoding: 'utf-8',
        })
        stdout = result.stdout
      } catch (error: any) {
        // ripgrep exit code 1 means no matches (not an error)
        if (error.code === 1) {
          return [
            {
              type: 'json',
              value: {
                results: [],
                total: 0,
                query,
                message: 'No matches found',
              },
            },
          ]
        }
        // Other error codes are real errors
        throw error
      }

      // Parse results
      const results: SearchResult[] = []
      const lines = stdout.split('\n').filter(Boolean)

      for (const line of lines) {
        try {
          const parsed: RipgrepMatch = JSON.parse(line)

          if (parsed.type === 'match') {
            const relativePath = path.relative(this.cwd, parsed.data.path.text)

            results.push({
              path: relativePath,
              line_number: parsed.data.line_number,
              line: parsed.data.lines.text.trim(),
              match: parsed.data.submatches?.[0]?.match.text,
            })

            if (results.length >= maxResults) {
              break
            }
          }
        } catch (parseError) {
          // Skip malformed JSON lines
          continue
        }
      }

      // Group results by file
      const resultsByFile: Record<string, SearchResult[]> = {}
      for (const result of results) {
        if (!resultsByFile[result.path]) {
          resultsByFile[result.path] = []
        }
        resultsByFile[result.path].push(result)
      }

      return [
        {
          type: 'json',
          value: {
            results,
            total: results.length,
            query,
            case_sensitive,
            file_pattern,
            by_file: resultsByFile,
          },
        },
      ]
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }

      throw new ToolExecutionError(
        `Code search failed: ${formatError(error)}`,
        {
          toolName: 'code_search',
          toolInput: input,
          originalError: error instanceof Error ? error : new Error(String(error)),
        }
      )
    }
  }

  async findFiles(input: FindFilesInput): Promise<ToolResultOutput[]> {
    try {
      // Validate input
      if (!input.pattern || typeof input.pattern !== 'string') {
        throw new ValidationError(
          'Invalid pattern parameter',
          {
            field: 'pattern',
            value: input.pattern,
            reason: 'Pattern must be a non-empty string',
            toolName: 'find_files',
          }
        )
      }

      const { pattern, cwd: searchCwd } = input

      // Determine search directory
      const searchDir = searchCwd
        ? path.resolve(this.cwd, searchCwd)
        : this.cwd

      // Find files using glob
      const files = await glob(pattern, {
        cwd: searchDir,
        nodir: true,
        absolute: false,
        dot: false,
        ignore: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
          '**/.next/**',
          '**/coverage/**',
        ],
      })

      // Get file stats for sorting
      const fs = await import('fs/promises')
      const filesWithStats = await Promise.all(
        files.map(async (file) => {
          try {
            const fullPath = path.join(searchDir, file)
            const stats = await fs.stat(fullPath)
            return {
              path: file,
              mtime: stats.mtime.getTime(),
            }
          } catch (error) {
            return null
          }
        })
      )

      // Filter and sort
      const sortedFiles = filesWithStats
        .filter((f): f is { path: string; mtime: number } => f !== null)
        .sort((a, b) => b.mtime - a.mtime)
        .map((f) => f.path)

      return [
        {
          type: 'json',
          value: {
            files: sortedFiles,
            total: sortedFiles.length,
            pattern,
            search_dir: path.relative(this.cwd, searchDir) || '.',
          },
        },
      ]
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }

      throw new ToolExecutionError(
        `File search failed: ${formatError(error)}`,
        {
          toolName: 'find_files',
          toolInput: input,
          originalError: error instanceof Error ? error : new Error(String(error)),
        }
      )
    }
  }
}
```

### 6. spawn-agents.ts - Enhanced Error Handling

```typescript
import { ToolExecutionError, AgentNotFoundError, formatError, isAdapterError } from '../errors'

export class SpawnAgentsAdapter {
  async spawnAgents(
    input: SpawnAgentsParams,
    parentContext: AgentExecutionContext
  ): Promise<ToolResultOutput[]> {
    // Validate input
    if (!input.agents || !Array.isArray(input.agents)) {
      throw new ValidationError(
        'Invalid agents parameter',
        {
          field: 'agents',
          value: input.agents,
          reason: 'Must be an array of agent specifications',
          toolName: 'spawn_agents',
        }
      )
    }

    const results: SpawnedAgentResult[] = []

    // Execute agents sequentially
    for (const agentSpec of input.agents) {
      try {
        // Validate agent spec
        if (!agentSpec.agent_type) {
          throw new ValidationError(
            'Invalid agent specification',
            {
              field: 'agent_type',
              value: agentSpec.agent_type,
              reason: 'agent_type must be provided',
              toolName: 'spawn_agents',
            }
          )
        }

        // Look up agent definition
        const agentDef = this.resolveAgent(agentSpec.agent_type)

        if (!agentDef) {
          throw new AgentNotFoundError(agentSpec.agent_type, {
            availableAgents: this.listRegisteredAgents(),
            parentAgentId: parentContext.agentId,
          })
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
          value: output ?? {
            type: 'lastMessage',
            value: 'Agent completed without output',
          },
        })
      } catch (error) {
        // Include error in results (don't throw, allow continuation)
        // This allows other agents to run even if one fails
        results.push({
          agentType: agentSpec.agent_type,
          agentName: agentSpec.agent_type,
          value: {
            errorMessage: formatError(error),
            errorDetails: isAdapterError(error) ? error.toJSON() : undefined,
            errorType: error instanceof Error ? error.name : 'Unknown',
          },
        })
      }
    }

    return [
      {
        type: 'json',
        value: results,
      },
    ]
  }
}
```

## Error Handling Checklist

For each method you update, ensure:

- [ ] Import necessary error classes
- [ ] Validate input parameters
- [ ] Throw `ValidationError` for invalid input
- [ ] Wrap operations in try-catch
- [ ] Throw `ToolExecutionError` for tool failures
- [ ] Include tool name and input in error context
- [ ] Preserve original error in `originalError` field
- [ ] Log errors before throwing (when appropriate)
- [ ] Add `@throws` JSDoc tags
- [ ] Don't silently swallow errors

## Testing Pattern

```typescript
describe('ToolWithErrorHandling', () => {
  it('should throw ValidationError for invalid input', async () => {
    await expect(tool.execute({ invalid: 'input' }))
      .rejects
      .toThrow(ValidationError)
  })

  it('should throw ToolExecutionError on failure', async () => {
    // Mock failure
    mockFileSystem.readFile.mockRejectedValue(new Error('File not found'))

    await expect(tool.readFiles({ paths: ['missing.txt'] }))
      .rejects
      .toThrow(ToolExecutionError)
  })

  it('should preserve error context', async () => {
    try {
      await tool.execute({ /* ... */ })
      fail('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ToolExecutionError)
      expect(error.toolName).toBe('expected_tool')
      expect(error.toolInput).toBeDefined()
      expect(error.originalError).toBeDefined()
    }
  })
})
```
