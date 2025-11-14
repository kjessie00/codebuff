/**
 * Example 1: File Reader Agent
 *
 * A simple agent that reads specific files and returns their contents.
 * This is the most basic example of using the adapter in FREE mode.
 *
 * Features:
 * - Read single or multiple files
 * - Returns structured output with file contents
 * - Handles missing files gracefully
 *
 * Tools used: read_files, set_output
 */

import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'

/**
 * File Reader Agent Definition
 *
 * Reads files and returns their contents in a structured format.
 */
export const fileReaderAgent: AgentDefinition = {
  id: 'file-reader',
  displayName: 'File Reader',
  systemPrompt: 'You are a file reading agent that reads files and returns their contents.',
  instructionsPrompt: 'Read the specified files and return their contents in a structured format.',
  toolNames: ['read_files', 'set_output'],
  outputMode: 'structured_output',

  async *handleSteps(context) {
    // Get file paths from parameters or prompt
    const paths = (context.params?.paths as string[]) || ['README.md']

    // Read the files
    const readResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'read_files',
        input: { paths },
      },
    }

    const fileContents = readResult[0]?.value || {}

    // Separate successful and failed reads
    const files: any[] = []
    const errors: any[] = []

    for (const [filePath, content] of Object.entries(fileContents)) {
      if (content !== null) {
        files.push({
          path: filePath,
          content,
          size: (content as string).length,
          lines: (content as string).split('\n').length,
        })
      } else {
        errors.push({
          path: filePath,
          error: 'File not found or could not be read',
        })
      }
    }

    // Set structured output
    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: {
          output: {
            success: true,
            filesRead: files.length,
            errors: errors.length,
            files,
            errorDetails: errors,
          },
        },
      },
    }

    return 'DONE'
  },
}

/**
 * Example usage function
 */
export async function runFileReaderExample() {
  console.log('=== File Reader Agent Example ===\n')

  // Create adapter
  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    debug: true,
  })

  // Register agent
  adapter.registerAgent(fileReaderAgent)

  // Example 1: Read a single file
  console.log('Example 1: Reading package.json...')
  const result1 = await adapter.executeAgent(
    fileReaderAgent,
    'Read package.json',
    { paths: ['package.json'] }
  )

  console.log('Result:', JSON.stringify(result1.output, null, 2))

  // Example 2: Read multiple files
  console.log('\nExample 2: Reading multiple files...')
  const result2 = await adapter.executeAgent(
    fileReaderAgent,
    'Read README and package.json',
    { paths: ['README.md', 'package.json', 'tsconfig.json'] }
  )

  console.log('Files read:', (result2.output as any).filesRead)
  console.log('Errors:', (result2.output as any).errors)

  // Example 3: Handle missing files
  console.log('\nExample 3: Handling missing files...')
  const result3 = await adapter.executeAgent(
    fileReaderAgent,
    'Try to read missing file',
    { paths: ['missing.txt', 'package.json'] }
  )

  console.log('Result:', JSON.stringify(result3.output, null, 2))

  console.log('\n✅ File Reader examples completed!')
}

/**
 * How to modify this example:
 *
 * 1. Add file filtering:
 *    - Filter by file extension
 *    - Only read files smaller than a certain size
 *    - Skip binary files
 *
 * 2. Add content analysis:
 *    - Count words/lines
 *    - Extract metadata (author, date)
 *    - Find specific patterns
 *
 * 3. Add caching:
 *    - Cache file contents
 *    - Only re-read if file changed
 *
 * 4. Add transformation:
 *    - Convert markdown to HTML
 *    - Format code
 *    - Minify content
 */

// Run if executed directly
if (require.main === module) {
  runFileReaderExample().catch(console.error)
}
