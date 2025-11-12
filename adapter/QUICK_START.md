# Quick Start Guide

Get started with the Claude Code CLI Adapter in 5 minutes!

## Installation

```bash
cd adapter
npm install
npm run build
```

## Basic Example

```typescript
import { createAdapter } from '@codebuff/adapter'

// 1. Create adapter
const adapter = createAdapter(process.cwd(), { debug: true })

// 2. Define agent
const myAgent = {
  id: 'file-finder',
  displayName: 'File Finder',
  toolNames: ['find_files', 'set_output'],

  handleSteps: function* ({ params }) {
    // Find files
    const { toolResult } = yield {
      toolName: 'find_files',
      input: { pattern: params.pattern }
    }

    // Set output
    yield {
      toolName: 'set_output',
      input: { output: toolResult[0].value }
    }
  }
}

// 3. Execute
const result = await adapter.executeAgent(
  myAgent,
  'Find TypeScript files',
  { pattern: '**/*.ts' }
)

console.log('Files found:', result.output.files.length)
```

## Run the Example

```bash
# Build and run file operations example
npm run build
node dist/examples/file-operations-example.js
```

## Next Steps

- Read [README.md](./README.md) for complete documentation
- Check [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for Claude CLI integration
- Explore [examples/](./examples/) for more usage patterns

## Available Tools

- `read_files` - Read multiple files
- `write_file` - Write to a file
- `str_replace` - Replace strings in files
- `code_search` - Search codebase
- `find_files` - Find files by pattern
- `run_terminal_command` - Execute shell commands
- `spawn_agents` - Run sub-agents
- `set_output` - Set agent output

## Documentation

| Document | Description |
|----------|-------------|
| [README.md](./README.md) | Main documentation |
| [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) | Claude CLI integration |
| [CHANGELOG.md](./CHANGELOG.md) | Version history |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical details |

Happy coding!
