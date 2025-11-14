# FREE Mode - Production-Ready Base Code

Complete, production-ready base code foundation for using the Claude CLI adapter in **FREE mode** (without an API key).

## Quick Start

```typescript
import { createFreeAdapter, fileExplorerAgent } from './free-mode'

// Create adapter
const adapter = createFreeAdapter({ cwd: '/path/to/project' })

// Register agent
adapter.registerAgent(fileExplorerAgent)

// Execute
const result = await adapter.executeAgent(
  fileExplorerAgent,
  'Find all TypeScript files'
)

console.log(result.output)
```

## Features

### 🏭 Factory Functions

Easy adapter creation with sensible defaults:

- `createFreeAdapter()` - Main factory with options
- `createAdapterForCwd()` - Quick current directory setup
- `createAdapterForProject()` - Project-specific setup
- `createDebugAdapter()` - Development mode with verbose logging
- `createSilentAdapter()` - Production mode with minimal output

### 🤖 Pre-built Agent Templates (11 agents)

Ready-to-use agents for common tasks:

#### File Operations
- **File Explorer** - Find and read files
- **File Editor** - Modify files with precision

#### Code Analysis
- **Code Searcher** - Search code with patterns
- **Code Reviewer** - Review code quality
- **Project Analyzer** - Analyze project structure

#### Development Tools
- **Terminal Executor** - Run shell commands
- **TODO Finder** - Find all TODOs/FIXMEs
- **Test Generator** - Generate test cases

#### Documentation & Security
- **Documentation Generator** - Create docs
- **Dependency Analyzer** - Analyze dependencies
- **Security Auditor** - Find security issues

### 🛠️ Helper Functions

Common patterns made easy:

- `executeWithErrorHandling()` - Automatic error handling
- `executeWithRetry()` - Retry failed executions
- `executeWithTimeout()` - Timeout protection
- `executeSequence()` - Sequential execution
- `executeParallel()` - Parallel execution
- `executeAndExtract()` - Output extraction
- `getToolAvailability()` - Check tool availability
- `validateAgentForFreeMode()` - Validate agent compatibility

### ⚙️ Configuration Presets

Pre-configured settings for common scenarios:

- **development** - Verbose logging, 50 max steps
- **production** - Minimal logging, 20 max steps
- **testing** - Strict settings, 10 max steps
- **silent** - No logging
- **verbose** - Maximum debugging, 100 max steps
- **performance** - Optimized for speed, 15 max steps

```typescript
import { createAdapterWithPreset } from './free-mode'

// Development mode
const devAdapter = createAdapterWithPreset('development')

// Production mode
const prodAdapter = createAdapterWithPreset('production')

// Automatic environment detection
const adapter = createAdapterForEnvironment()
```

## Available Tools (FREE Mode)

✅ **Works without API key:**

- `read_files` - Read multiple files from disk
- `write_file` - Write content to a file
- `str_replace` - Replace string in a file
- `code_search` - Search codebase with ripgrep
- `find_files` - Find files matching glob pattern
- `run_terminal_command` - Execute shell commands
- `set_output` - Set agent output value

❌ **Requires API key (PAID mode):**

- `spawn_agents` - Spawn and execute sub-agents

## File Structure

```
free-mode/
├── index.ts              # Main exports and documentation
├── free-mode-types.ts    # Type definitions
├── factories.ts          # Factory functions
├── agent-templates.ts    # Pre-built agent definitions
├── helpers.ts            # Helper functions
├── presets.ts           # Configuration presets
└── README.md            # This file
```

## Usage Examples

### Basic Usage

```typescript
import { createFreeAdapter, fileExplorerAgent } from './free-mode'

const adapter = createFreeAdapter()
adapter.registerAgent(fileExplorerAgent)

const result = await adapter.executeAgent(
  fileExplorerAgent,
  'Find all TypeScript files'
)
```

### Error Handling

```typescript
import { executeWithErrorHandling } from './free-mode'

const result = await executeWithErrorHandling(
  adapter,
  codeSearchAgent,
  'Search for TODO comments'
)

if (result.success) {
  console.log('Found:', result.data.output)
} else {
  console.error('Error:', result.error)
}
```

### Sequential Workflow

```typescript
import { executeSequence } from './free-mode'

const results = await executeSequence(adapter, [
  { agent: fileExplorerAgent, prompt: 'Find all .ts files' },
  { agent: codeSearchAgent, prompt: 'Search for TODOs' },
  { agent: todoFinderAgent, prompt: 'Organize TODOs' }
])
```

### Using Presets

```typescript
import { createAdapterWithPreset } from './free-mode'

// Development mode
const adapter = createAdapterWithPreset('development', {
  cwd: '/path/to/project'
})

// Production mode
const adapter = createAdapterWithPreset('production', {
  cwd: '/path/to/project'
})
```

### Custom Agent

```typescript
import type { AgentDefinition } from './free-mode'

const myAgent: AgentDefinition = {
  id: 'my-agent',
  version: '1.0.0',
  displayName: 'My Agent',
  model: 'anthropic/claude-sonnet-4.5',
  systemPrompt: 'You are a helpful assistant.',
  toolNames: ['read_files', 'code_search'],
  outputMode: 'last_message',
}

adapter.registerAgent(myAgent)
```

### Register All Agents

```typescript
import { allAgents } from './free-mode'

adapter.registerAgents(allAgents)

const agentIds = adapter.listAgents()
console.log('Available agents:', agentIds)
```

## Type Safety

All functions are fully typed with comprehensive JSDoc comments:

```typescript
import type {
  Result,
  ExecutionOptions,
  AgentTemplate,
  ToolAvailability,
  PresetConfig,
} from './free-mode'

// Result type with discriminated union
const result: Result<string> = await executeWithErrorHandling(...)
if (result.success) {
  const data: string = result.data
} else {
  const error: string = result.error
}
```

## Error Handling

All helper functions return `Result<T>` types for consistent error handling:

```typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: any }
```

This allows for safe, type-checked error handling without try/catch:

```typescript
const result = await executeWithErrorHandling(adapter, agent, prompt)

if (result.success) {
  // TypeScript knows result.data exists here
  console.log(result.data.output)
} else {
  // TypeScript knows result.error exists here
  console.error(result.error)
}
```

## Best Practices

1. **Always validate agents** before using them:
   ```typescript
   const validation = validateAgentForFreeMode(myAgent)
   if (!validation.success) {
     console.error('Agent requires PAID mode')
   }
   ```

2. **Use error handling helpers** instead of raw try/catch:
   ```typescript
   const result = await executeWithErrorHandling(adapter, agent, prompt)
   ```

3. **Choose appropriate presets** for your environment:
   ```typescript
   const adapter = createAdapterForEnvironment() // Uses NODE_ENV
   ```

4. **Register all agents at startup**:
   ```typescript
   adapter.registerAgents(allAgents)
   ```

5. **Use progress tracking** for long-running operations:
   ```typescript
   const result = await executeWithErrorHandling(adapter, agent, prompt, {
     onProgress: (step, total) => console.log(`${step}/${total}`)
   })
   ```

## Testing

The FREE mode base code is designed to be easily testable:

```typescript
import { createTestingAdapter } from './free-mode'

describe('My Agent', () => {
  let adapter: ClaudeCodeCLIAdapter

  beforeEach(() => {
    adapter = createTestingAdapter('/path/to/test/project')
    adapter.registerAgent(myAgent)
  })

  it('should execute successfully', async () => {
    const result = await executeWithErrorHandling(
      adapter,
      myAgent,
      'test prompt'
    )

    expect(result.success).toBe(true)
  })
})
```

## Migration from Basic Usage

If you're currently using basic adapter creation, migration is simple:

**Before:**
```typescript
import { ClaudeCodeCLIAdapter } from './claude-cli-adapter'

const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  debug: true,
  maxSteps: 20
})
```

**After:**
```typescript
import { createFreeAdapter } from './free-mode'

const adapter = createFreeAdapter({
  cwd: process.cwd(),
  debug: true,
  maxSteps: 20
})
```

Or even simpler with presets:

```typescript
import { createDevelopmentAdapter } from './free-mode'

const adapter = createDevelopmentAdapter()
```

## API Reference

See the comprehensive JSDoc comments in each file:

- **free-mode-types.ts** - All type definitions
- **factories.ts** - Factory function documentation
- **agent-templates.ts** - Agent template details
- **helpers.ts** - Helper function usage
- **presets.ts** - Preset configuration details

## Examples

See `/adapter/examples/free-mode-usage.ts` for comprehensive examples.

## Cost

**100% FREE** - No API key required, no costs incurred!

All tools and agents in FREE mode use your existing Claude Code CLI subscription.

## Support

For questions or issues:
1. Check the examples in `/adapter/examples/free-mode-usage.ts`
2. Review the JSDoc comments in the source files
3. See the main adapter documentation in `/adapter/README.md`

## License

Same as the parent project.
