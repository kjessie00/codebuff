/**
 * Codebuff Claude CLI Adapter
 *
 * Main entry point for the adapter package
 *
 * @module @codebuff/adapter
 */

// Export main adapter
export {
  ClaudeCodeCLIAdapter,
  createAdapter,
  createDebugAdapter,
  type AgentExecutionResult,
} from './claude-cli-adapter'

// Export executor
export {
  HandleStepsExecutor,
  createProductionExecutor,
  createDebugExecutor,
  MaxIterationsError,
  UnknownYieldValueError,
} from './handle-steps-executor'

export type {
  ToolExecutor,
  LLMExecutor,
  TextOutputHandler,
  HandleStepsExecutorConfig,
  ExecutionResult,
} from './handle-steps-executor'

// Export types
export type {
  AdapterConfig,
  AgentExecutionContext,
  ToolResult,
  ClaudeToolResult,
} from './types'

// Export tools
export * from './tools'
