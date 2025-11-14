/**
 * Real Project Example: Code Quality Checker
 *
 * A comprehensive code quality analysis tool that checks:
 * - Code metrics (LOC, complexity)
 * - Security vulnerabilities
 * - TODO/FIXME tracking
 * - Test coverage
 * - Import analysis
 * - Documentation coverage
 *
 * Generates a detailed quality report with recommendations.
 */

import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'

export const codeQualityCheckerAgent: AgentDefinition = {
  id: 'code-quality-checker',
  displayName: 'Code Quality Checker',
  systemPrompt: 'You perform comprehensive code quality analysis.',
  toolNames: ['find_files', 'read_files', 'code_search', 'write_file', 'set_output'],
  outputMode: 'structured_output',

  async *handleSteps(context) {
    const report: any = {
      timestamp: new Date().toISOString(),
      metrics: {},
      security: {},
      maintenance: {},
      testing: {},
      documentation: {},
      score: 0,
      grade: '',
      issues: [],
      recommendations: [],
    }

    console.log('🔍 Starting code quality analysis...\n')

    // 1. Code Metrics
    console.log('📊 Calculating code metrics...')
    const tsFilesResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'find_files',
        input: { pattern: 'src/**/*.{ts,tsx}' },
      },
    }

    const srcFiles = tsFilesResult[0]?.value?.files || []
    const readResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'read_files',
        input: { paths: srcFiles.slice(0, 100) }, // Limit for performance
      },
    }

    let totalLines = 0
    let codeLines = 0
    let commentLines = 0
    let blankLines = 0
    let longFunctions = 0

    for (const [_, content] of Object.entries(readResult[0]?.value || {})) {
      if (content === null) continue

      const lines = (content as string).split('\n')
      totalLines += lines.length

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) {
          blankLines++
        } else if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
          commentLines++
        } else {
          codeLines++
        }
      }
    }

    report.metrics = {
      totalFiles: srcFiles.length,
      totalLines,
      codeLines,
      commentLines,
      blankLines,
      commentRatio: ((commentLines / totalLines) * 100).toFixed(1) + '%',
      avgLinesPerFile: Math.round(totalLines / srcFiles.length),
    }

    // Score based on comment ratio
    const commentRatio = (commentLines / totalLines) * 100
    if (commentRatio < 5) {
      report.issues.push('Low comment ratio (< 5%)')
      report.recommendations.push('Add more code comments and documentation')
    } else if (commentRatio > 15) {
      report.score += 10
    } else {
      report.score += 5
    }

    // 2. Security Scan
    console.log('🔒 Scanning for security issues...')
    const securityChecks = [
      { name: 'SQL Injection', query: 'SELECT.*FROM.*\\$\\{', severity: 'HIGH' },
      { name: 'Hardcoded Secrets', query: '(password|secret|api_key).*=.*["\']', severity: 'CRITICAL' },
      { name: 'Eval Usage', query: 'eval\\(', severity: 'HIGH' },
      { name: 'Console Logs', query: 'console\\.log', severity: 'LOW' },
    ]

    const securityIssues: any[] = []

    for (const check of securityChecks) {
      const searchResult = yield {
        type: 'TOOL_CALL',
        toolCall: {
          toolName: 'code_search',
          input: {
            query: check.query,
            file_pattern: '*.{ts,tsx}',
          },
        },
      }

      const count = searchResult[0]?.value?.total || 0
      if (count > 0) {
        securityIssues.push({
          type: check.name,
          severity: check.severity,
          count,
        })

        if (check.severity === 'CRITICAL') {
          report.issues.push(`${count} ${check.name} vulnerabilities found`)
          report.score -= 20
        } else if (check.severity === 'HIGH') {
          report.issues.push(`${count} ${check.name} issues found`)
          report.score -= 10
        }
      }
    }

    report.security = {
      issues: securityIssues,
      totalIssues: securityIssues.reduce((sum, i) => sum + i.count, 0),
    }

    if (securityIssues.length === 0) {
      report.score += 20
    } else {
      report.recommendations.push('Address security vulnerabilities immediately')
    }

    // 3. Maintenance (TODOs/FIXMEs)
    console.log('📝 Checking maintenance markers...')
    const todoResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'code_search',
        input: { query: 'TODO:|FIXME:|HACK:', file_pattern: '*.{ts,tsx}' },
      },
    }

    const maintenanceCount = todoResult[0]?.value?.total || 0
    report.maintenance = {
      totalMarkers: maintenanceCount,
      markersPerFile: maintenanceCount > 0 ? (maintenanceCount / srcFiles.length).toFixed(2) : 0,
    }

    if (maintenanceCount > srcFiles.length * 0.5) {
      report.issues.push(`High number of TODO/FIXME comments (${maintenanceCount})`)
      report.recommendations.push('Address technical debt marked by TODO/FIXME comments')
      report.score -= 5
    } else if (maintenanceCount < srcFiles.length * 0.1) {
      report.score += 10
    }

    // 4. Test Coverage
    console.log('🧪 Analyzing test coverage...')
    const testFilesResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'find_files',
        input: { pattern: 'src/**/*.{test,spec}.{ts,tsx}' },
      },
    }

    const testFiles = testFilesResult[0]?.value?.files || []
    const testCoverageRatio = (testFiles.length / srcFiles.length) * 100

    report.testing = {
      sourceFiles: srcFiles.length,
      testFiles: testFiles.length,
      coverageRatio: testCoverageRatio.toFixed(1) + '%',
    }

    if (testCoverageRatio < 30) {
      report.issues.push(`Low test coverage (${testCoverageRatio.toFixed(1)}%)`)
      report.recommendations.push('Increase test coverage to at least 50%')
      report.score -= 15
    } else if (testCoverageRatio > 70) {
      report.score += 20
    } else {
      report.score += 10
    }

    // 5. Documentation
    console.log('📚 Checking documentation...')
    const jsdocResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'code_search',
        input: { query: '/\\*\\*', file_pattern: '*.{ts,tsx}' },
      },
    }

    const jsdocCount = jsdocResult[0]?.value?.total || 0
    const exportResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'code_search',
        input: { query: 'export (function|class|interface)', file_pattern: '*.{ts,tsx}' },
      },
    }

    const exportCount = exportResult[0]?.value?.total || 0
    const docCoverage = exportCount > 0 ? ((jsdocCount / exportCount) * 100).toFixed(1) : '0'

    report.documentation = {
      jsdocComments: jsdocCount,
      exportedItems: exportCount,
      documentationCoverage: docCoverage + '%',
    }

    if (parseFloat(docCoverage) < 30) {
      report.issues.push(`Low documentation coverage (${docCoverage}%)`)
      report.recommendations.push('Add JSDoc comments to exported functions and classes')
      report.score -= 10
    } else if (parseFloat(docCoverage) > 70) {
      report.score += 15
    }

    // Calculate final score and grade
    report.score = Math.max(0, Math.min(100, report.score + 50)) // Base score of 50

    if (report.score >= 90) {
      report.grade = 'A'
    } else if (report.score >= 80) {
      report.grade = 'B'
    } else if (report.score >= 70) {
      report.grade = 'C'
    } else if (report.score >= 60) {
      report.grade = 'D'
    } else {
      report.grade = 'F'
    }

    // Generate report
    console.log('📄 Generating quality report...')

    const markdown = `# Code Quality Report

Generated: ${report.timestamp}

## Overall Score: ${report.score}/100 (Grade: ${report.grade})

${report.grade === 'A' ? '🎉 Excellent code quality!' : report.grade === 'F' ? '⚠️  Code quality needs significant improvement' : '👍 Good code quality with room for improvement'}

---

## Code Metrics

- **Total Files**: ${report.metrics.totalFiles}
- **Total Lines**: ${report.metrics.totalLines}
- **Code Lines**: ${report.metrics.codeLines}
- **Comment Lines**: ${report.metrics.commentLines}
- **Blank Lines**: ${report.metrics.blankLines}
- **Comment Ratio**: ${report.metrics.commentRatio}
- **Avg Lines/File**: ${report.metrics.avgLinesPerFile}

## Security Analysis

- **Total Security Issues**: ${report.security.totalIssues}

${report.security.issues.length > 0 ? '### Issues Found\n\n' + report.security.issues.map((i: any) => `- **${i.type}**: ${i.count} (${i.severity})`).join('\n') : '✅ No security issues detected'}

## Maintenance

- **TODO/FIXME/HACK Markers**: ${report.maintenance.totalMarkers}
- **Markers per File**: ${report.maintenance.markersPerFile}

${report.maintenance.totalMarkers > 20 ? '⚠️  High number of maintenance markers. Consider addressing technical debt.' : '✅ Maintenance markers are at acceptable levels.'}

## Testing

- **Source Files**: ${report.testing.sourceFiles}
- **Test Files**: ${report.testing.testFiles}
- **Test Coverage Ratio**: ${report.testing.coverageRatio}

${parseFloat(report.testing.coverageRatio) < 50 ? '⚠️  Test coverage is below 50%. Consider adding more tests.' : '✅ Good test coverage.'}

## Documentation

- **JSDoc Comments**: ${report.documentation.jsdocComments}
- **Exported Items**: ${report.documentation.exportedItems}
- **Documentation Coverage**: ${report.documentation.documentationCoverage}

${parseFloat(report.documentation.documentationCoverage) < 50 ? '⚠️  Many exported items lack documentation.' : '✅ Good documentation coverage.'}

---

## Issues (${report.issues.length})

${report.issues.length > 0 ? report.issues.map((i: string) => `- ${i}`).join('\n') : '✅ No major issues found'}

## Recommendations

${report.recommendations.length > 0 ? report.recommendations.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n') : '✅ Keep up the good work!'}

---

## Score Breakdown

- **Comment Ratio**: ${commentRatio < 5 ? '0/10' : commentRatio > 15 ? '10/10' : '5/10'}
- **Security**: ${report.security.totalIssues === 0 ? '20/20' : report.security.totalIssues > 10 ? '0/20' : '10/20'}
- **Maintenance**: ${maintenanceCount < srcFiles.length * 0.1 ? '10/10' : maintenanceCount > srcFiles.length * 0.5 ? '0/10' : '5/10'}
- **Testing**: ${testCoverageRatio > 70 ? '20/20' : testCoverageRatio < 30 ? '5/20' : '10/20'}
- **Documentation**: ${parseFloat(docCoverage) > 70 ? '15/15' : parseFloat(docCoverage) < 30 ? '0/15' : '7/15'}

---

*Generated by Code Quality Checker*
`

    const writeResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'write_file',
        input: {
          path: 'CODE_QUALITY_REPORT.md',
          content: markdown,
        },
      },
    }

    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: {
          output: {
            success: true,
            reportFile: 'CODE_QUALITY_REPORT.md',
            score: report.score,
            grade: report.grade,
            summary: report,
          },
        },
      },
    }

    return 'DONE'
  },
}

export async function runCodeQualityChecker() {
  console.log('=== Code Quality Checker ===\n')

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    debug: false,
  })

  adapter.registerAgent(codeQualityCheckerAgent)

  const result = await adapter.executeAgent(
    codeQualityCheckerAgent,
    'Perform code quality analysis'
  )

  const output = result.output as any

  if (output.success) {
    console.log(`\n✅ Quality analysis complete!`)
    console.log(`📊 Score: ${output.score}/100 (Grade: ${output.grade})`)
    console.log(`📄 Report saved to: ${output.reportFile}`)

    if (output.grade === 'A') {
      console.log('\n🎉 Excellent code quality!')
    } else if (output.grade === 'F') {
      console.log('\n⚠️  Code quality needs significant improvement')
    }
  } else {
    console.error('❌ Quality check failed')
  }
}

if (require.main === module) {
  runCodeQualityChecker().catch(console.error)
}
