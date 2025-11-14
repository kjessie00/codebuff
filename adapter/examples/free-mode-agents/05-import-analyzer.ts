/**
 * Example 5: Import Analyzer Agent
 *
 * An agent that analyzes import statements to understand dependencies.
 * Useful for dependency audits and code organization analysis.
 *
 * Features:
 * - Find all import statements
 * - Categorize internal vs external imports
 * - Detect unused dependencies
 * - Generate dependency graph data
 *
 * Tools used: code_search, read_files, set_output
 */

import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'

/**
 * Import Analyzer Agent Definition
 */
export const importAnalyzerAgent: AgentDefinition = {
  id: 'import-analyzer',
  displayName: 'Import Analyzer',
  systemPrompt: 'You analyze import statements and dependencies.',
  instructionsPrompt: 'Find all imports, categorize them, and identify dependencies.',
  toolNames: ['code_search', 'read_files', 'set_output'],
  outputMode: 'structured_output',

  async *handleSteps(context) {
    const filePattern = (context.params?.filePattern as string) || '*.{ts,tsx,js,jsx}'

    // Find all import statements
    const importResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'code_search',
        input: {
          query: '^import ',
          file_pattern: filePattern,
        },
      },
    }

    const imports = importResult[0]?.value?.results || []

    // Read package.json to get declared dependencies
    const pkgResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'read_files',
        input: { paths: ['package.json'] },
      },
    }

    let packageJson: any = {}
    const pkgContent = pkgResult[0]?.value?.['package.json']
    if (pkgContent) {
      try {
        packageJson = JSON.parse(pkgContent as string)
      } catch (e) {
        // Invalid JSON
      }
    }

    // Analyze imports
    const externalImports = new Set<string>()
    const internalImports: Array<{ from: string, to: string, file: string }> = []
    const importsByFile: Record<string, string[]> = {}

    for (const imp of imports) {
      const line = (imp.line as string).trim()
      const file = imp.path as string

      // Extract module name
      const match = line.match(/from ['"]([^'"]+)['"]/)
      if (match) {
        const module = match[1]

        // Track imports by file
        if (!importsByFile[file]) {
          importsByFile[file] = []
        }
        importsByFile[file].push(module)

        // Categorize
        if (module.startsWith('.') || module.startsWith('/')) {
          internalImports.push({
            from: file,
            to: module,
            file,
          })
        } else {
          // Extract package name (handle scoped packages)
          const packageName = module.startsWith('@')
            ? module.split('/').slice(0, 2).join('/')
            : module.split('/')[0]
          externalImports.add(packageName)
        }
      }
    }

    // Compare with declared dependencies
    const allDependencies = {
      ...packageJson.dependencies || {},
      ...packageJson.devDependencies || {},
    }

    const declaredDeps = Object.keys(allDependencies)
    const usedDeps = Array.from(externalImports)

    const unusedDeps = declaredDeps.filter(dep => !usedDeps.includes(dep))
    const undeclaredDeps = usedDeps.filter(dep => !declaredDeps.includes(dep))

    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: {
          output: {
            summary: {
              totalImports: imports.length,
              externalPackages: externalImports.size,
              internalImports: internalImports.length,
              filesAnalyzed: Object.keys(importsByFile).length,
            },
            external: {
              packages: Array.from(externalImports).sort(),
              count: externalImports.size,
            },
            internal: {
              imports: internalImports,
              count: internalImports.length,
            },
            dependencies: {
              declared: declaredDeps,
              used: usedDeps,
              unused: unusedDeps,
              undeclared: undeclaredDeps,
            },
            importsByFile,
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
export async function runImportAnalyzerExample() {
  console.log('=== Import Analyzer Agent Example ===\n')

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    debug: false,
  })

  adapter.registerAgent(importAnalyzerAgent)

  console.log('Analyzing imports...')
  const result = await adapter.executeAgent(
    importAnalyzerAgent,
    'Analyze all imports',
    { filePattern: '**/*.ts' }
  )

  const output = result.output as any

  console.log('\n📊 Summary:')
  console.log('  Total imports:', output.summary.totalImports)
  console.log('  External packages:', output.summary.externalPackages)
  console.log('  Internal imports:', output.summary.internalImports)
  console.log('  Files analyzed:', output.summary.filesAnalyzed)

  console.log('\n📦 External Packages:')
  for (const pkg of output.external.packages.slice(0, 10)) {
    console.log(`  - ${pkg}`)
  }

  if (output.dependencies.unused.length > 0) {
    console.log('\n⚠️  Potentially Unused Dependencies:')
    for (const dep of output.dependencies.unused) {
      console.log(`  - ${dep}`)
    }
  }

  if (output.dependencies.undeclared.length > 0) {
    console.log('\n❌ Undeclared Dependencies:')
    for (const dep of output.dependencies.undeclared) {
      console.log(`  - ${dep}`)
    }
  }

  console.log('\n✅ Import Analyzer example completed!')
}

// Run if executed directly
if (require.main === module) {
  runImportAnalyzerExample().catch(console.error)
}
