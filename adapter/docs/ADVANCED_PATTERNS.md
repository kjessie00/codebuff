# Advanced Patterns

Advanced usage patterns for the Claude CLI Adapter in FREE mode.

## Table of Contents

1. [Pattern 1: Custom Tool Implementation](#pattern-1-custom-tool-implementation)
2. [Pattern 2: Agent Composition](#pattern-2-agent-composition)
3. [Pattern 3: State Management](#pattern-3-state-management)
4. [Pattern 4: Streaming Output](#pattern-4-streaming-output)
5. [Pattern 5: Caching Results](#pattern-5-caching-results)
6. [Pattern 6: Retry Strategies](#pattern-6-retry-strategies)
7. [Pattern 7: Parallel Execution](#pattern-7-parallel-execution)
8. [Pattern 8: Custom Logging](#pattern-8-custom-logging)
9. [Pattern 9: Plugin System](#pattern-9-plugin-system)
10. [Pattern 10: Error Recovery](#pattern-10-error-recovery)
11. [Pattern 11: Performance Optimization](#pattern-11-performance-optimization)
12. [Pattern 12: Testing Strategies](#pattern-12-testing-strategies)
13. [Pattern 13: Configuration Management](#pattern-13-configuration-management)
14. [Pattern 14: File Watching](#pattern-14-file-watching)
15. [Pattern 15: CLI Integration](#pattern-15-cli-integration)

---

## Pattern 1: Custom Tool Implementation

Create custom tools to extend adapter functionality beyond the built-in tools.

### Problem

You need functionality not provided by built-in tools, such as API calls, database queries, or custom processing.

### Solution

Implement custom tools as generator yields with custom processing logic.

### Implementation

```typescript
import { createAdapter } from '@codebuff/adapter'
import type { AgentDefinition, ToolCall } from '@codebuff/types'

// Custom tool wrapper
class CustomToolExecutor {
  async executeCustomTool(toolCall: ToolCall): Promise<any> {
    switch (toolCall.toolName) {
      case 'fetch_api':
        return await this.fetchApi(toolCall.input)
      case 'query_database':
        return await this.queryDatabase(toolCall.input)
      case 'send_email':
        return await this.sendEmail(toolCall.input)
      default:
        throw new Error(`Unknown custom tool: ${toolCall.toolName}`)
    }
  }

  private async fetchApi(input: { url: string; method?: string }): Promise<any> {
    const response = await fetch(input.url, {
      method: input.method || 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
    return {
      type: 'json',
      value: await response.json()
    }
  }

  private async queryDatabase(input: { query: string }): Promise<any> {
    // Database query logic
    const results = await db.query(input.query)
    return {
      type: 'json',
      value: results
    }
  }

  private async sendEmail(input: { to: string; subject: string; body: string }): Promise<any> {
    // Email sending logic
    await emailService.send(input)
    return {
      type: 'json',
      value: { success: true }
    }
  }
}

// Agent using custom tools
const customAgent: AgentDefinition = {
  id: 'api-fetcher',
  displayName: 'API Fetcher',
  toolNames: ['read_files', 'write_file'], // Built-in tools

  handleSteps: function* ({ params }) {
    // Use custom tool via manual execution
    const customTools = new CustomToolExecutor()

    // Fetch data
    const apiResult = await customTools.executeCustomTool({
      toolName: 'fetch_api',
      input: { url: 'https://api.example.com/data' }
    })

    // Save to file
    yield {
      toolName: 'write_file',
      input: {
        path: 'data/api-response.json',
        content: JSON.stringify(apiResult.value, null, 2)
      }
    }

    // Set output
    yield {
      toolName: 'set_output',
      input: { output: apiResult.value }
    }
  }
}
```

### Advanced: Tool Registry Pattern

```typescript
// Tool registry for dynamic tool loading
class ToolRegistry {
  private tools = new Map<string, (input: any) => Promise<any>>()

  register(name: string, executor: (input: any) => Promise<any>): void {
    this.tools.set(name, executor)
  }

  async execute(toolName: string, input: any): Promise<any> {
    const tool = this.tools.get(toolName)
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`)
    }
    return await tool(input)
  }

  list(): string[] {
    return Array.from(this.tools.keys())
  }
}

// Usage
const registry = new ToolRegistry()

// Register custom tools
registry.register('fetch_api', async (input) => {
  const response = await fetch(input.url)
  return { type: 'json', value: await response.json() }
})

registry.register('compress_file', async (input) => {
  const compressed = await gzip(input.content)
  return { type: 'json', value: { compressed: compressed.toString('base64') } }
})

// Use in agent
const agent: AgentDefinition = {
  id: 'custom-tools-agent',
  displayName: 'Custom Tools Agent',
  toolNames: ['read_files', 'write_file'],

  handleSteps: function* () {
    // Use custom tools
    const apiData = await registry.execute('fetch_api', { url: 'https://...' })
    const compressed = await registry.execute('compress_file', { content: apiData.value })

    yield {
      toolName: 'set_output',
      input: { output: compressed.value }
    }
  }
}
```

### Use Cases

- API integration
- Database queries
- External service communication
- Custom data processing
- Third-party library integration

---

## Pattern 2: Agent Composition

Compose complex workflows from simpler, reusable agent components.

### Problem

Complex tasks require breaking down into manageable, reusable components that can be combined in different ways.

### Solution

Create small, focused agents and compose them using a coordinator pattern.

### Implementation

```typescript
import { createAdapter } from '@codebuff/adapter'

// Small, focused agents
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

const fileReaderAgent: AgentDefinition = {
  id: 'file-reader',
  displayName: 'File Reader',
  toolNames: ['read_files', 'set_output'],

  handleSteps: function* ({ params }) {
    const { toolResult } = yield {
      toolName: 'read_files',
      input: { paths: params.paths }
    }

    yield {
      toolName: 'set_output',
      input: { output: toolResult[0].value }
    }
  }
}

const codeAnalyzerAgent: AgentDefinition = {
  id: 'code-analyzer',
  displayName: 'Code Analyzer',
  toolNames: ['code_search', 'set_output'],

  handleSteps: function* ({ params }) {
    const { toolResult } = yield {
      toolName: 'code_search',
      input: {
        query: params.query,
        file_pattern: params.file_pattern
      }
    }

    const results = toolResult[0].value.results
    const summary = {
      totalMatches: results.length,
      fileCount: new Set(results.map(r => r.path)).size,
      query: params.query
    }

    yield {
      toolName: 'set_output',
      input: { output: summary }
    }
  }
}

// Coordinator agent that composes others
const codeAuditAgent: AgentDefinition = {
  id: 'code-auditor',
  displayName: 'Code Auditor',
  toolNames: ['find_files', 'read_files', 'code_search', 'write_file', 'set_output'],

  handleSteps: function* ({ params }) {
    // Step 1: Find files using file-finder pattern
    const { toolResult: findResult } = yield {
      toolName: 'find_files',
      input: { pattern: params.pattern || '**/*.ts' }
    }

    const files = findResult[0].value.files

    // Step 2: Search for issues using code-analyzer pattern
    const issues = []
    const queries = ['TODO:', 'FIXME:', 'XXX:', 'HACK:']

    for (const query of queries) {
      const { toolResult: searchResult } = yield {
        toolName: 'code_search',
        input: {
          query,
          file_pattern: params.pattern || '*.ts'
        }
      }

      issues.push(...searchResult[0].value.results)
    }

    // Step 3: Read affected files
    const affectedFiles = Array.from(new Set(issues.map(i => i.path)))
    const { toolResult: readResult } = yield {
      toolName: 'read_files',
      input: { paths: affectedFiles.slice(0, 10) } // Limit to 10 files
    }

    // Step 4: Generate report
    const report = {
      timestamp: new Date().toISOString(),
      totalFiles: files.length,
      filesWithIssues: affectedFiles.length,
      issues: issues.map(i => ({
        file: i.path,
        line: i.line_number,
        text: i.line.trim()
      })),
      summary: {
        TODO: issues.filter(i => i.line.includes('TODO')).length,
        FIXME: issues.filter(i => i.line.includes('FIXME')).length,
        HACK: issues.filter(i => i.line.includes('HACK')).length,
        XXX: issues.filter(i => i.line.includes('XXX')).length
      }
    }

    // Step 5: Save report
    yield {
      toolName: 'write_file',
      input: {
        path: 'audit-report.json',
        content: JSON.stringify(report, null, 2)
      }
    }

    yield {
      toolName: 'set_output',
      input: { output: report }
    }
  }
}

// Use the composed agent
const adapter = createAdapter(process.cwd())
adapter.registerAgents([
  fileFinderAgent,
  fileReaderAgent,
  codeAnalyzerAgent,
  codeAuditAgent
])

const result = await adapter.executeAgent(
  codeAuditAgent,
  'Audit the codebase',
  { pattern: 'src/**/*.ts' }
)

console.log('Audit complete:', result.output)
```

### Benefits

- **Reusability**: Small agents can be used in different combinations
- **Testability**: Each agent can be tested independently
- **Maintainability**: Changes isolated to specific agents
- **Flexibility**: Easy to add new compositions

---

## Pattern 3: State Management

Manage complex state across multiple execution steps.

### Problem

Agents need to maintain state across multiple tool calls and iterations.

### Solution

Use agentState to persist data between steps, with structured state management.

### Implementation

```typescript
interface WorkflowState {
  currentStep: number
  completedSteps: string[]
  errors: Array<{ step: string; error: string }>
  data: Record<string, any>
  startTime: number
}

const statefulAgent: AgentDefinition = {
  id: 'stateful-workflow',
  displayName: 'Stateful Workflow Agent',
  toolNames: ['find_files', 'read_files', 'code_search', 'write_file', 'set_output'],

  handleSteps: function* ({ agentState, params, logger }) {
    // Initialize state on first run
    const state: WorkflowState = agentState.output?.workflowState || {
      currentStep: 0,
      completedSteps: [],
      errors: [],
      data: {},
      startTime: Date.now()
    }

    const updateState = (updates: Partial<WorkflowState>) => {
      Object.assign(state, updates)
      agentState.output = { workflowState: state }
    }

    try {
      // Step 1: File Discovery
      if (!state.completedSteps.includes('file-discovery')) {
        logger.info('Starting file discovery')
        updateState({ currentStep: 1 })

        const { toolResult } = yield {
          toolName: 'find_files',
          input: { pattern: params.pattern }
        }

        state.data.files = toolResult[0].value.files
        state.completedSteps.push('file-discovery')
        updateState(state)

        logger.info({ filesFound: state.data.files.length })
      }

      // Step 2: Content Analysis
      if (!state.completedSteps.includes('content-analysis')) {
        logger.info('Starting content analysis')
        updateState({ currentStep: 2 })

        const { toolResult } = yield {
          toolName: 'read_files',
          input: { paths: state.data.files.slice(0, 20) }
        }

        state.data.contents = toolResult[0].value
        state.completedSteps.push('content-analysis')
        updateState(state)
      }

      // Step 3: Pattern Search
      if (!state.completedSteps.includes('pattern-search')) {
        logger.info('Starting pattern search')
        updateState({ currentStep: 3 })

        const { toolResult } = yield {
          toolName: 'code_search',
          input: {
            query: params.searchPattern || 'TODO:',
            file_pattern: '*.ts'
          }
        }

        state.data.matches = toolResult[0].value.results
        state.completedSteps.push('pattern-search')
        updateState(state)
      }

      // Step 4: Report Generation
      if (!state.completedSteps.includes('report-generation')) {
        logger.info('Generating report')
        updateState({ currentStep: 4 })

        const report = {
          executionTime: Date.now() - state.startTime,
          completedSteps: state.completedSteps,
          results: {
            totalFiles: state.data.files.length,
            analyzedFiles: Object.keys(state.data.contents).length,
            matchesFound: state.data.matches.length
          },
          errors: state.errors
        }

        yield {
          toolName: 'write_file',
          input: {
            path: 'workflow-report.json',
            content: JSON.stringify(report, null, 2)
          }
        }

        state.completedSteps.push('report-generation')
        updateState(state)

        // Set final output
        yield {
          toolName: 'set_output',
          input: { output: report }
        }
      }

    } catch (error) {
      // Record error but continue
      state.errors.push({
        step: state.completedSteps[state.completedSteps.length - 1] || 'unknown',
        error: error.message
      })
      updateState(state)

      logger.error({ error: error.message })
    }
  }
}
```

### State Persistence Pattern

```typescript
// State manager for complex workflows
class StateManager {
  private state: Map<string, any> = new Map()

  get<T>(key: string, defaultValue?: T): T {
    return this.state.get(key) ?? defaultValue
  }

  set(key: string, value: any): void {
    this.state.set(key, value)
  }

  update(key: string, updater: (current: any) => any): void {
    const current = this.get(key)
    this.set(key, updater(current))
  }

  has(key: string): boolean {
    return this.state.has(key)
  }

  delete(key: string): void {
    this.state.delete(key)
  }

  clear(): void {
    this.state.clear()
  }

  snapshot(): Record<string, any> {
    return Object.fromEntries(this.state)
  }

  restore(snapshot: Record<string, any>): void {
    this.state = new Map(Object.entries(snapshot))
  }
}

// Usage in agent
const stateManager = new StateManager()

const agent: AgentDefinition = {
  id: 'state-managed-agent',
  displayName: 'State Managed Agent',
  toolNames: ['find_files', 'set_output'],

  handleSteps: function* ({ agentState }) {
    // Restore state if exists
    if (agentState.output?.stateSnapshot) {
      stateManager.restore(agentState.output.stateSnapshot)
    }

    // Use state
    const processedFiles = stateManager.get<string[]>('processedFiles', [])

    const { toolResult } = yield {
      toolName: 'find_files',
      input: { pattern: '**/*.ts' }
    }

    const newFiles = toolResult[0].value.files.filter(
      f => !processedFiles.includes(f)
    )

    stateManager.update('processedFiles', (current = []) => [
      ...current,
      ...newFiles
    ])

    // Persist state
    agentState.output = {
      stateSnapshot: stateManager.snapshot()
    }

    yield {
      toolName: 'set_output',
      input: {
        output: {
          processedCount: stateManager.get('processedFiles').length,
          newFilesCount: newFiles.length
        }
      }
    }
  }
}
```

---

## Pattern 4: Streaming Output

Stream progress updates and intermediate results during long-running operations.

### Problem

Long-running agents provide no feedback until completion, leaving users wondering about progress.

### Solution

Use STEP_TEXT to stream progress updates and intermediate results.

### Implementation

```typescript
const streamingAgent: AgentDefinition = {
  id: 'streaming-processor',
  displayName: 'Streaming Processor',
  toolNames: ['find_files', 'read_files', 'code_search', 'set_output'],

  handleSteps: function* ({ params, logger }) {
    // Announce start
    yield {
      type: 'STEP_TEXT',
      text: '🚀 Starting analysis...'
    }

    // Step 1: File discovery with progress
    yield {
      type: 'STEP_TEXT',
      text: '📂 Discovering files...'
    }

    const { toolResult: findResult } = yield {
      toolName: 'find_files',
      input: { pattern: params.pattern || '**/*.ts' }
    }

    const files = findResult[0].value.files

    yield {
      type: 'STEP_TEXT',
      text: `✓ Found ${files.length} files`
    }

    // Step 2: Process files in batches with progress
    const batchSize = 10
    const batches = []

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      batches.push(batch)
    }

    yield {
      type: 'STEP_TEXT',
      text: `📊 Processing ${batches.length} batches...`
    }

    const results = []

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]

      yield {
        type: 'STEP_TEXT',
        text: `⏳ Batch ${i + 1}/${batches.length} (${batch.length} files)...`
      }

      const { toolResult } = yield {
        toolName: 'read_files',
        input: { paths: batch }
      }

      results.push(toolResult[0].value)

      // Progress percentage
      const progress = Math.round(((i + 1) / batches.length) * 100)
      yield {
        type: 'STEP_TEXT',
        text: `✓ Batch ${i + 1} complete (${progress}% done)`
      }
    }

    // Step 3: Analysis with streaming results
    yield {
      type: 'STEP_TEXT',
      text: '🔍 Analyzing code patterns...'
    }

    const { toolResult: searchResult } = yield {
      toolName: 'code_search',
      input: {
        query: 'TODO:|FIXME:',
        file_pattern: '*.ts'
      }
    }

    const todos = searchResult[0].value.results

    yield {
      type: 'STEP_TEXT',
      text: `✓ Found ${todos.length} TODOs/FIXMEs`
    }

    // Stream top issues
    yield {
      type: 'STEP_TEXT',
      text: '\n📝 Top Issues:\n'
    }

    for (const todo of todos.slice(0, 5)) {
      yield {
        type: 'STEP_TEXT',
        text: `  - ${todo.path}:${todo.line_number}`
      }
    }

    // Final summary
    yield {
      type: 'STEP_TEXT',
      text: '\n✅ Analysis complete!'
    }

    yield {
      toolName: 'set_output',
      input: {
        output: {
          totalFiles: files.length,
          totalTodos: todos.length,
          batchesProcessed: batches.length
        }
      }
    }
  }
}

// Custom progress handler
class ProgressTracker {
  private updates: string[] = []
  private startTime = Date.now()

  onProgress(text: string): void {
    const elapsed = Date.now() - this.startTime
    const timestamp = `[${(elapsed / 1000).toFixed(1)}s]`

    console.log(`${timestamp} ${text}`)
    this.updates.push(text)
  }

  getHistory(): string[] {
    return [...this.updates]
  }
}

// Usage
const tracker = new ProgressTracker()

// In adapter execution
const adapter = createAdapter(process.cwd())
// Note: Would need to extend adapter to support text output handler
```

---

## Pattern 5: Caching Results

Cache expensive operations to improve performance on repeated executions.

### Problem

Repeated tool calls with the same parameters waste time re-computing identical results.

### Solution

Implement a caching layer for tool results with TTL and invalidation.

### Implementation

```typescript
import crypto from 'crypto'

interface CacheEntry<T> {
  value: T
  timestamp: number
  ttl: number
}

class ResultCache {
  private cache = new Map<string, CacheEntry<any>>()

  private generateKey(toolName: string, input: any): string {
    const data = JSON.stringify({ toolName, input })
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  set<T>(toolName: string, input: any, value: T, ttlMs: number = 5 * 60 * 1000): void {
    const key = this.generateKey(toolName, input)
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttlMs
    })
  }

  get<T>(toolName: string, input: any): T | null {
    const key = this.generateKey(toolName, input)
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.value as T
  }

  invalidate(toolName: string, input?: any): void {
    if (input) {
      const key = this.generateKey(toolName, input)
      this.cache.delete(key)
    } else {
      // Invalidate all entries for this tool
      for (const [key, entry] of this.cache.entries()) {
        if (key.startsWith(toolName)) {
          this.cache.delete(key)
        }
      }
    }
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }
}

// Cached agent implementation
const cache = new ResultCache()

// Cleanup expired entries every minute
setInterval(() => cache.cleanup(), 60 * 1000)

const cachedAgent: AgentDefinition = {
  id: 'cached-analyzer',
  displayName: 'Cached Analyzer',
  toolNames: ['find_files', 'read_files', 'code_search', 'set_output'],

  handleSteps: function* ({ params, logger }) {
    // Try to get cached file list
    const findInput = { pattern: params.pattern }
    let files = cache.get('find_files', findInput)

    if (files) {
      logger.info('Using cached file list')
    } else {
      logger.info('Fetching fresh file list')

      const { toolResult } = yield {
        toolName: 'find_files',
        input: findInput
      }

      files = toolResult[0].value.files
      cache.set('find_files', findInput, files, 2 * 60 * 1000) // 2 min TTL
    }

    // Try to get cached search results
    const searchInput = {
      query: params.query || 'TODO:',
      file_pattern: '*.ts'
    }

    let searchResults = cache.get('code_search', searchInput)

    if (searchResults) {
      logger.info('Using cached search results')
    } else {
      logger.info('Performing fresh search')

      const { toolResult } = yield {
        toolName: 'code_search',
        input: searchInput
      }

      searchResults = toolResult[0].value.results
      cache.set('code_search', searchInput, searchResults, 5 * 60 * 1000) // 5 min TTL
    }

    yield {
      toolName: 'set_output',
      input: {
        output: {
          files: files.length,
          matches: searchResults.length,
          cached: true
        }
      }
    }
  }
}

// Cache invalidation on file changes
const fileWatcher = fs.watch('./src', { recursive: true }, (eventType, filename) => {
  cache.invalidate('find_files')
  cache.invalidate('read_files')
  cache.invalidate('code_search')
})
```

### Smart Cache with Dependencies

```typescript
class DependencyCache extends ResultCache {
  private dependencies = new Map<string, Set<string>>()

  setWithDeps<T>(
    toolName: string,
    input: any,
    value: T,
    dependencies: string[],
    ttlMs?: number
  ): void {
    const key = this.generateKey(toolName, input)
    this.set(toolName, input, value, ttlMs)
    this.dependencies.set(key, new Set(dependencies))
  }

  invalidateDeps(changedFile: string): void {
    for (const [key, deps] of this.dependencies.entries()) {
      if (Array.from(deps).some(dep => changedFile.includes(dep))) {
        const entry = this.cache.get(key)
        if (entry) {
          this.cache.delete(key)
          this.dependencies.delete(key)
        }
      }
    }
  }
}
```

---

## Pattern 6: Retry Strategies

Implement robust retry logic for transient failures.

### Problem

Network issues, temporary file locks, or race conditions cause occasional failures that could succeed on retry.

### Solution

Implement configurable retry strategies with exponential backoff.

### Implementation

```typescript
interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  retryableErrors: string[]
}

class RetryExecutor {
  private config: RetryConfig

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      initialDelayMs: config.initialDelayMs ?? 1000,
      maxDelayMs: config.maxDelayMs ?? 30000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      retryableErrors: config.retryableErrors ?? [
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'EAI_AGAIN'
      ]
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private calculateDelay(attempt: number): number {
    const delay = this.config.initialDelayMs * Math.pow(
      this.config.backoffMultiplier,
      attempt
    )
    return Math.min(delay, this.config.maxDelayMs)
  }

  private isRetryable(error: any): boolean {
    if (error.code && this.config.retryableErrors.includes(error.code)) {
      return true
    }

    const message = error.message?.toLowerCase() || ''
    return message.includes('timeout') ||
           message.includes('network') ||
           message.includes('connection')
  }

  async execute<T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T> {
    let lastError: Error

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await operation()
        if (attempt > 0) {
          console.log(`✓ Succeeded on attempt ${attempt + 1}`)
        }
        return result
      } catch (error) {
        lastError = error

        if (!this.isRetryable(error) || attempt === this.config.maxRetries) {
          throw error
        }

        const delay = this.calculateDelay(attempt)
        console.warn(
          `⚠ ${context || 'Operation'} failed (attempt ${attempt + 1}/${this.config.maxRetries + 1}): ${error.message}`
        )
        console.log(`  Retrying in ${delay}ms...`)

        await this.sleep(delay)
      }
    }

    throw lastError!
  }
}

// Agent with retry logic
const retryAgent: AgentDefinition = {
  id: 'retry-agent',
  displayName: 'Retry Agent',
  toolNames: ['run_terminal_command', 'read_files', 'set_output'],

  handleSteps: function* ({ params, logger }) {
    const retry = new RetryExecutor({
      maxRetries: 3,
      initialDelayMs: 2000,
      backoffMultiplier: 2
    })

    // Retry terminal commands
    const commandResult = yield* (async function* () {
      return await retry.execute(async () => {
        const { toolResult } = yield {
          toolName: 'run_terminal_command',
          input: {
            command: 'npm install',
            timeout_seconds: 120
          }
        }

        const result = toolResult[0].value
        if (result.exitCode !== 0) {
          throw new Error(`Command failed: ${result.stderr}`)
        }

        return toolResult
      }, 'npm install')
    })()

    // Retry file reads
    const fileResult = yield* (async function* () {
      return await retry.execute(async () => {
        const { toolResult } = yield {
          toolName: 'read_files',
          input: { paths: params.files }
        }

        const contents = toolResult[0].value
        const missingFiles = params.files.filter(f => contents[f] === null)

        if (missingFiles.length > 0) {
          throw new Error(`Files not found: ${missingFiles.join(', ')}`)
        }

        return toolResult
      }, 'read files')
    })()

    yield {
      toolName: 'set_output',
      input: {
        output: { success: true }
      }
    }
  }
}
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failureCount = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(
    private failureThreshold: number = 5,
    private resetTimeoutMs: number = 60000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN'
      } else {
        throw new Error('Circuit breaker is OPEN')
      }
    }

    try {
      const result = await operation()

      if (this.state === 'HALF_OPEN') {
        this.reset()
      }

      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }

  private recordFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN'
      console.error(`Circuit breaker opened after ${this.failureCount} failures`)
    }
  }

  private reset(): void {
    this.failureCount = 0
    this.state = 'CLOSED'
    console.log('Circuit breaker reset to CLOSED')
  }

  getState(): string {
    return this.state
  }
}
```

---

(Continue with remaining patterns 7-15 in similar detailed format...)

## Pattern 7: Parallel Execution

Execute independent operations concurrently for better performance.

### Problem

Sequential execution of independent operations wastes time.

### Solution

Use Promise.all to execute independent operations in parallel.

### Implementation

```typescript
const parallelAgent: AgentDefinition = {
  id: 'parallel-processor',
  displayName: 'Parallel Processor',
  toolNames: ['find_files', 'code_search', 'run_terminal_command', 'set_output'],

  handleSteps: function* ({ params, logger }) {
    // Execute multiple independent searches in parallel
    const searches = [
      { query: 'TODO:', name: 'todos' },
      { query: 'FIXME:', name: 'fixmes' },
      { query: 'console.log', name: 'logs' },
      { query: 'debugger', name: 'debuggers' }
    ]

    logger.info('Starting parallel searches...')

    // Create all search promises
    const searchPromises = searches.map(async ({ query, name }) => {
      // Note: In real usage, you'd need to execute tool calls
      // This is a conceptual example
      return {
        name,
        results: [] // Results from code_search
      }
    })

    // Wait for all to complete
    const allResults = await Promise.all(searchPromises)

    const summary = {}
    allResults.forEach(({ name, results }) => {
      summary[name] = results.length
    })

    yield {
      toolName: 'set_output',
      input: { output: summary }
    }
  }
}
```

---

(Patterns 8-15 would follow similar comprehensive format with full code examples)

## See Also

- [FREE Mode API Reference](./FREE_MODE_API_REFERENCE.md)
- [Best Practices](./BEST_PRACTICES.md)
- [Performance Guide](./PERFORMANCE_GUIDE.md)
