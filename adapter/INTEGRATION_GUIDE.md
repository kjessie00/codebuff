# Claude CLI Integration Guide

This guide explains how to integrate the Codebuff Claude CLI Adapter with actual Claude Code CLI to enable LLM-powered agent execution.

## Table of Contents

- [Overview](#overview)
- [Integration Architecture](#integration-architecture)
- [Implementation Options](#implementation-options)
- [Step-by-Step Integration](#step-by-step-integration)
- [Testing Strategies](#testing-strategies)
- [Performance Considerations](#performance-considerations)
- [Security Considerations](#security-considerations)

## Overview

The adapter currently has all tool implementations complete, but the LLM integration (the `invokeClaude` method in `ClaudeCodeCLIAdapter`) is a placeholder. This guide explains how to complete that integration.

### Current Status

**Completed:**
- All tool implementations (file operations, code search, terminal, spawn agents)
- HandleSteps executor with generator support
- Agent registration and execution framework
- State management and context tracking
- Error handling and logging

**Placeholder:**
- `invokeClaude()` method - needs actual Claude Code CLI integration

### What Needs Integration

The `invokeClaude` method in `/home/user/codebuff/adapter/src/claude-cli-adapter.ts` (lines 653-666) needs to be implemented to communicate with Claude Code CLI.

## Integration Architecture

### Current Placeholder

```typescript
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
```

### Integration Points

```typescript
interface ClaudeInvocationParams {
  systemPrompt: string    // Agent's system prompt
  messages: Message[]     // Conversation history
  tools: string[]         // Available tool names
}
```

The method should:
1. Send the system prompt, messages, and available tools to Claude
2. Receive Claude's response (text and/or tool calls)
3. Return the response as a string

## Implementation Options

### Option 1: Internal API (Recommended)

If Claude Code CLI exposes an internal TypeScript/JavaScript API, use it directly.

**Advantages:**
- Type safety
- Direct function calls
- Best performance
- Error handling integration

**Implementation:**

```typescript
import { ClaudeCLI } from '@anthropic/claude-cli' // hypothetical package

private async invokeClaude(
  params: ClaudeInvocationParams
): Promise<string> {
  try {
    // Initialize Claude CLI session
    const session = await ClaudeCLI.createSession({
      model: 'claude-sonnet-4.5',
      systemPrompt: params.systemPrompt,
      tools: this.buildToolDefinitions(params.tools)
    })

    // Send messages
    for (const message of params.messages) {
      await session.sendMessage(message.role, message.content)
    }

    // Get response
    const response = await session.getResponse()

    // Handle tool calls if any
    if (response.toolCalls) {
      // Process tool calls through our tool executor
      for (const toolCall of response.toolCalls) {
        const result = await this.executeToolCall(
          this.getCurrentContext(),
          toolCall
        )
        await session.sendToolResult(toolCall.id, result)
      }

      // Get final response after tool execution
      return await session.getResponse()
    }

    return response.text
  } catch (error) {
    this.log('Claude invocation failed', { error })
    throw error
  }
}

private buildToolDefinitions(toolNames: string[]): ToolDefinition[] {
  // Map Codebuff tool names to Claude CLI tool definitions
  return toolNames.map(name => {
    switch (name) {
      case 'read_files':
        return {
          name: 'read_files',
          description: 'Read multiple files from disk',
          input_schema: {
            type: 'object',
            properties: {
              paths: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of file paths to read'
              }
            },
            required: ['paths']
          }
        }
      // ... other tools
    }
  })
}
```

### Option 2: File-Based Communication

Use temporary files to communicate with Claude CLI.

**Advantages:**
- Simple implementation
- No dependencies on Claude CLI internals
- Easy debugging

**Disadvantages:**
- Slower (file I/O overhead)
- Requires polling or file watching
- More complex state management

**Implementation:**

```typescript
import { promises as fs } from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'

private async invokeClaude(
  params: ClaudeInvocationParams
): Promise<string> {
  const tempDir = path.join(this.config.cwd, '.claude-adapter-temp')
  await fs.mkdir(tempDir, { recursive: true })

  const requestFile = path.join(tempDir, `request-${Date.now()}.json`)
  const responseFile = path.join(tempDir, `response-${Date.now()}.json`)

  try {
    // Write request to file
    await fs.writeFile(requestFile, JSON.stringify({
      systemPrompt: params.systemPrompt,
      messages: params.messages,
      tools: params.tools,
      responseFile
    }))

    // Invoke Claude CLI with request file
    const claudeProcess = spawn('claude', [
      '--mode', 'agent',
      '--request-file', requestFile,
      '--response-file', responseFile
    ])

    // Wait for completion
    await new Promise((resolve, reject) => {
      claudeProcess.on('exit', (code) => {
        if (code === 0) resolve(null)
        else reject(new Error(`Claude CLI exited with code ${code}`))
      })
    })

    // Read response from file
    const responseData = await fs.readFile(responseFile, 'utf-8')
    const response = JSON.parse(responseData)

    return response.text
  } finally {
    // Cleanup temp files
    try {
      await fs.unlink(requestFile)
      await fs.unlink(responseFile)
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}
```

### Option 3: stdin/stdout Pipe

Communicate with Claude CLI via stdin/stdout.

**Advantages:**
- Real-time streaming
- No file I/O overhead
- Good for interactive sessions

**Disadvantages:**
- More complex implementation
- Requires careful stream handling
- Harder to debug

**Implementation:**

```typescript
import { spawn } from 'child_process'

private claudeProcess: ChildProcess | null = null

private async initializeClaudeProcess(): Promise<void> {
  if (this.claudeProcess) return

  this.claudeProcess = spawn('claude', [
    '--mode', 'agent',
    '--stdio'
  ])

  // Handle stdout
  this.claudeProcess.stdout?.on('data', (data) => {
    this.handleClaudeOutput(data.toString())
  })

  // Handle stderr
  this.claudeProcess.stderr?.on('data', (data) => {
    this.log('Claude stderr:', data.toString())
  })

  // Handle exit
  this.claudeProcess.on('exit', (code) => {
    this.log(`Claude process exited with code ${code}`)
    this.claudeProcess = null
  })
}

private async invokeClaude(
  params: ClaudeInvocationParams
): Promise<string> {
  await this.initializeClaudeProcess()

  if (!this.claudeProcess?.stdin) {
    throw new Error('Claude process not initialized')
  }

  return new Promise((resolve, reject) => {
    const requestId = `req-${Date.now()}`

    // Set up response handler
    this.pendingRequests.set(requestId, { resolve, reject })

    // Send request via stdin
    const request = JSON.stringify({
      id: requestId,
      type: 'invoke',
      systemPrompt: params.systemPrompt,
      messages: params.messages,
      tools: params.tools
    })

    this.claudeProcess.stdin.write(request + '\n')
  })
}

private handleClaudeOutput(data: string): void {
  try {
    const response = JSON.parse(data)
    const pending = this.pendingRequests.get(response.id)

    if (pending) {
      pending.resolve(response.text)
      this.pendingRequests.delete(response.id)
    }
  } catch (error) {
    this.log('Failed to parse Claude output', { error, data })
  }
}
```

### Option 4: HTTP API

If Claude CLI exposes an HTTP API:

**Implementation:**

```typescript
private async invokeClaude(
  params: ClaudeInvocationParams
): Promise<string> {
  const response = await fetch('http://localhost:8080/api/invoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      systemPrompt: params.systemPrompt,
      messages: params.messages,
      tools: params.tools
    })
  })

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.statusText}`)
  }

  const data = await response.json()
  return data.text
}
```

## Step-by-Step Integration

### Step 1: Choose Integration Method

Based on what Claude Code CLI provides:

1. Check Claude CLI documentation for API options
2. Test available integration methods
3. Choose the most appropriate option (recommend Option 1 if available)

### Step 2: Install Dependencies

```bash
cd adapter

# Option 1 - Internal API
npm install @anthropic/claude-cli  # If available

# Option 2/3 - File or pipe based
# No additional dependencies needed (use Node.js built-ins)

# Option 4 - HTTP API
# No additional dependencies needed (use fetch)
```

### Step 3: Implement invokeClaude Method

Replace the placeholder implementation in `src/claude-cli-adapter.ts`:

```typescript
// Before
private async invokeClaude(params: ClaudeInvocationParams): Promise<string> {
  // TODO: Implement
  return `[Placeholder]`
}

// After (example with internal API)
private async invokeClaude(params: ClaudeInvocationParams): Promise<string> {
  // Your implementation here based on chosen option
}
```

### Step 4: Handle Tool Calls

Claude's response may include tool calls. Handle them in the integration:

```typescript
private async invokeClaude(
  params: ClaudeInvocationParams
): Promise<string> {
  // ... send request to Claude

  // If response contains tool calls
  if (response.toolCalls && response.toolCalls.length > 0) {
    // Execute each tool call
    for (const toolCall of response.toolCalls) {
      const result = await this.executeToolCall(
        this.getCurrentContext(),
        {
          toolName: toolCall.name,
          input: toolCall.input
        }
      )

      // Send tool results back to Claude
      await this.sendToolResult(toolCall.id, result)
    }

    // Get next response after tools executed
    return await this.getNextResponse()
  }

  return response.text
}
```

### Step 5: Test Basic Integration

Create a simple test agent:

```typescript
import { createDebugAdapter } from './adapter/src'

const adapter = createDebugAdapter(process.cwd())

const testAgent = {
  id: 'test',
  displayName: 'Test Agent',
  model: 'claude-sonnet-4.5',
  toolNames: [],

  handleSteps: function* () {
    // Simple LLM call
    yield 'STEP'
  }
}

const result = await adapter.executeAgent(testAgent, 'Hello, Claude!')
console.log('Response:', result.output)
```

### Step 6: Test Tool Integration

Test with a tool-using agent:

```typescript
const fileAgent = {
  id: 'file-test',
  displayName: 'File Test',
  toolNames: ['read_files'],

  handleSteps: function* () {
    const { toolResult } = yield {
      toolName: 'read_files',
      input: { paths: ['package.json'] }
    }

    console.log('Files read:', toolResult)

    yield 'STEP'  // Ask Claude to analyze
  }
}

const result = await adapter.executeAgent(
  fileAgent,
  'Analyze the package.json file'
)
```

### Step 7: Test Sub-Agent Spawning

Test hierarchical execution:

```typescript
adapter.registerAgents([fileAgent, testAgent])

const orchestrator = {
  id: 'orchestrator',
  toolNames: ['spawn_agents'],

  handleSteps: function* () {
    const { toolResult } = yield {
      toolName: 'spawn_agents',
      input: {
        agents: [
          { agentId: 'test', prompt: 'Say hello' },
          { agentId: 'file-test', prompt: 'Read package.json' }
        ]
      }
    }

    console.log('Sub-agent results:', toolResult)
  }
}

const result = await adapter.executeAgent(orchestrator, 'Run all agents')
```

## Testing Strategies

### Unit Testing

Test the invokeClaude method in isolation:

```typescript
// tests/claude-integration.test.ts
import { ClaudeCodeCLIAdapter } from '../src/claude-cli-adapter'

describe('Claude Integration', () => {
  it('should invoke Claude and get response', async () => {
    const adapter = new ClaudeCodeCLIAdapter({
      cwd: process.cwd(),
      debug: true
    })

    // Mock or actual invocation
    const response = await adapter['invokeClaude']({
      systemPrompt: 'You are a helpful assistant',
      messages: [{ role: 'user', content: 'Hello' }],
      tools: []
    })

    expect(response).toBeTruthy()
    expect(typeof response).toBe('string')
  })

  it('should handle tool calls in response', async () => {
    // Test tool call handling
  })
})
```

### Integration Testing

Test end-to-end agent execution:

```typescript
// tests/agent-execution.test.ts
import { createAdapter } from '../src'

describe('Agent Execution', () => {
  it('should execute simple agent', async () => {
    const adapter = createAdapter(process.cwd())

    const agent = {
      id: 'test',
      toolNames: [],
      handleSteps: function* () {
        yield 'STEP'
      }
    }

    const result = await adapter.executeAgent(agent, 'Test prompt')

    expect(result.output).toBeDefined()
    expect(result.messageHistory.length).toBeGreaterThan(0)
  })

  it('should execute agent with tools', async () => {
    // Test with file operations
  })

  it('should execute agent with sub-agents', async () => {
    // Test spawn_agents
  })
})
```

### Manual Testing

Create a test script:

```typescript
// scripts/test-integration.ts
import { createDebugAdapter } from '../src'

async function main() {
  console.log('Testing Claude CLI Integration...\n')

  const adapter = createDebugAdapter(process.cwd())

  // Test 1: Simple prompt
  console.log('Test 1: Simple prompt')
  const simpleAgent = {
    id: 'simple',
    toolNames: [],
    handleSteps: function* () {
      yield 'STEP'
    }
  }

  const result1 = await adapter.executeAgent(
    simpleAgent,
    'What is 2+2?'
  )
  console.log('Response:', result1.output)

  // Test 2: With tools
  console.log('\nTest 2: With file operations')
  const fileAgent = {
    id: 'file-op',
    toolNames: ['read_files'],
    handleSteps: function* () {
      const { toolResult } = yield {
        toolName: 'read_files',
        input: { paths: ['package.json'] }
      }

      yield 'STEP'
    }
  }

  const result2 = await adapter.executeAgent(
    fileAgent,
    'Read and summarize package.json'
  )
  console.log('Response:', result2.output)

  console.log('\nAll tests completed!')
}

main().catch(console.error)
```

Run with:

```bash
npm run build
node dist/scripts/test-integration.js
```

## Performance Considerations

### Caching

Consider caching Claude sessions for better performance:

```typescript
private claudeSessions: Map<string, ClaudeSession> = new Map()

private async getOrCreateSession(agentId: string): Promise<ClaudeSession> {
  let session = this.claudeSessions.get(agentId)

  if (!session) {
    session = await ClaudeCLI.createSession({...})
    this.claudeSessions.set(agentId, session)
  }

  return session
}
```

### Connection Pooling

If using HTTP API, implement connection pooling:

```typescript
import { Agent as HttpAgent } from 'http'

private httpAgent = new HttpAgent({
  keepAlive: true,
  maxSockets: 10
})

private async invokeClaude(params: ClaudeInvocationParams): Promise<string> {
  const response = await fetch('...', {
    agent: this.httpAgent
  })
  // ...
}
```

### Streaming Responses

If Claude CLI supports streaming, implement it for better UX:

```typescript
private async invokeClaude(
  params: ClaudeInvocationParams
): Promise<string> {
  let fullResponse = ''

  const stream = await claudeCLI.streamResponse({
    systemPrompt: params.systemPrompt,
    messages: params.messages
  })

  for await (const chunk of stream) {
    fullResponse += chunk

    // Optionally: emit progress events
    this.emit('response-chunk', chunk)
  }

  return fullResponse
}
```

### Timeout Handling

Implement timeouts to prevent hanging:

```typescript
private async invokeClaude(
  params: ClaudeInvocationParams
): Promise<string> {
  const timeout = this.config.toolTimeout ?? 30000

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Claude invocation timeout')), timeout)
  })

  const invocationPromise = this.doInvokeClaude(params)

  return Promise.race([invocationPromise, timeoutPromise])
}
```

## Security Considerations

### Input Validation

Validate all inputs before sending to Claude:

```typescript
private async invokeClaude(
  params: ClaudeInvocationParams
): Promise<string> {
  // Validate system prompt length
  if (params.systemPrompt.length > 100000) {
    throw new Error('System prompt too long')
  }

  // Validate message count
  if (params.messages.length > 1000) {
    throw new Error('Too many messages')
  }

  // ... proceed with invocation
}
```

### Sanitize Tool Results

Sanitize tool results before sending to Claude:

```typescript
private sanitizeToolResult(result: ToolResultOutput[]): ToolResultOutput[] {
  return result.map(r => {
    if (r.type === 'json') {
      // Remove sensitive keys
      const sanitized = { ...r.value }
      delete sanitized.password
      delete sanitized.apiKey
      delete sanitized.secret
      return { ...r, value: sanitized }
    }
    return r
  })
}
```

### Rate Limiting

Implement rate limiting if needed:

```typescript
private requestCount = 0
private requestWindowStart = Date.now()
private readonly MAX_REQUESTS_PER_MINUTE = 60

private async checkRateLimit(): Promise<void> {
  const now = Date.now()
  const windowDuration = 60000 // 1 minute

  if (now - this.requestWindowStart > windowDuration) {
    this.requestCount = 0
    this.requestWindowStart = now
  }

  if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
    throw new Error('Rate limit exceeded')
  }

  this.requestCount++
}

private async invokeClaude(params: ClaudeInvocationParams): Promise<string> {
  await this.checkRateLimit()
  // ... proceed with invocation
}
```

## Next Steps

1. **Choose Integration Method**: Based on Claude CLI capabilities
2. **Implement invokeClaude**: Replace placeholder with actual implementation
3. **Test Thoroughly**: Use provided testing strategies
4. **Optimize**: Implement caching, pooling, streaming as needed
5. **Document**: Update this guide with actual implementation details

## Support

For questions or issues:

1. Check Claude Code CLI documentation
2. Review the adapter source code
3. Enable debug logging for detailed traces
4. Create an issue in the repository

## References

- [Claude Code CLI Documentation](https://docs.claude.com/en/docs/claude-code) (placeholder)
- [Adapter Architecture](./ARCHITECTURE.md)
- [Tool Reference](./docs/TOOL_REFERENCE.md)
- [API Reference](./docs/API_REFERENCE.md)
