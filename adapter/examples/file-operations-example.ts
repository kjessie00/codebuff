/**
 * Example: Using FileOperationsTools
 *
 * This example demonstrates how to use the FileOperationsTools class
 * to read, write, and edit files in a Codebuff agent adapter.
 */

import { FileOperationsTools } from '../src/tools/file-operations'
import path from 'path'

async function main() {
  // Initialize the tools with the current working directory
  const cwd = process.cwd()
  const tools = new FileOperationsTools(cwd)

  console.log('=== File Operations Tools Example ===\n')
  console.log(`Working directory: ${cwd}\n`)

  // ============================================================================
  // Example 1: Reading Files
  // ============================================================================
  console.log('Example 1: Reading Files')
  console.log('-------------------------')

  try {
    const readResult = await tools.readFiles({
      paths: ['package.json', 'tsconfig.json', 'non-existent.txt'],
    })

    console.log('Read result:')
    const files = readResult[0].value as Record<string, string | null>

    for (const [filepath, content] of Object.entries(files)) {
      if (content !== null) {
        console.log(`✓ ${filepath} (${content.length} characters)`)
      } else {
        console.log(`✗ ${filepath} (file not found)`)
      }
    }
  } catch (error) {
    console.error('Error reading files:', error)
  }

  console.log()

  // ============================================================================
  // Example 2: Writing a File
  // ============================================================================
  console.log('Example 2: Writing a File')
  console.log('-------------------------')

  try {
    const exampleContent = `# Example File

This file was created by the FileOperationsTools example.
Created at: ${new Date().toISOString()}

## Features
- Automatic directory creation
- UTF-8 encoding support
- Error handling
`

    const writeResult = await tools.writeFile({
      path: '.temp/example-file.md',
      content: exampleContent,
    })

    const writeValue = writeResult[0].value as {
      success: boolean
      path: string
      error?: string
    }

    if (writeValue.success) {
      console.log(`✓ File written successfully: ${writeValue.path}`)
    } else {
      console.log(`✗ Failed to write file: ${writeValue.error}`)
    }
  } catch (error) {
    console.error('Error writing file:', error)
  }

  console.log()

  // ============================================================================
  // Example 3: String Replacement
  // ============================================================================
  console.log('Example 3: String Replacement')
  console.log('-----------------------------')

  try {
    // First, create a file to edit
    const originalContent = `const API_URL = 'http://localhost:3000'
const DEBUG_MODE = true
const VERSION = '1.0.0'
`

    await tools.writeFile({
      path: '.temp/config.ts',
      content: originalContent,
    })

    console.log('Original content:')
    console.log(originalContent)

    // Now replace a string
    const replaceResult = await tools.strReplace({
      path: '.temp/config.ts',
      old_string: "const API_URL = 'http://localhost:3000'",
      new_string: "const API_URL = 'https://api.production.com'",
    })

    const replaceValue = replaceResult[0].value as {
      success: boolean
      path: string
      error?: string
    }

    if (replaceValue.success) {
      console.log(`✓ String replaced successfully`)

      // Read the file to verify
      const verifyResult = await tools.readFiles({
        paths: ['.temp/config.ts'],
      })
      const newContent = (verifyResult[0].value as Record<string, string>)[
        '.temp/config.ts'
      ]
      console.log('\nNew content:')
      console.log(newContent)
    } else {
      console.log(`✗ Failed to replace string: ${replaceValue.error}`)
    }
  } catch (error) {
    console.error('Error replacing string:', error)
  }

  console.log()

  // ============================================================================
  // Example 4: Error Handling
  // ============================================================================
  console.log('Example 4: Error Handling')
  console.log('-------------------------')

  // Try to replace a string that doesn't exist
  const errorResult = await tools.strReplace({
    path: '.temp/config.ts',
    old_string: 'THIS_STRING_DOES_NOT_EXIST',
    new_string: 'replacement',
  })

  const errorValue = errorResult[0].value as {
    success: boolean
    error?: string
    old_string?: string
  }

  if (!errorValue.success) {
    console.log(`✓ Error handled correctly: ${errorValue.error}`)
    console.log(`  Old string was: "${errorValue.old_string}"`)
  }

  console.log()

  // ============================================================================
  // Example 5: Working with Agent handleSteps
  // ============================================================================
  console.log('Example 5: Integration with Agent handleSteps')
  console.log('----------------------------------------------')

  // Simulate how this would be used in an agent's handleSteps function
  console.log(`
In your agent definition, you would use it like this:

handleSteps: function* ({ agentState, prompt, params }) {
  // Read configuration files
  const { toolResult } = yield {
    toolName: 'read_files',
    input: { paths: ['tsconfig.json', 'package.json'] }
  }

  // The tool result will be in the same format
  const files = toolResult[0].value

  // Process files and write output
  yield {
    toolName: 'write_file',
    input: {
      path: 'output/analysis.md',
      content: '# Analysis Results\\n...'
    }
  }

  // Edit a specific file
  yield {
    toolName: 'str_replace',
    input: {
      path: 'src/config.ts',
      old_string: 'DEBUG = true',
      new_string: 'DEBUG = false'
    }
  }
}
  `)

  console.log('\n=== Example Complete ===')
}

// Run the example
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
