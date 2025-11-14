/**
 * Agent Execution Pattern Tests
 *
 * These tests demonstrate different agent execution patterns and best practices
 * for building agents in FREE mode.
 *
 * Run with: npm test -- tests/integration/agent-execution.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as os from 'os'

describe('Agent Execution Patterns (FREE Mode)', () => {
  let adapter: ClaudeCodeCLIAdapter
  let testDir: string

  beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'adapter-agents-'))

    adapter = new ClaudeCodeCLIAdapter({
      cwd: testDir,
      debug: false,
    })

    // Create test file
    await fs.writeFile(
      path.join(testDir, 'data.txt'),
      'Hello World\nThis is a test\nAnother line'
    )
  })

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe('Pattern: Simple Single-Step Agent', () => {
    it('should execute single tool call and return result', async () => {
      const agent: AgentDefinition = {
        id: 'simple-reader',
        displayName: 'Simple File Reader',
        systemPrompt: 'Read a file.',
        toolNames: ['read_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          // Single tool call
          const result = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'read_files',
              input: { paths: ['data.txt'] },
            },
          }

          // Set output
          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: {
                output: {
                  content: result[0]?.value?.['data.txt'],
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
      expect(output.content).toContain('Hello World')
    })
  })

  describe('Pattern: Multi-Step Agent with Sequential Operations', () => {
    it('should execute multiple steps sequentially', async () => {
      const agent: AgentDefinition = {
        id: 'multi-step-processor',
        displayName: 'Multi-Step Processor',
        systemPrompt: 'Process data in multiple steps.',
        toolNames: ['read_files', 'write_file', 'read_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          // Step 1: Read input
          const readResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'read_files',
              input: { paths: ['data.txt'] },
            },
          }

          const content = readResult[0]?.value?.['data.txt'] as string

          // Step 2: Transform data
          const transformed = content.toUpperCase()

          // Step 3: Write output
          const writeResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'write_file',
              input: {
                path: 'output.txt',
                content: transformed,
              },
            },
          }

          // Step 4: Verify output
          const verifyResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'read_files',
              input: { paths: ['output.txt'] },
            },
          }

          // Step 5: Set final output
          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: {
                output: {
                  original: content,
                  transformed: verifyResult[0]?.value?.['output.txt'],
                  success: writeResult[0]?.value?.success,
                },
              },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)
      const result = await adapter.executeAgent(agent, undefined)

      const output = result.output as any
      expect(output.success).toBe(true)
      expect(output.transformed).toBe('HELLO WORLD\nTHIS IS A TEST\nANOTHER LINE')
    })
  })

  describe('Pattern: Agent with set_output', () => {
    it('should properly set structured output', async () => {
      const agent: AgentDefinition = {
        id: 'output-setter',
        displayName: 'Output Setter',
        systemPrompt: 'Set structured output.',
        toolNames: ['find_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          const findResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'find_files',
              input: { pattern: '*.txt' },
            },
          }

          const files = findResult[0]?.value?.files || []

          // Set structured output
          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: {
                output: {
                  status: 'success',
                  fileCount: files.length,
                  files: files,
                  metadata: {
                    timestamp: new Date().toISOString(),
                    source: 'output-setter',
                  },
                },
              },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)
      const result = await adapter.executeAgent(agent, undefined)

      const output = result.output as any
      expect(output.status).toBe('success')
      expect(output.fileCount).toBeGreaterThan(0)
      expect(output.metadata).toHaveProperty('timestamp')
      expect(output.metadata.source).toBe('output-setter')
    })
  })

  describe('Pattern: Agent with Error Handling', () => {
    it('should handle errors gracefully', async () => {
      const agent: AgentDefinition = {
        id: 'error-handler',
        displayName: 'Error Handler',
        systemPrompt: 'Handle errors gracefully.',
        toolNames: ['read_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          // Try to read files (some may not exist)
          const readResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'read_files',
              input: { paths: ['data.txt', 'missing.txt', 'also-missing.txt'] },
            },
          }

          const fileContents = readResult[0]?.value || {}

          // Separate successful and failed reads
          const successful: string[] = []
          const failed: string[] = []

          for (const [filePath, content] of Object.entries(fileContents)) {
            if (content !== null) {
              successful.push(filePath)
            } else {
              failed.push(filePath)
            }
          }

          // Set output with error information
          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: {
                output: {
                  status: failed.length > 0 ? 'partial_success' : 'success',
                  successful,
                  failed,
                  totalAttempted: successful.length + failed.length,
                },
              },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)
      const result = await adapter.executeAgent(agent, undefined)

      const output = result.output as any
      expect(output.status).toBe('partial_success')
      expect(output.successful).toContain('data.txt')
      expect(output.failed).toContain('missing.txt')
      expect(output.failed).toContain('also-missing.txt')
      expect(output.totalAttempted).toBe(3)
    })
  })

  describe('Pattern: Agent with Conditional Logic', () => {
    it('should execute different paths based on conditions', async () => {
      const agent: AgentDefinition = {
        id: 'conditional-agent',
        displayName: 'Conditional Agent',
        systemPrompt: 'Execute conditional logic.',
        toolNames: ['find_files', 'write_file', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          // Find text files
          const findResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'find_files',
              input: { pattern: '*.txt' },
            },
          }

          const files = findResult[0]?.value?.files || []

          // Conditional: if files found, process them; otherwise create a default
          if (files.length > 0) {
            yield {
              type: 'TOOL_CALL',
              toolCall: {
                toolName: 'set_output',
                input: {
                  output: {
                    path: 'existing_files',
                    fileCount: files.length,
                    files,
                  },
                },
              },
            }
          } else {
            // No files found, create default
            yield {
              type: 'TOOL_CALL',
              toolCall: {
                toolName: 'write_file',
                input: {
                  path: 'default.txt',
                  content: 'No files found, created default',
                },
              },
            }

            yield {
              type: 'TOOL_CALL',
              toolCall: {
                toolName: 'set_output',
                input: {
                  output: {
                    path: 'created_default',
                    message: 'No files found, created default',
                  },
                },
              },
            }
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)
      const result = await adapter.executeAgent(agent, undefined)

      const output = result.output as any
      expect(output.path).toBe('existing_files')
      expect(output.fileCount).toBeGreaterThan(0)
    })
  })

  describe('Pattern: Agent with Data Transformation', () => {
    it('should transform data through multiple steps', async () => {
      const agent: AgentDefinition = {
        id: 'data-transformer',
        displayName: 'Data Transformer',
        systemPrompt: 'Transform data.',
        toolNames: ['read_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          // Read input
          const readResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'read_files',
              input: { paths: ['data.txt'] },
            },
          }

          const content = readResult[0]?.value?.['data.txt'] as string

          // Transform: split lines, count words, etc.
          const lines = content.split('\n')
          const wordCount = content.split(/\s+/).length
          const charCount = content.length
          const lineCount = lines.length

          const longestLine = lines.reduce((a, b) =>
            a.length > b.length ? a : b
          )

          const wordFrequency: Record<string, number> = {}
          content.split(/\s+/).forEach(word => {
            const normalized = word.toLowerCase().replace(/[^\w]/g, '')
            if (normalized) {
              wordFrequency[normalized] = (wordFrequency[normalized] || 0) + 1
            }
          })

          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: {
                output: {
                  stats: {
                    lines: lineCount,
                    words: wordCount,
                    chars: charCount,
                  },
                  longestLine: {
                    text: longestLine,
                    length: longestLine.length,
                  },
                  wordFrequency,
                },
              },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)
      const result = await adapter.executeAgent(agent, undefined)

      const output = result.output as any
      expect(output.stats.lines).toBe(3)
      expect(output.stats.words).toBeGreaterThan(0)
      expect(output.longestLine).toHaveProperty('text')
      expect(output.wordFrequency).toHaveProperty('hello')
    })
  })

  describe('Pattern: Agent with Aggregation', () => {
    it('should aggregate data from multiple sources', async () => {
      // Create additional test files
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'Content 1')
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'Content 2')
      await fs.writeFile(path.join(testDir, 'file3.txt'), 'Content 3')

      const agent: AgentDefinition = {
        id: 'aggregator',
        displayName: 'Data Aggregator',
        systemPrompt: 'Aggregate data from multiple files.',
        toolNames: ['find_files', 'read_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          // Find all text files
          const findResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'find_files',
              input: { pattern: '*.txt' },
            },
          }

          const files = findResult[0]?.value?.files || []

          // Read all files
          const readResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'read_files',
              input: { paths: files },
            },
          }

          const fileContents = readResult[0]?.value || {}

          // Aggregate statistics
          let totalLines = 0
          let totalChars = 0
          const filesData: any[] = []

          for (const [filePath, content] of Object.entries(fileContents)) {
            if (content !== null) {
              const lines = (content as string).split('\n').length
              const chars = (content as string).length

              totalLines += lines
              totalChars += chars

              filesData.push({
                path: filePath,
                lines,
                chars,
              })
            }
          }

          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: {
                output: {
                  summary: {
                    totalFiles: filesData.length,
                    totalLines,
                    totalChars,
                    avgLinesPerFile: Math.round(totalLines / filesData.length),
                    avgCharsPerFile: Math.round(totalChars / filesData.length),
                  },
                  files: filesData,
                },
              },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)
      const result = await adapter.executeAgent(agent, undefined)

      const output = result.output as any
      expect(output.summary.totalFiles).toBeGreaterThan(0)
      expect(output.summary.totalLines).toBeGreaterThan(0)
      expect(output.files).toBeInstanceOf(Array)
    })
  })

  describe('Pattern: Agent with Parameter-Based Execution', () => {
    it('should use parameters to customize execution', async () => {
      const agent: AgentDefinition = {
        id: 'parameterized-agent',
        displayName: 'Parameterized Agent',
        systemPrompt: 'Execute based on parameters.',
        toolNames: ['find_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          // Get parameters
          const pattern = (context.params?.pattern as string) || '**/*'
          const includeStats = (context.params?.includeStats as boolean) ?? true

          // Find files based on pattern
          const findResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'find_files',
              input: { pattern },
            },
          }

          const files = findResult[0]?.value?.files || []

          const output: any = {
            pattern,
            fileCount: files.length,
            files,
          }

          if (includeStats) {
            // Add statistics
            const extensions = new Set(files.map(f => path.extname(f)))
            output.stats = {
              uniqueExtensions: extensions.size,
              extensions: Array.from(extensions),
            }
          }

          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: { output },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)

      // Test with custom parameters
      const result = await adapter.executeAgent(
        agent,
        undefined,
        { pattern: '*.txt', includeStats: true }
      )

      const output = result.output as any
      expect(output.pattern).toBe('*.txt')
      expect(output.fileCount).toBeGreaterThan(0)
      expect(output.stats).toBeDefined()
      expect(output.stats.extensions).toContain('.txt')
    })
  })

  describe('Pattern: Agent with Progress Tracking', () => {
    it('should track progress through multiple operations', async () => {
      const agent: AgentDefinition = {
        id: 'progress-tracker',
        displayName: 'Progress Tracker',
        systemPrompt: 'Track progress.',
        toolNames: ['find_files', 'read_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          const progress: any[] = []

          // Step 1
          progress.push({ step: 1, action: 'Finding files', status: 'in_progress' })
          const findResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'find_files',
              input: { pattern: '*.txt' },
            },
          }
          progress[0].status = 'completed'
          progress[0].result = findResult[0]?.value?.files?.length

          // Step 2
          progress.push({ step: 2, action: 'Reading files', status: 'in_progress' })
          const files = findResult[0]?.value?.files || []
          const readResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'read_files',
              input: { paths: files },
            },
          }
          progress[1].status = 'completed'
          progress[1].result = Object.keys(readResult[0]?.value || {}).length

          // Final output
          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: {
                output: {
                  completed: true,
                  progress,
                  summary: {
                    totalSteps: progress.length,
                    completedSteps: progress.filter(p => p.status === 'completed').length,
                  },
                },
              },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)
      const result = await adapter.executeAgent(agent, undefined)

      const output = result.output as any
      expect(output.completed).toBe(true)
      expect(output.progress).toHaveLength(2)
      expect(output.progress.every((p: any) => p.status === 'completed')).toBe(true)
      expect(output.summary.completedSteps).toBe(2)
    })
  })
})
