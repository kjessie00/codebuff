# Terminal Tools Quick Reference

## Installation

```typescript
import { createTerminalTools } from './src/tools/terminal'
```

## Quick Start

```typescript
// Create instance
const tools = createTerminalTools(process.cwd())

// Execute command
const result = await tools.runTerminalCommand({
  command: 'echo "Hello, World!"'
})

console.log(result[0].text)
// $ echo "Hello, World!"
// Hello, World!
```

## Common Patterns

### Basic Command

```typescript
await tools.runTerminalCommand({ command: 'git status' })
```

### With Timeout

```typescript
await tools.runTerminalCommand({
  command: 'npm install',
  timeout_seconds: 120  // 2 minutes
})
```

### Custom Directory

```typescript
await tools.runTerminalCommand({
  command: 'npm test',
  cwd: 'packages/api'  // relative to base cwd
})
```

### Environment Variables

```typescript
await tools.runTerminalCommand({
  command: 'node script.js',
  env: {
    NODE_ENV: 'production',
    DEBUG: '*'
  }
})
```

### Structured Results

```typescript
const result = await tools.executeCommandStructured({
  command: 'git rev-parse HEAD'
})

console.log(result.stdout)      // "abc123..."
console.log(result.exitCode)    // 0
console.log(result.executionTime) // 145 (ms)
```

## Complete API

```typescript
class TerminalTools {
  // Primary method
  runTerminalCommand(input: {
    command: string
    timeout_seconds?: number  // default: 30
    cwd?: string
    env?: Record<string, string>
    mode?: 'user' | 'agent'
    process_type?: 'SYNC' | 'ASYNC'
    description?: string
  }): Promise<ToolResultOutput[]>

  // Structured output
  executeCommandStructured(
    input: RunTerminalCommandInput
  ): Promise<CommandExecutionResult>

  // Utilities
  verifyCommand(command: string): Promise<boolean>
  getCommandVersion(command: string, flag?: string): Promise<string | null>
  getEnvironmentVariables(): Record<string, string>
}

// Factory
createTerminalTools(cwd: string, env?: Record<string, string>)
```

## Output Format

### Success

```
$ command
output here
```

### With Stderr

```
$ command
output here

[STDERR]
error output
```

### Failed

```
$ command
output here

[STDERR]
error message

[Exit code: 1]
```

### Timeout

```
$ sleep 100

[ERROR] Command timed out and was killed

[Failed after 5.00s]
```

## Real-World Examples

### Git Operations

```typescript
// Status
await tools.runTerminalCommand({ command: 'git status --short' })

// Commit
await tools.runTerminalCommand({
  command: 'git add . && git commit -m "Update"'
})

// Current branch
const result = await tools.executeCommandStructured({
  command: 'git rev-parse --abbrev-ref HEAD'
})
console.log(result.stdout.trim()) // "main"
```

### NPM/Build

```typescript
// Install
await tools.runTerminalCommand({
  command: 'npm install',
  timeout_seconds: 120
})

// Test
await tools.runTerminalCommand({
  command: 'npm test',
  env: { NODE_ENV: 'test', CI: 'true' }
})

// Build
await tools.runTerminalCommand({
  command: 'npm run build',
  cwd: 'packages/frontend'
})
```

### Command Verification

```typescript
// Check if command exists
if (await tools.verifyCommand('git')) {
  console.log('Git is installed')
}

// Get version
const version = await tools.getCommandVersion('node')
console.log(version) // "v20.10.0"
```

## Agent Integration

```typescript
const agent: AgentDefinition = {
  handleSteps: function* ({ params }) {
    const tools = createTerminalTools(params.cwd)

    // Execute command
    const { toolResult } = yield {
      toolName: 'run_terminal_command',
      input: {
        command: 'npm run build',
        timeout_seconds: 120
      }
    }

    // Check result
    if (toolResult[0].text.includes('[ERROR]')) {
      yield { type: 'STEP_TEXT', text: 'Build failed!' }
      return
    }

    yield 'STEP'
  }
}
```

## Error Handling

```typescript
const result = await tools.executeCommandStructured({
  command: 'npm run build'
})

if (result.exitCode !== 0) {
  console.error('Failed:', result.stderr)
} else if (result.timedOut) {
  console.error('Timed out after', result.executionTime, 'ms')
} else {
  console.log('Success!', result.stdout)
}
```

## Security

```typescript
// ✅ Safe - within base cwd
await tools.runTerminalCommand({
  command: 'ls',
  cwd: 'src'
})

// ❌ Blocked - path traversal
await tools.runTerminalCommand({
  command: 'ls',
  cwd: '../../../etc'  // Error: Path traversal detected
})
```

## Tips

1. **Timeouts**: Default 30s, adjust based on operation
   - Quick commands: 5-10s
   - Installs: 60-120s
   - Builds: 120-300s

2. **Combine Commands**: Use `&&` to chain related commands
   ```typescript
   command: 'npm install && npm test && npm run build'
   ```

3. **Large Output**: 10MB buffer default, redirect if larger
   ```typescript
   command: 'large-command | head -100'
   ```

4. **Structured Results**: Use for programmatic checks
   ```typescript
   const result = await tools.executeCommandStructured(...)
   if (result.exitCode === 0) { /* success */ }
   ```

## Files

- Implementation: `adapter/src/tools/terminal.ts`
- Tests: `adapter/src/tools/terminal.test.ts`
- Examples: `adapter/examples/terminal-tools-usage.ts`
- Docs: `adapter/docs/TERMINAL_TOOLS.md`
