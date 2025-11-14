/**
 * Example 10: Dependency List Generator
 *
 * Lists all dependencies from package.json with version information.
 *
 * Features:
 * - Read package.json
 * - List all dependencies and devDependencies
 * - Categorize by type
 * - Version analysis
 *
 * Tools used: read_files, set_output
 */

import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'

export const dependencyListAgent: AgentDefinition = {
  id: 'dependency-list',
  displayName: 'Dependency List Generator',
  systemPrompt: 'You list project dependencies.',
  toolNames: ['read_files', 'set_output'],
  outputMode: 'structured_output',

  async *handleSteps(context) {
    const readResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'read_files',
        input: { paths: ['package.json'] },
      },
    }

    const content = readResult[0]?.value?.['package.json']

    if (!content) {
      yield {
        type: 'TOOL_CALL',
        toolCall: {
          toolName: 'set_output',
          input: {
            output: {
              error: 'package.json not found',
            },
          },
        },
      }
      return 'DONE'
    }

    const pkg = JSON.parse(content as string)

    const dependencies = Object.entries(pkg.dependencies || {}).map(([name, version]) => ({
      name,
      version,
      type: 'dependency',
    }))

    const devDependencies = Object.entries(pkg.devDependencies || {}).map(([name, version]) => ({
      name,
      version,
      type: 'devDependency',
    }))

    const all = [...dependencies, ...devDependencies]

    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: {
          output: {
            name: pkg.name,
            version: pkg.version,
            totalDependencies: all.length,
            dependencies,
            devDependencies,
            all,
          },
        },
      },
    }

    return 'DONE'
  },
}

export async function runDependencyListExample() {
  console.log('=== Dependency List Agent Example ===\n')

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    debug: false,
  })

  adapter.registerAgent(dependencyListAgent)

  const result = await adapter.executeAgent(
    dependencyListAgent,
    'List dependencies'
  )

  const output = result.output as any
  console.log('Project:', output.name)
  console.log('Total dependencies:', output.totalDependencies)
  console.log('\n✅ Dependency List example completed!')
}

if (require.main === module) {
  runDependencyListExample().catch(console.error)
}
