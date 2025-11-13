# Hybrid Mode Guide

## Overview

The Claude CLI adapter supports **TWO operational modes** to give you flexibility in how you use it:

### FREE Mode (No API Key)
- **Cost:** $0.00
- **What Works:** File operations, code search, terminal commands, single agents
- **What Doesn't Work:** `spawn_agents` (multi-agent orchestration)
- **Use Case:** Simple automation, file manipulation, code analysis
- **No external API calls required**

### PAID Mode (With API Key)
- **Cost:** ~$3-15 per 1M tokens (based on Claude Sonnet 4 pricing)
- **What Works:** Everything including `spawn_agents`
- **Full multi-agent support:** Spawn sub-agents, parallel execution, complex workflows
- **Use Case:** Complex multi-agent orchestration, nested workflows
- **Requires Anthropic API key**

---

## Quick Start

### FREE Mode (Default)

```typescript
import { ClaudeCodeCLIAdapter } from '@codebuff/adapter'

const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  debug: true, // Optional: see mode detection logs
})

// All tools work EXCEPT spawn_agents
// - read_files ✅
// - write_file ✅
// - str_replace ✅
// - code_search ✅
// - find_files ✅
// - run_terminal_command ✅
// - set_output ✅
// - spawn_agents ❌ (requires API key)
```

### PAID Mode (Opt-In)

```typescript
import { ClaudeCodeCLIAdapter } from '@codebuff/adapter'

const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY, // Enable PAID features
  debug: true, // You'll see "API key detected - Full multi-agent support enabled"
})

// ALL tools work including spawn_agents
// - spawn_agents ✅ (multi-agent orchestration)
```

---

## Getting an API Key

### Step 1: Sign Up

1. Go to [https://console.anthropic.com](https://console.anthropic.com)
2. Sign up for an Anthropic account
3. Add payment method (required for API access)

### Step 2: Create API Key

1. Navigate to **Settings** → **API Keys**
2. Click **Create Key**
3. Copy your API key (starts with `sk-ant-...`)
4. Store it securely

### Step 3: Set Environment Variable

**Linux/macOS:**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

**Windows (PowerShell):**
```powershell
$env:ANTHROPIC_API_KEY="sk-ant-..."
```

**Permanent (add to `.bashrc`, `.zshrc`, or `.env` file):**
```bash
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.bashrc
source ~/.bashrc
```

**Using .env file (recommended):**
```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
```

```typescript
// Load from .env
import dotenv from 'dotenv'
dotenv.config()

const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
})
```

---

## Cost Calculator

### Claude Sonnet 4 Pricing (as of 2025)

- **Input:** $3 per 1M tokens
- **Output:** $15 per 1M tokens

### Typical Usage Estimates

| Operation | Tokens | Cost |
|-----------|--------|------|
| Simple file read (1KB) | ~250 input + 100 output | ~$0.002 |
| Code search (10 results) | ~500 input + 200 output | ~$0.005 |
| Spawn 3 agents (complex) | ~10K input + 3K output | ~$0.075 |
| Full workflow (50 steps) | ~100K input + 20K output | ~$0.60 |

**Monthly estimates:**
- Light usage (10 workflows/day): ~$180/month
- Medium usage (50 workflows/day): ~$900/month
- Heavy usage (200 workflows/day): ~$3,600/month

**Cost-saving tips:**
1. Use FREE mode for simple operations
2. Only enable PAID mode when you need `spawn_agents`
3. Optimize prompts to reduce token usage
4. Cache results when possible
5. Use `maxSteps` to limit execution

---

## Feature Comparison

| Feature | FREE Mode | PAID Mode |
|---------|-----------|-----------|
| **File Operations** |
| read_files | ✅ | ✅ |
| write_file | ✅ | ✅ |
| str_replace | ✅ | ✅ |
| **Code Search** |
| code_search | ✅ | ✅ |
| find_files | ✅ | ✅ |
| **Terminal** |
| run_terminal_command | ✅ | ✅ |
| **Agent Management** |
| spawn_agents | ❌ | ✅ |
| set_output | ✅ | ✅ |
| **Multi-Agent Features** |
| Parallel agent execution | ❌ | ✅ |
| Sequential agent execution | ❌ | ✅ |
| Nested agents | ❌ | ✅ |
| Complex workflows | ❌ | ✅ |

---

## Usage Patterns

### Pattern 1: FREE Mode Only

Best for simple automation tasks that don't require multi-agent orchestration.

```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  // No API key - FREE mode
})

// Register a simple agent
adapter.registerAgent(fileProcessorAgent)

// Execute agent (no spawn_agents used)
const result = await adapter.executeAgent(
  fileProcessorAgent,
  'Process all TypeScript files'
)
```

### Pattern 2: PAID Mode for Complex Workflows

Best for complex workflows that require spawning multiple agents.

```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY, // PAID mode
})

// Register multiple agents
adapter.registerAgent(orchestratorAgent) // Uses spawn_agents
adapter.registerAgent(fileAnalyzerAgent)
adapter.registerAgent(codeReviewerAgent)

// Execute orchestrator (spawns sub-agents)
const result = await adapter.executeAgent(
  orchestratorAgent,
  'Analyze codebase and generate review'
)
```

### Pattern 3: Hybrid Approach (Recommended)

Start with FREE mode, upgrade to PAID mode only when needed.

```typescript
// Detect if spawn_agents is needed
const needsMultiAgent = workflowRequiresSpawnAgents(userRequest)

const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  // Only use API key if multi-agent is needed
  anthropicApiKey: needsMultiAgent ? process.env.ANTHROPIC_API_KEY : undefined,
})

if (!needsMultiAgent) {
  console.log('Running in FREE mode - no costs incurred')
} else {
  console.log('Running in PAID mode - multi-agent support enabled')
}
```

### Pattern 4: Graceful Fallback

Handle cases where API key is not available.

```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY, // May be undefined
})

// Check if API key is available
if (!adapter.hasApiKeyAvailable()) {
  console.warn('⚠️  Running in FREE mode - spawn_agents disabled')
  console.warn('Set ANTHROPIC_API_KEY to enable multi-agent features')

  // Execute simpler workflow without spawn_agents
  const result = await adapter.executeAgent(simpleAgent, prompt)
} else {
  console.log('✅ PAID mode enabled - full features available')

  // Execute complex workflow with spawn_agents
  const result = await adapter.executeAgent(complexAgent, prompt)
}
```

---

## Error Handling

### What Happens When spawn_agents is Called Without API Key?

The tool will return a descriptive error message:

```
ERROR: spawn_agents requires an Anthropic API key.

This tool is only available in PAID mode.
Set anthropicApiKey in config to enable multi-agent features.

To upgrade:
1. Get an API key from https://console.anthropic.com
2. Set it in your adapter config:
   new ClaudeCodeCLIAdapter({
     cwd: process.cwd(),
     anthropicApiKey: process.env.ANTHROPIC_API_KEY
   })

See HYBRID_MODE_GUIDE.md for more details.
```

This allows your agents to gracefully handle the missing feature and inform users how to upgrade.

---

## Best Practices

### 1. Default to FREE Mode

Always start with FREE mode unless you specifically need multi-agent features.

```typescript
// ✅ Good: FREE by default
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
})

// ❌ Avoid: Always using PAID mode
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY, // Unnecessary cost
})
```

### 2. Use Environment Variables

Never hardcode API keys in your source code.

```typescript
// ✅ Good: Environment variable
anthropicApiKey: process.env.ANTHROPIC_API_KEY

// ❌ Bad: Hardcoded key
anthropicApiKey: "sk-ant-..." // NEVER DO THIS
```

### 3. Enable Debug Logging

Use debug mode to understand which mode is active.

```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  debug: true, // Shows mode detection
})

// Output:
// ✅ API key detected - Full multi-agent support enabled (PAID mode)
// OR
// ℹ️  No API key - Free mode (spawn_agents disabled)
```

### 4. Provide Clear User Feedback

Let users know which mode they're running in.

```typescript
const adapter = new ClaudeCodeCLIAdapter({ cwd: process.cwd() })

if (adapter.hasApiKeyAvailable()) {
  console.log('🚀 Full features enabled (PAID mode)')
} else {
  console.log('🆓 Running in FREE mode (limited features)')
}
```

### 5. Document API Key Requirements

If your agents require spawn_agents, document this clearly.

```typescript
/**
 * Complex Orchestrator Agent
 *
 * ⚠️ REQUIRES PAID MODE:
 * This agent uses spawn_agents which requires an Anthropic API key.
 * Set ANTHROPIC_API_KEY environment variable to use this agent.
 */
export const complexOrchestratorAgent: AgentDefinition = {
  // ...
}
```

---

## Security Considerations

### API Key Storage

1. **Never commit API keys to version control**
   ```bash
   # Add to .gitignore
   .env
   .env.local
   ```

2. **Use environment variables**
   ```typescript
   anthropicApiKey: process.env.ANTHROPIC_API_KEY
   ```

3. **Rotate keys regularly**
   - Generate new keys monthly
   - Revoke old keys in Anthropic console

4. **Use different keys for different environments**
   ```bash
   # Development
   ANTHROPIC_API_KEY_DEV=sk-ant-dev-...

   # Production
   ANTHROPIC_API_KEY_PROD=sk-ant-prod-...
   ```

### Cost Controls

1. **Set spending limits** in Anthropic console
2. **Monitor usage** via Anthropic dashboard
3. **Use `maxSteps`** to prevent runaway costs

```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  maxSteps: 50, // Limit execution to prevent excessive costs
})
```

---

## Migration Guide

### From FREE to PAID

1. **Get an API key** (see "Getting an API Key" section)
2. **Set environment variable**
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   ```
3. **Update adapter configuration**
   ```typescript
   const adapter = new ClaudeCodeCLIAdapter({
     cwd: process.cwd(),
     anthropicApiKey: process.env.ANTHROPIC_API_KEY, // Add this line
   })
   ```
4. **Test with spawn_agents**
   ```typescript
   // This will now work!
   const result = await adapter.executeAgent(multiAgentWorkflow, prompt)
   ```

### From PAID to FREE

1. **Remove API key** from configuration
   ```typescript
   const adapter = new ClaudeCodeCLIAdapter({
     cwd: process.cwd(),
     // anthropicApiKey: process.env.ANTHROPIC_API_KEY, // Remove this
   })
   ```
2. **Ensure agents don't use spawn_agents**
   - Refactor workflows to use single agents
   - Or provide fallback behavior

---

## Troubleshooting

### Issue: "spawn_agents requires an Anthropic API key"

**Cause:** Agent tried to use spawn_agents in FREE mode

**Solution:**
1. Set `ANTHROPIC_API_KEY` environment variable
2. OR refactor agent to not use spawn_agents

### Issue: "LLM invocation requires Anthropic API key"

**Cause:** Agent execution requires LLM but no API key provided

**Solution:**
1. Provide API key in configuration
2. OR use agents that don't require LLM invocation

### Issue: API Key Not Detected

**Cause:** Environment variable not set or adapter not configured

**Solution:**
```bash
# Check if environment variable is set
echo $ANTHROPIC_API_KEY

# Set it if missing
export ANTHROPIC_API_KEY="sk-ant-..."

# Verify in code
console.log('API Key:', process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET')
```

### Issue: Unexpected Costs

**Cause:** Running complex workflows in PAID mode

**Solution:**
1. Review usage in Anthropic console
2. Set spending limits
3. Use FREE mode when possible
4. Reduce `maxSteps` to limit execution

---

## FAQ

### Q: Can I mix FREE and PAID mode in the same application?

**A:** Yes! Create separate adapter instances:

```typescript
const freeAdapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  // No API key
})

const paidAdapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
})

// Use freeAdapter for simple tasks
// Use paidAdapter for complex workflows
```

### Q: What happens if I run out of API credits?

**A:** The Anthropic API will return an error. Handle it gracefully:

```typescript
try {
  const result = await adapter.executeAgent(agent, prompt)
} catch (error) {
  if (error.message.includes('insufficient credits')) {
    console.error('Out of API credits. Please add funds to your Anthropic account.')
  }
}
```

### Q: Can I use a different AI provider?

**A:** Currently, only Anthropic API is supported for PAID mode. FREE mode works without any AI provider.

### Q: Is my data sent to external servers in FREE mode?

**A:** No! FREE mode uses only local operations. No data is sent to external APIs.

### Q: How do I track costs?

**A:**
1. Use the Anthropic console dashboard
2. Enable debug logging to see token usage
3. Implement custom logging:

```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  debug: true,
  logger: (msg) => {
    console.log(msg)
    // Also log to file for cost tracking
    fs.appendFileSync('usage.log', msg + '\n')
  },
})
```

---

## Summary

- **FREE Mode:** Perfect for simple automation, zero cost, no API key needed
- **PAID Mode:** Required for multi-agent features, costs ~$3-15 per 1M tokens
- **Default to FREE:** Only upgrade to PAID when you need spawn_agents
- **Security First:** Never commit API keys, use environment variables
- **Monitor Costs:** Track usage, set limits, optimize workflows

For more information, see:
- [Anthropic Pricing](https://www.anthropic.com/pricing)
- [Anthropic API Documentation](https://docs.anthropic.com/)
- [README.md](./README.md)
