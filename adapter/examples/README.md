# Claude CLI Adapter Examples

This directory contains example scripts demonstrating the Claude Code CLI adapter functionality.

## Prerequisites

1. **Anthropic API Key**: You need a valid Anthropic API key
2. **Build the adapter**: Run `npm run build` in the adapter directory
3. **Install tsx** (for running TypeScript): `npm install -g tsx`

## Setting up your API key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## Running the Examples

### Test Claude Integration

The main integration test suite demonstrates all major features:

```bash
npm run build
npx tsx examples/test-claude-integration.ts
```

This will run 4 tests:
1. **Simple Conversation**: Basic LLM interaction without tools
2. **File Operations**: Using the `read_files` tool
3. **Multi-Tool Usage**: Combining `find_files`, `code_search`, and `run_terminal_command`
4. **HandleSteps Agent**: Programmatic control with generator functions

## Example Output

```
Claude Integration Test Suite
==============================

API Key found, running tests...

=== Test 1: Simple Conversation ===

[ClaudeCodeCLIAdapter] Starting agent execution: simple-test
[ClaudeCodeCLIAdapter] Executing in pure LLM mode
[ClaudeIntegration] Invoking Claude: {"systemPromptLength":32,"messageCount":1,"toolCount":0}
Response: { type: 'lastMessage', value: '2 + 2 = 4' }
Message count: 2
Execution time: 1523 ms

=== Test 2: File Operations ===

[ClaudeCodeCLIAdapter] Starting agent execution: file-test
[ClaudeIntegration] Invoking Claude: {"systemPromptLength":41,"messageCount":1,"toolCount":1}
[ClaudeIntegration] Executing tool: read_files
Response: { type: 'lastMessage', value: 'The package name is "@codebuff/adapter" and version is "1.0.0"' }
...
```

## What's Being Tested

### 1. Pure LLM Mode
- No tools
- Direct question-answer
- Tests basic Claude invocation

### 2. Single Tool Usage
- `read_files` tool
- Tests tool definition building
- Tests tool call execution
- Tests result formatting

### 3. Multiple Tools
- `find_files`, `code_search`, `run_terminal_command`
- Tests complex tool orchestration
- Tests Claude's autonomous tool selection

### 4. HandleSteps Generator
- Programmatic control flow
- Mix of tool calls and LLM steps
- Tests iteration tracking
- Tests output management

## Integration Architecture

The adapter uses the Anthropic SDK (@anthropic-ai/sdk) to communicate with Claude:

1. **ClaudeIntegration** (`src/claude-integration.ts`):
   - Handles API communication
   - Builds tool definitions from tool names
   - Manages conversation turns
   - Executes tool calls automatically

2. **ClaudeCodeCLIAdapter** (`src/claude-cli-adapter.ts`):
   - Orchestrates agent execution
   - Dispatches tool calls to implementations
   - Manages execution context
   - Handles both pure LLM and handleSteps modes

## Customizing the Examples

You can modify the test agents to:
- Try different models
- Add more tools
- Test different prompts
- Experiment with handleSteps logic

Example:

```typescript
const myAgent: AgentDefinition = {
  id: 'my-test',
  displayName: 'My Test Agent',
  model: 'claude-sonnet-4-20250514',
  systemPrompt: 'You are a specialized assistant for...',
  toolNames: ['read_files', 'write_file', 'code_search'],
}

const result = await adapter.executeAgent(myAgent, 'Your prompt here')
```

## Troubleshooting

### "ANTHROPIC_API_KEY not set"
Make sure you've exported the environment variable in your current shell session.

### "Module not found"
Run `npm run build` in the adapter directory first.

### "TypeScript errors"
Some pre-existing type errors in other files won't affect the Claude integration tests.

### "API rate limit"
If you hit rate limits, add delays between test runs or run tests individually.

## Next Steps

After confirming the integration works:
1. Register your own agents
2. Create custom tool combinations
3. Build complex multi-agent workflows
4. Integrate with your development workflow

See the main [INTEGRATION_GUIDE.md](../INTEGRATION_GUIDE.md) for more details.
