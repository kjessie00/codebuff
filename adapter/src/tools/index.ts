/**
 * Tools Module
 *
 * Exports all tool implementations for the Claude CLI Adapter
 *
 * @module tools
 */

export {
  FileOperationsTools,
  createFileOperationsTools,
  type ReadFilesParams,
  type WriteFileParams,
  type StrReplaceParams,
  type ToolResultOutput,
} from './file-operations'

export {
  CodeSearchTools,
  createCodeSearchTools,
  type CodeSearchInput,
  type FindFilesInput,
  type SearchResult,
} from './code-search'

export {
  SpawnAgentsAdapter,
  createSpawnAgentsAdapter,
  type SpawnAgentsParams,
  type SpawnedAgentResult,
  type AgentExecutor,
  type AgentExecutionContext,
  type AgentRegistry,
} from './spawn-agents'

export {
  TerminalTools,
  createTerminalTools,
  type RunTerminalCommandInput,
  type CommandExecutionResult,
} from './terminal'
