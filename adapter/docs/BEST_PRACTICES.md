# Best Practices

Comprehensive best practices for using the Claude CLI Adapter in FREE mode.

## Table of Contents

- [Agent Design](#agent-design)
- [Tool Usage](#tool-usage)
- [Performance](#performance)
- [Security](#security)
- [Code Organization](#code-organization)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Maintenance](#maintenance)
- [Debugging](#debugging)
- [Documentation](#documentation)

---

## Agent Design

### DO: Keep Agents Focused

Create small, single-purpose agents that do one thing well.

**Good:**
```typescript
const fileFinderAgent: AgentDefinition = {
  id: 'file-finder',
  displayName: 'File Finder',
  toolNames: ['find_files', 'set_output'],

  handleSteps: function* ({ params }) {
    const { toolResult } = yield {
      toolName: 'find_files',
      input: { pattern: params.pattern }
    }

    yield {
      toolName: 'set_output',
      input: { output: toolResult[0].value.files }
    }
  }
}
```

**Bad:**
```typescript
const godAgent: AgentDefinition = {
  id: 'do-everything',
  displayName: 'God Agent',
  // Too many responsibilities
  toolNames: [
    'find_files', 'read_files', 'write_file', 'str_replace',
    'code_search', 'run_terminal_command', 'set_output'
  ],

  handleSteps: function* ({ params }) {
    // Hundreds of lines doing many unrelated things
    // Hard to test, maintain, and reason about
  }
}
```

### DON'T: Create God Agents

Avoid agents that try to do everything. They become hard to test, maintain, and reason about.

**Problems with God Agents:**
- Difficult to test individual features
- Changes affect multiple use cases
- Hard to understand and debug
- Poor reusability
- Violation of single responsibility principle

**Solution:**
Break into smaller, focused agents and compose them:

```typescript
// Small, focused agents
const fileFinder: AgentDefinition = { /* finds files */ }
const fileReader: AgentDefinition = { /* reads files */ }
const codeAnalyzer: AgentDefinition = { /* analyzes code */ }
const reportGenerator: AgentDefinition = { /* generates reports */ }

// Compose them in a coordinator
const codeAuditor: AgentDefinition = {
  id: 'code-auditor',
  displayName: 'Code Auditor',

  handleSteps: function* () {
    // Use focused agents as building blocks
    // Each can be tested and maintained independently
  }
}
```

### DO: Use Descriptive Names

Choose clear, descriptive names that explain what the agent does.

**Good:**
```typescript
// Clear purpose
const testFileFinder: AgentDefinition = {
  id: 'test-file-finder',
  displayName: 'Test File Finder'
}

const packageJsonUpdater: AgentDefinition = {
  id: 'package-json-updater',
  displayName: 'Package.json Updater'
}

const todoReporter: AgentDefinition = {
  id: 'todo-reporter',
  displayName: 'TODO Reporter'
}
```

**Bad:**
```typescript
// Vague names
const agent1: AgentDefinition = {
  id: 'a1',
  displayName: 'Agent'
}

const processor: AgentDefinition = {
  id: 'proc',
  displayName: 'Processor'  // Process what?
}

const helper: AgentDefinition = {
  id: 'hlp',
  displayName: 'Helper'  // Help with what?
}
```

### DO: Write Clear System Prompts

Provide clear, specific system prompts that guide agent behavior.

**Good:**
```typescript
const agent: AgentDefinition = {
  id: 'code-analyzer',
  displayName: 'Code Analyzer',

  systemPrompt: `You are a code analysis assistant specializing in TypeScript codebases.

Your responsibilities:
1. Search for code patterns and anti-patterns
2. Identify potential bugs and security issues
3. Generate comprehensive analysis reports
4. Provide actionable recommendations

Guidelines:
- Focus on TypeScript files only
- Prioritize security and performance issues
- Include file paths and line numbers in findings
- Categorize issues by severity (critical, high, medium, low)`,

  toolNames: ['code_search', 'find_files', 'set_output']
}
```

**Bad:**
```typescript
const agent: AgentDefinition = {
  id: 'code-analyzer',
  displayName: 'Code Analyzer',

  systemPrompt: 'Analyze code',  // Too vague!

  toolNames: ['code_search', 'find_files', 'set_output']
}
```

### DO: Handle Errors Gracefully

Always handle potential errors and provide meaningful feedback.

**Good:**
```typescript
handleSteps: function* ({ params, logger }) {
  try {
    const { toolResult } = yield {
      toolName: 'read_files',
      input: { paths: params.files }
    }

    const contents = toolResult[0].value

    // Check for missing files
    const missingFiles = params.files.filter(f => contents[f] === null)
    if (missingFiles.length > 0) {
      logger.warn({
        message: 'Some files not found',
        missingFiles
      })

      yield {
        type: 'STEP_TEXT',
        text: `⚠️  Warning: ${missingFiles.length} files not found`
      }
    }

    // Continue with available files
    const availableFiles = params.files.filter(f => contents[f] !== null)
    // Process availableFiles...

  } catch (error) {
    logger.error({ error: error.message })

    yield {
      toolName: 'set_output',
      input: {
        output: {
          error: true,
          message: error.message
        }
      }
    }
  }
}
```

**Bad:**
```typescript
handleSteps: function* ({ params }) {
  // No error handling - will crash on any error
  const { toolResult } = yield {
    toolName: 'read_files',
    input: { paths: params.files }
  }

  // Assumes all files exist and are readable
  const contents = toolResult[0].value
  // Process without checking for errors...
}
```

### DO: Validate Input Parameters

Always validate input parameters before using them.

**Good:**
```typescript
handleSteps: function* ({ params, logger }) {
  // Validate required parameters
  if (!params.pattern) {
    throw new Error('Parameter "pattern" is required')
  }

  if (typeof params.pattern !== 'string') {
    throw new Error('Parameter "pattern" must be a string')
  }

  if (params.maxResults !== undefined) {
    if (typeof params.maxResults !== 'number' || params.maxResults < 1) {
      throw new Error('Parameter "maxResults" must be a positive number')
    }
  }

  // Use validated parameters
  const { toolResult } = yield {
    toolName: 'find_files',
    input: { pattern: params.pattern }
  }
}
```

**Bad:**
```typescript
handleSteps: function* ({ params }) {
  // No validation - could crash with undefined or wrong types
  const { toolResult } = yield {
    toolName: 'find_files',
    input: { pattern: params.pattern }  // What if pattern is undefined?
  }
}
```

---

## Tool Usage

### DO: Use the Right Tool for the Job

Choose the most appropriate tool for each task.

**Good Choices:**

```typescript
// Finding files by pattern - use find_files
yield {
  toolName: 'find_files',
  input: { pattern: '**/*.test.ts' }
}

// Searching file contents - use code_search
yield {
  toolName: 'code_search',
  input: { query: 'TODO:', file_pattern: '*.ts' }
}

// Reading specific files - use read_files
yield {
  toolName: 'read_files',
  input: { paths: ['package.json', 'tsconfig.json'] }
}

// Running build commands - use run_terminal_command
yield {
  toolName: 'run_terminal_command',
  input: { command: 'npm run build' }
}
```

**Bad Choices:**

```typescript
// DON'T: Use terminal commands when tools exist
yield {
  toolName: 'run_terminal_command',
  input: { command: 'find . -name "*.ts"' }  // Use find_files instead!
}

yield {
  toolName: 'run_terminal_command',
  input: { command: 'grep -r "TODO" .' }  // Use code_search instead!
}

yield {
  toolName: 'run_terminal_command',
  input: { command: 'cat package.json' }  // Use read_files instead!
}
```

### DON'T: Overuse Terminal Commands

Terminal commands should be a last resort, not the first choice.

**Why Avoid:**
- Less portable across platforms (Windows vs Unix)
- Harder to test
- Security risks (command injection)
- No built-in error handling
- Less efficient

**Use Terminal Commands For:**
- Running build tools (`npm`, `yarn`, `cargo`, etc.)
- Git operations
- Package managers
- Custom scripts
- Operations not covered by other tools

### DO: Validate Inputs

Always validate tool inputs to prevent errors.

**Good:**
```typescript
handleSteps: function* ({ params }) {
  // Validate before calling tool
  if (!Array.isArray(params.files)) {
    throw new Error('files must be an array')
  }

  if (params.files.length === 0) {
    throw new Error('files array cannot be empty')
  }

  // Validate each file path
  for (const file of params.files) {
    if (typeof file !== 'string') {
      throw new Error(`Invalid file path: ${file}`)
    }

    if (file.includes('..')) {
      throw new Error(`Path traversal detected: ${file}`)
    }
  }

  // Safe to use now
  const { toolResult } = yield {
    toolName: 'read_files',
    input: { paths: params.files }
  }
}
```

### DO: Batch Operations When Possible

Use batch operations instead of loops for better performance.

**Good:**
```typescript
// Batch read - single tool call
const { toolResult } = yield {
  toolName: 'read_files',
  input: {
    paths: [
      'src/index.ts',
      'src/config.ts',
      'src/utils.ts',
      'package.json',
      'tsconfig.json'
    ]
  }
}
```

**Bad:**
```typescript
// Sequential reads - multiple tool calls (much slower!)
const files = ['src/index.ts', 'src/config.ts', 'src/utils.ts']
const contents = {}

for (const file of files) {
  const { toolResult } = yield {
    toolName: 'read_files',
    input: { paths: [file] }
  }

  contents[file] = toolResult[0].value[file]
}
```

### DO: Use Specific File Patterns

Use specific patterns to limit search scope and improve performance.

**Good:**
```typescript
// Specific pattern
yield {
  toolName: 'find_files',
  input: { pattern: 'src/components/**/*.tsx' }
}

// Pattern with exclusions
yield {
  toolName: 'code_search',
  input: {
    query: 'useState',
    file_pattern: '*.tsx'  // Only TypeScript React files
  }
}
```

**Bad:**
```typescript
// Too broad - searches everything!
yield {
  toolName: 'find_files',
  input: { pattern: '**/*' }
}

// No file pattern - slow!
yield {
  toolName: 'code_search',
  input: {
    query: 'useState'
    // Will search all files including node_modules, build artifacts, etc.
  }
}
```

---

## Performance

### DO: Use Parallel Operations

Execute independent operations in parallel when possible.

**Good:**
```typescript
handleSteps: function* () {
  // These operations are independent - execute in parallel
  const [findResult, searchResult, commandResult] = await Promise.all([
    // Find TypeScript files
    (async () => {
      const { toolResult } = yield {
        toolName: 'find_files',
        input: { pattern: '**/*.ts' }
      }
      return toolResult[0].value
    })(),

    // Search for TODOs
    (async () => {
      const { toolResult } = yield {
        toolName: 'code_search',
        input: { query: 'TODO:' }
      }
      return toolResult[0].value
    })(),

    // Run tests
    (async () => {
      const { toolResult } = yield {
        toolName: 'run_terminal_command',
        input: { command: 'npm test' }
      }
      return toolResult[0].value
    })()
  ])

  // All three completed in parallel!
}
```

### DO: Limit Result Sets

Use maxResults to prevent processing huge datasets.

**Good:**
```typescript
const { toolResult } = yield {
  toolName: 'code_search',
  input: {
    query: 'console.log',
    maxResults: 100  // Limit to 100 matches
  }
}
```

**Bad:**
```typescript
const { toolResult } = yield {
  toolName: 'code_search',
  input: {
    query: 'console.log'
    // Could return thousands of matches - slow!
  }
}
```

### DO: Cache Expensive Operations

Cache results that don't change frequently.

**Good:**
```typescript
const cache = new Map()

handleSteps: function* ({ params }) {
  const cacheKey = params.pattern

  // Check cache first
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)

    // Check if cache is still valid (< 5 minutes old)
    if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
      yield {
        toolName: 'set_output',
        input: { output: cached.value }
      }
      return
    }
  }

  // Cache miss or expired - fetch fresh data
  const { toolResult } = yield {
    toolName: 'find_files',
    input: { pattern: params.pattern }
  }

  const result = toolResult[0].value

  // Update cache
  cache.set(cacheKey, {
    value: result,
    timestamp: Date.now()
  })

  yield {
    toolName: 'set_output',
    input: { output: result }
  }
}
```

### DON'T: Read Entire Codebases

Avoid reading too many files at once.

**Good:**
```typescript
// Limit files read
const { toolResult: findResult } = yield {
  toolName: 'find_files',
  input: { pattern: '**/*.ts' }
}

const files = findResult[0].value.files

// Read only first 20 files
const { toolResult: readResult } = yield {
  toolName: 'read_files',
  input: { paths: files.slice(0, 20) }
}
```

**Bad:**
```typescript
// Could try to read thousands of files!
const { toolResult: findResult } = yield {
  toolName: 'find_files',
  input: { pattern: '**/*.ts' }
}

const files = findResult[0].value.files

// DON'T: Read all files at once
const { toolResult: readResult } = yield {
  toolName: 'read_files',
  input: { paths: files }  // Could be 1000+ files!
}
```

---

## Security

### DO: Validate All Paths

Always validate file paths to prevent directory traversal attacks.

**Good:**
```typescript
function validatePath(filePath: string): void {
  // Check for path traversal
  if (filePath.includes('..')) {
    throw new Error(`Path traversal detected: ${filePath}`)
  }

  // Check for absolute paths to sensitive areas
  const dangerous = ['/etc', '/sys', '/proc', 'C:\\Windows']
  if (dangerous.some(d => filePath.startsWith(d))) {
    throw new Error(`Access to system directory denied: ${filePath}`)
  }

  // Ensure path is relative
  if (path.isAbsolute(filePath)) {
    throw new Error(`Absolute paths not allowed: ${filePath}`)
  }
}

handleSteps: function* ({ params }) {
  // Validate before using
  params.files.forEach(validatePath)

  const { toolResult } = yield {
    toolName: 'read_files',
    input: { paths: params.files }
  }
}
```

### DO: Sanitize User Input

Sanitize all user input before using in commands or file operations.

**Good:**
```typescript
function sanitizeInput(input: string): string {
  // Remove dangerous characters
  return input.replace(/[;&|`$()<>]/g, '')
}

handleSteps: function* ({ params }) {
  // Sanitize command input
  const safeCommand = sanitizeInput(params.command)

  const { toolResult } = yield {
    toolName: 'run_terminal_command',
    input: { command: safeCommand }
  }
}
```

### DON'T: Trust External Data

Never trust data from external sources without validation.

**Bad:**
```typescript
// Dangerous - no validation!
handleSteps: function* ({ params }) {
  // params could contain malicious paths
  const { toolResult } = yield {
    toolName: 'read_files',
    input: { paths: params.files }
  }

  // params.command could be malicious
  yield {
    toolName: 'run_terminal_command',
    input: { command: params.command }
  }
}
```

**Good:**
```typescript
handleSteps: function* ({ params }) {
  // Validate everything
  if (!Array.isArray(params.files)) {
    throw new Error('Invalid files parameter')
  }

  params.files.forEach(file => {
    validatePath(file)
    if (!file.match(/\.(ts|js|json)$/)) {
      throw new Error(`Invalid file type: ${file}`)
    }
  })

  // Whitelist allowed commands
  const allowedCommands = ['npm test', 'npm build', 'npm lint']
  if (!allowedCommands.includes(params.command)) {
    throw new Error(`Command not allowed: ${params.command}`)
  }

  // Safe to proceed
}
```

### DO: Use Least Privilege

Only request tools that the agent actually needs.

**Good:**
```typescript
// Minimal tool set
const agent: AgentDefinition = {
  id: 'file-reader',
  displayName: 'File Reader',
  toolNames: ['read_files', 'set_output']  // Only what's needed
}
```

**Bad:**
```typescript
// Requesting unnecessary tools
const agent: AgentDefinition = {
  id: 'file-reader',
  displayName: 'File Reader',
  toolNames: [
    'read_files',
    'write_file',        // Not needed
    'str_replace',       // Not needed
    'run_terminal_command',  // Not needed
    'set_output'
  ]
}
```

---

## Code Organization

### DO: Structure Code Well

Organize agent code logically with clear separation of concerns.

**Good:**
```typescript
// agents/file-analyzer.ts
import { AgentDefinition } from '@codebuff/types'
import { validatePath, sanitizeInput } from './utils'
import { FileAnalyzer } from './analyzers'

export const fileAnalyzerAgent: AgentDefinition = {
  id: 'file-analyzer',
  displayName: 'File Analyzer',
  toolNames: ['find_files', 'read_files', 'set_output'],

  handleSteps: function* ({ params, logger }) {
    // Step 1: Find files
    const files = yield* findFiles(params.pattern)

    // Step 2: Analyze files
    const analysis = yield* analyzeFiles(files)

    // Step 3: Generate report
    yield* generateReport(analysis)
  }
}

// Helper generators
function* findFiles(pattern: string) {
  validatePattern(pattern)

  const { toolResult } = yield {
    toolName: 'find_files',
    input: { pattern }
  }

  return toolResult[0].value.files
}

function* analyzeFiles(files: string[]) {
  const { toolResult } = yield {
    toolName: 'read_files',
    input: { paths: files.slice(0, 20) }
  }

  return new FileAnalyzer().analyze(toolResult[0].value)
}

function* generateReport(analysis: any) {
  yield {
    toolName: 'set_output',
    input: { output: analysis }
  }
}
```

### DO: Use TypeScript

Leverage TypeScript for type safety and better IDE support.

**Good:**
```typescript
interface FileAnalysisParams {
  pattern: string
  maxFiles?: number
  includeTests?: boolean
}

interface FileAnalysisResult {
  totalFiles: number
  analyzedFiles: number
  issues: Issue[]
  summary: Summary
}

const agent: AgentDefinition = {
  id: 'file-analyzer',
  displayName: 'File Analyzer',

  handleSteps: function* ({ params }: { params: FileAnalysisParams }) {
    // TypeScript ensures params match the interface
    const pattern: string = params.pattern
    const maxFiles: number = params.maxFiles ?? 50

    // Type-safe operations
    const result: FileAnalysisResult = yield* analyze(pattern, maxFiles)

    yield {
      toolName: 'set_output',
      input: { output: result }
    }
  }
}
```

### DO: Write Tests

Test agents thoroughly with unit and integration tests.

**Good:**
```typescript
// agents/__tests__/file-analyzer.test.ts
import { createAdapter } from '@codebuff/adapter'
import { fileAnalyzerAgent } from '../file-analyzer'

describe('FileAnalyzerAgent', () => {
  let adapter: ClaudeCodeCLIAdapter

  beforeEach(() => {
    adapter = createAdapter(__dirname)
    adapter.registerAgent(fileAnalyzerAgent)
  })

  it('should find and analyze TypeScript files', async () => {
    const result = await adapter.executeAgent(
      fileAnalyzerAgent,
      undefined,
      { pattern: '**/*.ts', maxFiles: 10 }
    )

    expect(result.output).toHaveProperty('totalFiles')
    expect(result.output).toHaveProperty('analyzedFiles')
    expect(result.output.analyzedFiles).toBeLessThanOrEqual(10)
  })

  it('should handle empty results', async () => {
    const result = await adapter.executeAgent(
      fileAnalyzerAgent,
      undefined,
      { pattern: '**/*.nonexistent' }
    )

    expect(result.output.totalFiles).toBe(0)
  })

  it('should validate parameters', async () => {
    await expect(
      adapter.executeAgent(
        fileAnalyzerAgent,
        undefined,
        { pattern: null }  // Invalid
      )
    ).rejects.toThrow('pattern is required')
  })
})
```

### DO: Document Agents

Document agent purpose, parameters, and behavior.

**Good:**
```typescript
/**
 * File Analyzer Agent
 *
 * Analyzes TypeScript files in a codebase and generates a comprehensive report.
 *
 * @param params.pattern - Glob pattern to match files (e.g., "**/*.ts")
 * @param params.maxFiles - Maximum number of files to analyze (default: 50)
 * @param params.includeTests - Whether to include test files (default: false)
 *
 * @returns FileAnalysisResult with:
 *   - totalFiles: Total files matching pattern
 *   - analyzedFiles: Number of files actually analyzed
 *   - issues: Array of issues found
 *   - summary: Summary statistics
 *
 * @example
 * ```typescript
 * const result = await adapter.executeAgent(
 *   fileAnalyzerAgent,
 *   'Analyze src files',
 *   { pattern: 'src/**/*.ts', maxFiles: 100 }
 * )
 * ```
 */
export const fileAnalyzerAgent: AgentDefinition = {
  // Implementation...
}
```

---

## Error Handling

### DO: Expect Failures

Design agents to handle failures gracefully.

**Good:**
```typescript
handleSteps: function* ({ params, logger }) {
  const results = {
    successful: [],
    failed: []
  }

  for (const file of params.files) {
    try {
      const { toolResult } = yield {
        toolName: 'read_files',
        input: { paths: [file] }
      }

      const content = toolResult[0].value[file]
      if (content) {
        results.successful.push(file)
      } else {
        results.failed.push({ file, reason: 'File not found' })
      }
    } catch (error) {
      logger.error({ file, error: error.message })
      results.failed.push({ file, reason: error.message })
    }
  }

  // Return partial results even if some failed
  yield {
    toolName: 'set_output',
    input: { output: results }
  }
}
```

### DO: Provide Helpful Errors

Include context and actionable information in error messages.

**Good:**
```typescript
if (!params.pattern) {
  throw new Error(
    'Missing required parameter: pattern\n' +
    'Example: { pattern: "**/*.ts" }\n' +
    'See documentation: https://...'
  )
}

if (files.length === 0) {
  throw new Error(
    `No files found matching pattern: ${params.pattern}\n` +
    'Suggestions:\n' +
    '  - Check pattern syntax\n' +
    '  - Verify files exist in working directory\n' +
    '  - Try a broader pattern like "**/*.ts"'
  )
}
```

**Bad:**
```typescript
if (!params.pattern) {
  throw new Error('Error')  // What error?
}

if (files.length === 0) {
  throw new Error('No files')  // Why? What should I do?
}
```

### DO: Log Appropriately

Log enough information for debugging but not too much noise.

**Good:**
```typescript
handleSteps: function* ({ params, logger }) {
  logger.info({ operation: 'start', pattern: params.pattern })

  const { toolResult } = yield {
    toolName: 'find_files',
    input: { pattern: params.pattern }
  }

  const files = toolResult[0].value.files
  logger.info({ operation: 'find_complete', fileCount: files.length })

  // Log warnings for important conditions
  if (files.length === 0) {
    logger.warn({ pattern: params.pattern, message: 'No files found' })
  }

  if (files.length > 1000) {
    logger.warn({ fileCount: files.length, message: 'Large result set' })
  }

  // Log errors with context
  try {
    // Operations...
  } catch (error) {
    logger.error({
      operation: 'read_files',
      error: error.message,
      context: { files: files.slice(0, 10) }
    })
    throw error
  }
}
```

### DON'T: Swallow Errors

Never hide errors silently.

**Bad:**
```typescript
handleSteps: function* () {
  try {
    const { toolResult } = yield {
      toolName: 'read_files',
      input: { paths: ['important.json'] }
    }
    // Use result...
  } catch (error) {
    // Silently swallowed - terrible!
    // The agent will continue as if nothing happened
  }
}
```

**Good:**
```typescript
handleSteps: function* ({ logger }) {
  try {
    const { toolResult } = yield {
      toolName: 'read_files',
      input: { paths: ['important.json'] }
    }
    // Use result...
  } catch (error) {
    logger.error({ error: error.message })

    // Re-throw or handle appropriately
    yield {
      toolName: 'set_output',
      input: {
        output: {
          error: true,
          message: error.message
        }
      }
    }
    throw error
  }
}
```

---

## Testing

### DO: Write Comprehensive Tests

Test all code paths and edge cases.

**Good:**
```typescript
describe('FileAnalyzerAgent', () => {
  // Test happy path
  it('should analyze files successfully', async () => {
    // Test implementation
  })

  // Test edge cases
  it('should handle empty file list', async () => {
    // Test implementation
  })

  it('should handle missing files gracefully', async () => {
    // Test implementation
  })

  it('should handle large file sets', async () => {
    // Test implementation
  })

  // Test error cases
  it('should validate required parameters', async () => {
    // Test implementation
  })

  it('should handle read errors', async () => {
    // Test implementation
  })

  it('should handle invalid file patterns', async () => {
    // Test implementation
  })

  // Test integration
  it('should integrate with real file system', async () => {
    // Test implementation
  })
})
```

### DO: Use Test Fixtures

Create reusable test fixtures for consistent testing.

**Good:**
```typescript
// __fixtures__/sample-project/
// ├── src/
// │   ├── index.ts
// │   ├── utils.ts
// │   └── config.ts
// ├── tests/
// │   └── index.test.ts
// └── package.json

import path from 'path'

const FIXTURES_DIR = path.join(__dirname, '__fixtures__', 'sample-project')

describe('Agent Tests', () => {
  it('should analyze fixture project', async () => {
    const adapter = createAdapter(FIXTURES_DIR)

    const result = await adapter.executeAgent(
      agent,
      undefined,
      { pattern: '**/*.ts' }
    )

    expect(result.output.totalFiles).toBe(4)
  })
})
```

### DO: Mock External Dependencies

Mock file system, network, and other external dependencies.

**Good:**
```typescript
import { jest } from '@jest/globals'

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn()
}))

describe('FileOperations', () => {
  it('should handle file read errors', async () => {
    const fs = await import('fs/promises')
    fs.readFile.mockRejectedValue(new Error('ENOENT'))

    // Test error handling
  })
})
```

---

## Maintenance

### DO: Version Agents

Track agent versions for compatibility.

**Good:**
```typescript
export const fileAnalyzerAgent: AgentDefinition = {
  id: 'file-analyzer@1.2.0',  // Include version
  displayName: 'File Analyzer v1.2.0',
  version: '1.2.0',

  // Agent implementation
}

// CHANGELOG.md
// ## 1.2.0 - 2024-01-15
// - Added support for JSX files
// - Improved performance for large codebases
// - Fixed bug with symlinks
//
// ## 1.1.0 - 2024-01-01
// - Added maxFiles parameter
// - Added includeTests parameter
```

### DO: Review Regularly

Schedule regular code reviews and updates.

**Maintenance Checklist:**
- [ ] Update dependencies
- [ ] Review and update documentation
- [ ] Run tests and fix failures
- [ ] Check for deprecated APIs
- [ ] Review security advisories
- [ ] Optimize performance bottlenecks
- [ ] Clean up unused code
- [ ] Update examples
- [ ] Review error handling
- [ ] Check TypeScript types

### DO: Monitor Performance

Track and optimize agent performance.

**Good:**
```typescript
handleSteps: function* ({ logger }) {
  const startTime = Date.now()

  // Operations...

  const endTime = Date.now()
  const duration = endTime - startTime

  logger.info({
    operation: 'complete',
    duration,
    performance: duration < 5000 ? 'good' : 'slow'
  })

  // Alert if too slow
  if (duration > 10000) {
    logger.warn({
      message: 'Agent execution took longer than expected',
      duration,
      threshold: 10000
    })
  }
}
```

---

## See Also

- [FREE Mode API Reference](./FREE_MODE_API_REFERENCE.md)
- [Advanced Patterns](./ADVANCED_PATTERNS.md)
- [Performance Guide](./PERFORMANCE_GUIDE.md)
- [Architecture Guide](./ARCHITECTURE.md)
