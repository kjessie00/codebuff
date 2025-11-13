# Claude Integration Implementation

This document describes the actual implementation of the Claude LLM integration in the adapter.

## Overview

The adapter now has a complete, working integration with Claude using the **Anthropic SDK** (`@anthropic-ai/sdk`). This enables full LLM-powered agent execution with automatic tool calling.

## Architecture

### Core Components

#### 1. ClaudeIntegration (`src/claude-integration.ts`)

The main integration class that handles all communication with Claude's API.

**Key Responsibilities:**
- API communication via Anthropic SDK
- Tool definition building (maps tool names to Claude API format)
- Message formatting (Codebuff format → Anthropic format)
- Response parsing (extract text and tool calls)
- Automatic tool execution loop
- Error handling and timeouts

**Example Usage:**
```typescript
const integration = new ClaudeIntegration({
  debug: true,
  logger: console.log,
})

const response = await integration.invoke(
  {
    systemPrompt: 'You are a helpful assistant.',
    messages: [{ role: 'user', content: 'Hello!' }],
    tools: ['read_files', 'code_search'],
  },
  toolExecutor // Function that executes tool calls
)
```

#### 2. ClaudeCodeCLIAdapter (`src/claude-cli-adapter.ts`)

The main orchestrator that integrates ClaudeIntegration with the Codebuff agent system.

**Updated Methods:**
- `invokeClaude()`: Now delegates to ClaudeIntegration instead of being a placeholder
- `getCurrentContext()`: Provides execution context for tool calls
- Constructor: Initializes ClaudeIntegration instance

## Implementation Details

### Tool Definition Building

The integration automatically builds Claude API tool definitions from tool names:

```typescript
// Input: ['read_files', 'code_search']
// Output: Claude API Tool[] with full schemas

{
  name: 'read_files',
  description: 'Read multiple files from disk...',
  input_schema: {
    type: 'object',
    properties: {
      paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of absolute file paths to read'
      }
    },
    required: ['paths']
  }
}
```

**Supported Tools:**
- `read_files` - Read file contents
- `write_file` - Write to files
- `str_replace` - Edit files with string replacement
- `code_search` - Search codebase with regex
- `find_files` - Find files by glob pattern
- `run_terminal_command` - Execute shell commands
- `spawn_agents` - Spawn sub-agents
- `set_output` - Set agent output value

### Message Flow

1. **Codebuff → Anthropic Format:**
```typescript
// Codebuff format
{ role: 'user', content: 'Hello' }

// Anthropic format
{ role: 'user', content: 'Hello' }
```

2. **Tool Results → Claude Format:**
```typescript
// Tool result (Codebuff)
[{ type: 'json', value: { files: [...] } }]

// Tool result (Claude)
{
  type: 'tool_result',
  tool_use_id: 'toolu_123',
  content: '{\n  "files": [...]\n}'
}
```

### Automatic Tool Execution Loop

The integration handles the full tool execution loop automatically:

```
1. Send message to Claude
2. Receive response with tool calls
3. Execute each tool call
4. Send tool results back to Claude
5. Receive final response
6. Return text to caller
```

This means the adapter's `invokeClaude()` method always returns the final text response after all tools have been executed.

### Error Handling

**API Errors:**
- Caught and logged
- Thrown to caller for handling
- Include full error context

**Tool Execution Errors:**
- Caught during tool execution
- Returned to Claude as error messages
- Claude can retry or adjust strategy

**Timeouts:**
- Configurable timeout (default: 2 minutes)
- Wraps entire invocation with Promise.race()
- Prevents hanging on long-running calls

## Configuration

### Environment Variables

```bash
# Required: Anthropic API key
export ANTHROPIC_API_KEY=sk-ant-...
```

### Adapter Configuration

```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: '/path/to/project',
  debug: true, // Enable debug logging
  maxSteps: 20, // Max LLM steps
})
```

### Integration Options

```typescript
const integration = new ClaudeIntegration({
  apiKey: process.env.ANTHROPIC_API_KEY, // Optional: defaults to env var
  model: 'claude-sonnet-4-20250514',      // Optional: defaults to sonnet
  maxTokens: 8192,                         // Optional: defaults to 8192
  timeout: 120000,                         // Optional: 2 minutes
  debug: true,                             // Optional: enable logging
  logger: console.log,                     // Optional: custom logger
})
```

## Usage Examples

### Simple Agent (No Tools)

```typescript
const agent: AgentDefinition = {
  id: 'simple',
  displayName: 'Simple Agent',
  model: 'claude-sonnet-4-20250514',
  systemPrompt: 'You are a helpful assistant.',
  toolNames: [], // No tools
}

const adapter = createAdapter(process.cwd())
const result = await adapter.executeAgent(agent, 'What is 2+2?')

console.log(result.output)
// { type: 'lastMessage', value: '2 + 2 = 4' }
```

### Agent with Tools

```typescript
const agent: AgentDefinition = {
  id: 'file-reader',
  displayName: 'File Reader',
  model: 'claude-sonnet-4-20250514',
  systemPrompt: 'You are a file analysis assistant.',
  toolNames: ['read_files'],
}

const result = await adapter.executeAgent(
  agent,
  'Read package.json and tell me the version'
)

// Claude will:
// 1. Call read_files tool with paths: ['package.json']
// 2. Receive file contents
// 3. Analyze and respond
// 4. Return final answer
```

### HandleSteps Agent (Programmatic Control)

```typescript
const agent: AgentDefinition = {
  id: 'analyzer',
  displayName: 'Code Analyzer',
  model: 'claude-sonnet-4-20250514',
  toolNames: ['read_files', 'code_search'],

  *handleSteps(context) {
    // Read a file
    const { toolResult } = yield {
      toolName: 'read_files',
      input: { paths: ['src/main.ts'] },
    }

    // Ask Claude to analyze
    yield 'STEP'

    // Search for patterns
    yield {
      toolName: 'code_search',
      input: { pattern: 'TODO' },
    }

    // Ask Claude to summarize
    yield 'STEP_ALL' // Execute until complete
  },
}
```

## Testing

### Running Tests

```bash
# Set API key
export ANTHROPIC_API_KEY=sk-ant-...

# Build adapter
cd adapter
npm run build

# Run test suite
npx tsx examples/test-claude-integration.ts
```

### Test Coverage

The test suite (`examples/test-claude-integration.ts`) covers:

1. **Simple Conversation**: No tools, basic Q&A
2. **File Operations**: Single tool usage
3. **Multi-Tool Usage**: Multiple tools, autonomous selection
4. **HandleSteps**: Programmatic control flow

### Expected Output

```
=== Test 1: Simple Conversation ===
Response: { type: 'lastMessage', value: '2 + 2 = 4' }
Message count: 2
Execution time: 1523 ms

=== Test 2: File Operations ===
[ClaudeIntegration] Executing tool: read_files
Response: { type: 'lastMessage', value: 'Package name is "@codebuff/adapter"...' }
...

✅ All tests completed!
```

## Performance Considerations

### API Latency
- Average response time: 1-3 seconds
- Tool calls add ~500ms each
- Network latency varies by region

### Token Usage
- System prompt: ~100-500 tokens
- User message: ~50-200 tokens
- Tool definitions: ~100-300 tokens each
- Response: ~100-1000 tokens

### Optimization Tips

1. **Minimize Tool Count**: Only include tools the agent needs
2. **Concise System Prompts**: Clear but brief instructions
3. **Cache System Prompts**: Use Anthropic's prompt caching (future)
4. **Batch Operations**: Use `spawn_agents` for parallel work
5. **Set maxSteps**: Prevent runaway executions

## Debugging

### Enable Debug Logging

```typescript
const adapter = createDebugAdapter(process.cwd())
```

This will log:
- Agent execution start/end
- LLM invocations
- Tool executions
- Response parsing
- Error details

### Common Issues

**"ANTHROPIC_API_KEY not found"**
- Set environment variable: `export ANTHROPIC_API_KEY=sk-ant-...`

**"Tool execution failed"**
- Check tool input format
- Verify file paths are absolute
- Review tool logs

**"Timeout"**
- Increase timeout in integration config
- Check network connectivity
- Verify API key is valid

**"Rate limit exceeded"**
- Add delays between requests
- Use lower tier model
- Contact Anthropic for limit increase

## Future Enhancements

Potential improvements to the integration:

1. **Streaming Support**: Stream responses token-by-token
2. **Prompt Caching**: Cache system prompts for faster responses
3. **Retry Logic**: Automatic retries with exponential backoff
4. **Cost Tracking**: Track token usage and API costs
5. **Multi-Model Support**: Support multiple Claude models
6. **Tool Call Batching**: Execute multiple tool calls in parallel
7. **Response Validation**: Validate responses against schemas

## API Reference

### ClaudeIntegration

```typescript
class ClaudeIntegration {
  constructor(options: {
    apiKey?: string
    model?: string
    maxTokens?: number
    timeout?: number
    debug?: boolean
    logger?: (message: string, data?: any) => void
  })

  async invoke(
    params: ClaudeInvocationParams,
    toolExecutor: ToolExecutor
  ): Promise<string>
}
```

### Types

```typescript
interface ClaudeInvocationParams {
  systemPrompt: string
  messages: Message[]
  tools: string[]
  maxTokens?: number
  temperature?: number
  timeout?: number
}

interface ClaudeResponse {
  text: string
  toolCalls: Array<{
    id: string
    name: string
    input: any
  }>
  stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use'
}

type ToolExecutor = (toolCall: ToolCall) => Promise<ToolResultOutput[]>
```

## Contributing

When adding new tools:

1. Add tool definition to `getToolDefinition()` in `claude-integration.ts`
2. Implement tool handler in appropriate file (e.g., `tools/file-operations.ts`)
3. Add tool to dispatcher in `claude-cli-adapter.ts`
4. Update tests in `examples/test-claude-integration.ts`
5. Document in this file

## Support

For issues or questions:
- Check the [examples](./examples/) directory
- Review [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)
- Enable debug logging for detailed traces
- File an issue in the repository

## License

Same as the main Codebuff project.
