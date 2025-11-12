# Changelog

All notable changes to the Claude Code CLI Adapter will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-12

### Added - Phase 1 Complete

#### Core Infrastructure

- **ClaudeCodeCLIAdapter** - Main orchestration class for agent execution
  - Agent registration and management
  - Execution lifecycle management (programmatic and pure LLM modes)
  - Tool dispatch and execution
  - State and context management
  - Error handling and recovery
  - Debug logging and event tracking

- **HandleStepsExecutor** - Generator-based execution engine
  - Full support for \`handleSteps\` generator pattern
  - Tool call execution with result passing
  - LLM step execution (STEP and STEP_ALL modes)
  - Text output handling (STEP_TEXT)
  - Maximum iteration protection
  - Graceful error handling
  - Comprehensive execution result tracking

#### Type System

- **Comprehensive Type Definitions** (\`src/types.ts\`)
  - \`AdapterConfig\` - Adapter configuration interface
  - \`AgentExecutionContext\` - Execution state tracking
  - \`ClaudeToolResult\` - Tool execution results
  - \`ExecuteAgentParams\` - Agent execution parameters
  - \`ExecuteAgentResult\` - Agent execution results
  - \`ToolExecutionResult\` - Internal tool results
  - \`ExecutionStats\` - Performance metrics
  - \`AdapterEvent\` - Event system types
  - Type guards for runtime validation

#### Tool Implementations

##### File Operations (\`src/tools/file-operations.ts\`)
- \`read_files\` - Read multiple files with error handling
  - Batch file reading
  - Individual file error handling (partial success)
  - Path validation and security checks
  - UTF-8 encoding support

- \`write_file\` - Write content to files
  - Automatic parent directory creation
  - UTF-8 encoding
  - Path validation
  - Error reporting

- \`str_replace\` - String replacement in files
  - Exact string matching
  - First occurrence replacement
  - File existence validation
  - Content verification

##### Code Search (\`src/tools/code-search.ts\`)
- \`code_search\` - Search codebase with glob pattern
  - Recursive directory search
  - Pattern matching (regex-like)
  - File type filtering
  - Case-sensitive/insensitive options
  - Result limiting
  - Line number tracking

- \`find_files\` - Find files matching glob patterns
  - Fast glob-based file finding
  - Pattern matching support (**, *, ?, etc.)
  - Recursive directory traversal
  - File path normalization

##### Terminal Operations (\`src/tools/terminal.ts\`)
- \`run_terminal_command\` - Execute shell commands
  - Shell command execution
  - Working directory support
  - Environment variable injection
  - Timeout handling
  - stdout/stderr capture
  - Exit code reporting
  - Cross-platform support (using cross-spawn)

##### Agent Management (\`src/tools/spawn-agents.ts\`)
- \`spawn_agents\` - Hierarchical agent execution
  - Sequential sub-agent execution
  - Agent registry integration
  - Context propagation to child agents
  - Result aggregation
  - Error handling per agent
  - Parent-child relationship tracking

- \`set_output\` - Set agent output value
  - Type-safe output setting
  - Context state update
  - Automatic state propagation

### Documentation

- **README.md** - Comprehensive main documentation
- **INTEGRATION_GUIDE.md** - Claude CLI integration instructions
- **CHANGELOG.md** - This file
- Inline JSDoc comments throughout codebase

### Known Limitations

1. **LLM Integration**: \`invokeClaude()\` method is a placeholder
2. **Parallel Execution**: \`spawn_agents\` executes sequentially only
3. **Streaming**: Not yet implemented

## [Unreleased]

### Planned for Phase 2

- Additional tools (web_search, fetch_url, etc.)
- Streaming response support
- Comprehensive test suite
- Performance optimizations
- Extended documentation

### Planned for Phase 3

- Complete Claude CLI integration
- Plugin system
- Advanced features

---

For full details on each release, see the commit history and pull requests.
