/**
 * Example 14: Documentation Generator Agent
 *
 * Generates documentation from code by extracting JSDoc comments and function signatures.
 *
 * Features:
 * - Extract JSDoc comments
 * - Find exported functions/classes
 * - Generate markdown documentation
 * - Create API reference
 *
 * Tools used: code_search, read_files, write_file, set_output
 */

import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'

export const documentationGeneratorAgent: AgentDefinition = {
  id: 'documentation-generator',
  displayName: 'Documentation Generator',
  systemPrompt: 'You generate documentation from code.',
  toolNames: ['code_search', 'read_files', 'write_file', 'set_output'],
  outputMode: 'structured_output',

  async *handleSteps(context) {
    const filePattern = (context.params?.filePattern as string) || '*.ts'
    const outputFile = (context.params?.outputFile as string) || 'API.md'

    // Find exported functions
    const exportResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'code_search',
        input: {
          query: 'export (function|class|const|interface)',
          file_pattern: filePattern,
        },
      },
    }

    const exports = exportResult[0]?.value?.results || []

    // Build documentation
    let markdown = '# API Documentation\n\n'
    markdown += `Generated on ${new Date().toISOString()}\n\n`
    markdown += '## Table of Contents\n\n'

    const byFile: Record<string, any[]> = {}

    for (const exp of exports) {
      const file = exp.path as string
      if (!byFile[file]) {
        byFile[file] = []
      }
      byFile[file].push({
        line: exp.line_number,
        code: (exp.line as string).trim(),
      })
    }

    for (const [file, items] of Object.entries(byFile)) {
      markdown += `\n## ${file}\n\n`

      for (const item of items) {
        markdown += '### ' + item.code.split('(')[0].replace('export ', '') + '\n\n'
        markdown += '```typescript\n'
        markdown += item.code + '\n'
        markdown += '```\n\n'
        markdown += `_Defined in ${file}:${item.line}_\n\n`
      }
    }

    // Write documentation file
    const writeResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'write_file',
        input: {
          path: outputFile,
          content: markdown,
        },
      },
    }

    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: {
          output: {
            success: writeResult[0]?.value?.success,
            outputFile,
            totalExports: exports.length,
            filesDocumented: Object.keys(byFile).length,
            documentLength: markdown.length,
          },
        },
      },
    }

    return 'DONE'
  },
}

export async function runDocumentationGeneratorExample() {
  console.log('=== Documentation Generator Agent Example ===\n')

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    debug: false,
  })

  adapter.registerAgent(documentationGeneratorAgent)

  const result = await adapter.executeAgent(
    documentationGeneratorAgent,
    'Generate API docs',
    {
      filePattern: 'src/**/*.ts',
      outputFile: 'docs/API.md',
    }
  )

  const output = result.output as any
  console.log('Documentation generated:', output.outputFile)
  console.log('Total exports:', output.totalExports)
  console.log('Files documented:', output.filesDocumented)
  console.log('\n✅ Documentation Generator example completed!')
}

if (require.main === module) {
  runDocumentationGeneratorExample().catch(console.error)
}
