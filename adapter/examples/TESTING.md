#### Testing Guide for Claude CLI Adapter

This guide explains how to test the adapter, run integration tests, and create your own tests.

## Table of Contents

1. [Running Tests](#running-tests)
2. [Integration Tests](#integration-tests)
3. [Creating New Tests](#creating-new-tests)
4. [Test Structure](#test-structure)
5. [Debugging Tests](#debugging-tests)
6. [Performance Testing](#performance-testing)

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
# Integration tests only
npm test -- tests/integration/

# Specific test file
npm test -- tests/integration/end-to-end.test.ts

# Real-world scenarios
npm test -- tests/integration/real-world-scenarios.test.ts

# Agent execution patterns
npm test -- tests/integration/agent-execution.test.ts
```

### Run with Coverage

```bash
npm test -- --coverage
```

### Run in Watch Mode

```bash
npm test -- --watch
```

## Integration Tests

Integration tests verify complete workflows using the FREE mode adapter.

### End-to-End Tests (`end-to-end.test.ts`)

Tests complete workflows from start to finish:

- File discovery → Read → Analyze → Report
- Code search → Extract results → Format output
- Execute command → Parse output → Store results
- Multi-step agent execution
- Error recovery and retry
- File creation and modification

Example:

```typescript
it('should find files, read them, and analyze content', async () => {
  const agent: AgentDefinition = {
    id: 'file-analyzer',
    displayName: 'File Analyzer',
    systemPrompt: 'You analyze files in a project.',
    toolNames: ['find_files', 'read_files', 'set_output'],
    outputMode: 'structured_output',

    async *handleSteps(context) {
      // Find files
      const findResult = yield {
        type: 'TOOL_CALL',
        toolCall: {
          toolName: 'find_files',
          input: { pattern: '**/*.ts' },
        },
      }

      const files = findResult[0]?.value?.files || []

      // Read files
      const readResult = yield {
        type: 'TOOL_CALL',
        toolCall: {
          toolName: 'read_files',
          input: { paths: files },
        },
      }

      // Analyze and set output
      yield {
        type: 'TOOL_CALL',
        toolCall: {
          toolName: 'set_output',
          input: { output: { /* analysis results */ } },
        },
      }

      return 'DONE'
    },
  }

  adapter.registerAgent(agent)
  const result = await adapter.executeAgent(agent, undefined)

  expect(result.output).toBeDefined()
})
```

### Real-World Scenarios (`real-world-scenarios.test.ts`)

Tests practical use cases:

- Find all TODO comments
- Analyze import statements
- Generate file listing
- Search for security vulnerabilities
- Count lines of code
- Find unused variables
- Analyze test coverage

Example:

```typescript
it('should find and categorize all TODOs in the project', async () => {
  const agent: AgentDefinition = {
    id: 'todo-finder',
    // ... agent definition
  }

  adapter.registerAgent(agent)
  const result = await adapter.executeAgent(agent, undefined)

  const output = result.output as any
  expect(output.summary.totalTodos).toBeGreaterThan(0)
  expect(output.todos[0]).toHaveProperty('file')
  expect(output.todos[0]).toHaveProperty('line')
})
```

### Agent Execution Patterns (`agent-execution.test.ts`)

Tests different agent execution patterns:

- Simple single-step agent
- Multi-step agent with sequential operations
- Agent with set_output
- Agent with error handling
- Agent with conditional logic
- Agent with data transformation
- Agent with aggregation
- Agent with parameter-based execution
- Agent with progress tracking

Example:

```typescript
it('should execute single tool call and return result', async () => {
  const agent: AgentDefinition = {
    id: 'simple-reader',
    displayName: 'Simple File Reader',
    toolNames: ['read_files', 'set_output'],

    async *handleSteps(context) {
      const result = yield {
        type: 'TOOL_CALL',
        toolCall: {
          toolName: 'read_files',
          input: { paths: ['data.txt'] },
        },
      }

      yield {
        type: 'TOOL_CALL',
        toolCall: {
          toolName: 'set_output',
          input: { output: { content: result[0]?.value?.['data.txt'] } },
        },
      }

      return 'DONE'
    },
  }

  // Test execution
})
```

## Creating New Tests

### 1. Create Test File

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as os from 'os'

describe('My Custom Tests', () => {
  let adapter: ClaudeCodeCLIAdapter
  let testDir: string

  beforeAll(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-test-'))

    // Initialize adapter
    adapter = new ClaudeCodeCLIAdapter({
      cwd: testDir,
      debug: true,
    })

    // Create test files
    await fs.writeFile(path.join(testDir, 'test.txt'), 'Test content')
  })

  afterAll(async () => {
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('should do something', async () => {
    // Your test here
  })
})
```

### 2. Define Agent

```typescript
const myAgent: AgentDefinition = {
  id: 'my-test-agent',
  displayName: 'My Test Agent',
  systemPrompt: 'You do something useful.',
  toolNames: ['read_files', 'set_output'],
  outputMode: 'structured_output',

  async *handleSteps(context) {
    // Agent logic here

    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: { output: { /* your output */ } },
      },
    }

    return 'DONE'
  },
}
```

### 3. Execute and Assert

```typescript
adapter.registerAgent(myAgent)
const result = await adapter.executeAgent(myAgent, 'Test prompt', { /* params */ })

expect(result.output).toBeDefined()
expect(result.output).toHaveProperty('expectedField')
expect((result.output as any).expectedField).toBe('expected value')
```

## Test Structure

### Good Test Structure

```typescript
describe('Feature Name', () => {
  // Setup
  let adapter: ClaudeCodeCLIAdapter
  let testDir: string

  beforeAll(async () => {
    // One-time setup
  })

  afterAll(async () => {
    // One-time cleanup
  })

  describe('Specific Scenario', () => {
    it('should behave as expected', async () => {
      // Arrange
      const agent = createAgent()
      adapter.registerAgent(agent)

      // Act
      const result = await adapter.executeAgent(agent, 'prompt')

      // Assert
      expect(result.output).toBeDefined()
    })
  })
})
```

### Test Naming

Use descriptive test names:

✅ Good:
```typescript
it('should find all TODO comments and group them by file', async () => { })
it('should handle missing files gracefully without throwing', async () => { })
it('should execute multiple replacements in sequence', async () => { })
```

❌ Bad:
```typescript
it('works', async () => { })
it('test 1', async () => { })
it('should do the thing', async () => { })
```

## Debugging Tests

### Enable Debug Logging

```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: testDir,
  debug: true, // Enable debug output
})
```

### Inspect Results

```typescript
const result = await adapter.executeAgent(agent, 'prompt')

// Log full result
console.log('Full result:', JSON.stringify(result, null, 2))

// Log specific fields
console.log('Output:', result.output)
console.log('Message history:', result.messageHistory)
console.log('Metadata:', result.metadata)
```

### Inspect Tool Results

```typescript
async *handleSteps(context) {
  const result = yield {
    type: 'TOOL_CALL',
    toolCall: {
      toolName: 'find_files',
      input: { pattern: '**/*.ts' },
    },
  }

  // Log tool result
  console.log('Tool result:', JSON.stringify(result, null, 2))
  console.log('Value:', result[0]?.value)

  // Continue...
}
```

### Run Single Test

```bash
# Run specific test file
npm test -- tests/integration/end-to-end.test.ts

# Run specific test within file
npm test -- tests/integration/end-to-end.test.ts -t "should find files"
```

## Performance Testing

### Benchmark Tests

Performance tests are in `tests/benchmarks/`:

```bash
# Run performance benchmarks
npm test -- tests/benchmarks/performance.test.ts
```

### Measure Execution Time

```typescript
it('should execute quickly', async () => {
  const startTime = Date.now()

  const result = await adapter.executeAgent(agent, 'prompt')

  const executionTime = Date.now() - startTime

  expect(executionTime).toBeLessThan(1000) // Should complete in <1s
})
```

### Test with Large Datasets

```typescript
it('should handle 100 files efficiently', async () => {
  // Create 100 test files
  for (let i = 0; i < 100; i++) {
    await fs.writeFile(path.join(testDir, `file${i}.txt`), `Content ${i}`)
  }

  const startTime = Date.now()

  const result = await adapter.executeAgent(agent, 'Process all files')

  const executionTime = Date.now() - startTime

  expect((result.output as any).filesProcessed).toBe(100)
  expect(executionTime).toBeLessThan(5000) // Should complete in <5s
})
```

## Best Practices

### 1. Use Temporary Directories

Always use temporary directories for tests:

```typescript
beforeAll(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'))
})

afterAll(async () => {
  await fs.rm(testDir, { recursive: true, force: true })
})
```

### 2. Test Edge Cases

```typescript
it('should handle empty results', async () => {
  // Test with no matching files
})

it('should handle missing files', async () => {
  // Test with non-existent file paths
})

it('should handle large files', async () => {
  // Test with very large file
})
```

### 3. Test Error Handling

```typescript
it('should recover from read errors', async () => {
  const agent = createAgentWithErrorHandling()

  const result = await adapter.executeAgent(agent, 'Read missing files', {
    paths: ['missing1.txt', 'missing2.txt'],
  })

  expect((result.output as any).errors).toBeDefined()
  expect((result.output as any).errors.length).toBe(2)
})
```

### 4. Isolate Tests

Each test should be independent:

```typescript
// ❌ Bad - tests depend on each other
it('should create file', async () => {
  await createFile('shared.txt')
})

it('should read file', async () => {
  // Depends on previous test
  await readFile('shared.txt')
})

// ✅ Good - tests are independent
it('should create file', async () => {
  await createFile('test1.txt')
  expect(await fileExists('test1.txt')).toBe(true)
})

it('should read file', async () => {
  await createFile('test2.txt')
  const content = await readFile('test2.txt')
  expect(content).toBeDefined()
})
```

## Continuous Integration

### CI Configuration

Tests run automatically in CI/CD:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test
```

### Test Requirements

- All tests must pass
- No API key required (FREE mode tests)
- Tests must be fast (<1min total)
- Clean up all temporary files

## Troubleshooting

### Tests Timeout

Increase timeout:

```typescript
it('should handle long operation', async () => {
  // ...
}, 10000) // 10 second timeout
```

### File Permission Errors

Ensure test directory is writable:

```typescript
beforeAll(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'))
  await fs.chmod(testDir, 0o755)
})
```

### Tests Fail in CI but Pass Locally

Check for:
- Hardcoded paths
- Dependency on local files
- Platform-specific code
- Race conditions

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Integration Tests Examples](../tests/integration/)
- [Example Agents](./free-mode-agents/)
- [Real Project Examples](./real-projects/)
