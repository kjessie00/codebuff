# 🍳 FREE Mode Cookbook

Quick recipes for common tasks. Each recipe is **copy-paste ready** and works immediately in FREE mode.

---

## 📖 Table of Contents

### File Operations
- [Recipe 1: Read a Single File](#recipe-1-read-a-single-file)
- [Recipe 2: Read Multiple Files](#recipe-2-read-multiple-files)
- [Recipe 3: Create a New File](#recipe-3-create-a-new-file)
- [Recipe 4: Edit an Existing File](#recipe-4-edit-an-existing-file)
- [Recipe 5: Replace Multiple Occurrences](#recipe-5-replace-multiple-occurrences)

### Code Search
- [Recipe 6: Find All TODOs](#recipe-6-find-all-todos)
- [Recipe 7: Search for a Pattern](#recipe-7-search-for-a-pattern)
- [Recipe 8: Find Files by Name](#recipe-8-find-files-by-name)
- [Recipe 9: Search in Specific Files](#recipe-9-search-in-specific-files)

### Terminal Commands
- [Recipe 10: Run npm install](#recipe-10-run-npm-install)
- [Recipe 11: Run Tests](#recipe-11-run-tests)
- [Recipe 12: Check Git Status](#recipe-12-check-git-status)
- [Recipe 13: Run Build Command](#recipe-13-run-build-command)

### Advanced Patterns
- [Recipe 14: Multi-Step Workflow](#recipe-14-multi-step-workflow)
- [Recipe 15: Conditional Logic](#recipe-15-conditional-logic)
- [Recipe 16: Error Handling](#recipe-16-error-handling)
- [Recipe 17: Progress Reporting](#recipe-17-progress-reporting)
- [Recipe 18: Extract Specific Data](#recipe-18-extract-specific-data)

---

## File Operations

### Recipe 1: Read a Single File

**Problem:** I need to read the contents of `package.json`

**Solution:**
```typescript
import { ClaudeCodeCLIAdapter } from './adapter/src/claude-cli-adapter'
import type { AgentDefinition } from './.agents/types/agent-definition'

const adapter = new ClaudeCodeCLIAdapter({ cwd: process.cwd() })

const readFileAgent: AgentDefinition = {
  id: 'read-file',
  displayName: 'Read File',
  toolNames: ['read_files', 'set_output'],

  handleSteps: function* () {
    // Read package.json
    const { toolResult } = yield {
      toolName: 'read_files',
      input: { paths: ['package.json'] }
    }

    // Extract content
    const content = toolResult[0].value['package.json']

    // Set output
    yield {
      toolName: 'set_output',
      input: { output: content }
    }
  }
}

adapter.registerAgent(readFileAgent)
const result = await adapter.executeAgent(readFileAgent, 'Read package.json')
console.log(result.output)
```

**Expected Output:**
```json
{
  "name": "@codebuff/adapter",
  "version": "1.0.0",
  ...
}
```

**Variations:**
- Read any file: Change `'package.json'` to your file path
- Multiple files: See Recipe 2

**Related Recipes:** [#2](#recipe-2-read-multiple-files), [#18](#recipe-18-extract-specific-data)

---

### Recipe 2: Read Multiple Files

**Problem:** I need to read all `.env` files

**Solution:**
```typescript
const readMultipleAgent: AgentDefinition = {
  id: 'read-multiple',
  displayName: 'Read Multiple Files',
  toolNames: ['read_files', 'set_output'],

  handleSteps: function* () {
    // Read multiple files at once
    const { toolResult } = yield {
      toolName: 'read_files',
      input: {
        paths: ['.env', '.env.local', '.env.development']
      }
    }

    // Get all file contents
    const files = toolResult[0].value

    // Check which files exist
    const existingFiles = Object.entries(files)
      .filter(([path, content]) => content !== null)
      .map(([path, content]) => ({
        path,
        size: content.length,
        lines: content.split('\n').length
      }))

    yield {
      toolName: 'set_output',
      input: { output: existingFiles }
    }
  }
}
```

**Expected Output:**
```json
[
  { "path": ".env", "size": 245, "lines": 12 },
  { "path": ".env.local", "size": 102, "lines": 5 }
]
```

**Tips:**
- Files that don't exist will be `null` in the result
- Read up to 100 files in one call
- Relative paths are resolved from `cwd`

**Related Recipes:** [#1](#recipe-1-read-a-single-file), [#8](#recipe-8-find-files-by-name)

---

### Recipe 3: Create a New File

**Problem:** I need to create a `README.md`

**Solution:**
```typescript
const createFileAgent: AgentDefinition = {
  id: 'create-file',
  displayName: 'Create File',
  toolNames: ['write_file', 'set_output'],

  handleSteps: function* () {
    const readmeContent = `# My Project

## Description
This is an awesome project!

## Installation
\`\`\`bash
npm install
\`\`\`

## Usage
\`\`\`bash
npm start
\`\`\`
`

    // Write the file
    const { toolResult } = yield {
      toolName: 'write_file',
      input: {
        path: 'README.md',
        content: readmeContent
      }
    }

    // Check if successful
    const writeResult = toolResult[0].value

    if (writeResult.success) {
      yield {
        toolName: 'set_output',
        input: { output: `✅ Created ${writeResult.path}` }
      }
    } else {
      yield {
        toolName: 'set_output',
        input: { output: `❌ Failed: ${writeResult.error}` }
      }
    }
  }
}
```

**Expected Output:**
```
✅ Created README.md
```

**Tips:**
- Parent directories are created automatically
- Existing files are overwritten
- Use UTF-8 encoding by default

**Related Recipes:** [#4](#recipe-4-edit-an-existing-file), [#14](#recipe-14-multi-step-workflow)

---

### Recipe 4: Edit an Existing File

**Problem:** I need to replace text in a file

**Solution:**
```typescript
const editFileAgent: AgentDefinition = {
  id: 'edit-file',
  displayName: 'Edit File',
  toolNames: ['str_replace', 'set_output'],

  handleSteps: function* () {
    // Replace exact string match
    const { toolResult } = yield {
      toolName: 'str_replace',
      input: {
        path: 'src/config.ts',
        old_string: "const DEBUG = true",
        new_string: "const DEBUG = false"
      }
    }

    const result = toolResult[0].value

    if (result.success) {
      yield {
        toolName: 'set_output',
        input: { output: '✅ Updated DEBUG flag' }
      }
    } else {
      yield {
        toolName: 'set_output',
        input: { output: `❌ Error: ${result.error}` }
      }
    }
  }
}
```

**Expected Output:**
```
✅ Updated DEBUG flag
```

**Tips:**
- `old_string` must match **exactly** (including whitespace)
- Only the first occurrence is replaced
- File must exist before editing
- For multiple replacements: See Recipe 5

**Related Recipes:** [#3](#recipe-3-create-a-new-file), [#5](#recipe-5-replace-multiple-occurrences)

---

### Recipe 5: Replace Multiple Occurrences

**Problem:** I need to replace all `console.log` with `logger.info`

**Solution:**
```typescript
const replaceAllAgent: AgentDefinition = {
  id: 'replace-all',
  displayName: 'Replace All',
  toolNames: ['read_files', 'write_file', 'set_output'],

  handleSteps: function* () {
    // 1. Read the file
    const { toolResult: readResult } = yield {
      toolName: 'read_files',
      input: { paths: ['src/app.ts'] }
    }

    const content = readResult[0].value['src/app.ts']

    // 2. Replace all occurrences using JavaScript
    const newContent = content.replace(/console\.log/g, 'logger.info')

    // 3. Write back
    const { toolResult: writeResult } = yield {
      toolName: 'write_file',
      input: {
        path: 'src/app.ts',
        content: newContent
      }
    }

    // 4. Count replacements
    const count = (content.match(/console\.log/g) || []).length

    yield {
      toolName: 'set_output',
      input: { output: `✅ Replaced ${count} occurrences` }
    }
  }
}
```

**Expected Output:**
```
✅ Replaced 7 occurrences
```

**Tips:**
- Use regex for complex patterns
- Test on a copy first!
- Can also use `str_replace` in a loop

**Related Recipes:** [#4](#recipe-4-edit-an-existing-file), [#14](#recipe-14-multi-step-workflow)

---

## Code Search

### Recipe 6: Find All TODOs

**Problem:** I want to find all TODO comments in my codebase

**Solution:**
```typescript
const findTodosAgent: AgentDefinition = {
  id: 'find-todos',
  displayName: 'Find TODOs',
  toolNames: ['code_search', 'set_output'],

  handleSteps: function* () {
    // Search for TODO comments
    const { toolResult } = yield {
      toolName: 'code_search',
      input: {
        pattern: 'TODO',
        filePattern: '*.{ts,js,tsx,jsx}',
        maxResults: 100
      }
    }

    const matches = toolResult[0].value.matches

    // Format results
    const todos = matches.map(match => ({
      file: match.file,
      line: match.line,
      text: match.text.trim()
    }))

    yield {
      toolName: 'set_output',
      input: { output: todos }
    }
  }
}
```

**Expected Output:**
```json
[
  { "file": "src/app.ts", "line": 42, "text": "// TODO: Refactor this" },
  { "file": "src/utils.ts", "line": 15, "text": "// TODO: Add error handling" },
  { "file": "tests/app.test.ts", "line": 8, "text": "// TODO: Add more tests" }
]
```

**Variations:**
- Find FIXMEs: Change `pattern: 'FIXME'`
- Find HACKs: Change `pattern: 'HACK'`
- Case-insensitive: Add `caseInsensitive: true`

**Related Recipes:** [#7](#recipe-7-search-for-a-pattern), [#9](#recipe-9-search-in-specific-files)

---

### Recipe 7: Search for a Pattern

**Problem:** I need to find all uses of `console.log`

**Solution:**
```typescript
const searchPatternAgent: AgentDefinition = {
  id: 'search-pattern',
  displayName: 'Search Pattern',
  toolNames: ['code_search', 'set_output'],

  handleSteps: function* () {
    // Search with regex pattern
    const { toolResult } = yield {
      toolName: 'code_search',
      input: {
        pattern: 'console\\.log\\(',  // Regex pattern
        filePattern: '*.ts',
        maxResults: 50
      }
    }

    const matches = toolResult[0].value.matches
    const total = toolResult[0].value.total

    // Group by file
    const byFile = matches.reduce((acc, match) => {
      if (!acc[match.file]) acc[match.file] = []
      acc[match.file].push(match.line)
      return acc
    }, {})

    yield {
      toolName: 'set_output',
      input: {
        output: {
          total,
          files: Object.keys(byFile).length,
          details: byFile
        }
      }
    }
  }
}
```

**Expected Output:**
```json
{
  "total": 15,
  "files": 4,
  "details": {
    "src/app.ts": [12, 45, 67],
    "src/utils.ts": [23, 34],
    "tests/app.test.ts": [8, 15, 22, 34, 56]
  }
}
```

**Tips:**
- Use regex for advanced patterns
- Escape special characters: `\.`, `\(`, `\)`
- Set `maxResults` to limit output

**Related Recipes:** [#6](#recipe-6-find-all-todos), [#18](#recipe-18-extract-specific-data)

---

### Recipe 8: Find Files by Name

**Problem:** I want to find all test files

**Solution:**
```typescript
const findTestFilesAgent: AgentDefinition = {
  id: 'find-test-files',
  displayName: 'Find Test Files',
  toolNames: ['find_files', 'set_output'],

  handleSteps: function* () {
    // Find files matching pattern
    const { toolResult } = yield {
      toolName: 'find_files',
      input: {
        pattern: '**/*.test.{ts,js}'
      }
    }

    const result = toolResult[0].value

    yield {
      toolName: 'set_output',
      input: {
        output: {
          total: result.total,
          files: result.files
        }
      }
    }
  }
}
```

**Expected Output:**
```json
{
  "total": 12,
  "files": [
    "src/utils.test.ts",
    "src/app.test.ts",
    "tests/integration.test.ts"
  ]
}
```

**Common Patterns:**
- All TypeScript: `**/*.ts`
- All JavaScript: `**/*.js`
- All React: `**/*.{tsx,jsx}`
- All tests: `**/*.{test,spec}.{ts,js}`
- In directory: `src/**/*.ts`

**Related Recipes:** [#2](#recipe-2-read-multiple-files), [#9](#recipe-9-search-in-specific-files)

---

### Recipe 9: Search in Specific Files

**Problem:** I want to search only in `src/` directory

**Solution:**
```typescript
const searchInDirAgent: AgentDefinition = {
  id: 'search-in-dir',
  displayName: 'Search in Directory',
  toolNames: ['code_search', 'set_output'],

  handleSteps: function* () {
    // Search only in src/ directory
    const { toolResult } = yield {
      toolName: 'code_search',
      input: {
        pattern: 'export',
        filePattern: 'src/**/*.ts',  // Only src folder
        maxResults: 100
      }
    }

    const matches = toolResult[0].value.matches

    yield {
      toolName: 'set_output',
      input: { output: matches }
    }
  }
}
```

**Expected Output:**
```json
[
  { "file": "src/index.ts", "line": 1, "text": "export { ClaudeAdapter } from './adapter'" },
  { "file": "src/types.ts", "line": 5, "text": "export interface Config {" }
]
```

**File Pattern Examples:**
- Specific folder: `src/**/*.ts`
- Multiple folders: `{src,tests}/**/*.ts`
- Exclude folder: Use `!` prefix (check ripgrep docs)

**Related Recipes:** [#7](#recipe-7-search-for-a-pattern), [#8](#recipe-8-find-files-by-name)

---

## Terminal Commands

### Recipe 10: Run npm install

**Problem:** I need to install dependencies

**Solution:**
```typescript
const npmInstallAgent: AgentDefinition = {
  id: 'npm-install',
  displayName: 'NPM Install',
  toolNames: ['run_terminal_command', 'set_output'],

  handleSteps: function* () {
    // Run npm install
    const { toolResult } = yield {
      toolName: 'run_terminal_command',
      input: {
        command: 'npm install',
        timeout_seconds: 300  // 5 minutes for slow installs
      }
    }

    const result = toolResult[0].value

    yield {
      toolName: 'set_output',
      input: {
        output: {
          success: !result.error,
          output: result.output
        }
      }
    }
  }
}
```

**Expected Output:**
```json
{
  "success": true,
  "output": "added 245 packages in 12.3s"
}
```

**Tips:**
- Set higher timeout for slow operations
- Default timeout is 30 seconds
- Check `result.error` for failures

**Related Recipes:** [#11](#recipe-11-run-tests), [#13](#recipe-13-run-build-command)

---

### Recipe 11: Run Tests

**Problem:** I want to run my test suite

**Solution:**
```typescript
const runTestsAgent: AgentDefinition = {
  id: 'run-tests',
  displayName: 'Run Tests',
  toolNames: ['run_terminal_command', 'set_output'],

  handleSteps: function* () {
    // Run tests
    const { toolResult } = yield {
      toolName: 'run_terminal_command',
      input: {
        command: 'npm test',
        timeout_seconds: 120  // 2 minutes
      }
    }

    const result = toolResult[0].value

    // Parse test results
    const output = result.output
    const passed = output.includes('PASS')
    const failed = output.includes('FAIL')

    yield {
      toolName: 'set_output',
      input: {
        output: {
          success: passed && !failed,
          output: output,
          summary: passed ? '✅ Tests passed' : '❌ Tests failed'
        }
      }
    }
  }
}
```

**Expected Output:**
```json
{
  "success": true,
  "output": "PASS src/utils.test.ts\nPASS src/app.test.ts\n\n12 tests passed",
  "summary": "✅ Tests passed"
}
```

**Variations:**
- Run specific test: `npm test -- app.test.ts`
- Watch mode: `npm test -- --watch`
- Coverage: `npm test -- --coverage`

**Related Recipes:** [#10](#recipe-10-run-npm-install), [#13](#recipe-13-run-build-command)

---

### Recipe 12: Check Git Status

**Problem:** I need to see uncommitted changes

**Solution:**
```typescript
const gitStatusAgent: AgentDefinition = {
  id: 'git-status',
  displayName: 'Git Status',
  toolNames: ['run_terminal_command', 'set_output'],

  handleSteps: function* () {
    // Run git status
    const { toolResult } = yield {
      toolName: 'run_terminal_command',
      input: {
        command: 'git status --short'
      }
    }

    const result = toolResult[0].value
    const output = result.output

    // Parse status
    const lines = output.split('\n').filter(l => l.trim())
    const modified = lines.filter(l => l.startsWith(' M'))
    const untracked = lines.filter(l => l.startsWith('??'))
    const staged = lines.filter(l => l.startsWith('M '))

    yield {
      toolName: 'set_output',
      input: {
        output: {
          modified: modified.length,
          untracked: untracked.length,
          staged: staged.length,
          files: lines
        }
      }
    }
  }
}
```

**Expected Output:**
```json
{
  "modified": 3,
  "untracked": 1,
  "staged": 2,
  "files": [
    "M  src/app.ts",
    " M src/utils.ts",
    "?? new-file.ts"
  ]
}
```

**Related Recipes:** [#14](#recipe-14-multi-step-workflow), [#18](#recipe-18-extract-specific-data)

---

### Recipe 13: Run Build Command

**Problem:** I want to build my project

**Solution:**
```typescript
const buildAgent: AgentDefinition = {
  id: 'build',
  displayName: 'Build Project',
  toolNames: ['run_terminal_command', 'set_output'],

  handleSteps: function* () {
    // Run build
    const { toolResult } = yield {
      toolName: 'run_terminal_command',
      input: {
        command: 'npm run build',
        timeout_seconds: 180  // 3 minutes
      }
    }

    const result = toolResult[0].value
    const success = !result.error && !result.output.includes('error')

    yield {
      toolName: 'set_output',
      input: {
        output: {
          success,
          message: success ? '✅ Build successful' : '❌ Build failed',
          output: result.output
        }
      }
    }
  }
}
```

**Expected Output:**
```json
{
  "success": true,
  "message": "✅ Build successful",
  "output": "Compiled successfully in 4.2s"
}
```

**Related Recipes:** [#10](#recipe-10-run-npm-install), [#11](#recipe-11-run-tests)

---

## Advanced Patterns

### Recipe 14: Multi-Step Workflow

**Problem:** Find TODOs, count them, create a report

**Solution:**
```typescript
const todoReportAgent: AgentDefinition = {
  id: 'todo-report',
  displayName: 'TODO Report Generator',
  toolNames: ['code_search', 'write_file', 'set_output'],

  handleSteps: function* () {
    // Step 1: Search for TODOs
    const { toolResult: searchResult } = yield {
      toolName: 'code_search',
      input: {
        pattern: 'TODO',
        filePattern: '*.{ts,js,tsx,jsx}',
        maxResults: 100
      }
    }

    const matches = searchResult[0].value.matches

    // Step 2: Analyze results
    const byFile = matches.reduce((acc, match) => {
      if (!acc[match.file]) acc[match.file] = []
      acc[match.file].push({
        line: match.line,
        text: match.text.trim()
      })
      return acc
    }, {})

    // Step 3: Create report
    let report = `# TODO Report\n\n`
    report += `Generated: ${new Date().toISOString()}\n\n`
    report += `**Total TODOs:** ${matches.length}\n`
    report += `**Files:** ${Object.keys(byFile).length}\n\n`

    for (const [file, todos] of Object.entries(byFile)) {
      report += `## ${file}\n\n`
      for (const todo of todos) {
        report += `- Line ${todo.line}: ${todo.text}\n`
      }
      report += `\n`
    }

    // Step 4: Write report
    const { toolResult: writeResult } = yield {
      toolName: 'write_file',
      input: {
        path: 'TODO_REPORT.md',
        content: report
      }
    }

    // Step 5: Return summary
    yield {
      toolName: 'set_output',
      input: {
        output: {
          total: matches.length,
          files: Object.keys(byFile).length,
          report: 'TODO_REPORT.md'
        }
      }
    }
  }
}
```

**Expected Output:**
```json
{
  "total": 24,
  "files": 8,
  "report": "TODO_REPORT.md"
}
```

**Tips:**
- Chain multiple tool calls
- Process data between steps
- Create meaningful output

**Related Recipes:** [#6](#recipe-6-find-all-todos), [#3](#recipe-3-create-a-new-file)

---

### Recipe 15: Conditional Logic

**Problem:** Only create file if it doesn't exist

**Solution:**
```typescript
const conditionalAgent: AgentDefinition = {
  id: 'conditional',
  displayName: 'Conditional File Creation',
  toolNames: ['read_files', 'write_file', 'set_output'],

  handleSteps: function* () {
    // Check if file exists
    const { toolResult: readResult } = yield {
      toolName: 'read_files',
      input: { paths: ['config.json'] }
    }

    const exists = readResult[0].value['config.json'] !== null

    if (!exists) {
      // File doesn't exist, create it
      const { toolResult: writeResult } = yield {
        toolName: 'write_file',
        input: {
          path: 'config.json',
          content: JSON.stringify({ version: '1.0.0' }, null, 2)
        }
      }

      yield {
        toolName: 'set_output',
        input: { output: '✅ Created config.json' }
      }
    } else {
      // File exists, skip
      yield {
        toolName: 'set_output',
        input: { output: '⚠️  config.json already exists, skipping' }
      }
    }
  }
}
```

**Expected Output:**
```
✅ Created config.json
```
or
```
⚠️  config.json already exists, skipping
```

**Tips:**
- Use JavaScript `if/else` in generators
- Check results before proceeding
- Provide informative messages

**Related Recipes:** [#16](#recipe-16-error-handling), [#3](#recipe-3-create-a-new-file)

---

### Recipe 16: Error Handling

**Problem:** Handle failures gracefully

**Solution:**
```typescript
const errorHandlingAgent: AgentDefinition = {
  id: 'error-handling',
  displayName: 'Error Handling Example',
  toolNames: ['read_files', 'write_file', 'set_output'],

  handleSteps: function* () {
    try {
      // Try to read file
      const { toolResult: readResult } = yield {
        toolName: 'read_files',
        input: { paths: ['important-data.json'] }
      }

      const content = readResult[0].value['important-data.json']

      if (content === null) {
        // File doesn't exist, use defaults
        const defaults = { version: '1.0.0', settings: {} }

        yield {
          toolName: 'write_file',
          input: {
            path: 'important-data.json',
            content: JSON.stringify(defaults, null, 2)
          }
        }

        yield {
          toolName: 'set_output',
          input: {
            output: {
              status: 'created',
              message: 'File not found, created with defaults'
            }
          }
        }
      } else {
        // File exists, parse it
        const data = JSON.parse(content)

        yield {
          toolName: 'set_output',
          input: {
            output: {
              status: 'loaded',
              data
            }
          }
        }
      }
    } catch (error) {
      // Handle any errors
      yield {
        toolName: 'set_output',
        input: {
          output: {
            status: 'error',
            error: error.message
          }
        }
      }
    }
  }
}
```

**Expected Output:**
```json
{
  "status": "loaded",
  "data": { "version": "1.0.0", "settings": {} }
}
```

**Tips:**
- Always check tool results
- Use try/catch for parsing
- Provide fallback behavior
- Give clear error messages

**Related Recipes:** [#15](#recipe-15-conditional-logic), [#17](#recipe-17-progress-reporting)

---

### Recipe 17: Progress Reporting

**Problem:** Show progress during long operations

**Solution:**
```typescript
const progressAgent: AgentDefinition = {
  id: 'progress',
  displayName: 'Progress Reporting',
  toolNames: ['find_files', 'read_files', 'write_file', 'set_output'],

  handleSteps: function* ({ logger }) {
    // Step 1: Find files
    logger.info('Finding TypeScript files...')
    const { toolResult: findResult } = yield {
      toolName: 'find_files',
      input: { pattern: '**/*.ts' }
    }

    const files = findResult[0].value.files
    logger.info(`Found ${files.length} files`)

    // Step 2: Read files
    logger.info('Reading files...')
    const { toolResult: readResult } = yield {
      toolName: 'read_files',
      input: { paths: files }
    }

    const contents = readResult[0].value
    logger.info('Files read successfully')

    // Step 3: Analyze
    logger.info('Analyzing code...')
    let totalLines = 0
    let totalImports = 0

    for (const [file, content] of Object.entries(contents)) {
      if (content) {
        totalLines += content.split('\n').length
        totalImports += (content.match(/^import /gm) || []).length
      }
    }

    logger.info('Analysis complete')

    // Step 4: Create report
    logger.info('Generating report...')
    const report = `# Code Analysis

- Files: ${files.length}
- Total Lines: ${totalLines}
- Total Imports: ${totalImports}
- Avg Lines/File: ${Math.round(totalLines / files.length)}
`

    yield {
      toolName: 'write_file',
      input: {
        path: 'ANALYSIS.md',
        content: report
      }
    }

    logger.info('✅ Report saved to ANALYSIS.md')

    yield {
      toolName: 'set_output',
      input: {
        output: {
          files: files.length,
          totalLines,
          totalImports
        }
      }
    }
  }
}
```

**Expected Output:**
```
[INFO] Finding TypeScript files...
[INFO] Found 42 files
[INFO] Reading files...
[INFO] Files read successfully
[INFO] Analyzing code...
[INFO] Analysis complete
[INFO] Generating report...
[INFO] ✅ Report saved to ANALYSIS.md
```

**Tips:**
- Use `logger.info()` for progress
- Break work into logical steps
- Report completion status
- Show meaningful metrics

**Related Recipes:** [#14](#recipe-14-multi-step-workflow), [#18](#recipe-18-extract-specific-data)

---

### Recipe 18: Extract Specific Data

**Problem:** Get just the data I need from agent output

**Solution:**
```typescript
const extractDataAgent: AgentDefinition = {
  id: 'extract-data',
  displayName: 'Extract Data',
  toolNames: ['read_files', 'set_output'],

  handleSteps: function* () {
    // Read package.json
    const { toolResult } = yield {
      toolName: 'read_files',
      input: { paths: ['package.json'] }
    }

    const content = toolResult[0].value['package.json']
    const pkg = JSON.parse(content)

    // Extract only what we need
    const extracted = {
      name: pkg.name,
      version: pkg.version,
      dependencies: Object.keys(pkg.dependencies || {}),
      devDependencies: Object.keys(pkg.devDependencies || {}),
      scripts: Object.keys(pkg.scripts || {})
    }

    yield {
      toolName: 'set_output',
      input: { output: extracted }
    }
  }
}
```

**Expected Output:**
```json
{
  "name": "@codebuff/adapter",
  "version": "1.0.0",
  "dependencies": ["@anthropic-ai/sdk"],
  "devDependencies": ["typescript", "tsx"],
  "scripts": ["build", "test", "type-check"]
}
```

**Tips:**
- Parse JSON/YAML in generator
- Extract only needed fields
- Transform data structure
- Return clean, structured output

**Related Recipes:** [#1](#recipe-1-read-a-single-file), [#7](#recipe-7-search-for-a-pattern)

---

## 🎯 Quick Reference

### Most Common Patterns

**Read → Process → Write:**
```typescript
const { toolResult } = yield { toolName: 'read_files', ... }
// Process data
yield { toolName: 'write_file', ... }
```

**Search → Analyze → Report:**
```typescript
const { toolResult } = yield { toolName: 'code_search', ... }
// Analyze results
yield { toolName: 'set_output', ... }
```

**Find → Read → Transform:**
```typescript
const { toolResult } = yield { toolName: 'find_files', ... }
const { toolResult } = yield { toolName: 'read_files', ... }
// Transform data
yield { toolName: 'set_output', ... }
```

### Error Checking

```typescript
// Check file exists
if (content === null) { /* handle missing file */ }

// Check write success
if (!result.success) { /* handle write error */ }

// Check command success
if (result.error) { /* handle command failure */ }
```

### Performance Tips

- Read multiple files at once
- Set `maxResults` on searches
- Use appropriate timeouts
- Cache results when possible

---

## 💡 Tips & Tricks

1. **Debug Mode:** Always use `debug: true` during development
2. **Small Steps:** Break complex tasks into small tool calls
3. **Check Results:** Always verify tool results before proceeding
4. **Error Messages:** Provide clear, actionable error messages
5. **Test First:** Test on sample data before running on real files

---

## 🚀 What's Next?

- **[Cheat Sheet](./docs/FREE_MODE_CHEAT_SHEET.md)** - Quick reference
- **[Visual Guide](./docs/FREE_MODE_VISUAL_GUIDE.md)** - Architecture diagrams
- **[API Reference](./API_REFERENCE.md)** - Complete documentation
- **[Upgrade to PAID](./docs/FREE_VS_PAID.md)** - Multi-agent features

---

**Need help?** See [Troubleshooting in README](./README.md#troubleshooting)
