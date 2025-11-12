/**
 * Terminal Tools for Claude CLI Adapter
 *
 * Maps Codebuff's terminal command execution to Claude Code CLI's Bash tool:
 * - run_terminal_command → Claude CLI Bash tool (command: string, timeout?: number)
 *
 * Provides shell command execution with configurable timeout, working directory,
 * and environment variables. Handles both stdout and stderr streams.
 *
 * @module terminal
 */

import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import type { ToolResultOutput } from '../../../.agents/types/util-types'

const execAsync = promisify(exec)

/**
 * Parameters for terminal command execution
 */
export interface RunTerminalCommandInput {
  /** The shell command to execute */
  command: string

  /** Execution mode (user-initiated or agent-initiated) */
  mode?: 'user' | 'agent'

  /** Process type: SYNC for synchronous, ASYNC for background */
  process_type?: 'SYNC' | 'ASYNC'

  /** Command timeout in seconds (default: 30) */
  timeout_seconds?: number

  /** Optional working directory override (relative to base cwd) */
  cwd?: string

  /** Optional environment variables to merge with process.env */
  env?: Record<string, string>

  /** Describe what the command does (for logging) */
  description?: string
}

/**
 * Result from command execution
 */
export interface CommandExecutionResult {
  /** The command that was executed */
  command: string

  /** Standard output from the command */
  stdout: string

  /** Standard error from the command */
  stderr: string

  /** Exit code (0 = success) */
  exitCode: number

  /** Whether the command timed out */
  timedOut: boolean

  /** Execution time in milliseconds */
  executionTime: number

  /** Working directory where command was run */
  cwd: string

  /** Error message if command failed */
  error?: string
}

/**
 * Terminal Tools implementation
 *
 * Provides command execution capabilities that map to Claude Code CLI's Bash tool.
 * Executes shell commands with proper error handling, timeouts, and output capture.
 */
export class TerminalTools {
  /**
   * Create a new TerminalTools instance
   *
   * @param cwd - Current working directory for command execution
   * @param env - Optional environment variables to merge with process.env
   */
  constructor(
    private readonly cwd: string,
    private readonly env?: Record<string, string>
  ) {}

  /**
   * Execute a shell command
   *
   * Maps to Claude CLI Bash tool (command: string, timeout?: number)
   * Executes the command in a shell and captures stdout/stderr output.
   * Returns formatted output in the style of: "$ command\n{output}"
   *
   * @param input - Object containing command and execution options
   * @returns Promise resolving to tool result with command output
   *
   * @example
   * ```typescript
   * const result = await tools.runTerminalCommand({
   *   command: 'git status',
   *   timeout_seconds: 10
   * })
   * // result[0].text = "$ git status\nOn branch main\nYour branch is up to date..."
   * ```
   *
   * @example
   * ```typescript
   * // With custom working directory
   * const result = await tools.runTerminalCommand({
   *   command: 'npm test',
   *   cwd: 'packages/core',
   *   timeout_seconds: 60
   * })
   * ```
   *
   * @example
   * ```typescript
   * // With environment variables
   * const result = await tools.runTerminalCommand({
   *   command: 'node script.js',
   *   env: { NODE_ENV: 'production', DEBUG: '*' }
   * })
   * ```
   */
  async runTerminalCommand(
    input: RunTerminalCommandInput
  ): Promise<ToolResultOutput[]> {
    const startTime = Date.now()

    try {
      // Resolve working directory
      const execCwd = input.cwd
        ? path.resolve(this.cwd, input.cwd)
        : this.cwd

      // Validate the working directory is within base cwd
      this.validatePath(execCwd)

      // Determine timeout in milliseconds
      const timeoutMs = input.timeout_seconds
        ? input.timeout_seconds * 1000
        : 30000 // Default 30 seconds

      // Execute the command
      const result = await this.executeCommand(
        input.command,
        execCwd,
        timeoutMs,
        input.env
      )

      // Calculate execution time
      const executionTime = Date.now() - startTime

      // Format the output like Claude CLI Bash tool
      const output = this.formatCommandOutput(
        input.command,
        result.stdout,
        result.stderr,
        result.exitCode,
        executionTime
      )

      return [
        {
          type: 'json',
          value: {
            output,
            command: input.command,
            executionTime,
          },
        },
      ]
    } catch (error) {
      const executionTime = Date.now() - startTime

      // Handle execution errors
      return [
        {
          type: 'json',
          value: {
            output: this.formatErrorOutput(input.command, error, executionTime),
            command: input.command,
            executionTime,
            error: true,
          },
        },
      ]
    }
  }

  /**
   * Execute a command and return structured results
   *
   * This is a lower-level method that returns structured data instead of
   * formatted text. Useful for programmatic access to command results.
   *
   * @param input - Command execution parameters
   * @returns Promise resolving to structured command result
   *
   * @example
   * ```typescript
   * const result = await tools.executeCommandStructured({
   *   command: 'git rev-parse HEAD',
   *   timeout_seconds: 5
   * })
   * console.log(result.stdout.trim()) // "abc123def456..."
   * console.log(result.exitCode) // 0
   * ```
   */
  async executeCommandStructured(
    input: RunTerminalCommandInput
  ): Promise<CommandExecutionResult> {
    const startTime = Date.now()

    try {
      // Resolve working directory
      const execCwd = input.cwd
        ? path.resolve(this.cwd, input.cwd)
        : this.cwd

      // Validate the working directory is within base cwd
      this.validatePath(execCwd)

      // Determine timeout in milliseconds
      const timeoutMs = input.timeout_seconds
        ? input.timeout_seconds * 1000
        : 30000

      // Execute the command
      const result = await this.executeCommand(
        input.command,
        execCwd,
        timeoutMs,
        input.env
      )

      return {
        command: input.command,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        timedOut: false,
        executionTime: Date.now() - startTime,
        cwd: execCwd,
      }
    } catch (error: any) {
      // Check if it's a timeout error
      const isTimeout =
        error.killed === true || error.message?.includes('timeout')

      return {
        command: input.command,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.code || -1,
        timedOut: isTimeout,
        executionTime: Date.now() - startTime,
        cwd: input.cwd ? path.resolve(this.cwd, input.cwd) : this.cwd,
        error: this.formatError(error),
      }
    }
  }

  /**
   * Get environment variables available in the terminal
   *
   * @returns Object containing all environment variables
   */
  getEnvironmentVariables(): Record<string, string> {
    return {
      ...process.env,
      ...this.env,
    } as Record<string, string>
  }

  /**
   * Verify a command is available on the system
   *
   * @param command - Command name to check (e.g., 'git', 'npm')
   * @returns True if command is available, false otherwise
   *
   * @example
   * ```typescript
   * const hasGit = await tools.verifyCommand('git')
   * if (!hasGit) {
   *   console.log('Git is not installed')
   * }
   * ```
   */
  async verifyCommand(command: string): Promise<boolean> {
    try {
      const checkCommand =
        process.platform === 'win32'
          ? `where ${command}`
          : `command -v ${command}`

      await execAsync(checkCommand, { timeout: 5000 })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get the version of a command if available
   *
   * @param command - Command name
   * @param versionFlag - Flag to use for version (default: '--version')
   * @returns Version string or null if not available
   *
   * @example
   * ```typescript
   * const gitVersion = await tools.getCommandVersion('git')
   * console.log(gitVersion) // "git version 2.34.1"
   * ```
   */
  async getCommandVersion(
    command: string,
    versionFlag: string = '--version'
  ): Promise<string | null> {
    try {
      const { stdout } = await execAsync(`${command} ${versionFlag}`, {
        timeout: 5000,
      })
      return stdout.trim().split('\n')[0]
    } catch {
      return null
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Execute a command using Node.js child_process
   *
   * @param command - Command string to execute
   * @param cwd - Working directory
   * @param timeout - Timeout in milliseconds
   * @param customEnv - Optional environment variables to merge
   * @returns Command output
   */
  private async executeCommand(
    command: string,
    cwd: string,
    timeout: number,
    customEnv?: Record<string, string>
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Merge environment variables
    const env = {
      ...process.env,
      ...this.env,
      ...customEnv,
    }

    try {
      // Use exec for simple command execution
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        env,
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
        encoding: 'utf-8',
      })

      return {
        stdout,
        stderr,
        exitCode: 0,
      }
    } catch (error: any) {
      // exec throws on non-zero exit codes, but we still want the output
      if (error.code !== undefined && error.stdout !== undefined) {
        return {
          stdout: error.stdout || '',
          stderr: error.stderr || '',
          exitCode: error.code,
        }
      }
      throw error
    }
  }

  /**
   * Format command output in Claude CLI Bash tool style
   *
   * @param command - The command that was executed
   * @param stdout - Standard output
   * @param stderr - Standard error
   * @param exitCode - Command exit code
   * @param executionTime - Time taken in milliseconds
   * @returns Formatted output string
   */
  private formatCommandOutput(
    command: string,
    stdout: string,
    stderr: string,
    exitCode: number,
    executionTime: number
  ): string {
    const parts: string[] = []

    // Command line (like shell prompt)
    parts.push(`$ ${command}`)

    // Standard output
    if (stdout) {
      parts.push(stdout.trimEnd())
    }

    // Standard error (if present)
    if (stderr) {
      parts.push(`\n[STDERR]`)
      parts.push(stderr.trimEnd())
    }

    // Exit code if non-zero
    if (exitCode !== 0) {
      parts.push(`\n[Exit code: ${exitCode}]`)
    }

    // Execution time for long-running commands
    if (executionTime > 1000) {
      parts.push(`\n[Completed in ${(executionTime / 1000).toFixed(2)}s]`)
    }

    return parts.join('\n')
  }

  /**
   * Format error output when command execution fails
   *
   * @param command - The command that was attempted
   * @param error - The error that occurred
   * @param executionTime - Time taken before error
   * @returns Formatted error string
   */
  private formatErrorOutput(
    command: string,
    error: unknown,
    executionTime: number
  ): string {
    const parts: string[] = []

    // Command line
    parts.push(`$ ${command}`)

    // Error message
    const errorMsg = this.formatError(error)
    parts.push(`\n[ERROR] ${errorMsg}`)

    // Include stdout/stderr if available (from exec errors)
    if (this.isExecError(error)) {
      if (error.stdout) {
        parts.push(`\n[STDOUT]`)
        parts.push(error.stdout.trimEnd())
      }
      if (error.stderr) {
        parts.push(`\n[STDERR]`)
        parts.push(error.stderr.trimEnd())
      }
      if (error.code !== undefined) {
        parts.push(`\n[Exit code: ${error.code}]`)
      }
    }

    // Execution time
    if (executionTime > 100) {
      parts.push(`\n[Failed after ${(executionTime / 1000).toFixed(2)}s]`)
    }

    return parts.join('\n')
  }

  /**
   * Validate that a path is within the base working directory
   *
   * This prevents directory traversal attacks where a malicious path
   * could execute commands outside the project directory.
   *
   * @param fullPath - Absolute path to validate
   * @throws Error if path is outside base cwd
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
      // Handle timeout errors specially
      if (this.isExecError(error) && error.killed) {
        return `Command timed out and was killed`
      }
      return error.message
    }
    if (typeof error === 'string') {
      return error
    }
    return 'Unknown error occurred'
  }

  /**
   * Type guard to check if an error is from child_process.exec
   *
   * @param error - Error to check
   * @returns True if error is an exec error with stdout/stderr
   */
  private isExecError(
    error: unknown
  ): error is Error & {
    code?: number
    stdout?: string
    stderr?: string
    killed?: boolean
  } {
    return (
      error instanceof Error &&
      ('stdout' in error || 'stderr' in error || 'killed' in error)
    )
  }
}

/**
 * Create a new TerminalTools instance
 *
 * @param cwd - Current working directory
 * @param env - Optional environment variables
 * @returns TerminalTools instance
 *
 * @example
 * ```typescript
 * const tools = createTerminalTools('/path/to/project', {
 *   NODE_ENV: 'development'
 * })
 * const result = await tools.runTerminalCommand({ command: 'npm test' })
 * ```
 */
export function createTerminalTools(
  cwd: string,
  env?: Record<string, string>
): TerminalTools {
  return new TerminalTools(cwd, env)
}
