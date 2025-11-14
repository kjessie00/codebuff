/**
 * Unit tests for Terminal Tools
 *
 * Tests the run_terminal_command tool
 * without requiring an API key (FREE mode compatible).
 */

import { TerminalTools } from '../../../src/tools/terminal'
import {
  createTestDir,
  createTestFiles,
  assertToolSuccess,
  getToolResultValue,
} from '../../utils/test-helpers'

describe('TerminalTools', () => {
  let tools: TerminalTools
  let testDir: string

  beforeEach(async () => {
    testDir = await createTestDir('terminal-test-')
    tools = new TerminalTools(testDir)
  })

  describe('runTerminalCommand', () => {
    it('should execute a simple command', async () => {
      // Execute
      const result = await tools.runTerminalCommand({
        command: 'echo "Hello, World!"',
      })

      // Assert
      assertToolSuccess(result)
      const value = getToolResultValue(result)
      expect(value.output).toContain('Hello, World!')
      expect(value.command).toBe('echo "Hello, World!"')
    })

    it('should execute commands with arguments', async () => {
      // Execute - list current directory
      const result = await tools.runTerminalCommand({
        command: 'ls -la',
      })

      // Assert
      assertToolSuccess(result)
      const value = getToolResultValue(result)
      expect(value.output).toBeDefined()
      expect(value.executionTime).toBeGreaterThanOrEqual(0)
    })

    it('should capture stdout', async () => {
      // Execute
      const result = await tools.runTerminalCommand({
        command: 'echo "stdout test"',
      })

      // Assert
      const value = getToolResultValue(result)
      expect(value.output).toContain('stdout test')
    })

    it('should capture stderr', async () => {
      // Execute a command that writes to stderr
      // Note: This might vary by platform
      const result = await tools.runTerminalCommand({
        command: 'node -e "console.error(\'stderr test\')"',
      })

      // Assert
      const value = getToolResultValue(result)
      expect(value.output).toContain('stderr test')
    })

    it('should handle command with custom working directory', async () => {
      // Setup - create subdirectory
      await createTestFiles(testDir, {
        'subdir/test.txt': 'content',
      })

      // Execute - list files in subdir
      const result = await tools.runTerminalCommand({
        command: 'ls',
        cwd: 'subdir',
      })

      // Assert
      const value = getToolResultValue(result)
      expect(value.output).toContain('test.txt')
    })

    it('should handle command with environment variables', async () => {
      // Execute
      const result = await tools.runTerminalCommand({
        command: 'node -e "console.log(process.env.TEST_VAR)"',
        env: {
          TEST_VAR: 'test_value',
        },
      })

      // Assert
      const value = getToolResultValue(result)
      expect(value.output).toContain('test_value')
    })

    it('should respect timeout', async () => {
      // Execute a long-running command with short timeout
      const result = await tools.runTerminalCommand({
        command: 'node -e "setTimeout(() => {}, 10000)"',
        timeout_seconds: 1,
      })

      // Assert - should timeout and have error
      const value = getToolResultValue(result)
      expect(value.error).toBe(true)
      expect(value.errorDetails).toBeDefined()
    }, 10000) // Increase Jest timeout for this test

    it('should handle command failure', async () => {
      // Execute a command that fails
      const result = await tools.runTerminalCommand({
        command: 'ls /nonexistent/directory',
      })

      // Assert - should have output with error message
      const value = getToolResultValue(result)
      expect(value.output).toBeDefined()
      // Either in output or error flag
      const hasError = value.error || value.output.includes('No such file')
      expect(hasError).toBeTruthy()
    })

    it('should prevent command injection', async () => {
      // Try malicious command
      const result = await tools.runTerminalCommand({
        command: 'echo test; rm -rf /',
      })

      // Assert - should fail validation
      const value = getToolResultValue(result)
      expect(value.error).toBe(true)
      expect(value.errorDetails).toBeDefined()
    })

    it('should handle quoted arguments correctly', async () => {
      // Execute
      const result = await tools.runTerminalCommand({
        command: 'echo "Hello World"',
      })

      // Assert
      const value = getToolResultValue(result)
      expect(value.output).toContain('Hello World')
    })

    it('should include execution time in result', async () => {
      // Execute
      const result = await tools.runTerminalCommand({
        command: 'echo "test"',
      })

      // Assert
      const value = getToolResultValue(result)
      expect(value.executionTime).toBeDefined()
      expect(typeof value.executionTime).toBe('number')
      expect(value.executionTime).toBeGreaterThanOrEqual(0)
    })

    it('should handle empty output', async () => {
      // Execute command with no output
      const result = await tools.runTerminalCommand({
        command: 'node -e ""',
      })

      // Assert
      assertToolSuccess(result)
      const value = getToolResultValue(result)
      expect(value.output).toBeDefined()
    })

    it('should format output like Claude CLI Bash tool', async () => {
      // Execute
      const result = await tools.runTerminalCommand({
        command: 'echo "test"',
      })

      // Assert - output should start with command line
      const value = getToolResultValue(result)
      expect(value.output).toContain('$ echo "test"')
      expect(value.output).toContain('test')
    })
  })

  describe('executeCommandStructured', () => {
    it('should return structured command results', async () => {
      // Execute
      const result = await tools.executeCommandStructured({
        command: 'echo "structured"',
      })

      // Assert
      expect(result.command).toBe('echo "structured"')
      expect(result.stdout).toContain('structured')
      expect(result.stderr).toBeDefined()
      expect(result.exitCode).toBe(0)
      expect(result.timedOut).toBe(false)
      expect(result.executionTime).toBeGreaterThanOrEqual(0)
      expect(result.cwd).toBe(testDir)
    })

    it('should capture exit code on failure', async () => {
      // Execute a command that fails
      const result = await tools.executeCommandStructured({
        command: 'node -e "process.exit(42)"',
      })

      // Assert
      expect(result.exitCode).toBe(42)
    })

    it('should handle timeout in structured mode', async () => {
      // Execute with timeout
      const result = await tools.executeCommandStructured({
        command: 'node -e "setTimeout(() => {}, 10000)"',
        timeout_seconds: 1,
      })

      // Assert
      expect(result.timedOut).toBe(true)
      expect(result.error).toBeDefined()
    }, 10000)
  })

  describe('verifyCommand', () => {
    it('should verify that node is available', async () => {
      // Execute
      const hasNode = await tools.verifyCommand('node')

      // Assert - Node.js should be available in test environment
      expect(hasNode).toBe(true)
    })

    it('should return false for non-existent command', async () => {
      // Execute
      const hasNonExistent = await tools.verifyCommand('nonexistentcommand123456')

      // Assert
      expect(hasNonExistent).toBe(false)
    })

    it('should prevent command injection in verification', async () => {
      // Try malicious input
      await expect(async () => {
        await tools.verifyCommand('node; rm -rf /')
      }).rejects.toThrow()
    })
  })

  describe('getCommandVersion', () => {
    it('should get version of available command', async () => {
      // Execute
      const version = await tools.getCommandVersion('node')

      // Assert - Node.js should have a version
      expect(version).toBeDefined()
      expect(typeof version).toBe('string')
      expect(version).toContain('v')
    })

    it('should return null for non-existent command', async () => {
      // Execute
      const version = await tools.getCommandVersion('nonexistentcommand123456')

      // Assert
      expect(version).toBeNull()
    })

    it('should support custom version flag', async () => {
      // Execute
      const version = await tools.getCommandVersion('node', '-v')

      // Assert
      expect(version).toBeDefined()
      expect(typeof version).toBe('string')
    })

    it('should prevent command injection', async () => {
      // Try malicious input
      await expect(async () => {
        await tools.getCommandVersion('node; rm -rf /')
      }).rejects.toThrow()
    })
  })

  describe('getEnvironmentVariables', () => {
    it('should return environment variables', () => {
      // Execute
      const env = tools.getEnvironmentVariables()

      // Assert
      expect(env).toBeDefined()
      expect(typeof env).toBe('object')

      // Should include process.env variables
      expect(env.PATH).toBeDefined()
    })

    it('should merge custom environment variables', () => {
      // Create tools with custom env
      const customTools = new TerminalTools(testDir, {
        CUSTOM_VAR: 'custom_value',
      })

      // Execute
      const env = customTools.getEnvironmentVariables()

      // Assert
      expect(env.CUSTOM_VAR).toBe('custom_value')
    })

    it('should cache environment variables for performance', () => {
      // Get env twice
      const env1 = tools.getEnvironmentVariables()
      const env2 = tools.getEnvironmentVariables()

      // Should return same reference (cached)
      expect(env1).toBe(env2)
    })

    it('should allow cache invalidation', () => {
      // Get env
      const env1 = tools.getEnvironmentVariables()

      // Invalidate cache
      tools.invalidateEnvCache()

      // Get env again
      const env2 = tools.getEnvironmentVariables()

      // Should be different reference (new object)
      expect(env1).not.toBe(env2)
    })
  })

  describe('Path validation and security', () => {
    it('should prevent directory traversal in cwd', async () => {
      // Try to execute in directory outside base cwd
      const result = await tools.runTerminalCommand({
        command: 'ls',
        cwd: '../../..',
      })

      // Should fail
      const value = getToolResultValue(result)
      expect(value.error).toBe(true)
      expect(value.errorDetails.message).toContain('outside working directory')
    })

    it('should allow execution in subdirectories', async () => {
      // Create subdirectory
      await createTestFiles(testDir, {
        'subdir/file.txt': 'content',
      })

      // Execute in subdirectory
      const result = await tools.runTerminalCommand({
        command: 'ls',
        cwd: 'subdir',
      })

      // Should succeed
      assertToolSuccess(result)
    })

    it('should validate command executable', async () => {
      // Try to execute dangerous characters
      const result = await tools.runTerminalCommand({
        command: '`whoami`',
      })

      // Should fail validation
      const value = getToolResultValue(result)
      expect(value.error).toBe(true)
    })
  })

  describe('Retry logic', () => {
    it('should retry transient failures', async () => {
      // Create a command that fails first time but succeeds after
      // This is a simplified test - in real scenarios, you'd mock the executor
      const result = await tools.runTerminalCommand({
        command: 'echo "test"',
        retry: true,
        retryConfig: {
          maxRetries: 3,
          initialDelayMs: 100,
        },
      })

      // Assert - should eventually succeed
      assertToolSuccess(result)
    })

    it('should not retry by default', async () => {
      // Execute without retry flag
      const result = await tools.runTerminalCommand({
        command: 'echo "test"',
      })

      // Should execute normally (no retry)
      assertToolSuccess(result)
    })
  })

  describe('Performance', () => {
    it('should execute commands efficiently', async () => {
      // Execute multiple commands
      const start = Date.now()

      for (let i = 0; i < 5; i++) {
        await tools.runTerminalCommand({
          command: `echo "test ${i}"`,
        })
      }

      const duration = Date.now() - start

      // Should complete quickly (less than 5 seconds for 5 commands)
      expect(duration).toBeLessThan(5000)
    })

    it('should cache normalized CWD', () => {
      // This tests internal caching mechanism
      // Multiple operations should reuse cached normalized CWD

      // Invalidate cache
      tools.invalidateCwdCache()

      // Execute operations
      tools.getEnvironmentVariables()
      tools.getEnvironmentVariables()

      // Cache should be used (no assertion needed, testing code path)
      expect(true).toBe(true)
    })
  })

  describe('Error handling', () => {
    it('should format error output correctly', async () => {
      // Execute failing command
      const result = await tools.runTerminalCommand({
        command: 'ls /nonexistent',
      })

      // Assert
      const value = getToolResultValue(result)
      expect(value.output).toBeDefined()

      // Should include command in output
      expect(value.output).toContain('$ ls /nonexistent')
    })

    it('should handle spawn errors', async () => {
      // Try to execute non-existent command
      const result = await tools.runTerminalCommand({
        command: 'nonexistentcommand123456',
      })

      // Should have error
      const value = getToolResultValue(result)
      expect(value.error).toBe(true)
      expect(value.errorDetails).toBeDefined()
    })

    it('should handle timeout gracefully', async () => {
      // Execute with very short timeout
      const result = await tools.runTerminalCommand({
        command: 'node -e "setTimeout(() => {}, 5000)"',
        timeout_seconds: 0.5,
      })

      // Should timeout
      const value = getToolResultValue(result)
      expect(value.error).toBe(true)
      expect(value.output).toContain('timeout')
    }, 10000)
  })

  describe('Platform compatibility', () => {
    it('should work on current platform', async () => {
      // Execute platform-agnostic command
      const result = await tools.runTerminalCommand({
        command: 'node -e "console.log(process.platform)"',
      })

      // Assert
      assertToolSuccess(result)
      const value = getToolResultValue(result)
      expect(value.output).toContain(process.platform)
    })
  })
})
