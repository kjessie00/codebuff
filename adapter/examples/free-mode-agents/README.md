# FREE Mode Example Agents

This directory contains 15+ complete, working example agents that demonstrate how to use the Claude CLI adapter in **FREE mode** (without an API key).

All these examples work without requiring an Anthropic API key, making them perfect for local development, CI/CD pipelines, and cost-free automation.

## Quick Start

```bash
# Run any example directly
npx ts-node examples/free-mode-agents/01-file-reader.ts

# Or use the example runner
npm run example file-reader
```

## Available Examples

### File Operations

#### 01. File Reader (`01-file-reader.ts`)
Read single or multiple files with error handling.

```typescript
import { fileReaderAgent } from './01-file-reader'

const result = await adapter.executeAgent(
  fileReaderAgent,
  'Read files',
  { paths: ['package.json', 'README.md'] }
)
```

**Use cases**: Configuration file reading, batch file processing

#### 02. File Writer (`02-file-writer.ts`)
Create files with template support.

```typescript
import { fileWriterAgent, templateGeneratorAgent } from './02-file-writer'

// Write custom file
await adapter.executeAgent(fileWriterAgent, 'Create file', {
  path: 'output.txt',
  content: 'Hello World'
})

// Generate from template
await adapter.executeAgent(templateGeneratorAgent, 'Generate TS class', {
  templateType: 'typescript',
  name: 'myService'
})
```

**Use cases**: Code generation, scaffolding, build scripts

#### 03. File Editor (`03-file-editor.ts`)
Make precise edits using string replacement.

```typescript
import { fileEditorAgent, batchEditorAgent } from './03-file-editor'

// Single replacement
await adapter.executeAgent(fileEditorAgent, 'Update version', {
  path: 'package.json',
  oldString: '"version": "1.0.0"',
  newString: '"version": "2.0.0"'
})

// Multiple replacements
await adapter.executeAgent(batchEditorAgent, 'Batch update', {
  path: 'config.ts',
  replacements: [
    { old: 'development', new: 'production' },
    { old: '3000', new: '8080' }
  ]
})
```

**Use cases**: Configuration updates, refactoring, version bumps

### Code Analysis

#### 04. TODO Finder (`04-todo-finder.ts`)
Find and categorize all TODO/FIXME/HACK comments.

```typescript
import { todoFinderAgent } from './04-todo-finder'

const result = await adapter.executeAgent(todoFinderAgent, 'Find TODOs', {
  filePattern: '**/*.ts'
})

// Output includes:
// - summary.totalComments
// - summary.byType (TODO, FIXME, HACK, etc.)
// - summary.byPriority (HIGH, MEDIUM, LOW)
// - byFile (grouped by file)
```

**Use cases**: Technical debt tracking, sprint planning, code reviews

#### 05. Import Analyzer (`05-import-analyzer.ts`)
Analyze import statements and dependencies.

```typescript
import { importAnalyzerAgent } from './05-import-analyzer'

const result = await adapter.executeAgent(importAnalyzerAgent, 'Analyze imports', {
  filePattern: '**/*.ts'
})

// Detects:
// - Unused dependencies
// - Undeclared dependencies
// - Internal vs external imports
```

**Use cases**: Dependency audits, package optimization, bundle analysis

#### 06. Code Search (`06-code-search.ts`)
Search for code patterns using regex.

```typescript
import { codeSearchAgent, functionSearchAgent } from './06-code-search'

// Search for pattern
await adapter.executeAgent(codeSearchAgent, 'Find async functions', {
  query: 'async function',
  filePattern: '**/*.ts',
  caseSensitive: false
})

// Find specific function
await adapter.executeAgent(functionSearchAgent, 'Find function', {
  functionName: 'handleSteps',
  filePattern: '**/*.ts'
})
```

**Use cases**: Code exploration, refactoring, pattern analysis

### Project Utilities

#### 07. File Finder (`07-file-finder.ts`)
Find files using glob patterns.

```typescript
import { fileFinderAgent } from './07-file-finder'

const result = await adapter.executeAgent(fileFinderAgent, 'Find files', {
  pattern: '**/*.{ts,js}'
})
```

**Use cases**: Project structure analysis, build systems

#### 08. Terminal Executor (`08-terminal-executor.ts`)
Execute shell commands.

```typescript
import { terminalExecutorAgent } from './08-terminal-executor'

const result = await adapter.executeAgent(terminalExecutorAgent, 'Run tests', {
  command: 'npm test'
})
```

**Use cases**: CI/CD automation, build scripts, deployment

#### 09. Project Structure (`09-project-structure.ts`)
Analyze directory structure.

```typescript
import { projectStructureAgent } from './09-project-structure'

const result = await adapter.executeAgent(projectStructureAgent, 'Analyze structure', {
  pattern: 'src/**/*'
})
```

**Use cases**: Documentation generation, project onboarding

#### 10. Dependency List (`10-dependency-list.ts`)
List all npm dependencies.

```typescript
import { dependencyListAgent } from './10-dependency-list'

const result = await adapter.executeAgent(dependencyListAgent, 'List deps')
```

**Use cases**: License audits, security scanning, documentation

### Quality & Testing

#### 11. Test Counter (`11-test-counter.ts`)
Count test files and test cases.

```typescript
import { testCounterAgent } from './11-test-counter'

const result = await adapter.executeAgent(testCounterAgent, 'Count tests')
// Returns: testFiles, testSuites, testCases, avgTestsPerFile
```

**Use cases**: Test coverage reports, quality metrics

#### 12. Security Scanner (`12-security-scanner.ts`)
Scan for common security vulnerabilities.

```typescript
import { securityScannerAgent } from './12-security-scanner'

const result = await adapter.executeAgent(securityScannerAgent, 'Scan for vulnerabilities')
// Detects: SQL injection, hardcoded credentials, eval usage
```

**Use cases**: Security audits, pre-commit hooks, CI/CD checks

#### 13. Code Metrics (`13-code-metrics.ts`)
Calculate code metrics (LOC, comments, etc.).

```typescript
import { codeMetricsAgent } from './13-code-metrics'

const result = await adapter.executeAgent(codeMetricsAgent, 'Calculate metrics', {
  pattern: 'src/**/*.ts'
})
// Returns: totalLines, codeLines, commentLines, commentRatio
```

**Use cases**: Code quality reports, tech debt analysis

### Documentation

#### 14. Documentation Generator (`14-documentation-generator.ts`)
Generate API documentation from code.

```typescript
import { documentationGeneratorAgent } from './14-documentation-generator'

const result = await adapter.executeAgent(documentationGeneratorAgent, 'Generate docs', {
  filePattern: 'src/**/*.ts',
  outputFile: 'docs/API.md'
})
```

**Use cases**: API documentation, onboarding docs

#### 15. Git Analyzer (`15-git-analyzer.ts`)
Analyze git repository information.

```typescript
import { gitAnalyzerAgent } from './15-git-analyzer'

const result = await adapter.executeAgent(gitAnalyzerAgent, 'Analyze repo')
// Returns: currentBranch, modifiedFiles, totalCommits, status
```

**Use cases**: Release notes, commit analysis, repo health checks

## Common Modifications

### 1. Add Custom Filtering

```typescript
async *handleSteps(context) {
  const findResult = yield {
    type: 'TOOL_CALL',
    toolCall: {
      toolName: 'find_files',
      input: { pattern: '**/*.ts' },
    },
  }

  const files = findResult[0]?.value?.files || []

  // Filter by custom criteria
  const filteredFiles = files.filter(f =>
    f.includes('src/') && !f.includes('.test.')
  )

  // Continue processing...
}
```

### 2. Add Progress Tracking

```typescript
async *handleSteps(context) {
  const progress: any[] = []

  progress.push({ step: 1, action: 'Finding files', status: 'in_progress' })
  // ... perform action
  progress[0].status = 'completed'

  // Include progress in output
  yield {
    type: 'TOOL_CALL',
    toolCall: {
      toolName: 'set_output',
      input: { output: { progress } },
    },
  }
}
```

### 3. Add Error Recovery

```typescript
async *handleSteps(context) {
  const errors: any[] = []

  try {
    // Try operation
    const result = yield {
      type: 'TOOL_CALL',
      toolCall: { toolName: 'read_files', input: { paths: ['file.txt'] } },
    }
  } catch (error) {
    errors.push({ operation: 'read_files', error })
  }

  // Return errors in output
  yield {
    type: 'TOOL_CALL',
    toolCall: {
      toolName: 'set_output',
      input: { output: { errors } },
    },
  }
}
```

### 4. Chain Multiple Agents

```typescript
// In main code (not inside handleSteps)
const result1 = await adapter.executeAgent(fileFinderAgent, 'Find files')
const files = result1.output.files

const result2 = await adapter.executeAgent(fileReaderAgent, 'Read found files', {
  paths: files
})
```

## Best Practices

1. **Always validate input parameters**
   ```typescript
   const pattern = (context.params?.pattern as string) || 'default-pattern'
   ```

2. **Handle null results from tools**
   ```typescript
   const files = findResult[0]?.value?.files || []
   ```

3. **Use structured output**
   ```typescript
   yield {
     type: 'TOOL_CALL',
     toolCall: {
       toolName: 'set_output',
       input: {
         output: {
           success: true,
           data: results,
           metadata: { timestamp: new Date().toISOString() },
         },
       },
     },
   }
   ```

4. **Include summary statistics**
   ```typescript
   output: {
     summary: {
       totalProcessed: items.length,
       successCount: successes.length,
       errorCount: errors.length,
     },
     details: items,
   }
   ```

## Troubleshooting

### Agent doesn't return expected output

Check that you're using `set_output`:

```typescript
yield {
  type: 'TOOL_CALL',
  toolCall: {
    toolName: 'set_output',
    input: { output: yourData },
  },
}

return 'DONE'
```

### Tool results are undefined

Check the tool result structure:

```typescript
const result = yield { type: 'TOOL_CALL', toolCall: { ... } }
console.log(result) // [{ type: 'json', value: {...} }]

const value = result[0]?.value // Access the actual data
```

### File path errors

Use absolute paths or paths relative to `cwd`:

```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(), // or '/absolute/path/to/project'
})
```

## Performance Tips

1. **Limit file reads**: Only read necessary files
2. **Use glob patterns efficiently**: Be specific to reduce matches
3. **Batch operations**: Process multiple files in one tool call
4. **Cache results**: Store intermediate results if reused

## Next Steps

- See `examples/real-projects/` for complete workflow examples
- Read `examples/TESTING.md` for testing guide
- Check integration tests in `tests/integration/` for more patterns

## License

MIT
