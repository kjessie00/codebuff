# Migration Guide

Complete guide to migrating agents to the Claude Code CLI Adapter.

## Table of Contents

- [Migrating from Codebuff](#migrating-from-codebuff)
- [Migrating from Other Tools](#migrating-from-other-tools)
- [Upgrading from FREE to PAID](#upgrading-from-free-to-paid)
- [Breaking Changes](#breaking-changes)
- [Version Compatibility](#version-compatibility)

## Migrating from Codebuff

### Overview

The Claude Code CLI Adapter is **100% compatible** with Codebuff `AgentDefinition` types. Most agents can be migrated with minimal or no code changes.

**Migration Effort:**
- Simple agents (no spawn_agents): 5-15 minutes
- Complex agents (with spawn_agents): 30-60 minutes
- Full project migration: 1-2 hours

**Compatibility:**
- ✅ All `AgentDefinition` properties
- ✅ `handleSteps` generators
- ✅ File operations tools
- ✅ Code search tools
- ✅ Terminal commands
- ⚠️ `spawn_agents` requires PAID mode or refactoring

### Step-by-Step Migration

#### Step 1: Install the Adapter

```bash
# Navigate to adapter directory
cd adapter

# Install dependencies
npm install

# Build the adapter
npm run build

# Verify installation
npm run type-check
```

**Verify it works:**
```bash
node -e "const { createAdapter } = require('./dist'); console.log('✓ Adapter installed')"
```

#### Step 2: Update Imports

**Before (Codebuff):**
```typescript
import { executeAgent } from '@codebuff/runtime'
import type { AgentDefinition } from '@codebuff/types'
```

**After (Adapter):**
```typescript
import { createAdapter } from '@codebuff/adapter'
import type { AgentDefinition } from '../.agents/types/agent-definition'
```

**If you have many files:**
```bash
# Find and replace across project
grep -r "from '@codebuff/runtime'" --include="*.ts" | wc -l

# Use your editor's find-and-replace
# Or use sed:
find . -name "*.ts" -exec sed -i '' 's/@codebuff\/runtime/@codebuff\/adapter/g' {} \;
```

#### Step 3: Replace Execution Environment

**Before (Codebuff with OpenRouter):**
```typescript
import { executeAgent } from '@codebuff/runtime'

async function runAgent() {
  const result = await executeAgent(
    myAgent,
    'Find TypeScript files',
    {
      apiKey: process.env.OPENROUTER_API_KEY,
      model: 'anthropic/claude-sonnet-4.5'
    }
  )

  console.log('Output:', result.output)
}
```

**After (Adapter - FREE Mode):**
```typescript
import { createAdapter } from '@codebuff/adapter'

async function runAgent() {
  // Create adapter once
  const adapter = createAdapter(process.cwd())

  // Register agent
  adapter.registerAgent(myAgent)

  // Execute agent (no API key needed)
  const result = await adapter.executeAgent(
    myAgent,
    'Find TypeScript files'
  )

  console.log('Output:', result.output)
}
```

**After (Adapter - PAID Mode):**
```typescript
import { ClaudeCodeCLIAdapter } from '@codebuff/adapter'

async function runAgent() {
  // Create adapter with API key
  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY
  })

  adapter.registerAgent(myAgent)

  const result = await adapter.executeAgent(
    myAgent,
    'Find TypeScript files'
  )

  console.log('Output:', result.output)
}
```

#### Step 4: Update Agent Registration

**Before (Codebuff):**
```typescript
// Agents auto-discovered from .agents/ directory
// No explicit registration needed
```

**After (Adapter):**
```typescript
// Must explicitly register agents
import { filePickerAgent } from './.agents/file-picker'
import { codeReviewerAgent } from './.agents/code-reviewer'

const adapter = createAdapter(process.cwd())

// Register individually
adapter.registerAgent(filePickerAgent)
adapter.registerAgent(codeReviewerAgent)

// Or batch register
adapter.registerAgents([
  filePickerAgent,
  codeReviewerAgent
])
```

**Create registration helper:**
```typescript
// src/agents/index.ts
import { filePickerAgent } from './file-picker'
import { codeReviewerAgent } from './code-reviewer'
import { thinkerAgent } from './thinker'

export const allAgents = [
  filePickerAgent,
  codeReviewerAgent,
  thinkerAgent
]

// src/main.ts
import { createAdapter } from '@codebuff/adapter'
import { allAgents } from './agents'

const adapter = createAdapter(process.cwd())
adapter.registerAgents(allAgents)
```

#### Step 5: Handle spawn_agents (If Used)

**Option A: Upgrade to PAID Mode** (Recommended if you use spawn_agents frequently)

```typescript
// Enable PAID mode
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY
})

// Your spawn_agents code works unchanged!
handleSteps: function* () {
  const { toolResult } = yield {
    toolName: 'spawn_agents',
    input: {
      agents: [
        { agent_type: 'file-picker', params: { pattern: '*.ts' } },
        { agent_type: 'code-reviewer', prompt: 'Review files' }
      ]
    }
  }

  yield {
    toolName: 'set_output',
    input: { output: toolResult[0].value }
  }
}
```

**Option B: Refactor to Sequential Execution** (FREE mode)

```typescript
// Before: Parallel with spawn_agents
handleSteps: function* () {
  const { toolResult } = yield {
    toolName: 'spawn_agents',
    input: {
      agents: [
        { agent_type: 'finder', params: { pattern: '*.ts' } },
        { agent_type: 'analyzer', prompt: 'Analyze' }
      ]
    }
  }

  yield {
    toolName: 'set_output',
    input: { output: toolResult[0].value }
  }
}

// After: Sequential execution
async function runWorkflow(adapter) {
  // Execute agents sequentially
  const findResult = await adapter.executeAgent(
    finderAgent,
    'Find files',
    { pattern: '*.ts' }
  )

  const analyzeResult = await adapter.executeAgent(
    analyzerAgent,
    'Analyze',
    { files: findResult.output }
  )

  return analyzeResult.output
}
```

**Option C: Use Direct Tool Calls** (FREE mode)

```typescript
// Before: Using sub-agents
handleSteps: function* () {
  const { toolResult } = yield {
    toolName: 'spawn_agents',
    input: {
      agents: [
        { agent_type: 'finder', params: { pattern: '*.ts' } }
      ]
    }
  }
}

// After: Direct tool calls
handleSteps: function* () {
  // Do the work directly without sub-agents
  const { toolResult } = yield {
    toolName: 'find_files',
    input: { pattern: '*.ts' }
  }

  const { toolResult: readResult } = yield {
    toolName: 'read_files',
    input: { paths: toolResult[0].value }
  }

  yield {
    toolName: 'set_output',
    input: { output: readResult[0].value }
  }
}
```

#### Step 6: Update Timeouts (If Needed)

**Before (Codebuff):**
- Default timeouts automatically adjusted
- Parallel execution reduces total time

**After (Adapter):**
- Sequential spawn_agents may take longer
- Increase maxSteps if needed

```typescript
// If agent has many steps
const adapter = createAdapter(process.cwd(), {
  maxSteps: 50 // Increase from default 20
})

// If terminal commands are slow
handleSteps: function* () {
  yield {
    toolName: 'run_terminal_command',
    input: {
      command: 'npm install',
      timeout_seconds: 300 // 5 minutes
    }
  }
}
```

#### Step 7: Test Your Migration

**Create test script:**
```typescript
// test-migration.ts
import { createDebugAdapter } from '@codebuff/adapter'
import { allAgents } from './agents'

async function testMigration() {
  console.log('=== Testing Migration ===\n')

  const adapter = createDebugAdapter(process.cwd())

  // Register all agents
  adapter.registerAgents(allAgents)
  console.log(`✓ Registered ${allAgents.length} agents\n`)

  // Test each agent
  for (const agent of allAgents) {
    console.log(`Testing agent: ${agent.id}`)

    try {
      const result = await adapter.executeAgent(
        agent,
        'Migration test'
      )

      console.log(`✓ ${agent.id} completed`)
      console.log(`  Output:`, result.output)
      console.log(`  Iterations:`, result.metadata?.iterationCount)
      console.log()
    } catch (error) {
      console.error(`✗ ${agent.id} failed:`, error.message)
      console.error()
    }
  }

  console.log('=== Migration Test Complete ===')
}

testMigration()
```

**Run tests:**
```bash
npx tsx test-migration.ts
```

### Migration Checklist

Use this checklist to track your migration:

**Setup:**
- [ ] Install adapter dependencies (`npm install`)
- [ ] Build adapter (`npm run build`)
- [ ] Verify installation (`npm run type-check`)

**Code Changes:**
- [ ] Update imports (replace `@codebuff/runtime` with `@codebuff/adapter`)
- [ ] Replace `executeAgent` with adapter pattern
- [ ] Add agent registration code
- [ ] Update spawn_agents usage (if applicable)

**Testing:**
- [ ] Test each agent in isolation
- [ ] Test agent workflows
- [ ] Test error handling
- [ ] Test file operations
- [ ] Test terminal commands
- [ ] Verify outputs match expected results

**Performance:**
- [ ] Profile agent execution times
- [ ] Adjust timeouts if needed
- [ ] Increase maxSteps if needed
- [ ] Optimize slow operations

**Documentation:**
- [ ] Update README with new execution method
- [ ] Update examples
- [ ] Document any breaking changes
- [ ] Update deployment scripts

**Deployment:**
- [ ] Test in staging environment
- [ ] Update CI/CD pipelines
- [ ] Update environment variables
- [ ] Deploy to production

### Common Migration Issues

#### Issue 1: "Agent not found in registry"

**Error:**
```
{
  agentType: 'file-picker',
  value: { errorMessage: 'Agent not found in registry: file-picker' }
}
```

**Cause:** Forgot to register agent before using it

**Solution:**
```typescript
// Make sure to register before executing
adapter.registerAgent(filePickerAgent)

// Verify registration
const agentIds = adapter.listAgents()
console.log('Registered agents:', agentIds)

// Then execute
const result = await adapter.executeAgent(filePickerAgent, 'Test')
```

#### Issue 2: "spawn_agents requires an Anthropic API key"

**Error:**
```
Error: spawn_agents tool requires an Anthropic API key in PAID mode
```

**Cause:** Using spawn_agents in FREE mode

**Solution 1: Upgrade to PAID mode**
```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY
})
```

**Solution 2: Refactor to not use spawn_agents** (see Step 5 above)

#### Issue 3: Timeouts

**Error:**
```
MaxIterationsError: HandleSteps execution exceeded maximum iterations (100)
```

**Cause:** Sequential execution takes more steps than parallel

**Solution:**
```typescript
// Increase maxSteps
const adapter = createAdapter(process.cwd(), {
  maxSteps: 50 // or 100
})
```

#### Issue 4: Import Errors

**Error:**
```
Cannot find module '@codebuff/adapter'
```

**Cause:** Adapter not built or not in node_modules

**Solution:**
```bash
cd adapter
npm run build

# Or link for development
npm link
cd ../your-project
npm link @codebuff/adapter
```

#### Issue 5: Type Errors

**Error:**
```
Type 'AgentDefinition' is not assignable to type 'AgentDefinition'
```

**Cause:** Using different type definitions

**Solution:**
```typescript
// Use adapter's types
import type { AgentDefinition } from '../.agents/types/agent-definition'

// Not from old Codebuff package
// import type { AgentDefinition } from '@codebuff/types' // ❌
```

### Migration Examples

#### Example 1: Simple File Agent

**Before (Codebuff):**
```typescript
import { executeAgent } from '@codebuff/runtime'

const fileAgent = {
  id: 'file-reader',
  displayName: 'File Reader',
  toolNames: ['read_files', 'set_output'],
  handleSteps: function* ({ params }) {
    const { toolResult } = yield {
      toolName: 'read_files',
      input: { paths: params.files }
    }

    yield {
      toolName: 'set_output',
      input: { output: toolResult[0].value }
    }
  }
}

async function main() {
  const result = await executeAgent(
    fileAgent,
    'Read files',
    { files: ['package.json'] }
  )

  console.log(result.output)
}

main()
```

**After (Adapter):**
```typescript
import { createAdapter } from '@codebuff/adapter'

const fileAgent = {
  id: 'file-reader',
  displayName: 'File Reader',
  toolNames: ['read_files', 'set_output'],
  handleSteps: function* ({ params }) {
    const { toolResult } = yield {
      toolName: 'read_files',
      input: { paths: params.files }
    }

    yield {
      toolName: 'set_output',
      input: { output: toolResult[0].value }
    }
  }
}

async function main() {
  const adapter = createAdapter(process.cwd())
  adapter.registerAgent(fileAgent)

  const result = await adapter.executeAgent(
    fileAgent,
    'Read files',
    { files: ['package.json'] }
  )

  console.log(result.output)
}

main()
```

**Changes:**
- Import changed
- Added adapter creation
- Added agent registration
- Agent definition unchanged ✓

#### Example 2: Multi-Agent Orchestrator

**Before (Codebuff):**
```typescript
const orchestrator = {
  id: 'orchestrator',
  toolNames: ['spawn_agents', 'set_output'],
  handleSteps: function* () {
    const { toolResult } = yield {
      toolName: 'spawn_agents',
      input: {
        agents: [
          { agent_type: 'finder', params: { pattern: '*.ts' } },
          { agent_type: 'analyzer', prompt: 'Analyze code' }
        ]
      }
    }

    yield {
      toolName: 'set_output',
      input: { output: toolResult[0].value }
    }
  }
}
```

**After (Adapter - Option 1: PAID Mode):**
```typescript
// Same code, just enable PAID mode!
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY
})

adapter.registerAgent(orchestrator)
// Works unchanged!
```

**After (Adapter - Option 2: FREE Mode Refactor):**
```typescript
// Remove orchestrator, use direct calls
async function runWorkflow() {
  const adapter = createAdapter(process.cwd())

  adapter.registerAgent(finderAgent)
  adapter.registerAgent(analyzerAgent)

  // Execute sequentially
  const findResult = await adapter.executeAgent(
    finderAgent,
    'Find files',
    { pattern: '*.ts' }
  )

  const analyzeResult = await adapter.executeAgent(
    analyzerAgent,
    'Analyze code',
    { files: findResult.output }
  )

  return analyzeResult.output
}
```

## Migrating from Other Tools

### From LangChain

**LangChain Agent:**
```python
from langchain.agents import create_openai_tools_agent

agent = create_openai_tools_agent(llm, tools, prompt)
result = agent.invoke({"input": "Find files"})
```

**Adapter Equivalent:**
```typescript
const agent: AgentDefinition = {
  id: 'file-finder',
  toolNames: ['find_files', 'set_output'],
  handleSteps: function* ({ prompt }) {
    const { toolResult } = yield {
      toolName: 'find_files',
      input: { pattern: '*.ts' }
    }

    yield {
      toolName: 'set_output',
      input: { output: toolResult[0].value }
    }
  }
}

const adapter = createAdapter(process.cwd())
adapter.registerAgent(agent)
const result = await adapter.executeAgent(agent, 'Find files')
```

**Key Differences:**
- LangChain: Python-based, uses OpenAI API
- Adapter: TypeScript-based, FREE mode or Anthropic API
- LangChain: Autonomous agents
- Adapter: Explicit step control (handleSteps)

### From AutoGPT

**AutoGPT:**
```python
from autogpt import Agent

agent = Agent(
    name="FileAgent",
    role="Find and analyze files"
)

result = agent.run("Find TypeScript files")
```

**Adapter Equivalent:**
```typescript
const fileAgent: AgentDefinition = {
  id: 'file-agent',
  displayName: 'File Agent',
  systemPrompt: 'Find and analyze files',
  toolNames: ['find_files', 'read_files', 'set_output'],
  handleSteps: function* ({ prompt }) {
    // Find files
    const { toolResult: findResult } = yield {
      toolName: 'find_files',
      input: { pattern: '**/*.ts' }
    }

    // Read files
    const { toolResult: readResult } = yield {
      toolName: 'read_files',
      input: { paths: findResult[0].value }
    }

    // Return results
    yield {
      toolName: 'set_output',
      input: { output: readResult[0].value }
    }
  }
}

const adapter = createAdapter(process.cwd())
adapter.registerAgent(fileAgent)
const result = await adapter.executeAgent(fileAgent, 'Find TypeScript files')
```

**Key Differences:**
- AutoGPT: Fully autonomous
- Adapter: Explicit control flow
- AutoGPT: Uses GPT-4
- Adapter: FREE mode (no LLM) or Claude
- AutoGPT: Memory and planning
- Adapter: State via agentState

## Upgrading from FREE to PAID

### When to Upgrade

**Upgrade if you need:**
- Multi-agent orchestration (`spawn_agents`)
- Parallel agent execution
- Hierarchical agent workflows
- Complex agent coordination

**Stay on FREE if:**
- File operations are sufficient
- Single agent execution works
- Zero cost is important
- Local processing preferred

### How to Upgrade

**Step 1: Get API Key**

1. Go to https://console.anthropic.com
2. Sign up or log in
3. Navigate to Settings → API Keys
4. Create new key (starts with `sk-ant-...`)

**Step 2: Set Environment Variable**

```bash
# Linux/macOS
export ANTHROPIC_API_KEY="sk-ant-..."

# Windows (PowerShell)
$env:ANTHROPIC_API_KEY="sk-ant-..."

# Or in .env file
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env
```

**Step 3: Update Adapter Creation**

```typescript
// Before (FREE mode)
const adapter = createAdapter(process.cwd())

// After (PAID mode)
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY
})
```

**That's it!** Your agents now have full capabilities.

### Cost Estimation

**PAID Mode Pricing:**
- Claude Sonnet 4: ~$3 per 1M input tokens, ~$15 per 1M output tokens
- Typical agent session: 1K-10K tokens
- Estimated cost per session: $0.01-$0.20

**Example Costs:**

```typescript
// Small task: Find and read 10 files
// Input: ~500 tokens, Output: ~1000 tokens
// Cost: ~$0.02

// Medium task: Analyze 100 files
// Input: ~2000 tokens, Output: ~5000 tokens
// Cost: ~$0.08

// Large task: Full codebase refactoring
// Input: ~10000 tokens, Output: ~20000 tokens
// Cost: ~$0.40
```

**Cost Control:**

```typescript
// Limit token usage
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  maxSteps: 20 // Limit iterations
})

// Use FREE mode for simple operations
const freeAdapter = createAdapter(process.cwd())
const files = await freeAdapter.executeAgent(finder, 'Find files')

// Only use PAID for complex orchestration
const paidAdapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY
})
const analysis = await paidAdapter.executeAgent(orchestrator, 'Analyze', { files })
```

### Hybrid Approach

**Use both modes strategically:**

```typescript
class AgentManager {
  private freeAdapter: ClaudeCodeCLIAdapter
  private paidAdapter: ClaudeCodeCLIAdapter

  constructor() {
    // FREE mode for simple operations
    this.freeAdapter = createAdapter(process.cwd())

    // PAID mode for complex operations
    this.paidAdapter = new ClaudeCodeCLIAdapter({
      cwd: process.cwd(),
      anthropicApiKey: process.env.ANTHROPIC_API_KEY
    })
  }

  async executeSimple(agent, prompt, params) {
    // Use FREE mode
    return await this.freeAdapter.executeAgent(agent, prompt, params)
  }

  async executeComplex(agent, prompt, params) {
    // Use PAID mode
    return await this.paidAdapter.executeAgent(agent, prompt, params)
  }

  async executeWorkflow() {
    // Use FREE for file operations
    const files = await this.executeSimple(
      fileFinderAgent,
      'Find files'
    )

    // Use PAID for multi-agent orchestration
    const analysis = await this.executeComplex(
      orchestratorAgent,
      'Analyze files',
      { files }
    )

    return analysis
  }
}
```

## Breaking Changes

### Version 1.0.0

**Breaking changes from Codebuff:**

1. **Agent Registration Required**
   ```typescript
   // Before: Auto-discovery
   // After: Explicit registration
   adapter.registerAgent(myAgent)
   ```

2. **spawn_agents Requires PAID Mode**
   ```typescript
   // Before: Always available
   // After: Requires API key or refactoring
   ```

3. **Sequential spawn_agents Execution**
   ```typescript
   // Before: Parallel by default
   // After: Sequential (unless PAID mode)
   ```

4. **Import Paths Changed**
   ```typescript
   // Before: '@codebuff/runtime'
   // After: '@codebuff/adapter'
   ```

**Non-breaking changes:**
- ✅ AgentDefinition type unchanged
- ✅ handleSteps pattern unchanged
- ✅ Tool names unchanged
- ✅ Tool parameters unchanged

## Version Compatibility

### Adapter Versions

**Version 1.0.0 (Current):**
- Node.js 18.0.0+
- TypeScript 5.6.0+
- Bun 1.0+ (optional)

**Codebuff Compatibility:**
- ✅ Codebuff v2.x agents
- ✅ Codebuff v1.x agents (with minor updates)

### Node.js Compatibility

```json
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Tested on:**
- Node.js 18.17.0 LTS
- Node.js 20.10.0 LTS
- Node.js 21.5.0 (latest)

### TypeScript Compatibility

**Required:**
- TypeScript 5.6.0 or higher

**Features used:**
- Generator types
- Async iterators
- Template literal types
- Conditional types

### Platform Compatibility

**Supported:**
- ✅ macOS 11+ (Intel and Apple Silicon)
- ✅ Linux (Ubuntu 20.04+, Debian 11+, Fedora 35+)
- ✅ Windows 10/11 (with WSL recommended)

**Tool Requirements:**
- ripgrep (for code_search)
  - macOS: `brew install ripgrep`
  - Linux: `apt-get install ripgrep`
  - Windows: `choco install ripgrep`

---

## Migration Support

### Need Help?

**Documentation:**
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues
- [FAQ_FREE_MODE.md](./FAQ_FREE_MODE.md) - Frequently asked questions
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Testing your migration

**Examples:**
- [examples/](../examples/) - Working code examples
- Test files in [src/tools/*.test.ts](../src/tools/)

**Community:**
- GitHub Issues: Report migration problems
- Discussions: Ask questions

### Migration Checklist Download

Save this checklist for your migration:

```markdown
# Migration Checklist

## Pre-Migration
- [ ] Read migration guide
- [ ] Backup current code
- [ ] List all agents to migrate
- [ ] Identify spawn_agents usage
- [ ] Plan testing strategy

## Installation
- [ ] Install adapter
- [ ] Build adapter
- [ ] Verify installation

## Code Changes
- [ ] Update imports
- [ ] Add adapter creation
- [ ] Add agent registration
- [ ] Handle spawn_agents
- [ ] Update timeouts

## Testing
- [ ] Test simple agents
- [ ] Test complex workflows
- [ ] Test error handling
- [ ] Performance testing
- [ ] Integration testing

## Deployment
- [ ] Update documentation
- [ ] Update CI/CD
- [ ] Deploy to staging
- [ ] Monitor for issues
- [ ] Deploy to production

## Post-Migration
- [ ] Monitor performance
- [ ] Track errors
- [ ] Gather feedback
- [ ] Optimize as needed
```

Good luck with your migration!
