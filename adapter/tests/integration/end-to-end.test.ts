/**
 * End-to-End Integration Tests
 *
 * These tests demonstrate complete workflows using the FREE mode adapter.
 * They verify that the adapter can handle realistic multi-step operations
 * without requiring an API key.
 *
 * Run with: npm test -- tests/integration/end-to-end.test.ts
 */

import { describe, it, expect, beforeAll } from '@jest/globals'
import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as os from 'os'

describe('End-to-End Integration Tests (FREE Mode)', () => {
  let adapter: ClaudeCodeCLIAdapter
  let testDir: string

  beforeAll(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'adapter-e2e-'))

    // Initialize adapter in FREE mode (no API key)
    adapter = new ClaudeCodeCLIAdapter({
      cwd: testDir,
      debug: true,
    })

    // Create test files
    await fs.writeFile(
      path.join(testDir, 'example.ts'),
      `// TODO: Implement this feature
export function hello(name: string) {
  return \`Hello, \${name}!\`
}

// FIXME: Handle edge cases
export function add(a: number, b: number) {
  return a + b
}
`
    )

    await fs.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          typescript: '^5.0.0',
        },
      }, null, 2)
    )

    await fs.mkdir(path.join(testDir, 'src'))
    await fs.writeFile(
      path.join(testDir, 'src', 'index.ts'),
      `import { hello } from '../example'
console.log(hello('World'))
`
    )
  })

  describe('Workflow: File Discovery → Read → Analyze → Report', () => {
    it('should find files, read them, and analyze content', async () => {
      const agent: AgentDefinition = {
        id: 'file-analyzer',
        displayName: 'File Analyzer',
        systemPrompt: 'You analyze files in a project.',
        toolNames: ['find_files', 'read_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          // Step 1: Find all TypeScript files
          const findResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'find_files',
              input: { pattern: '**/*.ts' },
            },
          }

          const files = findResult[0]?.value?.files || []
          expect(files.length).toBeGreaterThan(0)

          // Step 2: Read all found files
          const readResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'read_files',
              input: { paths: files },
            },
          }

          const fileContents = readResult[0]?.value || {}
          expect(Object.keys(fileContents).length).toBeGreaterThan(0)

          // Step 3: Analyze content and create report
          const report = {
            totalFiles: files.length,
            files: Object.entries(fileContents).map(([path, content]) => ({
              path,
              lines: (content as string).split('\n').length,
              hasTodos: (content as string).includes('TODO'),
              hasFixes: (content as string).includes('FIXME'),
            })),
          }

          // Step 4: Set output
          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: { output: report },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)
      const result = await adapter.executeAgent(agent, undefined)

      expect(result.output).toBeDefined()
      const report = result.output as any
      expect(report.totalFiles).toBeGreaterThan(0)
      expect(report.files).toBeInstanceOf(Array)
      expect(report.files.some((f: any) => f.hasTodos)).toBe(true)
    })
  })

  describe('Workflow: Code Search → Extract Results → Format Output', () => {
    it('should search for patterns and format results', async () => {
      const agent: AgentDefinition = {
        id: 'todo-finder',
        displayName: 'TODO Finder',
        systemPrompt: 'You find TODO comments in code.',
        toolNames: ['code_search', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          // Step 1: Search for TODO comments
          const searchResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'code_search',
              input: {
                query: 'TODO',
                file_pattern: '*.ts',
              },
            },
          }

          const searchData = searchResult[0]?.value || {}
          const results = searchData.results || []

          // Step 2: Format results
          const formatted = {
            totalTodos: results.length,
            todos: results.map((r: any) => ({
              file: r.path,
              line: r.line_number,
              text: r.line.trim(),
            })),
          }

          // Step 3: Set output
          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: { output: formatted },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)
      const result = await adapter.executeAgent(agent, undefined)

      expect(result.output).toBeDefined()
      const output = result.output as any
      expect(output.totalTodos).toBeGreaterThan(0)
      expect(output.todos).toBeInstanceOf(Array)
      expect(output.todos[0]).toHaveProperty('file')
      expect(output.todos[0]).toHaveProperty('line')
    })
  })

  describe('Workflow: Execute Command → Parse Output → Store Results', () => {
    it('should execute command and process results', async () => {
      const agent: AgentDefinition = {
        id: 'command-executor',
        displayName: 'Command Executor',
        systemPrompt: 'You execute commands and process results.',
        toolNames: ['run_terminal_command', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          // Step 1: Execute command
          const cmdResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'run_terminal_command',
              input: {
                command: 'ls -la',
              },
            },
          }

          const output = cmdResult[0]?.value?.output || ''

          // Step 2: Parse output (count lines)
          const lines = output.split('\n').filter(Boolean)
          const fileCount = lines.length - 1 // Exclude header

          // Step 3: Store results
          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: {
                output: {
                  command: 'ls -la',
                  fileCount,
                  exitCode: cmdResult[0]?.value?.exit_code,
                },
              },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)
      const result = await adapter.executeAgent(agent, undefined)

      expect(result.output).toBeDefined()
      const output = result.output as any
      expect(output.fileCount).toBeGreaterThan(0)
      expect(output.exitCode).toBe(0)
    })
  })

  describe('Workflow: Multi-Step Agent Execution', () => {
    it('should handle complex multi-step workflow', async () => {
      const agent: AgentDefinition = {
        id: 'project-analyzer',
        displayName: 'Project Analyzer',
        systemPrompt: 'You analyze project structure.',
        toolNames: ['find_files', 'read_files', 'code_search', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          const analysis: any = {}

          // Step 1: Find all files
          const findResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'find_files',
              input: { pattern: '**/*.*' },
            },
          }
          analysis.totalFiles = findResult[0]?.value?.files?.length || 0

          // Step 2: Find TypeScript files
          const tsResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'find_files',
              input: { pattern: '**/*.ts' },
            },
          }
          analysis.tsFiles = tsResult[0]?.value?.files?.length || 0

          // Step 3: Search for imports
          const importResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'code_search',
              input: {
                query: '^import ',
                file_pattern: '*.ts',
              },
            },
          }
          analysis.importStatements = importResult[0]?.value?.total || 0

          // Step 4: Read package.json
          const readResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'read_files',
              input: { paths: ['package.json'] },
            },
          }
          const packageJson = readResult[0]?.value?.['package.json']
          if (packageJson) {
            const pkg = JSON.parse(packageJson as string)
            analysis.dependencies = Object.keys(pkg.dependencies || {}).length
          }

          // Step 5: Set output
          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: { output: analysis },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)
      const result = await adapter.executeAgent(agent, undefined)

      expect(result.output).toBeDefined()
      const analysis = result.output as any
      expect(analysis.totalFiles).toBeGreaterThan(0)
      expect(analysis.tsFiles).toBeGreaterThan(0)
      expect(analysis.importStatements).toBeGreaterThan(0)
      expect(analysis.dependencies).toBeGreaterThan(0)
    })
  })

  describe('Workflow: Error Recovery and Retry', () => {
    it('should handle errors gracefully', async () => {
      const agent: AgentDefinition = {
        id: 'error-handler',
        displayName: 'Error Handler',
        systemPrompt: 'You handle errors gracefully.',
        toolNames: ['read_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          // Try to read non-existent file
          const readResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'read_files',
              input: { paths: ['nonexistent.txt', 'example.ts'] },
            },
          }

          const fileContents = readResult[0]?.value || {}

          // Check which files were read successfully
          const result = {
            attempted: ['nonexistent.txt', 'example.ts'],
            successful: Object.entries(fileContents)
              .filter(([_, content]) => content !== null)
              .map(([path, _]) => path),
            failed: Object.entries(fileContents)
              .filter(([_, content]) => content === null)
              .map(([path, _]) => path),
          }

          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: { output: result },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)
      const result = await adapter.executeAgent(agent, undefined)

      expect(result.output).toBeDefined()
      const output = result.output as any
      expect(output.successful).toContain('example.ts')
      expect(output.failed).toContain('nonexistent.txt')
    })
  })

  describe('Workflow: File Creation and Modification', () => {
    it('should create and modify files', async () => {
      const agent: AgentDefinition = {
        id: 'file-manager',
        displayName: 'File Manager',
        systemPrompt: 'You manage files.',
        toolNames: ['write_file', 'read_files', 'str_replace', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          // Step 1: Create new file
          const writeResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'write_file',
              input: {
                path: 'test-output.txt',
                content: 'Original content',
              },
            },
          }

          expect(writeResult[0]?.value?.success).toBe(true)

          // Step 2: Modify file
          const replaceResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'str_replace',
              input: {
                path: 'test-output.txt',
                old_string: 'Original',
                new_string: 'Modified',
              },
            },
          }

          expect(replaceResult[0]?.value?.success).toBe(true)

          // Step 3: Verify modification
          const readResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'read_files',
              input: { paths: ['test-output.txt'] },
            },
          }

          const content = readResult[0]?.value?.['test-output.txt']
          expect(content).toBe('Modified content')

          // Step 4: Set output
          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: {
                output: {
                  created: true,
                  modified: true,
                  finalContent: content,
                },
              },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)
      const result = await adapter.executeAgent(agent, undefined)

      expect(result.output).toBeDefined()
      const output = result.output as any
      expect(output.created).toBe(true)
      expect(output.modified).toBe(true)
      expect(output.finalContent).toBe('Modified content')
    })
  })
})
