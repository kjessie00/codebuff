/**
 * Example 9: Project Structure Analyzer
 *
 * Analyzes directory structure and generates a tree view.
 *
 * Features:
 * - Directory tree generation
 * - File statistics per directory
 * - Project organization insights
 *
 * Tools used: find_files, set_output
 */

import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'

export const projectStructureAgent: AgentDefinition = {
  id: 'project-structure',
  displayName: 'Project Structure Analyzer',
  systemPrompt: 'You analyze project directory structure.',
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

    const path = require('path')
    const structure: Record<string, any> = {}

    for (const file of files) {
      const dir = path.dirname(file)
      const parts = dir.split(path.sep).filter(Boolean)

      let current = structure
      for (const part of parts) {
        if (!current[part]) {
          current[part] = { _files: [], _subdirs: {} }
        }
        current = current[part]._subdirs || current[part]
      }

      if (!current._files) current._files = []
      current._files.push(path.basename(file))
    }

    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: {
          output: {
            totalFiles: files.length,
            structure,
          },
        },
      },
    }

    return 'DONE'
  },
}

export async function runProjectStructureExample() {
  console.log('=== Project Structure Agent Example ===\n')

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    debug: false,
  })

  adapter.registerAgent(projectStructureAgent)

  const result = await adapter.executeAgent(
    projectStructureAgent,
    'Analyze structure',
    { pattern: 'src/**/*' }
  )

  const output = result.output as any
  console.log('Total files:', output.totalFiles)
  console.log('\n✅ Project Structure example completed!')
}

if (require.main === module) {
  runProjectStructureExample().catch(console.error)
}
