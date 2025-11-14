/**
 * FREE Mode - Complete API
 *
 * This module provides a complete, production-ready API for using the
 * Claude CLI adapter in FREE mode (without an API key).
 *
 * ## Quick Start
 *
 * ```typescript
 * import { createFreeAdapter, fileExplorerAgent } from '@/adapter/free-mode'
 *
 * // Create adapter
 * const adapter = createFreeAdapter({ cwd: '/path/to/project' })
 *
 * // Register agent
 * adapter.registerAgent(fileExplorerAgent)
 *
 * // Execute
 * const result = await adapter.executeAgent(
 *   fileExplorerAgent,
 *   'Find all TypeScript files'
 * )
 * ```
 *
 * ## Features
 *
 * **Factory Functions** - Easy adapter creation
 * - `createFreeAdapter()` - Main factory with options
 * - `createAdapterForCwd()` - Quick current directory setup
 * - `createAdapterForProject()` - Project-specific setup
 *
 * **Agent Templates** - 11 pre-built agents
 * - File operations (explorer, editor)
 * - Code analysis (search, review)
 * - Project tools (analyzer, documentation)
 * - Security (auditor)
 * - Testing (test generator, TODO finder)
 *
 * **Helpers** - Common patterns
 * - Error handling wrappers
 * - Retry logic
 * - Sequential/parallel execution
 * - Output extraction
 * - Progress tracking
 *
 * **Presets** - Configuration templates
 * - Development (verbose logging)
 * - Production (minimal output)
 * - Testing (strict settings)
 * - Silent (no logging)
 * - Verbose (maximum debugging)
 * - Performance (optimized for speed)
 *
 * ## Available Tools (FREE Mode)
 *
 * - `read_files` - Read multiple files from disk
 * - `write_file` - Write content to a file
 * - `str_replace` - Replace string in a file
 * - `code_search` - Search codebase with ripgrep
 * - `find_files` - Find files matching glob pattern
 * - `run_terminal_command` - Execute shell commands
 * - `set_output` - Set agent output value
 *
 * ## NOT Available in FREE Mode
 *
 * - `spawn_agents` - Requires PAID mode (API key)
 *
 * @module free-mode
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type {
  // Result types
  Result,

  // Options
  ExecutionOptions,
  FreeAdapterOptions,

  // Tool information
  ToolInfo,
  ToolAvailability,

  // Agent templates
  AgentTemplate,

  // Execution context
  ExecutionContext,

  // Helper types
  Extractor,
  AgentTask,

  // Configuration
  PresetName,
  PresetConfig,

  // Re-exported core types
  AgentExecutionResult,
  AgentDefinition,
} from './free-mode-types'

// Result helpers
export { success, failure } from './free-mode-types'

// ============================================================================
// Factory Functions
// ============================================================================

export {
  // Main factories
  createFreeAdapter,
  createAdapterForCwd,
  createAdapterForProject,
  createDebugAdapter,
  createSilentAdapter,
  createAdapterWithEnv,

  // Validation
  isFreeMode,
  assertFreeMode,
  hasToolAvailable,
} from './factories'

// ============================================================================
// Agent Templates
// ============================================================================

export {
  // Agent definitions
  fileExplorerAgent,
  codeSearchAgent,
  terminalAgent,
  fileEditorAgent,
  projectAnalyzerAgent,
  todoFinderAgent,
  docGeneratorAgent,
  codeReviewerAgent,
  dependencyAnalyzerAgent,
  securityAuditorAgent,
  testGeneratorAgent,

  // Templates with metadata
  fileExplorerTemplate,
  codeSearchTemplate,
  terminalTemplate,
  fileEditorTemplate,
  projectAnalyzerTemplate,
  todoFinderTemplate,
  docGeneratorTemplate,
  codeReviewerTemplate,
  dependencyAnalyzerTemplate,
  securityAuditorTemplate,
  testGeneratorTemplate,

  // Collections
  allAgents,
  allTemplates,

  // Utilities
  getTemplatesByCategory,
  findTemplate,
} from './agent-templates'

// ============================================================================
// Helper Functions
// ============================================================================

export {
  // Execution helpers
  executeWithErrorHandling,
  executeAndExtract,
  executeWithRetry,
  executeWithTimeout,

  // Sequential execution
  executeSequence,
  executeParallel,

  // Mode checking
  isFreeMode as checkFreeMode, // Alias to avoid conflict
  isPaidMode,

  // Tool information
  getFreeModeTools,
  getPaidModeTools,
  getToolAvailability,
  isToolAvailable,
  getToolsByCategory,

  // Validation
  validateAgentForFreeMode,
  getFreeModeCompatibleAgents,

  // Output helpers
  prettyPrintResult,
  createProgressBar,
} from './helpers'

// ============================================================================
// Configuration Presets
// ============================================================================

export {
  // Preset definitions
  presets,
  developmentPreset,
  productionPreset,
  testingPreset,
  silentPreset,
  verbosePreset,
  performancePreset,

  // Preset factories
  createAdapterWithPreset,
  createDevelopmentAdapter,
  createProductionAdapter,
  createTestingAdapter,
  createSilentAdapter as createSilentAdapterPreset, // Alias to avoid conflict
  createVerboseAdapter,
  createPerformanceAdapter,

  // Preset utilities
  getAvailablePresets,
  getPreset,
  printPresetInfo,
  printAllPresets,
  createCustomPreset,

  // Environment-based
  getPresetForEnvironment,
  createAdapterForEnvironment,
} from './presets'

// ============================================================================
// Convenience Re-exports
// ============================================================================

// Re-export the main adapter class for convenience
export { ClaudeCodeCLIAdapter } from '../claude-cli-adapter'

// ============================================================================
// Quick Start Examples
// ============================================================================

/**
 * Example: Basic Usage
 *
 * ```typescript
 * import { createFreeAdapter, fileExplorerAgent } from '@/adapter/free-mode'
 *
 * const adapter = createFreeAdapter()
 * adapter.registerAgent(fileExplorerAgent)
 *
 * const result = await adapter.executeAgent(
 *   fileExplorerAgent,
 *   'Find all TypeScript files'
 * )
 *
 * console.log(result.output)
 * ```
 */

/**
 * Example: With Error Handling
 *
 * ```typescript
 * import {
 *   createFreeAdapter,
 *   codeSearchAgent,
 *   executeWithErrorHandling
 * } from '@/adapter/free-mode'
 *
 * const adapter = createFreeAdapter()
 * adapter.registerAgent(codeSearchAgent)
 *
 * const result = await executeWithErrorHandling(
 *   adapter,
 *   codeSearchAgent,
 *   'Search for TODO comments'
 * )
 *
 * if (result.success) {
 *   console.log('Found:', result.data.output)
 * } else {
 *   console.error('Error:', result.error)
 * }
 * ```
 */

/**
 * Example: Sequential Workflow
 *
 * ```typescript
 * import {
 *   createFreeAdapter,
 *   fileExplorerAgent,
 *   codeSearchAgent,
 *   todoFinderAgent,
 *   executeSequence
 * } from '@/adapter/free-mode'
 *
 * const adapter = createFreeAdapter()
 * adapter.registerAgents([fileExplorerAgent, codeSearchAgent, todoFinderAgent])
 *
 * const results = await executeSequence(adapter, [
 *   { agent: fileExplorerAgent, prompt: 'Find all .ts files' },
 *   { agent: codeSearchAgent, prompt: 'Search for TODOs' },
 *   { agent: todoFinderAgent, prompt: 'Organize TODOs by priority' }
 * ])
 *
 * results.forEach((result, i) => {
 *   console.log(`Task ${i + 1}:`, result.success ? 'OK' : 'FAILED')
 * })
 * ```
 */

/**
 * Example: Using Presets
 *
 * ```typescript
 * import {
 *   createAdapterWithPreset,
 *   codeReviewerAgent
 * } from '@/adapter/free-mode'
 *
 * // Development mode with verbose logging
 * const devAdapter = createAdapterWithPreset('development', {
 *   cwd: '/path/to/project'
 * })
 *
 * // Production mode with minimal logging
 * const prodAdapter = createAdapterWithPreset('production', {
 *   cwd: '/path/to/project'
 * })
 *
 * devAdapter.registerAgent(codeReviewerAgent)
 * const review = await devAdapter.executeAgent(
 *   codeReviewerAgent,
 *   'Review src/index.ts'
 * )
 * ```
 */

/**
 * Example: Custom Agent
 *
 * ```typescript
 * import { createFreeAdapter, type AgentDefinition } from '@/adapter/free-mode'
 *
 * const myAgent: AgentDefinition = {
 *   id: 'my-custom-agent',
 *   version: '1.0.0',
 *   displayName: 'My Custom Agent',
 *   model: 'anthropic/claude-sonnet-4.5',
 *   systemPrompt: 'You are a helpful assistant.',
 *   toolNames: ['read_files', 'code_search'],
 *   outputMode: 'last_message',
 * }
 *
 * const adapter = createFreeAdapter()
 * adapter.registerAgent(myAgent)
 *
 * const result = await adapter.executeAgent(myAgent, 'Do something')
 * ```
 */

/**
 * Example: All Pre-built Agents
 *
 * ```typescript
 * import { createFreeAdapter, allAgents } from '@/adapter/free-mode'
 *
 * const adapter = createFreeAdapter()
 *
 * // Register all pre-built agents at once
 * adapter.registerAgents(allAgents)
 *
 * // List all registered agents
 * const agentIds = adapter.listAgents()
 * console.log('Available agents:', agentIds)
 *
 * // Use any agent
 * const result = await adapter.executeAgent(
 *   allAgents[0],
 *   'Explore the project'
 * )
 * ```
 */
