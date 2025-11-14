/**
 * FREE Mode Agent Templates
 *
 * Pre-built agent definitions for common tasks in FREE mode.
 * All templates use only FREE mode tools (no spawn_agents).
 *
 * Each template includes:
 * - Complete agent definition
 * - Usage examples
 * - Best practices
 *
 * @module agent-templates
 */

import type { AgentDefinition } from '../../../.agents/types/agent-definition'
import type { AgentTemplate } from './free-mode-types'

// ============================================================================
// File Explorer Agent
// ============================================================================

/**
 * File Explorer Agent - Finds and reads files
 *
 * **Use when you need to:**
 * - List files in directories
 * - Find files matching patterns
 * - Read file contents
 * - Explore project structure
 *
 * **Tools:** find_files, read_files, code_search
 */
export const fileExplorerAgent: AgentDefinition = {
  id: 'free-file-explorer',
  version: '1.0.0',
  displayName: 'File Explorer',
  model: 'anthropic/claude-sonnet-4.5',

  systemPrompt: `You are a file exploration assistant. Help users find and read files in their project.

Your capabilities:
- Find files using glob patterns (find_files)
- Read file contents (read_files)
- Search for patterns in files (code_search)

Be thorough but concise. When exploring directories, provide clear summaries of what you find.`,

  instructionsPrompt: `When the user asks to explore or find files:
1. Use find_files to locate files matching the pattern
2. Use read_files to examine file contents when needed
3. Use code_search to find specific patterns or text
4. Provide a clear summary of your findings`,

  toolNames: ['find_files', 'read_files', 'code_search'],
  outputMode: 'last_message',
}

/**
 * File Explorer Agent Template with examples
 */
export const fileExplorerTemplate: AgentTemplate = {
  definition: fileExplorerAgent,
  category: 'file',
  examples: [
    {
      description: 'Find all TypeScript files',
      prompt: 'Find all .ts files in the src directory',
      expectedOutput: 'List of TypeScript files with their paths',
    },
    {
      description: 'Explore project structure',
      prompt: 'Show me the main files and directories in this project',
    },
    {
      description: 'Find configuration files',
      prompt: 'Find all configuration files (package.json, tsconfig.json, etc.)',
    },
  ],
  tips: [
    'Use glob patterns like "**/*.ts" to find files recursively',
    'Combine find_files and read_files for thorough exploration',
    'Use code_search to find specific content in files',
  ],
}

// ============================================================================
// Code Search Agent
// ============================================================================

/**
 * Code Searcher Agent - Searches code with patterns
 *
 * **Use when you need to:**
 * - Search for specific code patterns
 * - Find function definitions
 * - Locate imports or usages
 * - Search for keywords or comments
 *
 * **Tools:** code_search, read_files
 */
export const codeSearchAgent: AgentDefinition = {
  id: 'free-code-searcher',
  version: '1.0.0',
  displayName: 'Code Searcher',
  model: 'anthropic/claude-sonnet-4.5',

  systemPrompt: `You are a code search expert. Help users find specific code patterns, functions, and content in their codebase.

Your capabilities:
- Search code using regex patterns (code_search)
- Read files to understand context (read_files)
- Provide accurate search results with line numbers

Be precise with search patterns and provide clear, actionable results.`,

  instructionsPrompt: `When searching for code:
1. Use code_search with appropriate regex patterns
2. Read files to provide context when needed
3. Report line numbers and file paths
4. Highlight exact matches`,

  toolNames: ['code_search', 'read_files'],
  outputMode: 'last_message',
}

export const codeSearchTemplate: AgentTemplate = {
  definition: codeSearchAgent,
  category: 'code',
  examples: [
    {
      description: 'Find function definitions',
      prompt: 'Search for all function definitions containing "execute"',
    },
    {
      description: 'Find TODO comments',
      prompt: 'Find all TODO comments in the codebase',
    },
    {
      description: 'Search for imports',
      prompt: 'Find all files that import from "react"',
    },
  ],
  tips: [
    'Use regex patterns for flexible searches',
    'Include file type filters for faster searches',
    'Read surrounding context for better understanding',
  ],
}

// ============================================================================
// Terminal Executor Agent
// ============================================================================

/**
 * Terminal Executor Agent - Runs shell commands
 *
 * **Use when you need to:**
 * - Execute shell commands
 * - Run build scripts
 * - Install dependencies
 * - Check system information
 *
 * **Tools:** run_terminal_command
 */
export const terminalAgent: AgentDefinition = {
  id: 'free-terminal-executor',
  version: '1.0.0',
  displayName: 'Terminal Executor',
  model: 'anthropic/claude-sonnet-4.5',

  systemPrompt: `You are a terminal command expert. Help users execute shell commands safely and effectively.

Your capabilities:
- Execute shell commands (run_terminal_command)
- Interpret command output
- Suggest appropriate commands for tasks

Always explain what commands do before executing them. Be cautious with destructive operations.`,

  instructionsPrompt: `When executing commands:
1. Explain what the command will do
2. Execute using run_terminal_command
3. Interpret the output
4. Suggest next steps if needed`,

  toolNames: ['run_terminal_command'],
  outputMode: 'last_message',
}

export const terminalTemplate: AgentTemplate = {
  definition: terminalAgent,
  category: 'terminal',
  examples: [
    {
      description: 'Check Node.js version',
      prompt: 'What version of Node.js is installed?',
    },
    {
      description: 'List directory contents',
      prompt: 'Show me what files are in the current directory',
    },
    {
      description: 'Run tests',
      prompt: 'Run the test suite',
    },
  ],
  tips: [
    'Always explain commands before executing',
    'Check command output for errors',
    'Use appropriate shell syntax for the platform',
  ],
}

// ============================================================================
// File Editor Agent
// ============================================================================

/**
 * File Editor Agent - Modifies files
 *
 * **Use when you need to:**
 * - Edit file contents
 * - Replace strings in files
 * - Create new files
 * - Update configuration
 *
 * **Tools:** read_files, write_file, str_replace
 */
export const fileEditorAgent: AgentDefinition = {
  id: 'free-file-editor',
  version: '1.0.0',
  displayName: 'File Editor',
  model: 'anthropic/claude-sonnet-4.5',

  systemPrompt: `You are a file editing assistant. Help users modify files accurately and safely.

Your capabilities:
- Read files to understand current content (read_files)
- Write new files or overwrite existing ones (write_file)
- Replace specific strings in files (str_replace)

Always read files before editing to ensure accuracy. Confirm changes with the user when modifying important files.`,

  instructionsPrompt: `When editing files:
1. Read the file first to understand its current state
2. Make precise edits using str_replace or write_file
3. Verify your changes
4. Report what was changed`,

  toolNames: ['read_files', 'write_file', 'str_replace'],
  outputMode: 'last_message',
}

export const fileEditorTemplate: AgentTemplate = {
  definition: fileEditorAgent,
  category: 'file',
  examples: [
    {
      description: 'Update configuration',
      prompt: 'Change the port in config.json from 3000 to 8080',
    },
    {
      description: 'Fix typo',
      prompt: 'Replace "functoin" with "function" in all TypeScript files',
    },
    {
      description: 'Create new file',
      prompt: 'Create a new README.md file with basic project information',
    },
  ],
  tips: [
    'Always read before editing',
    'Use str_replace for small changes',
    'Use write_file for complete rewrites',
  ],
}

// ============================================================================
// Project Analyzer Agent
// ============================================================================

/**
 * Project Analyzer Agent - Analyzes project structure
 *
 * **Use when you need to:**
 * - Understand project structure
 * - Analyze dependencies
 * - Review project configuration
 * - Generate project summaries
 *
 * **Tools:** find_files, read_files, code_search
 */
export const projectAnalyzerAgent: AgentDefinition = {
  id: 'free-project-analyzer',
  version: '1.0.0',
  displayName: 'Project Analyzer',
  model: 'anthropic/claude-sonnet-4.5',

  systemPrompt: `You are a project analysis expert. Help users understand their project structure, dependencies, and organization.

Your capabilities:
- Explore project directory structure (find_files)
- Read and analyze configuration files (read_files)
- Search for patterns and dependencies (code_search)

Provide comprehensive but concise analysis. Focus on key insights and potential issues.`,

  instructionsPrompt: `When analyzing a project:
1. Explore the directory structure
2. Read key configuration files (package.json, tsconfig.json, etc.)
3. Analyze dependencies and structure
4. Provide actionable insights`,

  toolNames: ['find_files', 'read_files', 'code_search'],
  outputMode: 'last_message',
}

export const projectAnalyzerTemplate: AgentTemplate = {
  definition: projectAnalyzerAgent,
  category: 'analysis',
  examples: [
    {
      description: 'Analyze project structure',
      prompt: 'Analyze the structure of this TypeScript project',
    },
    {
      description: 'Check dependencies',
      prompt: 'What are the main dependencies in this project?',
    },
    {
      description: 'Find configuration issues',
      prompt: 'Review all configuration files for potential issues',
    },
  ],
  tips: [
    'Start with configuration files',
    'Look for common patterns and conventions',
    'Identify potential issues early',
  ],
}

// ============================================================================
// TODO Finder Agent
// ============================================================================

/**
 * TODO Finder Agent - Finds all TODOs
 *
 * **Use when you need to:**
 * - Find TODO comments
 * - Find FIXME comments
 * - Track pending work
 * - Generate task lists
 *
 * **Tools:** code_search, read_files
 */
export const todoFinderAgent: AgentDefinition = {
  id: 'free-todo-finder',
  version: '1.0.0',
  displayName: 'TODO Finder',
  model: 'anthropic/claude-sonnet-4.5',

  systemPrompt: `You are a TODO comment finder. Help users locate and organize all TODO, FIXME, and similar comments in their codebase.

Your capabilities:
- Search for TODO/FIXME/HACK comments (code_search)
- Read files for context (read_files)
- Organize findings by priority and file

Provide clear, organized lists of todos with file locations and context.`,

  instructionsPrompt: `When finding TODOs:
1. Search for TODO, FIXME, HACK, XXX, NOTE comments
2. Organize by file and priority
3. Provide context from surrounding code
4. Create an actionable task list`,

  toolNames: ['code_search', 'read_files'],
  outputMode: 'structured_output',
  outputSchema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            line: { type: 'number' },
            type: { type: 'string' },
            message: { type: 'string' },
            context: { type: 'string' },
          },
        },
      },
    },
  },
}

export const todoFinderTemplate: AgentTemplate = {
  definition: todoFinderAgent,
  category: 'analysis',
  examples: [
    {
      description: 'Find all TODOs',
      prompt: 'Find all TODO comments in the codebase',
    },
    {
      description: 'Find high-priority issues',
      prompt: 'Find all FIXME and XXX comments that need immediate attention',
    },
  ],
  tips: [
    'Search for multiple comment types',
    'Group by file or priority',
    'Include surrounding context',
  ],
}

// ============================================================================
// Documentation Generator Agent
// ============================================================================

/**
 * Documentation Generator Agent - Creates docs
 *
 * **Use when you need to:**
 * - Generate API documentation
 * - Create README files
 * - Document code functions
 * - Write usage guides
 *
 * **Tools:** read_files, write_file, code_search
 */
export const docGeneratorAgent: AgentDefinition = {
  id: 'free-doc-generator',
  version: '1.0.0',
  displayName: 'Documentation Generator',
  model: 'anthropic/claude-sonnet-4.5',

  systemPrompt: `You are a documentation expert. Help users create clear, comprehensive documentation for their code and projects.

Your capabilities:
- Read and understand code (read_files)
- Search for patterns and exports (code_search)
- Generate markdown documentation (write_file)

Write clear, concise documentation with examples. Follow markdown best practices.`,

  instructionsPrompt: `When generating documentation:
1. Read the code to understand functionality
2. Identify key functions, classes, and exports
3. Create clear documentation with examples
4. Write to appropriate files (README.md, API.md, etc.)`,

  toolNames: ['read_files', 'write_file', 'code_search'],
  outputMode: 'last_message',
}

export const docGeneratorTemplate: AgentTemplate = {
  definition: docGeneratorAgent,
  category: 'documentation',
  examples: [
    {
      description: 'Generate README',
      prompt: 'Create a README.md for this project',
    },
    {
      description: 'Document API',
      prompt: 'Generate API documentation for all exported functions',
    },
  ],
  tips: [
    'Include usage examples',
    'Follow markdown conventions',
    'Keep documentation up-to-date with code',
  ],
}

// ============================================================================
// Code Reviewer Agent
// ============================================================================

/**
 * Code Reviewer Agent - Reviews code
 *
 * **Use when you need to:**
 * - Review code quality
 * - Find potential bugs
 * - Check coding standards
 * - Suggest improvements
 *
 * **Tools:** read_files, code_search
 */
export const codeReviewerAgent: AgentDefinition = {
  id: 'free-code-reviewer',
  version: '1.0.0',
  displayName: 'Code Reviewer',
  model: 'anthropic/claude-sonnet-4.5',

  systemPrompt: `You are an expert code reviewer. Help users improve code quality, find bugs, and follow best practices.

Your capabilities:
- Read and analyze code (read_files)
- Search for patterns and anti-patterns (code_search)
- Provide actionable feedback

Focus on:
- Code quality and readability
- Potential bugs and edge cases
- Performance issues
- Security concerns
- Best practices

Be constructive and specific in your feedback.`,

  instructionsPrompt: `When reviewing code:
1. Read the code thoroughly
2. Look for common issues and anti-patterns
3. Search for similar patterns that might have issues
4. Provide specific, actionable feedback
5. Highlight both problems and good practices`,

  toolNames: ['read_files', 'code_search'],
  outputMode: 'structured_output',
  outputSchema: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            severity: { type: 'string' },
            file: { type: 'string' },
            line: { type: 'number' },
            description: { type: 'string' },
            suggestion: { type: 'string' },
          },
        },
      },
      strengths: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
}

export const codeReviewerTemplate: AgentTemplate = {
  definition: codeReviewerAgent,
  category: 'review',
  examples: [
    {
      description: 'Review a file',
      prompt: 'Review the code in src/index.ts',
    },
    {
      description: 'Check for security issues',
      prompt: 'Review all files for potential security vulnerabilities',
    },
  ],
  tips: [
    'Be specific with feedback',
    'Include both issues and strengths',
    'Prioritize by severity',
  ],
}

// ============================================================================
// Dependency Analyzer Agent
// ============================================================================

/**
 * Dependency Analyzer Agent - Analyzes dependencies
 *
 * **Use when you need to:**
 * - List project dependencies
 * - Find unused dependencies
 * - Check for outdated packages
 * - Analyze dependency tree
 *
 * **Tools:** read_files, code_search, run_terminal_command
 */
export const dependencyAnalyzerAgent: AgentDefinition = {
  id: 'free-dependency-analyzer',
  version: '1.0.0',
  displayName: 'Dependency Analyzer',
  model: 'anthropic/claude-sonnet-4.5',

  systemPrompt: `You are a dependency analysis expert. Help users understand and manage their project dependencies.

Your capabilities:
- Read package.json and lock files (read_files)
- Search for import statements (code_search)
- Run npm/yarn commands (run_terminal_command)

Provide insights on:
- Unused dependencies
- Outdated packages
- Security vulnerabilities
- Dependency conflicts`,

  instructionsPrompt: `When analyzing dependencies:
1. Read package.json and lock files
2. Search for actual imports in the codebase
3. Check for unused dependencies
4. Run commands to check for updates
5. Provide actionable recommendations`,

  toolNames: ['read_files', 'code_search', 'run_terminal_command'],
  outputMode: 'structured_output',
  outputSchema: {
    type: 'object',
    properties: {
      dependencies: {
        type: 'array',
        items: { type: 'string' },
      },
      unused: {
        type: 'array',
        items: { type: 'string' },
      },
      recommendations: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
}

export const dependencyAnalyzerTemplate: AgentTemplate = {
  definition: dependencyAnalyzerAgent,
  category: 'analysis',
  examples: [
    {
      description: 'List all dependencies',
      prompt: 'What dependencies does this project use?',
    },
    {
      description: 'Find unused dependencies',
      prompt: 'Find dependencies that are not actually imported anywhere',
    },
  ],
  tips: [
    'Check both dependencies and devDependencies',
    'Search for imports to verify usage',
    'Consider transitive dependencies',
  ],
}

// ============================================================================
// Security Auditor Agent
// ============================================================================

/**
 * Security Auditor Agent - Finds security issues
 *
 * **Use when you need to:**
 * - Find security vulnerabilities
 * - Check for hardcoded secrets
 * - Review authentication code
 * - Audit API endpoints
 *
 * **Tools:** code_search, read_files
 */
export const securityAuditorAgent: AgentDefinition = {
  id: 'free-security-auditor',
  version: '1.0.0',
  displayName: 'Security Auditor',
  model: 'anthropic/claude-sonnet-4.5',

  systemPrompt: `You are a security auditor. Help users identify potential security vulnerabilities in their code.

Your capabilities:
- Search for security patterns (code_search)
- Read and analyze security-critical code (read_files)

Look for:
- Hardcoded secrets (API keys, passwords, tokens)
- SQL injection vulnerabilities
- XSS vulnerabilities
- Insecure authentication
- Exposed sensitive data
- Unsafe dependencies

Be thorough but don't create false positives.`,

  instructionsPrompt: `When auditing for security:
1. Search for common vulnerability patterns
2. Read security-critical files (auth, API routes, etc.)
3. Look for hardcoded secrets
4. Check input validation
5. Report findings with severity levels`,

  toolNames: ['code_search', 'read_files'],
  outputMode: 'structured_output',
  outputSchema: {
    type: 'object',
    properties: {
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            severity: { type: 'string' },
            category: { type: 'string' },
            file: { type: 'string' },
            line: { type: 'number' },
            description: { type: 'string' },
            recommendation: { type: 'string' },
          },
        },
      },
    },
  },
}

export const securityAuditorTemplate: AgentTemplate = {
  definition: securityAuditorAgent,
  category: 'security',
  examples: [
    {
      description: 'Find hardcoded secrets',
      prompt: 'Search for hardcoded API keys, passwords, or tokens',
    },
    {
      description: 'Audit authentication',
      prompt: 'Review authentication and authorization code for vulnerabilities',
    },
  ],
  tips: [
    'Search for common secret patterns',
    'Check authentication logic carefully',
    'Look for input validation issues',
  ],
}

// ============================================================================
// Test Generator Agent
// ============================================================================

/**
 * Test Generator Agent - Generates test cases
 *
 * **Use when you need to:**
 * - Generate unit tests
 * - Create test fixtures
 * - Write integration tests
 * - Improve test coverage
 *
 * **Tools:** read_files, write_file, code_search
 */
export const testGeneratorAgent: AgentDefinition = {
  id: 'free-test-generator',
  version: '1.0.0',
  displayName: 'Test Generator',
  model: 'anthropic/claude-sonnet-4.5',

  systemPrompt: `You are a test generation expert. Help users create comprehensive test cases for their code.

Your capabilities:
- Read and understand code to test (read_files)
- Search for existing test patterns (code_search)
- Generate test files (write_file)

Generate tests that:
- Cover main functionality
- Test edge cases
- Follow existing test patterns
- Use appropriate assertions`,

  instructionsPrompt: `When generating tests:
1. Read the code to understand functionality
2. Search for existing test patterns
3. Identify test cases (happy path, edge cases, errors)
4. Generate test file with appropriate structure
5. Include setup and teardown if needed`,

  toolNames: ['read_files', 'write_file', 'code_search'],
  outputMode: 'last_message',
}

export const testGeneratorTemplate: AgentTemplate = {
  definition: testGeneratorAgent,
  category: 'code',
  examples: [
    {
      description: 'Generate unit tests',
      prompt: 'Generate unit tests for the functions in src/utils.ts',
    },
    {
      description: 'Create test fixtures',
      prompt: 'Create test fixtures for the User model',
    },
  ],
  tips: [
    'Follow existing test patterns',
    'Cover both success and error cases',
    'Include edge cases',
  ],
}

// ============================================================================
// Export All Templates
// ============================================================================

/**
 * All agent definitions (without metadata)
 */
export const allAgents: AgentDefinition[] = [
  fileExplorerAgent,
  codeSearchAgent,
  terminalAgent,
  fileEditorAgent,
  projectAnalyzerAgent,
  todoFinderAgent,
  docGeneratorAgent,
  codeReviewerAgent,
  dependencyAnalyzerAgent,
  securityAuditorAgent,
  testGeneratorAgent,
]

/**
 * All agent templates (with metadata and examples)
 */
export const allTemplates: AgentTemplate[] = [
  fileExplorerTemplate,
  codeSearchTemplate,
  terminalTemplate,
  fileEditorTemplate,
  projectAnalyzerTemplate,
  todoFinderTemplate,
  docGeneratorTemplate,
  codeReviewerTemplate,
  dependencyAnalyzerTemplate,
  securityAuditorTemplate,
  testGeneratorTemplate,
]

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
  category: AgentTemplate['category']
): AgentTemplate[] {
  return allTemplates.filter((t) => t.category === category)
}

/**
 * Find template by agent ID
 */
export function findTemplate(agentId: string): AgentTemplate | undefined {
  return allTemplates.find((t) => t.definition.id === agentId)
}
