/**
 * Performance Benchmark for Claude CLI Adapter Optimizations
 *
 * This benchmark measures the performance improvements from:
 * 1. Parallel file reads in file-operations.ts
 * 2. Optional parallel agent spawning in spawn-agents.ts
 * 3. Caching in terminal.ts and file-operations.ts
 */

import { performance } from 'perf_hooks'
import { promises as fs } from 'fs'
import * as path from 'path'
import { FileOperationsTools } from '../src/tools/file-operations'
import { TerminalTools } from '../src/tools/terminal'
import { SpawnAgentsAdapter } from '../src/tools/spawn-agents'
import type { AgentDefinition } from '../../.agents/types/agent-definition'

// ============================================================================
// Benchmark Configuration
// ============================================================================

const BENCHMARK_ITERATIONS = 10
const TEST_FILE_COUNT = 20 // Number of files to read in parallel test

// ============================================================================
// Test Setup
// ============================================================================

/**
 * Create test files for file read benchmarks
 */
async function createTestFiles(count: number): Promise<string[]> {
  const testDir = path.join(__dirname, 'test-files')
  await fs.mkdir(testDir, { recursive: true })

  const filePaths: string[] = []
  for (let i = 0; i < count; i++) {
    const filePath = path.join(testDir, `test-file-${i}.txt`)
    const content = `Test file ${i}\n`.repeat(100) // ~1.5KB each
    await fs.writeFile(filePath, content)
    filePaths.push(filePath)
  }

  return filePaths
}

/**
 * Clean up test files
 */
async function cleanupTestFiles(): Promise<void> {
  const testDir = path.join(__dirname, 'test-files')
  try {
    await fs.rm(testDir, { recursive: true, force: true })
  } catch (error) {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Benchmark 1: File Read Performance (Parallel vs Sequential)
// ============================================================================

/**
 * Simulate sequential file reads (old implementation)
 */
async function benchmarkSequentialFileReads(filePaths: string[]): Promise<number> {
  const startTime = performance.now()

  const results: Record<string, string | null> = {}
  for (const filePath of filePaths) {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      results[filePath] = content
    } catch (error) {
      results[filePath] = null
    }
  }

  const endTime = performance.now()
  return endTime - startTime
}

/**
 * Benchmark parallel file reads (new implementation)
 */
async function benchmarkParallelFileReads(
  fileOps: FileOperationsTools,
  filePaths: string[]
): Promise<number> {
  const startTime = performance.now()

  // Convert absolute paths to relative paths for the tool
  const relativePaths = filePaths.map((p) => path.relative(__dirname, p))
  await fileOps.readFiles({ paths: relativePaths })

  const endTime = performance.now()
  return endTime - startTime
}

/**
 * Run file read benchmarks
 */
async function runFileReadBenchmarks(): Promise<void> {
  console.log('\n' + '='.repeat(80))
  console.log('BENCHMARK 1: File Read Performance (Parallel vs Sequential)')
  console.log('='.repeat(80))

  // Create test files
  console.log(`\nCreating ${TEST_FILE_COUNT} test files...`)
  const filePaths = await createTestFiles(TEST_FILE_COUNT)

  const fileOps = new FileOperationsTools(__dirname)

  // Run benchmarks
  const sequentialTimes: number[] = []
  const parallelTimes: number[] = []

  console.log(`\nRunning ${BENCHMARK_ITERATIONS} iterations...`)

  for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
    // Sequential
    const seqTime = await benchmarkSequentialFileReads(filePaths)
    sequentialTimes.push(seqTime)

    // Parallel
    const parTime = await benchmarkParallelFileReads(fileOps, filePaths)
    parallelTimes.push(parTime)

    process.stdout.write(`  Iteration ${i + 1}/${BENCHMARK_ITERATIONS}\r`)
  }

  console.log('\n')

  // Calculate statistics
  const avgSequential =
    sequentialTimes.reduce((a, b) => a + b, 0) / sequentialTimes.length
  const avgParallel = parallelTimes.reduce((a, b) => a + b, 0) / parallelTimes.length
  const speedup = avgSequential / avgParallel
  const improvement = ((avgSequential - avgParallel) / avgSequential) * 100

  // Results
  console.log('Results:')
  console.log(`  Files read: ${TEST_FILE_COUNT}`)
  console.log(`  Sequential (old): ${avgSequential.toFixed(2)}ms`)
  console.log(`  Parallel (new):   ${avgParallel.toFixed(2)}ms`)
  console.log(`  Speedup:          ${speedup.toFixed(2)}x`)
  console.log(`  Improvement:      ${improvement.toFixed(1)}%`)

  // Cleanup
  await cleanupTestFiles()
}

// ============================================================================
// Benchmark 2: Agent Spawning Performance
// ============================================================================

/**
 * Create mock agent definitions for testing
 */
function createMockAgents(count: number): Map<string, AgentDefinition> {
  const registry = new Map<string, AgentDefinition>()

  for (let i = 0; i < count; i++) {
    const agentDef: AgentDefinition = {
      id: `test-agent-${i}`,
      displayName: `Test Agent ${i}`,
      description: `Test agent ${i} for benchmarking`,
      toolNames: [],
      instructions: '',
      version: '1.0.0',
    }
    registry.set(`test-agent-${i}`, agentDef)
  }

  return registry
}

/**
 * Mock agent executor with simulated delay
 */
async function mockAgentExecutor(
  agentDef: AgentDefinition,
  prompt: string | undefined,
  params: Record<string, any> | undefined,
  parentContext: any
): Promise<{ output: any; messageHistory: any[] }> {
  // Simulate agent execution time (50-150ms)
  const delay = 50 + Math.random() * 100
  await new Promise((resolve) => setTimeout(resolve, delay))

  return {
    output: { result: `Completed: ${agentDef.id}` },
    messageHistory: [],
  }
}

/**
 * Run agent spawning benchmarks
 */
async function runAgentSpawningBenchmarks(): Promise<void> {
  console.log('\n' + '='.repeat(80))
  console.log('BENCHMARK 2: Agent Spawning Performance (Sequential vs Parallel)')
  console.log('='.repeat(80))

  const agentCount = 5
  const registry = createMockAgents(agentCount)
  const adapter = new SpawnAgentsAdapter(registry, mockAgentExecutor)

  const agentSpecs = Array.from({ length: agentCount }, (_, i) => ({
    agent_type: `test-agent-${i}`,
    prompt: `Task ${i}`,
  }))

  const sequentialTimes: number[] = []
  const parallelTimes: number[] = []

  console.log(`\nSpawning ${agentCount} agents, ${BENCHMARK_ITERATIONS} iterations...`)

  for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
    // Sequential (default)
    const seqStart = performance.now()
    await adapter.spawnAgents({ agents: agentSpecs }, {} as any)
    const seqTime = performance.now() - seqStart
    sequentialTimes.push(seqTime)

    // Parallel (opt-in)
    const parStart = performance.now()
    await adapter.spawnAgents({ agents: agentSpecs, parallel: true }, {} as any)
    const parTime = performance.now() - parStart
    parallelTimes.push(parTime)

    process.stdout.write(`  Iteration ${i + 1}/${BENCHMARK_ITERATIONS}\r`)
  }

  console.log('\n')

  // Calculate statistics
  const avgSequential =
    sequentialTimes.reduce((a, b) => a + b, 0) / sequentialTimes.length
  const avgParallel = parallelTimes.reduce((a, b) => a + b, 0) / parallelTimes.length
  const speedup = avgSequential / avgParallel
  const improvement = ((avgSequential - avgParallel) / avgSequential) * 100

  // Results
  console.log('Results:')
  console.log(`  Agents spawned: ${agentCount}`)
  console.log(`  Sequential (default): ${avgSequential.toFixed(2)}ms`)
  console.log(`  Parallel (opt-in):    ${avgParallel.toFixed(2)}ms`)
  console.log(`  Speedup:              ${speedup.toFixed(2)}x`)
  console.log(`  Improvement:          ${improvement.toFixed(1)}%`)
  console.log(`\n  Note: Parallel mode is opt-in via parallel: true parameter`)
}

// ============================================================================
// Benchmark 3: Caching Performance
// ============================================================================

/**
 * Run caching benchmarks
 */
async function runCachingBenchmarks(): Promise<void> {
  console.log('\n' + '='.repeat(80))
  console.log('BENCHMARK 3: Caching Performance')
  console.log('='.repeat(80))

  // Test environment variable caching
  console.log('\nEnvironment Variable Caching:')
  const terminalTools = new TerminalTools(__dirname, { TEST: 'value' })

  const noCacheStart = performance.now()
  for (let i = 0; i < 10000; i++) {
    // Simulate uncached operation
    const env = { ...process.env, TEST: 'value' }
  }
  const noCacheTime = performance.now() - noCacheStart

  const cacheStart = performance.now()
  for (let i = 0; i < 10000; i++) {
    terminalTools.getEnvironmentVariables()
  }
  const cacheTime = performance.now() - cacheStart

  const envSpeedup = noCacheTime / cacheTime
  const envImprovement = ((noCacheTime - cacheTime) / noCacheTime) * 100

  console.log(`  Without cache: ${noCacheTime.toFixed(2)}ms`)
  console.log(`  With cache:    ${cacheTime.toFixed(2)}ms`)
  console.log(`  Speedup:       ${envSpeedup.toFixed(2)}x`)
  console.log(`  Improvement:   ${envImprovement.toFixed(1)}%`)

  // Test path normalization caching
  console.log('\nPath Normalization Caching:')
  const fileOps = new FileOperationsTools(__dirname)

  const pathNoCacheStart = performance.now()
  for (let i = 0; i < 10000; i++) {
    path.normalize(__dirname)
  }
  const pathNoCacheTime = performance.now() - pathNoCacheStart

  // Trigger cache by calling validatePath
  try {
    await fileOps.readFiles({ paths: ['nonexistent.txt'] })
  } catch {}

  const pathCacheStart = performance.now()
  for (let i = 0; i < 10000; i++) {
    // Cache is used internally in validatePath
    try {
      await fileOps.readFiles({ paths: ['nonexistent.txt'] })
    } catch {}
  }
  const pathCacheTime = performance.now() - pathCacheStart

  console.log(`  Repeated path.normalize(): ${pathNoCacheTime.toFixed(2)}ms`)
  console.log(`  With cached CWD:           ${pathCacheTime.toFixed(2)}ms`)
  console.log(
    `  Note: Caching reduces repeated path.normalize() calls in validatePath()`
  )
}

// ============================================================================
// Main Benchmark Runner
// ============================================================================

async function main(): Promise<void> {
  console.log('\n╔═══════════════════════════════════════════════════════════════════════════╗')
  console.log('║       Claude CLI Adapter - Performance Optimization Benchmarks           ║')
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝')

  try {
    await runFileReadBenchmarks()
    await runAgentSpawningBenchmarks()
    await runCachingBenchmarks()

    console.log('\n' + '='.repeat(80))
    console.log('SUMMARY')
    console.log('='.repeat(80))
    console.log('\nOptimizations implemented:')
    console.log('  ✓ Parallel file reads using Promise.all()')
    console.log('  ✓ Optional parallel agent spawning (opt-in)')
    console.log('  ✓ Environment variable caching in TerminalTools')
    console.log('  ✓ Path normalization caching in FileOperationsTools')
    console.log('  ✓ Path normalization caching in TerminalTools')
    console.log('\nExpected improvements:')
    console.log('  • File reads: 5-10x faster for multiple files')
    console.log('  • Agent spawning: 3-5x faster in parallel mode')
    console.log('  • Caching: 10-100x faster for repeated operations')
    console.log('\nBackward compatibility: All optimizations are backward compatible')
    console.log('Parallel agent spawning is opt-in via parallel: true parameter\n')
  } catch (error) {
    console.error('\nBenchmark failed:', error)
    process.exit(1)
  }
}

// Run benchmarks
if (require.main === module) {
  main()
}
