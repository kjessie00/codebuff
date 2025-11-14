# Troubleshooting Guide

Comprehensive troubleshooting guide for the Claude Code CLI Adapter in FREE mode.

## Table of Contents

- [Quick Diagnosis](#quick-diagnosis)
- [Error Messages](#error-messages)
- [Common Problems](#common-problems)
- [Platform-Specific Issues](#platform-specific-issues)
- [Getting Help](#getting-help)

## Quick Diagnosis

### Is It Working At All?

Run this quick health check:

```typescript
import { createDebugAdapter } from '@codebuff/adapter'

async function healthCheck() {
  try {
    // Create adapter
    const adapter = createDebugAdapter(process.cwd())
    console.log('✓ Adapter created successfully')

    // Create simple test agent
    const testAgent = {
      id: 'health-check',
      displayName: 'Health Check',
      toolNames: ['find_files', 'set_output'],
      handleSteps: function* () {
        const { toolResult } = yield {
          toolName: 'find_files',
          input: { pattern: '*.json' }
        }

        yield {
          toolName: 'set_output',
          input: { output: toolResult[0].value }
        }
      }
    }

    // Register and execute
    adapter.registerAgent(testAgent)
    console.log('✓ Agent registered successfully')

    const result = await adapter.executeAgent(testAgent, 'Health check')
    console.log('✓ Agent executed successfully')
    console.log('Found files:', result.output)

    console.log('\n✅ Health check PASSED')
    return true
  } catch (error) {
    console.error('❌ Health check FAILED:', error)
    return false
  }
}

healthCheck()
```

If this works, your setup is correct. If not, see the error messages below.

### Common Issues Checklist

Before diving deep, check these common issues:

- [ ] **Adapter Created Correctly?**
  ```typescript
  // Correct
  const adapter = new ClaudeCodeCLIAdapter({ cwd: process.cwd() })

  // Wrong - missing cwd
  const adapter = new ClaudeCodeCLIAdapter({})
  ```

- [ ] **Tools Available in FREE Mode?**
  - ✅ `read_files`, `write_file`, `str_replace`
  - ✅ `find_files`, `code_search`
  - ✅ `run_terminal_command`
  - ✅ `set_output`
  - ❌ `spawn_agents` (requires PAID mode with API key)

- [ ] **File Paths Correct?**
  ```typescript
  // Correct - relative to cwd
  { paths: ['src/index.ts'] }

  // Wrong - absolute path outside cwd
  { paths: ['/etc/passwd'] }
  ```

- [ ] **Permissions OK?**
  ```bash
  # Check file permissions
  ls -la your-file.txt

  # Check directory permissions
  ls -la /path/to/directory
  ```

- [ ] **Dependencies Installed?**
  ```bash
  cd adapter
  bun install  # or npm install
  ```

## Error Messages

### "spawn_agents requires an Anthropic API key"

**Full Error:**
```
Error: spawn_agents tool requires an Anthropic API key in PAID mode.
This tool is not available in FREE mode.
```

**Problem:** You're trying to use multi-agent orchestration (`spawn_agents`) in FREE mode.

**Why It Happens:** The `spawn_agents` tool requires the Anthropic API to execute sub-agents. FREE mode doesn't include API access.

**Solution 1: Upgrade to PAID Mode**
```typescript
// Enable PAID mode with API key
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY // Enable PAID mode
})
```

Get your API key:
1. Sign up at https://console.anthropic.com
2. Navigate to Settings → API Keys
3. Create a new key (starts with `sk-ant-...`)
4. Set environment variable: `export ANTHROPIC_API_KEY="sk-ant-..."`

**Solution 2: Restructure to Avoid spawn_agents**

Instead of spawning sub-agents, use direct tool calls:

```typescript
// Before: Using spawn_agents (requires PAID mode)
handleSteps: function* () {
  const { toolResult } = yield {
    toolName: 'spawn_agents',
    input: {
      agents: [
        { agent_type: 'file-finder', params: { pattern: '*.ts' } },
        { agent_type: 'code-analyzer', params: { files: [...] } }
      ]
    }
  }
}

// After: Direct tool calls (works in FREE mode)
handleSteps: function* () {
  // Step 1: Find files directly
  const { toolResult: findResult } = yield {
    toolName: 'find_files',
    input: { pattern: '*.ts' }
  }

  // Step 2: Analyze code directly
  const { toolResult: searchResult } = yield {
    toolName: 'code_search',
    input: { query: 'TODO', file_pattern: '*.ts' }
  }

  // Step 3: Combine results
  yield {
    toolName: 'set_output',
    input: {
      output: {
        files: findResult[0].value,
        todos: searchResult[0].value
      }
    }
  }
}
```

**Workaround: Sequential Execution Pattern**

If you need agent-like behavior in FREE mode:

```typescript
// Create separate agent functions
async function findFiles(adapter, pattern) {
  const agent = {
    id: 'finder',
    displayName: 'File Finder',
    toolNames: ['find_files', 'set_output'],
    handleSteps: function* () {
      const { toolResult } = yield {
        toolName: 'find_files',
        input: { pattern }
      }
      yield {
        toolName: 'set_output',
        input: { output: toolResult[0].value }
      }
    }
  }

  adapter.registerAgent(agent)
  return await adapter.executeAgent(agent, `Find ${pattern}`)
}

async function analyzeFiles(adapter, files) {
  // Similar pattern
}

// Execute sequentially
const filesResult = await findFiles(adapter, '*.ts')
const analysisResult = await analyzeFiles(adapter, filesResult.output)
```

### "Path traversal detected"

**Full Error:**
```
Error: Path traversal detected: /etc/passwd resolves to /etc/passwd
which is outside working directory /home/user/project
```

**Problem:** Trying to access files outside the adapter's working directory.

**Why It Happens:** Security feature prevents accessing files outside your project directory.

**Solution: Use Relative Paths**

```typescript
// ❌ Wrong: Absolute path outside cwd
yield {
  toolName: 'read_files',
  input: { paths: ['/etc/passwd'] }
}

// ❌ Wrong: Parent directory traversal
yield {
  toolName: 'read_files',
  input: { paths: ['../../../secrets.txt'] }
}

// ✅ Correct: Relative to cwd
yield {
  toolName: 'read_files',
  input: { paths: ['config/settings.json'] }
}

// ✅ Correct: Subdirectories
yield {
  toolName: 'read_files',
  input: { paths: ['src/utils/helpers.ts'] }
}
```

**If You Need to Access Parent Directories:**

Change the adapter's cwd to a higher-level directory:

```typescript
// Instead of cwd: '/home/user/project/subdir'
const adapter = new ClaudeCodeCLIAdapter({
  cwd: '/home/user/project' // Higher level
})

// Now you can access 'subdir' and sibling directories
yield {
  toolName: 'read_files',
  input: { paths: ['subdir/file.txt', 'other-dir/file.txt'] }
}
```

### "Command injection detected"

**Full Error:**
```
Error: Command injection detected: dangerous shell characters found in input
```

**Problem:** Command contains potentially dangerous shell metacharacters.

**Why It Happens:** Security feature prevents shell injection attacks.

**Dangerous Characters:**
- `;` - Command separator
- `|` - Pipe
- `&` - Background/AND operator
- `` ` `` - Command substitution
- `$()` - Command substitution
- `<>` - Redirection

**Solution: Use Safe Commands**

```typescript
// ❌ Wrong: Contains dangerous characters
yield {
  toolName: 'run_terminal_command',
  input: { command: 'ls; rm -rf /' }
}

// ❌ Wrong: Command injection
yield {
  toolName: 'run_terminal_command',
  input: { command: 'cat file.txt | grep secret > output.txt' }
}

// ✅ Correct: Simple, safe command
yield {
  toolName: 'run_terminal_command',
  input: { command: 'npm test' }
}

// ✅ Correct: Command with safe arguments
yield {
  toolName: 'run_terminal_command',
  input: { command: 'git status' }
}
```

**If You Need Complex Commands:**

Use a shell script file:

```typescript
// Create script file
yield {
  toolName: 'write_file',
  input: {
    path: 'scripts/complex-task.sh',
    content: `#!/bin/bash
set -e
ls -la
grep "pattern" file.txt > output.txt
cat output.txt
`
  }
}

// Make it executable and run it
yield {
  toolName: 'run_terminal_command',
  input: { command: 'chmod +x scripts/complex-task.sh' }
}

yield {
  toolName: 'run_terminal_command',
  input: { command: 'bash scripts/complex-task.sh' }
}
```

### "File not found"

**Full Error:**
```
Result: { 'missing.txt': null }
```

**Problem:** File doesn't exist at the specified path.

**Why It Happens:** Typo in filename, wrong directory, or file doesn't exist yet.

**Solution 1: Check File Exists First**

```typescript
handleSteps: function* () {
  // Try to read file
  const { toolResult } = yield {
    toolName: 'read_files',
    input: { paths: ['config.json'] }
  }

  const files = toolResult[0].value

  // Check if file was found
  if (files['config.json'] === null) {
    // File doesn't exist - handle gracefully
    yield {
      toolName: 'write_file',
      input: {
        path: 'config.json',
        content: JSON.stringify({ default: 'settings' })
      }
    }
  } else {
    // File exists - use it
    const config = JSON.parse(files['config.json'])
  }
}
```

**Solution 2: Use find_files to Verify**

```typescript
// First, check if file exists
const { toolResult: findResult } = yield {
  toolName: 'find_files',
  input: { pattern: 'config.json' }
}

const files = findResult[0].value

if (files.length === 0) {
  yield {
    toolName: 'set_output',
    input: { output: 'Error: config.json not found' }
  }
  return
}

// Now read the file
const { toolResult: readResult } = yield {
  toolName: 'read_files',
  input: { paths: ['config.json'] }
}
```

**Solution 3: Check Your Working Directory**

```typescript
// Log current working directory
console.log('Adapter CWD:', adapter.config.cwd)

// List files in current directory
const { toolResult } = yield {
  toolName: 'find_files',
  input: { pattern: '*' }
}
console.log('Files in CWD:', toolResult[0].value)
```

### "Permission denied"

**Full Error:**
```
Error: EACCES: permission denied, open '/path/to/file.txt'
```

**Problem:** No permission to read or write file.

**Why It Happens:** File/directory permissions don't allow the operation.

**Solution 1: Check Permissions**

```bash
# Check file permissions
ls -la file.txt

# Example output:
# -r--r--r--  1 user group  100 Jan 15 10:00 file.txt
#  ^ read-only for everyone

# Check directory permissions
ls -la /path/to/directory
```

**Solution 2: Fix Permissions**

```bash
# Make file readable
chmod 644 file.txt

# Make file writable
chmod 644 file.txt

# Make directory accessible
chmod 755 /path/to/directory
```

**Solution 3: Run with Appropriate User**

```bash
# If file is owned by another user
sudo chown $USER file.txt

# Or run your script with sudo (not recommended)
sudo node your-script.js
```

**Solution 4: Handle Permission Errors in Code**

```typescript
handleSteps: function* () {
  const { toolResult } = yield {
    toolName: 'write_file',
    input: { path: 'output.txt', content: 'data' }
  }

  const result = toolResult[0].value

  if (!result.success) {
    if (result.error?.includes('EACCES')) {
      // Handle permission error
      yield {
        toolName: 'set_output',
        input: {
          output: 'Error: No permission to write file. Please check permissions.'
        }
      }
    } else {
      // Handle other errors
      yield {
        toolName: 'set_output',
        input: { output: `Error: ${result.error}` }
      }
    }
  }
}
```

### "Timeout exceeded"

**Full Error:**
```
{
  output: '$ npm install\n[ERROR] Command timed out',
  error: true,
  timedOut: true,
  exitCode: null
}
```

**Problem:** Command took longer than the timeout limit.

**Why It Happens:** Default timeout (30s) is too short for the operation.

**Solution: Increase Timeout**

```typescript
// Default timeout: 30 seconds
yield {
  toolName: 'run_terminal_command',
  input: { command: 'npm install' }
}

// Increase timeout to 5 minutes
yield {
  toolName: 'run_terminal_command',
  input: {
    command: 'npm install',
    timeout_seconds: 300 // 5 minutes
  }
}

// Very long operation: 30 minutes
yield {
  toolName: 'run_terminal_command',
  input: {
    command: 'npm run build:production',
    timeout_seconds: 1800 // 30 minutes
  }
}
```

**For Very Long Operations:**

Use async process type:

```typescript
yield {
  toolName: 'run_terminal_command',
  input: {
    command: 'npm run dev',
    process_type: 'ASYNC', // Run in background
    timeout_seconds: 3600 // 1 hour
  }
}
```

### "MaxIterationsError: Generator exceeded maximum iterations"

**Full Error:**
```
MaxIterationsError: HandleSteps execution exceeded maximum iterations (100)
```

**Problem:** Agent's handleSteps generator has too many steps or infinite loop.

**Why It Happens:**
- Infinite loop in handleSteps
- Agent complexity exceeds maxSteps limit
- Generator never completes normally

**Solution 1: Increase maxSteps**

```typescript
// Default maxSteps: 20
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  maxSteps: 20
})

// Increase for complex agents
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  maxSteps: 50 // or 100, depending on needs
})
```

**Solution 2: Check for Infinite Loops**

```typescript
// ❌ Wrong: Infinite loop
handleSteps: function* () {
  while (true) { // Never exits!
    yield { toolName: 'find_files', input: { pattern: '*.ts' } }
  }
}

// ✅ Correct: Exit condition
handleSteps: function* () {
  let count = 0
  const maxIterations = 10

  while (count < maxIterations) {
    yield { toolName: 'find_files', input: { pattern: '*.ts' } }
    count++
  }
}

// ✅ Better: Avoid loops in handleSteps
handleSteps: function* () {
  // Single execution path
  const { toolResult } = yield {
    toolName: 'find_files',
    input: { pattern: '*.ts' }
  }

  yield {
    toolName: 'set_output',
    input: { output: toolResult[0].value }
  }
}
```

**Solution 3: Break Down Complex Agents**

```typescript
// Instead of one complex agent with 100 steps
// Create multiple simpler agents

const findFilesAgent = { /* 5 steps */ }
const analyzeFilesAgent = { /* 5 steps */ }
const generateReportAgent = { /* 5 steps */ }

// Execute them sequentially (in FREE mode)
const files = await adapter.executeAgent(findFilesAgent, 'Find')
const analysis = await adapter.executeAgent(analyzeFilesAgent, 'Analyze')
const report = await adapter.executeAgent(generateReportAgent, 'Report')
```

## Common Problems

### Problem: Adapter Not Finding Files

**Symptoms:**
- `find_files` returns empty array
- `read_files` returns all null values
- "File not found" errors for files you know exist

**Cause:**
- Wrong working directory
- Incorrect glob pattern
- Files in .gitignore or hidden

**Solution:**

**Step 1: Verify Working Directory**

```typescript
console.log('Adapter CWD:', adapter.cwd)
console.log('Process CWD:', process.cwd())

// List all files to see what's in the directory
const { toolResult } = yield {
  toolName: 'find_files',
  input: { pattern: '**/*' } // Find everything
}

console.log('All files:', toolResult[0].value)
```

**Step 2: Fix Glob Pattern**

```typescript
// ❌ Wrong: Missing ** for nested directories
pattern: '*.ts' // Only finds files in root

// ✅ Correct: Include subdirectories
pattern: '**/*.ts' // Finds files in all directories

// ❌ Wrong: Too specific
pattern: 'src/utils/helpers/index.ts' // Only one file

// ✅ Correct: Use wildcards
pattern: 'src/**/*.ts' // All TypeScript files in src
```

**Step 3: Check for Hidden Files**

```typescript
// Files starting with . are hidden
// Use explicit pattern to find them

const { toolResult } = yield {
  toolName: 'find_files',
  input: { pattern: '.*' } // Find hidden files
}
```

**Prevention:**

Always log the results of find_files to verify:

```typescript
const { toolResult } = yield {
  toolName: 'find_files',
  input: { pattern: '**/*.ts' }
}

const files = toolResult[0].value
console.log(`Found ${files.length} files:`, files)

if (files.length === 0) {
  console.warn('No files found! Check pattern and cwd.')
}
```

### Problem: Code Search Not Working

**Symptoms:**
- `code_search` returns no results
- "rg: command not found" error
- Empty results array

**Cause:**
- ripgrep (rg) not installed
- Wrong search query
- Files not in searched locations

**Solution:**

**Step 1: Install ripgrep**

```bash
# macOS
brew install ripgrep

# Ubuntu/Debian
sudo apt-get install ripgrep

# Windows (Chocolatey)
choco install ripgrep

# Windows (Scoop)
scoop install ripgrep

# Verify installation
rg --version
# ripgrep 13.0.0
```

**Step 2: Test ripgrep**

```bash
# Test from command line
cd /path/to/your/project
rg "function" --json

# Should output JSON results
```

**Step 3: Fix Search Query**

```typescript
// ❌ Wrong: Too specific
yield {
  toolName: 'code_search',
  input: { query: 'export function handleSteps(param: AgentParams)' }
}

// ✅ Correct: Broader query
yield {
  toolName: 'code_search',
  input: { query: 'handleSteps' }
}

// ✅ Correct: With file pattern
yield {
  toolName: 'code_search',
  input: {
    query: 'TODO',
    file_pattern: '*.ts' // Only search TypeScript files
  }
}

// ✅ Correct: Case-insensitive
yield {
  toolName: 'code_search',
  input: {
    query: 'error',
    case_sensitive: false // Match Error, ERROR, error, etc.
  }
}
```

**Step 4: Limit Results**

```typescript
// Limit results to avoid overwhelming output
yield {
  toolName: 'code_search',
  input: {
    query: 'import',
    maxResults: 50 // Default is 250
  }
}
```

**Prevention:**

Add fallback for missing ripgrep:

```typescript
handleSteps: function* () {
  const { toolResult } = yield {
    toolName: 'code_search',
    input: { query: 'TODO' }
  }

  const result = toolResult[0].value

  if (result.error?.includes('command not found')) {
    yield {
      toolName: 'set_output',
      input: {
        output: 'Error: ripgrep not installed. Please install: brew install ripgrep'
      }
    }
    return
  }

  // Process results
}
```

### Problem: Terminal Commands Failing

**Symptoms:**
- Commands return non-zero exit codes
- "Command not found" errors
- Unexpected output

**Cause:**
- Command not in PATH
- Wrong command syntax
- Missing dependencies
- Environment variables not set

**Solution:**

**Step 1: Verify Command Exists**

```typescript
// Check if command exists
const { toolResult } = yield {
  toolName: 'run_terminal_command',
  input: { command: 'which npm' } // or 'where npm' on Windows
}

console.log('npm location:', toolResult[0].value.stdout)

if (toolResult[0].value.exitCode !== 0) {
  console.error('npm not found in PATH')
}
```

**Step 2: Use Full Path**

```typescript
// Instead of relying on PATH
yield {
  toolName: 'run_terminal_command',
  input: { command: '/usr/local/bin/npm install' }
}
```

**Step 3: Set Environment Variables**

```typescript
yield {
  toolName: 'run_terminal_command',
  input: {
    command: 'npm run build',
    env: {
      NODE_ENV: 'production',
      PATH: process.env.PATH // Inherit PATH
    }
  }
}
```

**Step 4: Check Exit Code**

```typescript
const { toolResult } = yield {
  toolName: 'run_terminal_command',
  input: { command: 'npm test' }
}

const result = toolResult[0].value

if (result.exitCode !== 0) {
  console.error('Command failed!')
  console.error('Exit code:', result.exitCode)
  console.error('stderr:', result.stderr)

  yield {
    toolName: 'set_output',
    input: {
      output: {
        error: true,
        message: 'Tests failed',
        details: result.stderr
      }
    }
  }
  return
}

// Command succeeded
console.log('stdout:', result.stdout)
```

**Debugging Steps:**

```bash
# 1. Test command in terminal first
npm test

# 2. Check working directory
pwd

# 3. Check environment
env | grep NODE

# 4. Check permissions
ls -la node_modules/.bin/

# 5. Test with absolute path
/full/path/to/node_modules/.bin/jest
```

### Problem: Agent Not Producing Output

**Symptoms:**
- `result.output` is undefined
- Agent completes but no output
- Empty result object

**Cause:**
- Forgot to call `set_output`
- `set_output` called with wrong parameters
- Agent never reaches `set_output`

**Solution:**

**Always Call set_output:**

```typescript
// ❌ Wrong: No set_output
handleSteps: function* () {
  const { toolResult } = yield {
    toolName: 'find_files',
    input: { pattern: '*.ts' }
  }

  // Missing set_output - no output!
}

// ✅ Correct: Always set output
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
```

**Set Output Early in Conditional Paths:**

```typescript
handleSteps: function* () {
  const { toolResult } = yield {
    toolName: 'read_files',
    input: { paths: ['config.json'] }
  }

  if (toolResult[0].value['config.json'] === null) {
    // Set output in error path
    yield {
      toolName: 'set_output',
      input: { output: 'Error: config.json not found' }
    }
    return
  }

  // Set output in success path
  yield {
    toolName: 'set_output',
    input: { output: JSON.parse(toolResult[0].value['config.json']) }
  }
}
```

**Check Output Value:**

```typescript
// Log output for debugging
const result = await adapter.executeAgent(myAgent, 'Test')
console.log('Agent output:', result.output)
console.log('Message history:', result.messageHistory)
console.log('Metadata:', result.metadata)
```

### Problem: Slow Performance

**Symptoms:**
- Agent execution takes longer than expected
- Commands time out
- High CPU usage

**Cause:**
- Reading too many files sequentially
- Inefficient file searches
- Large file operations
- Unoptimized commands

**Solution:**

**Step 1: Use Parallel File Reads**

```typescript
// ✅ Good: Parallel reads (automatic in adapter)
const { toolResult } = yield {
  toolName: 'read_files',
  input: { paths: ['file1.ts', 'file2.ts', 'file3.ts'] }
}
// All files read in parallel

// ❌ Bad: Sequential reads
for (const file of files) {
  const { toolResult } = yield {
    toolName: 'read_files',
    input: { paths: [file] }
  }
}
```

**Step 2: Limit Search Results**

```typescript
// Limit results for faster searches
yield {
  toolName: 'code_search',
  input: {
    query: 'import',
    maxResults: 50, // Limit to 50 results
    file_pattern: '*.ts' // Only search TypeScript files
  }
}
```

**Step 3: Use Specific Patterns**

```typescript
// ❌ Slow: Search everything
pattern: '**/*'

// ✅ Fast: Be specific
pattern: 'src/**/*.ts' // Only src directory, only TypeScript
```

**Step 4: Profile Your Agent**

```typescript
handleSteps: function* () {
  const start = Date.now()

  // Operation 1
  const start1 = Date.now()
  const { toolResult: result1 } = yield { /* ... */ }
  console.log('Operation 1:', Date.now() - start1, 'ms')

  // Operation 2
  const start2 = Date.now()
  const { toolResult: result2 } = yield { /* ... */ }
  console.log('Operation 2:', Date.now() - start2, 'ms')

  console.log('Total time:', Date.now() - start, 'ms')
}
```

**Step 5: Cache Results**

```typescript
// Cache file reads in agent state
handleSteps: function* ({ agentState }) {
  // Check cache first
  if (agentState.fileCache) {
    yield {
      toolName: 'set_output',
      input: { output: agentState.fileCache }
    }
    return
  }

  // Read files
  const { toolResult } = yield {
    toolName: 'read_files',
    input: { paths: ['large-file.json'] }
  }

  // Cache for next time
  agentState.fileCache = toolResult[0].value

  yield {
    toolName: 'set_output',
    input: { output: agentState.fileCache }
  }
}
```

## Platform-Specific Issues

### Windows Issues

#### Issue: Path Separators

**Problem:** Windows uses backslashes `\`, Unix uses forward slashes `/`

**Solution:** Use Node.js path module

```typescript
import path from 'path'

// ❌ Wrong: Hardcoded separators
const filePath = 'src\\utils\\helpers.ts'

// ✅ Correct: Use path.join
const filePath = path.join('src', 'utils', 'helpers.ts')
// Automatically uses correct separator for platform
```

#### Issue: Command Not Found (Windows)

**Problem:** Commands like `rg` not in PATH

**Solution:** Add to PATH or use full path

```powershell
# Add to PATH (PowerShell)
$env:Path += ";C:\Program Files\ripgrep"

# Or use full path in command
"C:\Program Files\ripgrep\rg.exe" --version
```

#### Issue: Line Endings (CRLF vs LF)

**Problem:** Windows uses `\r\n`, Unix uses `\n`

**Solution:** Configure Git to handle line endings

```bash
# Configure Git
git config --global core.autocrlf true

# Or normalize in code
const normalized = content.replace(/\r\n/g, '\n')
```

### macOS Issues

#### Issue: ripgrep Not Installed

**Problem:** `rg: command not found`

**Solution:** Install via Homebrew

```bash
# Install Homebrew if needed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install ripgrep
brew install ripgrep

# Verify
rg --version
```

#### Issue: Permission Denied on System Files

**Problem:** Can't read files in protected directories

**Solution:** Don't try to access system files

```typescript
// ❌ Wrong: System directories
yield {
  toolName: 'read_files',
  input: { paths: ['/System/Library/...'] }
}

// ✅ Correct: User directories only
yield {
  toolName: 'read_files',
  input: { paths: ['~/Projects/myapp/config.json'] }
}
```

### Linux Issues

#### Issue: ripgrep Not Installed

**Problem:** `rg: command not found`

**Solution:** Install via package manager

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install ripgrep

# Fedora
sudo dnf install ripgrep

# Arch
sudo pacman -S ripgrep

# Verify
rg --version
```

#### Issue: File System Case Sensitivity

**Problem:** Linux is case-sensitive, others might not be

**Solution:** Always use exact case

```typescript
// ❌ Might fail on Linux
yield {
  toolName: 'read_files',
  input: { paths: ['Config.json'] } // Capital C
}

// ✅ Use exact filename
yield {
  toolName: 'read_files',
  input: { paths: ['config.json'] } // Lowercase c
}
```

## Getting Help

### Before Asking for Help

1. **Check This Troubleshooting Guide**
   - Use Ctrl+F / Cmd+F to search for your error message
   - Read the relevant section carefully
   - Try all suggested solutions

2. **Search Existing Issues**
   - Check GitHub Issues: https://github.com/your-repo/issues
   - Search for your error message
   - Look for closed issues (might have solution)

3. **Try Minimal Reproduction**
   - Create simplest possible test case
   - Remove unnecessary code
   - Isolate the problem

4. **Gather Debug Information**
   ```typescript
   // Enable debug mode
   const adapter = createDebugAdapter(process.cwd())

   // Run your agent and capture output
   const result = await adapter.executeAgent(myAgent, 'Test')

   // Save debug output
   console.log('Debug info:', {
     output: result.output,
     metadata: result.metadata,
     messageHistory: result.messageHistory
   })
   ```

### How to Ask for Help

Use this template for bug reports:

```markdown
## Bug Report

**Environment:**
- OS: [e.g., macOS 13.0, Ubuntu 22.04, Windows 11]
- Node.js version: [e.g., 18.17.0]
- Adapter version: [e.g., 1.0.0]
- FREE or PAID mode: [e.g., FREE]

**What I'm trying to do:**
[Brief description of your goal]

**What's happening:**
[Describe the problem]

**Error message:**
```
[Paste full error message]
```

**Code:**
```typescript
[Paste minimal code that reproduces the issue]
```

**What I've tried:**
- [List solutions you've attempted]
- [Any relevant findings]

**Debug output:**
```
[Paste debug output if relevant]
```
```

### Debug Information to Gather

```bash
# System information
uname -a
node --version
npm --version

# Check ripgrep
which rg
rg --version

# Check adapter installation
cd adapter
npm list

# Run with debug
DEBUG=* node your-script.js
```

### Where to Get Help

1. **Documentation**
   - [README.md](../README.md) - Overview and quick start
   - [TOOL_REFERENCE.md](./TOOL_REFERENCE.md) - Tool documentation
   - [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Testing guide
   - [FAQ_FREE_MODE.md](./FAQ_FREE_MODE.md) - Frequently asked questions
   - [DEBUG_GUIDE.md](./DEBUG_GUIDE.md) - Debugging guide

2. **GitHub Issues**
   - Report bugs: https://github.com/your-repo/issues/new
   - Feature requests: https://github.com/your-repo/issues/new
   - Search existing issues

3. **Examples**
   - [examples/](../examples/) - Working code examples
   - Check tests in [src/tools/*.test.ts](../src/tools/)

---

## Quick Reference

### Most Common Solutions

1. **Path outside working directory** → Use relative paths
2. **Command not found** → Install ripgrep: `brew install ripgrep`
3. **spawn_agents not working** → Requires PAID mode with API key
4. **No output from agent** → Add `set_output` tool call
5. **Timeout** → Increase `timeout_seconds` parameter
6. **Permission denied** → Check file/directory permissions
7. **Slow performance** → Use parallel operations, limit results

### Key Commands

```bash
# Health check
npm test

# Debug mode
DEBUG=* node your-script.js

# Install ripgrep
brew install ripgrep  # macOS
sudo apt-get install ripgrep  # Ubuntu

# Check versions
node --version
npm --version
rg --version
```

### Still Stuck?

If you've tried everything in this guide and still have issues:

1. Create minimal reproduction
2. Enable debug mode
3. Gather all debug information
4. Open GitHub issue with template above

We're here to help!
