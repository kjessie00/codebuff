# 🎥 FREE Mode Tutorial Video Script (5 Minutes)

Complete script for a hands-on video tutorial showing how to use FREE mode.

---

## 📋 Video Metadata

- **Title:** "Claude CLI Adapter FREE Mode: Zero-Cost File Automation in 5 Minutes"
- **Duration:** 5 minutes
- **Target Audience:** Developers new to the adapter
- **Prerequisites:** Node.js installed, basic TypeScript knowledge
- **Format:** Screen recording with voiceover

---

## 🎬 Script

### [0:00 - 0:30] Introduction (30 seconds)

**[SCREEN: Title card with "FREE Mode Tutorial"]**

**VOICEOVER:**
> "Hi! In this 5-minute video, you'll learn how to use the Claude CLI Adapter in FREE mode—that's zero cost, no API key required, and 100% local processing.
>
> By the end of this tutorial, you'll be able to automate file operations, search your codebase, and run terminal commands—all without spending a penny.
>
> Let's get started!"

**[SCREEN: Fade to desktop, open terminal]**

---

### [0:30 - 1:30] Installation (1 minute)

**[SCREEN: Terminal window, prompt visible]**

**VOICEOVER:**
> "First, let's install the adapter. I'm already in my project directory, so I'll navigate to the adapter folder."

**[TYPE]:**
```bash
cd adapter
```

**VOICEOVER:**
> "Now let's install dependencies and build the adapter. This should take about 30 seconds."

**[TYPE]:**
```bash
npm install
```

**[SCREEN: Wait for install to complete, show progress]**

**VOICEOVER:**
> "Great! Dependencies installed. Now let's build."

**[TYPE]:**
```bash
npm run build
```

**[SCREEN: Show build output, successful completion]**

**VOICEOVER:**
> "Perfect! The adapter is now built and ready to use. Notice we didn't need to set up any API keys—that's the beauty of FREE mode."

**[SCREEN: Highlight "Build successful" message]**

---

### [1:30 - 3:00] First Agent (1.5 minutes)

**[SCREEN: Open VS Code or editor]**

**VOICEOVER:**
> "Now let's create our first agent. I'll create a new file called `my-first-agent.ts`."

**[SCREEN: Create new file, show empty editor]**

**VOICEOVER:**
> "We'll start by importing the adapter and types."

**[TYPE]:**
```typescript
import { ClaudeCodeCLIAdapter } from './adapter/src/claude-cli-adapter'
import type { AgentDefinition } from './.agents/types/agent-definition'
```

**VOICEOVER:**
> "Next, we create the adapter instance. Notice I'm not passing an API key—this automatically enables FREE mode."

**[TYPE]:**
```typescript
const adapter = new ClaudeCodeCLIAdapter({
  cwd: process.cwd(),
  debug: true
})
```

**VOICEOVER:**
> "Now for the agent definition. This agent will search for all TypeScript files in our project."

**[TYPE - slowly show each part]:**
```typescript
const fileSearchAgent: AgentDefinition = {
  id: 'file-search',
  displayName: 'File Search Agent',
  toolNames: ['find_files', 'set_output'],

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
```

**VOICEOVER:**
> "Let me explain what's happening here. We define which tools the agent can use—in this case, `find_files` and `set_output`. Both are available in FREE mode.
>
> The `handleSteps` function is where the magic happens. It's a generator function that yields tool calls. First, we call `find_files` to search for TypeScript files, then we set the output with the results."

**[SCREEN: Highlight each section as explained]**

**VOICEOVER:**
> "Finally, let's register and execute our agent."

**[TYPE]:**
```typescript
adapter.registerAgent(fileSearchAgent)

const result = await adapter.executeAgent(
  fileSearchAgent,
  'Find all TypeScript files'
)

console.log('Found files:', result.output)
```

**[SCREEN: Complete code visible]**

---

### [3:00 - 4:00] Running the Agent (1 minute)

**[SCREEN: Switch back to terminal]**

**VOICEOVER:**
> "Now let's run our agent!"

**[TYPE]:**
```bash
npx tsx my-first-agent.ts
```

**[SCREEN: Show execution, pause on important output]**

**VOICEOVER:**
> "Look at the output! First, we see the adapter detected FREE mode—no API key found. Then it executes our agent, calls the `find_files` tool, and returns the results.
>
> We found all TypeScript files in the project, with details about the total count and file paths."

**[SCREEN: Highlight key output lines:]**
```
[ClaudeCodeCLIAdapter] ℹ️  No API key - Free mode (spawn_agents disabled)
[ClaudeCodeCLIAdapter] Starting agent execution: file-search
[HandleStepsExecutor] Executing tool: find_files
Found files: {
  pattern: '**/*.ts',
  files: [ 'src/index.ts', 'src/types.ts', ... ],
  total: 42
}
```

**VOICEOVER:**
> "And that's it! We just created and ran our first FREE mode agent. No API costs, all processing done locally."

---

### [4:00 - 4:45] Quick Examples (45 seconds)

**[SCREEN: Back to editor, show code snippets]**

**VOICEOVER:**
> "Let me show you what else you can do in FREE mode. Want to read files?"

**[SHOW code snippet]:**
```typescript
const { toolResult } = yield {
  toolName: 'read_files',
  input: { paths: ['package.json', 'README.md'] }
}
```

**VOICEOVER:**
> "Search your code?"

**[SHOW code snippet]:**
```typescript
const { toolResult } = yield {
  toolName: 'code_search',
  input: { pattern: 'TODO', filePattern: '*.ts' }
}
```

**VOICEOVER:**
> "Run terminal commands?"

**[SHOW code snippet]:**
```typescript
const { toolResult } = yield {
  toolName: 'run_terminal_command',
  input: { command: 'npm test' }
}
```

**VOICEOVER:**
> "Write files?"

**[SHOW code snippet]:**
```typescript
yield {
  toolName: 'write_file',
  input: {
    path: 'output.txt',
    content: 'Hello, world!'
  }
}
```

**VOICEOVER:**
> "All of these work in FREE mode at zero cost!"

---

### [4:45 - 5:00] Conclusion (15 seconds)

**[SCREEN: Show summary slide]**

**Summary Slide Text:**
```
✅ FREE Mode Unlocked!

What You Learned:
• Install & build the adapter
• Create your first agent
• Use file operations
• Search code
• Run commands

All at $0.00 cost!

Next Steps:
📚 FREE_MODE_COOKBOOK.md - 15+ recipes
📋 FREE_MODE_CHEAT_SHEET.md - Quick reference
🆚 FREE_VS_PAID.md - When to upgrade

Get Started: github.com/your-repo
```

**VOICEOVER:**
> "That's it! You now know how to use FREE mode. Check out the cookbook for 15+ ready-to-use recipes, the cheat sheet for quick reference, and the comparison guide to learn when to upgrade to PAID mode.
>
> Happy coding!"

**[SCREEN: Fade to end card with links]**

---

## 🎬 Production Notes

### Visual Elements

**Timestamps to highlight:**
- 0:30-1:30: Terminal commands and build output
- 1:30-3:00: Code being typed in editor
- 3:00-4:00: Execution output and results
- 4:00-4:45: Code snippets with syntax highlighting

**Screen recordings needed:**
1. Terminal: Install and build process
2. Editor: Writing the agent code
3. Terminal: Running the agent
4. Editor: Quick example snippets

### Code Snippets

All code snippets should:
- Use syntax highlighting
- Be large enough to read (16pt+ font)
- Show proper indentation
- Include comments where helpful

### Callouts/Annotations

**Key points to annotate on screen:**
- "No API key = FREE mode" (when creating adapter)
- "7 tools available" (when showing toolNames)
- "Generator function" (at handleSteps)
- "$0.00 cost" (at conclusion)

### Pacing

- **Slow typing:** When showing new concepts (0:02 per character)
- **Normal typing:** When showing examples (0:01 per character)
- **Fast forward:** Install/build processes (show completion)
- **Pause:** On output screens (2-3 seconds to read)

---

## 📝 Talking Points (Detailed)

### Introduction Points
- Free mode = no cost
- No API key needed
- 100% local processing
- Learn in 5 minutes

### Installation Points
- Simple npm install
- Build takes ~30 seconds
- No configuration needed
- No API key setup

### First Agent Points
- Import adapter and types
- Create adapter (no API key)
- Define agent with tools
- handleSteps is a generator
- yield = execute tool
- Register then execute

### Running Points
- Use tsx to run TypeScript
- Debug mode shows what's happening
- Results returned immediately
- All processing is local

### Examples Points
- 7 tools available
- File operations (read, write, replace)
- Code search (pattern matching)
- Terminal (run commands)
- All FREE, all local

### Conclusion Points
- You can now automate tasks
- Zero cost, maximum value
- Check documentation for more
- Upgrade to PAID if you need multi-agent

---

## 🎯 Learning Objectives

After watching this video, viewers should be able to:

✅ Install and build the adapter
✅ Create a basic FREE mode agent
✅ Use the find_files tool
✅ Understand the handleSteps generator pattern
✅ Run an agent and interpret results
✅ Know what tools are available in FREE mode
✅ Find additional resources and documentation

---

## 📊 Video Sections Summary

| Time | Section | Content | Screen |
|------|---------|---------|--------|
| 0:00-0:30 | Intro | What FREE mode is | Title card |
| 0:30-1:30 | Install | npm install & build | Terminal |
| 1:30-3:00 | Create | Write first agent | Editor |
| 3:00-4:00 | Run | Execute & see results | Terminal |
| 4:00-4:45 | Examples | Quick tool demos | Editor |
| 4:45-5:00 | Outro | Summary & next steps | Summary slide |

---

## 🎨 Visual Style Guide

### Color Scheme
- **Success/Available:** Green (#00FF00)
- **Info:** Blue (#0088FF)
- **Warning:** Yellow (#FFAA00)
- **Error:** Red (#FF0000)
- **FREE mode badge:** Green badge with "$0.00"
- **PAID mode badge:** Orange badge with "💳"

### Typography
- **Code:** Fira Code or JetBrains Mono
- **Body:** Inter or Roboto
- **Headings:** Poppins or Montserrat

### Annotations
- Use arrows to point to important code
- Circle key concepts
- Highlight tool names in green
- Show cost as "$0.00" in green

---

## 🔊 Audio Notes

### Tone
- Friendly and approachable
- Enthusiastic but not over-the-top
- Clear pronunciation
- Moderate pace (not too fast)

### Background Music
- Optional: Light, upbeat instrumental
- Low volume (don't overpower voice)
- Fade out during code explanation
- Fade in during transitions

### Sound Effects
- Optional: Subtle "pop" for successful operations
- Optional: Typing sounds (very subtle)
- Keep minimal—focus on content

---

## 📤 Export Settings

### Video
- Resolution: 1920x1080 (1080p)
- Frame rate: 30fps
- Format: MP4 (H.264)
- Bitrate: 8-10 Mbps

### Audio
- Format: AAC
- Bitrate: 192 kbps
- Sample rate: 48 kHz

### Subtitles
- Include closed captions
- Use auto-generated + manual review
- Format: SRT or VTT

---

## 📢 Publication Checklist

Before publishing:

- [ ] All code examples tested and working
- [ ] Terminal output matches current version
- [ ] No sensitive information in recordings
- [ ] Subtitles accurate and synchronized
- [ ] Audio levels normalized
- [ ] Video quality reviewed
- [ ] Links in description verified
- [ ] Thumbnail created (eye-catching)
- [ ] Tags added for discoverability

**Suggested Tags:**
- claude-cli-adapter
- free-mode
- automation
- typescript
- file-operations
- code-automation
- no-cost-tools
- developer-tools

---

## 🎬 Alternative Formats

### Short Version (1 minute)
Focus on:
1. Create adapter (10s)
2. Define agent (20s)
3. Run it (10s)
4. Show results (10s)
5. Call to action (10s)

### Long Version (15 minutes)
Add:
- Deep dive into each tool
- More complex examples
- Troubleshooting tips
- Best practices
- Q&A section

### Tutorial Series
- Video 1: Introduction & Installation
- Video 2: File Operations
- Video 3: Code Search
- Video 4: Terminal Commands
- Video 5: Advanced Patterns
- Video 6: FREE vs PAID Comparison

---

**Need help creating the video?** Contact the team or see the [documentation](../README.md) for more resources!
