# Glossary

Complete glossary of terms used in the Claude CLI Adapter documentation.

## A

**Adapter**
The ClaudeCodeCLIAdapter class that bridges Codebuff's agent system with Claude Code CLI tools. Acts as the main orchestrator for agent execution.

**Agent**
A defined workflow that combines LLM capabilities with tool execution. Specified using the AgentDefinition interface. Can be simple (single-purpose) or complex (orchestrating multiple operations).

**AgentDefinition**
TypeScript interface that defines an agent's configuration, including ID, display name, system prompt, available tools, and execution logic (handleSteps).

**Agent Execution**
The process of running an agent from start to finish, including initialization, tool calls, LLM steps, and output generation.

**AgentExecutionContext**
Internal state maintained during agent execution, including agent ID, parent ID, message history, remaining steps, and output value.

**AgentExecutionResult**
Object returned from executing an agent, containing output, message history, agent state, and execution metadata (iteration count, timing, etc.).

**Agent Registry**
Internal Map that stores registered agents by ID, allowing lookup and execution of agents by name.

**AgentState**
State object passed through generator iterations, containing agent ID, run ID, message history, and output.

**API Key**
Anthropic API key required for PAID mode features. When provided, enables spawn_agents tool for multi-agent orchestration.

---

## B

**Batch Operations**
Executing multiple similar operations in a single call for better performance (e.g., reading multiple files with one read_files call instead of multiple calls).

**Backoff**
Strategy for gradually increasing delay between retry attempts, typically exponential (e.g., 1s, 2s, 4s, 8s).

**Built-in Tools**
Core tools provided by the adapter: read_files, write_file, str_replace, code_search, find_files, run_terminal_command, set_output.

---

## C

**Cache**
Temporary storage of previously computed results to avoid redundant operations. Can be in-memory (Map) or persistent (file/database).

**Circuit Breaker**
Pattern that prevents repeated execution of operations that are likely to fail, entering an "open" state after threshold failures.

**ClaudeCodeCLIAdapter**
Main adapter class (see Adapter).

**CLI**
Command Line Interface - text-based interface for interacting with programs.

**Code Search**
Tool that searches codebase content using ripgrep, supporting regex patterns and file filtering.

**Codebuff**
Parent framework that provides AgentDefinition types and agent system concepts.

**Context**
See AgentExecutionContext.

**CWD (Current Working Directory)**
Base directory for all file operations. All relative paths are resolved against this directory.

---

## D

**Debug Mode**
Execution mode with verbose logging enabled, useful for troubleshooting. Enable via `debug: true` in config or `createDebugAdapter()`.

**Dependency**
External package or tool required for functionality (e.g., ripgrep for code search).

**Dispatcher**
Component that routes tool calls to appropriate tool implementations based on tool name.

---

## E

**Early Exit**
Pattern of terminating execution as soon as a condition is met, avoiding unnecessary work.

**Error Handling**
Techniques for catching, wrapping, and recovering from errors during execution.

**Execution Mode**
Method of running an agent: handleSteps (programmatic) or pure LLM (autonomous).

**ExecutionResult**
Result object from HandleStepsExecutor containing final agent state, iteration count, completion status, and any errors.

**Exponential Backoff**
Retry strategy where delay between attempts increases exponentially (e.g., 2x each time).

---

## F

**Factory Function**
Function that creates and configures instances (e.g., `createAdapter()`, `createDebugAdapter()`).

**File Operations**
Tools for reading, writing, and editing files: read_files, write_file, str_replace.

**File Pattern**
Glob pattern for matching files (e.g., "**/*.ts" for all TypeScript files).

**Find Files**
Tool that locates files matching a glob pattern.

**FREE Mode**
Operational mode without API key, providing all tools except spawn_agents. Zero cost, 100% local processing.

---

## G

**Generator**
JavaScript/TypeScript function* that can yield values and resume execution. Used for handleSteps to enable step-by-step execution control.

**Generator Function**
Function declared with `function*` syntax that returns a generator iterator.

**Glob Pattern**
Pattern for matching file paths using wildcards (*, **, ?, etc.). Example: "src/**/*.test.ts".

**God Agent**
Anti-pattern: agent that tries to do everything, becoming hard to maintain and test. Opposite of focused, single-purpose agents.

---

## H

**HandleSteps**
Generator function in AgentDefinition that defines programmatic execution flow. Yields tool calls, STEP commands, and text output.

**HandleStepsExecutor**
Engine that executes handleSteps generators, managing iteration lifecycle and processing yielded values.

**Hybrid Mode**
Architecture supporting both FREE (no API key) and PAID (with API key) modes, determined at runtime.

---

## I

**Incremental Processing**
Processing large datasets in batches to manage memory and provide progress updates.

**Input Validation**
Checking and sanitizing inputs before use to prevent errors and security vulnerabilities.

**Iteration**
Single step through a generator, processing one yielded value.

**Iteration Count**
Number of times the generator was advanced. Limited by maxIterations config to prevent infinite loops.

---

## J

**JSON**
JavaScript Object Notation - standard data format for tool inputs and outputs.

**JSDoc**
Documentation comments in code using /** */ syntax, providing type hints and descriptions.

---

## L

**Lazy Evaluation**
Computing values only when needed, not eagerly upfront. Improves performance by avoiding unnecessary work.

**LLM (Large Language Model)**
AI model (like Claude) that processes natural language. In adapter, placeholder for future Claude CLI integration.

**LLM Executor**
Function that executes LLM steps (STEP or STEP_ALL), provided to HandleStepsExecutor.

**Logger**
Function for outputting debug/info/error messages. Can be custom or default console.log.

---

## M

**maxIterations**
Configuration limiting generator iterations to prevent infinite loops (default: 100).

**maxResults**
Parameter limiting number of results returned from code_search to control performance.

**maxSteps**
Configuration limiting agent execution steps (default: 20).

**Message History**
Array of conversation messages between user and agent, tracking complete interaction.

**Metadata**
Additional information about execution, including timing, iteration count, and completion status.

---

## N

**Nested Agents**
Agents that spawn other agents, creating parent-child relationships (requires PAID mode).

---

## O

**Orchestrator**
Agent that coordinates execution of multiple sub-agents or complex workflows.

**Output Mode**
How agent output is determined: last_message, all_messages, or structured_output.

---

## P

**PAID Mode**
Operational mode with API key, enabling all features including spawn_agents for multi-agent orchestration.

**Parallel Execution**
Running multiple independent operations simultaneously using Promise.all.

**Parent Context**
Execution context of parent agent, passed to child agents for context inheritance.

**Path Traversal**
Security vulnerability where attacker accesses files outside allowed directory. Prevented by path validation.

**Performance**
Execution speed and resource efficiency. Measured in execution time, memory usage, and operation count.

**Plugin**
Extension that adds functionality to adapter without modifying core code.

**Profiling**
Measuring execution performance to identify bottlenecks and optimization opportunities.

**Prompt**
Text instruction given to agent or LLM describing desired task or behavior.

---

## R

**Read Files**
Tool for reading multiple files in parallel from disk.

**Registry**
See Agent Registry.

**Retry**
Attempting an operation again after failure, often with delay and backoff strategy.

**RetryConfig**
Configuration for retry behavior: maxRetries, delays, backoff strategy.

**Ripgrep (rg)**
Fast command-line search tool used by code_search. Required dependency.

**Run Terminal Command**
Tool for executing shell commands with timeout and environment control.

---

## S

**Sampling**
Processing a subset of data to estimate results for full dataset. Used for large codebases.

**Sanitization**
Cleaning input data to remove potentially dangerous content (e.g., command injection characters).

**Sequential Execution**
Running operations one after another, waiting for each to complete before starting next.

**Set Output**
Tool for setting agent's output value, determining what executeAgent returns.

**Spawn Agents** *(PAID mode only)*
Tool for executing multiple sub-agents and aggregating their results.

**STEP**
Yield value that executes single LLM turn in handleSteps generator.

**STEP_ALL**
Yield value that executes LLM until completion (end_turn) in handleSteps generator.

**STEP_TEXT**
Yield value that outputs text to conversation without LLM execution.

**Str Replace**
Tool for replacing first occurrence of string in file.

**Streaming Output**
Providing progress updates during execution using STEP_TEXT yields.

**Sub-agent**
Agent spawned by another agent, executing as child in agent hierarchy.

**System Prompt**
Instructions that define agent's behavior, role, and capabilities.

---

## T

**Terminal**
Command-line shell interface for executing commands.

**Timeout**
Maximum time allowed for operation to complete before being cancelled.

**TimeoutConfig**
Configuration for operation timeouts: tool execution, LLM invocation, terminal commands.

**Tool**
Function available to agents for performing operations: file I/O, code search, terminal commands, etc.

**ToolCall**
Object yielded from handleSteps specifying tool name and input parameters.

**Tool Dispatcher**
Component that routes tool calls to implementations (see Dispatcher).

**ToolExecutionError**
Error thrown when tool execution fails, including tool name, input, and original error.

**ToolExecutor**
Function that executes tool calls, provided to HandleStepsExecutor.

**Tool Names**
Array of strings in AgentDefinition listing tools the agent can use.

**ToolResultOutput**
Standard format for tool results: { type: 'json'|'media', value: any }.

**Transient Error**
Temporary failure that might succeed on retry (network timeout, file lock, etc.).

**TypeScript**
Typed superset of JavaScript providing compile-time type checking and better tooling.

---

## U

**Undefined**
JavaScript value indicating absence of value. Distinct from null.

---

## V

**Validation**
Checking inputs meet requirements before processing.

**ValidationError**
Error thrown when input validation fails, including field, value, and reason.

---

## W

**Workflow**
Sequence of operations defined in agent's handleSteps.

**Write File**
Tool for writing content to file, creating parent directories if needed.

---

## Y

**Yield**
Generator keyword that returns value and pauses execution until next() is called.

**Yield Value**
Value returned from generator: ToolCall object, 'STEP', 'STEP_ALL', or StepText object.

---

## Common Acronyms

**API** - Application Programming Interface

**CLI** - Command Line Interface

**CWD** - Current Working Directory

**DX** - Developer Experience

**GC** - Garbage Collection

**I/O** - Input/Output

**JSON** - JavaScript Object Notation

**LLM** - Large Language Model

**ms** - milliseconds

**OS** - Operating System

**PAID** - Mode requiring API key for full features

**README** - Read Me (documentation file)

**REPL** - Read-Eval-Print Loop

**SDK** - Software Development Kit

**TTL** - Time To Live (cache expiration)

**TS** - TypeScript

**TSX** - TypeScript React

**UTF-8** - Unicode Transformation Format 8-bit

---

## Concepts by Category

### Agent Concepts
- Agent
- AgentDefinition
- AgentExecutionContext
- AgentExecutionResult
- AgentState
- Agent Registry
- Sub-agent
- God Agent
- Orchestrator

### Execution Concepts
- HandleSteps
- HandleStepsExecutor
- Iteration
- Generator
- Yield
- STEP
- STEP_ALL
- STEP_TEXT
- Execution Mode

### Tool Concepts
- Tool
- ToolCall
- Tool Names
- ToolExecutor
- Tool Dispatcher
- Built-in Tools
- ToolResultOutput
- ToolExecutionError

### Performance Concepts
- Batch Operations
- Parallel Execution
- Sequential Execution
- Lazy Evaluation
- Early Exit
- Cache
- Profiling
- Sampling
- Incremental Processing

### Error Handling Concepts
- Error Handling
- Retry
- RetryConfig
- Backoff
- Circuit Breaker
- ValidationError
- Transient Error
- Timeout

### Mode Concepts
- FREE Mode
- PAID Mode
- Hybrid Mode
- API Key
- Debug Mode

### File Concepts
- Read Files
- Write File
- Str Replace
- File Pattern
- Glob Pattern
- Path Traversal
- CWD

### Security Concepts
- Validation
- Sanitization
- Path Traversal
- Command Injection
- Input Validation

---

## Usage Examples

### Example: Using Glossary Terms

```typescript
// Creating an ADAPTER with DEBUG MODE enabled
const adapter = createDebugAdapter('/path/to/project')

// Registering an AGENT DEFINITION
const myAgent: AgentDefinition = {
  id: 'example-agent',
  displayName: 'Example Agent',
  toolNames: ['read_files', 'code_search'],  // TOOL NAMES

  // HANDLESTEPS generator function
  handleSteps: function* ({ params, logger }) {
    // YIELD a TOOL CALL
    const { toolResult } = yield {
      toolName: 'find_files',
      input: { pattern: '**/*.ts' }  // GLOB PATTERN
    }

    // Process TOOL RESULT OUTPUT
    const files = toolResult[0].value.files

    // SET OUTPUT
    yield {
      toolName: 'set_output',
      input: { output: { filesFound: files.length } }
    }
  }
}

// AGENT REGISTRY - register the agent
adapter.registerAgent(myAgent)

// AGENT EXECUTION
const result: AgentExecutionResult = await adapter.executeAgent(
  myAgent,
  'Find TypeScript files',
  { pattern: '**/*.ts' }
)

// METADATA from execution
console.log('Execution time:', result.metadata?.executionTime)
console.log('Iteration count:', result.metadata?.iterationCount)
```

---

## See Also

- [FREE Mode API Reference](./FREE_MODE_API_REFERENCE.md)
- [Advanced Patterns](./ADVANCED_PATTERNS.md)
- [Best Practices](./BEST_PRACTICES.md)
- [Architecture Guide](./ARCHITECTURE.md)
- [Main README](../README.md)
