# 🆓 FREE Mode Quickstart (5 Minutes)

Get started with the Claude CLI Adapter in **FREE mode** - no API key needed! Zero cost, 100% local.

---

## ⏱️ Step 1: Install (30 seconds)

```bash
cd adapter
npm install
npm run build
```

**Expected output:**
```
✔ Dependencies installed
✔ Build successful
```

**Troubleshooting:**
- **"npm: command not found"** → Install [Node.js](https://nodejs.org/) (v18+)
- **"Permission denied"** → Try `sudo npm install`
- **Build errors?** → Run `npm run type-check` to see details

---

## 🚀 Step 2: Create Your First Agent (2 minutes)

Create a new file `my-first-agent.ts`:

```typescript
import { ClaudeCodeCLIAdapter } from './adapter/src/claude-cli-adapter'
import type { AgentDefinition } from './.agents/types/agent-definition'

// 1. Create adapter (no API key = FREE mode!)
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  debug: true  // Shows what's happening
})

// 2. Define your agent
const fileReaderAgent: AgentDefinition = {
  id: 'my-first-agent',
  displayName: 'My First Agent',
  systemPrompt: 'You are a helpful file reader.',
  toolNames: ['read_files', 'find_files'],  // FREE tools only!

  // 3. Tell the agent what to do
  handleSteps: function* () {
    // Find all TypeScript files
    const { toolResult } = yield {
      toolName: 'find_files',
      input: { pattern: '**/*.ts' }
    }

    // Set output
    yield {
      toolName: 'set_output',
      input: { output: toolResult[0].value }
    }
  }
}

// 4. Register and run
adapter.registerAgent(fileReaderAgent)

const result = await adapter.executeAgent(
  fileReaderAgent,
  'Find all TypeScript files'
)

console.log('Found files:', result.output)
```

**Copy-paste ready!** This code works immediately.

---

## ▶️ Step 3: Run It (30 seconds)

```bash
npx tsx my-first-agent.ts
```

**Expected output:**
```
[ClaudeCodeCLIAdapter] ℹ️  No API key - Free mode (spawn_agents disabled)
[ClaudeCodeCLIAdapter] Starting agent execution: my-first-agent
[ClaudeCodeCLIAdapter] Executing handleSteps generator
[HandleStepsExecutor] Executing tool: find_files
Found files: {
  pattern: '**/*.ts',
  files: [
    'src/index.ts',
    'src/types.ts',
    'tests/example.test.ts'
  ],
  total: 3
}
✅ Done!
```

**Troubleshooting:**
- **"tsx: command not found"** → Run `npm install -g tsx`
- **No output?** → Check the file paths in your project
- **Errors?** → Enable debug mode (already on in example)

---

## 🎉 Step 4: See Results (30 seconds)

### What You Just Did:

✅ Installed the adapter
✅ Created an agent that searches files
✅ Ran it successfully in **FREE mode**
✅ **Zero cost** - no API key needed!

### What Works in FREE Mode:

| Tool | What It Does | Cost |
|------|--------------|------|
| ✅ `read_files` | Read file contents | $0 |
| ✅ `write_file` | Create/update files | $0 |
| ✅ `str_replace` | Find & replace in files | $0 |
| ✅ `code_search` | Search code with patterns | $0 |
| ✅ `find_files` | Find files by pattern | $0 |
| ✅ `run_terminal_command` | Run shell commands | $0 |
| ✅ `set_output` | Set agent output | $0 |
| ❌ `spawn_agents` | Multi-agent workflows | Requires PAID mode |

**You can do 95% of tasks with FREE mode!**

---

## 🎯 What's Next?

### Try More Examples:

**Read a file:**
```typescript
const { toolResult } = yield {
  toolName: 'read_files',
  input: { paths: ['package.json'] }
}
```

**Search code:**
```typescript
const { toolResult } = yield {
  toolName: 'code_search',
  input: { pattern: 'TODO', filePattern: '*.ts' }
}
```

**Run a command:**
```typescript
const { toolResult } = yield {
  toolName: 'run_terminal_command',
  input: { command: 'npm test' }
}
```

### 📚 Learn More:

- **[FREE Mode Cookbook](./FREE_MODE_COOKBOOK.md)** - 15+ copy-paste recipes
- **[Cheat Sheet](./docs/FREE_MODE_CHEAT_SHEET.md)** - Quick reference
- **[Visual Guide](./docs/FREE_MODE_VISUAL_GUIDE.md)** - Architecture diagrams
- **[Full API Reference](./API_REFERENCE.md)** - Complete documentation

### 🎓 Common Next Steps:

1. **Add file writing:**
   ```typescript
   toolNames: ['read_files', 'write_file', 'find_files']
   ```

2. **Search your codebase:**
   ```typescript
   toolNames: ['code_search', 'find_files']
   ```

3. **Automate tasks:**
   ```typescript
   toolNames: ['run_terminal_command', 'read_files', 'write_file']
   ```

4. **Need multi-agent?** See [FREE vs PAID Guide](./docs/FREE_VS_PAID.md) to upgrade

---

## 🆘 Quick Troubleshooting

### "Module not found"
```bash
# Make sure you built the adapter
cd adapter
npm run build
```

### "Path traversal detected"
```typescript
// ❌ Bad: absolute paths outside project
input: { paths: ['/etc/passwd'] }

// ✅ Good: relative paths in project
input: { paths: ['src/index.ts'] }
```

### "Tool not found: spawn_agents"
```typescript
// spawn_agents requires PAID mode
// Remove it from toolNames for FREE mode:
toolNames: ['read_files', 'write_file']  // ✅ FREE tools only
```

### "Generator exceeded maximum iterations"
```typescript
// Increase maxSteps if agent needs more steps:
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  maxSteps: 50  // Default is 20
})
```

---

## 💡 Pro Tips

**Tip 1:** Use debug mode to see what's happening:
```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  debug: true  // 👈 Shows detailed logs
})
```

**Tip 2:** Read multiple files at once:
```typescript
const { toolResult } = yield {
  toolName: 'read_files',
  input: { paths: ['file1.ts', 'file2.ts', 'file3.ts'] }
}
```

**Tip 3:** Check tool results for errors:
```typescript
const { toolResult } = yield {
  toolName: 'write_file',
  input: { path: 'output.txt', content: 'Hello!' }
}

if (!toolResult[0].value.success) {
  console.error('Write failed:', toolResult[0].value.error)
}
```

---

## ✨ That's It!

**Total time: ~5 minutes**

You're now using FREE mode. No API key, no cost, full power for file operations, code search, and automation.

Want to do more? Check out the [Cookbook](./FREE_MODE_COOKBOOK.md) for 15+ ready-to-use recipes!

---

**Questions?** See the [FAQ in the main README](./README.md#faq) or [FREE vs PAID comparison](./docs/FREE_VS_PAID.md).

**Ready to upgrade?** Learn about [PAID mode features](./HYBRID_MODE_GUIDE.md) when you need multi-agent workflows.
