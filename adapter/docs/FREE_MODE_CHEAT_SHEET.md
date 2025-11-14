# 📋 FREE Mode Cheat Sheet

One-page quick reference for FREE mode. Print this out or keep it handy!

---

## 🚀 Quick Start

### Installation
```bash
cd adapter
npm install && npm run build
```

### Create Adapter
```typescript
import { ClaudeCodeCLIAdapter } from './adapter/src/claude-cli-adapter'

const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  debug: true  // Optional: show logs
})
```

### Basic Agent Structure
```typescript
const agent: AgentDefinition = {
  id: 'my-agent',
  displayName: 'My Agent',
  toolNames: ['read_files', 'write_file'],

  handleSteps: function* () {
    // Your logic here
    const { toolResult } = yield {
      toolName: 'read_files',
      input: { paths: ['file.txt'] }
    }

    yield {
      toolName: 'set_output',
      input: { output: toolResult[0].value }
    }
  }
}

adapter.registerAgent(agent)
const result = await adapter.executeAgent(agent, 'Prompt')
```

---

## 🛠️ Available Tools (FREE Mode)

| Tool | What It Does | Input | Output |
|------|-------------|-------|--------|
| ✅ `read_files` | Read file contents | `{ paths: string[] }` | `{ [path]: content }` |
| ✅ `write_file` | Create/update file | `{ path, content }` | `{ success, path, error? }` |
| ✅ `str_replace` | Find & replace | `{ path, old_string, new_string }` | `{ success, error? }` |
| ✅ `code_search` | Search code | `{ pattern, filePattern?, maxResults? }` | `{ matches[], total }` |
| ✅ `find_files` | Find files | `{ pattern }` | `{ files[], total }` |
| ✅ `run_terminal_command` | Run shell command | `{ command, timeout_seconds? }` | `{ output, error }` |
| ✅ `set_output` | Set agent output | `{ output }` | - |
| ❌ `spawn_agents` | Multi-agent | - | **Requires PAID mode** |

---

## 📝 Common Patterns

### Read Files
```typescript
const { toolResult } = yield {
  toolName: 'read_files',
  input: { paths: ['package.json', 'tsconfig.json'] }
}
const content = toolResult[0].value['package.json']
```

### Write File
```typescript
yield {
  toolName: 'write_file',
  input: {
    path: 'output.txt',
    content: 'Hello, world!'
  }
}
```

### Replace String
```typescript
yield {
  toolName: 'str_replace',
  input: {
    path: 'src/config.ts',
    old_string: 'DEBUG = true',
    new_string: 'DEBUG = false'
  }
}
```

### Search Code
```typescript
const { toolResult } = yield {
  toolName: 'code_search',
  input: {
    pattern: 'TODO',
    filePattern: '*.{ts,js}',
    maxResults: 100
  }
}
const matches = toolResult[0].value.matches
```

### Find Files
```typescript
const { toolResult } = yield {
  toolName: 'find_files',
  input: { pattern: '**/*.test.ts' }
}
const files = toolResult[0].value.files
```

### Run Command
```typescript
const { toolResult } = yield {
  toolName: 'run_terminal_command',
  input: {
    command: 'npm test',
    timeout_seconds: 120
  }
}
const output = toolResult[0].value.output
```

### Set Output
```typescript
yield {
  toolName: 'set_output',
  input: {
    output: { result: 'success', data: [...] }
  }
}
```

---

## 🎯 File Patterns

### Glob Patterns for `find_files`
```
**/*.ts          All TypeScript files
**/*.{ts,js}     All TS and JS files
src/**/*.ts      TS files in src/
**/*.test.ts     All test files
*.json           JSON files in root
packages/*/src   Src in all packages
```

### File Patterns for `code_search`
```
*.ts             TypeScript files
*.{ts,tsx}       TypeScript & TSX
src/**/*.ts      TS files in src/
**/*.test.ts     Test files
*.json           JSON files
```

### Regex Patterns for `code_search`
```
TODO             Literal text
console\.log     Escaped special chars
\bexport\b       Word boundaries
import.*from     Any characters
^import          Start of line
TODO:.*$         To end of line
```

---

## ⚙️ Configuration Options

### Adapter Config
```typescript
new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),          // Working directory
  debug: true,                 // Enable debug logs
  maxSteps: 50,                // Max generator iterations (default: 20)
  anthropicApiKey: undefined,  // Leave undefined for FREE mode
})
```

### Agent Definition
```typescript
const agent: AgentDefinition = {
  id: 'unique-id',              // Required: unique identifier
  displayName: 'Display Name',  // Optional: human-readable name
  systemPrompt: 'You are...',   // Optional: system prompt
  toolNames: ['read_files'],    // Required: available tools
  outputMode: 'last_message',   // Optional: output mode

  handleSteps: function* ({ agentState, prompt, params, logger }) {
    // Generator function
  }
}
```

---

## 🚨 Error Handling

### Check File Exists
```typescript
const { toolResult } = yield {
  toolName: 'read_files',
  input: { paths: ['file.txt'] }
}

if (toolResult[0].value['file.txt'] === null) {
  // File doesn't exist
}
```

### Check Write Success
```typescript
const { toolResult } = yield {
  toolName: 'write_file',
  input: { path: 'out.txt', content: 'data' }
}

if (!toolResult[0].value.success) {
  console.error('Write failed:', toolResult[0].value.error)
}
```

### Check Command Success
```typescript
const { toolResult } = yield {
  toolName: 'run_terminal_command',
  input: { command: 'npm test' }
}

if (toolResult[0].value.error) {
  console.error('Command failed:', toolResult[0].value.output)
}
```

### Try-Catch
```typescript
handleSteps: function* () {
  try {
    const { toolResult } = yield { ... }
    // Process result
  } catch (error) {
    yield {
      toolName: 'set_output',
      input: { output: { error: error.message } }
    }
  }
}
```

---

## 💡 Best Practices

### ✅ DO:
- Read multiple files at once
- Set appropriate timeouts
- Check tool results for errors
- Use debug mode during development
- Provide clear error messages
- Set `maxResults` on searches
- Use relative paths

### ❌ DON'T:
- Loop through files individually
- Use absolute paths outside cwd
- Forget to check for errors
- Set timeout too low
- Search without limiting results
- Commit API keys to git
- Use spawn_agents in FREE mode

---

## 📊 Performance Tips

### Fast
```typescript
// Read many files at once
yield {
  toolName: 'read_files',
  input: { paths: allFiles }  // One call
}
```

### Slow
```typescript
// Read files one by one
for (const file of allFiles) {
  yield { toolName: 'read_files', input: { paths: [file] } }
}
```

### Limit Results
```typescript
yield {
  toolName: 'code_search',
  input: {
    pattern: 'TODO',
    maxResults: 100  // Limit results
  }
}
```

### Appropriate Timeouts
```typescript
// Quick commands
{ command: 'git status', timeout_seconds: 30 }

// Slow commands
{ command: 'npm install', timeout_seconds: 300 }
```

---

## 🐛 Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Path traversal detected" | File outside cwd | Use relative paths |
| "Tool not found: spawn_agents" | Used in FREE mode | Remove or upgrade to PAID |
| "Generator exceeded max iterations" | Too many steps | Increase `maxSteps` |
| "File not found" | Wrong path | Check file exists |
| "Command timed out" | Timeout too short | Increase `timeout_seconds` |
| "Agent not found in registry" | Not registered | Call `registerAgent()` |
| "Module not found" | Not built | Run `npm run build` |

---

## 🔍 Debugging

### Enable Debug Logs
```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  debug: true  // 👈 Shows detailed logs
})
```

### Use Logger
```typescript
handleSteps: function* ({ logger }) {
  logger.info('Starting execution')
  const { toolResult } = yield { ... }
  logger.info('Got result:', toolResult)
}
```

### Check Context
```typescript
handleSteps: function* ({ agentState, prompt, params }) {
  console.log('Prompt:', prompt)
  console.log('Params:', params)
  console.log('State:', agentState)
}
```

---

## 📚 Quick Links

- **[5-Minute Quickstart](../FREE_MODE_QUICKSTART.md)** - Get started fast
- **[Cookbook (15+ Recipes)](../FREE_MODE_COOKBOOK.md)** - Copy-paste examples
- **[Visual Guide](./FREE_MODE_VISUAL_GUIDE.md)** - Architecture diagrams
- **[FREE vs PAID](./FREE_VS_PAID.md)** - Comparison guide
- **[Full API Reference](../API_REFERENCE.md)** - Complete docs
- **[Main README](../README.md)** - Overview & FAQ

---

## 💰 Cost Breakdown

```
┌─────────────────────────────────────────────┐
│              FREE MODE COSTS                │
├─────────────────────────────────────────────┤
│ Installation:           $0.00               │
│ File operations:        $0.00               │
│ Code search:            $0.00               │
│ Terminal commands:      $0.00               │
│ Single agents:          $0.00               │
│                                             │
│ TOTAL:                  $0.00               │
│                                             │
│ Multi-agent (PAID):     ~$3-15 per 1M tokens│
└─────────────────────────────────────────────┘
```

---

## 🎓 Example Workflow

```typescript
// 1. Create adapter
const adapter = new ClaudeCodeCLIAdapter({ cwd: process.cwd() })

// 2. Define agent
const todoFinderAgent: AgentDefinition = {
  id: 'todo-finder',
  toolNames: ['code_search', 'write_file', 'set_output'],

  handleSteps: function* () {
    // Search for TODOs
    const { toolResult } = yield {
      toolName: 'code_search',
      input: { pattern: 'TODO', filePattern: '*.ts' }
    }

    // Create report
    const matches = toolResult[0].value.matches
    const report = `# TODOs\nFound ${matches.length} TODOs\n\n` +
      matches.map(m => `- ${m.file}:${m.line}`).join('\n')

    // Write report
    yield {
      toolName: 'write_file',
      input: { path: 'TODO_REPORT.md', content: report }
    }

    // Set output
    yield {
      toolName: 'set_output',
      input: { output: { total: matches.length } }
    }
  }
}

// 3. Register & execute
adapter.registerAgent(todoFinderAgent)
const result = await adapter.executeAgent(todoFinderAgent, 'Find TODOs')
console.log('Found', result.output.total, 'TODOs')
```

---

## ⚡ One-Liners

### Read package.json
```typescript
const { toolResult } = yield { toolName: 'read_files', input: { paths: ['package.json'] } }
```

### Find all tests
```typescript
const { toolResult } = yield { toolName: 'find_files', input: { pattern: '**/*.test.ts' } }
```

### Run npm install
```typescript
yield { toolName: 'run_terminal_command', input: { command: 'npm install', timeout_seconds: 300 } }
```

### Search for TODOs
```typescript
const { toolResult } = yield { toolName: 'code_search', input: { pattern: 'TODO', filePattern: '*.ts' } }
```

### Create file
```typescript
yield { toolName: 'write_file', input: { path: 'out.txt', content: 'Hello!' } }
```

---

## 🎯 Decision Tree

```
Need to work with files?
  ├─ Read files → read_files
  ├─ Create/update → write_file
  └─ Find & replace → str_replace

Need to search code?
  ├─ Find by name → find_files
  └─ Find by content → code_search

Need to run commands?
  └─ Any shell command → run_terminal_command

Need multiple agents?
  ├─ FREE mode → ❌ Not available
  └─ PAID mode → ✅ Use spawn_agents

Want to set result?
  └─ Always → set_output
```

---

## 🔑 Key Takeaways

1. **FREE mode = $0.00** - No API key, no cost
2. **7 tools available** - Covers 95% of use cases
3. **100% local** - All processing on your machine
4. **Simple patterns** - yield tool calls in generators
5. **Fast execution** - No network overhead
6. **Safe by default** - Path traversal protection
7. **Easy debugging** - Enable debug mode
8. **Upgrade when needed** - PAID mode for multi-agent

---

**Print this page and keep it handy! 📄**

For more details, see the [full documentation](../README.md).
