# FREE Mode FAQ

Comprehensive frequently asked questions for the Claude Code CLI Adapter in FREE mode.

## Table of Contents

- [Getting Started](#getting-started)
- [Usage](#usage)
- [Tools](#tools)
- [Performance](#performance)
- [Comparison](#comparison)
- [Troubleshooting](#troubleshooting)
- [Advanced](#advanced)
- [Limitations](#limitations)
- [Migration](#migration)

## Getting Started

### Q: Do I need an API key for FREE mode?

**A:** No! That's the whole point of FREE mode. You can use the adapter without any API key, making it completely free to use.

```typescript
// FREE mode - no API key needed
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd()
  // That's it! No API key required
})
```

FREE mode includes all the essential tools:
- File operations (`read_files`, `write_file`, `str_replace`)
- Code search (`code_search`, `find_files`)
- Terminal commands (`run_terminal_command`)
- Output control (`set_output`)

The only tool that requires PAID mode is `spawn_agents` for multi-agent orchestration.

### Q: How much does FREE mode cost?

**A:** $0.00. Completely free. Zero cost. Nada. Zilch.

There are no hidden fees, no usage limits, no credit card required. Everything runs locally on your machine, so there are no API costs.

The only "cost" is your local compute resources (CPU, memory, disk).

### Q: What can I do in FREE mode?

**A:** You can:

**File Operations:**
- Read multiple files in parallel
- Write new files (with automatic directory creation)
- Replace strings in existing files
- Handle UTF-8 content correctly

**Code Search:**
- Search code with ripgrep (super fast)
- Find files with glob patterns
- Filter by file type
- Case-sensitive/insensitive search

**Terminal:**
- Run shell commands
- Set timeouts
- Capture stdout/stderr
- Check exit codes
- Pass environment variables

**Agent Control:**
- Define agents with `handleSteps` generators
- Execute step-by-step workflows
- Set output values
- Track execution state

**Examples:**
```typescript
// File analysis agent
const analyzer: AgentDefinition = {
  id: 'analyzer',
  toolNames: ['find_files', 'read_files', 'code_search', 'set_output'],
  handleSteps: function* () {
    // Find TypeScript files
    const { toolResult: findResult } = yield {
      toolName: 'find_files',
      input: { pattern: '**/*.ts' }
    }

    // Search for TODOs
    const { toolResult: searchResult } = yield {
      toolName: 'code_search',
      input: { query: 'TODO', file_pattern: '*.ts' }
    }

    // Generate report
    yield {
      toolName: 'write_file',
      input: {
        path: 'analysis-report.md',
        content: `Found ${findResult[0].value.length} files with ${searchResult[0].value.results.length} TODOs`
      }
    }

    yield {
      toolName: 'set_output',
      input: { output: 'Report generated' }
    }
  }
}
```

### Q: What can't I do in FREE mode?

**A:** The main limitation is **multi-agent orchestration**:

- ❌ Can't use `spawn_agents` to create sub-agents
- ❌ Can't run agents in parallel
- ❌ Can't create hierarchical agent workflows

**Workarounds:**
1. Execute agents sequentially yourself
2. Use direct tool calls instead of sub-agents
3. Upgrade to PAID mode ($3-15 per 1M tokens)

**Example workaround:**
```typescript
// Instead of spawn_agents (PAID mode only)
yield {
  toolName: 'spawn_agents',
  input: {
    agents: [
      { agent_type: 'finder', params: {...} },
      { agent_type: 'analyzer', params: {...} }
    ]
  }
}

// Use sequential execution (FREE mode)
const findResult = await adapter.executeAgent(finderAgent, 'Find files')
const analyzeResult = await adapter.executeAgent(analyzerAgent, 'Analyze', {
  files: findResult.output
})
```

### Q: How do I install FREE mode?

**A:** Installation steps:

```bash
# 1. Navigate to adapter directory
cd adapter

# 2. Install dependencies
npm install
# or
bun install

# 3. Build the adapter
npm run build

# 4. Verify installation
npm run type-check
```

**Verify it works:**
```typescript
import { createDebugAdapter } from './adapter/src'

const adapter = createDebugAdapter(process.cwd())
console.log('✓ Adapter created successfully')
```

### Q: What are the system requirements?

**A:** Requirements:

**Mandatory:**
- Node.js 18.0.0 or higher
- TypeScript 5.6.0 or higher
- 100MB free disk space

**Optional but Recommended:**
- ripgrep for code search (`brew install ripgrep`)
- Git (for version control)

**Platform Support:**
- ✅ macOS (Intel and Apple Silicon)
- ✅ Linux (Ubuntu, Debian, Fedora, Arch)
- ✅ Windows 10/11

**Check your versions:**
```bash
node --version  # Should be >= 18.0.0
npm --version
rg --version    # ripgrep (optional)
```

### Q: How do I get started with my first agent?

**A:** Complete example:

```typescript
import { createAdapter } from '@codebuff/adapter'
import type { AgentDefinition } from '../.agents/types/agent-definition'

// Step 1: Create adapter
const adapter = createAdapter(process.cwd())

// Step 2: Define your first agent
const helloWorldAgent: AgentDefinition = {
  id: 'hello-world',
  displayName: 'Hello World Agent',
  toolNames: ['write_file', 'set_output'],

  handleSteps: function* () {
    // Write a file
    yield {
      toolName: 'write_file',
      input: {
        path: 'hello.txt',
        content: 'Hello from FREE mode!'
      }
    }

    // Set output
    yield {
      toolName: 'set_output',
      input: { output: 'File created successfully!' }
    }
  }
}

// Step 3: Register agent
adapter.registerAgent(helloWorldAgent)

// Step 4: Execute agent
async function main() {
  const result = await adapter.executeAgent(
    helloWorldAgent,
    'Create hello.txt'
  )

  console.log('Result:', result.output)
}

main()
```

Run it:
```bash
npx tsx your-script.ts
```

## Usage

### Q: How do I create an adapter?

**A:** Multiple ways:

**Basic:**
```typescript
import { ClaudeCodeCLIAdapter } from '@codebuff/adapter'

const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd()
})
```

**With options:**
```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: '/path/to/project',
  maxSteps: 50,          // Max steps per agent (default: 20)
  debug: true,           // Enable debug logging
  logger: console.log    // Custom logger
})
```

**Using factory functions:**
```typescript
import { createAdapter, createDebugAdapter } from '@codebuff/adapter'

// Basic adapter
const adapter = createAdapter('/path/to/project')

// With debug enabled
const debugAdapter = createDebugAdapter('/path/to/project')
```

### Q: How do I run an agent?

**A:** Three steps:

```typescript
// 1. Create adapter
const adapter = createAdapter(process.cwd())

// 2. Register agent
adapter.registerAgent(myAgent)

// 3. Execute agent
const result = await adapter.executeAgent(
  myAgent,              // Agent definition
  'Your prompt here',   // Prompt/instructions
  { key: 'value' }      // Optional parameters
)

// Access results
console.log('Output:', result.output)
console.log('Steps:', result.metadata?.iterationCount)
console.log('Success:', result.metadata?.completedNormally)
```

**With error handling:**
```typescript
try {
  const result = await adapter.executeAgent(myAgent, 'Do task')
  console.log('Success:', result.output)
} catch (error) {
  console.error('Failed:', error.message)

  // Handle specific errors
  if (error instanceof ToolExecutionError) {
    console.error('Tool failed:', error.toolName)
  }
}
```

### Q: Can I use my own agents?

**A:** Yes! Any agent that follows the `AgentDefinition` type:

```typescript
import type { AgentDefinition } from '../.agents/types/agent-definition'

const myCustomAgent: AgentDefinition = {
  // Required fields
  id: 'my-custom-agent',           // Unique identifier
  displayName: 'My Custom Agent',  // Human-readable name
  toolNames: [                     // Tools this agent uses
    'read_files',
    'write_file',
    'set_output'
  ],

  // Optional fields
  model: 'anthropic/claude-sonnet-4.5',  // Model (not used in FREE mode)
  systemPrompt: 'You are a helpful agent',

  // Define behavior with handleSteps
  handleSteps: function* ({ agentState, prompt, params }) {
    // Your agent logic here
    const { toolResult } = yield {
      toolName: 'read_files',
      input: { paths: ['config.json'] }
    }

    yield {
      toolName: 'set_output',
      input: { output: toolResult[0].value }
    }
  }
}

// Register and use it
adapter.registerAgent(myCustomAgent)
```

**Import from files:**
```typescript
// agents/my-agent.ts
export const myAgent: AgentDefinition = { /* ... */ }

// main.ts
import { myAgent } from './agents/my-agent'

adapter.registerAgent(myAgent)
```

### Q: How do I handle errors?

**A:** Multiple patterns:

**Pattern 1: Try/Catch in handleSteps**
```typescript
handleSteps: function* () {
  try {
    const { toolResult } = yield {
      toolName: 'read_files',
      input: { paths: ['config.json'] }
    }

    // Process result
    const config = JSON.parse(toolResult[0].value['config.json'])

    yield {
      toolName: 'set_output',
      input: { output: config }
    }
  } catch (error) {
    // Handle error
    yield {
      toolName: 'set_output',
      input: {
        output: {
          error: true,
          message: error.message
        }
      }
    }
  }
}
```

**Pattern 2: Check Tool Results**
```typescript
handleSteps: function* () {
  const { toolResult } = yield {
    toolName: 'read_files',
    input: { paths: ['config.json'] }
  }

  const files = toolResult[0].value

  // Check if file was found
  if (files['config.json'] === null) {
    yield {
      toolName: 'set_output',
      input: { output: 'Error: config.json not found' }
    }
    return
  }

  // File exists, continue processing
  const config = JSON.parse(files['config.json'])

  yield {
    toolName: 'set_output',
    input: { output: config }
  }
}
```

**Pattern 3: Try/Catch at Execution**
```typescript
try {
  const result = await adapter.executeAgent(myAgent, 'Process config')
  console.log('Success:', result.output)
} catch (error) {
  if (error instanceof ToolExecutionError) {
    console.error('Tool failed:', error.toolName, error.message)
  } else if (error instanceof ValidationError) {
    console.error('Invalid input:', error.field, error.reason)
  } else {
    console.error('Unknown error:', error)
  }
}
```

### Q: What is handleSteps and how do I use it?

**A:** `handleSteps` is a generator function that defines your agent's behavior step-by-step.

**Basic structure:**
```typescript
handleSteps: function* ({ agentState, prompt, params, logger }) {
  // Step 1: Yield a tool call
  const { toolResult } = yield {
    toolName: 'find_files',
    input: { pattern: '*.ts' }
  }

  // Step 2: Process the result
  const files = toolResult[0].value

  // Step 3: Yield another tool call
  yield {
    toolName: 'set_output',
    input: { output: files }
  }
}
```

**Key concepts:**

1. **Generator Function**: Uses `function*` syntax
2. **Yield**: Pauses execution and returns control to adapter
3. **Tool Calls**: Each `yield` executes a tool
4. **Results**: Get results from previous tool call via `toolResult`

**Available parameters:**
- `agentState`: Persistent state across steps
- `prompt`: The prompt passed to executeAgent
- `params`: Additional parameters passed to executeAgent
- `logger`: Logging utilities

**Example with all features:**
```typescript
handleSteps: function* ({ agentState, prompt, params, logger }) {
  logger.info('Agent starting', { prompt, params })

  // Initialize state
  if (!agentState.initialized) {
    agentState.initialized = true
    agentState.count = 0
  }

  // Use params
  const pattern = params.pattern || '*.ts'

  // Execute tool
  const { toolResult } = yield {
    toolName: 'find_files',
    input: { pattern }
  }

  // Update state
  agentState.count++

  // Log result
  logger.info('Found files', { count: toolResult[0].value.length })

  // Set output
  yield {
    toolName: 'set_output',
    input: {
      output: {
        files: toolResult[0].value,
        executionCount: agentState.count
      }
    }
  }
}
```

### Q: Can I pass parameters to agents?

**A:** Yes! Use the third argument to `executeAgent`:

```typescript
// Define agent that uses parameters
const fileReaderAgent: AgentDefinition = {
  id: 'file-reader',
  displayName: 'File Reader',
  toolNames: ['read_files', 'set_output'],

  handleSteps: function* ({ params }) {
    // Access parameters
    const filesToRead = params.files || ['package.json']

    const { toolResult } = yield {
      toolName: 'read_files',
      input: { paths: filesToRead }
    }

    yield {
      toolName: 'set_output',
      input: { output: toolResult[0].value }
    }
  }
}

// Execute with parameters
const result = await adapter.executeAgent(
  fileReaderAgent,
  'Read files',
  {
    files: ['config.json', 'package.json', 'tsconfig.json']
  }
)
```

**TypeScript typing:**
```typescript
interface MyAgentParams {
  pattern: string
  maxResults?: number
}

const myAgent: AgentDefinition = {
  id: 'my-agent',
  toolNames: ['find_files', 'set_output'],

  handleSteps: function* ({ params }: { params: MyAgentParams }) {
    // params is now typed!
    const { toolResult } = yield {
      toolName: 'find_files',
      input: { pattern: params.pattern }
    }

    const files = toolResult[0].value.slice(0, params.maxResults || 10)

    yield {
      toolName: 'set_output',
      input: { output: files }
    }
  }
}
```

## Tools

### Q: Which tools are available in FREE mode?

**A:** All core tools except `spawn_agents`:

**File Operations:**
- `read_files` - Read multiple files in parallel
- `write_file` - Write content to a file
- `str_replace` - Replace strings in files

**Code Search:**
- `code_search` - Search code with ripgrep
- `find_files` - Find files with glob patterns

**Terminal:**
- `run_terminal_command` - Execute shell commands

**Control:**
- `set_output` - Set agent output (required!)

**Not Available in FREE Mode:**
- `spawn_agents` - Multi-agent orchestration (requires PAID mode)

See [TOOL_REFERENCE.md](./TOOL_REFERENCE.md) for complete tool documentation.

### Q: Why can't I use spawn_agents?

**A:** `spawn_agents` requires the Anthropic API to orchestrate multiple agents, which requires an API key and costs money.

**Why this limitation exists:**
- Multi-agent execution needs LLM intelligence to coordinate
- API costs money ($3-15 per 1M tokens)
- FREE mode is designed to be $0 cost

**Alternatives in FREE mode:**

1. **Execute agents sequentially:**
```typescript
const result1 = await adapter.executeAgent(agent1, 'Task 1')
const result2 = await adapter.executeAgent(agent2, 'Task 2', {
  inputFromAgent1: result1.output
})
```

2. **Use direct tool calls:**
```typescript
// Instead of spawning sub-agents
handleSteps: function* () {
  // Do the work directly
  const { toolResult: findResult } = yield {
    toolName: 'find_files',
    input: { pattern: '*.ts' }
  }

  const { toolResult: searchResult } = yield {
    toolName: 'code_search',
    input: { query: 'TODO' }
  }

  // Combine results
  yield {
    toolName: 'set_output',
    input: {
      output: {
        files: findResult[0].value,
        todos: searchResult[0].value
      }
    }
  }
}
```

3. **Upgrade to PAID mode:**
```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY
})

// Now spawn_agents works!
```

### Q: Can I add custom tools?

**A:** Not directly, but you can work around it:

**Option 1: Use run_terminal_command**
```typescript
// Create a custom script
yield {
  toolName: 'write_file',
  input: {
    path: 'scripts/my-custom-tool.sh',
    content: `#!/bin/bash
# Your custom logic here
echo "Custom tool result"
`
  }
}

// Execute it
yield {
  toolName: 'run_terminal_command',
  input: {
    command: 'bash scripts/my-custom-tool.sh'
  }
}
```

**Option 2: Wrap existing tools**
```typescript
// Create helper function
async function myCustomTool(adapter, input) {
  // Use multiple existing tools
  const findResult = await adapter.executeAgent({
    id: 'helper',
    toolNames: ['find_files', 'read_files', 'set_output'],
    handleSteps: function* () {
      const { toolResult: findResult } = yield {
        toolName: 'find_files',
        input: { pattern: input.pattern }
      }

      const { toolResult: readResult } = yield {
        toolName: 'read_files',
        input: { paths: findResult[0].value }
      }

      yield {
        toolName: 'set_output',
        input: { output: readResult[0].value }
      }
    }
  }, 'Custom tool')

  return findResult.output
}

// Use your custom tool
const result = await myCustomTool(adapter, { pattern: '*.ts' })
```

**Option 3: Extend the adapter (advanced)**
```typescript
// Extend the adapter class (requires modifying source)
class ExtendedAdapter extends ClaudeCodeCLIAdapter {
  async myCustomTool(input: MyInput) {
    // Your custom implementation
  }

  async executeTool(toolName: string, input: any) {
    if (toolName === 'my_custom_tool') {
      return await this.myCustomTool(input)
    }
    return super.executeTool(toolName, input)
  }
}
```

### Q: How do I search for code?

**A:** Use `code_search` with ripgrep:

**Basic search:**
```typescript
const { toolResult } = yield {
  toolName: 'code_search',
  input: {
    query: 'function handleSteps'
  }
}

const results = toolResult[0].value
console.log('Found matches:', results.results.length)
```

**Advanced search:**
```typescript
const { toolResult } = yield {
  toolName: 'code_search',
  input: {
    query: 'TODO|FIXME',        // Regex pattern
    file_pattern: '*.ts',        // Only TypeScript files
    case_sensitive: false,       // Case-insensitive
    maxResults: 50               // Limit results
  }
}

// Process results
const results = toolResult[0].value
for (const match of results.results) {
  console.log(`${match.path}:${match.line_number}: ${match.line}`)
}
```

**Common patterns:**
```typescript
// Find all imports
query: '^import '

// Find function definitions
query: 'function \\w+\\('

// Find TODO/FIXME comments
query: 'TODO|FIXME'

// Find console.log statements
query: 'console\\.log'

// Find error handling
query: 'try\\s*\\{'
```

**Note:** Requires ripgrep installed: `brew install ripgrep`

### Q: How do I find files?

**A:** Use `find_files` with glob patterns:

**Simple patterns:**
```typescript
// All TypeScript files
const { toolResult } = yield {
  toolName: 'find_files',
  input: { pattern: '**/*.ts' }
}

// All JSON files in config directory
const { toolResult } = yield {
  toolName: 'find_files',
  input: { pattern: 'config/*.json' }
}

// All test files
const { toolResult } = yield {
  toolName: 'find_files',
  input: { pattern: '**/*.test.{ts,js}' }
}
```

**Advanced patterns:**
```typescript
// Multiple file types
pattern: '**/*.{ts,js,json}'

// Exclude directories
pattern: 'src/**/*.ts' // Only in src

// Specific depth
pattern: '*/*.ts'  // Only one level deep

// Hidden files
pattern: '.*'  // Files starting with .

// Everything
pattern: '**/*'  // All files
```

**Glob syntax:**
- `*` - Matches any characters except /
- `**` - Matches any characters including /
- `?` - Matches single character
- `[abc]` - Matches a, b, or c
- `{a,b}` - Matches a or b

### Q: How do I run terminal commands?

**A:** Use `run_terminal_command`:

**Basic:**
```typescript
const { toolResult } = yield {
  toolName: 'run_terminal_command',
  input: {
    command: 'npm test'
  }
}

const result = toolResult[0].value
console.log('Exit code:', result.exitCode)
console.log('Output:', result.stdout)
console.log('Errors:', result.stderr)
```

**With options:**
```typescript
const { toolResult } = yield {
  toolName: 'run_terminal_command',
  input: {
    command: 'npm run build',
    timeout_seconds: 300,        // 5 minute timeout
    cwd: 'packages/frontend',    // Working directory
    env: {                       // Environment variables
      NODE_ENV: 'production',
      API_URL: 'https://api.example.com'
    }
  }
}
```

**Check for success:**
```typescript
const { toolResult } = yield {
  toolName: 'run_terminal_command',
  input: { command: 'npm test' }
}

const result = toolResult[0].value

if (result.exitCode !== 0) {
  // Command failed
  console.error('Tests failed!')
  console.error('Error output:', result.stderr)

  yield {
    toolName: 'set_output',
    input: { output: { success: false, error: result.stderr } }
  }
  return
}

// Command succeeded
console.log('Tests passed!')
yield {
  toolName: 'set_output',
  input: { output: { success: true, output: result.stdout } }
}
```

## Performance

### Q: How fast is FREE mode?

**A:** Performance characteristics:

**File Operations:**
- Single file read: ~1-5ms
- 10 files in parallel: ~10-20ms
- 100 files in parallel: ~50-100ms
- Write file: ~5-10ms
- String replace: ~10-20ms

**Code Search:**
- Small project (<100 files): ~50-200ms
- Medium project (100-1000 files): ~200-500ms
- Large project (>1000 files): ~500-2000ms

**Terminal Commands:**
- Fast commands (ls, echo): ~50-100ms
- Medium commands (npm test): ~1-10s
- Slow commands (npm install): ~10-60s

**Agent Execution:**
- Simple agent (2-3 tools): ~100-500ms
- Medium agent (5-10 tools): ~500-2000ms
- Complex agent (>10 tools): ~2-10s

**Bottlenecks:**
- Terminal commands (slowest)
- Code search on large codebases
- Reading many large files

**Tips for best performance:**
- Use parallel file reads (automatic)
- Limit search results with `maxResults`
- Use specific file patterns
- Increase timeouts for slow commands

### Q: Can I make it faster?

**A:** Optimization tips:

**1. Use Parallel Operations**
```typescript
// ✅ Good: Parallel reads (automatic)
const { toolResult } = yield {
  toolName: 'read_files',
  input: { paths: ['file1.ts', 'file2.ts', 'file3.ts'] }
}

// ❌ Bad: Sequential reads
for (const file of files) {
  const { toolResult } = yield {
    toolName: 'read_files',
    input: { paths: [file] }
  }
}
```

**2. Limit Search Results**
```typescript
// Faster: Limit results
const { toolResult } = yield {
  toolName: 'code_search',
  input: {
    query: 'TODO',
    maxResults: 50 // Stop after 50 matches
  }
}
```

**3. Use Specific Patterns**
```typescript
// ❌ Slow: Search everything
pattern: '**/*'

// ✅ Fast: Be specific
pattern: 'src/**/*.ts'
```

**4. Cache Results**
```typescript
handleSteps: function* ({ agentState }) {
  // Check cache
  if (agentState.cachedFiles) {
    yield {
      toolName: 'set_output',
      input: { output: agentState.cachedFiles }
    }
    return
  }

  // Load and cache
  const { toolResult } = yield {
    toolName: 'read_files',
    input: { paths: ['large-file.json'] }
  }

  agentState.cachedFiles = toolResult[0].value

  yield {
    toolName: 'set_output',
    input: { output: agentState.cachedFiles }
  }
}
```

**5. Increase maxSteps for Complex Agents**
```typescript
// More steps = fewer iterations
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  maxSteps: 50 // Default is 20
})
```

### Q: Does it support parallel operations?

**A:** Yes and no:

**✅ Parallel (automatic):**
- Reading multiple files with `read_files`
- All file operations use `Promise.all` internally

**❌ Not Parallel:**
- Agent execution (one agent at a time)
- Tool calls within an agent (sequential)
- Terminal commands

**Example:**
```typescript
// This reads all files in parallel
const { toolResult } = yield {
  toolName: 'read_files',
  input: {
    paths: ['file1.ts', 'file2.ts', 'file3.ts', 'file4.ts', 'file5.ts']
  }
}
// All 5 files read simultaneously!

// But these tool calls are sequential
const { toolResult: findResult } = yield { /* ... */ }  // Step 1
const { toolResult: readResult } = yield { /* ... */ }  // Step 2 (waits for step 1)
const { toolResult: searchResult } = yield { /* ... */ } // Step 3 (waits for step 2)
```

**Parallel agents (requires PAID mode):**
```typescript
// FREE mode: Sequential
const result1 = await adapter.executeAgent(agent1, 'Task 1')
const result2 = await adapter.executeAgent(agent2, 'Task 2')
const result3 = await adapter.executeAgent(agent3, 'Task 3')

// PAID mode: Parallel with spawn_agents
yield {
  toolName: 'spawn_agents',
  input: {
    agents: [
      { agent_type: 'agent1', prompt: 'Task 1' },
      { agent_type: 'agent2', prompt: 'Task 2' },
      { agent_type: 'agent3', prompt: 'Task 3' }
    ]
  }
}
```

## Comparison

### Q: FREE mode vs PAID mode - which should I use?

**A:** Decision guide:

**Use FREE Mode If:**
- ✅ You need file operations
- ✅ You need code search
- ✅ You need terminal commands
- ✅ Single agent execution is sufficient
- ✅ You want zero cost
- ✅ You prefer local processing
- ✅ You don't need multi-agent orchestration

**Use PAID Mode If:**
- ✅ You need multi-agent orchestration
- ✅ You need parallel agent execution
- ✅ You need hierarchical agent workflows
- ✅ You're okay with API costs ($3-15/1M tokens)
- ✅ You trust Anthropic's API with your code

**Comparison Table:**

| Feature | FREE Mode | PAID Mode |
|---------|-----------|-----------|
| Cost | $0.00 | $3-15/1M tokens |
| File operations | ✅ | ✅ |
| Code search | ✅ | ✅ |
| Terminal commands | ✅ | ✅ |
| spawn_agents | ❌ | ✅ |
| Multi-agent workflows | ❌ | ✅ |
| Parallel agents | ❌ | ✅ |
| API required | ❌ | ✅ |
| Local processing | ✅ | Partial |
| Privacy | 100% local | Data sent to API |

**Example costs (PAID mode):**
- Small project analysis: $0.10-0.50
- Medium project refactoring: $1.00-3.00
- Large codebase migration: $5.00-15.00

### Q: Can I switch from FREE to PAID?

**A:** Yes! Just add an API key:

```typescript
// FREE mode
const freeAdapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd()
})

// PAID mode - add API key
const paidAdapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY // Enable PAID mode
})

// Everything else stays the same!
```

**No code changes needed** - your agents work in both modes. The only difference is `spawn_agents` becomes available in PAID mode.

**Migration steps:**
1. Get API key from https://console.anthropic.com
2. Set environment variable: `export ANTHROPIC_API_KEY="sk-ant-..."`
3. Add to adapter config
4. (Optional) Start using `spawn_agents`

### Q: Can I use both modes?

**A:** Yes! Create two adapters:

```typescript
// FREE mode for simple operations
const freeAdapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd()
})

// PAID mode for complex orchestration
const paidAdapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY
})

// Use appropriate adapter for each task
async function analyzeCode() {
  // Simple file analysis - FREE mode
  const files = await freeAdapter.executeAgent(fileFinderAgent, 'Find files')

  // Complex orchestration - PAID mode
  const analysis = await paidAdapter.executeAgent(orchestratorAgent, 'Analyze', {
    files: files.output
  })

  return analysis
}
```

**Cost optimization:**
```typescript
// Use FREE mode for most operations
const files = await freeAdapter.executeAgent(findFiles, 'Find')
const content = await freeAdapter.executeAgent(readFiles, 'Read', { files })

// Only use PAID mode when you need spawn_agents
const analysis = await paidAdapter.executeAgent(orchestrator, 'Analyze', { content })
```

## Troubleshooting

### Q: My agent isn't working, what do I do?

**A:** Debugging checklist:

**1. Enable Debug Mode**
```typescript
const adapter = createDebugAdapter(process.cwd())
```

**2. Check Agent Definition**
```typescript
// Verify required fields
console.log('Agent ID:', myAgent.id)
console.log('Tool names:', myAgent.toolNames)
console.log('Has handleSteps:', !!myAgent.handleSteps)
```

**3. Verify Agent is Registered**
```typescript
const registeredAgents = adapter.listAgents()
console.log('Registered agents:', registeredAgents)

if (!registeredAgents.includes(myAgent.id)) {
  console.error('Agent not registered!')
  adapter.registerAgent(myAgent)
}
```

**4. Check for Errors**
```typescript
try {
  const result = await adapter.executeAgent(myAgent, 'Test')
  console.log('Success:', result.output)
} catch (error) {
  console.error('Error type:', error.constructor.name)
  console.error('Error message:', error.message)
  console.error('Error details:', error)

  // Check error type
  if (error instanceof ToolExecutionError) {
    console.error('Tool failed:', error.toolName)
    console.error('Tool input:', error.toolInput)
  }
}
```

**5. Test with Simple Agent**
```typescript
// Minimal test agent
const testAgent: AgentDefinition = {
  id: 'test',
  displayName: 'Test',
  toolNames: ['set_output'],
  handleSteps: function* () {
    yield {
      toolName: 'set_output',
      input: { output: 'Hello!' }
    }
  }
}

adapter.registerAgent(testAgent)
const result = await adapter.executeAgent(testAgent, 'Test')
console.log('Test result:', result.output) // Should print "Hello!"
```

If this works, the problem is in your agent logic. If this fails, there's an issue with your adapter setup.

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for comprehensive troubleshooting guide.

### Q: How do I enable debug mode?

**A:** Three ways:

**Option 1: createDebugAdapter**
```typescript
import { createDebugAdapter } from '@codebuff/adapter'

const adapter = createDebugAdapter(process.cwd())
// Debug automatically enabled
```

**Option 2: debug config option**
```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  debug: true
})
```

**Option 3: Custom logger**
```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  debug: true,
  logger: (msg) => {
    // Custom logging format
    console.log(`[${new Date().toISOString()}] ${msg}`)

    // Or log to file
    fs.appendFileSync('adapter.log', msg + '\n')
  }
})
```

**Debug output includes:**
- Agent execution start/end
- Tool calls and parameters
- Tool results
- Context state changes
- Error details

### Q: Where are the logs?

**A:** Logs go to console by default:

```typescript
// Console output (default)
const adapter = createDebugAdapter(process.cwd())
```

**Custom log destination:**
```typescript
import fs from 'fs'

const logFile = 'adapter-debug.log'

const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  debug: true,
  logger: (msg) => {
    // Write to file
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`)

    // Also console
    console.log(msg)
  }
})

// Logs written to adapter-debug.log
```

**Structured logging:**
```typescript
import winston from 'winston'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'adapter.log' })
  ]
})

const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  debug: true,
  logger: (msg) => logger.info(msg)
})
```

## Advanced

### Q: Can I create multi-step agents in FREE mode?

**A:** Yes! That's what `handleSteps` is for:

```typescript
const multiStepAgent: AgentDefinition = {
  id: 'multi-step',
  displayName: 'Multi-Step Agent',
  toolNames: [
    'find_files',
    'read_files',
    'code_search',
    'write_file',
    'set_output'
  ],

  handleSteps: function* () {
    // Step 1: Find TypeScript files
    console.log('Step 1: Finding files...')
    const { toolResult: findResult } = yield {
      toolName: 'find_files',
      input: { pattern: '**/*.ts' }
    }

    const files = findResult[0].value
    console.log(`Found ${files.length} files`)

    // Step 2: Read the files
    console.log('Step 2: Reading files...')
    const { toolResult: readResult } = yield {
      toolName: 'read_files',
      input: { paths: files }
    }

    // Step 3: Search for TODOs
    console.log('Step 3: Searching for TODOs...')
    const { toolResult: searchResult } = yield {
      toolName: 'code_search',
      input: {
        query: 'TODO',
        file_pattern: '*.ts'
      }
    }

    const todos = searchResult[0].value.results

    // Step 4: Generate report
    console.log('Step 4: Generating report...')
    const report = `# Code Analysis Report

## Summary
- Total files: ${files.length}
- TODOs found: ${todos.length}

## TODOs
${todos.map(t => `- ${t.path}:${t.line_number}: ${t.line.trim()}`).join('\n')}
`

    // Step 5: Write report
    console.log('Step 5: Writing report...')
    yield {
      toolName: 'write_file',
      input: {
        path: 'analysis-report.md',
        content: report
      }
    }

    // Step 6: Set output
    console.log('Step 6: Done!')
    yield {
      toolName: 'set_output',
      input: {
        output: {
          files: files.length,
          todos: todos.length,
          report: 'analysis-report.md'
        }
      }
    }
  }
}
```

**No limit on steps** (except maxSteps configuration).

### Q: How do I test my agents?

**A:** Multiple testing approaches:

**Unit Testing:**
```typescript
import { describe, test, expect } from 'bun:test'

describe('MyAgent', () => {
  let adapter: ClaudeCodeCLIAdapter

  beforeEach(() => {
    adapter = createAdapter('/tmp/test')
  })

  test('should find TypeScript files', async () => {
    adapter.registerAgent(myAgent)
    const result = await adapter.executeAgent(myAgent, 'Find files')

    expect(result.output).toBeDefined()
    expect(result.metadata?.completedNormally).toBe(true)
  })

  test('should handle missing files', async () => {
    adapter.registerAgent(myAgent)
    const result = await adapter.executeAgent(myAgent, 'Read missing.txt')

    expect(result.output).toContain('not found')
  })
})
```

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for comprehensive testing guide.

### Q: Can I use TypeScript?

**A:** Yes! Full TypeScript support:

```typescript
import type { AgentDefinition } from '../.agents/types/agent-definition'

interface MyAgentParams {
  pattern: string
  maxResults: number
}

interface MyAgentOutput {
  files: string[]
  count: number
}

const myAgent: AgentDefinition = {
  id: 'typed-agent',
  displayName: 'Typed Agent',
  toolNames: ['find_files', 'set_output'],

  handleSteps: function* ({ params }: { params: MyAgentParams }) {
    const { toolResult } = yield {
      toolName: 'find_files',
      input: { pattern: params.pattern }
    }

    const files = toolResult[0].value.slice(0, params.maxResults)

    const output: MyAgentOutput = {
      files,
      count: files.length
    }

    yield {
      toolName: 'set_output',
      input: { output }
    }
  }
}

// Type-safe execution
const result = await adapter.executeAgent<MyAgentOutput>(
  myAgent,
  'Find files',
  { pattern: '*.ts', maxResults: 10 }
)

// result.output is typed as MyAgentOutput
console.log(result.output.count)
```

**All adapter APIs are fully typed!**

### Q: How do I contribute?

**A:** Contribution steps:

**1. Fork and Clone**
```bash
git clone https://github.com/your-username/codebuff.git
cd codebuff/adapter
```

**2. Install Dependencies**
```bash
npm install
```

**3. Make Changes**
```bash
# Edit files in src/
# Add tests for new features
```

**4. Test Your Changes**
```bash
# Type check
npm run type-check

# Build
npm run build

# Run tests
npm test
```

**5. Submit Pull Request**
```bash
git add .
git commit -m "feat: Add feature description"
git push origin your-branch-name
```

**Contribution Guidelines:**
- Add tests for new features
- Update documentation
- Follow existing code style
- Write clear commit messages

**Areas that need help:**
- Additional tool implementations
- Performance optimizations
- Documentation improvements
- More examples
- Bug fixes

## Limitations

### Q: What are the limitations of FREE mode?

**A:** Current limitations:

**1. No Multi-Agent Orchestration**
- Can't use `spawn_agents`
- Must execute agents sequentially yourself
- No parallel agent execution

**2. No LLM Intelligence**
- Can't use pure LLM mode (without handleSteps)
- No autonomous decision making
- Must define all steps explicitly

**3. Sequential Tool Execution**
- Tool calls within an agent run sequentially
- Can't parallelize tool calls
- (Though file reads are parallelized internally)

**4. Missing Advanced Tools**
These Codebuff tools aren't implemented yet:
- Browser control tools
- Computer control tools
- Web search
- Slack integration
- Email tools
- Database tools

See [TOOL_REFERENCE.md](./TOOL_REFERENCE.md#missing-tools) for complete list.

**5. Platform Dependencies**
- Requires ripgrep for code search
- Terminal commands vary by platform
- Path handling differences (Windows vs Unix)

**Workarounds exist for most limitations!**

### Q: Will more features be added?

**A:** Planned improvements:

**Short Term:**
- Better error messages
- Performance optimizations
- More examples
- Better documentation

**Medium Term:**
- Additional tool implementations
- Better Windows support
- Improved testing utilities
- Plugin system

**Long Term:**
- Custom tool support
- Advanced agent patterns
- Integration with other CLIs

**Contributing:** We welcome contributions! See "How do I contribute?" above.

## Migration

### Q: How do I migrate from Codebuff?

**A:** Migration guide:

**Step 1: Install Adapter**
```bash
cd adapter
npm install
npm run build
```

**Step 2: Update Imports**
```typescript
// Before (Codebuff)
import { executeAgent } from '@codebuff/runtime'

// After (Adapter)
import { createAdapter } from '@codebuff/adapter'
```

**Step 3: Update Execution**
```typescript
// Before
const result = await executeAgent(
  myAgent,
  'Prompt',
  { apiKey: process.env.OPENROUTER_API_KEY }
)

// After
const adapter = createAdapter(process.cwd())
adapter.registerAgent(myAgent)
const result = await adapter.executeAgent(myAgent, 'Prompt')
```

**Step 4: Handle spawn_agents**
```typescript
// Before (works in Codebuff)
yield {
  toolName: 'spawn_agents',
  input: { agents: [...] }
}

// After (FREE mode - refactor to sequential)
const result1 = await adapter.executeAgent(agent1, 'Task 1')
const result2 = await adapter.executeAgent(agent2, 'Task 2')

// Or (PAID mode - works same as Codebuff)
yield {
  toolName: 'spawn_agents',
  input: { agents: [...] }
}
```

**Step 5: Test Everything**
```bash
npm test
```

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed migration guide.

### Q: Is it compatible with existing Codebuff agents?

**A:** Yes! 100% compatible with `AgentDefinition` type:

```typescript
// Your existing Codebuff agent works as-is!
const codebuffAgent: AgentDefinition = {
  id: 'existing-agent',
  displayName: 'Existing Agent',
  model: 'anthropic/claude-sonnet-4.5',
  toolNames: ['read_files', 'write_file', 'set_output'],
  handleSteps: function* ({ params }) {
    // Existing logic works unchanged
  }
}

// Just register and run with adapter
adapter.registerAgent(codebuffAgent)
const result = await adapter.executeAgent(codebuffAgent, 'Do task')
```

**Only exception:** If your agent uses `spawn_agents`, either:
1. Refactor to sequential execution (FREE mode)
2. Use PAID mode with API key
3. Use direct tool calls instead

### Q: What's different from OpenRouter API?

**A:** Key differences:

**Cost:**
- OpenRouter: $0.50-2.00 per session
- FREE mode: $0.00 (zero cost)
- PAID mode: $0.10-0.60 per session

**Privacy:**
- OpenRouter: Code sent to external servers
- FREE mode: 100% local processing
- PAID mode: Only agent coordination sent to API

**Speed:**
- OpenRouter: Network latency on every call
- FREE mode: Fast local execution
- PAID mode: Fast with optimized API calls

**Setup:**
- OpenRouter: API key required
- FREE mode: No setup needed
- PAID mode: API key required

**Compatibility:**
- OpenRouter: Full Codebuff support
- FREE mode: All tools except spawn_agents
- PAID mode: Full Codebuff support

**Best Use Cases:**
- OpenRouter: Production multi-agent workflows
- FREE mode: Local development, file operations, testing
- PAID mode: Cost-optimized multi-agent workflows

---

## Still Have Questions?

- **Documentation:** Check other docs in [adapter/docs/](.)
- **Examples:** See working code in [adapter/examples/](../examples/)
- **Issues:** Report bugs at GitHub Issues
- **Testing:** See [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- **Troubleshooting:** See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Debugging:** See [DEBUG_GUIDE.md](./DEBUG_GUIDE.md)

Can't find your answer? Open a GitHub issue!
