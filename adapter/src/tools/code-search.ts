/**
 * Code Search Tools for Claude CLI Adapter
 *
 * Maps Codebuff's code search tools to Claude Code CLI tools:
 * - code_search → Claude CLI Grep tool (via ripgrep)
 * - find_files → Claude CLI Glob tool (via glob package)
 *
 * @module code-search
 */

import { spawn } from 'child_process'
import * as path from 'path'
import { glob } from 'glob'

/**
 * Tool result output format matching Codebuff's expectations
 */
export type ToolResultOutput =
  | {
      type: 'json'
      value: any
    }
  | {
      type: 'media'
      data: string
      mediaType: string
    }

/**
 * Parameters for code search
 */
export interface CodeSearchInput {
  /** The pattern/query to search for */
  query: string
  /** Optional file pattern to limit search (e.g., "*.ts", "*.js") */
  file_pattern?: string
  /** Whether search should be case-sensitive (default: false) */
  case_sensitive?: boolean
  /** Optional working directory to search within */
  cwd?: string
  /** Maximum number of results to return (default: 250) */
  maxResults?: number
}

/**
 * Parameters for file finding
 */
export interface FindFilesInput {
  /** Glob pattern to match files (e.g., "*.ts", "src/test-*.js") */
  pattern: string
  /** Optional working directory to search within */
  cwd?: string
}

/**
 * Result from ripgrep search
 */
interface RipgrepMatch {
  type: string
  data: {
    path: { text: string }
    line_number: number
    lines: { text: string }
    submatches?: Array<{
      match: { text: string }
      start: number
      end: number
    }>
  }
}

/**
 * Structured search result
 */
export interface SearchResult {
  path: string
  line_number: number
  line: string
  match?: string
}

/**
 * Validate regex pattern to prevent injection attacks
 *
 * Checks that a regex pattern doesn't contain shell metacharacters that
 * could be exploited for command injection.
 *
 * @param pattern - Regex pattern to validate
 * @throws Error if pattern contains dangerous characters
 *
 * @security Prevents command injection through regex patterns by rejecting
 * shell metacharacters that could escape ripgrep's argument parsing.
 */
function validateRegexPattern(pattern: string): void {
  // Check for dangerous shell metacharacters
  // Note: We allow regex special chars like *, +, ?, etc. but not shell operators
  const dangerousChars = /[;&|`$()<>]/

  if (dangerousChars.test(pattern)) {
    throw new Error(
      'Invalid regex pattern: contains shell metacharacters that could enable command injection'
    )
  }
}

/**
 * Validate file pattern/glob to prevent injection
 *
 * Ensures file patterns don't contain shell metacharacters.
 *
 * @param pattern - File pattern to validate
 * @throws Error if pattern contains dangerous characters
 *
 * @security Prevents command injection through file pattern arguments
 */
function validateFilePattern(pattern: string): void {
  const dangerousChars = /[;&|`$()<>]/

  if (dangerousChars.test(pattern)) {
    throw new Error(
      'Invalid file pattern: contains shell metacharacters that could enable command injection'
    )
  }
}

/**
 * Validate path to prevent directory traversal
 *
 * Ensures paths don't attempt to escape the working directory.
 *
 * @param basePath - Base working directory
 * @param targetPath - Path to validate
 * @throws Error if path attempts traversal outside base directory
 *
 * @security Prevents directory traversal attacks
 */
function validateSearchPath(basePath: string, targetPath: string): void {
  const normalizedTarget = path.normalize(targetPath)
  const normalizedBase = path.normalize(basePath)

  if (!normalizedTarget.startsWith(normalizedBase)) {
    throw new Error(
      `Path traversal detected: ${targetPath} is outside working directory`
    )
  }
}

/**
 * Code Search Tools implementation
 *
 * Provides code searching and file finding operations that map
 * to Claude Code CLI's Grep and Glob tools.
 */
export class CodeSearchTools {
  /**
   * Create a new CodeSearchTools instance
   *
   * @param cwd - Current working directory for search operations
   */
  constructor(private readonly cwd: string) {}

  /**
   * Search for code patterns using ripgrep
   *
   * Maps to Claude CLI Grep tool (pattern: string, glob?: string)
   * Uses ripgrep for fast, line-oriented searching across the codebase.
   *
   * @param input - Object containing search query and options
   * @returns Promise resolving to tool result with search matches
   *
   * @security Uses spawn() with argument arrays instead of shell execution
   * to prevent command injection. Validates all inputs before execution.
   *
   * @example
   * ```typescript
   * const result = await tools.codeSearch({
   *   query: 'function.*handleSteps',
   *   file_pattern: '*.ts',
   *   case_sensitive: false
   * })
   * // result[0].value = {
   * //   results: [...matches...],
   * //   total: 42,
   * //   query: 'function.*handleSteps'
   * // }
   * ```
   */
  async codeSearch(input: CodeSearchInput): Promise<ToolResultOutput[]> {
    try {
      const {
        query,
        file_pattern,
        case_sensitive = false,
        cwd: searchCwd,
        maxResults = 250
      } = input

      // Validate inputs to prevent injection attacks
      validateRegexPattern(query)
      if (file_pattern) {
        validateFilePattern(file_pattern)
      }

      // Determine search directory
      const searchDir = searchCwd
        ? path.resolve(this.cwd, searchCwd)
        : this.cwd

      // Validate search directory is within working directory
      validateSearchPath(this.cwd, searchDir)

      // Build ripgrep command arguments as an array (SECURITY: not a string!)
      const args: string[] = [
        '--json', // Output as JSON for structured parsing
        '--no-heading',
        '--line-number',
        '--column',
      ]

      // Add case-insensitive flag if needed
      if (!case_sensitive) {
        args.push('-i')
      }

      // Add file pattern if specified
      if (file_pattern) {
        args.push('--glob', file_pattern) // Passed as separate arguments
      }

      // Add the search pattern and directory as separate arguments
      args.push(query, searchDir)

      // Execute ripgrep using spawn (SECURITY: shell: false prevents injection)
      const stdout = await this.executeRipgrep(args)

      // Parse JSON Lines output from ripgrep
      const results: SearchResult[] = []
      const lines = stdout.split('\n').filter(Boolean)

      for (const line of lines) {
        try {
          const parsed: RipgrepMatch = JSON.parse(line)

          // Only process 'match' type entries
          if (parsed.type === 'match') {
            // Get relative path from search directory
            const relativePath = path.relative(
              this.cwd,
              parsed.data.path.text
            )

            results.push({
              path: relativePath,
              line_number: parsed.data.line_number,
              line: parsed.data.lines.text.trim(),
              match: parsed.data.submatches?.[0]?.match.text
            })

            // Stop if we've reached max results
            if (results.length >= maxResults) {
              break
            }
          }
        } catch (parseError) {
          // Skip malformed JSON lines
          continue
        }
      }

      // Group results by file for better readability
      const resultsByFile: Record<string, SearchResult[]> = {}
      for (const result of results) {
        if (!resultsByFile[result.path]) {
          resultsByFile[result.path] = []
        }
        resultsByFile[result.path].push(result)
      }

      return [
        {
          type: 'json',
          value: {
            results,
            total: results.length,
            query,
            case_sensitive,
            file_pattern,
            by_file: resultsByFile
          }
        }
      ]

    } catch (error) {
      // Return error result
      return [
        {
          type: 'json',
          value: {
            error: this.formatError(error),
            query: input.query,
            results: [],
            total: 0
          }
        }
      ]
    }
  }

  /**
   * Find files matching a glob pattern
   *
   * Maps to Claude CLI Glob tool (pattern: string, path?: string)
   * Returns matching file paths sorted by modification time (newest first).
   *
   * @param input - Object containing glob pattern and optional search directory
   * @returns Promise resolving to tool result with matching file paths
   *
   * @example
   * ```typescript
   * const result = await tools.findFiles({
   *   pattern: 'src/test-*.ts',
   *   cwd: 'packages/core'
   * })
   * // result[0].value = {
   * //   files: ['src/foo.test.ts', 'src/bar.test.ts'],
   * //   total: 2
   * // }
   * ```
   */
  async findFiles(input: FindFilesInput): Promise<ToolResultOutput[]> {
    try {
      const { pattern, cwd: searchCwd } = input

      // Determine search directory
      const searchDir = searchCwd
        ? path.resolve(this.cwd, searchCwd)
        : this.cwd

      // Find files using glob
      const files = await glob(pattern, {
        cwd: searchDir,
        nodir: true, // Exclude directories
        absolute: false, // Return relative paths
        dot: false, // Ignore dotfiles by default
        ignore: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
          '**/.next/**',
          '**/coverage/**'
        ]
      })

      // Get file stats for sorting by modification time
      const fs = await import('fs/promises')
      const filesWithStats = await Promise.all(
        files.map(async (file) => {
          try {
            const fullPath = path.join(searchDir, file)
            const stats = await fs.stat(fullPath)
            return {
              path: file,
              mtime: stats.mtime.getTime()
            }
          } catch (error) {
            // File might have been deleted, skip it
            return null
          }
        })
      )

      // Filter out null entries and sort by modification time (newest first)
      const sortedFiles = filesWithStats
        .filter((f): f is { path: string; mtime: number } => f !== null)
        .sort((a, b) => b.mtime - a.mtime)
        .map(f => f.path)

      return [
        {
          type: 'json',
          value: {
            files: sortedFiles,
            total: sortedFiles.length,
            pattern,
            search_dir: path.relative(this.cwd, searchDir) || '.'
          }
        }
      ]

    } catch (error) {
      // Handle glob errors gracefully
      return [
        {
          type: 'json',
          value: {
            error: this.formatError(error),
            pattern: input.pattern,
            files: [],
            total: 0
          }
        }
      ]
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Execute ripgrep with given arguments using spawn
   *
   * Uses spawn() instead of exec() to prevent command injection vulnerabilities.
   * Arguments are passed as an array, not concatenated into a shell command.
   *
   * @param args - Array of arguments to pass to ripgrep
   * @returns Promise resolving to stdout from ripgrep
   *
   * @security Uses spawn with shell: false to prevent command injection.
   * Arguments are passed as array elements, never concatenated.
   *
   * @throws Error if ripgrep execution fails or times out
   */
  private async executeRipgrep(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      // Use spawn with shell: false to prevent command injection
      const child = spawn('rg', args, {
        shell: false, // SECURITY: Critical - prevents shell interpretation
      })

      let stdout = ''
      let stderr = ''

      // Collect stdout
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString('utf-8')
      })

      // Collect stderr
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8')
      })

      // Handle process exit
      child.on('close', (code: number | null) => {
        // ripgrep exit code 1 means no matches found (not an error for us)
        if (code === 1) {
          resolve('') // No matches, return empty string
        } else if (code === 0) {
          resolve(stdout)
        } else {
          reject(new Error(`ripgrep failed with code ${code}: ${stderr}`))
        }
      })

      // Handle spawn errors (e.g., ripgrep not installed)
      child.on('error', (error: Error) => {
        reject(new Error(`Failed to execute ripgrep: ${error.message}`))
      })

      // Set timeout to prevent hanging
      setTimeout(() => {
        child.kill('SIGTERM')
        reject(new Error('ripgrep execution timed out'))
      }, 60000) // 60 second timeout
    })
  }

  /**
   * Format an error object into a user-friendly string
   *
   * @param error - Error to format
   * @returns Formatted error message
   */
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }
    if (typeof error === 'string') {
      return error
    }
    return 'Unknown error occurred'
  }

  /**
   * Verify that ripgrep is available on the system
   *
   * Uses secure spawn-based execution to check ripgrep availability.
   *
   * @returns true if ripgrep is available, false otherwise
   *
   * @security Uses spawn() instead of exec() to prevent injection
   */
  async verifyRipgrep(): Promise<boolean> {
    try {
      const child = spawn('rg', ['--version'], {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      return new Promise((resolve) => {
        child.on('close', (code) => {
          resolve(code === 0)
        })
        child.on('error', () => {
          resolve(false)
        })

        // Timeout after 5 seconds
        setTimeout(() => {
          child.kill()
          resolve(false)
        }, 5000)
      })
    } catch {
      return false
    }
  }

  /**
   * Get ripgrep version information
   *
   * Uses secure spawn-based execution to get version.
   *
   * @returns Version string or null if ripgrep is not available
   *
   * @security Uses spawn() instead of exec() to prevent injection
   */
  async getRipgrepVersion(): Promise<string | null> {
    try {
      const child = spawn('rg', ['--version'], {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      return new Promise((resolve) => {
        let stdout = ''

        child.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString('utf-8')
        })

        child.on('close', (code) => {
          if (code === 0 && stdout) {
            const match = stdout.match(/ripgrep (\S+)/)
            resolve(match ? match[1] : null)
          } else {
            resolve(null)
          }
        })

        child.on('error', () => {
          resolve(null)
        })

        // Timeout after 5 seconds
        setTimeout(() => {
          child.kill()
          resolve(null)
        }, 5000)
      })
    } catch {
      return null
    }
  }
}

/**
 * Create a new CodeSearchTools instance
 *
 * @param cwd - Current working directory
 * @returns CodeSearchTools instance
 *
 * @example
 * ```typescript
 * const tools = createCodeSearchTools('/path/to/project')
 * const result = await tools.codeSearch({ query: 'TODO' })
 * ```
 */
export function createCodeSearchTools(cwd: string): CodeSearchTools {
  return new CodeSearchTools(cwd)
}
