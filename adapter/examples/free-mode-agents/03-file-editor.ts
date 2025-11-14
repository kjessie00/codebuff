/**
 * Example 3: File Editor Agent
 *
 * An agent that makes precise edits to existing files using string replacement.
 * Demonstrates find-and-replace operations with verification.
 *
 * Features:
 * - Find and replace strings in files
 * - Multiple replacements in sequence
 * - Verify replacements were successful
 * - Pattern-based editing
 *
 * Tools used: read_files, str_replace, set_output
 */

import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'

/**
 * File Editor Agent Definition
 */
export const fileEditorAgent: AgentDefinition = {
  id: 'file-editor',
  displayName: 'File Editor',
  systemPrompt: 'You are a file editing agent that makes precise changes to files.',
  instructionsPrompt: 'Edit files by replacing specific strings with new content.',
  toolNames: ['read_files', 'str_replace', 'set_output'],
  outputMode: 'structured_output',

  async *handleSteps(context) {
    const path = (context.params?.path as string) || 'file.txt'
    const oldString = (context.params?.oldString as string) || ''
    const newString = (context.params?.newString as string) || ''

    // Read the file before editing
    const beforeResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'read_files',
        input: { paths: [path] },
      },
    }

    const beforeContent = beforeResult[0]?.value?.[path]

    if (beforeContent === null) {
      yield {
        type: 'TOOL_CALL',
        toolCall: {
          toolName: 'set_output',
          input: {
            output: {
              success: false,
              error: 'File not found',
              path,
            },
          },
        },
      }
      return 'DONE'
    }

    // Perform the replacement
    const replaceResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'str_replace',
        input: { path, old_string: oldString, new_string: newString },
      },
    }

    const replaceSuccess = replaceResult[0]?.value?.success

    // Read the file after editing to verify
    const afterResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'read_files',
        input: { paths: [path] },
      },
    }

    const afterContent = afterResult[0]?.value?.[path]

    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: {
          output: {
            success: replaceSuccess,
            path,
            replacement: {
              from: oldString,
              to: newString,
            },
            verification: {
              oldStringPresent: (beforeContent as string).includes(oldString),
              newStringPresent: afterContent ? (afterContent as string).includes(newString) : false,
              contentChanged: beforeContent !== afterContent,
            },
          },
        },
      },
    }

    return 'DONE'
  },
}

/**
 * Batch Editor Agent
 *
 * Makes multiple edits to a file in sequence.
 */
export const batchEditorAgent: AgentDefinition = {
  id: 'batch-editor',
  displayName: 'Batch Editor',
  systemPrompt: 'You make multiple edits to files in sequence.',
  toolNames: ['read_files', 'str_replace', 'set_output'],
  outputMode: 'structured_output',

  async *handleSteps(context) {
    const path = (context.params?.path as string) || 'file.txt'
    const replacements = (context.params?.replacements as Array<{
      old: string
      new: string
    }>) || []

    // Read initial content
    const initialResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'read_files',
        input: { paths: [path] },
      },
    }

    const initialContent = initialResult[0]?.value?.[path]

    if (initialContent === null) {
      yield {
        type: 'TOOL_CALL',
        toolCall: {
          toolName: 'set_output',
          input: {
            output: {
              success: false,
              error: 'File not found',
            },
          },
        },
      }
      return 'DONE'
    }

    // Perform each replacement
    const results: any[] = []

    for (const replacement of replacements) {
      const replaceResult = yield {
        type: 'TOOL_CALL',
        toolCall: {
          toolName: 'str_replace',
          input: {
            path,
            old_string: replacement.old,
            new_string: replacement.new,
          },
        },
      }

      results.push({
        from: replacement.old,
        to: replacement.new,
        success: replaceResult[0]?.value?.success,
      })
    }

    // Read final content
    const finalResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'read_files',
        input: { paths: [path] },
      },
    }

    const finalContent = finalResult[0]?.value?.[path]

    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: {
          output: {
            success: results.every(r => r.success),
            path,
            totalReplacements: replacements.length,
            successfulReplacements: results.filter(r => r.success).length,
            replacements: results,
            before: initialContent,
            after: finalContent,
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
export async function runFileEditorExample() {
  console.log('=== File Editor Agent Example ===\n')

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    debug: true,
  })

  adapter.registerAgent(fileEditorAgent)
  adapter.registerAgent(batchEditorAgent)

  // Create a test file first
  const fs = require('fs/promises')
  await fs.writeFile('edit-test.txt', `Hello World
This is a test file
Version: 1.0.0
Status: development
`)

  // Example 1: Simple replacement
  console.log('Example 1: Simple string replacement...')
  const result1 = await adapter.executeAgent(
    fileEditorAgent,
    'Update version number',
    {
      path: 'edit-test.txt',
      oldString: 'Version: 1.0.0',
      newString: 'Version: 2.0.0',
    }
  )

  console.log('Result:', JSON.stringify(result1.output, null, 2))

  // Example 2: Batch replacements
  console.log('\nExample 2: Multiple replacements...')
  const result2 = await adapter.executeAgent(
    batchEditorAgent,
    'Update multiple values',
    {
      path: 'edit-test.txt',
      replacements: [
        { old: 'Version: 2.0.0', new: 'Version: 3.0.0' },
        { old: 'Status: development', new: 'Status: production' },
        { old: 'Hello World', new: 'Hello Universe' },
      ],
    }
  )

  console.log('Successful replacements:', (result2.output as any).successfulReplacements)
  console.log('Total replacements:', (result2.output as any).totalReplacements)

  console.log('\n✅ File Editor examples completed!')
}

// Run if executed directly
if (require.main === module) {
  runFileEditorExample().catch(console.error)
}
