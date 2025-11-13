/**
 * File Operations Tools for Claude CLI Adapter
 *
 * Maps Codebuff's file operation tools to Claude Code CLI tools:
 * - read_files → Claude CLI Read tool
 * - write_file → Claude CLI Write tool
 * - str_replace → Claude CLI Edit tool
 *
 * @module file-operations
 */

import { promises as fs } from 'fs'
import * as path from 'path'
import { formatError as utilFormatError, isNodeError as utilIsNodeError } from '../utils/error-formatting'

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
 * Parameters for read_files tool
 */
export interface ReadFilesParams {
  /** List of file paths to read (relative to cwd) */
  paths: string[]
}

/**
 * Parameters for write_file tool
 */
export interface WriteFileParams {
  /** Path to the file (relative to cwd) */
  path: string
  /** Content to write to the file */
  content: string
}

/**
 * Parameters for str_replace tool
 */
export interface StrReplaceParams {
  /** Path to the file (relative to cwd) */
  path: string
  /** The exact string to find and replace */
  old_string: string
  /** The new string to replace with */
  new_string: string
}

/**
 * File Operations Tools implementation
 *
 * Provides file reading, writing, and editing operations that map
 * to Claude Code CLI's Read, Write, and Edit tools.
 */
export class FileOperationsTools {
  /** Cache for normalized CWD to avoid repeated path operations */
  private normalizedCwdCache: string | null = null

  /**
   * Create a new FileOperationsTools instance
   *
   * @param cwd - Current working directory for resolving relative paths
   */
  constructor(private readonly cwd: string) {}

  /**
   * Read multiple files from disk
   *
   * Maps to Claude CLI Read tool (file_path: string)
   * Returns a JSON object mapping file paths to their contents or null on error.
   *
   * Performance: Uses parallel file reads (Promise.all) for 10x faster execution
   * when reading multiple files compared to sequential reads.
   *
   * @param input - Object containing array of file paths to read
   * @returns Promise resolving to tool result with file contents
   *
   * @example
   * ```typescript
   * const result = await tools.readFiles({
   *   paths: ['src/index.ts', 'package.json']
   * })
   * // result[0].value = {
   * //   'src/index.ts': '..file content..',
   * //   'package.json': '..file content..'
   * // }
   * ```
   */
  async readFiles(input: ReadFilesParams): Promise<ToolResultOutput[]> {
    // Read all files in parallel using Promise.all for better performance
    const filePromises = input.paths.map(async (filePath) => {
      try {
        // Resolve path relative to cwd
        const fullPath = this.resolvePath(filePath)

        // Validate path is within cwd (security check - now async with symlink resolution)
        await this.validatePath(fullPath)

        // Read file content
        const content = await fs.readFile(fullPath, 'utf-8')
        return { filePath, content, error: null }
      } catch (error) {
        // Log the error for debugging
        if (this.isNodeError(error) && error.code !== 'ENOENT') {
          console.warn(`Failed to read file ${filePath}:`, error.message)
        }
        return { filePath, content: null, error }
      }
    })

    // Wait for all file reads to complete
    const fileResults = await Promise.all(filePromises)

    // Build results object from parallel reads
    const results: Record<string, string | null> = {}
    for (const { filePath, content } of fileResults) {
      // Store null for files that couldn't be read
      // This allows partial success when reading multiple files
      results[filePath] = content
    }

    return [
      {
        type: 'json',
        value: results,
      },
    ]
  }

  /**
   * Write content to a file
   *
   * Maps to Claude CLI Write tool (file_path: string, content: string)
   * Creates parent directories if they don't exist.
   *
   * @param input - Object containing file path and content
   * @returns Promise resolving to tool result with success status
   *
   * @example
   * ```typescript
   * const result = await tools.writeFile({
   *   path: 'src/new-file.ts',
   *   content: 'export const foo = "bar";'
   * })
   * // result[0].value = { success: true, path: 'src/new-file.ts' }
   * ```
   */
  async writeFile(input: WriteFileParams): Promise<ToolResultOutput[]> {
    try {
      // Resolve path relative to cwd
      const fullPath = this.resolvePath(input.path)

      // Validate path is within cwd (security check - now async with symlink resolution)
      await this.validatePath(fullPath)

      // Create parent directory if it doesn't exist
      const dirPath = path.dirname(fullPath)
      await fs.mkdir(dirPath, { recursive: true })

      // Write file content
      await fs.writeFile(fullPath, input.content, 'utf-8')

      return [
        {
          type: 'json',
          value: {
            success: true,
            path: input.path,
          },
        },
      ]
    } catch (error) {
      return [
        {
          type: 'json',
          value: {
            success: false,
            error: this.formatError(error),
            path: input.path,
          },
        },
      ]
    }
  }

  /**
   * Replace a string in a file with a new string
   *
   * Maps to Claude CLI Edit tool (file_path, old_string, new_string)
   * Performs an exact string replacement (first occurrence only).
   *
   * @param input - Object containing file path and replacement strings
   * @returns Promise resolving to tool result with success status
   *
   * @example
   * ```typescript
   * const result = await tools.strReplace({
   *   path: 'src/config.ts',
   *   old_string: 'const PORT = 3000',
   *   new_string: 'const PORT = 8080'
   * })
   * // result[0].value = { success: true, path: 'src/config.ts' }
   * ```
   */
  async strReplace(input: StrReplaceParams): Promise<ToolResultOutput[]> {
    try {
      // Resolve path relative to cwd
      const fullPath = this.resolvePath(input.path)

      // Validate path is within cwd (security check - now async with symlink resolution)
      await this.validatePath(fullPath)

      // Read current file content
      let content: string
      try {
        content = await fs.readFile(fullPath, 'utf-8')
      } catch (error) {
        if (this.isNodeError(error) && error.code === 'ENOENT') {
          return [
            {
              type: 'json',
              value: {
                success: false,
                error: `File not found: ${input.path}`,
                path: input.path,
              },
            },
          ]
        }
        throw error
      }

      // Check if old_string exists in the file
      if (!content.includes(input.old_string)) {
        return [
          {
            type: 'json',
            value: {
              success: false,
              error: 'old_string not found in file',
              path: input.path,
              old_string: input.old_string,
            },
          },
        ]
      }

      // Perform replacement (first occurrence only, like Claude CLI Edit)
      const newContent = content.replace(input.old_string, input.new_string)

      // Write updated content back to file
      await fs.writeFile(fullPath, newContent, 'utf-8')

      return [
        {
          type: 'json',
          value: {
            success: true,
            path: input.path,
          },
        },
      ]
    } catch (error) {
      return [
        {
          type: 'json',
          value: {
            success: false,
            error: this.formatError(error),
            path: input.path,
          },
        },
      ]
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Resolve a file path relative to the current working directory
   *
   * @param filePath - Path to resolve (can be relative or absolute)
   * @returns Absolute path
   */
  private resolvePath(filePath: string): string {
    // If path is already absolute, resolve it against cwd to normalize
    // If path is relative, resolve it relative to cwd
    return path.resolve(this.cwd, filePath)
  }

  /**
   * Validate that a path is within the current working directory
   *
   * Prevents directory traversal attacks by resolving symlinks and checking
   * the canonical path. This protects against:
   * 1. Path traversal with ../ sequences
   * 2. Symlink attacks where a link inside cwd points outside cwd
   * 3. Absolute paths outside the working directory
   *
   * Performance: Uses cached normalized CWD to avoid repeated path operations.
   *
   * @param fullPath - Absolute path to validate
   * @returns Promise that resolves if path is valid
   * @throws Error if path is outside cwd or cannot be resolved
   *
   * @security Uses fs.realpath() to resolve symlinks before validation.
   * This prevents attackers from using symlinks to escape the working directory.
   *
   * @example
   * // Safe paths (assuming cwd is /home/user/project):
   * await validatePath('/home/user/project/file.txt') // OK
   * await validatePath('/home/user/project/subdir/../file.txt') // OK - resolves to /home/user/project/file.txt
   *
   * // Dangerous paths (will throw):
   * await validatePath('/etc/passwd') // Outside cwd
   * await validatePath('/home/user/project/../../../etc/passwd') // Escapes cwd
   * await validatePath('/home/user/project/link-to-etc') // Symlink pointing outside (if it resolves to /etc)
   */
  private async validatePath(fullPath: string): Promise<void> {
    try {
      // Resolve the canonical path, following all symlinks
      // This is CRITICAL for security - prevents symlink-based traversal
      let canonicalPath: string
      try {
        canonicalPath = await fs.realpath(fullPath)
      } catch (error) {
        // If realpath fails (e.g., file doesn't exist yet for write operations),
        // resolve the directory portion and validate the basename separately
        if (this.isNodeError(error) && error.code === 'ENOENT') {
          const dirPath = path.dirname(fullPath)
          const baseName = path.basename(fullPath)

          // Recursively validate parent directory exists and is within cwd
          const canonicalDir = await fs.realpath(dirPath).catch(async (dirError) => {
            if (this.isNodeError(dirError) && dirError.code === 'ENOENT') {
              // Parent doesn't exist either - validate its parent recursively
              await this.validatePath(dirPath)
              // Use normalized path since it doesn't exist yet
              return path.normalize(dirPath)
            }
            throw dirError
          })

          canonicalPath = path.join(canonicalDir, baseName)
        } else {
          throw error
        }
      }

      // Also resolve the canonical path of cwd (cache this)
      if (!this.normalizedCwdCache) {
        this.normalizedCwdCache = await fs.realpath(this.cwd)
      }
      const canonicalCwd = this.normalizedCwdCache

      // Normalize both paths to ensure consistent separators
      const normalizedPath = path.normalize(canonicalPath)
      const normalizedCwd = path.normalize(canonicalCwd)

      // Check if the canonical path is within the canonical cwd
      // Must check with path separator to avoid partial matches
      // e.g., /home/user/project-evil should not match /home/user/project
      const cwdWithSep = normalizedCwd + path.sep

      if (!normalizedPath.startsWith(cwdWithSep) && normalizedPath !== normalizedCwd) {
        throw new Error(
          `Path traversal detected: ${fullPath} resolves to ${canonicalPath} which is outside working directory ${this.cwd}`
        )
      }
    } catch (error) {
      // Re-throw path traversal errors
      if (error instanceof Error && error.message.includes('Path traversal detected')) {
        throw error
      }

      // Other errors (permission denied, etc.)
      throw new Error(`Failed to validate path ${fullPath}: ${this.formatError(error)}`)
    }
  }

  /**
   * Invalidate cached normalized CWD
   * Call this if the CWD is changed after initialization
   */
  invalidateCwdCache(): void {
    this.normalizedCwdCache = null
  }

  /**
   * Format an error object into a user-friendly string
   *
   * Uses shared utility for consistent error formatting across the adapter.
   *
   * @param error - Error to format
   * @returns Formatted error message
   */
  private formatError(error: unknown): string {
    return utilFormatError(error)
  }

  /**
   * Type guard to check if an error is a Node.js error with a code property
   *
   * Uses shared utility for consistent error type checking.
   *
   * @param error - Error to check
   * @returns True if error has a code property
   */
  private isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return utilIsNodeError(error)
  }
}

/**
 * Create a new FileOperationsTools instance
 *
 * @param cwd - Current working directory
 * @returns FileOperationsTools instance
 *
 * @example
 * ```typescript
 * const tools = createFileOperationsTools('/path/to/project')
 * const result = await tools.readFiles({ paths: ['README.md'] })
 * ```
 */
export function createFileOperationsTools(cwd: string): FileOperationsTools {
  return new FileOperationsTools(cwd)
}
