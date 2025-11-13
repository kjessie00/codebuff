# Claude CLI Adapter - Tool Reference

Complete documentation for all tools implemented in the Claude Code CLI Adapter, including parameters, outputs, examples, and error scenarios.

## Table of Contents

- [Overview](#overview)
- [Tool Mapping](#tool-mapping)
- [Implemented Tools](#implemented-tools)
  - [File Operations](#file-operations)
    - [read_files](#read_files)
    - [write_file](#write_file)
    - [str_replace](#str_replace)
  - [Code Search](#code-search)
    - [code_search](#code_search)
    - [find_files](#find_files)
  - [Terminal](#terminal)
    - [run_terminal_command](#run_terminal_command)
  - [Agent Management](#agent-management)
    - [spawn_agents](#spawn_agents)
    - [set_output](#set_output)
- [Missing Tools](#missing-tools)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

## Overview

The Claude CLI Adapter implements 8 core tools that map Codebuff's tool system to Claude Code CLI's tool set. Each tool is designed to be compatible with both systems while leveraging Claude CLI's capabilities.

**Execution Model:**
- All tools execute synchronously within the adapter
- Results are returned in Codebuff's ToolResultOutput format
- Tools operate within a sandboxed working directory (cwd)
- Path traversal protection is enforced on all file operations

**Tool Result Format:**
```typescript
type ToolResultOutput =
  | { type: 'json', value: any }
  | { type: 'media', data: string, mediaType: string }
```

---

## Tool Mapping

Mapping between Codebuff tools and Claude CLI tools:

| Codebuff Tool | Claude CLI Tool | Implementation | Status |
|--------------|-----------------|----------------|--------|
| read_files | Read | FileOperationsTools | ✅ Complete |
| write_file | Write | FileOperationsTools | ✅ Complete |
| str_replace | Edit | FileOperationsTools | ✅ Complete |
| code_search | Grep | CodeSearchTools | ✅ Complete |
| find_files | Glob | CodeSearchTools | ✅ Complete |
| run_terminal_command | Bash | TerminalTools | ✅ Complete |
| spawn_agents | Task | SpawnAgentsAdapter | ✅ Complete |
| set_output | (internal) | Built-in | ✅ Complete |

**Notes:**
- All 8 core tools are fully implemented and tested
- spawn_agents uses sequential execution (Claude CLI limitation)
- 18 additional Codebuff tools are not yet implemented (see [Missing Tools](#missing-tools))

---

## Implemented Tools

### File Operations

File operation tools map to Claude CLI's Read, Write, and Edit tools.

---

#### read_files

Read multiple files from disk.

**Codebuff Tool:** `read_files`
**Claude CLI Tool:** `Read`
**Implementation:** `FileOperationsTools.readFiles()`

**Input Parameters:**

```typescript
interface ReadFilesParams {
  paths: string[]  // Array of file paths relative to cwd
}
```

**Output Format:**

```typescript
{
  type: 'json',
  value: {
    [filePath: string]: string | null  // File content or null if error
  }
}
```

**Usage Example:**

```typescript
// Read single file
yield {
  toolName: 'read_files',
  input: { paths: ['package.json'] }
}

// Read multiple files
yield {
  toolName: 'read_files',
  input: {
    paths: [
      'src/index.ts',
      'src/types.ts',
      'README.md'
    ]
  }
}
```

**Output Example:**

```typescript
[{
  type: 'json',
  value: {
    'package.json': '{\n  "name": "my-package",\n  ...',
    'src/index.ts': 'export const foo = "bar";\n...',
    'README.md': '# My Project\n...'
  }
}]
```

**Error Scenarios:**

1. **File not found**: Returns `null` for that file path
   ```typescript
   {
     'missing.txt': null,
     'existing.txt': 'content here'
   }
   ```

2. **Path traversal**: Throws error if path is outside cwd
   ```typescript
   Error: 'Path traversal detected: /etc/passwd is outside working directory'
   ```

3. **Permission denied**: Returns `null` and logs warning

**Codebuff Compatibility:**
- ✅ Fully compatible
- Supports same input/output format
- Handles multiple files in single call
- Returns null for missing files (partial success)

---

#### write_file

Write content to a file.

**Codebuff Tool:** `write_file`
**Claude CLI Tool:** `Write`
**Implementation:** `FileOperationsTools.writeFile()`

**Input Parameters:**

```typescript
interface WriteFileParams {
  path: string    // File path relative to cwd
  content: string // Content to write
}
```

**Output Format:**

```typescript
{
  type: 'json',
  value: {
    success: boolean
    path: string
    error?: string  // Present if success is false
  }
}
```

**Usage Example:**

```typescript
// Write new file
yield {
  toolName: 'write_file',
  input: {
    path: 'src/new-module.ts',
    content: 'export const VERSION = "1.0.0";\n'
  }
}

// Overwrite existing file
yield {
  toolName: 'write_file',
  input: {
    path: 'config.json',
    content: JSON.stringify({ port: 8080 }, null, 2)
  }
}
```

**Output Example:**

```typescript
// Success
[{
  type: 'json',
  value: {
    success: true,
    path: 'src/new-module.ts'
  }
}]

// Failure
[{
  type: 'json',
  value: {
    success: false,
    path: 'readonly/file.txt',
    error: 'EACCES: permission denied'
  }
}]
```

**Error Scenarios:**

1. **Path traversal**: Throws error
2. **Permission denied**: Returns error in result
3. **Invalid path**: Returns error in result
4. **Parent directory doesn't exist**: Creates it automatically (recursive: true)

**Codebuff Compatibility:**
- ✅ Fully compatible
- Same input/output format
- Auto-creates parent directories
- Returns structured error information

---

#### str_replace

Replace a string in a file with a new string.

**Codebuff Tool:** `str_replace`
**Claude CLI Tool:** `Edit`
**Implementation:** `FileOperationsTools.strReplace()`

**Input Parameters:**

```typescript
interface StrReplaceParams {
  path: string       // File path relative to cwd
  old_string: string // Exact string to find
  new_string: string // Replacement string
}
```

**Output Format:**

```typescript
{
  type: 'json',
  value: {
    success: boolean
    path: string
    error?: string      // Present if success is false
    old_string?: string // Echoed back on error
  }
}
```

**Usage Example:**

```typescript
// Replace configuration value
yield {
  toolName: 'str_replace',
  input: {
    path: 'src/config.ts',
    old_string: 'const PORT = 3000',
    new_string: 'const PORT = 8080'
  }
}

// Multi-line replacement
yield {
  toolName: 'str_replace',
  input: {
    path: 'README.md',
    old_string: '## Old Section\nOld content here',
    new_string: '## New Section\nNew content here'
  }
}
```

**Output Example:**

```typescript
// Success
[{
  type: 'json',
  value: {
    success: true,
    path: 'src/config.ts'
  }
}]

// String not found
[{
  type: 'json',
  value: {
    success: false,
    path: 'src/config.ts',
    error: 'old_string not found in file',
    old_string: 'const PORT = 3000'
  }
}]
```

**Error Scenarios:**

1. **File not found**: Returns error
   ```typescript
   { success: false, error: 'File not found: missing.txt' }
   ```

2. **String not found**: Returns error with old_string
   ```typescript
   { success: false, error: 'old_string not found in file' }
   ```

3. **Path traversal**: Throws error

**Behavior Notes:**
- Replaces **first occurrence only** (same as Claude CLI Edit)
- Exact string matching (case-sensitive)
- Supports multi-line strings
- Preserves file encoding (UTF-8)

**Codebuff Compatibility:**
- ✅ Fully compatible
- Same first-occurrence-only behavior
- Exact string matching
- Structured error responses

---

### Code Search

Code search tools map to Claude CLI's Grep and Glob tools.

---

#### code_search

Search for code patterns using ripgrep.

**Codebuff Tool:** `code_search`
**Claude CLI Tool:** `Grep`
**Implementation:** `CodeSearchTools.codeSearch()`

**Input Parameters:**

```typescript
interface CodeSearchInput {
  query: string           // Search pattern (regex supported)
  file_pattern?: string   // File glob pattern (e.g., "*.ts")
  case_sensitive?: boolean // Default: false
  cwd?: string            // Search directory (relative to adapter cwd)
  maxResults?: number     // Maximum results (default: 250)
}
```

**Output Format:**

```typescript
{
  type: 'json',
  value: {
    results: Array<{
      path: string        // Relative path from cwd
      line_number: number // Line number (1-indexed)
      line: string        // Line content (trimmed)
      match?: string      // Matched text
    }>
    total: number         // Number of results
    query: string         // Original query
    case_sensitive: boolean
    file_pattern?: string
    by_file: {            // Results grouped by file
      [path: string]: SearchResult[]
    }
  }
}
```

**Usage Example:**

```typescript
// Simple text search
yield {
  toolName: 'code_search',
  input: {
    query: 'TODO',
    file_pattern: '*.ts'
  }
}

// Regex search
yield {
  toolName: 'code_search',
  input: {
    query: 'function\\s+\\w+\\(',
    file_pattern: '*.ts',
    case_sensitive: true
  }
}

// Search in subdirectory
yield {
  toolName: 'code_search',
  input: {
    query: 'export',
    cwd: 'src/components',
    maxResults: 50
  }
}
```

**Output Example:**

```typescript
[{
  type: 'json',
  value: {
    results: [
      {
        path: 'src/index.ts',
        line_number: 42,
        line: '  // TODO: Implement error handling',
        match: 'TODO'
      },
      {
        path: 'src/utils.ts',
        line_number: 15,
        line: '// TODO: Add unit tests',
        match: 'TODO'
      }
    ],
    total: 2,
    query: 'TODO',
    case_sensitive: false,
    file_pattern: '*.ts',
    by_file: {
      'src/index.ts': [{ path: 'src/index.ts', line_number: 42, ... }],
      'src/utils.ts': [{ path: 'src/utils.ts', line_number: 15, ... }]
    }
  }
}]
```

**Error Scenarios:**

1. **No matches found**: Returns empty results
   ```typescript
   { results: [], total: 0, message: 'No matches found' }
   ```

2. **Ripgrep not installed**: Returns error
   ```typescript
   { error: 'rg: command not found', results: [], total: 0 }
   ```

3. **Invalid regex**: Returns error from ripgrep

**Requirements:**
- Requires `ripgrep` (rg) installed on system
- Install: `brew install ripgrep` (macOS) or `apt install ripgrep` (Ubuntu)

**Codebuff Compatibility:**
- ✅ Fully compatible
- Same input parameters
- Enhanced output with by_file grouping
- Respects maxResults limit

---

#### find_files

Find files matching a glob pattern.

**Codebuff Tool:** `find_files`
**Claude CLI Tool:** `Glob`
**Implementation:** `CodeSearchTools.findFiles()`

**Input Parameters:**

```typescript
interface FindFilesInput {
  pattern: string // Glob pattern (e.g., "**/*.ts", "src/test-*.js")
  cwd?: string    // Search directory (relative to adapter cwd)
}
```

**Output Format:**

```typescript
{
  type: 'json',
  value: {
    files: string[]     // Array of matching file paths
    total: number       // Number of files found
    pattern: string     // Original pattern
    search_dir: string  // Directory searched
  }
}
```

**Usage Example:**

```typescript
// Find TypeScript files
yield {
  toolName: 'find_files',
  input: { pattern: '**/*.ts' }
}

// Find test files
yield {
  toolName: 'find_files',
  input: { pattern: '**/*.test.{ts,tsx,js,jsx}' }
}

// Find in specific directory
yield {
  toolName: 'find_files',
  input: {
    pattern: '*.json',
    cwd: 'config'
  }
}
```

**Output Example:**

```typescript
[{
  type: 'json',
  value: {
    files: [
      'src/index.ts',
      'src/types.ts',
      'src/utils.ts',
      'tests/index.test.ts'
    ],
    total: 4,
    pattern: '**/*.ts',
    search_dir: '.'
  }
}]
```

**Behavior:**
- Results sorted by modification time (newest first)
- Excludes directories (files only)
- Ignores dotfiles by default
- Auto-excludes common directories:
  - `node_modules/`
  - `.git/`
  - `dist/`
  - `build/`
  - `.next/`
  - `coverage/`

**Error Scenarios:**

1. **No matches**: Returns empty array
   ```typescript
   { files: [], total: 0, pattern: '*.xyz' }
   ```

2. **Invalid pattern**: Returns error
   ```typescript
   { error: 'Invalid glob pattern', files: [], total: 0 }
   ```

**Glob Pattern Syntax:**
- `*` - Matches any characters (except /)
- `**` - Matches any characters (including /)
- `?` - Matches single character
- `{a,b}` - Matches a or b
- `[abc]` - Matches a, b, or c

**Codebuff Compatibility:**
- ✅ Fully compatible
- Same glob pattern syntax
- Sorted by modification time
- Excludes common directories

---

### Terminal

Terminal tool maps to Claude CLI's Bash tool.

---

#### run_terminal_command

Execute a shell command.

**Codebuff Tool:** `run_terminal_command`
**Claude CLI Tool:** `Bash`
**Implementation:** `TerminalTools.runTerminalCommand()`

**Input Parameters:**

```typescript
interface RunTerminalCommandInput {
  command: string              // Shell command to execute
  mode?: 'user' | 'agent'      // Execution mode
  process_type?: 'SYNC' | 'ASYNC' // Sync or background
  timeout_seconds?: number     // Timeout in seconds (default: 30)
  cwd?: string                 // Working directory (relative to adapter cwd)
  env?: Record<string, string> // Environment variables
  description?: string         // Command description (for logging)
}
```

**Output Format:**

```typescript
{
  type: 'json',
  value: {
    output: string       // Formatted command output
    command: string      // Command that was executed
    executionTime: number // Execution time in milliseconds
    error?: boolean      // true if command failed
  }
}
```

**Usage Example:**

```typescript
// Simple command
yield {
  toolName: 'run_terminal_command',
  input: { command: 'git status' }
}

// With timeout
yield {
  toolName: 'run_terminal_command',
  input: {
    command: 'npm test',
    timeout_seconds: 60
  }
}

// With custom environment
yield {
  toolName: 'run_terminal_command',
  input: {
    command: 'node script.js',
    env: {
      NODE_ENV: 'production',
      DEBUG: '*'
    }
  }
}

// In subdirectory
yield {
  toolName: 'run_terminal_command',
  input: {
    command: 'npm install',
    cwd: 'packages/core',
    timeout_seconds: 120
  }
}
```

**Output Example:**

```typescript
// Success
[{
  type: 'json',
  value: {
    output: `$ git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean`,
    command: 'git status',
    executionTime: 234
  }
}]

// With stderr
[{
  type: 'json',
  value: {
    output: `$ npm test

[STDERR]
npm WARN deprecated package@1.0.0

[Exit code: 1]
[Completed in 2.34s]`,
    command: 'npm test',
    executionTime: 2340,
    error: true
  }
}]
```

**Output Format:**
The output field follows Claude CLI Bash tool format:
```
$ {command}
{stdout}

[STDERR]
{stderr}

[Exit code: {code}]
[Completed in {time}s]
```

**Error Scenarios:**

1. **Command timeout**: Returns error output
   ```typescript
   {
     output: '$ long-command\n[ERROR] Command timed out and was killed',
     error: true
   }
   ```

2. **Command not found**: Returns error output
   ```typescript
   {
     output: '$ invalid-cmd\n[ERROR] command not found: invalid-cmd',
     error: true
   }
   ```

3. **Non-zero exit code**: Includes exit code in output
   ```typescript
   {
     output: '$ failing-command\n...\n[Exit code: 1]',
     error: true
   }
   ```

4. **Path traversal**: Throws error

**Security:**
- Commands run in sandboxed cwd
- Path traversal protection enforced
- Environment variables merged safely
- Timeout protection (default 30s)
- 10MB output buffer limit

**Codebuff Compatibility:**
- ✅ Fully compatible
- Same input parameters
- Enhanced output formatting
- Timeout and environment support

---

### Agent Management

Agent management tools for spawning sub-agents and setting output.

---

#### spawn_agents

Spawn and execute multiple sub-agents.

**Codebuff Tool:** `spawn_agents`
**Claude CLI Tool:** `Task`
**Implementation:** `SpawnAgentsAdapter.spawnAgents()`

**Input Parameters:**

```typescript
interface SpawnAgentsParams {
  agents: Array<{
    agent_type: string           // Agent ID or qualified ref
    prompt?: string              // Prompt for the agent
    params?: Record<string, any> // Agent parameters
  }>
}
```

**Output Format:**

```typescript
{
  type: 'json',
  value: Array<{
    agentType: string  // Agent ID that was spawned
    agentName: string  // Display name of the agent
    value: any         // Agent output or error
  }>
}
```

**Usage Example:**

```typescript
// Spawn multiple agents
yield {
  toolName: 'spawn_agents',
  input: {
    agents: [
      {
        agent_type: 'file-picker',
        prompt: 'Find all TypeScript files',
        params: { pattern: '**/*.ts' }
      },
      {
        agent_type: 'code-reviewer',
        prompt: 'Review the code for issues'
      },
      {
        agent_type: 'thinker',
        prompt: 'Analyze the architecture'
      }
    ]
  }
}
```

**Output Example:**

```typescript
[{
  type: 'json',
  value: [
    {
      agentType: 'file-picker',
      agentName: 'File Picker',
      value: {
        files: ['src/index.ts', 'src/types.ts'],
        total: 2
      }
    },
    {
      agentType: 'code-reviewer',
      agentName: 'Code Reviewer',
      value: {
        issues: [...],
        summary: 'Found 3 issues'
      }
    },
    {
      agentType: 'thinker',
      agentName: 'Thinker',
      value: {
        analysis: '...'
      }
    }
  ]
}]
```

**Error Scenarios:**

1. **Agent not found**: Returns error in result
   ```typescript
   {
     agentType: 'unknown-agent',
     agentName: 'unknown-agent',
     value: {
       errorMessage: 'Agent not found in registry: unknown-agent'
     }
   }
   ```

2. **Agent execution failed**: Returns error in result
   ```typescript
   {
     agentType: 'failing-agent',
     agentName: 'Failing Agent',
     value: {
       errorMessage: 'Error: Agent execution failed'
     }
   }
   ```

**Execution Model:**

⚠️ **Important Difference from Codebuff:**
- **Codebuff**: Parallel execution using `Promise.allSettled`
- **Claude CLI Adapter**: Sequential execution (one agent at a time)
- **Reason**: Claude CLI Task tool limitation
- **Impact**: Slower but more predictable execution

**Agent Resolution:**
Supports multiple agent reference formats:
- Simple ID: `'file-picker'`
- Versioned: `'file-picker@0.0.1'`
- Qualified: `'codebuff/file-picker@0.0.1'`

All resolve to the base agent ID in the registry.

**Codebuff Compatibility:**
- ⚠️ Sequential vs parallel execution
- ✅ Same input/output format
- ✅ Error handling per agent
- ✅ Agent resolution logic

---

#### set_output

Set the agent's output value.

**Codebuff Tool:** `set_output`
**Claude CLI Tool:** (internal)
**Implementation:** Built-in

**Input Parameters:**

```typescript
interface SetOutputParams {
  output: any  // Any JSON-serializable value
}
```

**Output Format:**

```typescript
{
  type: 'json',
  value: {
    success: true
    output: any  // The output value that was set
  }
}
```

**Usage Example:**

```typescript
// Set simple output
yield {
  toolName: 'set_output',
  input: {
    output: { message: 'Task completed successfully' }
  }
}

// Set complex output
yield {
  toolName: 'set_output',
  input: {
    output: {
      files: ['a.ts', 'b.ts'],
      analysis: { issues: 0, warnings: 2 },
      summary: 'Analysis complete'
    }
  }
}

// Set array output
yield {
  toolName: 'set_output',
  input: {
    output: [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' }
    ]
  }
}
```

**Output Example:**

```typescript
[{
  type: 'json',
  value: {
    success: true,
    output: {
      message: 'Task completed successfully'
    }
  }
}]
```

**Behavior:**
- Updates the agent's output value in context
- Can be called multiple times (last call wins)
- Output is returned in `AgentExecutionResult.output`
- Supports any JSON-serializable value

**Error Scenarios:**
None - always succeeds if input is provided.

**Codebuff Compatibility:**
- ✅ Fully compatible
- Same input/output format
- Same behavior

---

## Missing Tools

The following 18 Codebuff tools are **not yet implemented** in the adapter:

### Browser Tools
1. **browser_action** - Browser automation (click, type, navigate)
2. **browser_step_all** - Execute browser steps until completion

### Computer Control
3. **computer** - Computer control (mouse, keyboard, screenshots)

### Web Tools
4. **fetch** - HTTP requests and web scraping

### Image Tools
5. **vision** - Image analysis and OCR

### Editor Tools
6. **edit_file** - Advanced file editing with patches
7. **open_file** - Open file in editor

### Planning Tools
8. **think** - Agent thinking and planning
9. **new_task** - Create new task/subtask
10. **submit_task** - Submit completed task
11. **update_task** - Update task status

### Memory Tools
12. **remember** - Store information in memory
13. **recall** - Retrieve stored information

### Search Tools
14. **vector_search** - Vector similarity search
15. **web_search** - Web search integration

### File Management
16. **list_directory** - List directory contents (implemented as find_files variant)
17. **create_directory** - Create new directory
18. **delete_file** - Delete file or directory

**Implementation Status:**

These tools are not implemented because:
1. **No Claude CLI equivalent** - Many tools have no direct mapping to Claude CLI tools
2. **Requires external services** - Tools like web_search, vision require API integration
3. **Complex implementations** - Browser/computer control require significant additional work
4. **Lower priority** - The 8 implemented tools cover core file/code/terminal operations

**Workarounds:**

- **list_directory**: Use `find_files` with pattern `*`
- **web_search**: Use `run_terminal_command` with curl/wget
- **fetch**: Use `run_terminal_command` with curl
- **create_directory**: Use `write_file` which auto-creates parent directories
- **think/planning**: Use LLM steps (STEP/STEP_ALL) instead

---

## Error Handling

### Common Error Patterns

All tools follow consistent error handling patterns:

#### 1. Graceful Failures

File operations return error information in the result:

```typescript
// read_files - null for missing files
{
  'existing.txt': 'content',
  'missing.txt': null
}

// write_file - error field
{
  success: false,
  error: 'EACCES: permission denied',
  path: 'readonly.txt'
}
```

#### 2. Path Traversal Protection

All file/terminal tools validate paths:

```typescript
try {
  yield {
    toolName: 'read_files',
    input: { paths: ['../../etc/passwd'] }
  }
} catch (error) {
  // Error: Path traversal detected
}
```

#### 3. Tool Not Found

Attempting to use unimplemented tools:

```typescript
try {
  yield {
    toolName: 'browser_action',
    input: { action: 'click' }
  }
} catch (error) {
  // Error: Unknown tool: browser_action
}
```

#### 4. Timeout Errors

Terminal commands timing out:

```typescript
{
  output: '$ long-running-command\n[ERROR] Command timed out',
  error: true,
  executionTime: 30000
}
```

### Error Recovery Strategies

#### Strategy 1: Retry with Backoff

```typescript
function* retryTool() {
  let attempts = 0
  const maxAttempts = 3

  while (attempts < maxAttempts) {
    try {
      const { toolResult } = yield {
        toolName: 'run_terminal_command',
        input: { command: 'flaky-command' }
      }

      if (!toolResult[0].value.error) {
        break // Success
      }
    } catch (error) {
      attempts++
      if (attempts >= maxAttempts) throw error

      // Wait before retry
      yield { type: 'STEP_TEXT', text: `Retrying (${attempts}/${maxAttempts})...` }
    }
  }
}
```

#### Strategy 2: Fallback to Alternative

```typescript
function* findFilesWithFallback() {
  // Try code_search first
  const { toolResult: searchResult } = yield {
    toolName: 'code_search',
    input: { query: 'export' }
  }

  if (searchResult[0].value.total === 0) {
    // Fallback to find_files
    const { toolResult: findResult } = yield {
      toolName: 'find_files',
      input: { pattern: '**/*.ts' }
    }
  }
}
```

#### Strategy 3: Validate Before Execution

```typescript
function* safeFileWrite() {
  // Check if file exists first
  const { toolResult } = yield {
    toolName: 'read_files',
    input: { paths: ['important.txt'] }
  }

  const exists = toolResult[0].value['important.txt'] !== null

  if (exists) {
    // Make backup first
    const content = toolResult[0].value['important.txt']
    yield {
      toolName: 'write_file',
      input: {
        path: 'important.txt.backup',
        content
      }
    }
  }

  // Now safe to write
  yield {
    toolName: 'write_file',
    input: {
      path: 'important.txt',
      content: 'new content'
    }
  }
}
```

---

## Best Practices

### 1. File Operations

**Read Before Write:**
```typescript
// Good: Read first to check existence
const { toolResult } = yield {
  toolName: 'read_files',
  input: { paths: ['config.json'] }
}

if (toolResult[0].value['config.json']) {
  // File exists, safe to update
  const config = JSON.parse(toolResult[0].value['config.json'])
  config.newField = 'value'

  yield {
    toolName: 'write_file',
    input: {
      path: 'config.json',
      content: JSON.stringify(config, null, 2)
    }
  }
}
```

**Batch File Reads:**
```typescript
// Good: Read all files in one call
yield {
  toolName: 'read_files',
  input: {
    paths: ['a.ts', 'b.ts', 'c.ts']
  }
}

// Avoid: Multiple separate reads
yield { toolName: 'read_files', input: { paths: ['a.ts'] } }
yield { toolName: 'read_files', input: { paths: ['b.ts'] } }
yield { toolName: 'read_files', input: { paths: ['c.ts'] } }
```

### 2. Code Search

**Use Specific Patterns:**
```typescript
// Good: Specific file pattern
yield {
  toolName: 'code_search',
  input: {
    query: 'TODO',
    file_pattern: '*.ts',
    maxResults: 50
  }
}

// Avoid: Searching everything
yield {
  toolName: 'code_search',
  input: { query: 'TODO' }  // Searches all files
}
```

**Limit Results:**
```typescript
// Good: Set reasonable maxResults
yield {
  toolName: 'code_search',
  input: {
    query: 'function',
    maxResults: 100  // Prevent overwhelming output
  }
}
```

### 3. Terminal Commands

**Set Timeouts:**
```typescript
// Good: Appropriate timeout for command
yield {
  toolName: 'run_terminal_command',
  input: {
    command: 'npm install',
    timeout_seconds: 300  // 5 minutes for npm install
  }
}

// Default: 30 seconds (may be too short for installs)
yield {
  toolName: 'run_terminal_command',
  input: { command: 'npm install' }
}
```

**Check Command Availability:**
```typescript
// Good: Verify command exists first
const { toolResult } = yield {
  toolName: 'run_terminal_command',
  input: { command: 'which rg' }
}

if (!toolResult[0].value.error) {
  // ripgrep is available
  yield {
    toolName: 'code_search',
    input: { query: 'pattern' }
  }
}
```

### 4. Agent Spawning

**Provide Context:**
```typescript
// Good: Clear prompts and params
yield {
  toolName: 'spawn_agents',
  input: {
    agents: [
      {
        agent_type: 'file-picker',
        prompt: 'Find all test files in the src directory',
        params: {
          pattern: 'src/**/*.test.ts'
        }
      }
    ]
  }
}

// Avoid: Vague prompts
yield {
  toolName: 'spawn_agents',
  input: {
    agents: [
      { agent_type: 'file-picker' }  // No context
    ]
  }
}
```

**Check Results:**
```typescript
const { toolResult } = yield {
  toolName: 'spawn_agents',
  input: { agents: [...] }
}

for (const result of toolResult[0].value) {
  if (result.value.errorMessage) {
    // Agent failed, handle error
    console.error(`${result.agentName} failed:`, result.value.errorMessage)
  } else {
    // Agent succeeded
    console.log(`${result.agentName} output:`, result.value)
  }
}
```

### 5. Output Management

**Set Output at End:**
```typescript
// Good: Set output after all work is done
function* myAgent() {
  // Do work...
  const results = yield { toolName: 'find_files', input: { pattern: '*.ts' } }

  // Process results...
  const processedData = processResults(results)

  // Set final output
  yield {
    toolName: 'set_output',
    input: { output: processedData }
  }
}

// Avoid: Setting output multiple times
function* badAgent() {
  yield { toolName: 'set_output', input: { output: 'interim' } }
  // More work...
  yield { toolName: 'set_output', input: { output: 'final' } }  // Overwrites
}
```

---

## See Also

- [API_REFERENCE.md](./API_REFERENCE.md) - Complete API documentation
- [README.md](./README.md) - Getting started guide
- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - Claude CLI integration
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical architecture
