# 📊 FREE Mode Visual Guide

Understanding how FREE mode works with diagrams and flowcharts.

---

## 🏗️ Architecture Diagram

### Complete System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR APPLICATION                         │
│                                                                 │
│  import { ClaudeCodeCLIAdapter } from '@codebuff/adapter'       │
│  const adapter = new ClaudeCodeCLIAdapter({ cwd: '...' })      │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ executeAgent(agent, prompt)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              ClaudeCodeCLIAdapter (FREE MODE)                   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Agent Registry                              │  │
│  │  - fileReaderAgent                                       │  │
│  │  - codeAnalyzerAgent                                     │  │
│  │  - buildAutomationAgent                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │                                       │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         HandleSteps Generator Executor                   │  │
│  │  • Executes handleSteps() function                       │  │
│  │  • Yields tool calls one at a time                       │  │
│  │  • Manages execution state                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │                                       │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Tool Execution Dispatcher                      │  │
│  │  Routes tool calls to appropriate implementations        │  │
│  └──────────────────────────────────────────────────────────┘  │
│           │              │              │                       │
│    ┌──────┴──────┬───────┴──────┬───────┴──────┬──────┐       │
│    ▼             ▼              ▼              ▼      ▼       │
│  ┌────┐      ┌────┐        ┌────────┐      ┌──────┐ ┌─────┐  │
│  │File│      │Code│        │Terminal│      │ Set  │ │spawn│  │
│  │Ops │      │Srch│        │        │      │Output│ │(❌) │  │
│  └────┘      └────┘        └────────┘      └──────┘ └─────┘  │
│    │            │              │               │       │       │
└────┼────────────┼──────────────┼───────────────┼───────┼──────┘
     │            │              │               │       │
     │            │              │               │       │ (Returns error)
     ▼            ▼              ▼               ▼       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LOCAL FILE SYSTEM                            │
│                                                                 │
│  📁 Your Project Files                                          │
│  📁 node_modules                                                │
│  📁 src/                                                        │
│  📁 tests/                                                      │
│  📄 package.json                                                │
│  📄 tsconfig.json                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components:

1. **Your Application**: Where you create and use the adapter
2. **ClaudeCodeCLIAdapter**: Main orchestration engine
3. **Agent Registry**: Stores all registered agents
4. **HandleSteps Executor**: Runs your agent's logic
5. **Tool Dispatcher**: Routes tool calls to implementations
6. **Tools**: File ops, code search, terminal, etc.
7. **File System**: Your local project files

---

## 🔄 Execution Flow

### From Agent Definition to Result

```
START
  │
  ├─► 1. DEFINE AGENT
  │   │
  │   │   const agent: AgentDefinition = {
  │   │     id: 'my-agent',
  │   │     toolNames: ['read_files', 'write_file'],
  │   │     handleSteps: function* () { ... }
  │   │   }
  │   │
  │   ▼
  ├─► 2. REGISTER AGENT
  │   │
  │   │   adapter.registerAgent(agent)
  │   │
  │   │   [Agent stored in registry]
  │   │
  │   ▼
  ├─► 3. EXECUTE AGENT
  │   │
  │   │   adapter.executeAgent(agent, prompt)
  │   │
  │   │   [Create execution context]
  │   │
  │   ▼
  ├─► 4. RUN HANDLESTEPS
  │   │
  │   │   [Generator starts]
  │   │   │
  │   │   ├─► yield { toolName: 'read_files', ... }
  │   │   │   │
  │   │   │   ▼
  │   │   │   [Execute tool]
  │   │   │   │
  │   │   │   ▼
  │   │   │   [Return result to generator]
  │   │   │
  │   │   ├─► yield { toolName: 'write_file', ... }
  │   │   │   │
  │   │   │   ▼
  │   │   │   [Execute tool]
  │   │   │   │
  │   │   │   ▼
  │   │   │   [Return result to generator]
  │   │   │
  │   │   ├─► yield { toolName: 'set_output', ... }
  │   │   │   │
  │   │   │   ▼
  │   │   │   [Set final output]
  │   │   │
  │   │   └─► [Generator complete]
  │   │
  │   ▼
  ├─► 5. RETURN RESULT
  │   │
  │   │   {
  │   │     output: { ... },
  │   │     messageHistory: [...],
  │   │     metadata: { ... }
  │   │   }
  │   │
  │   ▼
  END
```

### Execution States:

```
IDLE → RUNNING → EXECUTING_TOOL → RUNNING → ... → COMPLETED
                      ▲                │
                      └────────────────┘
                     (multiple tools)
```

---

## 🛠️ Tool Availability Matrix

### FREE Mode vs PAID Mode

```
┌─────────────────────────┬──────────┬───────────┬──────────────┐
│ Tool Name               │ FREE ✅  │ PAID ✅   │ Category     │
├─────────────────────────┼──────────┼───────────┼──────────────┤
│ read_files              │    ✅    │    ✅     │ File Ops     │
│ write_file              │    ✅    │    ✅     │ File Ops     │
│ str_replace             │    ✅    │    ✅     │ File Ops     │
├─────────────────────────┼──────────┼───────────┼──────────────┤
│ code_search             │    ✅    │    ✅     │ Code Search  │
│ find_files              │    ✅    │    ✅     │ Code Search  │
├─────────────────────────┼──────────┼───────────┼──────────────┤
│ run_terminal_command    │    ✅    │    ✅     │ Terminal     │
├─────────────────────────┼──────────┼───────────┼──────────────┤
│ set_output              │    ✅    │    ✅     │ Control      │
├─────────────────────────┼──────────┼───────────┼──────────────┤
│ spawn_agents            │    ❌    │    ✅     │ Multi-Agent  │
└─────────────────────────┴──────────┴───────────┴──────────────┘

Legend:
  ✅ = Available
  ❌ = Not available (returns error message)
```

### Feature Comparison

```
╔══════════════════════════════════════════════════════════════╗
║                    FREE MODE (No API Key)                    ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  💰 Cost: $0.00                                              ║
║  🔒 Privacy: 100% local                                      ║
║  🚀 Speed: Fast (no network calls)                           ║
║                                                              ║
║  ✅ What Works:                                              ║
║     • Read/write/edit files                                  ║
║     • Search code                                            ║
║     • Find files                                             ║
║     • Run terminal commands                                  ║
║     • Single agent execution                                 ║
║                                                              ║
║  ❌ What Doesn't:                                            ║
║     • spawn_agents (multi-agent workflows)                   ║
║                                                              ║
║  👍 Best For:                                                ║
║     • File manipulation                                      ║
║     • Code analysis                                          ║
║     • Build automation                                       ║
║     • Simple workflows                                       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════╗
║                   PAID MODE (With API Key)                   ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  💰 Cost: ~$3-15 per 1M tokens                               ║
║  🔒 Privacy: Uses Anthropic API                              ║
║  🚀 Speed: Fast (optimized API)                              ║
║                                                              ║
║  ✅ What Works:                                              ║
║     • Everything from FREE mode                              ║
║     • spawn_agents (multi-agent orchestration)               ║
║     • Parallel agent execution                               ║
║     • Complex nested workflows                               ║
║                                                              ║
║  ❌ What Doesn't:                                            ║
║     • Nothing! Full features available                       ║
║                                                              ║
║  👍 Best For:                                                ║
║     • Multi-agent workflows                                  ║
║     • Complex orchestration                                  ║
║     • Nested agent spawning                                  ║
║     • Advanced automation                                    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 📋 Common Workflows

### Workflow 1: Simple File Processing

```
┌─────────────────────────────────────────────────────────────┐
│                  FILE PROCESSING WORKFLOW                   │
└─────────────────────────────────────────────────────────────┘

1. FIND FILES
   │
   │  yield { toolName: 'find_files', input: { pattern: '*.ts' } }
   │
   ▼
   [Returns: file list]
   │
   │
2. READ FILES
   │
   │  yield { toolName: 'read_files', input: { paths: files } }
   │
   ▼
   [Returns: file contents]
   │
   │
3. PROCESS DATA
   │
   │  // Your custom logic
   │  const result = processFiles(contents)
   │
   ▼
   [Processed data]
   │
   │
4. WRITE OUTPUT
   │
   │  yield { toolName: 'write_file', input: { path: 'output.txt', ... } }
   │
   ▼
   [File created]
   │
   │
5. SET OUTPUT
   │
   │  yield { toolName: 'set_output', input: { output: result } }
   │
   ▼
   DONE ✅
```

### Workflow 2: Code Analysis

```
┌─────────────────────────────────────────────────────────────┐
│                   CODE ANALYSIS WORKFLOW                    │
└─────────────────────────────────────────────────────────────┘

1. SEARCH CODE
   │
   │  yield { toolName: 'code_search', input: { pattern: 'TODO' } }
   │
   ▼
   [Returns: matches]
   │
   │
2. ANALYZE RESULTS
   │
   │  // Count, group, filter matches
   │  const analysis = analyzeMatches(matches)
   │
   ▼
   [Analysis data]
   │
   │
3. GENERATE REPORT
   │
   │  const report = createMarkdownReport(analysis)
   │
   ▼
   [Report content]
   │
   │
4. SAVE REPORT
   │
   │  yield { toolName: 'write_file', input: { path: 'REPORT.md', ... } }
   │
   ▼
   DONE ✅
```

### Workflow 3: Build Automation

```
┌─────────────────────────────────────────────────────────────┐
│                 BUILD AUTOMATION WORKFLOW                   │
└─────────────────────────────────────────────────────────────┘

1. INSTALL DEPS
   │
   │  yield { toolName: 'run_terminal_command', input: { command: 'npm install' } }
   │
   ▼
   [Dependencies installed]
   │
   │
2. RUN TESTS
   │
   │  yield { toolName: 'run_terminal_command', input: { command: 'npm test' } }
   │
   ▼
   [Tests passed/failed]
   │
   │
3. CHECK RESULT
   │
   │  if (testsPassed) { ... } else { ... }
   │
   ▼
   [Decision made]
   │
   │
4. BUILD (if tests passed)
   │
   │  yield { toolName: 'run_terminal_command', input: { command: 'npm run build' } }
   │
   ▼
   [Build complete]
   │
   │
5. REPORT STATUS
   │
   │  yield { toolName: 'set_output', input: { output: status } }
   │
   ▼
   DONE ✅
```

---

## 🔍 Data Flow Diagram

### How Data Moves Through the System

```
YOUR CODE
    │
    │ executeAgent(agent, prompt, params)
    │
    ▼
┌────────────────────────────────────────────────────┐
│             ADAPTER (Execution Context)            │
│                                                    │
│  agentState: {                                     │
│    messages: [],                                   │
│    context: {},                                    │
│    output: null                                    │
│  }                                                 │
└────────────────────────────────────────────────────┘
    │
    │ Start handleSteps generator
    │
    ▼
┌────────────────────────────────────────────────────┐
│            GENERATOR (Your Logic)                  │
│                                                    │
│  handleSteps: function* () {                       │
│    const { toolResult } = yield {                 │
│      toolName: 'read_files',                      │
│      input: { paths: ['file.txt'] }               │
│    }                                               │
│    // toolResult contains file content            │
│  }                                                 │
└────────────────────────────────────────────────────┘
    │
    │ yield tool call
    │
    ▼
┌────────────────────────────────────────────────────┐
│           TOOL DISPATCHER                          │
│                                                    │
│  Routes to appropriate tool implementation         │
└────────────────────────────────────────────────────┘
    │
    │ Execute tool
    │
    ▼
┌────────────────────────────────────────────────────┐
│         TOOL IMPLEMENTATION                        │
│                                                    │
│  FileOperationsTools.readFiles({                   │
│    paths: ['file.txt']                            │
│  })                                                │
└────────────────────────────────────────────────────┘
    │
    │ Read from file system
    │
    ▼
┌────────────────────────────────────────────────────┐
│            FILE SYSTEM                             │
│                                                    │
│  📄 file.txt → "Hello, world!"                     │
└────────────────────────────────────────────────────┘
    │
    │ Return content
    │
    ▼
┌────────────────────────────────────────────────────┐
│         TOOL RESULT                                │
│                                                    │
│  [                                                 │
│    {                                               │
│      type: 'tool_result',                         │
│      value: { 'file.txt': 'Hello, world!' }       │
│    }                                               │
│  ]                                                 │
└────────────────────────────────────────────────────┘
    │
    │ Resume generator with result
    │
    ▼
┌────────────────────────────────────────────────────┐
│         GENERATOR (Continues)                      │
│                                                    │
│  const content = toolResult[0].value['file.txt']  │
│  // Use content...                                │
│                                                    │
│  yield {                                           │
│    toolName: 'set_output',                        │
│    input: { output: content }                     │
│  }                                                 │
└────────────────────────────────────────────────────┘
    │
    │ Generator completes
    │
    ▼
┌────────────────────────────────────────────────────┐
│          FINAL RESULT                              │
│                                                    │
│  {                                                 │
│    output: "Hello, world!",                       │
│    messageHistory: [...],                         │
│    metadata: { ... }                              │
│  }                                                 │
└────────────────────────────────────────────────────┘
    │
    │ Return to your code
    │
    ▼
YOUR CODE
    │
    console.log(result.output)
    // "Hello, world!"
```

---

## 🎯 Mode Detection Flow

### How the Adapter Determines FREE vs PAID

```
START
  │
  ├─► new ClaudeCodeCLIAdapter({
  │     cwd: process.cwd(),
  │     anthropicApiKey: ???
  │   })
  │
  ▼
┌─────────────────────────────────────┐
│  Check: anthropicApiKey provided?  │
└─────────────────────────────────────┘
  │                           │
  │ NO                        │ YES
  │                           │
  ▼                           ▼
┌──────────────────┐    ┌──────────────────┐
│   FREE MODE ✅   │    │   PAID MODE ✅   │
└──────────────────┘    └──────────────────┘
  │                           │
  │                           │
  ▼                           ▼
┌──────────────────┐    ┌──────────────────┐
│ Available Tools: │    │ Available Tools: │
│ • read_files     │    │ • read_files     │
│ • write_file     │    │ • write_file     │
│ • str_replace    │    │ • str_replace    │
│ • code_search    │    │ • code_search    │
│ • find_files     │    │ • find_files     │
│ • run_terminal_  │    │ • run_terminal_  │
│   command        │    │   command        │
│ • set_output     │    │ • set_output     │
│ ❌ spawn_agents  │    │ ✅ spawn_agents  │
└──────────────────┘    └──────────────────┘
  │                           │
  │                           │
  ▼                           ▼
┌──────────────────┐    ┌──────────────────┐
│ Cost: $0.00      │    │ Cost: Variable   │
│ Privacy: 100%    │    │ Privacy: API     │
│ Speed: Fast      │    │ Speed: Fast      │
└──────────────────┘    └──────────────────┘
```

### When spawn_agents is Called

```
FREE MODE:
  │
  ├─► User calls spawn_agents
  │
  ▼
┌─────────────────────────────────────────┐
│  SpawnAgentsAdapter.execute()           │
│                                         │
│  Check: hasApiKey?                      │
│    NO → Return error message            │
│                                         │
│  Error: "spawn_agents requires API key" │
└─────────────────────────────────────────┘
  │
  ▼
  Agent receives error message
  Can handle gracefully


PAID MODE:
  │
  ├─► User calls spawn_agents
  │
  ▼
┌─────────────────────────────────────────┐
│  SpawnAgentsAdapter.execute()           │
│                                         │
│  Check: hasApiKey?                      │
│    YES → Proceed with spawning          │
│                                         │
│  1. Execute child agents                │
│  2. Collect results                     │
│  3. Return aggregated output            │
└─────────────────────────────────────────┘
  │
  ▼
  Agent receives spawned results
  Continues processing
```

---

## 🔐 Security & Safety

### Path Traversal Protection

```
┌─────────────────────────────────────────────────────────────┐
│                   PATH VALIDATION                           │
└─────────────────────────────────────────────────────────────┘

INPUT PATH
   │
   ├─► Normalize path (remove .., ., etc.)
   │
   ▼
NORMALIZED PATH
   │
   ├─► Resolve to absolute path
   │
   ▼
ABSOLUTE PATH
   │
   ├─► Check: starts with cwd?
   │
   ▼
┌──────────────┐         ┌──────────────┐
│   YES ✅     │         │    NO ❌     │
│              │         │              │
│ Allow access │         │ REJECT with  │
│              │         │ error        │
└──────────────┘         └──────────────┘
   │                           │
   ▼                           ▼
PROCEED              "Path traversal detected"


Examples:

✅ ALLOWED:
   cwd: /home/user/project
   path: src/index.ts
   → /home/user/project/src/index.ts (SAFE)

❌ BLOCKED:
   cwd: /home/user/project
   path: ../../etc/passwd
   → /etc/passwd (BLOCKED - outside cwd)

✅ ALLOWED:
   cwd: /home/user/project
   path: ./src/../lib/utils.ts
   → /home/user/project/lib/utils.ts (SAFE)
```

---

## 💾 Memory & State Management

### Context Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    EXECUTION LIFECYCLE                      │
└─────────────────────────────────────────────────────────────┘

1. CREATE CONTEXT
   │
   │  adapter.executeAgent(agent, prompt)
   │
   ▼
   contextId = generateContextId()
   contexts[contextId] = {
     agentState: { messages: [], context: {}, output: null },
     agent: agent,
     prompt: prompt
   }

2. EXECUTE AGENT
   │
   │  Run handleSteps generator
   │
   ▼
   • Update agentState.messages
   • Update agentState.context
   • Process tool calls
   • Track execution metadata

3. COMPLETE EXECUTION
   │
   │  Generator finishes
   │
   ▼
   result = {
     output: agentState.output,
     messageHistory: agentState.messages,
     metadata: { ... }
   }

4. CLEANUP CONTEXT
   │
   │  delete contexts[contextId]
   │
   ▼
   Memory freed ✅
```

### Nested Agent Contexts (PAID mode only)

```
PARENT AGENT (Context A)
   │
   ├─► spawn_agents called
   │
   ▼
CHILD AGENT 1 (Context B)
   │
   ├─► Inherits parent context
   │
   ├─► Executes independently
   │
   ├─► Returns result to parent
   │
   └─► Context B cleaned up
   │
   ▼
CHILD AGENT 2 (Context C)
   │
   ├─► Inherits parent context
   │
   ├─► Executes independently
   │
   ├─► Returns result to parent
   │
   └─► Context C cleaned up
   │
   ▼
PARENT AGENT (Context A)
   │
   ├─► Processes child results
   │
   ├─► Completes execution
   │
   └─► Context A cleaned up
```

---

## 🚀 Performance Characteristics

### Operation Speed Comparison

```
┌─────────────────────────────────────────────────────────────┐
│                   OPERATION SPEEDS                          │
└─────────────────────────────────────────────────────────────┘

read_files (single file)       ▓░░░░░░░░░░  < 10ms
read_files (10 files)          ▓▓░░░░░░░░░  < 50ms
read_files (100 files)         ▓▓▓░░░░░░░░  < 200ms

write_file (small)             ▓░░░░░░░░░░  < 5ms
write_file (large)             ▓▓░░░░░░░░░  < 50ms

str_replace                    ▓░░░░░░░░░░  < 10ms

code_search (small repo)       ▓▓▓░░░░░░░░  < 100ms
code_search (large repo)       ▓▓▓▓▓░░░░░░  < 500ms

find_files (small repo)        ▓▓░░░░░░░░░  < 50ms
find_files (large repo)        ▓▓▓▓░░░░░░░  < 300ms

run_terminal_command (quick)   ▓▓░░░░░░░░░  < 100ms
run_terminal_command (slow)    ▓▓▓▓▓▓▓▓▓▓  Varies

spawn_agents (FREE)            N/A (not available)
spawn_agents (PAID)            ▓▓▓▓▓▓▓░░░  Varies

Legend:
  ▓ = Time used
  ░ = Available time (up to max)
```

### Best Practices for Performance

```
❌ SLOW:
   for (const file of files) {
     yield { toolName: 'read_files', input: { paths: [file] } }
   }
   // 100 tool calls = slow!

✅ FAST:
   yield { toolName: 'read_files', input: { paths: files } }
   // 1 tool call = fast!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ SLOW:
   yield {
     toolName: 'code_search',
     input: { pattern: '.*' }  // Match everything!
   }
   // Too many results

✅ FAST:
   yield {
     toolName: 'code_search',
     input: {
       pattern: 'TODO',
       maxResults: 100  // Limit results
     }
   }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ SLOW:
   yield {
     toolName: 'run_terminal_command',
     input: {
       command: 'npm install',
       timeout_seconds: 30  // Too short!
     }
   }
   // Times out frequently

✅ FAST:
   yield {
     toolName: 'run_terminal_command',
     input: {
       command: 'npm install',
       timeout_seconds: 300  // Appropriate
     }
   }
```

---

## 📊 Summary Diagram

```
╔═══════════════════════════════════════════════════════════════╗
║                     FREE MODE OVERVIEW                        ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  🎯 PURPOSE: Local file operations without API costs         ║
║                                                               ║
║  💰 COST: $0.00 (100% free)                                   ║
║                                                               ║
║  🔧 TOOLS AVAILABLE:                                          ║
║     ✅ File Operations (read, write, replace)                 ║
║     ✅ Code Search (search, find)                             ║
║     ✅ Terminal Commands (run bash commands)                  ║
║     ✅ Output Control (set output)                            ║
║     ❌ Multi-Agent (spawn_agents - requires PAID)             ║
║                                                               ║
║  🚀 PERFORMANCE:                                              ║
║     • Fast (no network calls)                                ║
║     • Low memory usage                                       ║
║     • Scales well for single-agent tasks                     ║
║                                                               ║
║  🔒 SECURITY:                                                 ║
║     • Path traversal protection                              ║
║     • Sandboxed to working directory                         ║
║     • 100% local processing                                  ║
║                                                               ║
║  👍 BEST FOR:                                                 ║
║     • File manipulation                                      ║
║     • Code analysis & search                                 ║
║     • Build automation                                       ║
║     • Simple workflows                                       ║
║                                                               ║
║  📚 LEARN MORE:                                               ║
║     → FREE_MODE_QUICKSTART.md (5-min guide)                  ║
║     → FREE_MODE_COOKBOOK.md (recipes)                        ║
║     → FREE_MODE_CHEAT_SHEET.md (quick ref)                   ║
║     → FREE_VS_PAID.md (comparison)                           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## 🎓 Next Steps

Now that you understand how FREE mode works:

1. **Try it:** Follow the [Quickstart Guide](../FREE_MODE_QUICKSTART.md)
2. **Learn patterns:** Read the [Cookbook](../FREE_MODE_COOKBOOK.md)
3. **Quick reference:** Check the [Cheat Sheet](./FREE_MODE_CHEAT_SHEET.md)
4. **Compare modes:** See [FREE vs PAID](./FREE_VS_PAID.md)

**Questions?** See the [main README](../README.md) for more help!
