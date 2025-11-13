/**
 * Path Validation Utilities
 *
 * Provides secure path validation and resolution to prevent directory traversal
 * attacks and ensure all file operations stay within the working directory.
 *
 * @module utils/path-validation
 */

import * as path from 'path'
import { ENFORCE_PATH_VALIDATION } from './constants'

/**
 * Error thrown when path validation fails
 */
export class PathValidationError extends Error {
  constructor(
    message: string,
    public readonly attemptedPath: string,
    public readonly basePath: string
  ) {
    super(message)
    this.name = 'PathValidationError'
  }
}

/**
 * Resolve a file path relative to a base directory
 *
 * Handles both relative and absolute paths:
 * - Relative paths: Resolved relative to basePath
 * - Absolute paths: Normalized but must still be within basePath
 *
 * @param basePath - Base directory (typically cwd)
 * @param filePath - Path to resolve
 * @returns Absolute normalized path
 *
 * @example
 * ```typescript
 * const resolved = resolvePath('/project', 'src/index.ts')
 * // Returns: '/project/src/index.ts'
 *
 * const resolved2 = resolvePath('/project', '/project/src/index.ts')
 * // Returns: '/project/src/index.ts'
 * ```
 */
export function resolvePath(basePath: string, filePath: string): string {
  // Resolve the path relative to basePath
  // This normalizes the path and handles '..' segments
  return path.resolve(basePath, filePath)
}

/**
 * Validate that a path is within the base directory
 *
 * This prevents directory traversal attacks where malicious paths
 * could access files outside the project directory.
 *
 * Security check examples:
 * - '/project/file.txt' with base '/project' → Valid
 * - '/project/../etc/passwd' with base '/project' → Invalid
 * - '/etc/passwd' with base '/project' → Invalid
 *
 * @param basePath - Base directory that paths must be within
 * @param fullPath - Absolute path to validate
 * @throws PathValidationError if path is outside basePath
 *
 * @example
 * ```typescript
 * try {
 *   validatePath('/project', '/project/src/index.ts') // OK
 *   validatePath('/project', '/etc/passwd') // Throws
 * } catch (error) {
 *   if (error instanceof PathValidationError) {
 *     console.error('Invalid path:', error.attemptedPath)
 *   }
 * }
 * ```
 */
export function validatePath(basePath: string, fullPath: string): void {
  if (!ENFORCE_PATH_VALIDATION) {
    return // Skip validation if disabled (not recommended)
  }

  const normalizedPath = path.normalize(fullPath)
  const normalizedBase = path.normalize(basePath)

  // Ensure normalized base ends with separator for accurate comparison
  const baseWithSep = normalizedBase.endsWith(path.sep)
    ? normalizedBase
    : normalizedBase + path.sep

  // Check if the path starts with basePath
  // Also allow exact match with basePath
  if (
    !normalizedPath.startsWith(baseWithSep) &&
    normalizedPath !== normalizedBase
  ) {
    throw new PathValidationError(
      `Path traversal detected: ${fullPath} is outside working directory ${basePath}`,
      fullPath,
      basePath
    )
  }
}

/**
 * Resolve and validate a path in one operation
 *
 * Convenience function that combines resolvePath and validatePath.
 * Most common use case for file operations.
 *
 * @param basePath - Base directory
 * @param filePath - Path to resolve and validate
 * @returns Absolute validated path
 * @throws PathValidationError if path is outside basePath
 *
 * @example
 * ```typescript
 * const safePath = resolveAndValidatePath('/project', 'src/index.ts')
 * await fs.readFile(safePath)
 * ```
 */
export function resolveAndValidatePath(
  basePath: string,
  filePath: string
): string {
  const resolved = resolvePath(basePath, filePath)
  validatePath(basePath, resolved)
  return resolved
}

/**
 * Check if a path is within the base directory (without throwing)
 *
 * Non-throwing version of validatePath for conditional logic.
 *
 * @param basePath - Base directory
 * @param fullPath - Path to check
 * @returns True if path is within basePath
 *
 * @example
 * ```typescript
 * if (isPathWithinBase('/project', somePath)) {
 *   // Safe to proceed
 *   await processFile(somePath)
 * } else {
 *   console.warn('Path is outside project directory')
 * }
 * ```
 */
export function isPathWithinBase(basePath: string, fullPath: string): boolean {
  try {
    validatePath(basePath, fullPath)
    return true
  } catch {
    return false
  }
}

/**
 * Get relative path from base to target
 *
 * Useful for displaying paths to users or in logs.
 *
 * @param basePath - Base directory
 * @param targetPath - Target path
 * @returns Relative path from base to target
 *
 * @example
 * ```typescript
 * const rel = getRelativePath('/project', '/project/src/index.ts')
 * console.log(rel) // 'src/index.ts'
 * ```
 */
export function getRelativePath(basePath: string, targetPath: string): string {
  return path.relative(basePath, targetPath)
}

/**
 * Normalize a path for consistent comparison
 *
 * Handles platform differences (e.g., Windows vs Unix path separators).
 *
 * @param filePath - Path to normalize
 * @returns Normalized path
 *
 * @example
 * ```typescript
 * const normalized = normalizePath('src\\index.ts')
 * // On Unix: 'src/index.ts'
 * // On Windows: 'src\\index.ts'
 * ```
 */
export function normalizePath(filePath: string): string {
  return path.normalize(filePath)
}

/**
 * Check if a path is absolute
 *
 * @param filePath - Path to check
 * @returns True if path is absolute
 *
 * @example
 * ```typescript
 * isAbsolutePath('/project/file.txt') // true
 * isAbsolutePath('src/file.txt') // false
 * isAbsolutePath('C:\\project\\file.txt') // true (Windows)
 * ```
 */
export function isAbsolutePath(filePath: string): boolean {
  return path.isAbsolute(filePath)
}

/**
 * Join path segments safely
 *
 * Joins path segments and validates the result is within basePath.
 *
 * @param basePath - Base directory
 * @param segments - Path segments to join
 * @returns Joined and validated path
 * @throws PathValidationError if result is outside basePath
 *
 * @example
 * ```typescript
 * const joined = joinPathSafe('/project', 'src', 'utils', 'index.ts')
 * // Returns: '/project/src/utils/index.ts'
 *
 * joinPathSafe('/project', '..', 'etc', 'passwd')
 * // Throws: PathValidationError
 * ```
 */
export function joinPathSafe(basePath: string, ...segments: string[]): string {
  const joined = path.join(basePath, ...segments)
  validatePath(basePath, joined)
  return joined
}

/**
 * Extract directory name from path
 *
 * @param filePath - File path
 * @returns Directory path
 *
 * @example
 * ```typescript
 * const dir = getDirectoryPath('/project/src/index.ts')
 * // Returns: '/project/src'
 * ```
 */
export function getDirectoryPath(filePath: string): string {
  return path.dirname(filePath)
}

/**
 * Extract filename from path
 *
 * @param filePath - File path
 * @param includeExtension - Whether to include file extension (default: true)
 * @returns Filename
 *
 * @example
 * ```typescript
 * getFilename('/project/src/index.ts') // 'index.ts'
 * getFilename('/project/src/index.ts', false) // 'index'
 * ```
 */
export function getFilename(
  filePath: string,
  includeExtension: boolean = true
): string {
  if (includeExtension) {
    return path.basename(filePath)
  }
  return path.basename(filePath, path.extname(filePath))
}

/**
 * Get file extension
 *
 * @param filePath - File path
 * @returns File extension (including dot) or empty string
 *
 * @example
 * ```typescript
 * getFileExtension('/project/src/index.ts') // '.ts'
 * getFileExtension('/project/README') // ''
 * ```
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath)
}

/**
 * Validate multiple paths at once
 *
 * Useful for validating a batch of file paths before processing.
 *
 * @param basePath - Base directory
 * @param paths - Array of paths to validate
 * @returns Object with valid paths and invalid paths
 *
 * @example
 * ```typescript
 * const result = validatePaths('/project', [
 *   '/project/file1.txt',
 *   '/etc/passwd',
 *   '/project/file2.txt'
 * ])
 * console.log(result.valid) // ['/project/file1.txt', '/project/file2.txt']
 * console.log(result.invalid) // ['/etc/passwd']
 * ```
 */
export function validatePaths(
  basePath: string,
  paths: string[]
): {
  valid: string[]
  invalid: Array<{ path: string; error: string }>
} {
  const valid: string[] = []
  const invalid: Array<{ path: string; error: string }> = []

  for (const filePath of paths) {
    try {
      validatePath(basePath, filePath)
      valid.push(filePath)
    } catch (error) {
      invalid.push({
        path: filePath,
        error: error instanceof Error ? error.message : 'Validation failed',
      })
    }
  }

  return { valid, invalid }
}
