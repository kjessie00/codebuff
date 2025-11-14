# Testing Guide for FREE Mode

Complete guide to testing your Claude Code CLI adapter agents in FREE mode (no API key required).

## Table of Contents

- [Why Test Your Agents?](#why-test-your-agents)
- [Testing Levels](#testing-levels)
  - [Unit Testing](#unit-testing-your-agents)
  - [Integration Testing](#integration-testing)
  - [Manual Testing](#manual-testing)
- [Testing Patterns](#testing-patterns)
- [Test Organization](#test-organization)
- [Running Tests](#running-tests)
- [Debugging Failed Tests](#debugging-failed-tests)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)

## Why Test Your Agents?

Testing your agents ensures:

- **Reliability**: Your agents work as expected across different scenarios
- **Regression Prevention**: New changes don't break existing functionality
- **Documentation**: Tests serve as living examples of how agents work
- **Confidence**: Deploy changes knowing they won't cause issues
- **Debugging**: Identify issues quickly with automated test feedback

## Testing Levels

### Unit Testing Your Agents

Unit tests verify individual agent behaviors in isolation. Perfect for testing tool configuration, handleSteps logic, and error handling.

#### Testing Agent Configuration

```typescript
import { describe, test, expect } from 'bun:test'
import type { AgentDefinition } from '../../.agents/types/agent-definition'

describe('FilePickerAgent Configuration', () => {
  const filePickerAgent: AgentDefinition = {
    id: 'file-picker',
    displayName: 'File Picker',
    model: 'anthropic/claude-sonnet-4.5',
    toolNames: ['find_files', 'read_files', 'set_output'],
    systemPrompt: 'You help users find and read files.',
    handleSteps: function* ({ params }) {
      // Agent logic here
    }
  }

  test('should have correct agent ID', () => {
    expect(filePickerAgent.id).toBe('file-picker')
  })

  test('should include required tools', () => {
    expect(filePickerAgent.toolNames).toContain('find_files')
    expect(filePickerAgent.toolNames).toContain('set_output')
  })

  test('should have handleSteps generator', () => {
    expect(filePickerAgent.handleSteps).toBeDefined()
    expect(typeof filePickerAgent.handleSteps).toBe('function')
  })
})
```

#### Testing handleSteps Logic

```typescript
import { describe, test, expect, beforeEach } from 'bun:test'
import { ClaudeCodeCLIAdapter } from '../src/claude-cli-adapter'
import path from 'path'
import { promises as fs } from 'fs'
import os from 'os'

describe('FilePickerAgent handleSteps', () => {
  let adapter: ClaudeCodeCLIAdapter
  let tempDir: string

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-test-'))

    // Create adapter instance
    adapter = new ClaudeCodeCLIAdapter({
      cwd: tempDir,
      debug: false
    })
  })

  afterEach(async () => {
    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  test('should find TypeScript files', async () => {
    // Setup: Create test files
    await fs.writeFile(path.join(tempDir, 'test.ts'), 'export const x = 1')
    await fs.writeFile(path.join(tempDir, 'test.js'), 'module.exports = {}')

    const agent: AgentDefinition = {
      id: 'test-finder',
      displayName: 'Test Finder',
      toolNames: ['find_files', 'set_output'],
      handleSteps: function* ({ params }) {
        // Find TypeScript files
        const { toolResult } = yield {
          toolName: 'find_files',
          input: { pattern: '*.ts' }
        }

        // Set output
        yield {
          toolName: 'set_output',
          input: { output: toolResult[0].value }
        }
      }
    }

    adapter.registerAgent(agent)
    const result = await adapter.executeAgent(agent, 'Find TS files')

    // Verify results
    expect(result.output).toBeDefined()
    expect(result.output).toContain('test.ts')
    expect(result.output).not.toContain('test.js')
  })

  test('should handle missing files gracefully', async () => {
    const agent: AgentDefinition = {
      id: 'file-reader',
      displayName: 'File Reader',
      toolNames: ['read_files', 'set_output'],
      handleSteps: function* () {
        const { toolResult } = yield {
          toolName: 'read_files',
          input: { paths: ['missing.txt'] }
        }

        const files = toolResult[0].value
        const output = files['missing.txt'] === null
          ? 'File not found'
          : 'File exists'

        yield {
          toolName: 'set_output',
          input: { output }
        }
      }
    }

    adapter.registerAgent(agent)
    const result = await adapter.executeAgent(agent, 'Read file')

    expect(result.output).toBe('File not found')
  })
})
```

#### Mocking Tool Execution

```typescript
import { describe, test, expect, mock } from 'bun:test'

describe('Agent with Mocked Tools', () => {
  test('should handle mocked tool results', async () => {
    // Create mock adapter
    const mockAdapter = {
      executeAgent: mock(async () => ({
        output: ['file1.ts', 'file2.ts'],
        messageHistory: [],
        metadata: { iterationCount: 2, completedNormally: true }
      }))
    }

    // Test agent execution
    const result = await mockAdapter.executeAgent(
      {} as any,
      'Find files'
    )

    expect(result.output).toHaveLength(2)
    expect(mockAdapter.executeAgent).toHaveBeenCalledTimes(1)
  })
})
```

#### Testing Error Handling

```typescript
import { describe, test, expect } from 'bun:test'
import { ToolExecutionError, ValidationError } from '../src/errors'

describe('Agent Error Handling', () => {
  test('should catch and handle tool execution errors', async () => {
    const agent: AgentDefinition = {
      id: 'error-handler',
      displayName: 'Error Handler',
      toolNames: ['read_files', 'set_output'],
      handleSteps: function* () {
        try {
          const { toolResult } = yield {
            toolName: 'read_files',
            input: { paths: ['../../../etc/passwd'] }
          }

          yield {
            toolName: 'set_output',
            input: { output: 'Should not reach here' }
          }
        } catch (error) {
          yield {
            toolName: 'set_output',
            input: { output: 'Error caught successfully' }
          }
        }
      }
    }

    // This should throw a path traversal error
    await expect(async () => {
      await adapter.executeAgent(agent, 'Test error')
    }).toThrow(/Path traversal/)
  })

  test('should validate input parameters', () => {
    const invalidPath = '../../../etc/passwd'

    expect(() => {
      // Validation should fail
      validatePath(invalidPath, '/safe/working/dir')
    }).toThrow(ValidationError)
  })
})
```

### Integration Testing

Integration tests verify complete agent workflows, including tool interactions and multi-step processes.

#### Setting Up Test Environment

```typescript
import { describe, test, beforeAll, afterAll } from 'bun:test'
import { ClaudeCodeCLIAdapter } from '../src/claude-cli-adapter'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

describe('Integration Tests', () => {
  let adapter: ClaudeCodeCLIAdapter
  let testProjectDir: string

  beforeAll(async () => {
    // Create a complete test project structure
    testProjectDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'integration-test-')
    )

    // Create test files
    await fs.mkdir(path.join(testProjectDir, 'src'), { recursive: true })
    await fs.writeFile(
      path.join(testProjectDir, 'src/index.ts'),
      'export const VERSION = "1.0.0"'
    )
    await fs.writeFile(
      path.join(testProjectDir, 'package.json'),
      JSON.stringify({ name: 'test-project', version: '1.0.0' })
    )

    // Initialize adapter
    adapter = new ClaudeCodeCLIAdapter({
      cwd: testProjectDir,
      debug: true
    })
  })

  afterAll(async () => {
    // Cleanup
    await fs.rm(testProjectDir, { recursive: true, force: true })
  })

  test('complete workflow: find, read, analyze', async () => {
    const agent: AgentDefinition = {
      id: 'analyzer',
      displayName: 'Code Analyzer',
      toolNames: ['find_files', 'read_files', 'write_file', 'set_output'],
      handleSteps: function* () {
        // Step 1: Find TypeScript files
        const { toolResult: findResult } = yield {
          toolName: 'find_files',
          input: { pattern: 'src/**/*.ts' }
        }

        const files = findResult[0].value

        // Step 2: Read the files
        const { toolResult: readResult } = yield {
          toolName: 'read_files',
          input: { paths: files }
        }

        // Step 3: Analyze and write report
        const fileContents = readResult[0].value
        const report = `# Analysis Report\n\nFound ${files.length} files\n`

        yield {
          toolName: 'write_file',
          input: {
            path: 'analysis-report.md',
            content: report
          }
        }

        // Step 4: Set output
        yield {
          toolName: 'set_output',
          input: { output: { files, report } }
        }
      }
    }

    adapter.registerAgent(agent)
    const result = await adapter.executeAgent(agent, 'Analyze code')

    // Verify complete workflow
    expect(result.output).toBeDefined()
    expect(result.output.files).toContain('src/index.ts')

    // Verify report was created
    const reportExists = await fs.access(
      path.join(testProjectDir, 'analysis-report.md')
    ).then(() => true).catch(() => false)

    expect(reportExists).toBe(true)
  })
})
```

#### Testing with Real Files

```typescript
describe('Real File Operations', () => {
  test('should read actual project files', async () => {
    const agent: AgentDefinition = {
      id: 'config-reader',
      displayName: 'Config Reader',
      toolNames: ['read_files', 'set_output'],
      handleSteps: function* () {
        const { toolResult } = yield {
          toolName: 'read_files',
          input: { paths: ['package.json', 'tsconfig.json'] }
        }

        const files = toolResult[0].value
        const packageJson = JSON.parse(files['package.json'])

        yield {
          toolName: 'set_output',
          input: { output: packageJson.name }
        }
      }
    }

    adapter.registerAgent(agent)
    const result = await adapter.executeAgent(agent, 'Read config')

    expect(result.output).toBe('test-project')
  })

  test('should write and verify files', async () => {
    const testContent = '# Test Document\n\nGenerated at: ' + new Date().toISOString()

    const agent: AgentDefinition = {
      id: 'writer',
      displayName: 'File Writer',
      toolNames: ['write_file', 'read_files', 'set_output'],
      handleSteps: function* () {
        // Write file
        yield {
          toolName: 'write_file',
          input: {
            path: 'test-output.md',
            content: testContent
          }
        }

        // Read it back
        const { toolResult } = yield {
          toolName: 'read_files',
          input: { paths: ['test-output.md'] }
        }

        yield {
          toolName: 'set_output',
          input: { output: toolResult[0].value['test-output.md'] }
        }
      }
    }

    adapter.registerAgent(agent)
    const result = await adapter.executeAgent(agent, 'Write and read')

    expect(result.output).toBe(testContent)
  })
})
```

### Manual Testing

Manual testing helps verify agent behavior interactively and catch edge cases.

#### Interactive Testing

```typescript
// manual-test.ts
import { createDebugAdapter } from './src'
import readline from 'readline'

async function interactiveTest() {
  const adapter = createDebugAdapter(process.cwd())

  // Register your agent
  adapter.registerAgent(myAgent)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  console.log('Interactive Agent Tester')
  console.log('========================')
  console.log('Enter prompts to test your agent. Type "exit" to quit.\n')

  const askQuestion = () => {
    rl.question('Prompt: ', async (prompt) => {
      if (prompt.toLowerCase() === 'exit') {
        rl.close()
        return
      }

      try {
        const result = await adapter.executeAgent(myAgent, prompt)
        console.log('\nResult:', JSON.stringify(result.output, null, 2))
        console.log('\nIterations:', result.metadata?.iterationCount)
        console.log('Completed:', result.metadata?.completedNormally)
      } catch (error) {
        console.error('Error:', error)
      }

      console.log('\n')
      askQuestion()
    })
  }

  askQuestion()
}

interactiveTest()
```

#### Debug Mode Usage

```typescript
// Enable debug mode to see detailed execution logs
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  debug: true, // Enable debug logging
  logger: (msg) => {
    // Custom logger
    console.log(`[${new Date().toISOString()}] ${msg}`)
  }
})

// Execute agent with debug output
const result = await adapter.executeAgent(myAgent, 'Test prompt')

// Debug output will show:
// - Agent execution start/end
// - Each tool call and its parameters
// - Tool execution results
// - Context state changes
// - Any errors or warnings
```

## Testing Patterns

### Pattern 1: Test with Mock Data

```typescript
describe('Pattern: Mock Data Testing', () => {
  test('should process mock file data', async () => {
    // Mock file contents
    const mockFiles = {
      'config.json': JSON.stringify({ apiUrl: 'https://api.example.com' }),
      'data.txt': 'Sample data content'
    }

    const agent: AgentDefinition = {
      id: 'processor',
      displayName: 'Data Processor',
      toolNames: ['read_files', 'set_output'],
      handleSteps: function* () {
        const { toolResult } = yield {
          toolName: 'read_files',
          input: { paths: Object.keys(mockFiles) }
        }

        const config = JSON.parse(toolResult[0].value['config.json'])

        yield {
          toolName: 'set_output',
          input: { output: config.apiUrl }
        }
      }
    }

    // Setup: Write mock files
    for (const [path, content] of Object.entries(mockFiles)) {
      await fs.writeFile(path.join(tempDir, path), content)
    }

    adapter.registerAgent(agent)
    const result = await adapter.executeAgent(agent, 'Process data')

    expect(result.output).toBe('https://api.example.com')
  })
})
```

### Pattern 2: Test with Real Files

```typescript
describe('Pattern: Real File Testing', () => {
  test('should analyze actual project structure', async () => {
    const agent: AgentDefinition = {
      id: 'structure-analyzer',
      displayName: 'Structure Analyzer',
      toolNames: ['find_files', 'code_search', 'set_output'],
      handleSteps: function* () {
        // Find all TypeScript files
        const { toolResult: findResult } = yield {
          toolName: 'find_files',
          input: { pattern: '**/*.ts' }
        }

        // Search for TODO comments
        const { toolResult: searchResult } = yield {
          toolName: 'code_search',
          input: {
            query: 'TODO',
            file_pattern: '*.ts'
          }
        }

        yield {
          toolName: 'set_output',
          input: {
            output: {
              totalFiles: findResult[0].value.length,
              todosFound: searchResult[0].value.results.length
            }
          }
        }
      }
    }

    adapter.registerAgent(agent)
    const result = await adapter.executeAgent(agent, 'Analyze structure')

    expect(result.output.totalFiles).toBeGreaterThan(0)
    expect(result.output.todosFound).toBeGreaterThanOrEqual(0)
  })
})
```

### Pattern 3: Test Error Scenarios

```typescript
describe('Pattern: Error Scenario Testing', () => {
  test('should handle file not found error', async () => {
    const agent: AgentDefinition = {
      id: 'error-handler',
      displayName: 'Error Handler',
      toolNames: ['read_files', 'set_output'],
      handleSteps: function* () {
        const { toolResult } = yield {
          toolName: 'read_files',
          input: { paths: ['missing.txt'] }
        }

        const files = toolResult[0].value
        const output = files['missing.txt'] === null
          ? { status: 'error', message: 'File not found' }
          : { status: 'success', content: files['missing.txt'] }

        yield {
          toolName: 'set_output',
          input: { output }
        }
      }
    }

    adapter.registerAgent(agent)
    const result = await adapter.executeAgent(agent, 'Handle error')

    expect(result.output.status).toBe('error')
    expect(result.output.message).toBe('File not found')
  })

  test('should handle path traversal attempts', async () => {
    await expect(async () => {
      const { toolResult } = await adapter.executeTool({
        toolName: 'read_files',
        input: { paths: ['../../../etc/passwd'] }
      })
    }).toThrow(/Path traversal detected/)
  })

  test('should handle timeout scenarios', async () => {
    const agent: AgentDefinition = {
      id: 'timeout-tester',
      displayName: 'Timeout Tester',
      toolNames: ['run_terminal_command', 'set_output'],
      handleSteps: function* () {
        const { toolResult } = yield {
          toolName: 'run_terminal_command',
          input: {
            command: 'sleep 5',
            timeout_seconds: 1 // Will timeout
          }
        }

        yield {
          toolName: 'set_output',
          input: { output: toolResult[0].value }
        }
      }
    }

    adapter.registerAgent(agent)
    const result = await adapter.executeAgent(agent, 'Test timeout')

    expect(result.output.timedOut).toBe(true)
  })
})
```

### Pattern 4: Test Performance

```typescript
describe('Pattern: Performance Testing', () => {
  test('should complete within time limit', async () => {
    const startTime = Date.now()

    const agent: AgentDefinition = {
      id: 'fast-agent',
      displayName: 'Fast Agent',
      toolNames: ['find_files', 'set_output'],
      handleSteps: function* () {
        const { toolResult } = yield {
          toolName: 'find_files',
          input: { pattern: '*.ts' }
        }

        yield {
          toolName: 'set_output',
          input: { output: toolResult[0].value }
        }
      }
    }

    adapter.registerAgent(agent)
    await adapter.executeAgent(agent, 'Find files')

    const executionTime = Date.now() - startTime
    expect(executionTime).toBeLessThan(5000) // Should complete in < 5s
  })

  test('should handle large file sets efficiently', async () => {
    // Create 100 test files
    for (let i = 0; i < 100; i++) {
      await fs.writeFile(
        path.join(tempDir, `file-${i}.ts`),
        `export const value${i} = ${i}`
      )
    }

    const agent: AgentDefinition = {
      id: 'batch-reader',
      displayName: 'Batch Reader',
      toolNames: ['find_files', 'read_files', 'set_output'],
      handleSteps: function* () {
        const { toolResult: findResult } = yield {
          toolName: 'find_files',
          input: { pattern: '*.ts' }
        }

        const files = findResult[0].value

        // Read all files (should be parallelized)
        const startTime = Date.now()

        const { toolResult: readResult } = yield {
          toolName: 'read_files',
          input: { paths: files }
        }

        const readTime = Date.now() - startTime

        yield {
          toolName: 'set_output',
          input: {
            output: {
              filesRead: files.length,
              readTime
            }
          }
        }
      }
    }

    adapter.registerAgent(agent)
    const result = await adapter.executeAgent(agent, 'Read many files')

    expect(result.output.filesRead).toBe(100)
    // Parallel reads should be faster than sequential
    expect(result.output.readTime).toBeLessThan(1000)
  })
})
```

## Test Organization

### Directory Structure

```
adapter/
├── src/
│   └── tools/
│       ├── file-operations.ts
│       └── file-operations.test.ts    # Co-located with source
├── tests/
│   ├── unit/
│   │   ├── agents/
│   │   │   ├── file-picker.test.ts
│   │   │   └── code-analyzer.test.ts
│   │   └── tools/
│   │       ├── file-ops.test.ts
│   │       └── code-search.test.ts
│   ├── integration/
│   │   ├── workflows/
│   │   │   ├── complete-analysis.test.ts
│   │   │   └── multi-agent.test.ts
│   │   └── e2e/
│   │       └── full-execution.test.ts
│   └── fixtures/
│       ├── sample-project/
│       └── test-data/
├── package.json
└── bun.config.ts
```

### Naming Conventions

```typescript
// Test file naming: *.test.ts or *.spec.ts
// file-operations.test.ts
// code-analyzer.test.ts

// Test suite naming: Describe what you're testing
describe('FileOperationsTools', () => {
  // Group related tests
  describe('readFiles', () => {
    test('should read single file', async () => {})
    test('should read multiple files in parallel', async () => {})
    test('should return null for missing files', async () => {})
  })

  describe('writeFile', () => {
    test('should write new file', async () => {})
    test('should overwrite existing file', async () => {})
    test('should create parent directories', async () => {})
  })
})

// Test naming: Should be descriptive and action-oriented
// Good: 'should find all TypeScript files in src directory'
// Bad: 'test find files'
```

### Test Setup/Teardown

```typescript
import { describe, test, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test'

describe('Agent Test Suite', () => {
  // Run once before all tests in this suite
  beforeAll(async () => {
    // Initialize expensive resources
    // - Database connections
    // - External services
    // - Large data structures
  })

  // Run once after all tests in this suite
  afterAll(async () => {
    // Cleanup expensive resources
    // - Close connections
    // - Remove temporary data
  })

  // Run before each test
  beforeEach(async () => {
    // Reset test environment
    // - Create temp directory
    // - Initialize adapter
    // - Setup test data
  })

  // Run after each test
  afterEach(async () => {
    // Cleanup after each test
    // - Remove temp files
    // - Clear state
  })

  test('example test', async () => {
    // Test implementation
  })
})
```

### Shared Utilities

```typescript
// tests/utils/test-helpers.ts
import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

export async function createTestAdapter() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'))
  const adapter = new ClaudeCodeCLIAdapter({
    cwd: tempDir,
    debug: false
  })

  return { adapter, tempDir }
}

export async function cleanupTestAdapter(tempDir: string) {
  await fs.rm(tempDir, { recursive: true, force: true })
}

export async function createTestFiles(
  dir: string,
  files: Record<string, string>
) {
  for (const [filepath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, filepath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, content)
  }
}

// Usage in tests:
describe('Using Test Helpers', () => {
  let adapter: ClaudeCodeCLIAdapter
  let tempDir: string

  beforeEach(async () => {
    ({ adapter, tempDir } = await createTestAdapter())

    await createTestFiles(tempDir, {
      'src/index.ts': 'export const x = 1',
      'src/utils.ts': 'export const y = 2',
      'package.json': JSON.stringify({ name: 'test' })
    })
  })

  afterEach(async () => {
    await cleanupTestAdapter(tempDir)
  })

  test('example test with helpers', async () => {
    // Test implementation
  })
})
```

## Running Tests

### Run All Tests

```bash
# Using Bun
bun test

# Using npm scripts
npm test
```

### Run Specific Tests

```bash
# Run tests in specific file
bun test file-operations.test.ts

# Run tests matching pattern
bun test --test-name-pattern "file operations"

# Run tests in directory
bun test tests/unit/

# Run integration tests only
bun test tests/integration/
```

### Run in Watch Mode

```bash
# Watch mode - re-run tests on file changes
bun test --watch

# Watch specific directory
bun test --watch tests/unit/
```

### Generate Coverage

```bash
# Run tests with coverage
bun test --coverage

# Generate HTML coverage report
bun test --coverage --coverage-reporter=html

# View coverage report
open coverage/index.html
```

### Test Configuration

```javascript
// bun.config.ts
export default {
  test: {
    coverage: {
      enabled: true,
      reporter: ['text', 'html', 'json'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts'
      ]
    },
    timeout: 30000, // 30 second timeout per test
    bail: false, // Continue running tests after failure
  }
}
```

## Debugging Failed Tests

### Step 1: Read the Error Message

```
FAIL  src/tools/file-operations.test.ts > FileOperationsTools > readFiles > should read single file

AssertionError: expected null to be 'Hello, World!'

  Expected: "Hello, World!"
  Received: null

  at Object.<anonymous> (src/tools/file-operations.test.ts:44:30)
```

The error tells you:
- Which test failed
- What was expected vs received
- Line number where assertion failed

### Step 2: Check the Stack Trace

```
Error: Path traversal detected: /etc/passwd is outside working directory
    at FileOperationsTools.validatePath (src/tools/file-operations.ts:380)
    at FileOperationsTools.readFiles (src/tools/file-operations.ts:108)
    at Agent.handleSteps (tests/unit/agents/file-picker.test.ts:25)
```

Stack trace shows:
- Where the error originated
- Call chain leading to error
- Which file and line numbers

### Step 3: Add Debug Logging

```typescript
test('debugging example', async () => {
  console.log('Test starting...')

  const result = await tools.readFiles({ paths: ['test.txt'] })
  console.log('Result:', JSON.stringify(result, null, 2))

  expect(result[0].value['test.txt']).toBeDefined()
})
```

### Step 4: Use Debugger

```typescript
import { describe, test } from 'bun:test'

test('debug with breakpoint', async () => {
  const files = ['test.txt']

  debugger // Debugger will pause here

  const result = await tools.readFiles({ paths: files })

  debugger // Pause again to inspect result

  expect(result).toBeDefined()
})
```

Run with debugger:
```bash
bun --inspect-brk test file-operations.test.ts
```

### Step 5: Common Issues

#### Issue: Test timeout

```
Error: Test timeout of 5000ms exceeded
```

**Solution:** Increase timeout or check for infinite loops

```typescript
test('slow operation', async () => {
  // Increase timeout for this test
  await longRunningOperation()
}, { timeout: 30000 }) // 30 second timeout
```

#### Issue: Temp files not cleaned up

```
Error: EEXIST: file already exists
```

**Solution:** Ensure afterEach cleanup runs

```typescript
afterEach(async () => {
  try {
    await fs.rm(tempDir, { recursive: true, force: true })
  } catch (error) {
    console.warn('Cleanup failed:', error)
  }
})
```

#### Issue: Flaky tests (pass/fail randomly)

**Solution:** Identify and eliminate race conditions

```typescript
// Bad: Race condition
test('flaky test', async () => {
  const result = await startAsyncOperation()
  expect(result).toBeDefined() // Might not be ready yet
})

// Good: Wait for completion
test('stable test', async () => {
  const result = await startAsyncOperation()
  await waitForCompletion()
  expect(result).toBeDefined()
})
```

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: cd adapter && bun install

      - name: Run tests
        run: cd adapter && bun test

      - name: Generate coverage
        run: cd adapter && bun test --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./adapter/coverage/coverage-final.json
```

### GitLab CI Example

```yaml
# .gitlab-ci.yml
test:
  image: oven/bun:latest
  stage: test
  script:
    - cd adapter
    - bun install
    - bun test --coverage
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: adapter/coverage/cobertura-coverage.xml
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
```

### Jenkins Example

```groovy
// Jenkinsfile
pipeline {
  agent any

  stages {
    stage('Install') {
      steps {
        dir('adapter') {
          sh 'bun install'
        }
      }
    }

    stage('Test') {
      steps {
        dir('adapter') {
          sh 'bun test --coverage'
        }
      }
    }

    stage('Report') {
      steps {
        publishHTML([
          reportDir: 'adapter/coverage',
          reportFiles: 'index.html',
          reportName: 'Coverage Report'
        ])
      }
    }
  }
}
```

## Best Practices

### Test Naming Conventions

```typescript
// Good: Descriptive, behavior-focused
test('should return null for non-existent files', async () => {})
test('should create parent directories when writing nested files', async () => {})
test('should handle UTF-8 characters correctly', async () => {})

// Bad: Vague, implementation-focused
test('test readFiles', async () => {})
test('check if works', async () => {})
test('file test 1', async () => {})
```

### What to Test vs What to Skip

**DO Test:**
- Agent handleSteps logic and tool interactions
- Error handling and edge cases
- Input validation
- Tool parameter mapping
- File operations with various inputs
- Agent output correctness

**DON'T Test:**
- Third-party library internals (Node.js fs, glob, etc.)
- TypeScript type system
- Framework behavior (Bun test runner)
- External services (unless mocked)

### Test Isolation

```typescript
// Good: Each test is independent
describe('Isolated Tests', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true })
  })

  test('test 1', async () => {
    // Uses own temp directory
  })

  test('test 2', async () => {
    // Uses own temp directory, independent of test 1
  })
})

// Bad: Tests share state
describe('Coupled Tests', () => {
  const sharedDir = '/tmp/shared' // All tests use same directory

  test('test 1', async () => {
    await fs.writeFile(path.join(sharedDir, 'data.txt'), 'content')
  })

  test('test 2', async () => {
    // Depends on test 1 running first!
    const content = await fs.readFile(path.join(sharedDir, 'data.txt'))
  })
})
```

### Fast Tests

```typescript
// Good: Fast, focused tests
test('should validate input', () => {
  // No I/O, pure function test
  expect(validatePath('/safe/path', '/safe')).toBe(true)
})

// Good: Use mocks for expensive operations
test('should handle API failure', async () => {
  const mockApi = mock(() => Promise.reject(new Error('API down')))
  // Test error handling without actual API call
})

// Bad: Slow, unfocused tests
test('complete system test', async () => {
  // Reads 1000 files
  // Makes 50 API calls
  // Takes 30 seconds to run
})
```

### Reliable Tests

```typescript
// Good: Deterministic, reliable
test('should sort files alphabetically', async () => {
  const files = ['c.txt', 'a.txt', 'b.txt']
  const sorted = sortFiles(files)
  expect(sorted).toEqual(['a.txt', 'b.txt', 'c.txt'])
})

// Bad: Non-deterministic, flaky
test('should complete within 100ms', async () => {
  const start = Date.now()
  await someOperation()
  const duration = Date.now() - start
  expect(duration).toBeLessThan(100) // Flaky: depends on system load
})

// Bad: Depends on external state
test('should read current date', async () => {
  const date = getCurrentDate()
  expect(date).toBe('2024-01-15') // Fails tomorrow!
})
```

### Comprehensive Error Testing

```typescript
describe('Error Handling', () => {
  test('should handle file not found', async () => {
    const result = await tools.readFiles({ paths: ['missing.txt'] })
    expect(result[0].value['missing.txt']).toBeNull()
  })

  test('should handle permission denied', async () => {
    // Create read-only file
    const file = path.join(tempDir, 'readonly.txt')
    await fs.writeFile(file, 'content')
    await fs.chmod(file, 0o444)

    await expect(async () => {
      await tools.writeFile({ path: 'readonly.txt', content: 'new' })
    }).toThrow()
  })

  test('should handle path traversal', async () => {
    await expect(async () => {
      await tools.readFiles({ paths: ['../../../etc/passwd'] })
    }).toThrow(/Path traversal/)
  })

  test('should handle timeout', async () => {
    const result = await terminal.runCommand({
      command: 'sleep 10',
      timeout_seconds: 1
    })

    expect(result.timedOut).toBe(true)
  })
})
```

---

## Summary

Testing FREE mode agents ensures reliability, prevents regressions, and provides confidence in your agent implementations. Follow these key principles:

1. **Test at Multiple Levels**: Unit tests for individual components, integration tests for workflows
2. **Use Real Scenarios**: Test with actual files and realistic data
3. **Handle Errors**: Test error cases as thoroughly as success cases
4. **Keep Tests Fast**: Use mocks for expensive operations
5. **Maintain Isolation**: Each test should be independent
6. **Automate Testing**: Integrate with CI/CD for continuous validation

**Next Steps:**
- Start with unit tests for your agents
- Add integration tests for complete workflows
- Set up CI/CD integration
- Review the [Troubleshooting Guide](./TROUBLESHOOTING.md) for debugging failed tests
- Check the [Debug Guide](./DEBUG_GUIDE.md) for advanced debugging techniques
