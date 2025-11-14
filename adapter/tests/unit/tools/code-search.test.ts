/**
 * Unit tests for Code Search Tools
 *
 * Tests the code_search and find_files tools
 * without requiring an API key (FREE mode compatible).
 */

import { CodeSearchTools } from '../../../src/tools/code-search'
import {
  createTestDir,
  createTestFiles,
  assertToolSuccess,
  getToolResultValue,
} from '../../utils/test-helpers'

describe('CodeSearchTools', () => {
  let tools: CodeSearchTools
  let testDir: string

  beforeEach(async () => {
    testDir = await createTestDir('code-search-test-')
    tools = new CodeSearchTools(testDir)
  })

  describe('codeSearch', () => {
    beforeEach(async () => {
      // Create test files with searchable content
      await createTestFiles(testDir, {
        'src/index.ts': 'export function handleSteps() {\n  return "hello"\n}',
        'src/utils.ts': 'export function helper() {\n  return "world"\n}',
        'src/test.ts': 'import { handleSteps } from "./index"',
        'README.md': '# Project\nUsing handleSteps function',
      })
    })

    it('should find matches for a simple query', async () => {
      // Execute
      const result = await tools.codeSearch({
        query: 'handleSteps',
      })

      // Assert
      assertToolSuccess(result)
      const value = getToolResultValue(result)
      expect(value.results).toBeDefined()
      expect(value.results.length).toBeGreaterThan(0)
      expect(value.query).toBe('handleSteps')

      // Should find matches in multiple files
      const paths = value.results.map((r: any) => r.path)
      expect(paths).toContain('src/index.ts')
      expect(paths).toContain('src/test.ts')
    })

    it('should support regex patterns', async () => {
      // Execute - find functions
      const result = await tools.codeSearch({
        query: 'function.*\\(\\)',
      })

      // Assert
      assertToolSuccess(result)
      const value = getToolResultValue(result)
      expect(value.results.length).toBeGreaterThan(0)

      // Should match function declarations
      const lines = value.results.map((r: any) => r.line)
      expect(lines.some((l: string) => l.includes('function'))).toBe(true)
    })

    it('should filter by file pattern', async () => {
      // Execute - only search TypeScript files
      const result = await tools.codeSearch({
        query: 'function',
        file_pattern: '*.ts',
      })

      // Assert
      assertToolSuccess(result)
      const value = getToolResultValue(result)

      // Should only include .ts files, not .md
      const paths = value.results.map((r: any) => r.path)
      expect(paths.every((p: string) => p.endsWith('.ts'))).toBe(true)
      expect(paths.some((p: string) => p.endsWith('.md'))).toBe(false)
    })

    it('should support case-insensitive search', async () => {
      // Execute
      const result = await tools.codeSearch({
        query: 'HANDLESTEPS',
        case_sensitive: false,
      })

      // Assert
      assertToolSuccess(result)
      const value = getToolResultValue(result)
      expect(value.results.length).toBeGreaterThan(0)
      expect(value.case_sensitive).toBe(false)
    })

    it('should support case-sensitive search', async () => {
      // Execute - search for lowercase (should find)
      const result1 = await tools.codeSearch({
        query: 'handleSteps',
        case_sensitive: true,
      })

      // Execute - search for uppercase (should not find)
      const result2 = await tools.codeSearch({
        query: 'HANDLESTEPS',
        case_sensitive: true,
      })

      // Assert
      const value1 = getToolResultValue(result1)
      const value2 = getToolResultValue(result2)

      expect(value1.results.length).toBeGreaterThan(0)
      expect(value2.results.length).toBe(0)
    })

    it('should return empty results when no matches found', async () => {
      // Execute
      const result = await tools.codeSearch({
        query: 'nonexistentpattern123456',
      })

      // Assert
      assertToolSuccess(result)
      const value = getToolResultValue(result)
      expect(value.results).toEqual([])
      expect(value.total).toBe(0)
    })

    it('should respect maxResults limit', async () => {
      // Create many matches
      const files: Record<string, string> = {}
      for (let i = 0; i < 50; i++) {
        files[`file-${i}.ts`] = `export const value${i} = "test"`
      }
      await createTestFiles(testDir, files)

      // Execute with low max results
      const result = await tools.codeSearch({
        query: 'export',
        maxResults: 10,
      })

      // Assert
      const value = getToolResultValue(result)
      expect(value.results.length).toBeLessThanOrEqual(10)
    })

    it('should group results by file', async () => {
      // Execute
      const result = await tools.codeSearch({
        query: 'function',
      })

      // Assert
      const value = getToolResultValue(result)
      expect(value.by_file).toBeDefined()
      expect(typeof value.by_file).toBe('object')

      // Each file should have an array of results
      for (const [file, results] of Object.entries(value.by_file)) {
        expect(Array.isArray(results)).toBe(true)
      }
    })

    it('should include line numbers in results', async () => {
      // Execute
      const result = await tools.codeSearch({
        query: 'function',
      })

      // Assert
      const value = getToolResultValue(result)
      for (const match of value.results) {
        expect(match.line_number).toBeGreaterThan(0)
        expect(match.path).toBeDefined()
        expect(match.line).toBeDefined()
      }
    })

    it('should prevent command injection through query', async () => {
      // Try malicious query
      const result = await tools.codeSearch({
        query: 'test; rm -rf /',
      })

      // Should fail with error (contains shell metacharacters)
      const value = getToolResultValue(result)
      expect(value.error).toBeDefined()
      expect(value.error).toContain('metacharacters')
    })

    it('should prevent command injection through file_pattern', async () => {
      // Try malicious file pattern
      const result = await tools.codeSearch({
        query: 'test',
        file_pattern: '*.ts; rm -rf /',
      })

      // Should fail with error
      const value = getToolResultValue(result)
      expect(value.error).toBeDefined()
      expect(value.error).toContain('metacharacters')
    })

    it('should handle ripgrep not found gracefully', async () => {
      // This test assumes ripgrep might not be installed
      // If ripgrep is installed, this will pass, otherwise it tests error handling

      const hasRipgrep = await tools.verifyRipgrep()

      if (!hasRipgrep) {
        const result = await tools.codeSearch({
          query: 'test',
        })

        const value = getToolResultValue(result)
        expect(value.error).toBeDefined()
        expect(value.error).toContain('ripgrep')
      } else {
        // If ripgrep is available, just verify it works
        expect(hasRipgrep).toBe(true)
      }
    })

    it('should search in subdirectories', async () => {
      // Create nested structure
      await createTestFiles(testDir, {
        'level1/file.ts': 'const searchterm = true',
        'level1/level2/file.ts': 'const searchterm = false',
        'level1/level2/level3/file.ts': 'const searchterm = null',
      })

      // Execute
      const result = await tools.codeSearch({
        query: 'searchterm',
      })

      // Assert - should find in all levels
      const value = getToolResultValue(result)
      expect(value.results.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('findFiles', () => {
    beforeEach(async () => {
      // Create test file structure
      await createTestFiles(testDir, {
        'src/index.ts': 'content',
        'src/utils.ts': 'content',
        'src/types.ts': 'content',
        'tests/index.test.ts': 'content',
        'tests/utils.test.ts': 'content',
        'README.md': 'content',
        'package.json': '{}',
      })
    })

    it('should find files matching glob pattern', async () => {
      // Execute
      const result = await tools.findFiles({
        pattern: '*.ts',
      })

      // Assert
      assertToolSuccess(result)
      const value = getToolResultValue(result)
      expect(value.files).toBeDefined()
      expect(value.files.length).toBeGreaterThan(0)

      // All results should be .ts files
      expect(value.files.every((f: string) => f.endsWith('.ts'))).toBe(true)
    })

    it('should support wildcard patterns', async () => {
      // Execute - find all TypeScript files in src
      const result = await tools.findFiles({
        pattern: 'src/*.ts',
      })

      // Assert
      const value = getToolResultValue(result)
      expect(value.files).toContain('src/index.ts')
      expect(value.files).toContain('src/utils.ts')
      expect(value.files).toContain('src/types.ts')

      // Should not include test files
      expect(value.files.every((f: string) => !f.includes('test'))).toBe(true)
    })

    it('should support recursive glob patterns', async () => {
      // Execute - find all .ts files recursively
      const result = await tools.findFiles({
        pattern: '**/*.ts',
      })

      // Assert
      const value = getToolResultValue(result)

      // Should find files in all directories
      expect(value.files.some((f: string) => f.startsWith('src/'))).toBe(true)
      expect(value.files.some((f: string) => f.startsWith('tests/'))).toBe(true)
    })

    it('should find test files specifically', async () => {
      // Execute
      const result = await tools.findFiles({
        pattern: '**/*.test.ts',
      })

      // Assert
      const value = getToolResultValue(result)
      expect(value.files.length).toBe(2)
      expect(value.files).toContain('tests/index.test.ts')
      expect(value.files).toContain('tests/utils.test.ts')
    })

    it('should return file count', async () => {
      // Execute
      const result = await tools.findFiles({
        pattern: '*.ts',
      })

      // Assert
      const value = getToolResultValue(result)
      expect(value.total).toBe(value.files.length)
    })

    it('should return empty array when no matches found', async () => {
      // Execute
      const result = await tools.findFiles({
        pattern: '*.nonexistent',
      })

      // Assert
      assertToolSuccess(result)
      const value = getToolResultValue(result)
      expect(value.files).toEqual([])
      expect(value.total).toBe(0)
    })

    it('should exclude node_modules by default', async () => {
      // Create node_modules structure
      await createTestFiles(testDir, {
        'node_modules/package/index.ts': 'content',
        'src/index.ts': 'content',
      })

      // Execute
      const result = await tools.findFiles({
        pattern: '**/*.ts',
      })

      // Assert - should not include node_modules
      const value = getToolResultValue(result)
      expect(value.files.every((f: string) => !f.includes('node_modules'))).toBe(true)
    })

    it('should exclude .git directory by default', async () => {
      // Create .git structure
      await createTestFiles(testDir, {
        '.git/config': 'content',
        'src/index.ts': 'content',
      })

      // Execute
      const result = await tools.findFiles({
        pattern: '**/*',
      })

      // Assert - should not include .git
      const value = getToolResultValue(result)
      expect(value.files.every((f: string) => !f.includes('.git'))).toBe(true)
    })

    it('should exclude build directories by default', async () => {
      // Create build directories
      await createTestFiles(testDir, {
        'dist/index.js': 'content',
        'build/output.js': 'content',
        'src/index.ts': 'content',
      })

      // Execute
      const result = await tools.findFiles({
        pattern: '**/*',
      })

      // Assert - should not include dist or build
      const value = getToolResultValue(result)
      expect(value.files.every((f: string) => !f.includes('dist/'))).toBe(true)
      expect(value.files.every((f: string) => !f.includes('build/'))).toBe(true)
    })

    it('should sort files by modification time', async () => {
      // Create files with delays to ensure different mtimes
      await createTestFiles(testDir, {
        'old.ts': 'content',
      })

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100))

      await createTestFiles(testDir, {
        'new.ts': 'content',
      })

      // Execute
      const result = await tools.findFiles({
        pattern: '*.ts',
      })

      // Assert - newer file should come first
      const value = getToolResultValue(result)
      expect(value.files[0]).toBe('new.ts')
    })

    it('should handle multiple pattern types', async () => {
      // Execute - find JSON and Markdown files
      const result1 = await tools.findFiles({
        pattern: '*.json',
      })

      const result2 = await tools.findFiles({
        pattern: '*.md',
      })

      // Assert
      const value1 = getToolResultValue(result1)
      const value2 = getToolResultValue(result2)

      expect(value1.files).toContain('package.json')
      expect(value2.files).toContain('README.md')
    })
  })

  describe('verifyRipgrep', () => {
    it('should check if ripgrep is available', async () => {
      // Execute
      const isAvailable = await tools.verifyRipgrep()

      // Assert - should be boolean
      expect(typeof isAvailable).toBe('boolean')

      // If available, should be able to get version
      if (isAvailable) {
        const version = await tools.getRipgrepVersion()
        expect(version).toBeDefined()
        expect(typeof version).toBe('string')
      }
    })
  })

  describe('getRipgrepVersion', () => {
    it('should get ripgrep version or null', async () => {
      // Execute
      const version = await tools.getRipgrepVersion()

      // Assert
      if (version) {
        expect(typeof version).toBe('string')
        expect(version.length).toBeGreaterThan(0)
      } else {
        expect(version).toBeNull()
      }
    })
  })

  describe('Security', () => {
    it('should prevent directory traversal in cwd parameter', async () => {
      // Try to search outside base directory
      const result = await tools.codeSearch({
        query: 'test',
        cwd: '../../..',
      })

      // Should fail with error
      const value = getToolResultValue(result)
      expect(value.error).toBeDefined()
      expect(value.error).toContain('outside working directory')
    })

    it('should validate all input parameters', async () => {
      // Test various malicious inputs
      const maliciousInputs = [
        { query: '`rm -rf /`' },
        { query: '$(whoami)' },
        { query: 'test', file_pattern: '`evil`' },
      ]

      for (const input of maliciousInputs) {
        const result = await tools.codeSearch(input as any)
        const value = getToolResultValue(result)

        // Should have an error
        expect(value.error).toBeDefined()
      }
    })
  })
})
