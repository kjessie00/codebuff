# Claude Code CLI Adapter for Codebuff

A production-ready adapter that bridges Codebuff's agent definition system with Claude Code CLI tools, enabling free, local, and private execution of Codebuff agents.

## Table of Contents

- [Overview](#overview)
- [Installation and Setup](#installation-and-setup)
- [Quick Start Guide](#quick-start-guide)
- [Architecture Overview](#architecture-overview)
- [API Reference](#api-reference)
- [Tool Documentation](#tool-documentation)
- [Usage Examples](#usage-examples)
- [Integration Guide](#integration-guide)
- [Troubleshooting](#troubleshooting)

## Overview

### What is the Claude CLI Adapter?

The Claude CLI Adapter enables you to run Codebuff agents locally using Claude Code CLI instead of paid API services (OpenRouter). It provides:

- **Zero API Costs**: Completely free local execution
- **Full Privacy**: All processing happens locally on your machine
- **100% Compatibility**: Works with existing Codebuff `AgentDefinition` types
- **Generator Support**: Full support for `handleSteps` generator pattern
- **Tool Mapping**: Direct mapping of Codebuff tools to Claude Code CLI tools

### Key Features

- **Programmatic Control**: Use `handleSteps` generators for fine-grained execution control
- **Tool Execution**: File operations, code search, terminal commands
- **Sub-Agent Spawning**: Hierarchical agent execution with `spawn_agents`
- **State Management**: Complete context tracking across execution steps
- **Error Handling**: Graceful error recovery and detailed logging
- **Type Safety**: Full TypeScript support with comprehensive types

### Why Use This Adapter?

**Before (Codebuff with OpenRouter API):**
- Cost: ~$0.50-$2.00 per session
- Privacy: Code sent to external servers
- Speed: Network latency for each LLM call

**After (Codebuff with Claude CLI Adapter):**
- Cost: $0 (completely free)
- Privacy: 100% local processing
- Speed: Similar or faster (no network overhead for tool calls)

## Installation and Setup

### Prerequisites

- Node.js 18.0.0 or higher
- TypeScript 5.6.0 or higher
- Claude Code CLI (for LLM integration)

### Installation

1. **Install the adapter package:**

```bash
cd adapter
npm install
```

2. **Build the adapter:**

```bash
npm run build
```

3. **Verify installation:**

```bash
npm run type-check
```

### Project Structure

```
adapter/
├── src/
│   ├── claude-cli-adapter.ts      # Main adapter class
│   ├── handle-steps-executor.ts   # Generator execution engine
│   ├── index.ts                    # Package exports
│   ├── types.ts                    # TypeScript type definitions
│   └── tools/
│       ├── file-operations.ts     # File read/write/edit tools
│       ├── code-search.ts         # Code search and file finding
│       ├── terminal.ts            # Shell command execution
│       ├── spawn-agents.ts        # Sub-agent spawning
│       └── index.ts               # Tool exports
├── examples/
│   └── file-operations-example.ts # Usage examples
├── package.json
├── tsconfig.json
└── README.md                       # This file
```

## Quick Start Guide

### Basic Usage

```typescript
import { createAdapter } from '@codebuff/adapter'
import type { AgentDefinition } from '../.agents/types/agent-definition'

// 1. Create the adapter
const adapter = createAdapter('/path/to/your/project', {
  maxSteps: 20,
  debug: true
})

// 2. Define an agent
const filePickerAgent: AgentDefinition = {
  id: 'file-picker',
  displayName: 'File Picker',
  model: 'anthropic/claude-sonnet-4.5',
  toolNames: ['read_files', 'find_files'],

  handleSteps: function* ({ prompt, params }) {
    // Find TypeScript files
    const { toolResult } = yield {
      toolName: 'find_files',
      input: { pattern: '**/*.ts' }
    }

    // Set output
    yield {
      toolName: 'set_output',
      input: { output: toolResult[0].value }
    }
  }
}

// 3. Register the agent
adapter.registerAgent(filePickerAgent)

// 4. Execute the agent
const result = await adapter.executeAgent(
  filePickerAgent,
  'Find all TypeScript files',
  { pattern: '**/*.ts' }
)

console.log('Found files:', result.output)
```

### With Debug Logging

```typescript
import { createDebugAdapter } from '@codebuff/adapter'

const adapter = createDebugAdapter('/path/to/project')
// Debug logging is automatically enabled

const result = await adapter.executeAgent(myAgent, 'Do something')
// Detailed logs will be printed to console
```

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                  Codebuff Agent System                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ AgentDefinition
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              ClaudeCodeCLIAdapter                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Agent Registration & Execution Management             │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                 │
│         ┌──────────────────┴──────────────────┐             │
│         ▼                                      ▼             │
│  ┌──────────────┐                    ┌─────────────────┐    │
│  │ HandleSteps  │                    │   Pure LLM      │    │
│  │  Executor    │                    │     Mode        │    │
│  └──────────────┘                    └─────────────────┘    │
│         │                                      │             │
│         │                                      │             │
│         ▼                                      ▼             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │            Tool Execution Dispatcher                    │ │
│  └────────────────────────────────────────────────────────┘ │
│         │                                                    │
│    ┌────┴───┬────────┬───────────┬──────────┐              │
│    ▼        ▼        ▼           ▼          ▼              │
│  ┌────┐  ┌────┐  ┌────────┐  ┌───────┐  ┌────────┐        │
│  │File│  │Code│  │Terminal│  │Spawn  │  │Set     │        │
│  │Ops │  │Srch│  │        │  │Agents │  │Output  │        │
│  └────┘  └────┘  └────────┘  └───────┘  └────────┘        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Claude Code CLI Tools                           │
│    Read, Write, Edit, Grep, Glob, Bash, etc.                │
└─────────────────────────────────────────────────────────────┘
```

### Tool Mapping

| Codebuff Tool | Claude CLI Tool | Implementation |
|--------------|-----------------|----------------|
| `read_files` | `Read` | FileOperationsTools |
| `write_file` | `Write` | FileOperationsTools |
| `str_replace` | `Edit` | FileOperationsTools |
| `code_search` | `Grep` | CodeSearchTools |
| `find_files` | `Glob` | CodeSearchTools |
| `run_terminal_command` | `Bash` | TerminalTools |
| `spawn_agents` | Task (sequential) | SpawnAgentsAdapter |
| `set_output` | Internal | Built-in |

## API Reference

See the full documentation sections below for complete API reference including:

- `ClaudeCodeCLIAdapter` - Main adapter class
- `HandleStepsExecutor` - Generator execution engine
- Factory functions (`createAdapter`, `createDebugAdapter`)
- Type definitions and interfaces

For detailed API documentation, see [API_REFERENCE.md](./docs/API_REFERENCE.md).

## Tool Documentation

### Available Tools

1. **File Operations**: `read_files`, `write_file`, `str_replace`
2. **Code Search**: `code_search`, `find_files`
3. **Terminal**: `run_terminal_command`
4. **Agent Management**: `spawn_agents`, `set_output`

For complete tool documentation with parameters and examples, see [TOOL_REFERENCE.md](./docs/TOOL_REFERENCE.md).

## Usage Examples

### Example 1: File Picker Agent

```typescript
const filePickerAgent: AgentDefinition = {
  id: 'file-picker',
  displayName: 'File Picker',
  toolNames: ['find_files', 'set_output'],

  handleSteps: function* ({ params }) {
    const { toolResult } = yield {
      toolName: 'find_files',
      input: { pattern: params.pattern }
    }

    yield {
      toolName: 'set_output',
      input: { output: toolResult[0].value }
    }
  }
}
```

### Example 2: Code Analyzer with Sub-Agents

```typescript
const orchestratorAgent: AgentDefinition = {
  id: 'orchestrator',
  toolNames: ['spawn_agents', 'set_output'],

  handleSteps: function* () {
    const { toolResult } = yield {
      toolName: 'spawn_agents',
      input: {
        agents: [
          { agentId: 'file-picker', params: { pattern: '**/*.ts' } },
          { agentId: 'code-analyzer', prompt: 'Analyze for TODOs' }
        ]
      }
    }

    yield {
      toolName: 'set_output',
      input: { output: toolResult[0].value }
    }
  }
}
```

For more examples, see [examples/](./examples/) directory.

## Integration Guide

For detailed integration instructions including:

- Connecting to actual Claude Code CLI
- Implementation options (internal API, file-based, stdin/stdout)
- Step-by-step integration instructions
- Testing strategies
- Performance considerations

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md).

## Troubleshooting

### Common Issues

#### MaxIterationsError

Increase `maxSteps` in adapter configuration:

```typescript
const adapter = createAdapter('/path', { maxSteps: 50 })
```

#### Path Traversal Errors

Ensure all paths are relative to adapter's `cwd`.

#### Tool Not Found

Include all required tools in agent's `toolNames` array.

#### Debug Logging

Enable debug mode to see detailed execution traces:

```typescript
const adapter = createDebugAdapter('/path/to/project')
```

For more troubleshooting tips, see the Troubleshooting section in the full documentation.

## Performance

- **Batch Operations**: Use `read_files` with multiple paths
- **Limit Results**: Set `maxResults` on `code_search`
- **Appropriate maxSteps**: Configure based on agent complexity
- **Memory**: Contexts auto-cleanup after execution

## License

MIT

## Contributing

Contributions welcome! Ensure tests pass:

```bash
npm run type-check  # Type checking
npm run build       # Build adapter
```

## Additional Documentation

- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - Claude CLI integration
- [CHANGELOG.md](./CHANGELOG.md) - Version history
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical architecture details

## Support

- Check [examples/](./examples/) for working code
- Review type definitions in [src/types.ts](./src/types.ts)
- Enable debug logging for detailed traces
