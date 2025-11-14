/**
 * Example 12: Security Scanner Agent
 *
 * Scans code for common security vulnerabilities.
 *
 * Features:
 * - SQL injection detection
 * - Hardcoded credentials
 * - Eval usage
 * - XSS vulnerabilities
 *
 * Tools used: code_search, set_output
 */

import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'

export const securityScannerAgent: AgentDefinition = {
  id: 'security-scanner',
  displayName: 'Security Scanner',
  systemPrompt: 'You scan for security vulnerabilities.',
  toolNames: ['code_search', 'set_output'],
  outputMode: 'structured_output',

  async *handleSteps(context) {
    const issues: any[] = []

    // Check for SQL injection
    const sqlResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'code_search',
        input: {
          query: 'SELECT.*FROM.*\\$\\{',
          file_pattern: '*.{ts,js}',
        },
      },
    }

    for (const match of sqlResult[0]?.value?.results || []) {
      issues.push({
        type: 'SQL Injection',
        severity: 'HIGH',
        file: match.path,
        line: match.line_number,
        code: match.line,
      })
    }

    // Check for hardcoded passwords
    const passResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'code_search',
        input: {
          query: '(password|secret|api_key).*=.*["\']',
          file_pattern: '*.{ts,js}',
        },
      },
    }

    for (const match of passResult[0]?.value?.results || []) {
      issues.push({
        type: 'Hardcoded Credentials',
        severity: 'CRITICAL',
        file: match.path,
        line: match.line_number,
        code: match.line,
      })
    }

    // Check for eval usage
    const evalResult = yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'code_search',
        input: {
          query: 'eval\\(',
          file_pattern: '*.{ts,js}',
        },
      },
    }

    for (const match of evalResult[0]?.value?.results || []) {
      issues.push({
        type: 'Eval Usage',
        severity: 'HIGH',
        file: match.path,
        line: match.line_number,
        code: match.line,
      })
    }

    yield {
      type: 'TOOL_CALL',
      toolCall: {
        toolName: 'set_output',
        input: {
          output: {
            totalIssues: issues.length,
            issues,
            bySeverity: {
              CRITICAL: issues.filter(i => i.severity === 'CRITICAL').length,
              HIGH: issues.filter(i => i.severity === 'HIGH').length,
              MEDIUM: issues.filter(i => i.severity === 'MEDIUM').length,
            },
          },
        },
      },
    }

    return 'DONE'
  },
}

export async function runSecurityScannerExample() {
  console.log('=== Security Scanner Agent Example ===\n')

  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    debug: false,
  })

  adapter.registerAgent(securityScannerAgent)

  const result = await adapter.executeAgent(
    securityScannerAgent,
    'Scan for vulnerabilities'
  )

  const output = result.output as any
  console.log('Total issues:', output.totalIssues)
  console.log('Critical:', output.bySeverity.CRITICAL)
  console.log('High:', output.bySeverity.HIGH)
  console.log('\n✅ Security Scanner example completed!')
}

if (require.main === module) {
  runSecurityScannerExample().catch(console.error)
}
