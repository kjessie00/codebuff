/**
 * Example 6: Code Search Agent
 *
 * A powerful agent for searching code patterns using regex.
 * Demonstrates advanced search capabilities with result formatting.
 *
 * Features:
 * - Regex pattern search
 * - File type filtering
 * - Case-sensitive/insensitive search
 * - Context display around matches
 * - Result grouping and statistics
 *
 * Tools used: code_search, set_output
 */

import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'

/**
 * Code Search Agent Definition
 */
export const codeSearchAgent: AgentDefinition = {
  id: 'code-search',
  displayName: 'Code Search',
  systemPrompt: 'You search for code patterns using regex.',
  instructionsPrompt: 'Search for the specified pattern and return formatted results.',
  toolNames: ['code_search', 'set_output'],
  outputMode: 'structured_output',

  async *handleSteps(context) {
    const query = (context.params?.query as string) || ''
    const filePattern = (context.params?.filePattern as string) || '*'
    const caseSensitive = (context.params?.caseSensitive as boolean) ?? false

    if (!query) {
      yield {
        type: 'TOOL_CALL',
        toolCall: {
          toolName: 'set_output',
          input: {
            output: {
              error: 'Query is required',
              results: [],
            },
          },
        },
      }
      return 'DONE'
    }

    // Perform search
    const searchResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'code_search',
        input: {
          query,
          file_pattern: filePattern,
          case_sensitive: caseSensitive,
        },
      },
    }

    const results = searchResult[0]?.value?.results || []

    // Group by file
    const byFile: Record<string, any[]> = {}
    for (const result of results) {
      const file = result.path as string
      if (!byFile[file]) {
        byFile[file] = []
      }
      byFile[file].push({
        line: result.line_number,
        text: (result.line as string).trim(),
        match: result.match,
      })
    }

    // Get file statistics
    const fileStats = Object.entries(byFile).map(([file, matches]) => ({
      file,
      matchCount: matches.length,
      firstMatch: matches[0].line,
      lastMatch: matches[matches.length - 1].line,
    }))

    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: {
          output: {
            query,
            filePattern,
            caseSensitive,
            summary: {
              totalMatches: results.length,
              filesWithMatches: Object.keys(byFile).length,
            },
            results: results.map((r: any) => ({
              file: r.path,
              line: r.line_number,
              text: r.line.trim(),
              match: r.match,
            })),
            byFile,
            fileStats: fileStats.sort((a, b) => b.matchCount - a.matchCount),
          },
        },
      },
    }

    return 'DONE'
  },
}

/**
 * Function Search Agent
 *
 * Specialized agent for finding function definitions.
 */
export const functionSearchAgent: AgentDefinition = {
  id: 'function-search',
  displayName: 'Function Search',
  systemPrompt: 'You find function definitions in code.',
  toolNames: ['code_search', 'set_output'],
  outputMode: 'structured_output',

  async *handleSteps(context) {
    const functionName = (context.params?.functionName as string) || ''
    const filePattern = (context.params?.filePattern as string) || '*.{ts,js}'

    // Search for function definitions
    const patterns = [
      `function ${functionName}`,
      `const ${functionName} =`,
      `export function ${functionName}`,
      `async function ${functionName}`,
    ]

    const allMatches: any[] = []

    for (const pattern of patterns) {
      const searchResult = yield {
        type: 'TOOL_CALL',
        toolCall: {
          toolName: 'code_search',
          input: {
            query: pattern,
            file_pattern: filePattern,
            case_sensitive: true,
          },
        },
      }

      const results = searchResult[0]?.value?.results || []
      allMatches.push(...results)
    }

    // Deduplicate by file and line
    const uniqueMatches = Array.from(
      new Map(
        allMatches.map(m => [`${m.path}:${m.line_number}`, m])
      ).values()
    )

    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: {
          output: {
            functionName,
            totalDefinitions: uniqueMatches.length,
            definitions: uniqueMatches.map((m: any) => ({
              file: m.path,
              line: m.line_number,
              definition: m.line.trim(),
            })),
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
export async function runCodeSearchExample() {
  console.log('=== Code Search Agent Example ===\n')

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    debug: false,
  })

  adapter.registerAgent(codeSearchAgent)
  adapter.registerAgent(functionSearchAgent)

  // Example 1: Search for a pattern
  console.log('Example 1: Searching for async functions...')
  const result1 = await adapter.executeAgent(
    codeSearchAgent,
    'Find async functions',
    {
      query: 'async function',
      filePattern: '**/*.ts',
      caseSensitive: false,
    }
  )

  const output1 = result1.output as any
  console.log('  Total matches:', output1.summary.totalMatches)
  console.log('  Files with matches:', output1.summary.filesWithMatches)

  if (output1.fileStats.length > 0) {
    console.log('\n  Top files:')
    for (const stat of output1.fileStats.slice(0, 3)) {
      console.log(`    ${stat.file}: ${stat.matchCount} matches`)
    }
  }

  // Example 2: Find specific function
  console.log('\nExample 2: Finding specific function...')
  const result2 = await adapter.executeAgent(
    functionSearchAgent,
    'Find handleSteps function',
    {
      functionName: 'handleSteps',
      filePattern: '**/*.ts',
    }
  )

  const output2 = result2.output as any
  console.log('  Definitions found:', output2.totalDefinitions)

  if (output2.definitions.length > 0) {
    console.log('\n  Locations:')
    for (const def of output2.definitions.slice(0, 3)) {
      console.log(`    ${def.file}:${def.line}`)
    }
  }

  console.log('\n✅ Code Search examples completed!')
}

// Run if executed directly
if (require.main === module) {
  runCodeSearchExample().catch(console.error)
}
