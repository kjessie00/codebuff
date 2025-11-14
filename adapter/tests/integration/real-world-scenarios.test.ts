/**
 * Real-World Scenario Integration Tests
 *
 * These tests demonstrate practical, realistic use cases for the FREE mode adapter.
 * Each test represents a real task that developers commonly need to perform.
 *
 * Run with: npm test -- tests/integration/real-world-scenarios.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { ClaudeCodeCLIAdapter } from '../../src/claude-cli-adapter'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as os from 'os'

describe('Real-World Scenarios (FREE Mode)', () => {
  let adapter: ClaudeCodeCLIAdapter
  let testDir: string

  beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'adapter-scenarios-'))

    adapter = new ClaudeCodeCLIAdapter({
      cwd: testDir,
      debug: false,
    })

    // Create realistic project structure
    await fs.mkdir(path.join(testDir, 'src'))
    await fs.mkdir(path.join(testDir, 'tests'))
    await fs.mkdir(path.join(testDir, 'docs'))

    await fs.writeFile(
      path.join(testDir, 'src', 'auth.ts'),
      `// TODO: Add password validation
export function authenticate(username: string, password: string) {
  // FIXME: This is insecure - hardcoded credentials
  if (username === 'admin' && password === 'admin123') {
    return { token: 'abc123' }
  }
  return null
}

// TODO: Implement OAuth
export function socialLogin(provider: string) {
  throw new Error('Not implemented')
}
`
    )

    await fs.writeFile(
      path.join(testDir, 'src', 'database.ts'),
      `import { Pool } from 'pg'

// Security issue: SQL injection vulnerable
export function findUser(username: string) {
  const query = \`SELECT * FROM users WHERE username = '\${username}'\`
  // FIXME: Use parameterized queries
  return pool.query(query)
}

export const pool = new Pool()
`
    )

    await fs.writeFile(
      path.join(testDir, 'tests', 'auth.test.ts'),
      `import { authenticate } from '../src/auth'

describe('Authentication', () => {
  it('should authenticate valid user', () => {
    const result = authenticate('admin', 'admin123')
    expect(result).not.toBeNull()
  })
})
`
    )

    await fs.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify({
        name: 'my-app',
        version: '1.0.0',
        dependencies: {
          express: '^4.18.0',
          pg: '^8.11.0',
        },
        devDependencies: {
          '@types/node': '^20.0.0',
          typescript: '^5.0.0',
          jest: '^29.0.0',
        },
      }, null, 2)
    )
  })

  afterAll(async () => {
    // Clean up
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe('Scenario: Find All TODO Comments', () => {
    it('should find and categorize all TODOs in the project', async () => {
      const agent: AgentDefinition = {
        id: 'todo-finder',
        displayName: 'TODO Finder',
        systemPrompt: 'Find all TODO and FIXME comments.',
        toolNames: ['code_search', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          // Find TODO comments
          const todoResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'code_search',
              input: { query: 'TODO:', file_pattern: '*.ts' },
            },
          }

          // Find FIXME comments
          const fixmeResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'code_search',
              input: { query: 'FIXME:', file_pattern: '*.ts' },
            },
          }

          const todos = todoResult[0]?.value?.results || []
          const fixmes = fixmeResult[0]?.value?.results || []

          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: {
                output: {
                  todos: todos.map((r: any) => ({
                    file: r.path,
                    line: r.line_number,
                    text: r.line.trim(),
                  })),
                  fixmes: fixmes.map((r: any) => ({
                    file: r.path,
                    line: r.line_number,
                    text: r.line.trim(),
                  })),
                  summary: {
                    totalTodos: todos.length,
                    totalFixmes: fixmes.length,
                    total: todos.length + fixmes.length,
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
      expect(output.summary.totalTodos).toBeGreaterThan(0)
      expect(output.summary.totalFixmes).toBeGreaterThan(0)
      expect(output.todos[0]).toHaveProperty('file')
      expect(output.todos[0]).toHaveProperty('line')
      expect(output.todos[0]).toHaveProperty('text')
    })
  })

  describe('Scenario: Analyze Import Statements', () => {
    it('should analyze all imports and list external dependencies', async () => {
      const agent: AgentDefinition = {
        id: 'import-analyzer',
        displayName: 'Import Analyzer',
        systemPrompt: 'Analyze import statements.',
        toolNames: ['code_search', 'read_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          // Find all import statements
          const importResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'code_search',
              input: { query: '^import ', file_pattern: '*.ts' },
            },
          }

          const imports = importResult[0]?.value?.results || []

          // Read package.json to get dependencies
          const pkgResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'read_files',
              input: { paths: ['package.json'] },
            },
          }

          const packageContent = pkgResult[0]?.value?.['package.json']
          const pkg = packageContent ? JSON.parse(packageContent as string) : {}

          const externalDeps = new Set<string>()
          const internalImports: string[] = []

          for (const imp of imports) {
            const line = imp.line as string
            const match = line.match(/from ['"]([^'"]+)['"]/)
            if (match) {
              const module = match[1]
              if (module.startsWith('.') || module.startsWith('/')) {
                internalImports.push(module)
              } else {
                externalDeps.add(module)
              }
            }
          }

          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: {
                output: {
                  totalImports: imports.length,
                  externalDependencies: Array.from(externalDeps),
                  internalImports: internalImports.length,
                  declaredDependencies: Object.keys(pkg.dependencies || {}),
                  unusedDependencies: Object.keys(pkg.dependencies || {}).filter(
                    (dep) => !Array.from(externalDeps).some(ext => ext.startsWith(dep))
                  ),
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
      expect(output.totalImports).toBeGreaterThan(0)
      expect(output.externalDependencies).toContain('pg')
      expect(output.declaredDependencies).toEqual(['express', 'pg'])
    })
  })

  describe('Scenario: Generate File Listing', () => {
    it('should generate organized file structure report', async () => {
      const agent: AgentDefinition = {
        id: 'file-lister',
        displayName: 'File Lister',
        systemPrompt: 'Generate file structure report.',
        toolNames: ['find_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          // Find all files
          const allFilesResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'find_files',
              input: { pattern: '**/*' },
            },
          }

          const files = allFilesResult[0]?.value?.files || []

          // Categorize by directory
          const byDirectory: Record<string, string[]> = {}
          const byExtension: Record<string, number> = {}

          for (const file of files) {
            const dir = path.dirname(file)
            const ext = path.extname(file) || 'no-extension'

            if (!byDirectory[dir]) {
              byDirectory[dir] = []
            }
            byDirectory[dir].push(file)

            byExtension[ext] = (byExtension[ext] || 0) + 1
          }

          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: {
                output: {
                  totalFiles: files.length,
                  byDirectory,
                  byExtension,
                  directories: Object.keys(byDirectory).sort(),
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
      expect(output.totalFiles).toBeGreaterThan(0)
      expect(output.directories).toContain('src')
      expect(output.directories).toContain('tests')
      expect(output.byExtension['.ts']).toBeGreaterThan(0)
    })
  })

  describe('Scenario: Find Security Vulnerabilities', () => {
    it('should scan for common security issues', async () => {
      const agent: AgentDefinition = {
        id: 'security-scanner',
        displayName: 'Security Scanner',
        systemPrompt: 'Scan for security vulnerabilities.',
        toolNames: ['code_search', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          const issues: any[] = []

          // Check for SQL injection
          const sqlResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'code_search',
              input: { query: 'SELECT.*FROM.*\\$\\{', file_pattern: '*.ts' },
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

          // Check for hardcoded credentials
          const credResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'code_search',
              input: { query: '(password|secret|api_key).*=.*["\']', file_pattern: '*.ts' },
            },
          }

          for (const match of credResult[0]?.value?.results || []) {
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
              input: { query: 'eval\\(', file_pattern: '*.ts' },
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
      expect(output.totalIssues).toBeGreaterThan(0)
      expect(output.bySeverity.HIGH).toBeGreaterThan(0)
      expect(output.issues[0]).toHaveProperty('type')
      expect(output.issues[0]).toHaveProperty('severity')
    })
  })

  describe('Scenario: Count Lines of Code', () => {
    it('should count lines of code by file type', async () => {
      const agent: AgentDefinition = {
        id: 'loc-counter',
        displayName: 'Lines of Code Counter',
        systemPrompt: 'Count lines of code.',
        toolNames: ['find_files', 'read_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          // Find all TypeScript files
          const findResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'find_files',
              input: { pattern: '**/*.ts' },
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

          const stats: any = {
            totalFiles: 0,
            totalLines: 0,
            codeLines: 0,
            commentLines: 0,
            blankLines: 0,
            byFile: [],
          }

          for (const [filePath, content] of Object.entries(fileContents)) {
            if (content === null) continue

            const lines = (content as string).split('\n')
            let codeLines = 0
            let commentLines = 0
            let blankLines = 0

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

            stats.totalFiles++
            stats.totalLines += lines.length
            stats.codeLines += codeLines
            stats.commentLines += commentLines
            stats.blankLines += blankLines

            stats.byFile.push({
              path: filePath,
              lines: lines.length,
              code: codeLines,
              comments: commentLines,
              blank: blankLines,
            })
          }

          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: { output: stats },
            },
          }

          return 'DONE'
        },
      }

      adapter.registerAgent(agent)
      const result = await adapter.executeAgent(agent, undefined)

      const output = result.output as any
      expect(output.totalFiles).toBeGreaterThan(0)
      expect(output.totalLines).toBeGreaterThan(0)
      expect(output.codeLines).toBeGreaterThan(0)
      expect(output.byFile).toBeInstanceOf(Array)
    })
  })

  describe('Scenario: Find Unused Variables', () => {
    it('should find potentially unused variables', async () => {
      // Create file with unused variable
      await fs.writeFile(
        path.join(testDir, 'src', 'unused.ts'),
        `export function example() {
  const unusedVar = 'never used'
  const usedVar = 'used'
  console.log(usedVar)
}
`
      )

      const agent: AgentDefinition = {
        id: 'unused-finder',
        displayName: 'Unused Variable Finder',
        systemPrompt: 'Find unused variables.',
        toolNames: ['code_search', 'read_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          // Find all const/let declarations
          const declResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'code_search',
              input: { query: 'const |let ', file_pattern: '*.ts' },
            },
          }

          const declarations = declResult[0]?.value?.results || []

          // For each declaration, check if variable is used elsewhere
          const potentiallyUnused: any[] = []

          for (const decl of declarations) {
            const match = (decl.line as string).match(/(?:const|let)\s+(\w+)\s*=/)
            if (match) {
              const varName = match[1]

              // Search for uses of this variable
              const useResult = yield {
                type: 'TOOL_CALL',
                toolCall: {
                  toolName: 'code_search',
                  input: { query: varName, file_pattern: '*.ts' },
                },
              }

              const uses = useResult[0]?.value?.results || []

              // If only found once (the declaration), it's unused
              if (uses.length === 1) {
                potentiallyUnused.push({
                  variable: varName,
                  file: decl.path,
                  line: decl.line_number,
                  declaration: (decl.line as string).trim(),
                })
              }
            }
          }

          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: {
                output: {
                  totalDeclarations: declarations.length,
                  potentiallyUnused: potentiallyUnused.length,
                  variables: potentiallyUnused,
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
      expect(output.totalDeclarations).toBeGreaterThan(0)
      expect(output.variables).toBeInstanceOf(Array)
    })
  })

  describe('Scenario: Analyze Test Coverage', () => {
    it('should analyze which files have tests', async () => {
      const agent: AgentDefinition = {
        id: 'test-coverage',
        displayName: 'Test Coverage Analyzer',
        systemPrompt: 'Analyze test coverage.',
        toolNames: ['find_files', 'set_output'],
        outputMode: 'structured_output',

        async *handleSteps(context) {
          // Find all source files
          const srcResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'find_files',
              input: { pattern: 'src/**/*.ts' },
            },
          }

          // Find all test files
          const testResult = yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'find_files',
              input: { pattern: '**/*.test.ts' },
            },
          }

          const srcFiles = srcResult[0]?.value?.files || []
          const testFiles = testResult[0]?.value?.files || []

          const testedFiles: string[] = []
          const untestedFiles: string[] = []

          for (const srcFile of srcFiles) {
            const baseName = path.basename(srcFile, '.ts')
            const hasTest = testFiles.some(testFile =>
              testFile.includes(baseName + '.test.ts')
            )

            if (hasTest) {
              testedFiles.push(srcFile)
            } else {
              untestedFiles.push(srcFile)
            }
          }

          const coverage = (testedFiles.length / srcFiles.length) * 100

          yield {
            type: 'TOOL_CALL',
            toolCall: {
              toolName: 'set_output',
              input: {
                output: {
                  totalSourceFiles: srcFiles.length,
                  totalTestFiles: testFiles.length,
                  testedFiles: testedFiles.length,
                  untestedFiles: untestedFiles.length,
                  coveragePercent: Math.round(coverage),
                  filesWithoutTests: untestedFiles,
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
      expect(output.totalSourceFiles).toBeGreaterThan(0)
      expect(output.totalTestFiles).toBeGreaterThan(0)
      expect(output.coveragePercent).toBeGreaterThanOrEqual(0)
      expect(output.coveragePercent).toBeLessThanOrEqual(100)
    })
  })
})
