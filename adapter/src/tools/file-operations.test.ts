/**
 * Unit tests for FileOperationsTools
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { FileOperationsTools } from './file-operations'

describe('FileOperationsTools', () => {
  let tempDir: string
  let tools: FileOperationsTools

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-ops-test-'))
    tools = new FileOperationsTools(tempDir)
  })

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('readFiles', () => {
    test('should read a single file successfully', async () => {
      // Setup: Create a test file
      const testFile = 'test.txt'
      const testContent = 'Hello, World!'
      await fs.writeFile(path.join(tempDir, testFile), testContent)

      // Execute
      const result = await tools.readFiles({ paths: [testFile] })

      // Verify
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('json')
      expect(result[0].value).toEqual({
        [testFile]: testContent,
      })
    })

    test('should read multiple files successfully', async () => {
      // Setup: Create multiple test files
      const files = {
        'file1.txt': 'Content 1',
        'file2.txt': 'Content 2',
        'file3.txt': 'Content 3',
      }

      for (const [filename, content] of Object.entries(files)) {
        await fs.writeFile(path.join(tempDir, filename), content)
      }

      // Execute
      const result = await tools.readFiles({
        paths: Object.keys(files),
      })

      // Verify
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('json')
      expect(result[0].value).toEqual(files)
    })

    test('should return null for non-existent files', async () => {
      // Execute
      const result = await tools.readFiles({
        paths: ['non-existent.txt'],
      })

      // Verify
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('json')
      expect(result[0].value).toEqual({
        'non-existent.txt': null,
      })
    })

    test('should handle mix of existing and non-existing files', async () => {
      // Setup: Create one file
      const existingFile = 'exists.txt'
      const existingContent = 'I exist'
      await fs.writeFile(path.join(tempDir, existingFile), existingContent)

      // Execute
      const result = await tools.readFiles({
        paths: [existingFile, 'does-not-exist.txt'],
      })

      // Verify
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('json')
      expect(result[0].value).toEqual({
        [existingFile]: existingContent,
        'does-not-exist.txt': null,
      })
    })

    test('should read files in subdirectories', async () => {
      // Setup: Create file in subdirectory
      const subdir = 'subdir'
      const testFile = path.join(subdir, 'test.txt')
      const testContent = 'Nested content'

      await fs.mkdir(path.join(tempDir, subdir))
      await fs.writeFile(path.join(tempDir, testFile), testContent)

      // Execute
      const result = await tools.readFiles({ paths: [testFile] })

      // Verify
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('json')
      expect(result[0].value).toEqual({
        [testFile]: testContent,
      })
    })

    test('should handle UTF-8 content correctly', async () => {
      // Setup: Create file with special characters
      const testFile = 'unicode.txt'
      const testContent = '你好世界 🌍 Émojis and spëcial chars!'
      await fs.writeFile(path.join(tempDir, testFile), testContent)

      // Execute
      const result = await tools.readFiles({ paths: [testFile] })

      // Verify
      expect(result[0].value[testFile]).toBe(testContent)
    })
  })

  describe('writeFile', () => {
    test('should write a file successfully', async () => {
      // Execute
      const testFile = 'new-file.txt'
      const testContent = 'New content'
      const result = await tools.writeFile({
        path: testFile,
        content: testContent,
      })

      // Verify result
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('json')
      expect(result[0].value).toEqual({
        success: true,
        path: testFile,
      })

      // Verify file was created
      const actualContent = await fs.readFile(
        path.join(tempDir, testFile),
        'utf-8'
      )
      expect(actualContent).toBe(testContent)
    })

    test('should overwrite existing file', async () => {
      // Setup: Create existing file
      const testFile = 'existing.txt'
      const oldContent = 'Old content'
      const newContent = 'New content'
      await fs.writeFile(path.join(tempDir, testFile), oldContent)

      // Execute
      const result = await tools.writeFile({
        path: testFile,
        content: newContent,
      })

      // Verify
      expect(result[0].value).toMatchObject({ success: true })
      const actualContent = await fs.readFile(
        path.join(tempDir, testFile),
        'utf-8'
      )
      expect(actualContent).toBe(newContent)
    })

    test('should create parent directories if they do not exist', async () => {
      // Execute
      const testFile = path.join('deeply', 'nested', 'dir', 'file.txt')
      const testContent = 'Nested file content'
      const result = await tools.writeFile({
        path: testFile,
        content: testContent,
      })

      // Verify
      expect(result[0].value).toMatchObject({ success: true })
      const actualContent = await fs.readFile(
        path.join(tempDir, testFile),
        'utf-8'
      )
      expect(actualContent).toBe(testContent)
    })

    test('should handle UTF-8 content correctly', async () => {
      // Execute
      const testFile = 'unicode.txt'
      const testContent = '你好世界 🌍 Émojis and spëcial chars!'
      await tools.writeFile({
        path: testFile,
        content: testContent,
      })

      // Verify
      const actualContent = await fs.readFile(
        path.join(tempDir, testFile),
        'utf-8'
      )
      expect(actualContent).toBe(testContent)
    })

    test('should handle empty content', async () => {
      // Execute
      const testFile = 'empty.txt'
      const result = await tools.writeFile({
        path: testFile,
        content: '',
      })

      // Verify
      expect(result[0].value).toMatchObject({ success: true })
      const actualContent = await fs.readFile(
        path.join(tempDir, testFile),
        'utf-8'
      )
      expect(actualContent).toBe('')
    })
  })

  describe('strReplace', () => {
    test('should replace string successfully', async () => {
      // Setup: Create file with content
      const testFile = 'replace.txt'
      const oldString = 'foo'
      const newString = 'bar'
      const content = `Hello ${oldString} world`
      await fs.writeFile(path.join(tempDir, testFile), content)

      // Execute
      const result = await tools.strReplace({
        path: testFile,
        old_string: oldString,
        new_string: newString,
      })

      // Verify result
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('json')
      expect(result[0].value).toEqual({
        success: true,
        path: testFile,
      })

      // Verify file content
      const actualContent = await fs.readFile(
        path.join(tempDir, testFile),
        'utf-8'
      )
      expect(actualContent).toBe(`Hello ${newString} world`)
    })

    test('should replace only first occurrence', async () => {
      // Setup: Create file with multiple occurrences
      const testFile = 'multiple.txt'
      const oldString = 'foo'
      const newString = 'bar'
      const content = `${oldString} and ${oldString} again`
      await fs.writeFile(path.join(tempDir, testFile), content)

      // Execute
      const result = await tools.strReplace({
        path: testFile,
        old_string: oldString,
        new_string: newString,
      })

      // Verify - should replace only first occurrence
      expect(result[0].value).toMatchObject({ success: true })
      const actualContent = await fs.readFile(
        path.join(tempDir, testFile),
        'utf-8'
      )
      expect(actualContent).toBe(`${newString} and ${oldString} again`)
    })

    test('should return error if file does not exist', async () => {
      // Execute
      const result = await tools.strReplace({
        path: 'non-existent.txt',
        old_string: 'foo',
        new_string: 'bar',
      })

      // Verify
      expect(result[0].value).toMatchObject({
        success: false,
        error: expect.stringContaining('File not found'),
      })
    })

    test('should return error if old_string not found', async () => {
      // Setup: Create file without the target string
      const testFile = 'no-match.txt'
      const content = 'Hello world'
      await fs.writeFile(path.join(tempDir, testFile), content)

      // Execute
      const result = await tools.strReplace({
        path: testFile,
        old_string: 'nonexistent',
        new_string: 'replacement',
      })

      // Verify
      expect(result[0].value).toMatchObject({
        success: false,
        error: 'old_string not found in file',
      })

      // Verify file was not modified
      const actualContent = await fs.readFile(
        path.join(tempDir, testFile),
        'utf-8'
      )
      expect(actualContent).toBe(content)
    })

    test('should handle multiline replacements', async () => {
      // Setup: Create file with multiline content
      const testFile = 'multiline.txt'
      const oldString = 'line 1\nline 2'
      const newString = 'replaced\nlines'
      const content = `Before\n${oldString}\nAfter`
      await fs.writeFile(path.join(tempDir, testFile), content)

      // Execute
      const result = await tools.strReplace({
        path: testFile,
        old_string: oldString,
        new_string: newString,
      })

      // Verify
      expect(result[0].value).toMatchObject({ success: true })
      const actualContent = await fs.readFile(
        path.join(tempDir, testFile),
        'utf-8'
      )
      expect(actualContent).toBe(`Before\n${newString}\nAfter`)
    })

    test('should handle whitespace-sensitive replacements', async () => {
      // Setup: Create file with specific whitespace
      const testFile = 'whitespace.txt'
      const oldString = '  indented code'
      const newString = '    more indented'
      const content = `Start\n${oldString}\nEnd`
      await fs.writeFile(path.join(tempDir, testFile), content)

      // Execute
      const result = await tools.strReplace({
        path: testFile,
        old_string: oldString,
        new_string: newString,
      })

      // Verify
      expect(result[0].value).toMatchObject({ success: true })
      const actualContent = await fs.readFile(
        path.join(tempDir, testFile),
        'utf-8'
      )
      expect(actualContent).toBe(`Start\n${newString}\nEnd`)
    })

    test('should handle empty replacement string', async () => {
      // Setup: Create file
      const testFile = 'delete.txt'
      const oldString = 'DELETE_ME'
      const content = `Before ${oldString} After`
      await fs.writeFile(path.join(tempDir, testFile), content)

      // Execute - replace with empty string (deletion)
      const result = await tools.strReplace({
        path: testFile,
        old_string: oldString,
        new_string: '',
      })

      // Verify
      expect(result[0].value).toMatchObject({ success: true })
      const actualContent = await fs.readFile(
        path.join(tempDir, testFile),
        'utf-8'
      )
      expect(actualContent).toBe('Before  After')
    })
  })

  describe('path security', () => {
    test('should prevent directory traversal attacks', async () => {
      // Attempt to write outside of tempDir
      const maliciousPath = '../../../etc/passwd'

      // This should throw an error
      await expect(async () => {
        await tools.writeFile({
          path: maliciousPath,
          content: 'malicious content',
        })
      }).toThrow(/Path traversal detected/)
    })

    test('should allow absolute paths within cwd', async () => {
      // Create absolute path within tempDir
      const absolutePath = path.join(tempDir, 'absolute.txt')
      const content = 'Absolute path content'

      // This should work
      const result = await tools.writeFile({
        path: absolutePath,
        content: content,
      })

      expect(result[0].value).toMatchObject({ success: true })
    })

    test('should normalize paths correctly', async () => {
      // Create file with path containing . and ..
      const normalizedFile = './subdir/../file.txt'
      const content = 'Normalized content'

      // Create the file
      await tools.writeFile({
        path: normalizedFile,
        content: content,
      })

      // Read it back using a different but equivalent path
      const result = await tools.readFiles({ paths: ['file.txt'] })

      expect(result[0].value['file.txt']).toBe(content)
    })
  })
})
