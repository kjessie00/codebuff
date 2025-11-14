/**
 * Benchmark Report Generator
 *
 * Runs performance benchmarks and generates a markdown report.
 *
 * Usage:
 *   ts-node tests/benchmarks/benchmark-report.ts
 */

import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as os from 'os'

interface BenchmarkResult {
  name: string
  description: string
  executionTime: number
  success: boolean
  details?: any
}

/**
 * Run a benchmark and measure execution time
 */
async function runBenchmark(
  adapter: ClaudeCodeCLIAdapter,
  agent: AgentDefinition,
  name: string,
  description: string,
  params?: any
): Promise<BenchmarkResult> {
  try {
    const startTime = Date.now()
    const result = await adapter.executeAgent(agent, undefined, params)
    const executionTime = Date.now() - startTime

    return {
      name,
      description,
      executionTime,
      success: true,
      details: result.output,
    }
  } catch (error) {
    return {
      name,
      description,
      executionTime: -1,
      success: false,
      details: { error: (error as Error).message },
    }
  }
}

/**
 * Generate markdown report
 */
function generateReport(results: BenchmarkResult[]): string {
  const timestamp = new Date().toISOString()

  let report = `# Performance Benchmark Report

Generated: ${timestamp}

## Summary

| Benchmark | Time (ms) | Status |
|-----------|-----------|--------|
`

  for (const result of results) {
    const status = result.success ? '✅ Pass' : '❌ Fail'
    const time = result.success ? result.executionTime.toFixed(0) : 'N/A'
    report += `| ${result.name} | ${time} | ${status} |\n`
  }

  report += `\n## Detailed Results\n\n`

  for (const result of results) {
    report += `### ${result.name}\n\n`
    report += `**Description**: ${result.description}\n\n`

    if (result.success) {
      report += `**Execution Time**: ${result.executionTime}ms\n\n`
      report += `**Status**: ✅ Success\n\n`
    } else {
      report += `**Status**: ❌ Failed\n\n`
      report += `**Error**: ${result.details?.error || 'Unknown error'}\n\n`
    }

    report += `---\n\n`
  }

  // Add performance insights
  report += `## Performance Insights\n\n`

  const successfulResults = results.filter(r => r.success)
  if (successfulResults.length > 0) {
    const avgTime = successfulResults.reduce((sum, r) => sum + r.executionTime, 0) / successfulResults.length
    const fastest = successfulResults.reduce((min, r) => r.executionTime < min.executionTime ? r : min)
    const slowest = successfulResults.reduce((max, r) => r.executionTime > max.executionTime ? r : max)

    report += `- **Average Execution Time**: ${avgTime.toFixed(0)}ms\n`
    report += `- **Fastest Operation**: ${fastest.name} (${fastest.executionTime}ms)\n`
    report += `- **Slowest Operation**: ${slowest.name} (${slowest.executionTime}ms)\n`
    report += `- **Total Benchmarks**: ${results.length}\n`
    report += `- **Successful**: ${successfulResults.length}\n`
    report += `- **Failed**: ${results.length - successfulResults.length}\n`
  }

  report += `\n## Recommendations\n\n`

  const slowBenchmarks = successfulResults.filter(r => r.executionTime > 1000)
  if (slowBenchmarks.length > 0) {
    report += `⚠️ The following operations took over 1 second:\n\n`
    for (const bench of slowBenchmarks) {
      report += `- ${bench.name}: ${bench.executionTime}ms\n`
    }
    report += `\nConsider optimizing these operations.\n\n`
  } else {
    report += `✅ All operations completed in under 1 second. Performance is good!\n\n`
  }

  return report
}

/**
 * Main benchmark runner
 */
async function main() {
  console.log('🚀 Running performance benchmarks...\n')

  // Setup
  const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'benchmark-'))

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: testDir,
    debug: false,
  })

  // Create test files
  console.log('📁 Creating test files...')
  for (let i = 0; i < 100; i++) {
    await fs.writeFile(
      path.join(testDir, `file${i}.txt`),
      `Content ${i}\n`.repeat(100)
    )
  }

  const results: BenchmarkResult[] = []

  // Benchmark 1: Read 1 file
  console.log('⏱  Benchmark: Read 1 file')
  const readOneAgent: AgentDefinition = {
    id: 'read-one',
    displayName: 'Read One File',
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

  adapter.registerAgent(readOneAgent)
  results.push(await runBenchmark(
    adapter,
    readOneAgent,
    'Read 1 File',
    'Read a single file from disk'
  ))

  // Benchmark 2: Read 10 files
  console.log('⏱  Benchmark: Read 10 files')
  const readTenAgent: AgentDefinition = {
    id: 'read-ten',
    displayName: 'Read Ten Files',
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

  adapter.registerAgent(readTenAgent)
  results.push(await runBenchmark(
    adapter,
    readTenAgent,
    'Read 10 Files',
    'Read 10 files in parallel'
  ))

  // Benchmark 3: Find files
  console.log('⏱  Benchmark: Find files')
  const findFilesAgent: AgentDefinition = {
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

  adapter.registerAgent(findFilesAgent)
  results.push(await runBenchmark(
    adapter,
    findFilesAgent,
    'Find 100 Files',
    'Find all .txt files using glob pattern'
  ))

  // Benchmark 4: Code search
  console.log('⏱  Benchmark: Code search')
  const codeSearchAgent: AgentDefinition = {
    id: 'code-search',
    displayName: 'Code Search',
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

  adapter.registerAgent(codeSearchAgent)
  results.push(await runBenchmark(
    adapter,
    codeSearchAgent,
    'Code Search',
    'Search for pattern across all files'
  ))

  // Generate report
  console.log('\n📄 Generating report...')
  const report = generateReport(results)

  // Save report
  const reportPath = path.join(process.cwd(), 'BENCHMARK_REPORT.md')
  await fs.writeFile(reportPath, report)

  console.log(`\n✅ Benchmark complete!`)
  console.log(`📊 Report saved to: ${reportPath}\n`)

  // Cleanup
  await fs.rm(testDir, { recursive: true, force: true })

  // Print summary
  console.log('Summary:')
  for (const result of results) {
    const status = result.success ? '✅' : '❌'
    const time = result.success ? `${result.executionTime}ms` : 'FAILED'
    console.log(`  ${status} ${result.name}: ${time}`)
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Benchmark failed:', error)
    process.exit(1)
  })
}

export { runBenchmark, generateReport }
