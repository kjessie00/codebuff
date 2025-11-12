# Adapter Tools

This directory contains tool implementations that map Codebuff's agent tools to Claude Code CLI functionality.

## Code Search Tools

The `code-search.ts` module provides code searching and file finding capabilities.

### CodeSearchTools Class

Implements two main methods that map to Claude CLI tools:

#### 1. codeSearch(input: CodeSearchInput)

Search for code patterns using ripgrep (rg).

**Maps to:** Claude CLI Grep tool

**Parameters:**
- `query` (string): The pattern to search for (supports regex)
- `file_pattern` (string, optional): Limit search to specific file patterns (e.g., "*.ts")
- `case_sensitive` (boolean, optional): Whether search is case-sensitive (default: false)
- `cwd` (string, optional): Working directory to search within
- `maxResults` (number, optional): Maximum number of results to return (default: 250)

**Example:**
```typescript
const tools = createCodeSearchTools('/path/to/project')

const result = await tools.codeSearch({
  query: 'function.*handleSteps',
  file_pattern: '*.ts',
  case_sensitive: false
})
```

#### 2. findFiles(input: FindFilesInput)

Find files matching a glob pattern.

**Maps to:** Claude CLI Glob tool

**Parameters:**
- `pattern` (string): Glob pattern to match files
- `cwd` (string, optional): Working directory to search within

**Example:**
```typescript
const result = await tools.findFiles({
  pattern: '**/*.test.ts',
  cwd: 'packages/core'
})
```

### Features

- Fast searching using ripgrep (rg)
- Regex pattern matching support
- Glob patterns for file finding
- Graceful error handling
- Path safety with relative paths
- Sorted results by modification time
- Smart filtering of common directories

### Requirements

- ripgrep must be installed for codeSearch
- Node.js version 18.0.0 or higher
- glob package dependency

### Testing

Run the example to verify:

```bash
cd adapter
npx ts-node examples/code-search-example.ts
```

## Related Documentation

- [CLAUDE_CLI_ADAPTER_GUIDE.md](../../../CLAUDE_CLI_ADAPTER_GUIDE.md)
- [adapter/package.json](../../package.json)
