/**
 * Example 4: TODO Finder Agent
 *
 * An agent that finds all TODO, FIXME, and other comment markers in a codebase.
 * Demonstrates code search capabilities and result aggregation.
 *
 * Features:
 * - Search for TODO, FIXME, HACK, NOTE comments
 * - Categorize by priority and type
 * - Group by file
 * - Generate summary report
 *
 * Tools used: code_search, set_output
 */

import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'

/**
 * TODO Finder Agent Definition
 */
export const todoFinderAgent: AgentDefinition = {
  id: 'todo-finder',
  displayName: 'TODO Finder',
  systemPrompt: 'You find and categorize TODO comments in code.',
  instructionsPrompt: 'Search for TODO, FIXME, HACK, and NOTE comments and generate a comprehensive report.',
  toolNames: ['code_search', 'set_output'],
  outputMode: 'structured_output',

  async *handleSteps(context) {
    const filePattern = (context.params?.filePattern as string) || '*.{ts,js,tsx,jsx}'

    const markers = ['TODO', 'FIXME', 'HACK', 'NOTE', 'XXX']
    const allComments: any[] = []

    // Search for each marker type
    for (const marker of markers) {
      const searchResult = yield {
        type: 'TOOL_CALL',
        toolCall: {
          toolName: 'code_search',
          input: {
            query: `${marker}:?`,
            file_pattern: filePattern,
          },
        },
      }

      const results = searchResult[0]?.value?.results || []

      for (const result of results) {
        allComments.push({
          type: marker,
          file: result.path,
          line: result.line_number,
          text: (result.line as string).trim(),
          priority: marker === 'FIXME' ? 'HIGH' : marker === 'TODO' ? 'MEDIUM' : 'LOW',
        })
      }
    }

    // Group by file
    const byFile: Record<string, any[]> = {}
    for (const comment of allComments) {
      if (!byFile[comment.file]) {
        byFile[comment.file] = []
      }
      byFile[comment.file].push(comment)
    }

    // Group by type
    const byType: Record<string, number> = {}
    for (const comment of allComments) {
      byType[comment.type] = (byType[comment.type] || 0) + 1
    }

    // Group by priority
    const byPriority = {
      HIGH: allComments.filter(c => c.priority === 'HIGH').length,
      MEDIUM: allComments.filter(c => c.priority === 'MEDIUM').length,
      LOW: allComments.filter(c => c.priority === 'LOW').length,
    }

    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: {
          output: {
            summary: {
              totalComments: allComments.length,
              byType,
              byPriority,
              filesAffected: Object.keys(byFile).length,
            },
            comments: allComments,
            byFile,
            topFiles: Object.entries(byFile)
              .map(([file, comments]) => ({
                file,
                count: comments.length,
              }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 10),
          },
        },
      },
    }

    return 'DONE'
  },
}

/**
 * Example usage
 */
export async function runTodoFinderExample() {
  console.log('=== TODO Finder Agent Example ===\n')

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    debug: false,
  })

  adapter.registerAgent(todoFinderAgent)

  console.log('Searching for TODO comments in the codebase...')
  const result = await adapter.executeAgent(
    todoFinderAgent,
    'Find all TODOs',
    { filePattern: '**/*.ts' }
  )

  const output = result.output as any

  console.log('\n📊 Summary:')
  console.log('  Total comments:', output.summary.totalComments)
  console.log('  Files affected:', output.summary.filesAffected)
  console.log('\n📝 By Type:')
  for (const [type, count] of Object.entries(output.summary.byType)) {
    console.log(`  ${type}: ${count}`)
  }
  console.log('\n⚠️  By Priority:')
  console.log(`  HIGH:   ${output.summary.byPriority.HIGH}`)
  console.log(`  MEDIUM: ${output.summary.byPriority.MEDIUM}`)
  console.log(`  LOW:    ${output.summary.byPriority.LOW}`)

  if (output.topFiles.length > 0) {
    console.log('\n📁 Top Files with TODOs:')
    for (const { file, count } of output.topFiles.slice(0, 5)) {
      console.log(`  ${file}: ${count}`)
    }
  }

  console.log('\n✅ TODO Finder example completed!')
}

// Run if executed directly
if (require.main === module) {
  runTodoFinderExample().catch(console.error)
}
