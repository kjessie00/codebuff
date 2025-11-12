# Terminal Tools Documentation

Complete documentation for the `TerminalTools` class in the Claude Code CLI Adapter.

## Overview

The `TerminalTools` class provides shell command execution capabilities that map Codebuff's `run_terminal_command` tool to Claude Code CLI's Bash tool. It enables agents to execute shell commands with proper error handling, timeout management, and output formatting.

## Features

- ✅ **Shell Command Execution**: Execute any shell command with full support for pipes, redirects, and complex shell syntax
- ✅ **Configurable Timeout**: Prevent hanging commands with customizable timeout (default: 30 seconds)
- ✅ **Custom Working Directory**: Execute commands in specific directories relative to base cwd
- ✅ **Environment Variables**: Support both global and per-command environment variables
- ✅ **Output Formatting**: Claude CLI Bash tool compatible output format (`$ command\n{output}`)
- ✅ **Error Handling**: Graceful handling of command failures, timeouts, and system errors
- ✅ **Security**: Path traversal protection to prevent commands from escaping the working directory
- ✅ **Large Output Support**: 10MB buffer for handling commands with substantial output
- ✅ **Execution Metrics**: Track execution time and timeout status
- ✅ **Structured Results**: Optional structured output for programmatic access

## Installation

```typescript
import { createTerminalTools, TerminalTools } from '@codebuff/adapter/tools'
```

## Quick Start

### Basic Usage

```typescript
import { createTerminalTools } from '@codebuff/adapter/tools'

// Create tools instance
const tools = createTerminalTools(process.cwd())

// Execute a command
const result = await tools.runTerminalCommand({
  command: 'echo "Hello, World!"'
})

console.log(result[0].text)
// Output:
// $ echo "Hello, World!"
// Hello, World!
```

## API Reference

### Constructor

#### `new TerminalTools(cwd: string, env?: Record<string, string>)`

Create a new TerminalTools instance.

**Parameters:**
- `cwd` (string): Base working directory for all command executions
- `env` (Record<string, string>, optional): Global environment variables to merge with `process.env`

**Example:**

```typescript
const tools = new TerminalTools('/path/to/project', {
  NODE_ENV: 'development',
  LOG_LEVEL: 'debug'
})
```

### Methods

#### `runTerminalCommand(input: RunTerminalCommandInput): Promise<ToolResultOutput[]>`

Execute a shell command and return formatted output.

**Parameters:**

```typescript
interface RunTerminalCommandInput {
  // Required
  command: string                 // The shell command to execute

  // Optional
  mode?: 'user' | 'agent'        // Execution mode (default: 'agent')
  process_type?: 'SYNC' | 'ASYNC' // Process type (default: 'SYNC')
  timeout_seconds?: number        // Timeout in seconds (default: 30)
  cwd?: string                    // Custom working directory (relative to base cwd)
  env?: Record<string, string>    // Additional environment variables
  description?: string            // Command description for logging
}
```

**Returns:**

```typescript
type ToolResultOutput = {
  type: 'text'
  text: string  // Formatted output: "$ command\n{output}"
}
```

**Example:**

```typescript
const result = await tools.runTerminalCommand({
  command: 'npm test',
  cwd: 'packages/core',
  timeout_seconds: 60,
  env: {
    NODE_ENV: 'test'
  }
})

console.log(result[0].text)
// $ npm test
// > test
// > jest
//
// PASS  src/index.test.ts
// ✓ should pass (2 ms)
//
// Tests: 1 passed, 1 total
// [Completed in 3.45s]
```

#### `executeCommandStructured(input: RunTerminalCommandInput): Promise<CommandExecutionResult>`

Execute a command and return structured results instead of formatted text.

**Returns:**

```typescript
interface CommandExecutionResult {
  command: string          // The command that was executed
  stdout: string          // Standard output
  stderr: string          // Standard error
  exitCode: number        // Exit code (0 = success)
  timedOut: boolean       // Whether the command timed out
  executionTime: number   // Execution time in milliseconds
  cwd: string            // Working directory where command was run
  error?: string         // Error message if command failed
}
```

**Example:**

```typescript
const result = await tools.executeCommandStructured({
  command: 'git rev-parse HEAD'
})

console.log('Commit:', result.stdout.trim())
console.log('Exit Code:', result.exitCode)
console.log('Time:', result.executionTime, 'ms')
```

#### `verifyCommand(command: string): Promise<boolean>`

Check if a command is available on the system.

**Example:**

```typescript
const hasGit = await tools.verifyCommand('git')
if (!hasGit) {
  console.log('Git is not installed')
}
```

#### `getCommandVersion(command: string, versionFlag?: string): Promise<string | null>`

Get the version of a command if available.

**Example:**

```typescript
const nodeVersion = await tools.getCommandVersion('node')
console.log(nodeVersion) // "v20.10.0"

// Custom version flag
const gitVersion = await tools.getCommandVersion('git', '--version')
console.log(gitVersion) // "git version 2.34.1"
```

#### `getEnvironmentVariables(): Record<string, string>`

Get all environment variables that will be available to commands.

**Example:**

```typescript
const env = tools.getEnvironmentVariables()
console.log(env.PATH)
console.log(env.NODE_ENV)
```

### Factory Function

#### `createTerminalTools(cwd: string, env?: Record<string, string>): TerminalTools`

Convenience factory function to create a TerminalTools instance.

**Example:**

```typescript
const tools = createTerminalTools('/path/to/project', {
  NODE_ENV: 'production'
})
```

## Usage Examples

### Example 1: Git Operations

```typescript
const tools = createTerminalTools(process.cwd())

// Check git status
const status = await tools.runTerminalCommand({
  command: 'git status --short'
})

// Get current branch
const branch = await tools.executeCommandStructured({
  command: 'git rev-parse --abbrev-ref HEAD'
})

console.log('Branch:', branch.stdout.trim())

// Commit changes
const commit = await tools.runTerminalCommand({
  command: 'git add . && git commit -m "Update files"'
})
```

### Example 2: NPM/Package Manager Operations

```typescript
const tools = createTerminalTools(process.cwd())

// Install dependencies
await tools.runTerminalCommand({
  command: 'npm install',
  timeout_seconds: 120  // 2 minute timeout for slow networks
})

// Run tests
await tools.runTerminalCommand({
  command: 'npm test',
  env: {
    NODE_ENV: 'test',
    CI: 'true'
  }
})

// Build project
await tools.runTerminalCommand({
  command: 'npm run build',
  cwd: 'packages/frontend'
})
```

### Example 3: Build and Deploy Workflow

```typescript
const tools = createTerminalTools(process.cwd())

async function buildAndDeploy() {
  // Step 1: Type check
  console.log('Type checking...')
  const typeCheck = await tools.executeCommandStructured({
    command: 'tsc --noEmit'
  })

  if (typeCheck.exitCode !== 0) {
    console.error('Type check failed!')
    return
  }

  // Step 2: Run tests
  console.log('Running tests...')
  const tests = await tools.executeCommandStructured({
    command: 'npm test',
    timeout_seconds: 60
  })

  if (tests.exitCode !== 0) {
    console.error('Tests failed!')
    return
  }

  // Step 3: Build
  console.log('Building...')
  const build = await tools.runTerminalCommand({
    command: 'npm run build'
  })

  // Step 4: Deploy
  console.log('Deploying...')
  await tools.runTerminalCommand({
    command: 'npm run deploy',
    env: {
      DEPLOY_ENV: 'production'
    }
  })

  console.log('✓ Deployment complete!')
}
```

### Example 4: Error Handling

```typescript
const tools = createTerminalTools(process.cwd())

try {
  const result = await tools.executeCommandStructured({
    command: 'npm run build',
    timeout_seconds: 300
  })

  if (result.exitCode !== 0) {
    console.error('Build failed with exit code:', result.exitCode)
    console.error('Error output:', result.stderr)
  } else if (result.timedOut) {
    console.error('Build timed out after 5 minutes')
  } else {
    console.log('Build succeeded!')
    console.log(result.stdout)
  }
} catch (error) {
  console.error('Unexpected error:', error)
}
```

### Example 5: Environment Variables

```typescript
// Global environment variables
const tools = createTerminalTools(process.cwd(), {
  APP_ENV: 'development',
  LOG_LEVEL: 'debug'
})

// Use global env vars
await tools.runTerminalCommand({
  command: 'node script.js'  // Will have APP_ENV and LOG_LEVEL
})

// Override or add env vars per command
await tools.runTerminalCommand({
  command: 'node script.js',
  env: {
    APP_ENV: 'production',  // Override global
    EXTRA_VAR: 'value'      // Add new
  }
})
```

### Example 6: Working with Subdirectories

```typescript
const tools = createTerminalTools('/home/user/project')

// Execute in subdirectory
await tools.runTerminalCommand({
  command: 'npm test',
  cwd: 'packages/api'  // Relative to /home/user/project
})

// Multiple operations in same directory
const apiTools = createTerminalTools('/home/user/project/packages/api')

await apiTools.runTerminalCommand({ command: 'npm install' })
await apiTools.runTerminalCommand({ command: 'npm test' })
await apiTools.runTerminalCommand({ command: 'npm run build' })
```

### Example 7: Pipes and Complex Commands

```typescript
const tools = createTerminalTools(process.cwd())

// Use pipes
await tools.runTerminalCommand({
  command: 'cat log.txt | grep ERROR | wc -l'
})

// Chain commands
await tools.runTerminalCommand({
  command: 'npm run build && npm test && npm run deploy'
})

// Conditional execution
await tools.runTerminalCommand({
  command: 'npm test || echo "Tests failed but continuing"'
})
```

## Output Format

### Standard Success Output

```
$ echo "Hello, World!"
Hello, World!
```

### Output with Stderr

```
$ node script.js

[STDERR]
Warning: Something might be wrong
```

### Failed Command

```
$ npm test

[STDERR]
npm ERR! Test failed

[Exit code: 1]
```

### Long-Running Command

```
$ npm run build
Building project...
Build complete!

[Completed in 12.34s]
```

### Timeout Error

```
$ sleep 100

[ERROR] Command timed out and was killed

[Failed after 5.00s]
```

## Integration with Agent Workflows

### In handleSteps Generator

```typescript
import type { AgentDefinition } from '@codebuff/types'
import { createTerminalTools } from '@codebuff/adapter/tools'

const buildAgent: AgentDefinition = {
  id: 'build-agent',
  displayName: 'Build Agent',

  handleSteps: function* ({ prompt, params }) {
    const tools = createTerminalTools(params.cwd)

    // Step 1: Run terminal command
    const { toolResult } = yield {
      toolName: 'run_terminal_command',
      input: {
        command: 'npm run build',
        timeout_seconds: 120
      }
    }

    // Check result
    if (toolResult[0].text.includes('[ERROR]')) {
      yield {
        type: 'STEP_TEXT',
        text: 'Build failed! Check the output above.'
      }
      return
    }

    // Step 2: Continue with next step
    yield 'STEP'
  }
}
```

### With Structured Results

```typescript
handleSteps: function* ({ prompt, params }) {
  const tools = createTerminalTools(params.cwd)

  // Execute and get structured results
  const buildResult = await tools.executeCommandStructured({
    command: 'npm run build',
    timeout_seconds: 120
  })

  if (buildResult.exitCode === 0) {
    yield {
      toolName: 'set_output',
      input: {
        output: {
          status: 'success',
          executionTime: buildResult.executionTime,
          artifacts: buildResult.stdout
        }
      }
    }
  } else {
    yield {
      toolName: 'set_output',
      input: {
        output: {
          status: 'failed',
          error: buildResult.stderr,
          exitCode: buildResult.exitCode
        }
      }
    }
  }
}
```

## Security Considerations

### Path Traversal Protection

The TerminalTools class includes built-in protection against path traversal attacks:

```typescript
// This will fail with "Path traversal detected"
await tools.runTerminalCommand({
  command: 'pwd',
  cwd: '../../../etc'
})
```

The working directory must always be within the base `cwd` provided to the constructor.

### Command Injection

Always be careful with user input in commands. Prefer parameterized execution when possible:

```typescript
// ❌ Dangerous - vulnerable to command injection
const userInput = req.body.filename
await tools.runTerminalCommand({
  command: `cat ${userInput}`  // Could be: "file.txt && rm -rf /"
})

// ✅ Better - validate and sanitize input first
const filename = path.basename(userInput) // Remove directory traversal
if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
  throw new Error('Invalid filename')
}
await tools.runTerminalCommand({
  command: `cat "${filename}"`
})
```

## Performance Tips

1. **Use Appropriate Timeouts**: Set realistic timeouts for different operations
   - Quick commands: 5-10 seconds
   - Package installs: 60-120 seconds
   - Builds: 120-300 seconds

2. **Reuse Tool Instances**: Create one instance and reuse it for multiple commands

3. **Use Structured Results**: When you need to programmatically check results, use `executeCommandStructured()` instead of parsing text output

4. **Batch Commands**: Use shell operators to combine related commands:
   ```typescript
   // Instead of three separate calls
   await tools.runTerminalCommand({ command: 'npm install && npm test && npm run build' })
   ```

## Troubleshooting

### Command Not Found

```typescript
// Check if command exists first
if (await tools.verifyCommand('git')) {
  await tools.runTerminalCommand({ command: 'git status' })
} else {
  console.error('Git is not installed')
}
```

### Timeout Issues

```typescript
// Increase timeout for slow operations
await tools.runTerminalCommand({
  command: 'npm install',
  timeout_seconds: 300  // 5 minutes
})
```

### Large Output

The tool supports up to 10MB of output by default. For larger outputs, consider:
- Redirecting output to a file
- Using pagination or filters
- Processing output in chunks

```typescript
// Instead of printing everything
await tools.runTerminalCommand({
  command: 'cat huge-file.txt | head -100'
})
```

## Differences from Claude CLI Bash Tool

| Feature | TerminalTools | Claude CLI Bash |
|---------|--------------|-----------------|
| Output Format | `type: 'text'` | Native tool result |
| Timeout | Configurable (default 30s) | Configurable (default 2m) |
| Working Directory | Base cwd + relative paths | Current directory |
| Environment Variables | Fully customizable | Inherits from session |
| Security | Path traversal protection | Sandboxed environment |
| Error Handling | Structured error results | Native error handling |

## Mapping to Codebuff Tools

```typescript
// Codebuff
run_terminal_command({
  command: 'npm test',
  mode: 'agent',
  timeout_seconds: 60,
  cwd: 'packages/api'
})

// Maps to

// Claude CLI Bash
tools.runTerminalCommand({
  command: 'npm test',
  timeout_seconds: 60,
  cwd: 'packages/api'
})
```

## Related Documentation

- [Claude Code CLI Adapter Guide](./CLAUDE_CLI_ADAPTER_GUIDE.md)
- [File Operations Tools](./FILE_OPERATIONS_TOOLS.md)
- [Code Search Tools](./CODE_SEARCH_TOOLS.md)
- [Tool Mapping Overview](./TOOL_MAPPING.md)

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourusername/codebuff/issues
- Documentation: https://docs.codebuff.dev

## License

MIT License - See LICENSE file for details
