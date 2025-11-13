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

import { spawn } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import type { ToolResultOutput } from '../../../.agents/types/util-types'
import type { RetryConfig } from '../types'
import { ToolExecutionError, ValidationError, TimeoutError } from '../errors'
import {
  withRetry,
  isTransientError,
  DEFAULT_RETRY_CONFIG,
} from '../utils/async-utils'

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

  /** Whether to retry on transient failures (default: false) */
  retry?: boolean

  /** Retry configuration (only used if retry is true) */
  retryConfig?: Partial<RetryConfig>
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
 * Parsed command structure
 */
interface ParsedCommand {
  /** The executable/command name */
  command: string
  /** Array of command arguments */
  args: string[]
}

/**
 * Sanitize input to prevent command injection
 *
 * Validates that input doesn't contain dangerous shell metacharacters
 * that could be used for command injection attacks.
 *
 * @param input - String to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @throws Error if input contains dangerous characters
 *
 * @security This prevents shell injection by rejecting common shell metacharacters
 * including: semicolons, pipes, redirects, backticks, command substitution, etc.
 */
function sanitizeInput(input: string, fieldName: string = 'input'): void {
  // Dangerous characters that could enable command injection
  // These allow chaining commands, substitution, or other shell features
  const dangerousChars = /[;&|`$()<>]/

  if (dangerousChars.test(input)) {
    throw new Error(
      `Invalid ${fieldName}: contains dangerous characters. ` +
      `Detected potentially malicious input that could lead to command injection.`
    )
  }
}

/**
 * Parse a command string into command and arguments
 *
 * Uses basic shell-like parsing to split command into executable and arguments.
 * Handles quoted strings (single and double quotes) to allow spaces in arguments.
 *
 * @param commandStr - Command string to parse (e.g., "git commit -m 'message'")
 * @returns Parsed command with executable and arguments array
 *
 * @security This parsing ensures commands are passed to spawn() with separate
 * arguments instead of being interpreted by a shell, preventing injection attacks.
 *
 * @example
 * parseCommand('git status') // { command: 'git', args: ['status'] }
 * parseCommand('git commit -m "hello"') // { command: 'git', args: ['commit', '-m', 'hello'] }
 */
function parseCommand(commandStr: string): ParsedCommand {
  const parts: string[] = []
  let current = ''
  let inQuote: string | null = null

  for (let i = 0; i < commandStr.length; i++) {
    const char = commandStr[i]

    // Handle quotes
    if ((char === '"' || char === "'") && commandStr[i - 1] !== '\\') {
      if (inQuote === char) {
        // Closing quote
        inQuote = null
      } else if (inQuote === null) {
        // Opening quote
        inQuote = char
      } else {
        // Quote of different type inside quoted string
        current += char
      }
      continue
    }

    // Handle whitespace (token separator when not in quotes)
    if (/\s/.test(char) && inQuote === null) {
      if (current) {
        parts.push(current)
        current = ''
      }
      continue
    }

    // Regular character
    current += char
  }

  // Add final token
  if (current) {
    parts.push(current)
  }

  if (parts.length === 0) {
    throw new Error('Empty command string')
  }

  return {
    command: parts[0],
    args: parts.slice(1)
  }
}

/**
 * Terminal Tools implementation
 *
 * Provides command execution capabilities that map to Claude Code CLI's Bash tool.
 * Executes shell commands with proper error handling, timeouts, and output capture.
 * Supports retry logic with exponential backoff for transient failures.
 */
export class TerminalTools {
  /** Cache for merged environment variables to avoid repeated object merging */
  private mergedEnvCache: Record<string, string> | null = null

  /** Cache for normalized CWD path to avoid repeated path operations */
  private normalizedCwdCache: string | null = null

  /** Default retry configuration */
  private readonly defaultRetryConfig: RetryConfig

  /**
   * Create a new TerminalTools instance
   *
   * @param cwd - Current working directory for command execution
   * @param env - Optional environment variables to merge with process.env
   * @param retryConfig - Optional default retry configuration
   */
  constructor(
    private readonly cwd: string,
    private readonly env?: Record<string, string>,
    retryConfig?: Partial<RetryConfig>
  ) {
    this.defaultRetryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...retryConfig,
    }
  }

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

      // Execute the command with optional retry logic
      const result = input.retry
        ? await this.executeCommandWithRetry(
            input.command,
            execCwd,
            timeoutMs,
            input.env,
            input.retryConfig
          )
        : await this.executeCommand(
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

      // Wrap error in ToolExecutionError for better context
      const wrappedError = new ToolExecutionError(
        `Terminal command failed: ${this.formatError(error)}`,
        {
          toolName: 'run_terminal_command',
          toolInput: input,
          originalError: error instanceof Error ? error : new Error(String(error)),
        }
      )

      // Handle execution errors
      return [
        {
          type: 'json',
          value: {
            output: this.formatErrorOutput(input.command, wrappedError, executionTime),
            command: input.command,
            executionTime,
            error: true,
            errorDetails: wrappedError.toJSON(),
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
   * Performance: Returns cached merged environment to avoid repeated object spreading.
   *
   * @returns Object containing all environment variables
   */
  getEnvironmentVariables(): Record<string, string> {
    // Use cached merged environment to avoid repeated object spreading
    if (!this.mergedEnvCache) {
      this.mergedEnvCache = {
        ...process.env,
        ...this.env,
      } as Record<string, string>
    }
    return this.mergedEnvCache
  }

  /**
   * Invalidate environment variable cache
   * Call this if process.env is modified after initialization
   */
  invalidateEnvCache(): void {
    this.mergedEnvCache = null
  }

  /**
   * Invalidate CWD cache
   * Call this if the base CWD needs to be changed
   */
  invalidateCwdCache(): void {
    this.normalizedCwdCache = null
  }

  /**
   * Verify a command is available on the system
   *
   * Uses secure command execution to check if a command exists without
   * exposing to command injection vulnerabilities.
   *
   * @param command - Command name to check (e.g., 'git', 'npm')
   * @returns True if command is available, false otherwise
   *
   * @security Validates command name before execution to prevent injection
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
      // Validate command name to prevent injection
      sanitizeInput(command, 'command')

      // Use spawn instead of exec for security
      if (process.platform === 'win32') {
        const result = await this.executeCommand('where', this.cwd, 5000)
        // Add command as separate argument
        const child = spawn('where', [command], {
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe'],
        })

        return new Promise((resolve) => {
          child.on('close', (code) => {
            resolve(code === 0)
          })
          child.on('error', () => {
            resolve(false)
          })

          // Timeout after 5 seconds
          setTimeout(() => {
            child.kill()
            resolve(false)
          }, 5000)
        })
      } else {
        const child = spawn('command', ['-v', command], {
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe'],
        })

        return new Promise((resolve) => {
          child.on('close', (code) => {
            resolve(code === 0)
          })
          child.on('error', () => {
            resolve(false)
          })

          // Timeout after 5 seconds
          setTimeout(() => {
            child.kill()
            resolve(false)
          }, 5000)
        })
      }
    } catch {
      return false
    }
  }

  /**
   * Get the version of a command if available
   *
   * Executes the command with version flag using secure spawn-based execution.
   *
   * @param command - Command name
   * @param versionFlag - Flag to use for version (default: '--version')
   * @returns Version string or null if not available
   *
   * @security Validates inputs and uses spawn() to prevent injection
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
      // Validate inputs to prevent injection
      sanitizeInput(command, 'command')
      sanitizeInput(versionFlag, 'versionFlag')

      const child = spawn(command, [versionFlag], {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      return new Promise((resolve) => {
        let stdout = ''

        child.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString('utf-8')
        })

        child.on('close', (code) => {
          if (code === 0 && stdout) {
            resolve(stdout.trim().split('\n')[0])
          } else {
            resolve(null)
          }
        })

        child.on('error', () => {
          resolve(null)
        })

        // Timeout after 5 seconds
        setTimeout(() => {
          child.kill()
          resolve(null)
        }, 5000)
      })
    } catch {
      return null
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get cached normalized CWD
   *
   * Performance: Caches normalized CWD to avoid repeated path.normalize() calls.
   *
   * @returns Normalized CWD path
   */
  private getNormalizedCwd(): string {
    if (!this.normalizedCwdCache) {
      this.normalizedCwdCache = path.normalize(this.cwd)
    }
    return this.normalizedCwdCache
  }

  /**
   * Execute a command with retry logic and exponential backoff
   *
   * Wraps executeCommand with retry logic for transient failures.
   * Automatically retries on timeout and network errors.
   *
   * @param command - Command string to execute
   * @param cwd - Working directory
   * @param timeout - Timeout in milliseconds per attempt
   * @param customEnv - Optional environment variables to merge
   * @param retryConfig - Optional retry configuration override
   * @returns Command output
   *
   * @throws {ToolExecutionError} If all retry attempts are exhausted
   *
   * @example
   * ```typescript
   * const result = await this.executeCommandWithRetry(
   *   'npm install',
   *   '/path/to/project',
   *   30000,
   *   undefined,
   *   { maxRetries: 3, exponentialBackoff: true }
   * )
   * ```
   */
  private async executeCommandWithRetry(
    command: string,
    cwd: string,
    timeout: number,
    customEnv?: Record<string, string>,
    retryConfig?: Partial<RetryConfig>
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Merge retry config with defaults
    const config = {
      ...this.defaultRetryConfig,
      ...retryConfig,
    }

    // Track retry attempts for logging
    let attemptNumber = 0

    return withRetry(
      () => this.executeCommand(command, cwd, timeout, customEnv),
      {
        maxRetries: config.maxRetries,
        initialDelayMs: config.initialDelayMs,
        maxDelayMs: config.maxDelayMs,
        backoffMultiplier: config.backoffMultiplier,
        exponentialBackoff: config.exponentialBackoff,
        shouldRetry: (error: unknown) => {
          // Only retry on transient errors (timeout, network issues)
          return isTransientError(error)
        },
        onRetry: (error: unknown, attempt: number, delayMs: number) => {
          attemptNumber = attempt
          // Log retry attempt (could integrate with adapter's logger)
          console.warn(
            `[TerminalTools] Retrying command "${command}" ` +
              `(attempt ${attempt}/${config.maxRetries}) ` +
              `after ${delayMs}ms delay. ` +
              `Reason: ${this.formatError(error)}`
          )
        },
        operation: 'terminal_command',
      }
    )
  }

  /**
   * Execute a command using Node.js child_process.spawn
   *
   * Uses spawn() instead of exec() to avoid shell interpretation and prevent
   * command injection vulnerabilities. The command is parsed into executable
   * and arguments, which are passed separately to spawn().
   *
   * Performance: Uses cached merged environment variables when no custom env is provided.
   *
   * @param command - Command string to execute
   * @param cwd - Working directory
   * @param timeout - Timeout in milliseconds
   * @param customEnv - Optional environment variables to merge
   * @returns Command output
   *
   * @security This method:
   * 1. Parses commands to separate executable from arguments
   * 2. Uses spawn() with shell: false to prevent shell interpretation
   * 3. Passes arguments as array to avoid injection via concatenation
   * 4. Implements timeout to prevent hanging processes
   *
   * @throws Error if command contains dangerous characters or fails to execute
   */
  private async executeCommand(
    command: string,
    cwd: string,
    timeout: number,
    customEnv?: Record<string, string>
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Parse command into executable and arguments
    // This separates the command from its args, preventing shell injection
    const parsed = parseCommand(command)

    // Validate the command executable doesn't contain dangerous characters
    // Note: We're more lenient with args since they won't be shell-interpreted
    sanitizeInput(parsed.command, 'command')

    // Merge environment variables (use cache when no custom env)
    const env = customEnv
      ? {
          ...this.getEnvironmentVariables(),
          ...customEnv,
        }
      : this.getEnvironmentVariables()

    return new Promise((resolve, reject) => {
      // Use spawn instead of exec to avoid shell interpretation
      // shell: false is critical - it prevents command injection
      const child = spawn(parsed.command, parsed.args, {
        cwd,
        env,
        shell: false, // SECURITY: Never set to true - prevents shell injection
        stdio: ['ignore', 'pipe', 'pipe'], // stdin ignored, stdout/stderr piped
      })

      let stdout = ''
      let stderr = ''
      let timedOut = false
      let timeoutHandle: NodeJS.Timeout | null = null

      // Set up timeout
      if (timeout > 0) {
        timeoutHandle = setTimeout(() => {
          timedOut = true
          child.kill('SIGTERM')

          // Force kill after 5 seconds if SIGTERM doesn't work
          setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL')
            }
          }, 5000)
        }, timeout)
      }

      // Collect stdout
      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString('utf-8')
      })

      // Collect stderr
      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8')
      })

      // Handle process exit
      child.on('close', (code: number | null, signal: string | null) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle)
        }

        if (timedOut) {
          reject(
            Object.assign(
              new Error(`Command timed out after ${timeout}ms`),
              {
                code: -1,
                stdout,
                stderr,
                killed: true,
              }
            )
          )
          return
        }

        resolve({
          stdout,
          stderr,
          exitCode: code ?? -1,
        })
      })

      // Handle spawn errors (e.g., command not found)
      child.on('error', (error: Error) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle)
        }

        reject(
          Object.assign(error, {
            stdout,
            stderr,
          })
        )
      })
    })
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
   * Performance: Uses cached normalized CWD to avoid repeated path.normalize() calls.
   *
   * @param fullPath - Absolute path to validate
   * @throws Error if path is outside base cwd
   */
  private validatePath(fullPath: string): void {
    const normalizedPath = path.normalize(fullPath)

    // Use cached normalized CWD to avoid repeated normalization
    const normalizedCwd = this.getNormalizedCwd()

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
 * @param retryConfig - Optional default retry configuration
 * @returns TerminalTools instance
 *
 * @example
 * ```typescript
 * const tools = createTerminalTools('/path/to/project', {
 *   NODE_ENV: 'development'
 * }, {
 *   maxRetries: 3,
 *   exponentialBackoff: true
 * })
 * const result = await tools.runTerminalCommand({
 *   command: 'npm test',
 *   retry: true
 * })
 * ```
 */
export function createTerminalTools(
  cwd: string,
  env?: Record<string, string>,
  retryConfig?: Partial<RetryConfig>
): TerminalTools {
  return new TerminalTools(cwd, env, retryConfig)
}
