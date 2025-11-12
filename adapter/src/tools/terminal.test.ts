/**
 * Unit tests for TerminalTools
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { TerminalTools, createTerminalTools } from './terminal'

describe('TerminalTools', () => {
  let tempDir: string
  let tools: TerminalTools

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'terminal-test-'))
    tools = new TerminalTools(tempDir)
  })

  describe('runTerminalCommand', () => {
    test('should execute a simple command successfully', async () => {
      // Execute
      const result = await tools.runTerminalCommand({
        command: 'echo "Hello, World!"',
      })

      // Verify
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text).toContain('$ echo "Hello, World!"')
      expect(result[0].text).toContain('Hello, World!')
    })

    test('should handle commands with stderr output', async () => {
      // Execute - command that writes to stderr
      const result = await tools.runTerminalCommand({
        command: 'node -e "console.error(\'Error message\')"',
      })

      // Verify
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text).toContain('[STDERR]')
      expect(result[0].text).toContain('Error message')
    })

    test('should handle command failures with non-zero exit codes', async () => {
      // Execute - command that exits with error
      const result = await tools.runTerminalCommand({
        command: 'exit 1',
      })

      // Verify
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text).toContain('$ exit 1')
    })

    test('should respect custom working directory', async () => {
      // Setup - create subdirectory
      const subDir = 'subdir'
      await fs.mkdir(path.join(tempDir, subDir))

      // Execute - pwd command in subdirectory
      const result = await tools.runTerminalCommand({
        command: 'pwd',
        cwd: subDir,
      })

      // Verify - should show subdirectory in output
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text).toContain(subDir)
    })

    test('should respect custom timeout', async () => {
      // Execute - command that sleeps longer than timeout
      const result = await tools.runTerminalCommand({
        command: 'sleep 5',
        timeout_seconds: 1, // 1 second timeout
      })

      // Verify - should timeout
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text).toContain('[ERROR]')
      expect(result[0].text).toContain('timed out')
    })

    test('should merge environment variables', async () => {
      // Execute - command that uses custom env var
      const result = await tools.runTerminalCommand({
        command: 'echo $TEST_VAR',
        env: {
          TEST_VAR: 'custom_value',
        },
      })

      // Verify
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text).toContain('custom_value')
    })

    test('should format output like Claude CLI Bash tool', async () => {
      // Execute
      const result = await tools.runTerminalCommand({
        command: 'echo "test output"',
      })

      // Verify format: "$ command\noutput"
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      const lines = result[0].text.split('\n')
      expect(lines[0]).toBe('$ echo "test output"')
      expect(lines[1]).toContain('test output')
    })

    test('should show execution time for long-running commands', async () => {
      // Execute - command that takes more than 1 second
      const result = await tools.runTerminalCommand({
        command: 'sleep 1.5',
        timeout_seconds: 3,
      })

      // Verify - should show execution time
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text).toContain('Completed in')
      expect(result[0].text).toMatch(/\d+\.\d+s/)
    })

    test('should handle commands with pipes and redirects', async () => {
      // Execute - command with pipe
      const result = await tools.runTerminalCommand({
        command: 'echo "line1\nline2\nline3" | grep line2',
      })

      // Verify
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text).toContain('line2')
      expect(result[0].text).not.toContain('line1')
    })

    test('should prevent directory traversal attacks', async () => {
      // Execute - try to execute command in parent directory
      const result = await tools.runTerminalCommand({
        command: 'pwd',
        cwd: '../../../etc',
      })

      // Verify - should fail with path traversal error
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text).toContain('[ERROR]')
      expect(result[0].text).toContain('Path traversal')
    })
  })

  describe('executeCommandStructured', () => {
    test('should return structured result for successful command', async () => {
      // Execute
      const result = await tools.executeCommandStructured({
        command: 'echo "test"',
      })

      // Verify
      expect(result.command).toBe('echo "test"')
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('test')
      expect(result.stderr).toBe('')
      expect(result.timedOut).toBe(false)
      expect(result.executionTime).toBeGreaterThan(0)
      expect(result.cwd).toBe(tempDir)
      expect(result.error).toBeUndefined()
    })

    test('should return structured result for failed command', async () => {
      // Execute - command that fails
      const result = await tools.executeCommandStructured({
        command: 'exit 42',
      })

      // Verify
      expect(result.command).toBe('exit 42')
      expect(result.exitCode).toBe(42)
      expect(result.timedOut).toBe(false)
      expect(result.error).toBeUndefined() // Exit code is not an error
    })

    test('should return structured result for timeout', async () => {
      // Execute - command that times out
      const result = await tools.executeCommandStructured({
        command: 'sleep 10',
        timeout_seconds: 0.5,
      })

      // Verify
      expect(result.command).toBe('sleep 10')
      expect(result.timedOut).toBe(true)
      expect(result.error).toContain('timed out')
    })

    test('should capture both stdout and stderr', async () => {
      // Execute - command that writes to both streams
      const result = await tools.executeCommandStructured({
        command:
          'node -e "console.log(\'stdout\'); console.error(\'stderr\')"',
      })

      // Verify
      expect(result.stdout).toContain('stdout')
      expect(result.stderr).toContain('stderr')
    })
  })

  describe('verifyCommand', () => {
    test('should return true for existing command', async () => {
      // Execute
      const result = await tools.verifyCommand('node')

      // Verify
      expect(result).toBe(true)
    })

    test('should return false for non-existent command', async () => {
      // Execute
      const result = await tools.verifyCommand('nonexistent-command-xyz')

      // Verify
      expect(result).toBe(false)
    })
  })

  describe('getCommandVersion', () => {
    test('should get version for existing command', async () => {
      // Execute
      const version = await tools.getCommandVersion('node')

      // Verify
      expect(version).not.toBeNull()
      expect(version).toContain('v')
    })

    test('should return null for non-existent command', async () => {
      // Execute
      const version = await tools.getCommandVersion('nonexistent-command-xyz')

      // Verify
      expect(version).toBeNull()
    })

    test('should support custom version flag', async () => {
      // Execute
      const version = await tools.getCommandVersion('node', '-v')

      // Verify
      expect(version).not.toBeNull()
      expect(version).toContain('v')
    })
  })

  describe('getEnvironmentVariables', () => {
    test('should return environment variables', () => {
      // Execute
      const env = tools.getEnvironmentVariables()

      // Verify
      expect(env).toBeDefined()
      expect(typeof env).toBe('object')
      expect(env.PATH).toBeDefined()
    })

    test('should include custom environment variables', () => {
      // Setup
      const customTools = new TerminalTools(tempDir, {
        CUSTOM_VAR: 'custom_value',
      })

      // Execute
      const env = customTools.getEnvironmentVariables()

      // Verify
      expect(env.CUSTOM_VAR).toBe('custom_value')
    })
  })

  describe('createTerminalTools factory', () => {
    test('should create TerminalTools instance', () => {
      // Execute
      const instance = createTerminalTools('/tmp')

      // Verify
      expect(instance).toBeInstanceOf(TerminalTools)
    })

    test('should create TerminalTools with environment variables', () => {
      // Execute
      const instance = createTerminalTools('/tmp', { TEST: 'value' })

      // Verify
      expect(instance).toBeInstanceOf(TerminalTools)
      const env = instance.getEnvironmentVariables()
      expect(env.TEST).toBe('value')
    })
  })

  describe('integration tests', () => {
    test('should execute git command', async () => {
      // Setup - initialize git repo
      await tools.runTerminalCommand({ command: 'git init' })

      // Execute
      const result = await tools.runTerminalCommand({
        command: 'git status',
      })

      // Verify
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text).toContain('$ git status')
    })

    test('should execute npm commands with custom env', async () => {
      // Setup - create package.json
      const packageJson = {
        name: 'test',
        version: '1.0.0',
        scripts: {
          test: 'echo "Testing with NODE_ENV=$NODE_ENV"',
        },
      }
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      )

      // Execute
      const result = await tools.runTerminalCommand({
        command: 'npm run test',
        env: {
          NODE_ENV: 'test',
        },
      })

      // Verify
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text).toContain('NODE_ENV=test')
    })

    test('should create files and verify with commands', async () => {
      // Setup - create a file
      const testFile = 'test-file.txt'
      const testContent = 'Hello from terminal test'
      await fs.writeFile(path.join(tempDir, testFile), testContent)

      // Execute - cat the file
      const result = await tools.runTerminalCommand({
        command: `cat ${testFile}`,
      })

      // Verify
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text).toContain(testContent)
    })
  })
})
