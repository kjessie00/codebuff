/**
 * Unit tests for File Operations Tools
 *
 * Tests the read_files, write_file, and str_replace tools
 * without requiring an API key (FREE mode compatible).
 */

import { FileOperationsTools } from '../../../src/tools/file-operations'
import {
  createTestDir,
  createTestFiles,
  readTestFile,
  testFileExists,
  assertToolSuccess,
  assertToolError,
  getToolResultValue,
} from '../../utils/test-helpers'

describe('FileOperationsTools', () => {
  let tools: FileOperationsTools
  let testDir: string

  beforeEach(async () => {
    testDir = await createTestDir('file-ops-test-')
    tools = new FileOperationsTools(testDir)
  })

  describe('readFiles', () => {
    it('should read a single file', async () => {
      // Setup
      await createTestFiles(testDir, {
        'test.txt': 'Hello, World!',
      })

      // Execute
      const result = await tools.readFiles({
        paths: ['test.txt'],
      })

      // Assert
      assertToolSuccess(result)
      const value = getToolResultValue(result)
      expect(value).toEqual({
        'test.txt': 'Hello, World!',
      })
    })

    it('should read multiple files in parallel', async () => {
      // Setup
      await createTestFiles(testDir, {
        'file1.txt': 'Content 1',
        'file2.txt': 'Content 2',
        'file3.txt': 'Content 3',
      })

      // Execute
      const result = await tools.readFiles({
        paths: ['file1.txt', 'file2.txt', 'file3.txt'],
      })

      // Assert
      assertToolSuccess(result)
      const value = getToolResultValue(result)
      expect(value).toEqual({
        'file1.txt': 'Content 1',
        'file2.txt': 'Content 2',
        'file3.txt': 'Content 3',
      })
    })

    it('should handle non-existent files gracefully', async () => {
      // Execute
      const result = await tools.readFiles({
        paths: ['non-existent.txt'],
      })

      // Assert
      const value = getToolResultValue(result)
      expect(value).toEqual({
        'non-existent.txt': null,
      })
    })

    it('should handle mix of existing and non-existent files', async () => {
      // Setup
      await createTestFiles(testDir, {
        'exists.txt': 'I exist!',
      })

      // Execute
      const result = await tools.readFiles({
        paths: ['exists.txt', 'missing.txt'],
      })

      // Assert
      const value = getToolResultValue(result)
      expect(value).toEqual({
        'exists.txt': 'I exist!',
        'missing.txt': null,
      })
    })

    it('should read files from nested directories', async () => {
      // Setup
      await createTestFiles(testDir, {
        'src/index.ts': 'export const foo = "bar"',
        'src/utils/helper.ts': 'export const helper = true',
      })

      // Execute
      const result = await tools.readFiles({
        paths: ['src/index.ts', 'src/utils/helper.ts'],
      })

      // Assert
      assertToolSuccess(result)
      const value = getToolResultValue(result)
      expect(value['src/index.ts']).toBe('export const foo = "bar"')
      expect(value['src/utils/helper.ts']).toBe('export const helper = true')
    })

    it('should handle UTF-8 content correctly', async () => {
      // Setup
      await createTestFiles(testDir, {
        'unicode.txt': '你好世界 🌍 مرحبا',
      })

      // Execute
      const result = await tools.readFiles({
        paths: ['unicode.txt'],
      })

      // Assert
      const value = getToolResultValue(result)
      expect(value['unicode.txt']).toBe('你好世界 🌍 مرحبا')
    })

    it('should prevent path traversal attacks', async () => {
      // Try to read outside the working directory
      const result = await tools.readFiles({
        paths: ['../../../etc/passwd'],
      })

      // Should fail or return null (security check)
      const value = getToolResultValue(result)
      expect(value['../../../etc/passwd']).toBeNull()
    })
  })

  describe('writeFile', () => {
    it('should create a new file', async () => {
      // Execute
      const result = await tools.writeFile({
        path: 'new-file.txt',
        content: 'New content',
      })

      // Assert
      assertToolSuccess(result)
      const value = getToolResultValue(result)
      expect(value.success).toBe(true)
      expect(value.path).toBe('new-file.txt')

      // Verify file was created
      const content = await readTestFile(testDir, 'new-file.txt')
      expect(content).toBe('New content')
    })

    it('should overwrite an existing file', async () => {
      // Setup
      await createTestFiles(testDir, {
        'existing.txt': 'Old content',
      })

      // Execute
      const result = await tools.writeFile({
        path: 'existing.txt',
        content: 'New content',
      })

      // Assert
      assertToolSuccess(result)

      // Verify content was overwritten
      const content = await readTestFile(testDir, 'existing.txt')
      expect(content).toBe('New content')
    })

    it('should create parent directories automatically', async () => {
      // Execute
      const result = await tools.writeFile({
        path: 'deep/nested/path/file.txt',
        content: 'Nested content',
      })

      // Assert
      assertToolSuccess(result)

      // Verify file exists in nested directory
      const exists = await testFileExists(testDir, 'deep/nested/path/file.txt')
      expect(exists).toBe(true)

      const content = await readTestFile(testDir, 'deep/nested/path/file.txt')
      expect(content).toBe('Nested content')
    })

    it('should handle empty content', async () => {
      // Execute
      const result = await tools.writeFile({
        path: 'empty.txt',
        content: '',
      })

      // Assert
      assertToolSuccess(result)

      // Verify empty file was created
      const content = await readTestFile(testDir, 'empty.txt')
      expect(content).toBe('')
    })

    it('should handle UTF-8 content correctly', async () => {
      // Execute
      const result = await tools.writeFile({
        path: 'unicode.txt',
        content: '你好世界 🌍 مرحبا',
      })

      // Assert
      assertToolSuccess(result)

      // Verify UTF-8 content
      const content = await readTestFile(testDir, 'unicode.txt')
      expect(content).toBe('你好世界 🌍 مرحبا')
    })

    it('should prevent path traversal attacks', async () => {
      // Try to write outside the working directory
      const result = await tools.writeFile({
        path: '../../../tmp/malicious.txt',
        content: 'Malicious content',
      })

      // Should fail
      const value = getToolResultValue(result)
      expect(value.success).toBe(false)
      expect(value.error).toBeDefined()
    })
  })

  describe('strReplace', () => {
    it('should replace text in a file', async () => {
      // Setup
      await createTestFiles(testDir, {
        'config.ts': 'const PORT = 3000',
      })

      // Execute
      const result = await tools.strReplace({
        path: 'config.ts',
        old_string: 'const PORT = 3000',
        new_string: 'const PORT = 8080',
      })

      // Assert
      assertToolSuccess(result)
      const value = getToolResultValue(result)
      expect(value.success).toBe(true)

      // Verify replacement
      const content = await readTestFile(testDir, 'config.ts')
      expect(content).toBe('const PORT = 8080')
    })

    it('should replace only the first occurrence', async () => {
      // Setup
      await createTestFiles(testDir, {
        'test.txt': 'foo bar foo baz',
      })

      // Execute
      const result = await tools.strReplace({
        path: 'test.txt',
        old_string: 'foo',
        new_string: 'qux',
      })

      // Assert
      assertToolSuccess(result)

      // Verify only first occurrence was replaced
      const content = await readTestFile(testDir, 'test.txt')
      expect(content).toBe('qux bar foo baz')
    })

    it('should handle multiline replacements', async () => {
      // Setup
      await createTestFiles(testDir, {
        'multiline.ts': 'function old() {\n  return "old"\n}',
      })

      // Execute
      const result = await tools.strReplace({
        path: 'multiline.ts',
        old_string: 'function old() {\n  return "old"\n}',
        new_string: 'function new() {\n  return "new"\n}',
      })

      // Assert
      assertToolSuccess(result)

      // Verify replacement
      const content = await readTestFile(testDir, 'multiline.ts')
      expect(content).toBe('function new() {\n  return "new"\n}')
    })

    it('should fail when old_string is not found', async () => {
      // Setup
      await createTestFiles(testDir, {
        'test.txt': 'Hello, World!',
      })

      // Execute
      const result = await tools.strReplace({
        path: 'test.txt',
        old_string: 'Goodbye',
        new_string: 'Farewell',
      })

      // Assert
      const value = getToolResultValue(result)
      expect(value.success).toBe(false)
      expect(value.error).toBe('old_string not found in file')
    })

    it('should fail when file does not exist', async () => {
      // Execute
      const result = await tools.strReplace({
        path: 'non-existent.txt',
        old_string: 'foo',
        new_string: 'bar',
      })

      // Assert
      const value = getToolResultValue(result)
      expect(value.success).toBe(false)
      expect(value.error).toContain('File not found')
    })

    it('should handle empty string replacement', async () => {
      // Setup
      await createTestFiles(testDir, {
        'test.txt': 'Remove this text',
      })

      // Execute
      const result = await tools.strReplace({
        path: 'test.txt',
        old_string: ' this',
        new_string: '',
      })

      // Assert
      assertToolSuccess(result)

      // Verify replacement
      const content = await readTestFile(testDir, 'test.txt')
      expect(content).toBe('Remove text')
    })

    it('should prevent path traversal attacks', async () => {
      // Try to modify file outside working directory
      const result = await tools.strReplace({
        path: '../../../tmp/test.txt',
        old_string: 'foo',
        new_string: 'bar',
      })

      // Should fail
      const value = getToolResultValue(result)
      expect(value.success).toBe(false)
      expect(value.error).toBeDefined()
    })
  })

  describe('Path validation and security', () => {
    it('should reject absolute paths outside cwd', async () => {
      const result = await tools.readFiles({
        paths: ['/etc/passwd'],
      })

      const value = getToolResultValue(result)
      expect(value['/etc/passwd']).toBeNull()
    })

    it('should handle relative paths correctly', async () => {
      // Setup nested structure
      await createTestFiles(testDir, {
        'src/index.ts': 'content',
        'src/utils/helper.ts': 'helper',
      })

      // Read with relative path
      const result = await tools.readFiles({
        paths: ['src/../src/index.ts'],
      })

      // Should resolve correctly
      const value = getToolResultValue(result)
      expect(value['src/../src/index.ts']).toBe('content')
    })

    it('should invalidate CWD cache when requested', async () => {
      // This tests the cache invalidation utility
      tools.invalidateCwdCache()

      // Should still work after cache invalidation
      await createTestFiles(testDir, {
        'test.txt': 'content',
      })

      const result = await tools.readFiles({
        paths: ['test.txt'],
      })

      assertToolSuccess(result)
    })
  })

  describe('Performance', () => {
    it('should read multiple files in parallel efficiently', async () => {
      // Setup many files
      const files: Record<string, string> = {}
      for (let i = 0; i < 20; i++) {
        files[`file-${i}.txt`] = `Content ${i}`
      }
      await createTestFiles(testDir, files)

      // Measure time
      const start = Date.now()
      const result = await tools.readFiles({
        paths: Object.keys(files),
      })
      const duration = Date.now() - start

      // Assert
      assertToolSuccess(result)
      const value = getToolResultValue(result)
      expect(Object.keys(value).length).toBe(20)

      // Should be faster than 1 second for 20 files
      expect(duration).toBeLessThan(1000)
    })
  })
})
