# Quick Start: FREE Mode

Get started with the Claude CLI adapter in FREE mode (no API key required) in under 5 minutes.

## Installation

The FREE mode base code is already included in the adapter. No additional installation needed.

## Your First Agent (3 Steps)

### Step 1: Import and Create Adapter

```typescript
import { createFreeAdapter, fileExplorerAgent } from './adapter/src/free-mode'

// Create adapter - that's it!
const adapter = createFreeAdapter()
```

### Step 2: Register Agent

```typescript
// Register one of the 11 pre-built agents
adapter.registerAgent(fileExplorerAgent)
```

### Step 3: Execute

```typescript
// Execute the agent
const result = await adapter.executeAgent(
  fileExplorerAgent,
  'Find all TypeScript files in the src directory'
)

console.log(result.output)
```

## Complete Example

```typescript
import { createFreeAdapter, fileExplorerAgent } from './adapter/src/free-mode'

async function main() {
  // Create adapter
  const adapter = createFreeAdapter({ cwd: process.cwd() })

  // Register agent
  adapter.registerAgent(fileExplorerAgent)

  // Execute
  const result = await adapter.executeAgent(
    fileExplorerAgent,
    'Find all TypeScript files'
  )

  console.log('Found files:', result.output)
}

main()
```

## Pre-built Agents (11 Ready to Use)

Just import and use any of these:

```typescript
import {
  fileExplorerAgent,      // Find and read files
  codeSearchAgent,        // Search code patterns
  terminalAgent,          // Run shell commands
  fileEditorAgent,        // Edit files
  projectAnalyzerAgent,   // Analyze project structure
  todoFinderAgent,        // Find TODOs/FIXMEs
  docGeneratorAgent,      // Generate documentation
  codeReviewerAgent,      // Review code quality
  dependencyAnalyzerAgent,// Analyze dependencies
  securityAuditorAgent,   // Security audit
  testGeneratorAgent,     // Generate tests
} from './adapter/src/free-mode'
```

## With Error Handling

```typescript
import {
  createFreeAdapter,
  codeSearchAgent,
  executeWithErrorHandling
} from './adapter/src/free-mode'

const adapter = createFreeAdapter()
adapter.registerAgent(codeSearchAgent)

const result = await executeWithErrorHandling(
  adapter,
  codeSearchAgent,
  'Search for TODO comments'
)

if (result.success) {
  console.log('✅ Success:', result.data.output)
} else {
  console.error('❌ Error:', result.error)
}
```

## Using Presets

```typescript
import { createAdapterWithPreset } from './adapter/src/free-mode'

// Development mode - verbose logging
const devAdapter = createAdapterWithPreset('development')

// Production mode - minimal logging
const prodAdapter = createAdapterWithPreset('production')

// Testing mode - strict settings
const testAdapter = createAdapterWithPreset('testing')
```

## Register All Agents at Once

```typescript
import { createFreeAdapter, allAgents } from './adapter/src/free-mode'

const adapter = createFreeAdapter()

// Register all 11 pre-built agents
adapter.registerAgents(allAgents)

// List what's available
console.log('Available agents:', adapter.listAgents())
```

## Sequential Workflow

```typescript
import {
  createFreeAdapter,
  fileExplorerAgent,
  codeSearchAgent,
  todoFinderAgent,
  executeSequence
} from './adapter/src/free-mode'

const adapter = createFreeAdapter()
adapter.registerAgents([fileExplorerAgent, codeSearchAgent, todoFinderAgent])

// Run multiple agents in sequence
const results = await executeSequence(adapter, [
  { agent: fileExplorerAgent, prompt: 'Find all .ts files' },
  { agent: codeSearchAgent, prompt: 'Search for TODOs' },
  { agent: todoFinderAgent, prompt: 'Organize TODOs by priority' }
])

console.log('All tasks completed!')
```

## Available Tools (FREE Mode)

✅ Works without API key:
- `read_files` - Read multiple files
- `write_file` - Write to files
- `str_replace` - Replace strings
- `code_search` - Search code
- `find_files` - Find files
- `run_terminal_command` - Run commands
- `set_output` - Set output

❌ Requires API key (PAID mode):
- `spawn_agents` - Multi-agent orchestration

## Custom Agent

```typescript
import { createFreeAdapter, type AgentDefinition } from './adapter/src/free-mode'

const myAgent: AgentDefinition = {
  id: 'my-custom-agent',
  version: '1.0.0',
  displayName: 'My Custom Agent',
  model: 'anthropic/claude-sonnet-4.5',
  systemPrompt: 'You are a helpful assistant.',
  toolNames: ['read_files', 'code_search'],
  outputMode: 'last_message',
}

const adapter = createFreeAdapter()
adapter.registerAgent(myAgent)

const result = await adapter.executeAgent(myAgent, 'Do something')
```

## Environment-Based Configuration

```typescript
import { createAdapterForEnvironment } from './adapter/src/free-mode'

// Automatically uses correct preset based on NODE_ENV
const adapter = createAdapterForEnvironment()

// development -> verbose logging
// production -> minimal logging
// test -> strict settings
```

## Run the Examples

```bash
# Run comprehensive examples
npx tsx adapter/examples/free-mode-usage.ts

# Or import specific examples
import { example1_BasicUsage } from './adapter/examples/free-mode-usage'
await example1_BasicUsage()
```

## Documentation

- **Complete Guide**: `/adapter/src/free-mode/README.md`
- **Implementation Details**: `/adapter/FREE_MODE_FOUNDATION.md`
- **Type Definitions**: `/adapter/src/free-mode/free-mode-types.ts`
- **Examples**: `/adapter/examples/free-mode-usage.ts`

## Need Help?

Check these resources:
1. Examples file: `adapter/examples/free-mode-usage.ts`
2. README: `adapter/src/free-mode/README.md`
3. JSDoc comments in source files
4. Foundation doc: `adapter/FREE_MODE_FOUNDATION.md`

## Cost

**$0.00** - 100% FREE!

No API key required. Uses your existing Claude Code CLI subscription.

## Next Steps

1. Try the examples: `npx tsx adapter/examples/free-mode-usage.ts`
2. Use a pre-built agent for your use case
3. Create custom agents as needed
4. Explore the helper functions for advanced patterns

Happy coding! 🚀
