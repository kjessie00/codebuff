/**
 * Example 8: Terminal Executor Agent
 *
 * An agent that executes terminal commands and processes their output.
 *
 * Features:
 * - Execute shell commands
 * - Capture stdout and stderr
 * - Parse command output
 * - Handle exit codes
 *
 * Tools used: run_terminal_command, set_output
 */

import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'

export const terminalExecutorAgent: AgentDefinition = {
  id: 'terminal-executor',
  displayName: 'Terminal Executor',
  systemPrompt: 'You execute terminal commands.',
  toolNames: ['run_terminal_command', 'set_output'],
  outputMode: 'structured_output',

  async *handleSteps(context) {
    const command = (context.params?.command as string) || 'ls -la'

    const cmdResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'run_terminal_command',
        input: { command },
      },
    }

    const output = cmdResult[0]?.value?.output || ''
    const exitCode = cmdResult[0]?.value?.exit_code || 0

    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: {
          output: {
            command,
            exitCode,
            success: exitCode === 0,
            output,
            lines: output.split('\n').length,
          },
        },
      },
    }

    return 'DONE'
  },
}

export async function runTerminalExecutorExample() {
  console.log('=== Terminal Executor Agent Example ===\n')

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    debug: false,
  })

  adapter.registerAgent(terminalExecutorAgent)

  const result = await adapter.executeAgent(
    terminalExecutorAgent,
    'List files',
    { command: 'ls -la' }
  )

  const output = result.output as any
  console.log('Exit code:', output.exitCode)
  console.log('Success:', output.success)
  console.log('\n✅ Terminal Executor example completed!')
}

if (require.main === module) {
  runTerminalExecutorExample().catch(console.error)
}
