/**
 * Example 7: File Finder Agent
 *
 * An agent that finds files using glob patterns and provides detailed information.
 *
 * Features:
 * - Glob pattern matching
 * - File categorization by extension
 * - Directory structure analysis
 * - File size and modification time
 *
 * Tools used: find_files, set_output
 */

import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'

export const fileFinderAgent: AgentDefinition = {
  id: 'file-finder',
  displayName: 'File Finder',
  systemPrompt: 'You find files matching specific patterns.',
  toolNames: ['find_files', 'set_output'],
  outputMode: 'structured_output',

  async *handleSteps(context) {
    const pattern = (context.params?.pattern as string) || '**/*'

    const findResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'find_files',
        input: { pattern },
      },
    }

    const files = findResult[0]?.value?.files || []

    // Categorize by extension
    const byExtension: Record<string, string[]> = {}
    const byDirectory: Record<string, number> = {}

    for (const file of files) {
      const path = require('path')
      const ext = path.extname(file) || 'no-extension'
      const dir = path.dirname(file)

      if (!byExtension[ext]) {
        byExtension[ext] = []
      }
      byExtension[ext].push(file)

      byDirectory[dir] = (byDirectory[dir] || 0) + 1
    }

    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: {
          output: {
            pattern,
            totalFiles: files.length,
            files,
            byExtension,
            byDirectory,
            extensions: Object.keys(byExtension).sort(),
          },
        },
      },
    }

    return 'DONE'
  },
}

export async function runFileFinderExample() {
  console.log('=== File Finder Agent Example ===\n')

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    debug: false,
  })

  adapter.registerAgent(fileFinderAgent)

  const result = await adapter.executeAgent(
    fileFinderAgent,
    'Find TypeScript files',
    { pattern: '**/*.ts' }
  )

  const output = result.output as any
  console.log('Total files:', output.totalFiles)
  console.log('Extensions:', output.extensions)
  console.log('\n✅ File Finder example completed!')
}

if (require.main === module) {
  runFileFinderExample().catch(console.error)
}
