# 🆚 FREE Mode vs PAID Mode

Detailed comparison to help you choose the right mode for your needs.

---

## 📊 At a Glance

| Feature | FREE Mode | PAID Mode |
|---------|-----------|-----------|
| **💰 Cost** | $0.00 | ~$3-15 per 1M tokens |
| **🔑 API Key** | Not needed | Required (Anthropic) |
| **🔒 Privacy** | 100% local | Uses Anthropic API |
| **🚀 Setup Time** | < 1 minute | ~5 minutes (get API key) |
| **📦 File Operations** | ✅ Full support | ✅ Full support |
| **🔍 Code Search** | ✅ Full support | ✅ Full support |
| **💻 Terminal Commands** | ✅ Full support | ✅ Full support |
| **🤖 Single Agents** | ✅ Full support | ✅ Full support |
| **🔄 Multi-Agent (spawn_agents)** | ❌ Not available | ✅ Full support |
| **⚡ Parallel Execution** | N/A | ✅ Sequential |
| **🏗️ Nested Workflows** | N/A | ✅ Unlimited depth |
| **📈 Scalability** | High (local) | Very high (API) |
| **🌐 Internet Required** | No | Yes (for API) |

---

## 💰 Detailed Cost Analysis

### FREE Mode Costs

```
┌─────────────────────────────────────────────────────────────┐
│                    FREE MODE - $0.00                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Setup:                           $0.00                     │
│  Per agent execution:             $0.00                     │
│  File operations (unlimited):     $0.00                     │
│  Code search (unlimited):         $0.00                     │
│  Terminal commands (unlimited):   $0.00                     │
│                                                             │
│  Monthly cost (any usage):        $0.00                     │
│  Annual cost:                     $0.00                     │
│                                                             │
│  ✅ Perfect for:                                            │
│     • Learning and experimentation                          │
│     • File automation                                       │
│     • Code analysis                                         │
│     • Build scripts                                         │
│     • Solo projects                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### PAID Mode Costs

```
┌─────────────────────────────────────────────────────────────┐
│                 PAID MODE - Variable Cost                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Claude Sonnet 4 Pricing (2025):                            │
│    Input:   $3 per 1M tokens                                │
│    Output:  $15 per 1M tokens                               │
│                                                             │
│  Typical Operations:                                        │
│    Simple file read (1KB):        ~$0.002                   │
│    Code search (10 results):      ~$0.005                   │
│    Spawn 3 agents (complex):      ~$0.075                   │
│    Full workflow (50 steps):      ~$0.60                    │
│                                                             │
│  Monthly Estimates:                                         │
│    Light (10 workflows/day):      ~$180/month               │
│    Medium (50 workflows/day):     ~$900/month               │
│    Heavy (200 workflows/day):     ~$3,600/month             │
│                                                             │
│  ✅ Perfect for:                                            │
│     • Multi-agent orchestration                             │
│     • Complex workflows                                     │
│     • Team collaboration                                    │
│     • Production systems                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Cost Comparison Examples

| Use Case | FREE Mode | PAID Mode | Recommendation |
|----------|-----------|-----------|----------------|
| Read 100 files daily | $0.00 | ~$0.60/day | ✅ Use FREE |
| Search codebase 50x/day | $0.00 | ~$0.25/day | ✅ Use FREE |
| Run build automation | $0.00 | ~$0.10/build | ✅ Use FREE |
| Spawn 5 agents/workflow | ❌ Not available | ~$0.375/workflow | Use PAID |
| Complex orchestration | ❌ Not available | ~$2.50/workflow | Use PAID |

---

## 🛠️ Feature Comparison

### File Operations

| Feature | FREE | PAID | Notes |
|---------|------|------|-------|
| `read_files` | ✅ | ✅ | Identical functionality |
| `write_file` | ✅ | ✅ | Identical functionality |
| `str_replace` | ✅ | ✅ | Identical functionality |
| Batch operations | ✅ | ✅ | Read/write multiple files |
| Path safety | ✅ | ✅ | Traversal protection |
| UTF-8 support | ✅ | ✅ | Full Unicode support |
| Auto-create dirs | ✅ | ✅ | Parent dirs created |

**Verdict:** ✅ **Both modes are identical for file operations**

---

### Code Search

| Feature | FREE | PAID | Notes |
|---------|------|------|-------|
| `code_search` | ✅ | ✅ | Identical functionality |
| `find_files` | ✅ | ✅ | Identical functionality |
| Regex patterns | ✅ | ✅ | Full regex support |
| Glob patterns | ✅ | ✅ | Standard glob syntax |
| Case sensitivity | ✅ | ✅ | Configurable |
| Result limiting | ✅ | ✅ | `maxResults` parameter |
| Context lines | ✅ | ✅ | Before/after lines |

**Verdict:** ✅ **Both modes are identical for code search**

---

### Terminal Commands

| Feature | FREE | PAID | Notes |
|---------|------|------|-------|
| `run_terminal_command` | ✅ | ✅ | Identical functionality |
| Custom timeout | ✅ | ✅ | Up to 600 seconds |
| Streaming output | ✅ | ✅ | Real-time output |
| Exit codes | ✅ | ✅ | Success/failure detection |
| Working directory | ✅ | ✅ | Configurable cwd |
| Environment vars | ✅ | ✅ | Custom env support |

**Verdict:** ✅ **Both modes are identical for terminal commands**

---

### Multi-Agent Orchestration

| Feature | FREE | PAID | Notes |
|---------|------|------|-------|
| `spawn_agents` | ❌ | ✅ | **PAID only** |
| Parallel agents | ❌ | ⚠️ | Sequential execution |
| Nested spawning | ❌ | ✅ | Unlimited depth |
| Agent parameters | ❌ | ✅ | Pass custom params |
| Result aggregation | ❌ | ✅ | Collect all results |
| Error handling | ❌ | ✅ | Per-agent errors |
| Context sharing | ❌ | ✅ | Inherited context |

**Verdict:** ⚠️ **PAID mode required for multi-agent workflows**

**Note:** This is the **ONLY** feature that requires PAID mode!

---

## 🎯 When to Use Each Mode

### ✅ Use FREE Mode When:

**Perfect Scenarios:**

1. **Learning & Experimentation**
   - You're new to the adapter
   - Testing ideas and patterns
   - Building proof-of-concepts
   - Educational projects

2. **File Automation**
   - Batch file processing
   - Configuration updates
   - Code generation
   - File organization

3. **Code Analysis**
   - Finding TODOs/FIXMEs
   - Analyzing patterns
   - Generating reports
   - Code metrics

4. **Build Automation**
   - Running tests
   - Building projects
   - Deployment scripts
   - CI/CD tasks

5. **Solo Projects**
   - Personal tools
   - Side projects
   - Open source contributions
   - Internal tools

6. **Privacy-Sensitive Work**
   - Confidential codebases
   - Proprietary code
   - Security-focused projects
   - Offline environments

**Example Use Cases:**
```typescript
// ✅ Perfect for FREE mode
- Read all TypeScript files and generate index
- Find all TODO comments and create report
- Run tests and collect coverage data
- Update version numbers in package.json
- Search for deprecated API usage
- Generate documentation from comments
- Format code files in batch
- Clean up temporary files
```

---

### 💳 Use PAID Mode When:

**Perfect Scenarios:**

1. **Multi-Agent Workflows**
   - Orchestrating multiple specialized agents
   - Parallel task execution
   - Complex nested workflows
   - Agent coordination

2. **Complex Orchestration**
   - Breaking down large tasks
   - Delegating to specialized agents
   - Managing dependencies
   - Coordinating results

3. **Production Systems**
   - Enterprise applications
   - High-volume automation
   - Critical workflows
   - Team collaboration

4. **Advanced Automation**
   - Multi-step pipelines
   - Conditional workflows
   - Dynamic agent spawning
   - Result aggregation

**Example Use Cases:**
```typescript
// 💳 Requires PAID mode
- Orchestrator agent spawning analyzer + reviewer + formatter
- Parallel code review across multiple modules
- Complex workflow: test → analyze → fix → test again
- Multi-agent documentation generation
- Coordinated code refactoring across files
- Distributed analysis with result merging
```

**Key Question:**
> "Do I need multiple agents working together?"
> - **No** → Use FREE mode
> - **Yes** → Use PAID mode

---

## 🔄 Switching Between Modes

### From FREE to PAID

**Why upgrade?**
- You need `spawn_agents` functionality
- Multi-agent workflows required
- Complex orchestration needed

**How to upgrade:**

1. **Get API Key** (5 minutes)
   ```
   1. Go to https://console.anthropic.com
   2. Sign up / Log in
   3. Navigate to Settings → API Keys
   4. Create new key
   5. Copy the key (starts with sk-ant-...)
   ```

2. **Set Environment Variable**
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   ```

3. **Update Code** (1 line change)
   ```typescript
   const adapter = new ClaudeCodeCLIAdapter({
     cwd: process.cwd(),
     anthropicApiKey: process.env.ANTHROPIC_API_KEY,  // 👈 Add this
   })
   ```

4. **Verify**
   ```
   Debug output should show:
   ✅ "API key detected - Full multi-agent support enabled"
   ```

**No other code changes needed!** All your existing agents work identically.

---

### From PAID to FREE

**Why downgrade?**
- Don't need multi-agent features
- Want to reduce costs
- Working on privacy-sensitive code
- Offline development

**How to downgrade:**

1. **Remove API Key from Code**
   ```typescript
   const adapter = new ClaudeCodeCLIAdapter({
     cwd: process.cwd(),
     // anthropicApiKey: process.env.ANTHROPIC_API_KEY,  // 👈 Remove this
   })
   ```

2. **Update Agents**
   - Remove `spawn_agents` from `toolNames`
   - Refactor workflows to single-agent
   - Or keep both modes available

3. **Verify**
   ```
   Debug output should show:
   ℹ️  "No API key - Free mode (spawn_agents disabled)"
   ```

**What stops working:**
- Only `spawn_agents` calls
- Everything else identical

---

## 🔀 Hybrid Approach (Best of Both)

### Strategy: Use Both Modes

**Concept:** Keep both FREE and PAID adapters, choose per task.

```typescript
// Create two adapters
const freeAdapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  // No API key = FREE
})

const paidAdapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,  // PAID
})

// Use FREE for simple tasks
const fileList = await freeAdapter.executeAgent(
  fileFinderAgent,
  'Find all TypeScript files'
)

// Use PAID for complex orchestration
const analysis = await paidAdapter.executeAgent(
  orchestratorAgent,
  'Analyze codebase with multiple agents'
)
```

**Benefits:**
- ✅ Minimize costs (use FREE when possible)
- ✅ Maximum flexibility (use PAID when needed)
- ✅ Easy to switch per task
- ✅ No code duplication

---

### Strategy: Conditional Mode Selection

**Concept:** Detect if spawn_agents is needed, select mode automatically.

```typescript
function createAdapterForTask(needsMultiAgent: boolean) {
  return new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    anthropicApiKey: needsMultiAgent
      ? process.env.ANTHROPIC_API_KEY
      : undefined,
    debug: true
  })
}

// Simple task = FREE
const adapter1 = createAdapterForTask(false)
await adapter1.executeAgent(simpleAgent, 'Simple task')
// Cost: $0.00

// Complex task = PAID
const adapter2 = createAdapterForTask(true)
await adapter2.executeAgent(orchestratorAgent, 'Complex workflow')
// Cost: ~$0.50
```

**Benefits:**
- ✅ Automatic cost optimization
- ✅ Clear decision logic
- ✅ Easy to maintain
- ✅ Scalable

---

## 📈 Scalability Comparison

### FREE Mode Scalability

| Dimension | Capability | Notes |
|-----------|------------|-------|
| **File Operations** | Excellent | Limited by disk I/O |
| **Code Search** | Excellent | Ripgrep is very fast |
| **Terminal Commands** | Good | Depends on command |
| **Memory Usage** | Low | Minimal overhead |
| **Concurrent Executions** | High | Independent processes |
| **Large Repositories** | Excellent | Local file access |
| **Network Dependency** | None | 100% offline |

**Best Performance:**
- Batch file operations
- Large-scale code search
- High-frequency automation
- Local development

---

### PAID Mode Scalability

| Dimension | Capability | Notes |
|-----------|------------|-------|
| **File Operations** | Excellent | Same as FREE |
| **Code Search** | Excellent | Same as FREE |
| **Terminal Commands** | Good | Same as FREE |
| **Multi-Agent Workflows** | Very Good | API rate limits apply |
| **Memory Usage** | Moderate | API overhead |
| **Concurrent Executions** | Good | API concurrency limits |
| **Large Repositories** | Excellent | Same as FREE for files |
| **Network Dependency** | Required | Needs internet |

**Best Performance:**
- Complex orchestration
- Multi-step workflows
- Agent coordination
- Specialized sub-tasks

---

## 🔐 Privacy & Security

### FREE Mode Privacy

```
┌─────────────────────────────────────────────────────────────┐
│                   FREE MODE PRIVACY                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ 100% Local Processing                                   │
│     • No data sent to external servers                      │
│     • No API calls                                          │
│     • No telemetry                                          │
│                                                             │
│  ✅ Your Code Stays Private                                 │
│     • Confidential codebases: Safe                          │
│     • Proprietary code: Safe                                │
│     • Security-sensitive: Safe                              │
│                                                             │
│  ✅ Offline Capable                                         │
│     • Works without internet                                │
│     • Air-gapped environments: OK                           │
│     • Restricted networks: OK                               │
│                                                             │
│  ✅ Compliance Friendly                                     │
│     • GDPR: Compliant (no data transfer)                    │
│     • HIPAA: Suitable for sensitive data                    │
│     • SOC 2: No external dependencies                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### PAID Mode Privacy

```
┌─────────────────────────────────────────────────────────────┐
│                   PAID MODE PRIVACY                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚠️  Uses Anthropic API                                     │
│     • Data sent to Anthropic servers                        │
│     • Industry-standard encryption                          │
│     • See Anthropic Privacy Policy                          │
│                                                             │
│  ✅ Anthropic Security Features                             │
│     • SOC 2 Type II certified                               │
│     • GDPR compliant                                        │
│     • Data encryption in transit & at rest                  │
│     • No training on your data (by default)                 │
│                                                             │
│  ⚠️  Consider Before Using With:                            │
│     • Confidential codebases                                │
│     • Customer data                                         │
│     • Security-sensitive code                               │
│     • Proprietary algorithms                                │
│                                                             │
│  ✅ Best Practices                                          │
│     • Review Anthropic's privacy policy                     │
│     • Use separate API keys per environment                 │
│     • Rotate keys regularly                                 │
│     • Monitor API usage                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Performance Comparison

### Speed Tests (Representative)

| Operation | FREE Mode | PAID Mode | Winner |
|-----------|-----------|-----------|--------|
| Read 10 files | ~50ms | ~50ms | Tie |
| Search 1000 files | ~200ms | ~200ms | Tie |
| Run `npm test` | ~2s | ~2s | Tie |
| Write 50 files | ~100ms | ~100ms | Tie |
| Find files (glob) | ~50ms | ~50ms | Tie |
| Spawn 5 agents | ❌ N/A | ~3s | PAID only |

**Key Insight:**
- **File/Search/Terminal:** Identical speed (both local)
- **Multi-Agent:** Only available in PAID mode

---

## 🎓 Decision Matrix

### Choose FREE Mode If:

- [ ] You don't need `spawn_agents`
- [ ] Working with sensitive/private code
- [ ] Want zero cost
- [ ] Need offline capability
- [ ] Single-agent workflows are sufficient
- [ ] Learning/experimenting
- [ ] Personal projects
- [ ] Build automation
- [ ] File processing
- [ ] Code analysis

**Confidence:** High confidence FREE mode is right for you!

---

### Choose PAID Mode If:

- [ ] You need `spawn_agents` functionality
- [ ] Multi-agent orchestration required
- [ ] Complex nested workflows
- [ ] Parallel task delegation
- [ ] Agent specialization needed
- [ ] Production multi-agent systems
- [ ] Budget allows API costs
- [ ] Internet access available

**Confidence:** PAID mode provides capabilities you need!

---

### Consider Hybrid If:

- [ ] Some tasks need multi-agent, some don't
- [ ] Want to optimize costs
- [ ] Flexible budget
- [ ] Variety of use cases
- [ ] Want maximum flexibility

**Confidence:** Hybrid approach gives you best of both!

---

## 🔄 Migration Path

### Recommended Progression

```
PHASE 1: Start with FREE Mode
  │
  ├─ Learn the basics
  ├─ Build simple agents
  ├─ Experiment with patterns
  └─ Zero cost, zero risk
  │
  ▼
PHASE 2: Evaluate Needs
  │
  ├─ Do I need multi-agent?
  ├─ Will spawn_agents help?
  └─ Is budget available?
  │
  ├─ NO ────► Stay in FREE Mode
  │              • Perfect for most tasks
  │              • Zero cost forever
  │              • Re-evaluate periodically
  │
  └─ YES ───► PHASE 3
      │
      ▼
PHASE 3: Upgrade to PAID
  │
  ├─ Get API key (5 mins)
  ├─ Update config (1 line)
  ├─ Test multi-agent
  └─ Monitor costs
  │
  ▼
PHASE 4: Optimize Usage
  │
  ├─ Use FREE for simple tasks
  ├─ Use PAID for complex workflows
  ├─ Track costs
  └─ Adjust as needed
```

---

## 💡 Pro Tips

### Cost Optimization

**Tip 1: Start FREE, upgrade only when needed**
```typescript
// Start with FREE
const adapter = new ClaudeCodeCLIAdapter({ cwd: process.cwd() })

// Upgrade only specific workflows that need spawn_agents
const paidAdapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
})
```

**Tip 2: Monitor PAID usage**
- Check Anthropic console regularly
- Set spending alerts
- Track cost per workflow
- Optimize token usage

**Tip 3: Refactor to reduce spawn_agents needs**
```typescript
// Instead of spawning agents for simple tasks
// Combine logic in single agent when possible
```

---

### Best Practices

**Tip 4: Use environment variables**
```typescript
// ✅ Good
anthropicApiKey: process.env.ANTHROPIC_API_KEY

// ❌ Bad
anthropicApiKey: "sk-ant-..." // Never hardcode!
```

**Tip 5: Debug mode helps choose mode**
```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  debug: true,  // Shows which mode is active
})
```

**Tip 6: Document mode requirements**
```typescript
/**
 * Complex Orchestrator Agent
 *
 * ⚠️ REQUIRES PAID MODE
 * This agent uses spawn_agents which requires an Anthropic API key.
 */
export const orchestratorAgent: AgentDefinition = { ... }
```

---

## ❓ FAQ

### Can I use both modes in the same application?
**Yes!** Create separate adapter instances for FREE and PAID, use as needed.

### Will my FREE mode agents work in PAID mode?
**Yes!** 100% compatible. All FREE mode code works in PAID mode.

### Will my PAID mode agents work in FREE mode?
**Mostly.** Agents using `spawn_agents` will get error messages, but all other tools work.

### Can I switch modes without code changes?
**Yes!** Just add/remove the `anthropicApiKey` parameter. Your agent code stays the same.

### How do I know which mode I'm in?
**Enable debug mode.** The adapter logs which mode is active at startup.

### Is there a middle option between FREE and PAID?
**No.** It's binary: FREE (no API key) or PAID (with API key).

### Can I use OpenRouter instead of Anthropic?
**No.** Currently only Anthropic API is supported for PAID mode.

### Does FREE mode expire?
**Never!** FREE mode is permanent and will always be free.

### Are there rate limits in FREE mode?
**No API rate limits** (it's all local). System resource limits apply (disk, CPU, memory).

### Are there rate limits in PAID mode?
**Yes.** Anthropic API rate limits apply. See [Anthropic docs](https://docs.anthropic.com/en/api/rate-limits).

---

## 📚 Further Reading

- **[Quickstart Guide](../FREE_MODE_QUICKSTART.md)** - Get started in 5 minutes
- **[Cookbook](../FREE_MODE_COOKBOOK.md)** - 15+ ready-to-use recipes
- **[Visual Guide](./FREE_MODE_VISUAL_GUIDE.md)** - Architecture diagrams
- **[Cheat Sheet](./FREE_MODE_CHEAT_SHEET.md)** - Quick reference
- **[Hybrid Mode Guide](../HYBRID_MODE_GUIDE.md)** - Detailed mode switching
- **[API Reference](../API_REFERENCE.md)** - Complete documentation
- **[Anthropic Pricing](https://www.anthropic.com/pricing)** - Current API costs

---

## 🎯 Summary

### FREE Mode: Perfect for 95% of Use Cases
- ✅ Zero cost
- ✅ 100% local
- ✅ No API key
- ✅ Full file operations
- ✅ Full code search
- ✅ Full terminal access
- ❌ No spawn_agents

### PAID Mode: When You Need Multi-Agent
- 💳 ~$3-15 per 1M tokens
- 🔑 Requires API key
- 🌐 Uses Anthropic API
- ✅ Everything from FREE
- ✅ spawn_agents enabled
- ✅ Complex orchestration

**Start with FREE. Upgrade to PAID only when you need multi-agent capabilities.**

**Questions?** See the [main README](../README.md#faq) or [Hybrid Mode Guide](../HYBRID_MODE_GUIDE.md)!
