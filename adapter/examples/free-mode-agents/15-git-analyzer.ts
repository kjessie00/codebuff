/**
 * Example 15: Git Analyzer Agent
 *
 * Analyzes git repository information using terminal commands.
 *
 * Features:
 * - Get commit history
 * - Analyze git status
 * - Find modified files
 * - Repository statistics
 *
 * Tools used: run_terminal_command, set_output
 */

import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'

export const gitAnalyzerAgent: AgentDefinition = {
  id: 'git-analyzer',
  displayName: 'Git Analyzer',
  systemPrompt: 'You analyze git repository information.',
  toolNames: ['run_terminal_command', 'set_output'],
  outputMode: 'structured_output',

  async *handleSteps(context) {
    // Get current branch
    const branchResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'run_terminal_command',
        input: { command: 'git rev-parse --abbrev-ref HEAD' },
      },
    }

    const currentBranch = (branchResult[0]?.value?.output || '').trim()

    // Get git status
    const statusResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'run_terminal_command',
        input: { command: 'git status --short' },
      },
    }

    const status = (statusResult[0]?.value?.output || '').trim()
    const modifiedFiles = status.split('\n').filter(Boolean).length

    // Get recent commits
    const logResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'run_terminal_command',
        input: { command: 'git log --oneline -10' },
      },
    }

    const commits = (logResult[0]?.value?.output || '')
      .trim()
      .split('\n')
      .filter(Boolean)

    // Get total commits
    const countResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'run_terminal_command',
        input: { command: 'git rev-list --count HEAD' },
      },
    }

    const totalCommits = parseInt((countResult[0]?.value?.output || '0').trim())

    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: {
          output: {
            currentBranch,
            modifiedFiles,
            totalCommits,
            recentCommits: commits,
            status: {
              clean: modifiedFiles === 0,
              message: status || 'No changes',
            },
          },
        },
      },
    }

    return 'DONE'
  },
}

export async function runGitAnalyzerExample() {
  console.log('=== Git Analyzer Agent Example ===\n')

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    debug: false,
  })

  adapter.registerAgent(gitAnalyzerAgent)

  const result = await adapter.executeAgent(
    gitAnalyzerAgent,
    'Analyze git repository'
  )

  const output = result.output as any
  console.log('Current branch:', output.currentBranch)
  console.log('Total commits:', output.totalCommits)
  console.log('Modified files:', output.modifiedFiles)
  console.log('Repository clean:', output.status.clean)
  console.log('\n✅ Git Analyzer example completed!')
}

if (require.main === module) {
  runGitAnalyzerExample().catch(console.error)
}
