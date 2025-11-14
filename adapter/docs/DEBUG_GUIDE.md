# Debug Guide

Complete guide to debugging Claude Code CLI Adapter agents in FREE mode.

## Table of Contents

- [Enabling Debug Mode](#enabling-debug-mode)
- [Debug Output Explained](#debug-output-explained)
- [Debug Levels](#debug-levels)
- [Common Debug Scenarios](#common-debug-scenarios)
- [Using Node Debugger](#using-node-debugger)
- [Performance Profiling](#performance-profiling)
- [Advanced Debugging](#advanced-debugging)

## Enabling Debug Mode

### Method 1: createDebugAdapter (Easiest)

```typescript
import { createDebugAdapter } from '@codebuff/adapter'

// Debug automatically enabled
const adapter = createDebugAdapter(process.cwd())

// Execute agent - will show debug output
const result = await adapter.executeAgent(myAgent, 'Test')
```

**Output:**
```
[DEBUG] Creating adapter with cwd: /Users/me/project
[DEBUG] Agent registered: my-agent
[DEBUG] Executing agent: my-agent
[DEBUG] Tool call: find_files with input: {"pattern":"*.ts"}
[DEBUG] Tool result: {"type":"json","value":["file1.ts","file2.ts"]}
[DEBUG] Agent completed normally after 2 iterations
```

### Method 2: debug Config Option

```typescript
import { ClaudeCodeCLIAdapter } from '@codebuff/adapter'

const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  debug: true // Enable debug mode
})
```

### Method 3: Custom Logger

```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  debug: true,
  logger: (msg) => {
    // Custom logging format
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] ${msg}`)
  }
})
```

### Method 4: File Logging

```typescript
import fs from 'fs'

const logFile = 'adapter-debug.log'

const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  debug: true,
  logger: (msg) => {
    const timestamp = new Date().toISOString()
    const logLine = `[${timestamp}] ${msg}\n`

    // Write to file
    fs.appendFileSync(logFile, logLine)

    // Also console
    console.log(msg)
  }
})

console.log(`Debug logs written to: ${logFile}`)
```

### Method 5: Structured Logging

```typescript
import winston from 'winston'

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'adapter-debug.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
})

const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  debug: true,
  logger: (msg) => logger.debug(msg)
})
```

## Debug Output Explained

### Agent Execution Lifecycle

```
[DEBUG] Agent execution starting
[DEBUG]   Agent ID: file-analyzer
[DEBUG]   Prompt: Analyze TypeScript files
[DEBUG]   Params: {"pattern":"*.ts"}
[DEBUG]   Max steps: 20

[DEBUG] Step 1: Tool call
[DEBUG]   Tool: find_files
[DEBUG]   Input: {"pattern":"**/*.ts"}

[DEBUG] Step 1: Tool result
[DEBUG]   Type: json
[DEBUG]   Value: ["src/index.ts","src/utils.ts"]

[DEBUG] Step 2: Tool call
[DEBUG]   Tool: read_files
[DEBUG]   Input: {"paths":["src/index.ts","src/utils.ts"]}

[DEBUG] Step 2: Tool result
[DEBUG]   Type: json
[DEBUG]   Value: {"src/index.ts":"...","src/utils.ts":"..."}

[DEBUG] Step 3: Tool call
[DEBUG]   Tool: set_output
[DEBUG]   Input: {"output":{"files":2,"analyzed":true}}

[DEBUG] Agent execution completed
[DEBUG]   Status: Completed normally
[DEBUG]   Iterations: 3
[DEBUG]   Execution time: 127ms
```

### What Each Log Means

**Agent Execution Starting:**
```
[DEBUG] Agent execution starting
```
- Agent has been called
- About to initialize context
- handleSteps will begin

**Tool Call:**
```
[DEBUG] Tool call: find_files
[DEBUG]   Input: {"pattern":"*.ts"}
```
- Generator yielded a tool call
- Shows tool name and parameters
- Tool is about to execute

**Tool Result:**
```
[DEBUG] Tool result: {"type":"json","value":[...]}
```
- Tool execution completed
- Shows the result returned to agent
- Agent will process this result

**Context Update:**
```
[DEBUG] Context updated
[DEBUG]   Message count: 2
[DEBUG]   Agent state keys: ["initialized","count"]
```
- Context has new messages
- Shows current state

**Agent Completed:**
```
[DEBUG] Agent completed normally
[DEBUG]   Iterations: 5
[DEBUG]   Time: 234ms
```
- Agent finished successfully
- Shows performance metrics

### Error Logs

**Tool Execution Error:**
```
[ERROR] Tool execution failed: read_files
[ERROR]   Input: {"paths":["missing.txt"]}
[ERROR]   Error: File not found
[ERROR]   Stack: ...
```

**Path Traversal Error:**
```
[ERROR] Security violation detected
[ERROR]   Tool: read_files
[ERROR]   Path: ../../../etc/passwd
[ERROR]   Reason: Path traversal attempt
[ERROR]   Blocked: true
```

**Timeout Error:**
```
[ERROR] Command timed out
[ERROR]   Tool: run_terminal_command
[ERROR]   Command: npm install
[ERROR]   Timeout: 30000ms
[ERROR]   Exit code: null
```

**Generator Error:**
```
[ERROR] Generator execution failed
[ERROR]   Agent: file-processor
[ERROR]   Iteration: 15
[ERROR]   Error: Maximum iterations exceeded
```

## Debug Levels

### Level 1: Basic Debugging

**Enable:** Default debug mode
```typescript
const adapter = createDebugAdapter(process.cwd())
```

**Shows:**
- Agent start/end
- Tool calls
- Tool results
- Basic errors

**Use When:**
- Normal development
- Basic troubleshooting
- Understanding agent flow

### Level 2: Verbose Debugging

**Enable:** Custom logger with details
```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  debug: true,
  logger: (msg) => {
    console.log(`[${new Date().toISOString()}] ${msg}`)

    // Log to file as well
    fs.appendFileSync('verbose.log', msg + '\n')
  }
})

// Also log inside handleSteps
handleSteps: function* ({ logger }) {
  logger.info('Step 1: Finding files')

  const { toolResult } = yield {
    toolName: 'find_files',
    input: { pattern: '*.ts' }
  }

  logger.info('Found files', { count: toolResult[0].value.length })
  logger.debug('Files', { files: toolResult[0].value })
}
```

**Shows:**
- Everything from Level 1
- Custom log messages
- Intermediate values
- Agent state changes

**Use When:**
- Deep troubleshooting
- Performance analysis
- Complex agent debugging

### Level 3: Everything (Debug + Inspect)

**Enable:** Debug + Node inspector
```typescript
// Enable debug
const adapter = createDebugAdapter(process.cwd())

// Add breakpoints in code
handleSteps: function* () {
  debugger // Pause here

  const { toolResult } = yield {
    toolName: 'find_files',
    input: { pattern: '*.ts' }
  }

  debugger // Pause here to inspect result

  console.log('Tool result:', JSON.stringify(toolResult, null, 2))
}
```

**Run with inspector:**
```bash
node --inspect-brk your-script.js
```

**Shows:**
- Everything from Level 2
- Variable values at breakpoints
- Call stack
- Memory usage
- Step-by-step execution

**Use When:**
- Fixing complex bugs
- Understanding control flow
- Investigating memory issues
- Learning the codebase

## Common Debug Scenarios

### Scenario 1: Agent Not Producing Output

**Problem:**
```typescript
const result = await adapter.executeAgent(myAgent, 'Test')
console.log(result.output) // undefined
```

**Debug Steps:**

**1. Enable Debug Mode:**
```typescript
const adapter = createDebugAdapter(process.cwd())
```

**2. Check for set_output Call:**
```
[DEBUG] Tool call: find_files
[DEBUG] Tool call: read_files
[DEBUG] Agent completed
// No set_output call!
```

**3. Fix by Adding set_output:**
```typescript
handleSteps: function* () {
  const { toolResult } = yield {
    toolName: 'find_files',
    input: { pattern: '*.ts' }
  }

  // Add this!
  yield {
    toolName: 'set_output',
    input: { output: toolResult[0].value }
  }
}
```

**4. Verify Fix:**
```
[DEBUG] Tool call: find_files
[DEBUG] Tool call: read_files
[DEBUG] Tool call: set_output  ← Now present!
[DEBUG] Agent completed
```

### Scenario 2: Tool Failing Silently

**Problem:**
```typescript
// No error, but wrong results
const result = await adapter.executeAgent(myAgent, 'Test')
console.log(result.output) // Empty or wrong
```

**Debug Steps:**

**1. Add Logging in handleSteps:**
```typescript
handleSteps: function* ({ logger }) {
  logger.info('Starting agent')

  const { toolResult } = yield {
    toolName: 'find_files',
    input: { pattern: '*.ts' }
  }

  logger.info('Find result', { result: toolResult[0].value })

  if (!toolResult[0].value || toolResult[0].value.length === 0) {
    logger.warn('No files found!')
  }

  yield {
    toolName: 'set_output',
    input: { output: toolResult[0].value }
  }
}
```

**2. Check Debug Output:**
```
[INFO] Starting agent
[DEBUG] Tool call: find_files
[DEBUG] Tool result: {"type":"json","value":[]}
[WARN] No files found!
```

**3. Fix the Pattern:**
```typescript
// Wrong: Missing **
pattern: '*.ts'  // Only finds files in root

// Correct: Include subdirectories
pattern: '**/*.ts'  // Finds files in all directories
```

### Scenario 3: Infinite Loop

**Problem:**
```
[DEBUG] Agent execution starting
[DEBUG] Step 1: Tool call: find_files
[DEBUG] Step 2: Tool call: find_files
[DEBUG] Step 3: Tool call: find_files
...
[DEBUG] Step 100: Tool call: find_files
[ERROR] Maximum iterations exceeded
```

**Debug Steps:**

**1. Add Iteration Counter:**
```typescript
handleSteps: function* ({ agentState, logger }) {
  let iteration = agentState.iteration || 0
  logger.info('Iteration', { iteration })

  while (someCondition) {
    iteration++
    logger.info('Loop iteration', { iteration })

    if (iteration > 10) {
      logger.error('Too many iterations, breaking')
      break
    }

    yield {
      toolName: 'find_files',
      input: { pattern: '*.ts' }
    }
  }
}
```

**2. Check Debug Output:**
```
[INFO] Iteration: 0
[INFO] Loop iteration: 1
[INFO] Loop iteration: 2
...
[INFO] Loop iteration: 11
[ERROR] Too many iterations, breaking
```

**3. Fix the Logic:**
```typescript
// Add exit condition
while (files.length < maxFiles && iteration < maxIterations) {
  // Process files
  iteration++
}
```

### Scenario 4: Slow Performance

**Problem:**
Agent takes too long to execute.

**Debug Steps:**

**1. Add Timing:**
```typescript
handleSteps: function* ({ logger }) {
  const startTime = Date.now()

  // Step 1
  const step1Start = Date.now()
  const { toolResult: result1 } = yield {
    toolName: 'find_files',
    input: { pattern: '**/*' }
  }
  logger.info('Step 1 time', { ms: Date.now() - step1Start })

  // Step 2
  const step2Start = Date.now()
  const { toolResult: result2 } = yield {
    toolName: 'read_files',
    input: { paths: result1[0].value }
  }
  logger.info('Step 2 time', { ms: Date.now() - step2Start })

  logger.info('Total time', { ms: Date.now() - startTime })
}
```

**2. Check Debug Output:**
```
[INFO] Step 1 time: {"ms":45}
[INFO] Step 2 time: {"ms":1523}  ← Bottleneck!
[INFO] Total time: {"ms":1568}
```

**3. Optimize:**
```typescript
// Limit files to read
const files = result1[0].value.slice(0, 50)  // Only first 50

// Or use more specific pattern
pattern: 'src/**/*.ts'  // Instead of '**/*'
```

### Scenario 5: Path Traversal Blocked

**Problem:**
```
[ERROR] Path traversal detected
```

**Debug Steps:**

**1. Check Exact Path:**
```typescript
handleSteps: function* ({ logger }) {
  const path = '../../../etc/passwd'
  logger.info('Attempting to read', { path })

  try {
    const { toolResult } = yield {
      toolName: 'read_files',
      input: { paths: [path] }
    }
  } catch (error) {
    logger.error('Read failed', { error: error.message })
  }
}
```

**2. Debug Output:**
```
[INFO] Attempting to read: {"path":"../../../etc/passwd"}
[ERROR] Path traversal detected: resolves to /etc/passwd outside /home/user/project
[ERROR] Read failed: {"error":"Path traversal detected..."}
```

**3. Fix:**
```typescript
// Use relative path within cwd
const path = 'config/settings.json'

// Or change adapter cwd to parent directory
const adapter = new ClaudeCodeCLIAdapter({
  cwd: '/home/user'  // Higher level
})
```

## Using Node Debugger

### Setting Up Debugger

**1. Add debugger Statements:**
```typescript
import { createDebugAdapter } from '@codebuff/adapter'

async function main() {
  const adapter = createDebugAdapter(process.cwd())

  const agent = {
    id: 'test',
    toolNames: ['find_files', 'set_output'],
    handleSteps: function* () {
      debugger // Pause here

      const { toolResult } = yield {
        toolName: 'find_files',
        input: { pattern: '*.ts' }
      }

      debugger // Pause here to inspect result

      const files = toolResult[0].value
      console.log('Files:', files)

      debugger // Pause before output

      yield {
        toolName: 'set_output',
        input: { output: files }
      }
    }
  }

  adapter.registerAgent(agent)

  debugger // Pause before execution

  const result = await adapter.executeAgent(agent, 'Test')

  debugger // Pause after execution

  console.log('Result:', result)
}

main()
```

**2. Run with Inspector:**
```bash
# Chrome DevTools (recommended)
node --inspect-brk your-script.js

# Then open: chrome://inspect in Chrome
```

**3. Debug in VS Code:**

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Agent",
      "program": "${workspaceFolder}/your-script.ts",
      "preLaunchTask": "tsc: build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "console": "integratedTerminal"
    }
  ]
}
```

Press F5 to start debugging.

### Inspector Features

**Breakpoints:**
- Click line number in VS Code
- Or add `debugger` statement

**Watch Variables:**
```typescript
// Add to Watch panel
toolResult[0].value
agentState
params
```

**Call Stack:**
- See function call hierarchy
- Navigate up/down the stack
- Inspect variables at each level

**Console:**
- Evaluate expressions
- Call functions
- Modify variables

**Step Controls:**
- Step Over (F10): Execute current line
- Step Into (F11): Enter function calls
- Step Out (Shift+F11): Exit current function
- Continue (F5): Run until next breakpoint

### Debugging Example Session

```typescript
// Script with breakpoints
async function debug() {
  const adapter = createDebugAdapter(process.cwd())

  const agent = {
    id: 'debug-test',
    toolNames: ['find_files', 'read_files', 'set_output'],
    handleSteps: function* () {
      // Breakpoint 1
      debugger
      console.log('Step 1: Finding files')

      const { toolResult: findResult } = yield {
        toolName: 'find_files',
        input: { pattern: '**/*.ts' }
      }

      // Breakpoint 2 - inspect findResult
      debugger
      const files = findResult[0].value
      console.log('Found files:', files.length)

      const { toolResult: readResult } = yield {
        toolName: 'read_files',
        input: { paths: files.slice(0, 5) }
      }

      // Breakpoint 3 - inspect readResult
      debugger
      console.log('Read files:', Object.keys(readResult[0].value))

      yield {
        toolName: 'set_output',
        input: { output: readResult[0].value }
      }
    }
  }

  adapter.registerAgent(agent)

  // Breakpoint 4 - before execution
  debugger

  const result = await adapter.executeAgent(agent, 'Debug test')

  // Breakpoint 5 - after execution
  debugger
  console.log('Final result:', result.output)
}

debug()
```

**Debug Session:**
```
1. Start: node --inspect-brk debug.js
2. Open chrome://inspect
3. Hit Continue to reach Breakpoint 1
4. Inspect variables: pattern, agent definition
5. Step through tool execution
6. Check findResult at Breakpoint 2
7. Verify files array
8. Continue to Breakpoint 3
9. Inspect readResult contents
10. Step through to completion
```

## Performance Profiling

### Basic Profiling

```typescript
import { createDebugAdapter } from '@codebuff/adapter'

async function profileAgent() {
  const adapter = createDebugAdapter(process.cwd())

  const agent = {
    id: 'profiled-agent',
    toolNames: ['find_files', 'read_files', 'code_search', 'set_output'],
    handleSteps: function* ({ logger }) {
      const startTime = Date.now()
      const timings = []

      // Operation 1
      const op1Start = Date.now()
      const { toolResult: findResult } = yield {
        toolName: 'find_files',
        input: { pattern: '**/*.ts' }
      }
      timings.push({ op: 'find_files', ms: Date.now() - op1Start })

      // Operation 2
      const op2Start = Date.now()
      const { toolResult: readResult } = yield {
        toolName: 'read_files',
        input: { paths: findResult[0].value }
      }
      timings.push({ op: 'read_files', ms: Date.now() - op2Start })

      // Operation 3
      const op3Start = Date.now()
      const { toolResult: searchResult } = yield {
        toolName: 'code_search',
        input: { query: 'TODO' }
      }
      timings.push({ op: 'code_search', ms: Date.now() - op3Start })

      const totalTime = Date.now() - startTime

      // Log performance report
      logger.info('Performance Report', {
        totalTime,
        operations: timings,
        breakdown: timings.map(t => `${t.op}: ${t.ms}ms`).join(', ')
      })

      yield {
        toolName: 'set_output',
        input: {
          output: {
            timings,
            totalTime,
            slowest: timings.sort((a, b) => b.ms - a.ms)[0]
          }
        }
      }
    }
  }

  adapter.registerAgent(agent)
  const result = await adapter.executeAgent(agent, 'Profile test')

  console.log('\n=== Performance Report ===')
  console.log(`Total Time: ${result.output.totalTime}ms`)
  console.log(`Slowest Operation: ${result.output.slowest.op} (${result.output.slowest.ms}ms)`)
  console.log('\nBreakdown:')
  result.output.timings.forEach(t => {
    const percent = ((t.ms / result.output.totalTime) * 100).toFixed(1)
    console.log(`  ${t.op}: ${t.ms}ms (${percent}%)`)
  })
}

profileAgent()
```

**Output:**
```
=== Performance Report ===
Total Time: 1523ms
Slowest Operation: read_files (1245ms)

Breakdown:
  find_files: 45ms (3.0%)
  read_files: 1245ms (81.7%)
  code_search: 233ms (15.3%)
```

### Node.js Profiler

**1. Run with Profiler:**
```bash
node --prof your-script.js
```

**2. Generate Report:**
```bash
node --prof-process isolate-*.log > profile.txt
```

**3. View Report:**
```bash
cat profile.txt
```

**Output shows:**
- Function call percentages
- Time spent in each function
- Bottlenecks

### Memory Profiling

```typescript
async function profileMemory() {
  const adapter = createDebugAdapter(process.cwd())

  // Get baseline
  const baseline = process.memoryUsage()
  console.log('Baseline memory:', formatMemory(baseline))

  const agent = {
    id: 'memory-test',
    toolNames: ['find_files', 'read_files', 'set_output'],
    handleSteps: function* ({ logger }) {
      // Before operation
      const before = process.memoryUsage()
      logger.info('Memory before', formatMemory(before))

      const { toolResult } = yield {
        toolName: 'find_files',
        input: { pattern: '**/*' }
      }

      // After operation
      const after = process.memoryUsage()
      logger.info('Memory after', formatMemory(after))

      const delta = {
        heapUsed: after.heapUsed - before.heapUsed,
        external: after.external - before.external
      }

      logger.info('Memory delta', formatMemory(delta))

      yield {
        toolName: 'set_output',
        input: { output: delta }
      }
    }
  }

  adapter.registerAgent(agent)
  await adapter.executeAgent(agent, 'Memory test')

  // Final memory usage
  const final = process.memoryUsage()
  console.log('Final memory:', formatMemory(final))

  // Force garbage collection (requires --expose-gc flag)
  if (global.gc) {
    global.gc()
    const afterGC = process.memoryUsage()
    console.log('After GC:', formatMemory(afterGC))
  }
}

function formatMemory(mem) {
  return {
    heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    external: `${(mem.external / 1024 / 1024).toFixed(2)} MB`,
    rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`
  }
}

// Run with: node --expose-gc your-script.js
profileMemory()
```

## Advanced Debugging

### Conditional Breakpoints

```typescript
handleSteps: function* () {
  for (let i = 0; i < 100; i++) {
    // Only break on iteration 50
    if (i === 50) {
      debugger
    }

    yield {
      toolName: 'find_files',
      input: { pattern: `**/*.${i}.ts` }
    }
  }
}
```

### Error Context Debugging

```typescript
import { isAdapterError, isToolExecutionError } from '@codebuff/adapter'

async function debugErrors() {
  const adapter = createDebugAdapter(process.cwd())

  try {
    const result = await adapter.executeAgent(myAgent, 'Test')
  } catch (error) {
    if (isAdapterError(error)) {
      console.error('=== Adapter Error ===')
      console.error('Message:', error.message)
      console.error('Timestamp:', error.timestamp)
      console.error('Agent ID:', error.agentId)
      console.error('Context:', error.context)

      if (error.originalError) {
        console.error('\n=== Original Error ===')
        console.error('Message:', error.originalError.message)
        console.error('Stack:', error.originalStack)
      }

      // Detailed string
      console.error('\n=== Detailed ===')
      console.error(error.toDetailedString())

      // JSON output
      console.error('\n=== JSON ===')
      console.error(JSON.stringify(error.toJSON(), null, 2))
    }

    if (isToolExecutionError(error)) {
      console.error('\n=== Tool Specific ===')
      console.error('Tool Name:', error.toolName)
      console.error('Tool Input:', error.toolInput)
    }
  }
}
```

### Trace Complete Execution

```typescript
const executionTrace = []

const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  debug: true,
  logger: (msg) => {
    // Capture all debug output
    executionTrace.push({
      timestamp: new Date(),
      message: msg
    })

    console.log(msg)
  }
})

// After execution
await adapter.executeAgent(myAgent, 'Test')

// Save trace
fs.writeFileSync(
  'execution-trace.json',
  JSON.stringify(executionTrace, null, 2)
)

// Analyze trace
console.log(`Total messages: ${executionTrace.length}`)
console.log(`Duration: ${executionTrace[executionTrace.length - 1].timestamp - executionTrace[0].timestamp}ms`)
```

### Debug Agent State

```typescript
handleSteps: function* ({ agentState, logger }) {
  // Initialize state
  if (!agentState.initialized) {
    agentState.initialized = true
    agentState.count = 0
    agentState.results = []
  }

  // Log state before operation
  logger.debug('State before', {
    count: agentState.count,
    resultsLength: agentState.results.length
  })

  // Perform operation
  agentState.count++
  agentState.results.push('new result')

  // Log state after operation
  logger.debug('State after', {
    count: agentState.count,
    resultsLength: agentState.results.length
  })

  // Checkpoint state
  logger.info('State checkpoint', {
    state: JSON.parse(JSON.stringify(agentState))
  })
}
```

### Interactive Debugging

```typescript
import readline from 'readline'

async function interactiveDebug() {
  const adapter = createDebugAdapter(process.cwd())

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const agent = {
    id: 'interactive',
    toolNames: ['find_files', 'read_files', 'set_output'],
    handleSteps: function* ({ logger }) {
      // Pause for user input
      const pattern = await new Promise(resolve => {
        rl.question('Enter file pattern: ', resolve)
      })

      logger.info('Using pattern', { pattern })

      const { toolResult } = yield {
        toolName: 'find_files',
        input: { pattern }
      }

      // Show results and ask to continue
      console.log('Found files:', toolResult[0].value)
      const shouldContinue = await new Promise(resolve => {
        rl.question('Continue to read files? (y/n): ', answer => {
          resolve(answer.toLowerCase() === 'y')
        })
      })

      if (!shouldContinue) {
        yield {
          toolName: 'set_output',
          input: { output: 'Cancelled' }
        }
        return
      }

      // Continue with reading
      const { toolResult: readResult } = yield {
        toolName: 'read_files',
        input: { paths: toolResult[0].value }
      }

      yield {
        toolName: 'set_output',
        input: { output: readResult[0].value }
      }
    }
  }

  adapter.registerAgent(agent)
  const result = await adapter.executeAgent(agent, 'Interactive')

  console.log('Final result:', result.output)
  rl.close()
}

interactiveDebug()
```

---

## Debug Checklist

When debugging an agent issue:

- [ ] Enable debug mode (`createDebugAdapter`)
- [ ] Check agent registration
- [ ] Verify tool names are correct
- [ ] Look for `set_output` call
- [ ] Check tool result formats
- [ ] Add logging in handleSteps
- [ ] Profile slow operations
- [ ] Use breakpoints for complex logic
- [ ] Trace complete execution
- [ ] Check error context
- [ ] Review agent state changes
- [ ] Verify file paths
- [ ] Test with minimal agent first

## Summary

**Quick Debug Commands:**
```bash
# Basic debug
node your-script.js

# With inspector
node --inspect-brk your-script.js

# With profiling
node --prof your-script.js

# With memory debugging
node --expose-gc your-script.js

# Generate profile report
node --prof-process isolate-*.log > profile.txt
```

**Debug in Code:**
```typescript
// 1. Enable debug
const adapter = createDebugAdapter(process.cwd())

// 2. Add logging
handleSteps: function* ({ logger }) {
  logger.info('Step starting')
}

// 3. Add breakpoints
debugger

// 4. Profile performance
const start = Date.now()
// ... operation ...
console.log('Time:', Date.now() - start)

// 5. Check errors
try {
  await adapter.executeAgent(agent, 'Test')
} catch (error) {
  console.error(error.toDetailedString())
}
```

**Next Steps:**
- See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for specific problems
- See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for testing strategies
- See [FAQ_FREE_MODE.md](./FAQ_FREE_MODE.md) for common questions
