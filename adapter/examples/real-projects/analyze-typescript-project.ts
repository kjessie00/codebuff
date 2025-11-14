/**
 * Real Project Example: TypeScript Project Analyzer
 *
 * A complete example that analyzes a TypeScript project and generates
 * a comprehensive report with statistics, issues, and recommendations.
 *
 * This demonstrates:
 * - Multiple tool usage in sequence
 * - Data aggregation and analysis
 * - Report generation
 * - Real-world workflow patterns
 */

import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'

/**
 * TypeScript Project Analyzer Agent
 */
export const tsProjectAnalyzerAgent: AgentDefinition = {
  id: 'ts-project-analyzer',
  displayName: 'TypeScript Project Analyzer',
  systemPrompt: 'You analyze TypeScript projects comprehensively.',
  instructionsPrompt: `Analyze the TypeScript project and generate a comprehensive report including:
- File statistics
- Import analysis
- TODO/FIXME tracking
- Code metrics
- Test coverage
- Security issues`,
  toolNames: ['find_files', 'read_files', 'code_search', 'write_file', 'set_output'],
  outputMode: 'structured_output',

  async *handleSteps(context) {
    const report: any = {
      timestamp: new Date().toISOString(),
      project: {},
      files: {},
      imports: {},
      todos: {},
      metrics: {},
      tests: {},
      security: {},
    }

    // Step 1: Analyze project structure
    console.log('📁 Analyzing project structure...')

    const tsFilesResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'find_files',
        input: { pattern: '**/*.ts' },
      },
    }

    const tsFiles = tsFilesResult[0]?.value?.files || []

    const testFilesResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'find_files',
        input: { pattern: '**/*.{test,spec}.ts' },
      },
    }

    const testFiles = testFilesResult[0]?.value?.files || []

    report.files = {
      totalTypeScriptFiles: tsFiles.length,
      testFiles: testFiles.length,
      sourceFiles: tsFiles.length - testFiles.length,
      testCoverageRatio: ((testFiles.length / (tsFiles.length - testFiles.length)) * 100).toFixed(1) + '%',
    }

    // Step 2: Read package.json
    console.log('📦 Reading package.json...')

    const pkgResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'read_files',
        input: { paths: ['package.json'] },
      },
    }

    const pkgContent = pkgResult[0]?.value?.['package.json']
    if (pkgContent) {
      const pkg = JSON.parse(pkgContent as string)
      report.project = {
        name: pkg.name,
        version: pkg.version,
        dependencies: Object.keys(pkg.dependencies || {}).length,
        devDependencies: Object.keys(pkg.devDependencies || {}).length,
      }
    }

    // Step 3: Analyze imports
    console.log('📥 Analyzing imports...')

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

    const imports = importResult[0]?.value?.results || []
    const externalImports = new Set<string>()

    for (const imp of imports) {
      const line = (imp.line as string).trim()
      const match = line.match(/from ['"]([^'"]+)['"]/)
      if (match && !match[1].startsWith('.') && !match[1].startsWith('/')) {
        const packageName = match[1].startsWith('@')
          ? match[1].split('/').slice(0, 2).join('/')
          : match[1].split('/')[0]
        externalImports.add(packageName)
      }
    }

    report.imports = {
      totalImports: imports.length,
      externalPackages: Array.from(externalImports),
      externalPackageCount: externalImports.size,
    }

    // Step 4: Find TODOs and FIXMEs
    console.log('📝 Finding TODOs and FIXMEs...')

    const todoResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'code_search',
        input: {
          query: 'TODO:?',
          file_pattern: '*.ts',
        },
      },
    }

    const fixmeResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'code_search',
        input: {
          query: 'FIXME:?',
          file_pattern: '*.ts',
        },
      },
    }

    const todos = todoResult[0]?.value?.results || []
    const fixmes = fixmeResult[0]?.value?.results || []

    report.todos = {
      totalTodos: todos.length,
      totalFixmes: fixmes.length,
      total: todos.length + fixmes.length,
    }

    // Step 5: Calculate code metrics
    console.log('📊 Calculating code metrics...')

    const srcFiles = tsFiles.filter(f => !testFiles.includes(f))
    const readResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'read_files',
        input: { paths: srcFiles.slice(0, 50) }, // Limit to first 50 files for performance
      },
    }

    const fileContents = readResult[0]?.value || {}
    let totalLines = 0
    let codeLines = 0
    let commentLines = 0
    let blankLines = 0

    for (const [_, content] of Object.entries(fileContents)) {
      if (content === null) continue

      const lines = (content as string).split('\n')
      totalLines += lines.length

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) {
          blankLines++
        } else if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          commentLines++
        } else {
          codeLines++
        }
      }
    }

    report.metrics = {
      totalLines,
      codeLines,
      commentLines,
      blankLines,
      commentRatio: ((commentLines / totalLines) * 100).toFixed(1) + '%',
      avgLinesPerFile: Math.round(totalLines / Object.keys(fileContents).length),
    }

    // Step 6: Scan for security issues
    console.log('🔒 Scanning for security issues...')

    const sqlResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'code_search',
        input: {
          query: 'SELECT.*FROM.*\\$\\{',
          file_pattern: '*.ts',
        },
      },
    }

    const passResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'code_search',
        input: {
          query: '(password|secret|api_key).*=.*["\']',
          file_pattern: '*.ts',
        },
      },
    }

    const evalResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'code_search',
        input: {
          query: 'eval\\(',
          file_pattern: '*.ts',
        },
      },
    }

    report.security = {
      sqlInjectionRisks: (sqlResult[0]?.value?.total || 0),
      hardcodedCredentials: (passResult[0]?.value?.total || 0),
      evalUsage: (evalResult[0]?.value?.total || 0),
      totalIssues: (sqlResult[0]?.value?.total || 0) +
                    (passResult[0]?.value?.total || 0) +
                    (evalResult[0]?.value?.total || 0),
    }

    // Step 7: Generate report
    console.log('📄 Generating report...')

    const markdown = `# TypeScript Project Analysis Report

Generated: ${report.timestamp}

## Project Information

- **Name**: ${report.project.name || 'Unknown'}
- **Version**: ${report.project.version || 'Unknown'}
- **Dependencies**: ${report.project.dependencies || 0}
- **Dev Dependencies**: ${report.project.devDependencies || 0}

## File Statistics

- **Total TypeScript Files**: ${report.files.totalTypeScriptFiles}
- **Source Files**: ${report.files.sourceFiles}
- **Test Files**: ${report.files.testFiles}
- **Test Coverage Ratio**: ${report.files.testCoverageRatio}

## Code Metrics

- **Total Lines**: ${report.metrics.totalLines}
- **Code Lines**: ${report.metrics.codeLines}
- **Comment Lines**: ${report.metrics.commentLines}
- **Blank Lines**: ${report.metrics.blankLines}
- **Comment Ratio**: ${report.metrics.commentRatio}
- **Avg Lines/File**: ${report.metrics.avgLinesPerFile}

## Import Analysis

- **Total Imports**: ${report.imports.totalImports}
- **External Packages**: ${report.imports.externalPackageCount}

### External Packages
${report.imports.externalPackages.slice(0, 20).map((pkg: string) => `- ${pkg}`).join('\n')}

## TODOs and FIXMEs

- **TODOs**: ${report.todos.totalTodos}
- **FIXMEs**: ${report.todos.totalFixmes}
- **Total**: ${report.todos.total}

## Security Issues

- **SQL Injection Risks**: ${report.security.sqlInjectionRisks}
- **Hardcoded Credentials**: ${report.security.hardcodedCredentials}
- **Eval Usage**: ${report.security.evalUsage}
- **Total Issues**: ${report.security.totalIssues}

${report.security.totalIssues > 0 ? '⚠️ **Security issues found!** Please review the code for vulnerabilities.' : '✅ No obvious security issues found.'}

## Recommendations

${report.todos.total > 10 ? '- Consider addressing the high number of TODO/FIXME comments\n' : ''}${report.security.totalIssues > 0 ? '- Address security vulnerabilities immediately\n' : ''}${parseFloat(report.metrics.commentRatio) < 10 ? '- Consider adding more code comments (current ratio is low)\n' : ''}${parseFloat(report.files.testCoverageRatio) < 50 ? '- Increase test coverage (currently below 50%)\n' : ''}

---
*Generated by TypeScript Project Analyzer*
`

    const writeResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'write_file',
        input: {
          path: 'PROJECT_ANALYSIS.md',
          content: markdown,
        },
      },
    }

    // Step 8: Set final output
    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: {
          output: {
            success: true,
            reportFile: 'PROJECT_ANALYSIS.md',
            summary: report,
          },
        },
      },
    }

    return 'DONE'
  },
}

/**
 * Run the TypeScript Project Analyzer
 */
export async function runTsProjectAnalyzer() {
  console.log('=== TypeScript Project Analyzer ===\n')
  console.log('This will analyze the entire TypeScript project...\n')

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    debug: false,
  })

  adapter.registerAgent(tsProjectAnalyzerAgent)

  const result = await adapter.executeAgent(
    tsProjectAnalyzerAgent,
    'Analyze TypeScript project'
  )

  const output = result.output as any

  if (output.success) {
    console.log('\n✅ Analysis complete!')
    console.log(`📄 Report saved to: ${output.reportFile}`)
    console.log('\n📊 Summary:')
    console.log(`  Files: ${output.summary.files.totalTypeScriptFiles}`)
    console.log(`  TODOs: ${output.summary.todos.total}`)
    console.log(`  Security issues: ${output.summary.security.totalIssues}`)
  } else {
    console.error('❌ Analysis failed')
  }
}

// Run if executed directly
if (require.main === module) {
  runTsProjectAnalyzer().catch(console.error)
}
