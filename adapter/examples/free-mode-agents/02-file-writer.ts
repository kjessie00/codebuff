/**
 * Example 2: File Writer Agent
 *
 * An agent that creates and writes files with specific content.
 * Demonstrates file creation, directory handling, and verification.
 *
 * Features:
 * - Create new files with content
 * - Create directories automatically
 * - Verify file was written successfully
 * - Template-based file generation
 *
 * Tools used: write_file, read_files, set_output
 */

import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'

/**
 * File Writer Agent Definition
 */
export const fileWriterAgent: AgentDefinition = {
  id: 'file-writer',
  displayName: 'File Writer',
  systemPrompt: 'You are a file writing agent that creates files with specific content.',
  instructionsPrompt: 'Write files with the specified content and verify they were created successfully.',
  toolNames: ['write_file', 'read_files', 'set_output'],
  outputMode: 'structured_output',

  async *handleSteps(context) {
    const path = (context.params?.path as string) || 'output.txt'
    const content = (context.params?.content as string) || 'Default content'
    const verify = (context.params?.verify as boolean) ?? true

    // Write the file
    const writeResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'write_file',
        input: { path, content },
      },
    }

    const writeSuccess = writeResult[0]?.value?.success

    let verification = null

    // Verify if requested
    if (verify && writeSuccess) {
      const readResult = yield {
        type: 'TOOL_CALL',
        toolCall: {
          toolName: 'read_files',
          input: { paths: [path] },
        },
      }

      const readContent = readResult[0]?.value?.[path]
      verification = {
        verified: readContent === content,
        expectedLength: content.length,
        actualLength: readContent ? (readContent as string).length : 0,
      }
    }

    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: {
          output: {
            success: writeSuccess,
            path,
            contentLength: content.length,
            verification,
          },
        },
      },
    }

    return 'DONE'
  },
}

/**
 * Template Generator Agent
 *
 * Generates files from templates with variable substitution.
 */
export const templateGeneratorAgent: AgentDefinition = {
  id: 'template-generator',
  displayName: 'Template Generator',
  systemPrompt: 'You generate files from templates.',
  toolNames: ['write_file', 'set_output'],
  outputMode: 'structured_output',

  async *handleSteps(context) {
    const templateType = (context.params?.templateType as string) || 'typescript'
    const name = (context.params?.name as string) || 'example'

    let content = ''
    let filename = ''

    switch (templateType) {
      case 'typescript':
        filename = `${name}.ts`
        content = `/**
 * ${name}
 *
 * Auto-generated TypeScript file
 */

export class ${name.charAt(0).toUpperCase() + name.slice(1)} {
  constructor() {
    // TODO: Implement constructor
  }

  public async execute(): Promise<void> {
    // TODO: Implement execute
  }
}
`
        break

      case 'readme':
        filename = 'README.md'
        content = `# ${name}

## Description

TODO: Add description

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`bash
npm start
\`\`\`

## License

MIT
`
        break

      case 'package':
        filename = 'package.json'
        content = JSON.stringify({
          name,
          version: '1.0.0',
          description: 'TODO: Add description',
          main: 'index.js',
          scripts: {
            test: 'jest',
          },
          keywords: [],
          author: '',
          license: 'MIT',
        }, null, 2)
        break

      default:
        filename = `${name}.txt`
        content = `Generated file: ${name}`
    }

    const writeResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'write_file',
        input: { path: filename, content },
      },
    }

    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: {
          output: {
            success: writeResult[0]?.value?.success,
            filename,
            templateType,
            linesGenerated: content.split('\n').length,
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
export async function runFileWriterExample() {
  console.log('=== File Writer Agent Example ===\n')

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    debug: true,
  })

  adapter.registerAgent(fileWriterAgent)
  adapter.registerAgent(templateGeneratorAgent)

  // Example 1: Write a simple file
  console.log('Example 1: Writing a simple file...')
  const result1 = await adapter.executeAgent(
    fileWriterAgent,
    'Create test file',
    {
      path: 'test-output.txt',
      content: 'Hello from the File Writer Agent!',
      verify: true,
    }
  )

  console.log('Result:', JSON.stringify(result1.output, null, 2))

  // Example 2: Write file with directory creation
  console.log('\nExample 2: Writing file in new directory...')
  const result2 = await adapter.executeAgent(
    fileWriterAgent,
    'Create file in nested directory',
    {
      path: 'output/nested/test.txt',
      content: 'This file is in a nested directory!',
      verify: true,
    }
  )

  console.log('Success:', (result2.output as any).success)
  console.log('Verified:', (result2.output as any).verification?.verified)

  // Example 3: Generate TypeScript file from template
  console.log('\nExample 3: Generating TypeScript file from template...')
  const result3 = await adapter.executeAgent(
    templateGeneratorAgent,
    'Generate TypeScript class',
    {
      templateType: 'typescript',
      name: 'myService',
    }
  )

  console.log('Result:', JSON.stringify(result3.output, null, 2))

  // Example 4: Generate README from template
  console.log('\nExample 4: Generating README from template...')
  const result4 = await adapter.executeAgent(
    templateGeneratorAgent,
    'Generate README',
    {
      templateType: 'readme',
      name: 'My Awesome Project',
    }
  )

  console.log('Result:', JSON.stringify(result4.output, null, 2))

  console.log('\n✅ File Writer examples completed!')
}

// Run if executed directly
if (require.main === module) {
  runFileWriterExample().catch(console.error)
}
