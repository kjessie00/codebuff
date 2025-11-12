/**
 * Code Search Tools for Claude CLI Adapter
 *
 * Maps Codebuff's code search tools to Claude Code CLI tools:
 * - code_search → Claude CLI Grep tool (via ripgrep)
 * - find_files → Claude CLI Glob tool (via glob package)
 *
 * @module code-search
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import { glob } from 'glob'

const execAsync = promisify(exec)

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

      // Determine search directory
      const searchDir = searchCwd
        ? path.resolve(this.cwd, searchCwd)
        : this.cwd

      // Build ripgrep command arguments
      const args: string[] = [
        'rg',
        '--json', // Output as JSON for structured parsing
        '--no-heading',
        '--line-number',
        '--column',
        case_sensitive ? '' : '-i', // Case-insensitive by default
      ]

      // Add file pattern if specified
      if (file_pattern) {
        args.push('--glob', `"${file_pattern}"`)
      }

      // Add the search pattern and directory
      args.push(`"${query}"`, `"${searchDir}"`)

      // Filter out empty strings and join
      const command = args.filter(Boolean).join(' ')

      // Execute ripgrep
      let stdout: string
      try {
        const result = await execAsync(command, {
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          encoding: 'utf-8'
        })
        stdout = result.stdout
      } catch (error: any) {
        // ripgrep exit code 1 means no matches found (not an error)
        if (error.code === 1) {
          return [
            {
              type: 'json',
              value: {
                results: [],
                total: 0,
                query,
                message: 'No matches found'
              }
            }
          ]
        }
        throw error
      }

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
   * @returns true if ripgrep is available, false otherwise
   */
  async verifyRipgrep(): Promise<boolean> {
    try {
      await execAsync('rg --version')
      return true
    } catch {
      return false
    }
  }

  /**
   * Get ripgrep version information
   *
   * @returns Version string or null if ripgrep is not available
   */
  async getRipgrepVersion(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('rg --version')
      const match = stdout.match(/ripgrep (\S+)/)
      return match ? match[1] : null
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
