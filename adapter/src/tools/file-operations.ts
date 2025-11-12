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
    const results: Record<string, string | null> = {}

    // Read all files, handling errors individually
    for (const filePath of input.paths) {
      try {
        // Resolve path relative to cwd
        const fullPath = this.resolvePath(filePath)

        // Validate path is within cwd (security check)
        this.validatePath(fullPath)

        // Read file content
        const content = await fs.readFile(fullPath, 'utf-8')
        results[filePath] = content
      } catch (error) {
        // Store null for files that couldn't be read
        // This allows partial success when reading multiple files
        results[filePath] = null

        // Log the error for debugging
        if (this.isNodeError(error) && error.code !== 'ENOENT') {
          console.warn(`Failed to read file ${filePath}:`, error.message)
        }
      }
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

      // Validate path is within cwd (security check)
      this.validatePath(fullPath)

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

      // Validate path is within cwd (security check)
      this.validatePath(fullPath)

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
   * This prevents directory traversal attacks where a malicious path
   * could access files outside the project directory.
   *
   * @param fullPath - Absolute path to validate
   * @throws Error if path is outside cwd
   */
  private validatePath(fullPath: string): void {
    const normalizedPath = path.normalize(fullPath)
    const normalizedCwd = path.normalize(this.cwd)

    // Check if the path starts with cwd (is within the working directory)
    if (!normalizedPath.startsWith(normalizedCwd)) {
      throw new Error(
        `Path traversal detected: ${fullPath} is outside working directory ${this.cwd}`
      )
    }
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
   * Type guard to check if an error is a Node.js error with a code property
   *
   * @param error - Error to check
   * @returns True if error has a code property
   */
  private isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && 'code' in error
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
