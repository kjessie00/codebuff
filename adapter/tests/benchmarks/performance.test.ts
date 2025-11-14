/**
 * Performance Benchmarks
 *
 * These tests measure the performance of key operations in FREE mode.
 * They help identify performance regressions and optimize slow operations.
 *
 * Run with: npm test -- tests/benchmarks/performance.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as os from 'os'

describe('Performance Benchmarks (FREE Mode)', () => {
  let adapter: ClaudeCodeCLIAdapter
  let testDir: string

  beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perf-bench-'))

    adapter = new ClaudeCodeCLIAdapter({
      cwd: testDir,
      debug: false,
    })

    // Create test files
    for (let i = 0; i < 100; i++) {
      await fs.writeFile(
        path.join(testDir, `file${i}.txt`),
        `Content ${i}\n`.repeat(100)
      )
    }

    await fs.writeFile(
      path.join(testDir, 'large.txt'),
      'Large file content\n'.repeat(10000)
    )
  })

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe('File Read Performance', () => {
    it('should read 1 file in <100ms', async () => {
      const agent: AgentDefinition = {
        id: 'read-1-file',
        displayName: 'Read 1 File',
        toolNames: ['read_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          const result = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'read_files',
              input: { paths: ['file0.txt'] },
            },
          }

          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: { output: result[0]?.value },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)

      const startTime = Date.now()
      const result = await adapter.executeAgent(agent, undefined)
      const executionTime = Date.now() - startTime

      expect(result.output).toBeDefined()
      expect(executionTime).toBeLessThan(100)

      console.log(`  ✓ Read 1 file: ${executionTime}ms`)
    })

    it('should read 10 files in <500ms', async () => {
      const agent: AgentDefinition = {
        id: 'read-10-files',
        displayName: 'Read 10 Files',
        toolNames: ['read_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          const paths = Array.from({ length: 10 }, (_, i) => `file${i}.txt`)

          const result = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'read_files',
              input: { paths },
            },
          }

          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: { output: result[0]?.value },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)

      const startTime = Date.now()
      const result = await adapter.executeAgent(agent, undefined)
      const executionTime = Date.now() - startTime

      expect(result.output).toBeDefined()
      expect(executionTime).toBeLessThan(500)

      console.log(`  ✓ Read 10 files: ${executionTime}ms`)
    })

    it('should read 100 files in <2000ms', async () => {
      const agent: AgentDefinition = {
        id: 'read-100-files',
        displayName: 'Read 100 Files',
        toolNames: ['read_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          const paths = Array.from({ length: 100 }, (_, i) => `file${i}.txt`)

          const result = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'read_files',
              input: { paths },
            },
          }

          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: { output: result[0]?.value },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)

      const startTime = Date.now()
      const result = await adapter.executeAgent(agent, undefined)
      const executionTime = Date.now() - startTime

      expect(result.output).toBeDefined()
      expect(executionTime).toBeLessThan(2000)

      console.log(`  ✓ Read 100 files: ${executionTime}ms`)
    })

    it('should read large file (10KB+) in <200ms', async () => {
      const agent: AgentDefinition = {
        id: 'read-large-file',
        displayName: 'Read Large File',
        toolNames: ['read_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          const result = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'read_files',
              input: { paths: ['large.txt'] },
            },
          }

          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: { output: result[0]?.value },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)

      const startTime = Date.now()
      const result = await adapter.executeAgent(agent, undefined)
      const executionTime = Date.now() - startTime

      expect(result.output).toBeDefined()
      expect(executionTime).toBeLessThan(200)

      console.log(`  ✓ Read large file: ${executionTime}ms`)
    })
  })

  describe('Code Search Performance', () => {
    it('should search in 100 files in <1000ms', async () => {
      const agent: AgentDefinition = {
        id: 'search-files',
        displayName: 'Search Files',
        toolNames: ['code_search', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          const result = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'code_search',
              input: {
                query: 'Content',
                file_pattern: '*.txt',
              },
            },
          }

          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: { output: result[0]?.value },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)

      const startTime = Date.now()
      const result = await adapter.executeAgent(agent, undefined)
      const executionTime = Date.now() - startTime

      expect(result.output).toBeDefined()
      expect(executionTime).toBeLessThan(1000)

      console.log(`  ✓ Search 100 files: ${executionTime}ms`)
    })
  })

  describe('File Finder Performance', () => {
    it('should find 100 files in <500ms', async () => {
      const agent: AgentDefinition = {
        id: 'find-files',
        displayName: 'Find Files',
        toolNames: ['find_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          const result = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'find_files',
              input: { pattern: '*.txt' },
            },
          }

          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: { output: result[0]?.value },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)

      const startTime = Date.now()
      const result = await adapter.executeAgent(agent, undefined)
      const executionTime = Date.now() - startTime

      expect(result.output).toBeDefined()
      expect(executionTime).toBeLessThan(500)

      console.log(`  ✓ Find 100 files: ${executionTime}ms`)
    })
  })

  describe('Agent Execution Performance', () => {
    it('should execute simple agent in <50ms', async () => {
      const agent: AgentDefinition = {
        id: 'simple-agent',
        displayName: 'Simple Agent',
        toolNames: ['set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: { output: { result: 'done' } },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)

      const startTime = Date.now()
      const result = await adapter.executeAgent(agent, undefined)
      const executionTime = Date.now() - startTime

      expect(result.output).toBeDefined()
      expect(executionTime).toBeLessThan(50)

      console.log(`  ✓ Simple agent: ${executionTime}ms`)
    })

    it('should execute multi-step agent in <1000ms', async () => {
      const agent: AgentDefinition = {
        id: 'multi-step-agent',
        displayName: 'Multi-Step Agent',
        toolNames: ['find_files', 'read_files', 'code_search', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          // Step 1: Find files
          const findResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'find_files',
              input: { pattern: 'file[0-9].txt' },
            },
          }

          // Step 2: Read files
          const files = findResult[0]?.value?.files || []
          const readResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'read_files',
              input: { paths: files.slice(0, 5) },
            },
          }

          // Step 3: Search
          const searchResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'code_search',
              input: {
                query: 'Content',
                file_pattern: 'file[0-9].txt',
              },
            },
          }

          // Step 4: Set output
          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: {
                output: {
                  found: files.length,
                  read: Object.keys(readResult[0]?.value || {}).length,
                  searched: searchResult[0]?.value?.total || 0,
                },
              },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)

      const startTime = Date.now()
      const result = await adapter.executeAgent(agent, undefined)
      const executionTime = Date.now() - startTime

      expect(result.output).toBeDefined()
      expect(executionTime).toBeLessThan(1000)

      console.log(`  ✓ Multi-step agent: ${executionTime}ms`)
    })
  })

  describe('Memory Usage', () => {
    it('should not leak memory when reading many files', async () => {
      const agent: AgentDefinition = {
        id: 'memory-test',
        displayName: 'Memory Test',
        toolNames: ['read_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          const paths = Array.from({ length: 50 }, (_, i) => `file${i}.txt`)

          const result = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'read_files',
              input: { paths },
            },
          }

          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: { output: { filesRead: Object.keys(result[0]?.value || {}).length } },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)

      const initialMemory = process.memoryUsage().heapUsed

      // Run multiple times
      for (let i = 0; i < 10; i++) {
        await adapter.executeAgent(agent, undefined)
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024 // MB

      // Memory increase should be reasonable (less than 50MB for 10 runs)
      expect(memoryIncrease).toBeLessThan(50)

      console.log(`  ✓ Memory increase after 10 runs: ${memoryIncrease.toFixed(2)}MB`)
    })
  })
})
