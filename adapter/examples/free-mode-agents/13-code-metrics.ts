/**
 * Example 13: Code Metrics Calculator
 *
 * Calculates various code metrics like lines of code, complexity, etc.
 *
 * Features:
 * - Lines of code (LOC)
 * - Code vs comment ratio
 * - File size statistics
 * - Complexity indicators
 *
 * Tools used: find_files, read_files, set_output
 */

import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'

export const codeMetricsAgent: AgentDefinition = {
  id: 'code-metrics',
  displayName: 'Code Metrics Calculator',
  systemPrompt: 'You calculate code metrics.',
  toolNames: ['find_files', 'read_files', 'set_output'],
  outputMode: 'structured_output',

  async *handleSteps(context) {
    const pattern = (context.params?.pattern as string) || '**/*.{ts,js}'

    // Find all code files
    const findResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'find_files',
        input: { pattern },
      },
    }

    const files = findResult[0]?.value?.files || []

    // Read all files
    const readResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'read_files',
        input: { paths: files },
      },
    }

    const fileContents = readResult[0]?.value || {}

    const metrics = {
      totalFiles: 0,
      totalLines: 0,
      codeLines: 0,
      commentLines: 0,
      blankLines: 0,
      largestFile: { path: '', lines: 0 },
      smallestFile: { path: '', lines: Infinity },
      byFile: [] as any[],
    }

    for (const [filePath, content] of Object.entries(fileContents)) {
      if (content === null) continue

      const lines = (content as string).split('\n')
      let codeLines = 0
      let commentLines = 0
      let blankLines = 0

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) {
          blankLines++
        } else if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          commentLines++
        } else {
          codeLines++
        }
      }

      const fileMetrics = {
        path: filePath,
        lines: lines.length,
        code: codeLines,
        comments: commentLines,
        blank: blankLines,
        codeToCommentRatio: commentLines > 0 ? (codeLines / commentLines).toFixed(2) : 'N/A',
      }

      metrics.totalFiles++
      metrics.totalLines += lines.length
      metrics.codeLines += codeLines
      metrics.commentLines += commentLines
      metrics.blankLines += blankLines
      metrics.byFile.push(fileMetrics)

      if (lines.length > metrics.largestFile.lines) {
        metrics.largestFile = { path: filePath, lines: lines.length }
      }
      if (lines.length < metrics.smallestFile.lines) {
        metrics.smallestFile = { path: filePath, lines: lines.length }
      }
    }

    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: {
          output: {
            summary: {
              totalFiles: metrics.totalFiles,
              totalLines: metrics.totalLines,
              codeLines: metrics.codeLines,
              commentLines: metrics.commentLines,
              blankLines: metrics.blankLines,
              avgLinesPerFile: Math.round(metrics.totalLines / metrics.totalFiles),
              commentRatio: ((metrics.commentLines / metrics.totalLines) * 100).toFixed(1) + '%',
            },
            largestFile: metrics.largestFile,
            smallestFile: metrics.smallestFile.lines !== Infinity ? metrics.smallestFile : null,
            byFile: metrics.byFile,
          },
        },
      },
    }

    return 'DONE'
  },
}

export async function runCodeMetricsExample() {
  console.log('=== Code Metrics Agent Example ===\n')

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    debug: false,
  })

  adapter.registerAgent(codeMetricsAgent)

  const result = await adapter.executeAgent(
    codeMetricsAgent,
    'Calculate metrics',
    { pattern: 'src/**/*.ts' }
  )

  const output = result.output as any
  console.log('Total files:', output.summary.totalFiles)
  console.log('Total lines:', output.summary.totalLines)
  console.log('Code lines:', output.summary.codeLines)
  console.log('Comment ratio:', output.summary.commentRatio)
  console.log('\n✅ Code Metrics example completed!')
}

if (require.main === module) {
  runCodeMetricsExample().catch(console.error)
}
